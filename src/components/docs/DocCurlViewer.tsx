import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, Chip, CircularProgress, Collapse } from '@mui/material';
import { useUserApiKey } from '@/hooks/useUserApiKey';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { toast } from '@/Shuffle-MCPs/toast';

export interface DocCurlViewerProps {
  rawCurl: string;
}

interface ParsedCurl {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  bodyJson: any | null;
  rawBody: string | null;
  otherFlags: string[];
}

/**
 * Robustly parses a cURL command into its constituent parts:
 * method, target URL, headers, and body payload (with JSON detection).
 */
export function parseCurlCommand(raw: string): ParsedCurl {
  const normalized = raw
    .replace(/^(\s*[$#]\s*)+/gm, '') // Strip shell prompts like '$ ' or '# '
    .replace(/\\\r?\n\s*/g, ' ')      // Flatten line continuations
    .trim();

  let method = 'GET';
  let url = '';
  const headers: Array<{ key: string; value: string }> = [];
  let rawBody: string | null = null;
  let bodyJson: any | null = null;
  const otherFlags: string[] = [];

  // Match flags and arguments
  // cURL arguments can be quoted ('...' or "...") or unquoted
  const tokenRegex = /(-[A-Za-z0-9_-]+|--[A-Za-z0-9_-]+)(?:\s+(?:'([^']*)'|"([^"]*)"|(\S+)))?/g;

  // First, extract body if present. Bodies often have nested quotes or complex JSON.
  const dataFlagMatch = normalized.match(/(?:-d|--data|--data-raw|--data-binary)\s+/i);
  let cleanedForArgs = normalized;

  if (dataFlagMatch && dataFlagMatch.index !== undefined) {
    const afterData = normalized.slice(dataFlagMatch.index + dataFlagMatch[0].length).trim();
    let payload = '';
    let consumedLen = 0;

    let candidate = afterData.trim();
    let hasOuterQuote = false;
    if (candidate.startsWith("'") || candidate.startsWith('"')) {
      hasOuterQuote = true;
      candidate = candidate.slice(1).trimStart();
    }

    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      let depth = 0;
      let inString = false;
      let escape = false;
      let endIdx = -1;

      for (let i = 0; i < candidate.length; i++) {
        const char = candidate[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{' || char === '[') depth++;
          else if (char === '}' || char === ']') {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
      }

      if (endIdx !== -1) {
        const jsonStr = candidate.slice(0, endIdx);
        try {
          bodyJson = JSON.parse(jsonStr);
          payload = jsonStr;
          consumedLen = (hasOuterQuote ? 1 : 0) + (afterData.trim().length - candidate.length) + endIdx + (hasOuterQuote ? 1 : 0);
        } catch {
          try {
            bodyJson = JSON.parse(jsonStr.replace(/\\'/g, "'"));
            payload = jsonStr;
            consumedLen = (hasOuterQuote ? 1 : 0) + (afterData.trim().length - candidate.length) + endIdx + (hasOuterQuote ? 1 : 0);
          } catch {}
        }
      }
    }

    if (!bodyJson) {
      if (afterData.startsWith("'")) {
        let endIdx = -1;
        for (let i = 1; i < afterData.length; i++) {
          if (afterData[i] === "'" && afterData[i - 1] !== '\\') {
            endIdx = i;
            break;
          }
        }
        payload = endIdx !== -1 ? afterData.slice(1, endIdx) : afterData.slice(1);
        consumedLen = endIdx !== -1 ? endIdx + 1 : afterData.length;
      } else if (afterData.startsWith('"')) {
        let endIdx = -1;
        for (let i = 1; i < afterData.length; i++) {
          if (afterData[i] === '"' && afterData[i - 1] !== '\\') {
            endIdx = i;
            break;
          }
        }
        payload = endIdx !== -1 ? afterData.slice(1, endIdx) : afterData.slice(1);
        consumedLen = endIdx !== -1 ? endIdx + 1 : afterData.length;
      } else {
        const match = afterData.match(/^\S+/);
        payload = match ? match[0] : afterData;
        consumedLen = payload.length;
      }
    }

    rawBody = payload;
    method = 'POST';

    cleanedForArgs = normalized.slice(0, dataFlagMatch.index) + ' ' + afterData.slice(consumedLen);
  }

  // Parse remaining flags
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(cleanedForArgs)) !== null) {
    const flag = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? '';

    if (flag === '-X' || flag === '--request') {
      if (val) method = val.toUpperCase();
    } else if (flag === '-H' || flag === '--header') {
      if (val) {
        const colonIdx = val.indexOf(':');
        if (colonIdx !== -1) {
          headers.push({
            key: val.slice(0, colonIdx).trim(),
            value: val.slice(colonIdx + 1).trim(),
          });
        } else {
          headers.push({ key: val.trim(), value: '' });
        }
      }
    } else {
      otherFlags.push(val ? `${flag} ${val}` : flag);
    }
  }

  // Find URL (first non-flag token starting with http://, https://, or /api/)
  const words = cleanedForArgs.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/^['"]|['"]$/g, '');
    if (w.startsWith('http://') || w.startsWith('https://') || w.startsWith('/api/') || w.includes('/api/v1') || w.includes('/api/v2')) {
      url = w;
      break;
    }
  }

  if (!url) {
    // Fallback: look for url in original string
    const urlMatch = normalized.match(/(https?:\/\/[^\s'"]+)/);
    if (urlMatch) url = urlMatch[1];
  }

  return {
    method,
    url,
    headers,
    bodyJson,
    rawBody,
    otherFlags,
  };
}

/**
 * Highlight and format JSON tokens for clean display.
 */
function renderJsonLine(line: string, index: number) {
  // Regex parsing key-value pairs or tokens in formatted JSON
  // Group 1: Leading whitespace
  // Group 2: Key "string":
  // Group 3: String value "string"
  // Group 4: Number / Boolean / Null
  // Group 5: Punctuation { } [ ] ,
  const regex = /^(\s*)(?:(".*?")(\s*:\s*))?(.*)$/;
  const match = line.match(regex);

  if (!match) {
    return <div key={index}>{line}</div>;
  }

  const [, indent, keyPart, colonPart, valPart] = match;

  return (
    <div key={index} style={{ whiteSpace: 'pre' }}>
      <span>{indent}</span>
      {keyPart && <span style={{ color: '#7dd3fc', fontWeight: 500 }}>{keyPart}</span>}
      {colonPart && <span style={{ color: '#94a3b8' }}>{colonPart}</span>}
      {valPart && renderJsonValue(valPart)}
    </div>
  );
}

function renderJsonValue(val: string) {
  const trimmed = val.trim();
  if (trimmed.startsWith('"')) {
    const hasComma = trimmed.endsWith(',');
    const str = hasComma ? trimmed.slice(0, -1) : trimmed;
    return (
      <>
        <span style={{ color: '#86efac' }}>{str}</span>
        {hasComma && <span style={{ color: '#94a3b8' }}>,</span>}
      </>
    );
  }
  if (/^(true|false|null|\d+(\.\d+)?),?$/.test(trimmed)) {
    const hasComma = trimmed.endsWith(',');
    const valText = hasComma ? trimmed.slice(0, -1) : trimmed;
    return (
      <>
        <span style={{ color: '#fdba74' }}>{valText}</span>
        {hasComma && <span style={{ color: '#94a3b8' }}>,</span>}
      </>
    );
  }
  return <span style={{ color: '#cbd5e1' }}>{val}</span>;
}

export const DocCurlViewer: React.FC<DocCurlViewerProps> = ({ rawCurl }) => {
  const { apiKey, maskedApiKey, isAuthenticated, baseUrl, orgId } = useUserApiKey();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<string | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [isResponseOpen, setIsResponseOpen] = useState(false);

  // Parse constituent parts of raw cURL
  const parsed = useMemo(() => parseCurlCommand(rawCurl), [rawCurl]);

  // Adjust URL: replace https://shuffler.io or placeholder hosts with active baseUrl
  const targetUrl = useMemo(() => {
    let u = parsed.url;
    if (!u) return `${baseUrl}/api/v1`;
    if (u.startsWith('/')) return `${baseUrl}${u}`;
    return u
      .replace(/^https?:\/\/shuffler\.io/i, baseUrl)
      .replace(/^https?:\/\/<endpoint>:<port>/i, baseUrl);
  }, [parsed.url, baseUrl]);

  // Transform headers: replace APIKEY and ORGID placeholders
  const getProcessedHeaders = useCallback(
    (useMaskedKey: boolean) => {
      const effectiveKey = useMaskedKey ? maskedApiKey : (apiKey || 'APIKEY');
      const effectiveOrg = orgId || '<ORG_ID>';

      const result: Array<{ key: string; value: string; isAuth: boolean }> = [];
      let hasAuth = false;

      for (const h of parsed.headers) {
        let val = h.value;
        const isAuth = /^authorization$/i.test(h.key);

        if (isAuth) {
          hasAuth = true;
          val = val
            .replace(/APIKEY/gi, effectiveKey)
            .replace(/<API_KEY>/gi, effectiveKey)
            .replace(/<APIKEY>/gi, effectiveKey)
            .replace(/YOUR_API_KEY/gi, effectiveKey);
        } else if (/^org-id$/i.test(h.key)) {
          val = val.replace(/<ORGID>|<ORG_ID>|ORGID/gi, effectiveOrg);
        }

        result.push({ key: h.key, value: val, isAuth });
      }

      // If no auth header was in original cURL, add standard Authorization header
      if (!hasAuth && parsed.headers.length === 0) {
        result.push({
          key: 'Authorization',
          value: `Bearer ${effectiveKey}`,
          isAuth: true,
        });
      }

      return result;
    },
    [parsed.headers, maskedApiKey, apiKey, orgId]
  );

  // Formatted JSON string
  const formattedJsonString = useMemo(() => {
    if (parsed.bodyJson) {
      return JSON.stringify(parsed.bodyJson, null, 2);
    }
    return parsed.rawBody;
  }, [parsed.bodyJson, parsed.rawBody]);

  // Generate plain-text executable cURL command for clipboard copy and HTTP execution
  const runnableCommand = useMemo(() => {
    const lines: string[] = [];
    const headers = getProcessedHeaders(false);

    lines.push(`curl -X ${parsed.method} '${targetUrl}' \\`);

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const isLast = i === headers.length - 1 && !formattedJsonString;
      lines.push(`  -H '${h.key}: ${h.value}'${isLast ? '' : ' \\'}`);
    }

    if (formattedJsonString) {
      const indentedJson = formattedJsonString
        .split('\n')
        .map((l, idx) => (idx === 0 ? l : `    ${l}`))
        .join('\n');
      lines.push(`  -d '${indentedJson.replace(/'/g, "'\\''")}'`);
    }

    return lines.join('\n');
  }, [parsed.method, targetUrl, getProcessedHeaders, formattedJsonString]);

  // Copy handler
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(runnableCommand);
    setCopied(true);
    toast.success('cURL command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [runnableCommand]);

  // Run in Shuffle via HTTP App
  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setIsResponseOpen(true);
    setResponseStatus(null);
    setResponseOutput(null);
    const start = Date.now();

    try {
      const body = {
        name: 'curl',
        app_id: 'ebfe7d5c80000676588f86731db0a555',
        environment: 'Cloud',
        parameters: [
          {
            name: 'statement',
            value: runnableCommand,
            schema: { type: 'string' },
          },
        ],
        app_name: 'http',
        app_version: '1.4.0',
      };

      const res = await fetch(getApiUrl('/api/v1/apps/http/run?delete=true'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(body),
      });

      const duration = Date.now() - start;
      setResponseDuration(duration);

      const data = await res.json();
      let output = data?.result;

      if (typeof output === 'string') {
        try {
          output = JSON.stringify(JSON.parse(output), null, 2);
        } catch {}
      } else if (output != null) {
        output = JSON.stringify(output, null, 2);
      } else {
        output = JSON.stringify(data, null, 2);
      }

      setResponseOutput(output);
      const isSuccess = res.ok && (!data?.result || !data.result.includes('"success": false'));
      setResponseStatus(isSuccess ? `Status: ${res.status} OK` : `Status: ${res.status} Error`);

      if (isSuccess) {
        toast.success(`Request completed in ${duration}ms`);
      } else {
        toast.error('Request finished with error');
      }
    } catch (err: any) {
      setResponseDuration(Date.now() - start);
      setResponseStatus('Request Failed');
      setResponseOutput(err?.message || 'Network error executing request');
      toast.error('Failed to run cURL request');
    } finally {
      setIsRunning(false);
    }
  }, [runnableCommand]);

  const displayHeaders = useMemo(
    () => getProcessedHeaders(!showKey),
    [getProcessedHeaders, showKey]
  );

  const methodColor = useMemo(() => {
    switch (parsed.method) {
      case 'GET':
        return '#10b981';
      case 'POST':
        return '#f59e0b';
      case 'PUT':
      case 'PATCH':
        return '#3b82f6';
      case 'DELETE':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  }, [parsed.method]);

  return (
    <Box
      sx={{
        my: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        fontFamily: 'monospace',
      }}
    >
      {/* Header Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {/* Left Badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={parsed.method}
            size="small"
            sx={{
              backgroundColor: `${methodColor}20`,
              color: methodColor,
              fontWeight: 700,
              fontSize: '0.72rem',
              height: '22px',
              border: `1px solid ${methodColor}40`,
              borderRadius: '3px',
              fontFamily: 'monospace',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
            }}
          >
            cURL
          </Typography>

          <Chip
            label={isAuthenticated && apiKey ? 'Active Key' : 'Demo Key'}
            size="small"
            variant="outlined"
            sx={{
              height: '20px',
              fontSize: '0.68rem',
              borderColor: isAuthenticated && apiKey ? 'success.main' : 'divider',
              color: isAuthenticated && apiKey ? 'success.main' : 'text.secondary',
              borderRadius: '3px',
            }}
          />
        </Box>

        {/* Right Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isAuthenticated && apiKey && (
            <Button
              size="small"
              onClick={() => setShowKey(!showKey)}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                minWidth: 'auto',
                py: 0.2,
                px: 1,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              {showKey ? 'Hide Key' : 'Show Key'}
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={handleCopy}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              minWidth: '60px',
              height: '26px',
              py: 0,
              px: 1.2,
              borderRadius: '4px',
              borderColor: 'divider',
              color: 'text.primary',
              '&:hover': { borderColor: 'text.secondary' },
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>

          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleRun}
            disabled={isRunning}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              height: '26px',
              py: 0,
              px: 1.5,
              borderRadius: '4px',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { backgroundColor: 'primary.dark' },
            }}
          >
            {isRunning ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <CircularProgress size={12} color="inherit" />
                <span>Running</span>
              </Box>
            ) : (
              'Test'
            )}
          </Button>
        </Box>
      </Box>

      {/* Code Display Area */}
      <Box
        sx={{
          p: 1.5,
          fontSize: '0.82rem',
          lineHeight: 1.6,
          overflowX: 'auto',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? '#0f172a' : '#f8fafc',
          color: (theme) =>
            theme.palette.mode === 'dark' ? '#e2e8f0' : '#1e293b',
        }}
      >
        {/* Line 1: curl -X METHOD 'URL' \ */}
        <div style={{ whiteSpace: 'pre' }}>
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>curl</span>
          <span> </span>
          <span style={{ color: '#f59e0b' }}>-X</span>
          <span> </span>
          <span style={{ color: methodColor, fontWeight: 600 }}>{parsed.method}</span>
          <span> </span>
          <span style={{ color: '#60a5fa' }}>'{targetUrl}'</span>
          {(displayHeaders.length > 0 || formattedJsonString) && (
            <span style={{ color: '#64748b' }}> \</span>
          )}
        </div>

        {/* Header Lines */}
        {displayHeaders.map((h, idx) => {
          const isLast = idx === displayHeaders.length - 1 && !formattedJsonString;
          return (
            <div key={`h-${idx}`} style={{ whiteSpace: 'pre' }}>
              <span>  </span>
              <span style={{ color: '#f59e0b' }}>-H</span>
              <span style={{ color: '#94a3b8' }}> '</span>
              <span style={{ color: '#c084fc', fontWeight: 500 }}>{h.key}:</span>
              <span> </span>
              {h.isAuth && h.value.startsWith('Bearer ') ? (
                <>
                  <span style={{ color: '#94a3b8' }}>Bearer </span>
                  <span style={{ color: '#facc15', fontWeight: 600 }}>
                    {h.value.replace(/^Bearer\s*/, '')}
                  </span>
                </>
              ) : (
                <span style={{ color: '#86efac' }}>{h.value}</span>
              )}
              <span style={{ color: '#94a3b8' }}>'</span>
              {!isLast && <span style={{ color: '#64748b' }}> \</span>}
            </div>
          );
        })}

        {/* Body Lines */}
        {formattedJsonString && (
          <>
            <div style={{ whiteSpace: 'pre' }}>
              <span>  </span>
              <span style={{ color: '#f59e0b' }}>-d</span>
              <span style={{ color: '#94a3b8' }}> '&#123;</span>
            </div>
            {formattedJsonString
              .split('\n')
              .slice(1, -1)
              .map((line, idx) => (
                <div key={`body-${idx}`} style={{ paddingLeft: '16px' }}>
                  {renderJsonLine(line, idx)}
                </div>
              ))}
            <div style={{ whiteSpace: 'pre' }}>
              <span>  </span>
              <span style={{ color: '#94a3b8' }}>&#125;'</span>
            </div>
          </>
        )}
      </Box>

      {/* Inline Test Response Panel */}
      <Collapse in={isResponseOpen}>
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)',
            p: 1.5,
          }}
        >
          {/* Response Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  letterSpacing: '0.04em',
                }}
              >
                RESPONSE
              </Typography>
              {responseStatus && (
                <Chip
                  label={responseStatus}
                  size="small"
                  sx={{
                    height: '20px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    borderRadius: '3px',
                    backgroundColor: responseStatus.includes('OK')
                      ? 'rgba(16,185,129,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: responseStatus.includes('OK') ? '#10b981' : '#ef4444',
                    border: '1px solid',
                    borderColor: responseStatus.includes('OK')
                      ? 'rgba(16,185,129,0.3)'
                      : 'rgba(239,68,68,0.3)',
                  }}
                />
              )}
              {responseDuration !== null && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                  {responseDuration}ms
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {responseOutput && (
                <Button
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(responseOutput);
                    toast.success('Response copied to clipboard');
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    minWidth: 'auto',
                    py: 0.1,
                    px: 0.8,
                    color: 'text.secondary',
                    '&:hover': { color: 'text.primary' },
                  }}
                >
                  Copy Response
                </Button>
              )}
              <Button
                size="small"
                onClick={() => setIsResponseOpen(false)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  minWidth: 'auto',
                  py: 0.1,
                  px: 0.8,
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                Close
              </Button>
            </Box>
          </Box>

          {/* Response Content */}
          <Box
            sx={{
              p: 1.2,
              borderRadius: '4px',
              fontSize: '0.78rem',
              maxHeight: '280px',
              overflowY: 'auto',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? '#090d16' : '#f1f5f9',
              color: (theme) =>
                theme.palette.mode === 'dark' ? '#cbd5e1' : '#334155',
              border: '1px solid',
              borderColor: 'divider',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {isRunning ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Executing request in Shuffle...
                </Typography>
              </Box>
            ) : responseOutput ? (
              responseOutput
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No response data received.
              </Typography>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};
