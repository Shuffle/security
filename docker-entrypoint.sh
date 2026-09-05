#!/bin/bash
set -eo pipefail

# Allow passing arbitrary commands (e.g. `docker run ... bash` or `sh`)
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "==> Starting Shuffle Security..."

# 1. Ensure required directories exist
mkdir -p /etc/nginx /usr/share/nginx/html /app/.output/public

# 2. TLS Certificate Handling:
# For users with their own reverse proxy (Cloudflare, Caddy, Traefik, etc.), traffic hits HTTP (port 80 / 3002).
# For direct HTTPS on port 443 (port 3444), ensure certificates exist so Nginx starts without SSL errors.
# If user-provided certs are mounted at /etc/nginx/*.pem, preserve them.
if [ ! -s /etc/nginx/fullchain.cert.pem ] || [ ! -s /etc/nginx/privkey.pem ]; then
  echo "==> Generating fallback self-signed TLS certificate for Nginx (port 443)..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/privkey.pem \
    -out /etc/nginx/fullchain.cert.pem \
    -subj "/CN=localhost" 2>/dev/null || {
      echo "WARNING: Failed to generate self-signed certificate. HTTPS may not function."
    }
  chmod 600 /etc/nginx/privkey.pem 2>/dev/null || true
  chmod 644 /etc/nginx/fullchain.cert.pem 2>/dev/null || true
else
  echo "==> Using existing TLS certificate in /etc/nginx."
fi

# 3. Generate runtime client configuration (env-config.js)
echo "==> Writing runtime configuration to env-config.js..."
CORE_URL="${SHUFFLE_CORE_URL:-$VITE_SHUFFLE_CORE_URL}"
SEC_URL="${SHUFFLE_SECURITY_URL:-$VITE_SHUFFLE_SECURITY_URL}"
API_URL="${SHUFFLE_API_URL:-$VITE_SHUFFLE_API_URL}"

cat <<CONFIG_EOF > /usr/share/nginx/html/env-config.js
window.__SHUFFLE_CONFIG__ = Object.assign(window.__SHUFFLE_CONFIG__ || {}, {
  SHUFFLE_CORE_URL: "${CORE_URL}",
  SHUFFLE_SECURITY_URL: "${SEC_URL}",
  SHUFFLE_API_URL: "${API_URL}"
});
CONFIG_EOF
cp /usr/share/nginx/html/env-config.js /app/.output/public/env-config.js 2>/dev/null || true

# 4. Resolve Nginx configuration from template
BACKEND_HOSTNAME="${BACKEND_HOSTNAME:-shuffle-backend}"
export BACKEND_HOSTNAME

TEMPLATE_PATH="/app/nginx.conf.template"
if [ ! -f "$TEMPLATE_PATH" ] && [ -f /etc/nginx/nginx.conf.template ]; then
  TEMPLATE_PATH="/etc/nginx/nginx.conf.template"
fi

if [ -f "$TEMPLATE_PATH" ]; then
  echo "==> Resolving Nginx configuration with BACKEND_HOSTNAME=${BACKEND_HOSTNAME}..."
  envsubst '${BACKEND_HOSTNAME}' < "$TEMPLATE_PATH" > /etc/nginx/nginx.conf
fi

# Validate Nginx configuration syntax
if command -v nginx >/dev/null 2>&1; then
  if ! nginx -t 2>/dev/null; then
    echo "ERROR: Nginx configuration test failed!"
    nginx -t
    exit 1
  fi
fi

# 5. Start Nitro SSR server in the background
echo "==> Starting Nitro SSR server on 127.0.0.1:3000..."
NITRO_PORT=3000 PORT=3000 HOST=127.0.0.1 NITRO_HOST=127.0.0.1 node /app/.output/server/index.mjs &
NITRO_PID=$!

# 6. Wait for Nitro SSR server to be ready before starting Nginx
echo "==> Waiting for Nitro SSR server to be ready..."
READY=0
for i in $(seq 1 30); do
  if ! kill -0 "$NITRO_PID" 2>/dev/null; then
    echo "ERROR: Nitro SSR server process exited unexpectedly during startup!"
    wait "$NITRO_PID"
    exit 1
  fi

  # Check if port 3000 is listening and responding to HTTP requests
  if node -e "const http = require('http'); const req = http.get('http://127.0.0.1:3000', () => process.exit(0)); req.on('error', () => process.exit(1));" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: Nitro SSR server failed to become ready within 15 seconds!"
  kill "$NITRO_PID" 2>/dev/null || true
  exit 1
fi

echo "==> Nitro SSR server is ready and accepting requests on port 3000."

# 7. Start Nginx reverse proxy
echo "==> Starting Nginx reverse proxy..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Trap termination signals to shut down both processes cleanly
cleanup() {
  echo "==> Shutting down Shuffle Security..."
  kill -TERM "$NITRO_PID" "$NGINX_PID" 2>/dev/null || true
  wait "$NITRO_PID" "$NGINX_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# Monitor both processes: if either dies, exit so Docker can restart the container
wait -n "$NITRO_PID" "$NGINX_PID"
EXIT_CODE=$?
echo "ERROR: A core service exited with code $EXIT_CODE."
kill -TERM "$NITRO_PID" "$NGINX_PID" 2>/dev/null || true
exit "$EXIT_CODE"
