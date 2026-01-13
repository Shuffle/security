import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/config/api';

interface Integration {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'error' | 'pending';
}

interface ApiAuthEntry {
  app: {
    id: string;
    name: string;
    large_image?: string;
  };
  active?: boolean;
  validation?: {
    valid: boolean;
    error?: string;
  };
}

interface IntegrationStatusProps {
  collapsed: boolean;
}

export const IntegrationStatus = ({ collapsed }: IntegrationStatusProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch enabled integrations from API
  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!API_CONFIG.apiKey) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/v1/apps/authentication`, {
          headers: {
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          const authData: ApiAuthEntry[] = result.data || result;
          
          if (Array.isArray(authData)) {
            // Filter to only show active/validated apps
            const enabledApps = authData.filter(entry => 
              entry.active || entry.validation?.valid
            );
            
            setIntegrations(enabledApps.map(entry => ({
              id: entry.app.id,
              name: entry.app.name,
              icon: entry.app.large_image || entry.app.name.charAt(0).toUpperCase(),
              status: entry.validation?.valid ? 'connected' : entry.active ? 'pending' : 'error',
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchIntegrations();
  }, []);

  const getStatusColor = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'hsl(var(--severity-low))';
      case 'error':
        return 'hsl(var(--severity-critical))';
      default:
        return 'hsl(var(--muted-foreground))';
    }
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon sx={{ fontSize: 12, color: 'hsl(var(--severity-low))' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 12, color: 'hsl(var(--severity-critical))' }} />;
      default:
        return null;
    }
  };

  if (collapsed) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, gap: 0.5 }}>
        {loading ? (
          <CircularProgress size={20} sx={{ color: 'hsl(var(--muted-foreground))' }} />
        ) : (
          <>
            {integrations.slice(0, 3).map((integration) => (
              <Tooltip key={integration.id} title={`${integration.name} - ${integration.status}`} placement="right">
                <Box
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {integration.icon.startsWith('http') ? (
                    <Avatar
                      src={integration.icon}
                      sx={{
                        width: 28,
                        height: 28,
                        backgroundColor: 'hsl(var(--muted))',
                      }}
                    />
                  ) : (
                    <Avatar
                      sx={{
                        width: 28,
                        height: 28,
                        backgroundColor: 'hsl(var(--muted))',
                        fontSize: '0.9rem',
                      }}
                    >
                      {integration.icon}
                    </Avatar>
                  )}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(integration.status),
                      border: '1px solid hsl(var(--card))',
                    }}
                  />
                </Box>
              </Tooltip>
            ))}
            {integrations.length > 3 && (
              <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' }}>
                +{integrations.length - 3}
              </Typography>
            )}
          </>
        )}
        <Tooltip title="Add Integration" placement="right">
          <IconButton
            size="small"
            onClick={() => navigate('/onboarding')}
            sx={{ color: 'hsl(var(--muted-foreground))', mt: 0.5 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          borderRadius: 1,
          '&:hover': { backgroundColor: 'hsl(var(--muted))' },
        }}
      >
        <Typography sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Integrations
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {loading ? (
            <CircularProgress size={14} sx={{ color: 'hsl(var(--muted-foreground))' }} />
          ) : integrations.length > 0 ? (
            <Chip
              label={integrations.length}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                backgroundColor: 'hsl(var(--primary) / 0.2)',
                color: 'hsl(var(--primary))',
              }}
            />
          ) : null}
          {expanded ? (
            <ExpandLess sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
          ) : (
            <ExpandMore sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <List disablePadding sx={{ py: 0.5 }}>
          {integrations.map((integration) => (
            <ListItem
              key={integration.id}
              sx={{
                py: 0.5,
                px: 1.5,
                borderRadius: 1,
                '&:hover': { backgroundColor: 'hsl(var(--muted))' },
              }}
            >
              <Box sx={{ position: 'relative', mr: 1.5 }}>
                {integration.icon.startsWith('http') ? (
                  <Avatar
                    src={integration.icon}
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: 'hsl(var(--muted))',
                    }}
                  />
                ) : (
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      backgroundColor: 'hsl(var(--muted))',
                      fontSize: '0.8rem',
                    }}
                  >
                    {integration.icon}
                  </Avatar>
                )}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(integration.status),
                    border: '1px solid hsl(var(--card))',
                  }}
                />
              </Box>
              <ListItemText
                primary={integration.name}
                primaryTypographyProps={{
                  sx: { color: 'hsl(var(--foreground))', fontSize: '0.8rem' },
                }}
              />
              {getStatusIcon(integration.status)}
            </ListItem>
          ))}

          {!loading && integrations.length === 0 && (
            <ListItem sx={{ py: 1, px: 1.5 }}>
              <ListItemText
                primary="No integrations"
                secondary="Click + to add"
                primaryTypographyProps={{
                  sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' },
                }}
                secondaryTypographyProps={{
                  sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem' },
                }}
              />
            </ListItem>
          )}

          <ListItem
            onClick={() => navigate('/onboarding')}
            sx={{
              py: 0.75,
              px: 1.5,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'hsl(var(--muted))' },
            }}
          >
            <AddIcon sx={{ fontSize: 18, color: 'hsl(var(--muted-foreground))', mr: 1 }} />
            <ListItemText
              primary="Add Integration"
              primaryTypographyProps={{
                sx: { color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' },
              }}
            />
          </ListItem>
        </List>
      </Collapse>
    </Box>
  );
};
