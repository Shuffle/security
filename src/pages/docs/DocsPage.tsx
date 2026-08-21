import { Menu as MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from '@/lib/router-compat';
import { Box, Container, IconButton, Drawer } from '@mui/material';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { usePageMeta } from '@/hooks/usePageMeta';

const DocsPage = () => {
  const { slug = 'index' } = useParams<{ slug: string }>();
  const [mobileOpen, setMobileOpen] = useState(false);

  const docTitle = slug === 'index' ? 'Documentation' : slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  usePageMeta({
    title: docTitle,
    description: `Shuffle Security documentation — ${docTitle}. Learn how to set up and use the platform.`,
    url: `/docs/${slug}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: docTitle,
      description: `Shuffle Security documentation — ${docTitle}.`,
      url: `https://shuffle.security/docs/${slug}`,
      author: { '@type': 'Organization', name: 'Shuffle Security' },
      publisher: { '@type': 'Organization', name: 'Shuffle Security', url: 'https://shuffle.security' },
    },
  });

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
          <DocsSidebar onNavigate={() => setMobileOpen(false)} />
        </Box>
      </Drawer>
      
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Desktop Sidebar */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'fixed',
            top: 64,
            left: 0,
            height: 'calc(100vh - 64px)',
            width: 280,
            backgroundColor: 'background.default',
            zIndex: 1,
          }}
        >
          <DocsSidebar />
        </Box>

        {/* Main content */}
        <Box
          sx={{
            flex: 1,
            ml: { xs: 0, md: '280px' },
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Container maxWidth="lg" sx={{ py: 6, px: { xs: 2, sm: 3, md: 6 } }}>
            <Typography
              component="h1"
              sx={{ fontSize: { xs: '30px', md: '36px' }, fontWeight: 600, mb: 3 }}
            >
              {docTitle}
            </Typography>
            <MarkdownRenderer slug={slug} />
          </Container>
        </Box>
      </Box>
    </Box>
  );
};

export default DocsPage;
