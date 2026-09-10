import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Collapse, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type TocHeading, safeDecodeURIComponent } from './tocUtils';
import { useScrollSpy } from './useScrollSpy';
import { useLocation, useNavigate } from '@/lib/router-compat';

export interface DocsTableOfContentsProps {
  /** Hierarchical headings list (H2 with nested H3). */
  headings: TocHeading[];
  /** Optional sx prop overrides */
  sx?: SxProps<Theme>;
}

export const DocsTableOfContents: React.FC<DocsTableOfContentsProps> = ({
  headings,
  sx,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeItemRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-expand current active parent section, keeping others collapsed (accordion style)
  useEffect(() => {
    if (!activeHeadingId) return;
    const parentId = parentMap.get(activeHeadingId) || activeHeadingId;
    const parentHeading = headings.find((h) => h.id === parentId);
    if (parentHeading && parentHeading.children.length > 0) {
      setExpandedIds((prev) => {
        if (prev.has(parentId) && prev.size === 1) return prev;
        return new Set([parentId]);
      });
    }
  }, [activeHeadingId, parentMap, headings]);

  // Keep the active item in view inside the TOC container as you scroll
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeHeadingId]);

  // Initial expansion based on URL hash or first section
  useEffect(() => {
    const rawHash = location.hash ? safeDecodeURIComponent(location.hash.replace(/^#/, '')) : '';
    if (rawHash) {
      const parentId = parentMap.get(rawHash) || rawHash;
      if (parentId) {
        setExpandedIds(new Set([parentId]));
        return;
      }
    }
    // Default: expand only the first section that has children
    const firstWithChildren = headings.find((h) => h.children.length > 0);
    if (firstWithChildren) {
      setExpandedIds(new Set([firstWithChildren.id]));
    } else {
      setExpandedIds(new Set());
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
      // Auto-expand active section in accordion style
      if (hasChildren) {
        setExpandedIds(new Set([heading.id]));
      }

      const el = document.getElementById(heading.id);
      if (el) {
        const yOffset = -90;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }

      // Sync URL hash
      if (typeof window !== 'undefined') {
        const pathWithQuery = `${location.pathname}${location.search}#${heading.id}`;
        navigate(pathWithQuery, { replace: true });
      }
    },
    [expandedIds, location.pathname, location.search, navigate],
  );

  if (headings.length === 0) return null;

  return (
    <Box
      sx={[
        {
          width: '100%',
          pr: { xs: 1, md: 1.5 },
          pb: '150px',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography
        sx={{
          color: 'text.primary',
          fontSize: '0.9rem',
          fontWeight: 600,
          mb: 1.5,
          userSelect: 'none',
        }}
      >
        Table of Contents
      </Typography>

      <Stack spacing={0.75} sx={{ pl: 0 }}>
        {headings.map((h2) => {
          const hasChildren = h2.children.length > 0;
          const isExpanded = expandedIds.has(h2.id);
          const isH2Active = activeHeadingId === h2.id;
          const isChildActive = h2.children.some((c) => c.id === activeHeadingId);
          const isActive = isH2Active || isChildActive;

          return (
            <Box
              key={h2.id}
              ref={isH2Active ? activeItemRef : undefined}
              sx={{ scrollMarginBottom: '150px' }}
            >
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
                  minWidth: 0,
                  '&:hover': {
                    color: isActive ? 'primary.main' : 'text.primary',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 400,
                    lineHeight: 1.35,
                    color: 'inherit',
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
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
                      flexShrink: 0,
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
                          ref={isH3Active ? activeItemRef : undefined}
                          onClick={() => handleHeadingClick(h3, false)}
                          sx={{
                            scrollMarginBottom: '150px',
                            py: 0.25,
                            cursor: 'pointer',
                            color: isH3Active ? 'primary.main' : 'text.secondary',
                            transition: 'color 120ms ease',
                            userSelect: 'none',
                            minWidth: 0,
                            '&:hover': {
                              color: isH3Active ? 'primary.main' : 'text.primary',
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.8125rem',
                              fontWeight: isH3Active ? 600 : 400,
                              lineHeight: 1.35,
                              color: 'inherit',
                              minWidth: 0,
                              overflowWrap: 'break-word',
                              wordBreak: 'break-word',
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
  );
};

export const MobileTableOfContents: React.FC<{ headings: TocHeading[] }> = ({ headings }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  const activeHeadingId = useScrollSpy(flatIds, { offset: 160 });

  const activeHeading = useMemo(() => {
    if (!activeHeadingId) return null;
    for (const h2 of headings) {
      if (h2.id === activeHeadingId) return h2;
      for (const h3 of h2.children) {
        if (h3.id === activeHeadingId) return h3;
      }
    }
    return null;
  }, [headings, activeHeadingId]);

  if (headings.length === 0) return null;

  const handleSelect = (id: string) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -120;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    const pathWithQuery = `${location.pathname}${location.search}#${id}`;
    navigate(pathWithQuery, { replace: true });
  };

  return (
    <Box
      sx={{
        borderTop: '1px solid',
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderLeft: { xs: 'none', md: '1px solid' },
        borderRight: { xs: 'none', md: '1px solid' },
        borderRadius: { xs: 0, md: 2 },
        backgroundColor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 4px 20px rgba(0, 0, 0, 0.4)'
            : '0 4px 16px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        width: '100%',
      }}
    >
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3 },
          py: 1.25,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ minWidth: 0, overflow: 'hidden', mr: 1 }}
        >
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'text.primary',
              flexShrink: 0,
            }}
          >
            On this page
          </Typography>
          {activeHeading && (
            <>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  flexShrink: 0,
                }}
              >
                /
              </Typography>
              <Typography
                noWrap
                sx={{
                  fontSize: '0.875rem',
                  color: 'primary.main',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeHeading.text}
              </Typography>
            </>
          )}
        </Stack>

        <ChevronDown
          size={16}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'hsl(var(--muted-foreground))',
            flexShrink: 0,
          }}
        />
      </Box>

      <Collapse in={open}>
        <Stack
          spacing={0.5}
          sx={{
            px: { xs: 2, sm: 3 },
            pb: 2,
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            maxHeight: 'calc(100vh - 160px)',
            overflowY: 'auto',
            // subtle scrollbar
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'divider',
              borderRadius: 2,
            },
          }}
        >
          {headings.map((h2) => {
            const isH2Active = activeHeadingId === h2.id;
            return (
              <React.Fragment key={h2.id}>
                <Box
                  onClick={() => handleSelect(h2.id)}
                  sx={{
                    py: 0.5,
                    px: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    color: isH2Active ? 'primary.main' : 'text.primary',
                    backgroundColor: isH2Active ? 'action.selected' : 'transparent',
                    fontSize: '0.875rem',
                    fontWeight: isH2Active ? 600 : 500,
                    transition: 'all 120ms ease',
                    '&:hover': {
                      color: 'primary.main',
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  {h2.text}
                </Box>
                {h2.children.map((h3) => {
                  const isH3Active = activeHeadingId === h3.id;
                  return (
                    <Box
                      key={h3.id}
                      onClick={() => handleSelect(h3.id)}
                      sx={{
                        py: 0.4,
                        pl: 2.5,
                        pr: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        color: isH3Active ? 'primary.main' : 'text.secondary',
                        backgroundColor: isH3Active ? 'action.selected' : 'transparent',
                        fontSize: '0.8125rem',
                        fontWeight: isH3Active ? 600 : 400,
                        transition: 'all 120ms ease',
                        '&:hover': {
                          color: 'primary.main',
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      {h3.text}
                    </Box>
                  );
                })}
              </React.Fragment>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default DocsTableOfContents;

