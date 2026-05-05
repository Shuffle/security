/**
 * SingulDrawer — Self-contained app configuration drawer for ShuffleMCP.
 *
 * Mirrors the in-app AppDetailDrawer behaviour, but with ZERO external deps
 * (no MUI, no framer-motion, no markdown). Plain React + the library's own
 * CSS so npm consumers get the same UX out of the box.
 *
 * Features:
 *  - Fetches app config (authentication.parameters) from /api/v1/apps/{id}/config
 *  - Lists existing authentications (Configured / Tested / Inactive chips)
 *  - Inline edit-or-create authentication form (per-field, with `required`)
 *  - Save (PUT /api/v1/apps/authentication)
 *  - Test connection (POST /api/v1/apps/categories/run, action=test_api)
 *  - Activate / Deactivate the app
 *  - "Try it out" MCP chat (POST /api/v1/apps/{name}/mcp)
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { AlgoliaSearchApp, AppAuthentication } from './shuffle-mcp.helpers';

interface AppConfigParam {
  id?: string;
  name: string;
  description?: string;
  example?: string;
  required?: boolean;
}

interface AppConfig {
  name: string;
  description?: string;
  large_image?: string;
  categories?: string[];
  authentication?: {
    type?: string;
    parameters?: AppConfigParam[];
  };
}

export interface SingulDrawerProps {
  app: AlgoliaSearchApp;
  authenticatedApps: AppAuthentication[];
  apiKey?: string;
  authToken?: string;
  orgId?: string;
  apiBaseUrl: string;
  appAuthPath: string;
  onClose: () => void;
  onAuthRefresh: () => void;
}

const buildHeaders = (apiKey?: string, orgId?: string, json = false): HeadersInit => {
  const h: Record<string, string> = {};
  if (apiKey) h['Authorization'] = `Bearer ${apiKey}`;
  if (orgId) h['Org-Id'] = orgId;
  if (json) h['Content-Type'] = 'application/json';
  return h;
};

const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_\-]+/g, '_');

export const SingulDrawer: React.FC<SingulDrawerProps> = ({
  app,
  authenticatedApps,
  apiKey,
  authToken,
  orgId,
  apiBaseUrl,
  appAuthPath,
  onClose,
  onAuthRefresh,
}) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [activated, setActivated] = useState<boolean | null>(null);
  const [activatedId, setActivatedId] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);

  // Auth form state — per existing auth (by id) or 'new'
  const [editingId, setEditingId] = useState<string>('new');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [savingAuth, setSavingAuth] = useState(false);
  const [testing, setTesting] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // MCP chat
  const [mcpInput, setMcpInput] = useState('');
  const [mcpRunning, setMcpRunning] = useState(false);
  const [mcpResult, setMcpResult] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const matchingAuths = useMemo(
    () => authenticatedApps.filter(a => norm(a.app?.name || '') === norm(app.name)),
    [authenticatedApps, app.name]
  );
  const displayName = app.name.replace(/_/g, ' ');

  // Fetch app config
  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfig(null);
    setActivated(null);
    setActivatedId(null);

    (async () => {
      if (!apiKey) {
        if (!cancelled) {
          setConfig({
            name: app.name,
            description: app.description,
            large_image: app.image_url,
            categories: app.categories,
          });
          setConfigLoading(false);
        }
        return;
      }
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/apps/${encodeURIComponent(app.objectID)}/config`,
          { headers: buildHeaders(apiKey, orgId), credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setConfig({
              ...data,
              large_image: data.large_image || app.image_url,
              categories: data.categories || app.categories,
            });
          }
        } else if (!cancelled) {
          setConfig({
            name: app.name,
            description: app.description,
            large_image: app.image_url,
            categories: app.categories,
          });
        }
      } catch {
        if (!cancelled) {
          setConfig({
            name: app.name,
            description: app.description,
            large_image: app.image_url,
            categories: app.categories,
          });
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }

      // Activation check (parallel)
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/apps`, {
          headers: buildHeaders(apiKey, orgId),
          credentials: 'include',
        });
        if (res.ok) {
          const apps = await res.json();
          if (!cancelled && Array.isArray(apps)) {
            const m = apps.find(
              (a: any) => norm(a.name || '') === norm(app.name) && a.activated
            );
            setActivated(!!m);
            setActivatedId(m?.id || null);
          }
        } else if (!cancelled) {
          setActivated(false);
        }
      } catch {
        if (!cancelled) setActivated(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [app.objectID, app.name, apiKey, orgId, apiBaseUrl]);

  // When user picks an existing auth to edit, prefill values
  useEffect(() => {
    if (editingId === 'new') {
      setCredentials({});
      setAuthMessage(null);
      return;
    }
    const entry = matchingAuths.find(a => a.id === editingId);
    if (entry) {
      const next: Record<string, string> = {};
      for (const f of entry.fields || []) next[f.key] = f.value || '';
      setCredentials(next);
      setAuthMessage(null);
    }
  }, [editingId, matchingAuths]);

  const params = config?.authentication?.parameters || [];

  const handleSave = async () => {
    if (!apiKey) return;
    const fields = Object.entries(credentials)
      .filter(([k, v]) => k.trim() && v && String(v).trim())
      .map(([key, value]) => ({ key, value }));

    const payload: any = {
      label: `Auth for ${displayName}`,
      app: { name: app.name, id: app.objectID, app_version: '1.0.0' },
      fields,
      active: true,
    };
    if (editingId !== 'new') payload.id = editingId;

    setSavingAuth(true);
    setAuthMessage(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/apps/authentication`, {
        method: 'PUT',
        headers: buildHeaders(apiKey, orgId, true),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setAuthMessage({ kind: 'ok', text: 'Authentication saved.' });
        onAuthRefresh();
      } else {
        setAuthMessage({ kind: 'err', text: `Save failed (${res.status}).` });
      }
    } catch (e: any) {
      setAuthMessage({ kind: 'err', text: e?.message || 'Save failed.' });
    } finally {
      setSavingAuth(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey) return;
    setTesting(true);
    setAuthMessage(null);
    try {
      const body: any = { action: 'test_api', app: app.name, skip_workflow: true };
      if (editingId !== 'new') body.authentication_id = editingId;
      const res = await fetch(`${apiBaseUrl}/api/v1/apps/categories/run`, {
        method: 'POST',
        headers: buildHeaders(apiKey, orgId, true),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      const valid =
        res.ok &&
        data &&
        ['done', 'app_validation'].includes(data.action) &&
        data.success === true;
      setAuthMessage(
        valid
          ? { kind: 'ok', text: 'Connection verified.' }
          : { kind: 'err', text: data?.reason || `Test failed (${res.status}).` }
      );
      onAuthRefresh();
    } catch (e: any) {
      setAuthMessage({ kind: 'err', text: e?.message || 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleActivateToggle = async () => {
    if (!apiKey || activateLoading) return;
    const wasActivated = activated;
    const prevId = activatedId;
    setActivateLoading(true);
    setActivated(!wasActivated);
    try {
      if (wasActivated && prevId) {
        const r = await fetch(`${apiBaseUrl}/api/v1/apps/${prevId}/deactivate`, {
          method: 'POST',
          headers: buildHeaders(apiKey, orgId),
          credentials: 'include',
        });
        if (!r.ok) throw new Error('Deactivate failed');
        setActivatedId(null);
      } else {
        const r = await fetch(`${apiBaseUrl}/api/v1/apps/${app.objectID}/activate`, {
          method: 'GET',
          headers: buildHeaders(apiKey, orgId),
          credentials: 'include',
        });
        if (!r.ok) throw new Error('Activate failed');
        setActivatedId(app.objectID);
      }
    } catch {
      setActivated(wasActivated);
      setActivatedId(prevId);
    } finally {
      setActivateLoading(false);
    }
  };

  const runMcp = useCallback(async () => {
    const text = mcpInput.trim();
    if (!text || mcpRunning || !apiKey) return;
    setMcpRunning(true);
    setMcpResult(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/apps/${encodeURIComponent(app.name)}/mcp`,
        {
          method: 'POST',
          headers: buildHeaders(apiKey, orgId, true),
          credentials: 'include',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id:
              (globalThis as any).crypto?.randomUUID?.() ||
              String(Date.now()),
            method: 'tools/call',
            params: {
              tool_name: app.name,
              tool_id: matchingAuths[0]?.app?.id || matchingAuths[0]?.id || app.name,
              input: { text },
            },
          }),
        }
      );
      const raw = await res.text();
      if (!res.ok) {
        setMcpResult({ kind: 'err', text: `Error ${res.status}: ${raw || res.statusText}` });
      } else {
        let out = raw;
        try {
          const data = JSON.parse(raw);
          if (typeof data === 'string') out = data;
          else if (data?.result)
            out =
              typeof data.result === 'object'
                ? data.result.message ||
                  JSON.stringify(data.result, null, 2)
                : String(data.result);
          else if (data?.message) out = data.message;
          else out = JSON.stringify(data, null, 2);
        } catch {
          /* leave raw */
        }
        setMcpResult({ kind: 'ok', text: out || 'No output returned.' });
      }
    } catch (e: any) {
      setMcpResult({ kind: 'err', text: e?.message || 'Request failed.' });
    } finally {
      setMcpRunning(false);
    }
  }, [mcpInput, mcpRunning, apiKey, apiBaseUrl, orgId, app.name, matchingAuths]);

  const handoffToken = apiKey || authToken || '';
  const fallbackAuthUrl = `${apiBaseUrl}${appAuthPath}?app_id=${app.objectID}&auth=${handoffToken}&source=shuffle${
    orgId ? `&org_id=${encodeURIComponent(orgId)}` : ''
  }`;

  return (
    <>
      <div className="singul-drawer-backdrop" onClick={onClose} />
      <aside className="singul-drawer" role="dialog" aria-label={`${displayName} configuration`}>
        {/* Header */}
        <header className="singul-drawer-header">
          <div className="singul-drawer-title-row">
            {(config?.large_image || app.image_url) && (
              <img
                src={config?.large_image || app.image_url}
                alt={displayName}
                className="singul-drawer-icon"
              />
            )}
            <div>
              <div className="singul-drawer-title" style={{ textTransform: 'capitalize' }}>
                {displayName}
              </div>
              <div className="singul-drawer-subtitle">App configuration</div>
            </div>
          </div>
          <button
            type="button"
            className="singul-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="singul-drawer-body">
          {/* Description + activate */}
          <div className="singul-drawer-meta">
            {config?.description && (
              <p className="singul-drawer-desc">{config.description}</p>
            )}
            {apiKey && activated !== null && (
              <button
                type="button"
                className={`singul-drawer-activate ${
                  activated ? 'singul-drawer-activate-on' : ''
                }`}
                onClick={handleActivateToggle}
                disabled={activateLoading}
              >
                {activateLoading
                  ? '…'
                  : activated
                  ? 'Deactivate'
                  : 'Activate'}
              </button>
            )}
          </div>

          {/* Authentication */}
          <div className="singul-drawer-section-title">
            Authentication
            <span className="singul-drawer-count">
              {matchingAuths.length} configuration
              {matchingAuths.length === 1 ? '' : 's'} found
            </span>
          </div>

          {/* Auth picker tabs */}
          {matchingAuths.length > 0 && (
            <div className="singul-auth-tabs" role="tablist">
              {matchingAuths.map(a => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={editingId === a.id}
                  className={`singul-auth-tab ${
                    editingId === a.id ? 'singul-auth-tab-active' : ''
                  }`}
                  onClick={() => setEditingId(a.id)}
                >
                  <span className="singul-auth-tab-label">
                    {a.label || 'Untitled'}
                  </span>
                  <span className="singul-auth-tab-chips">
                    {a.validation?.valid && (
                      <span className="singul-chip singul-chip-tested">Tested</span>
                    )}
                    {a.active && !a.validation?.valid && (
                      <span className="singul-chip singul-chip-configured">Configured</span>
                    )}
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={editingId === 'new'}
                className={`singul-auth-tab singul-auth-tab-new ${
                  editingId === 'new' ? 'singul-auth-tab-active' : ''
                }`}
                onClick={() => setEditingId('new')}
              >
                + New
              </button>
            </div>
          )}

          {/* Form */}
          {!apiKey ? (
            <div className="singul-drawer-empty">
              Pass an <code>apiKey</code> prop to manage authentications inline. Without
              it, you can only redirect to the auth page.
            </div>
          ) : configLoading ? (
            <div className="singul-drawer-empty">Loading configuration…</div>
          ) : params.length === 0 ? (
            <div className="singul-drawer-empty">
              {config?.authentication?.type === 'oauth2'
                ? 'This app uses OAuth. Use the button below to authorize.'
                : 'No configurable fields for this app.'}
            </div>
          ) : (
            <form
              className="singul-auth-form"
              onSubmit={e => {
                e.preventDefault();
                handleSave();
              }}
            >
              {params.map(p => {
                const key = p.id || p.name;
                return (
                  <label key={key} className="singul-auth-field">
                    <span className="singul-auth-field-label">
                      {p.name}
                      {p.required && <span className="singul-auth-field-req"> *</span>}
                    </span>
                    {p.description && (
                      <span className="singul-auth-field-desc">{p.description}</span>
                    )}
                    <input
                      className="singul-auth-input"
                      type={
                        /password|secret|token|key/i.test(p.name) ? 'password' : 'text'
                      }
                      placeholder={p.example || ''}
                      value={credentials[key] || ''}
                      onChange={e =>
                        setCredentials(prev => ({ ...prev, [key]: e.target.value }))
                      }
                      required={!!p.required}
                    />
                  </label>
                );
              })}

              <div className="singul-auth-actions">
                <button
                  type="submit"
                  className="singul-btn singul-btn-primary"
                  disabled={savingAuth}
                >
                  {savingAuth ? 'Saving…' : editingId === 'new' ? 'Save' : 'Update'}
                </button>
                {editingId !== 'new' && (
                  <button
                    type="button"
                    className="singul-btn singul-btn-secondary"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    {testing ? 'Testing…' : 'Test connection'}
                  </button>
                )}
              </div>

              {authMessage && (
                <div
                  className={`singul-auth-message ${
                    authMessage.kind === 'ok'
                      ? 'singul-auth-message-ok'
                      : 'singul-auth-message-err'
                  }`}
                >
                  {authMessage.text}
                </div>
              )}
            </form>
          )}

          {/* Fallback OAuth/redirect link */}
          {(config?.authentication?.type === 'oauth2' || !apiKey) && (
            <a
              href={fallbackAuthUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="singul-drawer-cta"
            >
              {matchingAuths.length > 0 ? 'Manage on shuffler.io' : 'Authorize on shuffler.io'}
            </a>
          )}

          {/* MCP "Try it out" */}
          {apiKey && matchingAuths.length > 0 && (
            <>
              <div className="singul-drawer-section-title" style={{ marginTop: 24 }}>
                Try it out
                <span className="singul-chip singul-chip-tested">MCP</span>
              </div>
              <div className="singul-mcp-input-wrap">
                <span className="singul-mcp-prompt">›</span>
                <input
                  className="singul-mcp-input"
                  type="text"
                  placeholder={`Ask ${displayName} something…`}
                  value={mcpInput}
                  onChange={e => setMcpInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runMcp();
                    }
                  }}
                  disabled={mcpRunning}
                />
                <button
                  type="button"
                  className="singul-mcp-run"
                  onClick={runMcp}
                  disabled={mcpRunning || !mcpInput.trim()}
                  aria-label="Run"
                >
                  {mcpRunning ? '…' : '▶'}
                </button>
              </div>
              {mcpResult && (
                <pre
                  className={`singul-mcp-result ${
                    mcpResult.kind === 'err' ? 'singul-mcp-result-err' : ''
                  }`}
                >
                  {mcpResult.text}
                </pre>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default SingulDrawer;
