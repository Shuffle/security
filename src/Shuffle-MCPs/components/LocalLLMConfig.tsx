import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { AppAuthCard, isAuthVerifiedLocally } from '@/Shuffle-MCPs/components/AppAuthConfig';
import type { AlgoliaSearchApp } from '@/Shuffle-MCPs/shuffle-mcp.helpers';
import { useAppAuth } from '@/Shuffle-MCPs/useAppAuth';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { refreshAllIntegrationStatus } from '@/Shuffle-MCPs/components/IntegrationStatus';
import {
  fetchAuthenticatedApps as fetchSharedAuthenticatedApps,
  invalidateAuthenticatedAppsCache,
} from '@/Shuffle-MCPs/authenticatedApps';
import { UsageBar } from '@/Shuffle-MCPs/components/UsageBar';
import { useSyncHostBaseUrl } from '@/Shuffle-MCPs/useSyncHostBaseUrl';
import type { ShuffleHostProps } from '@/Shuffle-MCPs/host-props';
import {
  ENDPOINT_PRESETS,
  PROVIDER_DOMAINS,
  SHUFFLE_AI_PRESET,
  CUSTOM_PRESET,
  detectLLMProvider,
} from '@/Shuffle-MCPs/llmProviderDetect';

const OPENAI_APP_NAME = 'OpenAI';
const OPENAI_APP_ID = '5d19dd82517870c68d40cacad9b5ca91';

const OPENAI_ALGOLIA_APP: AlgoliaSearchApp = {
  name: OPENAI_APP_NAME,
  description: 'OpenAI-compatible LLM endpoint for agent operations',
  objectID: OPENAI_APP_ID,
  creator: '',
  app_version: '1.0.0',
  image_url: '',
  time_edited: 0,
  generated: false,
  invalid: false,
  priority: 0,
  actions: 0,
  tags: [],
  accessible_by: [],
  categories: [],
  action_labels: [],
  triggers: [],
  verified: true,
};

/** The OpenAI-compatible auth schema is fixed (url + apikey), so we render the
 *  fields immediately instead of waiting on an app-config request. */
const OPENAI_AUTH_SCHEMA = {
  type: 'authentication',
  required: true,
  parameters: [
    {
      id: 'url',
      name: 'url',
      description: 'Base URL of the OpenAI-compatible endpoint',
      example: 'https://api.openai.com/v1',
      required: true,
      schema: { type: 'string' },
    },
    {
      id: 'apikey',
      name: 'apikey',
      description: 'API key for the provider',
      example: '',
      required: true,
      schema: { type: 'string' },
    },
  ],
};


const CUSTOM_MODEL = 'Custom…';

// Curated 2026-era model lists per provider. The FIRST entry is the default
// selected for that provider, and is the best general-purpose model for
// security analysis work (strong reasoning, sane cost/latency).
// Custom value can always be typed in.
const PROVIDER_MODELS: Record<string, string[]> = {
  OpenAI: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'o4-mini'],
  Anthropic: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5', 'claude-opus-4', 'claude-sonnet-4', 'claude-3-7-sonnet-latest'],
  'Google Gemini': ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  Mistral: ['mistral-large-2026', 'mistral-medium-3', 'mistral-small-3.2', 'codestral-2026', 'magistral-medium-2026', 'ministral-8b-latest'],
  Groq: ['llama-4-maverick-17b-128e', 'llama-4-scout-17b-16e', 'llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-3-32b', 'kimi-k2-instruct'],
  DeepSeek: ['deepseek-v3.5', 'deepseek-v3', 'deepseek-r1', 'deepseek-coder-v3'],
  'Together AI': ['meta-llama/Llama-4-Maverick-17B-128E-Instruct', 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen3-235B-A22B'],
  OpenRouter: ['anthropic/claude-sonnet-4.5', 'openai/gpt-5.5', 'openai/gpt-5.4', 'anthropic/claude-opus-4.5', 'google/gemini-3-pro-preview', 'google/gemini-3-flash-preview', 'meta-llama/llama-4-maverick', 'deepseek/deepseek-v3.5', 'x-ai/grok-4'],
  'Ollama (localhost)': ['llama3.3', 'qwen3', 'llama3.2', 'qwen3:32b', 'deepseek-r1', 'deepseek-r1:70b', 'mistral-small3', 'phi4', 'gemma3'],
  'LM Studio (localhost)': ['qwen3-32b', 'llama-3.3-70b-instruct', 'deepseek-r1-distill-qwen-32b', 'mistral-small-3', 'phi-4', 'gemma-3-27b'],
};


