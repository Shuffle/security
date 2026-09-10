import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { ChevronDown, ChevronRight, RefreshCw as RefreshCwIcon } from 'lucide-react';
import { type TocHeading } from './tocUtils';
import { useScrollSpy } from './useScrollSpy';
import PrintDocsDialog from './PrintDocsDialog';
import { useIsSupport } from '@/hooks/useIsSupport';
import { useLocation, useNavigate } from '@/lib/router-compat';

export interface DocsTableOfContentsProps {
  /** Hierarchical headings list (H2 with nested H3). */
  headings: TocHeading[];
  /** Current doc slug. */
  slug: string;
  /** Markdown content for print export. */
  markdownContent?: string;
  /** Callback to trigger cache reset. */
  onResetCache?: () => Promise<void>;
  /** Whether cache reset is currently running. */
  resetting?: boolean;
  /** Whether doc content is loading. */
  loading?: boolean;
  /** Hide the action buttons (e.g. when used in mobile quick-menu). */
  hideActions?: boolean;
}

export const DocsTableOfContents: React.FC<DocsTableOfContentsProps> = ({
  headings,
  slug,
  markdownContent = '',
  onResetCache,
  resetting = false,
  loading = false,
  hideActions = false,
}) => {
  const isSupport = useIsSupport();
  const location = useLocation();
  const navigate = useNavigate();

  // Flatten IDs for scrollspy
  const flatIds = useMemo(() => {
    const ids: string[] = [];
    for (const h2 of headings) {
      ids.push(h2.id);
      for (const h3 of h2.children) {
        ids.push(h3.id);
      }
    }
    return ids;
  }, [headings]);

  const activeHeadingId = useScrollSpy(flatIds, { offset: 100 });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set<string>());

  // Map each child H3 id to its parent H2 id
  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h2 of headings) {
      for (const h3 of h2.children) {
        map.set(h3.id, h2.id);
      }
    }
    return map;
  }, [headings]);

  // Auto-expand parent section when an item becomes active
  useEffect(() => {
    if (!activeHeadingId) return;
    const parentId = parentMap.get(activeHeadingId) || activeHeadingId;
    // Check if parentId is an H2 with children
    const parentHeading = headings.find((h) => h.id === parentId);
    if (parentHeading && parentHeading.children.length > 0) {
      setExpandedIds((prev) => {
        if (prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });
    }
  }, [activeHeadingId, parentMap, headings]);

  // Initial expansion based on URL hash or first section
  useEffect(() => {
    const rawHash = location.hash ? decodeURIComponent(location.hash.replace(/^#/, '')) : '';
    if (rawHash) {
      const parentId = parentMap.get(rawHash) || rawHash;
      if (parentId) {
        setExpandedIds((prev) => new Set(prev).add(parentId));
        return;
      }
    }
    // Default: expand the first section that has children
    const firstWithChildren = headings.find((h) => h.children.length > 0);
    if (firstWithChildren) {
      setExpandedIds(new Set([firstWithChildren.id]));
    }
  }, [headings, location.hash, parentMap]);

  const handleToggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleHeadingClick = useCallback(
    (heading: TocHeading, hasChildren: boolean) => {
      // Auto-expand if collapsed
      if (hasChildren && !expandedIds.has(heading.id)) {
        setExpandedIds((prev) => new Set(prev).add(heading.id));
      }

      // Smooth scroll to the heading element
      const el = document.getElementById(heading.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Sync URL hash
      if (typeof window !== 'undefined') {
        const pathWithQuery = `${location.pathname}${location.search}#${heading.id}`;
        navigate(pathWithQuery, { replace: true });
      }
    },
    [expandedIds, location.pathname, location.search, navigate],
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Action Buttons (Print / Export PDF & Reset Cache) */}
      {!hideActions && (
        <Stack spacing={1} sx={{ mb: 3 }}>
          <PrintDocsDialog
            slug={slug}
            currentMarkdown={markdownContent}
            disabled={loading || resetting}
            label="Print / Export PDF"
            fullWidth
            sx={{
              backgroundColor: 'hsl(var(--card))',
              '&:hover': {
                backgroundColor: 'hsl(var(--accent))',
              },
            }}
          />

          {isSupport && onResetCache && (
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={onResetCache}
              disabled={resetting || loading}
              startIcon={<RefreshCwIcon size={14} className={resetting ? 'animate-spin' : ''} />}
              sx={{
                textTransform: 'none',
                height: 36,
                borderColor: 'hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  backgroundColor: 'hsl(var(--accent))',
                },
              }}
            >
              {resetting ? 'Resetting…' : 'Reset Cache'}
            </Button>
          )}
        </Stack>
      )}

      {/* Table of Content Header & List */}
      {headings.length > 0 && (
        <Box>
          <Typography
            sx={{
              color: 'text.primary',
              fontSize: '0.95rem',
              fontWeight: 600,
              mb: 1.5,
              userSelect: 'none',
            }}
          >
            Table Of Content
          </Typography>

          <Stack spacing={0.75} sx={{ pl: 0 }}>
            {headings.map((h2) => {
              const hasChildren = h2.children.length > 0;
              const isExpanded = expandedIds.has(h2.id);
              const isH2Active = activeHeadingId === h2.id;
              const isChildActive = h2.children.some((c) => c.id === activeHeadingId);
              const isActive = isH2Active || isChildActive;

              return (
                <Box key={h2.id}>
                  {/* H2 Row */}
                  <Box
                    onClick={() => handleHeadingClick(h2, hasChildren)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      py: 0.4,
                      cursor: 'pointer',
                      borderRadius: 1,
                      color: isActive ? 'primary.main' : 'text.secondary',
                      transition: 'color 120ms ease',
                      userSelect: 'none',
                      '&:hover': {
                        color: isActive ? 'primary.main' : 'text.primary',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 400,
                        lineHeight: 1.4,
                        color: 'inherit',
                        flex: hasChildren ? '0 1 auto' : 1,
                      }}
                    >
                      {h2.text}
                    </Typography>

                    {hasChildren && (
                      <Box
                        component="span"
                        onClick={(e: React.MouseEvent) => handleToggleExpand(h2.id, e)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 0.25,
                          borderRadius: 0.5,
                          color: 'inherit',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} style={{ color: 'inherit' }} />
                        ) : (
                          <ChevronRight size={14} style={{ color: 'inherit' }} />
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* H3 Subsections (Indented) */}
                  {hasChildren && (
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Stack spacing={0.6} sx={{ pl: 2, pt: 0.5, pb: 0.75 }}>
                        {h2.children.map((h3) => {
                          const isH3Active = activeHeadingId === h3.id;
                          return (
                            <Box
                              key={h3.id}
                              onClick={() => handleHeadingClick(h3, false)}
                              sx={{
                                py: 0.25,
                                cursor: 'pointer',
                                color: isH3Active ? 'primary.main' : 'text.secondary',
                                transition: 'color 120ms ease',
                                userSelect: 'none',
                                '&:hover': {
                                  color: isH3Active ? 'primary.main' : 'text.primary',
                                },
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.8125rem',
                                  fontWeight: isH3Active ? 600 : 400,
                                  lineHeight: 1.4,
                                  color: 'inherit',
                                }}
                              >
                                {h3.text}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Collapse>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export const MobileTableOfContents: React.FC<{ headings: TocHeading[] }> = ({ headings }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (headings.length === 0) return null;

  const handleSelect = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const pathWithQuery = `${location.pathname}${location.search}#${id}`;
    navigate(pathWithQuery, { replace: true });
  };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
          On this page
        </Typography>
        <ChevronDown
          size={16}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'hsl(var(--muted-foreground))',
          }}
        />
      </Box>

      <Collapse in={open}>
        <Stack spacing={0.5} sx={{ px: 2, pb: 2, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {headings.map((h2) => (
            <React.Fragment key={h2.id}>
              <Box
                onClick={() => handleSelect(h2.id)}
                sx={{
                  py: 0.4,
                  cursor: 'pointer',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {h2.text}
              </Box>
              {h2.children.map((h3) => (
                <Box
                  key={h3.id}
                  onClick={() => handleSelect(h3.id)}
                  sx={{
                    py: 0.3,
                    pl: 2,
                    cursor: 'pointer',
                    color: 'text.secondary',
                    fontSize: '0.8125rem',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  {h3.text}
                </Box>
              ))}
            </React.Fragment>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default DocsTableOfContents;

