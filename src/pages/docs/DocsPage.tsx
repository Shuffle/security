import { Menu as MenuIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from '@/lib/router-compat';
import { Box, Container, IconButton, Drawer, Typography, useTheme, useMediaQuery } from '@mui/material';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { DocsTableOfContents, MobileTableOfContents } from '@/components/docs/DocsTableOfContents';
import { useDocContent, type RemoteDocMeta } from '@/components/docs/useDocContent';
import { usePageMeta } from '@/hooks/usePageMeta';

const SIDEBAR_WIDTH_MD = 250;
const SIDEBAR_WIDTH_XL = 270;

interface DocsPageProps {
  /** SSR-provided markdown/metadata; when present the client fetch is skipped. */
  initialContent?: string | null;
  /** API folder to load from (e.g. "legal"). */
  folder?: string;
  /** URL prefix for this section (defaults to /docs). */
  basePath?: string;
  /** Section label used in the sidebar and fallback titles. */
  sectionTitle?: string;
  /** Hide read time, contributors and "Edit on GitHub" metadata. Print stays. */
  hideMeta?: boolean;
  initialMeta?: RemoteDocMeta | null;
}

const DocsPage = ({
  initialContent = null,
  initialMeta = null,
  folder,
  basePath = '/docs',
  sectionTitle = 'Documentation',
  hideMeta,
}: DocsPageProps) => {
  const { slug = 'index' } = useParams<{ slug: string }>();
  const [mobileOpen, setMobileOpen] = useState(false);

  const doc = useDocContent({
    slug,
    folder,
    basePath,
    initialContent,
    initialMeta,
  });

  const fallbackTitle =
    slug === 'index'
      ? sectionTitle
      : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const docTitle = doc.title || doc.meta?.name || fallbackTitle;

  usePageMeta({
    title: docTitle,
    description: `Shuffle Security ${sectionTitle.toLowerCase()} — ${docTitle}.`,
    url: `${basePath}/${slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: docTitle,
      description: `Shuffle Security ${sectionTitle.toLowerCase()} — ${docTitle}.`,
      url: `https://shuffle.security${basePath}/${slug}`,
      author: { '@type': 'Organization', name: 'Shuffle Security' },
      publisher: { '@type': 'Organization', name: 'Shuffle Security', url: 'https://shuffle.security' },
    },
  });

  const hasHeadings = doc.headings.length > 0;
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setContainerWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const size = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
          setContainerWidth(size.inlineSize);
        } else {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Show desktop TOC only if viewport is >= 1200px (isLgUp) AND the content area has
  // at least 860px of available space (leaving enough room for middle content + gap + TOC).
  // If the window is < 1200px, or if the Ask AI panel shrinks available space below 860px,
  // we smoothly fall back to the mobile TOC jumper view.
  const showDesktopToc = isLgUp && (containerWidth === null || containerWidth >= 860);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />

      {/* Spacer for fixed navbar */}
      <Box sx={{ height: 64 }} />

      {/* Mobile menu button */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: 72,
          left: 8,
          zIndex: 1100,
        }}
      >
        <IconButton
          aria-label="Open documentation menu"
          onClick={() => setMobileOpen(true)}
          sx={{
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { backgroundColor: 'action.hover' },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 280,
            backgroundColor: 'background.default',
          },
        }}
      >
        <Box sx={{ pt: 2 }}>
          <DocsSidebar
            onNavigate={() => setMobileOpen(false)}
            folder={folder}
            basePath={basePath}
            title={sectionTitle}
            hideExternal={Boolean(folder)}
          />
        </Box>
      </Drawer>

      <Box sx={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Desktop Sidebar (Left) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'fixed',
            top: 64,
            left: 0,
            height: 'calc(100vh - 64px)',
            width: { md: SIDEBAR_WIDTH_MD, xl: SIDEBAR_WIDTH_XL },
            backgroundColor: 'background.default',
            zIndex: 1,
            borderRight: '1px solid',
            borderColor: 'divider',
          }}
        >
          <DocsSidebar
            folder={folder}
            basePath={basePath}
            title={sectionTitle}
            hideExternal={Boolean(folder)}
          />
        </Box>

        {/* Main content + Right ToC area */}
        <Box
          ref={containerRef}
          sx={{
            flex: 1,
            minWidth: 0,
            ml: { xs: 0, md: `${SIDEBAR_WIDTH_MD}px`, xl: `${SIDEBAR_WIDTH_XL}px` },
            mr: { xs: 0, md: 'var(--ask-ai-panel-width, 0px)' },
            transition: 'margin 0.2s ease',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Container
            maxWidth={false}
            sx={{
              maxWidth: 1440,
              width: '100%',
              py: { xs: 3, md: 5 },
              px: { xs: 2, sm: 3, md: 3, lg: 4, xl: 5 },
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: { lg: 3.5, xl: 5 },
                alignItems: 'flex-start',
                minWidth: 0,
                width: '100%',
              }}
            >
              {/* Document Article Column */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  maxWidth: showDesktopToc ? { xs: '100%', lg: 820, xl: 900 } : '100%',
                }}
              >
                <MarkdownRenderer
                  title={docTitle}
                  slug={slug}
                  folder={folder}
                  basePath={basePath}
                  content={doc.content}
                  meta={doc.meta}
                  loading={doc.loading}
                  resetting={doc.resetting}
                  error={doc.error}
                  suggestions={doc.suggestions}
                  suggestLoading={doc.suggestLoading}
                  onResetCache={doc.handleResetCache}
                  hideMeta={hideMeta ?? folder === 'legal'}
                  mobileToc={
                    hasHeadings && !showDesktopToc ? (
                      <Box
                        sx={{
                          position: 'sticky',
                          top: { xs: 56, sm: 64 },
                          zIndex: 20,
                          backgroundColor: 'background.default',
                          py: 1,
                          mb: 3,
                          pl: { xs: '48px', sm: '52px', md: 0 },
                        }}
                      >
                        <MobileTableOfContents headings={doc.headings} />
                      </Box>
                    ) : null
                  }
                />
              </Box>

              {/* Right Sidebar: Table of Contents (lg+) */}
              {hasHeadings && showDesktopToc && (
                <Box
                  component="aside"
                  aria-label="Table of contents"
                  sx={{
                    width: { lg: 220, xl: 250 },
                    flexShrink: 0,
                    display: { xs: 'none', lg: 'block' },
                    position: 'sticky',
                    top: 84,
                    alignSelf: 'flex-start',
                    maxHeight: 'calc(100vh - 100px)',
                    overflowY: 'auto',
                    pr: 1,
                    // subtle scrollbar
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'divider',
                      borderRadius: 2,
                    },
                  }}
                >
                  <DocsTableOfContents headings={doc.headings} />
                </Box>
              )}
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
};

export default DocsPage;