export interface AgentLocalModel {
  url: string;
  apikey: string;
  model: string;
}

export interface LocalLLMTestResult {
  success: boolean;
  message: string;
  models?: string[];
  latencyMs?: number;
}





const ProviderLogo = ({ label, url }: { label: string; url?: string }) => {
  const [errored, setErrored] = useState(false);
  let domain = PROVIDER_DOMAINS[label];
  if (!domain && url) {
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* noop */ }
  }
  const src = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <Box sx={{ width: 18, height: 18, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'hsl(var(--muted))', overflow: 'hidden', flexShrink: 0 }}>
      {src && !errored ? (
        <img src={src} alt="" width={18} height={18} style={{ display: 'block' }} onError={() => setErrored(true)} />
      ) : (
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', lineHeight: 1 }}>{initial}</Typography>
      )}
    </Box>
  );
};


export const getLocalModel = (): AgentLocalModel => ({ url: '', apikey: '', model: '' });
export const saveLocalModelConfig = (_model: AgentLocalModel) => {};
export const testLocalLLM = async (_config: AgentLocalModel): Promise<LocalLLMTestResult> => ({
  success: false,
  message: 'Use the app authentication system test instead',
});

export interface LocalLLMConfigProps extends ShuffleHostProps {
  compact?: boolean;
  hasOpenAIAuth?: boolean;
  onSave?: (model: AgentLocalModel) => void;
  onTestResult?: (result: LocalLLMTestResult) => void;
}

