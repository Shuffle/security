# Stage 1: Build TanStack Start / Nitro application
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Optional build-time URL overrides (can also be configured dynamically at runtime in Stage 2)
ARG VITE_SHUFFLE_API_URL
ENV VITE_SHUFFLE_API_URL=$VITE_SHUFFLE_API_URL

ARG VITE_SHUFFLE_CORE_URL
ENV VITE_SHUFFLE_CORE_URL=$VITE_SHUFFLE_CORE_URL

ARG VITE_SHUFFLE_SECURITY_URL
ENV VITE_SHUFFLE_SECURITY_URL=$VITE_SHUFFLE_SECURITY_URL

# Build standalone Node.js server using Nitro node-server preset
ENV NITRO_PRESET=node-server

COPY package.json bun.lock ./
RUN bun install --ignore-scripts

COPY . .
RUN bun run build

# Stage 2: Serve with Node.js + Nginx reverse proxy
FROM node:20-alpine

# Install nginx, openssl, and gettext (for envsubst)
RUN apk add --no-cache nginx openssl gettext

WORKDIR /app

# Remove default nginx configs
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Bake a self-signed certificate into the image so the 443 listener works out of the box.
# It is regenerated at container start as well (see CMD) in case /etc/nginx is overlaid by a volume mount.
RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/privkey.pem \
      -out /etc/nginx/fullchain.cert.pem \
      -subj "/CN=localhost"

# Copy project nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built server bundle and public assets
COPY --from=build /app/.output /app/.output
COPY --from=build /app/.output/public /usr/share/nginx/html

# BACKEND_HOSTNAME is resolved at runtime via envsubst
ENV BACKEND_HOSTNAME=backend
ENV PORT=3000
ENV NITRO_PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

# Dynamic URL overrides for runtime container deployments:
# - SHUFFLE_CORE_URL / VITE_SHUFFLE_CORE_URL: Overrides the Shuffle Core frontend base URL
#     Cloud: https://shuffler.io (default)
#     On-Prem / Docker: http://<host>:3001 (default) or e.g. https://core.yourdomain.com
# - SHUFFLE_SECURITY_URL / VITE_SHUFFLE_SECURITY_URL: Overrides the Shuffle Security frontend base URL
# - SHUFFLE_API_URL / VITE_SHUFFLE_API_URL: Overrides backend API base URL
ENV SHUFFLE_CORE_URL=""
ENV SHUFFLE_SECURITY_URL=""
ENV SHUFFLE_API_URL=""

EXPOSE 80 443

# At container start:
#   1. Ensure a self-signed cert exists (regenerate if missing — e.g. when /etc/nginx is volume-mounted).
#   2. Generate /usr/share/nginx/html/env-config.js for client-side runtime config.
#   3. Resolve $BACKEND_HOSTNAME in nginx.conf via envsubst.
#   4. Start the background Nitro SSR server on 127.0.0.1:3000.
#   5. Launch nginx in the foreground.
CMD ["/bin/sh", "-c", "\
  if [ ! -f /etc/nginx/fullchain.cert.pem ] || [ ! -f /etc/nginx/privkey.pem ]; then \
    echo 'Generating self-signed TLS certificate for nginx...'; \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/privkey.pem \
      -out /etc/nginx/fullchain.cert.pem \
      -subj '/CN=localhost'; \
  fi && \
  echo 'Writing runtime configuration to env-config.js...' && \
  printf 'window.__SHUFFLE_CONFIG__ = Object.assign(window.__SHUFFLE_CONFIG__ || {}, {\n  SHUFFLE_CORE_URL: \"%s\",\n  SHUFFLE_SECURITY_URL: \"%s\",\n  SHUFFLE_API_URL: \"%s\"\n});\n' \
    \"${SHUFFLE_CORE_URL:-$VITE_SHUFFLE_CORE_URL}\" \
    \"${SHUFFLE_SECURITY_URL:-$VITE_SHUFFLE_SECURITY_URL}\" \
    \"${SHUFFLE_API_URL:-$VITE_SHUFFLE_API_URL}\" \
    > /usr/share/nginx/html/env-config.js && \
  cp /usr/share/nginx/html/env-config.js /app/.output/public/env-config.js 2>/dev/null || true && \
  envsubst '$${BACKEND_HOSTNAME}' < /etc/nginx/nginx.conf > /tmp/nginx.conf && \
  mv /tmp/nginx.conf /etc/nginx/nginx.conf && \
  echo 'Starting Nitro SSR server on port 3000...' && \
  NITRO_PORT=3000 PORT=3000 node /app/.output/server/index.mjs & \
  echo 'Starting Nginx reverse proxy...' && \
  nginx -g 'daemon off;'"]
