import { Box, Container, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Footer } from '@/components/landing/Footer';
import { SingulJS } from '@/lib/singul-local';

export default function AppsPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <LandingNavbar />
      
      {/* Hero section */}
      <Box
        sx={{
          pt: { xs: 12, md: 16 },
          pb: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 80%, rgba(255, 102, 0, 0.08) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ textAlign: 'center', mb: 6 }}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '4rem' },
                  fontWeight: 800,
                  mb: 3,
                  letterSpacing: '-0.02em',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  3,000+
                </Box>{' '}
                Integrations
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  color: 'text.secondary',
                  maxWidth: 650,
                  mx: 'auto',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                  mb: 4,
                }}
              >
                Connect your SIEM, EDR, ITSM, Email, Threat Intel, Cloud, and any other data source. 
                Use your existing tools—we fill in the gaps.
              </Typography>
              <Button
                component={Link}
                to="/register"
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)',
                  boxShadow: '0 8px 32px rgba(255, 102, 0, 0.35)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(255, 102, 0, 0.45)',
                  },
                }}
              >
                Get Started Free
              </Button>
            </Box>
          </motion.div>
        </Container>
      </Box>

      {/* Search section */}
      <Box sx={{ flex: 1, pb: 12 }}>
        <Container maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Box
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 4,
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <SingulJS
                authToken=""
                placeholder="Search 3,000+ integrations... (e.g., Splunk, CrowdStrike, ServiceNow)"
                layout="grid"
                gridColumns={4}
                showDescription
                inline
                hitsPerPage={24}
                preventDefault
                onAppSelected={({ app }) => {
                  // Navigate to register with app context
                  window.location.href = `/register?app=${encodeURIComponent(app.name)}`;
                }}
                customStyles={{
                  container: {
                    width: '100%',
                  },
                  input: {
                    fontSize: '1.1rem',
                    padding: '16px 20px',
                  },
                }}
              />
            </Box>
          </motion.div>

          {/* CTA at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.1rem',
                  mb: 3,
                }}
              >
                Can't find what you need? We support any REST API.
              </Typography>
              <Button
                component={Link}
                to="/register"
                variant="outlined"
                size="large"
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  borderColor: 'rgba(255, 102, 0, 0.5)',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.main',
                    background: 'rgba(255, 102, 0, 0.08)',
                  },
                }}
              >
                Start Building
              </Button>
            </Box>
          </motion.div>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}