const LocalLLMConfig = ({ compact, globalUrl, userdata, isLoaded, isLoggedIn, serverside, theme, colorMode }: LocalLLMConfigProps) => {
  useSyncHostBaseUrl(globalUrl);
  const { authStates, authenticatedApps, handleAuthChange, handleSaveAuth, refreshAuth } = useAppAuth();
  const [expanded, setExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [confirmShuffleAIOpen, setConfirmShuffleAIOpen] = useState(false);
  /** Local override for the LLM chat test so the shared app-auth test (which
   *  refetches the whole auth list mid-test and makes the card flicker) is
   *  never used for LLM providers. */
  const [llmTest, setLlmTest] = useState<{
    status: 'testing' | 'connected' | 'error';
    successMessage?: string;
    errorMessage?: string;
  } | null>(null);

  const openaiEntries = authenticatedApps.filter(
    (a) => a.app?.name?.toLowerCase() === 'openai' || a.app?.id === OPENAI_APP_ID,
  );

  const baseAuthState = authStates[OPENAI_APP_ID] || {
    systemId: OPENAI_APP_ID,
    status: 'pending' as const,
    credentials: {},
  };
  const authState = llmTest
    ? {
        ...baseAuthState,
        status: llmTest.status,
        successMessage: llmTest.successMessage,
        errorMessage: llmTest.errorMessage,
      }
    : baseAuthState;


  // Prefer the in-memory edit (authState.credentials), but fall back to the
  // persisted URL on the saved auth entry so we can auto-detect the vendor
  // even when the user has not opened/edited the form yet.
  const savedUrlFromEntry = (((openaiEntries[0] as any)?.fields) as Array<{ key?: string; value?: string }> | undefined || [])
    .find((f) => (f?.key || '').toLowerCase() === 'url')?.value || '';
  const currentUrl = ((authState.credentials?.url as string) || savedUrlFromEntry || '').trim();
  // Model is now persisted inside the AppAuthCard credentials (read via extraFieldsSlot).
  const [customModel, setCustomModel] = useState<string>('');
  const [customMode, setCustomMode] = useState<boolean>(false);

  // NOTE: Previously this component auto-deleted any failed OpenAI auth
  // entry as soon as its validation came back false. That fought against the
  // "Save anyway" CTA in AppAuthCard — the user would click it, but the
  // failed entry had already been wiped from the server. The user now owns
  // the lifecycle: keep it (Save anyway), retry it, or delete it manually
  // from the auth selector.

  const hasOpenAIEntries = openaiEntries.length > 0;

  /** Which provider a saved OpenAI auth entry belongs to.
   *  URL wins (it is authoritative), then the label — legacy labels look like
   *  "OpenAI - Anthropic", so the app-name prefix is stripped before matching
   *  to avoid classifying every entry as OpenAI. */
  const providerOfEntry = (entry: any): string => {
    const url = ((entry?.fields as Array<{ key?: string; value?: string }> | undefined) || [])
      .find((f) => (f?.key || '').toLowerCase() === 'url')?.value || '';
    if (url) return detectLLMProvider(url)?.label || CUSTOM_PRESET;

    const rawLabel = String(entry?.label || '');
    const label = rawLabel
      .replace(new RegExp(`^\\s*${OPENAI_APP_NAME}\\s*-\\s*`, 'i'), '')
      .trim();
    const match = ENDPOINT_PRESETS.find(
      (p) => p.label !== SHUFFLE_AI_PRESET && label.toLowerCase() === p.label.toLowerCase(),
    ) || ENDPOINT_PRESETS.find(
      (p) => p.label !== SHUFFLE_AI_PRESET && label.toLowerCase().includes(p.label.toLowerCase()),
    );
    if (match) return match.label;
    return CUSTOM_PRESET;
  };

  /** Display label without the redundant "OpenAI - " app-name prefix. */
  const displayLabelOfEntry = (entry: any): string => {
    const raw = String(entry?.label || '');
    const stripped = raw.replace(new RegExp(`^\\s*${OPENAI_APP_NAME}\\s*-\\s*`, 'i'), '').trim();
    return stripped || raw;
  };


  /** The currently active (primary) OpenAI-compatible authentication. */
  const activeEntry = useMemo(
    () => openaiEntries.find((e: any) => e?.active === true) || openaiEntries[0],
    [openaiEntries],
  );

  const effectivePreset = useMemo(() => {
    if (selectedPreset) return selectedPreset;
    if (!currentUrl && !hasOpenAIEntries) return SHUFFLE_AI_PRESET;
    if (currentUrl) return detectLLMProvider(currentUrl)?.label || CUSTOM_PRESET;
    // Saved authentications exist but no URL is loaded yet (fields can be
    // masked). Derive the provider from the active saved entry so the panel
    // never renders as an empty, provider-less card.
    return providerOfEntry(activeEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset, currentUrl, hasOpenAIEntries, activeEntry]);

  /** Saved authentications that belong to the currently selected provider.
   *  When any exist we show the normal auth selector (so they can be picked,
   *  tested and deleted) instead of forcing the "Add New Authentication" form. */
  const providerEntries = useMemo(
    () => openaiEntries
      .filter((e: any) => providerOfEntry(e) === effectivePreset)
      .map((e: any) => ({ ...e, label: displayLabelOfEntry(e) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openaiEntries, effectivePreset],
  );



  /**
   * Per-provider configuration state used to mark the provider list:
   * 'valid' (green, validated) or 'configured' (yellow, saved but unvalidated).
   */
  const providerStatus = useMemo(() => {
    const map: Record<string, 'valid' | 'configured'> = {};
    for (const entry of openaiEntries) {
      const provider = providerOfEntry(entry);
      const authId = (entry as any)?.id || (entry as any)?.label || '';
      const isValid =
        (entry as any)?.validation?.valid === true ||
        (authId ? isAuthVerifiedLocally(OPENAI_APP_ID, authId) : false);
      if (isValid) map[provider] = 'valid';
      else if (!map[provider]) map[provider] = 'configured';
    }
    if (!hasOpenAIEntries) map[SHUFFLE_AI_PRESET] = 'valid';
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openaiEntries, hasOpenAIEntries]);

  /**
   * Multiple LLM authentications can coexist. Exactly one of them — the
   * primary provider — carries `active: true`; every other OpenAI-compatible
   * authentication is written back with `active: false`. Nothing is deleted.
   *
   * Secret field values are replaced with the backend placeholder so the
   * stored credentials survive the update (same pattern as auth renaming).
   */
  const setActiveAuthEntry = async (activeId: string | null, preloadedEntries?: any[]) => {
    const placeholder = 'Secret. Replaced during app execution!';
    let entries: any[] = [];
    if (preloadedEntries) {
      // Caller already fetched a fresh list — do not hit the API again.
      entries = preloadedEntries;
    } else {
      try {
        invalidateAuthenticatedAppsCache();
        entries = (await fetchSharedAuthenticatedApps()) as any[];
      } catch {
        entries = openaiEntries as any[];
      }
    }
    const llmEntries = entries.filter(
      (a: any) => a?.app?.name?.toLowerCase() === 'openai' || a?.app?.id === OPENAI_APP_ID,
    );

    let changed = false;
    for (const entry of llmEntries) {
      if (!entry?.id) continue;
      const shouldBeActive = entry.id === activeId;
      if (entry.active === shouldBeActive) continue;

      const body: Record<string, any> = { ...entry, active: shouldBeActive };
      if (Array.isArray(entry.fields)) {
        body.fields = entry.fields.map((f: any) =>
          typeof f?.value === 'string' ? { ...f, value: placeholder } : f,
        );
      } else if (entry.fields && typeof entry.fields === 'object') {
        const masked: Record<string, any> = {};
        for (const [key, val] of Object.entries(entry.fields)) {
          masked[key] = typeof val === 'string' ? placeholder : val;
        }
        body.fields = masked;
      }

      try {
        const resp = await fetch(getApiUrl('/api/v1/apps/authentication'), {
          method: 'PUT',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (resp.ok) changed = true;
      } catch (err) {
        console.error('[LocalLLMConfig] Failed to update active state on LLM auth:', err);
      }
    }

    if (changed) {
      invalidateAuthenticatedAppsCache();
      await refreshAuth();
      refreshAllIntegrationStatus();
    }
  };

  /**
   * Save with the provider baked into the label, then mark the saved provider
   * as the primary (active) one. Other providers are kept, just deactivated.
   */
  const handleSaveProviderAuth = async (appId: string, creds: Record<string, string>): Promise<boolean> => {
    const provider = effectivePreset || detectLLMProvider(creds.url || '')?.label || CUSTOM_PRESET;
    const ok = await handleSaveAuth(appId, creds, OPENAI_APP_NAME, provider);
    if (!ok) return false;

    // Find the freshly saved entry for this provider and make it the primary.
    // handleSaveAuth already invalidated + refetched, so this hits the shared
    // cache instead of firing another GET.
    try {
      const entries = (await fetchSharedAuthenticatedApps()) as any[];
      const match = entries
        .filter((a: any) => a?.app?.name?.toLowerCase() === 'openai' || a?.app?.id === OPENAI_APP_ID)
        .filter((a: any) => providerOfEntry(a) === provider)
        .sort((a: any, b: any) => (Number(b?.edited || b?.created || 0) - Number(a?.edited || a?.created || 0)))[0];
      if (match?.id) await setActiveAuthEntry(match.id, entries);
    } catch (err) {
      console.error('[LocalLLMConfig] Failed to set primary LLM provider:', err);
    }
    return true;
  };


  /**
   * LLM-specific connection test: sends a minimal OpenAI ChatCompletion
   * request through the saved authentication.
   * POST /api/v1/chat/completions?authentication_id=<id>
   */
  const handleTestLLMConnection = async (_appId: string, authenticationId?: string) => {
    const authId = authenticationId || (providerEntries[0] as any)?.id || (activeEntry as any)?.id;
    if (!authId) {
      setLlmTest({
        status: 'error',
        errorMessage: 'Save the authentication first, then run the test.',
      });
      return;
    }

    const model =
      ((authState.credentials?.model as string) || '').trim() ||
      PROVIDER_MODELS[effectivePreset]?.[0] ||
      '';

    setLlmTest({ status: 'testing' });
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/chat/completions?authentication_id=${encodeURIComponent(authId)}`),
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(model ? { model } : {}),
            messages: [
              { role: 'system', content: 'You are a connection test. Answer with one word.' },
              { role: 'user', content: 'Reply with the single word: OK' },
            ],
            max_tokens: 16,
            temperature: 0,
            stream: false,
          }),
        },
      );

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      const apiError =
        (typeof data?.error === 'string' && data.error) ||
        data?.error?.message ||
        (data?.success === false ? data?.reason || 'The provider rejected the request.' : '');

      const content =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        data?.result ??
        data?.answer ??
        '';

      if (!response.ok || apiError) {
        setLlmTest({
          status: 'error',
          errorMessage:
            apiError ||
            `Connection failed (HTTP ${response.status}). Check the endpoint URL, API key and model.`,
        });
      } else if (!content || !String(content).trim()) {
        setLlmTest({
          status: 'error',
          errorMessage: 'The provider responded, but returned no message content.',
        });
      } else {
        setLlmTest({
          status: 'connected',
          successMessage: `Connection verified${model ? ` • ${model}` : ''} • Reply: ${String(content).trim().slice(0, 60)}`,
        });
      }
    } catch (error) {
      setLlmTest({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Connection test failed.',
      });
    }

    // Refresh once the test has settled so provider checkmarks update. This is
    // intentionally after the result is set, so the card does not flicker
    // while the test is running.
    try {
      await refreshAuth();
      refreshAllIntegrationStatus();
    } catch {
      /* noop */
    }
  };


  const applyShuffleAI = async () => {
    // Keep every saved LLM authentication, but deactivate all of them so
    // Shuffle AI becomes the primary provider.
    await setActiveAuthEntry(null);
    handleAuthChange(OPENAI_APP_ID, {});
    setSelectedPreset(SHUFFLE_AI_PRESET);
    setCustomUrl('');
  };

  const handlePresetChange = (label: string) => {
    setLlmTest(null);
    if (label === SHUFFLE_AI_PRESET) {
      if (hasOpenAIEntries) {
        setConfirmShuffleAIOpen(true);
        return;
      }
      void applyShuffleAI();
      return;
    }
    setSelectedPreset(label);
    // If this provider already has a saved authentication, make it the
    // primary one (active: true) and deactivate the others.
    const existing = openaiEntries.find((e: any) => e?.id && providerOfEntry(e) === label);
    if (existing?.id) void setActiveAuthEntry(existing.id);
    const preset = ENDPOINT_PRESETS.find((p) => p.label === label);
    if (!preset) return;

    // Auto-select the top model for this provider so the user does not have
    // to manually pick one. Custom-typed values are preserved if already set.
    const topModel = PROVIDER_MODELS[label]?.[0] || '';
    const existingModel = (authState.credentials?.model as string) || '';
    const nextModel = topModel || existingModel;
    setCustomMode(false);
    setCustomModel('');
    handleAuthChange(OPENAI_APP_ID, {
      ...authState.credentials,
      url: preset.label === CUSTOM_PRESET ? customUrl : preset.url,
      ...(nextModel ? { model: nextModel } : {}),
    });
  };

  const handleCustomUrlChange = (value: string) => {
    setCustomUrl(value);
    handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, url: value });
  };

  // Model dropdown lives inside the AppAuthCard via extraFieldsSlot so its
  // value is persisted as a credential field on Save.

  // Always keep a default model selected for the active provider.
  useEffect(() => {
    const models = PROVIDER_MODELS[effectivePreset];
    if (!models?.length) return;
    if ((authState.credentials?.model || '').trim()) return;
    handleAuthChange(OPENAI_APP_ID, { ...authState.credentials, model: models[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePreset, authState.credentials?.model]);

  const isShuffleAI = effectivePreset === SHUFFLE_AI_PRESET;
  const orgId = userdata?.active_org?.id;
  const [orgData, setOrgData] = useState<{
    sync_features?: Record<string, { usage?: number; limit?: number }>;
  } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/v1/orgs/${orgId}`), {
          method: 'GET',
          credentials: 'include',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setOrgData(data);
      } catch (err) {
        console.error('[LocalLLMConfig] Failed to fetch org info:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // Quotas live under sync_features in the org payload. App runs are at
  // sync_features.app_executions, tokens at sync_features.agent_tokens.
  // The root-level app_execution_* fields are unreliable / empty.
  const sync = orgData?.sync_features ?? (userdata as any)?.sync_features ?? {};
  const appExec = sync.app_executions ?? {};
  const appRunLimit = Number(appExec.limit) || 0;
  const appRunUsage = Number(appExec.usage) || 0;
  const agentTokens = sync.agent_tokens ?? {};
  const agentTokenLimit = Number(agentTokens.limit) || 0;
  const agentTokenUsage = Number(agentTokens.usage) || 0;


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          AI Provider
        </Typography>
        <Autocomplete
          size="small"
          fullWidth
          disableClearable
          options={ENDPOINT_PRESETS.map((p) => p.label)}
          value={effectivePreset || null}
          onChange={(_e, val) => val && handlePresetChange(val)}
          isOptionEqualToValue={(opt, val) => opt === val}
          renderOption={(props, option) => {
            const preset = ENDPOINT_PRESETS.find((p) => p.label === option);
            const status = providerStatus[option];
            return (
              <li {...props} key={option}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', minWidth: 0 }}>
                  <ProviderLogo label={option} url={preset?.url} />
                  <Typography sx={{ fontSize: '0.85rem', color: 'hsl(var(--popover-foreground))', flexShrink: 0 }}>{option}</Typography>
                  {preset?.url && (
                    <Typography component="span" sx={{ ml: 'auto', minWidth: 0, flex: '0 1 auto', color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preset.url}
                    </Typography>
                  )}
                  {status && (
                    <Tooltip
                      title={status === 'valid' ? 'Configured and working' : 'Configured, not validated'}
                      placement="right"
                      arrow
                    >
                      <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0, ml: preset?.url ? 0 : 'auto' }}>
                        <Check
                          size={14}
                          strokeWidth={3}
                          style={{
                            flexShrink: 0,
                            color: status === 'valid'
                              ? 'hsl(var(--severity-low))'
                              : 'hsl(var(--severity-medium))',
                          }}
                          aria-label={status === 'valid' ? 'Configured and working' : 'Configured, not validated'}
                        />
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </li>
            );
          }}
          renderInput={(params) => {
            const preset = ENDPOINT_PRESETS.find((p) => p.label === effectivePreset);
            return (
              <TextField
                {...params}
                placeholder="Search a provider…"
                slotProps={{
                  input: {
                    ...(params as any).InputProps,
                    startAdornment: effectivePreset ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5, mr: 0.5 }}>
                        <ProviderLogo label={effectivePreset} url={preset?.url} />
                      </Box>
                    ) : undefined,
                  },
                }}
              />
            );
          }}
          slotProps={{
            paper: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', maxWidth: '100vw', overflow: 'hidden' } },
            listbox: { sx: { maxWidth: '100%', '& li': { minWidth: 0 } } },
            popper: { sx: { zIndex: 9999, maxWidth: '100vw' } },
          }}
        />
      </Box>

      {!compact && (() => {
        const preset = ENDPOINT_PRESETS.find((p) => p.label === effectivePreset);
        const hasProviderDocs = !!preset && (!!preset.apiKeyUrl || !!preset.apiKeyHint);
        return (
          <Box sx={{ px: 2.5, py: 2, borderRadius: 2, border: '1px solid hsl(var(--border))', bgcolor: 'hsl(var(--muted) / 0.3)' }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
              {isShuffleAI ? (
                <>
                  Using Shuffle AI. No configuration is required. Pick another provider above to use your own endpoint. Our models are hosted on GCP, and your data stays within your tenant's region.{' '}
                  <Box component="a" href="https://shuffler.io/docs/AI#using-self-hosted-ai-models" target="_blank" rel="noopener noreferrer" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                    Read the docs
                  </Box>
                  .
                </>
              ) : hasProviderDocs ? (
                <>
                  {preset!.apiKeyHint}{' '}
                  {preset!.apiKeyUrl && (
                    <Box component="a" href={preset!.apiKeyUrl} target="_blank" rel="noopener noreferrer" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                      Get your {preset!.label} API key →
                    </Box>
                  )}
                </>
              ) : (
                <>
                  Configure an OpenAI-compatible endpoint for agent operations. Credentials are saved through the app authentication system.{' '}
                  <Box component="a" href="https://shuffler.io/docs/AI#using-self-hosted-ai-models" target="_blank" rel="noopener noreferrer" sx={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                    Read the docs
                  </Box>
                  .
                </>
              )}
            </Typography>
          </Box>
        );
      })()}

      {isShuffleAI && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5, width: '100%' }}>
          <UsageBar label="App runs" usage={appRunUsage} limit={appRunLimit} unit="runs" actionLabel="Upgrade" actionHref="https://shuffler.io/pricing" />
          <UsageBar label="Agent tokens" usage={agentTokenUsage} limit={agentTokenLimit} unit="tokens" actionLabel="Upgrade" actionHref="https://shuffler.io/pricing" />
        </Box>
      )}

      {effectivePreset === CUSTOM_PRESET && (
        <TextField
          size="small"
          fullWidth
          placeholder="https://your-self-hosted-endpoint.example.com"
          value={customUrl || currentUrl}
          onChange={(e) => handleCustomUrlChange(e.target.value)}
          helperText="Enter the base URL of your OpenAI-compatible endpoint"
          sx={{ '& .MuiFormHelperText-root': { color: 'hsl(var(--muted-foreground))' } }}
        />
      )}

      {!isShuffleAI && (
        <AppAuthCard
          app={OPENAI_ALGOLIA_APP}
          authState={authState}
          isExpanded={expanded}
          onToggle={() => setExpanded((prev) => !prev)}
          onAuthChange={handleAuthChange}
          onTestConnection={(appId, authId) => handleTestLLMConnection(appId, authId)}
          onSaveAuth={(appId, creds) => handleSaveProviderAuth(appId, creds)}
          apiAuthEntries={providerEntries}
          onRefreshAuth={refreshAuth}
          disableUrlPrefill
          hideHeader
          hideStatusChips
          hideDocsLink
          hideUrlFields
          initialAuthConfig={OPENAI_AUTH_SCHEMA}
          borderless
          compactAuthForm={providerEntries.length === 0}
          suppressSaveToast

          extraFieldsSlot={
            (PROVIDER_MODELS[effectivePreset]?.length ?? 0) > 0
              ? ({ credentials, setField }) => {
                  const liveModel = credentials.model || '';
                  const presetModels = PROVIDER_MODELS[effectivePreset] || [];
                  const liveIsCustom = liveModel !== '' && !presetModels.includes(liveModel);
                  const showCustom = customMode || liveIsCustom;
                  const liveSelectValue = showCustom ? CUSTOM_MODEL : (liveModel || null);
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                        Model
                      </Typography>
                      <Autocomplete
                        size="small"
                        fullWidth
                        disableClearable
                        options={[...presetModels, CUSTOM_MODEL]}
                        value={liveSelectValue}
                        onChange={(_e, val) => {
                          if (!val) return;
                          if (val === CUSTOM_MODEL) {
                            setCustomMode(true);
                            // Seed credential with whatever the user already
                            // typed (may be empty). The visible TextField will
                            // let them edit it from here.
                            setField('model', customModel);
                          } else {
                            setCustomMode(false);
                            setCustomModel('');
                            setField('model', val);
                          }
                        }}
                        isOptionEqualToValue={(opt, val) => opt === val}
                        slotProps={{
                          paper: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))' } },
                          popper: { sx: { zIndex: 9999 } },
                        }}
                        renderInput={(params) => (
                          <TextField {...params} placeholder="Select a model…" />
                        )}
                      />
                      {showCustom && (
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Enter a custom model identifier"
                          value={customModel || (liveIsCustom ? liveModel : '')}
                          onChange={(e) => {
                            setCustomModel(e.target.value);
                            setField('model', e.target.value);
                          }}
                          helperText="Exact model name as expected by the provider's API"
                          sx={{ '& .MuiFormHelperText-root': { color: 'hsl(var(--muted-foreground))' } }}
                        />
                      )}
                    </Box>
                  );

                }
              : undefined
          }
          globalUrl={globalUrl}
          userdata={userdata}
          isLoaded={isLoaded}
          isLoggedIn={isLoggedIn}
          serverside={serverside}
          theme={theme}
          colorMode={colorMode}
        />
      )}

      <Dialog open={confirmShuffleAIOpen} onClose={() => setConfirmShuffleAIOpen(false)} slotProps={{ paper: { sx: { bgcolor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))' } } }}>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Switch to Shuffle AI?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
            Switching to Shuffle AI will keep your saved provider authentications, but none of them will be used as the primary AI provider. You can switch back at any time. Do you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmShuffleAIOpen(false)} sx={{ color: 'hsl(var(--muted-foreground))', textTransform: 'none', height: 36 }}>Cancel</Button>
          <Button onClick={async () => { setConfirmShuffleAIOpen(false); await applyShuffleAI(); }} sx={{ bgcolor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', textTransform: 'none', height: 36, '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' } }}>
            Use Shuffle AI
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LocalLLMConfig;