/**
 * Quick View Drawer — slides in from the right to show notification details,
 * with Approve / Configure actions and a CTA to view the full incident.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Drawer,
  TextField,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { CheckCircle, Settings, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgentNotification } from '@/services/notifications';

interface Props {
  open: boolean;
  onClose: () => void;
  notification: AgentNotification | null;
  entityBasePath: string;
  onApprove: (notification: AgentNotification) => void;
  onConfigureApprove: (notificationId: string, modifiedAction?: string) => void;
}

const AgentQuickViewDrawer = ({ open, onClose, notification, entityBasePath, onApprove, onConfigureApprove }: Props) => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [modifiedAction, setModifiedAction] = useState('');

  if (!notification) return null;

  const actionDescription = notification.action || notification.description || '';
  const timeAgo = notification.created_at
    ? new Date(notification.created_at * 1000).toLocaleString()
    : '—';

  const handleApprove = () => {
    onApprove(notification);
    onClose();
  };

  const handleConfigureSubmit = () => {
    onConfigureApprove(notification.id, modifiedAction);
    setModifiedAction('');
    setIsConfiguring(false);
    onClose();
  };

  const handleClose = () => {
    setIsConfiguring(false);
    setModifiedAction('');
    onClose();
  };

  const incidentId = notification.incident_id || notification.reference_url;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 440 },
          bgcolor: 'hsl(var(--background))',
          backgroundImage: 'none',
          borderLeft: '1px solid hsl(var(--border))',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2.5,
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: 'hsl(var(--foreground))' }}>
          Quick View
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'hsl(var(--muted-foreground))' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflow: 'auto' }}>
        {/* Title */}
        <Box>
          <Typography sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 0.75,
          }}>
            Title
          </Typography>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
            {notification.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            {notification.severity && (
              <Chip
                label={notification.severity}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  backgroundColor: 'hsl(var(--severity-high) / 0.12)',
                  color: 'hsl(var(--severity-high))',
                }}
              />
            )}
            <Chip
              icon={<Clock size={12} />}
              label="Approval Needed"
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                backgroundColor: 'hsl(var(--severity-info) / 0.12)',
                color: 'hsl(var(--severity-info))',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', mt: 1 }}>
            {timeAgo}
          </Typography>
        </Box>

        {/* What the agent wants to do */}
        <Box>
          <Typography sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 0.75,
          }}>
            Proposed Action
          </Typography>
          <Box sx={{
            px: 2.5,
            py: 2,
            borderRadius: 2,
            backgroundColor: 'hsl(var(--severity-info) / 0.06)',
            border: '1px solid hsl(var(--severity-info) / 0.15)',
          }}>
            <Typography sx={{
              fontSize: '0.85rem',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              <Typography component="span" sx={{ fontWeight: 600, fontSize: 'inherit', color: 'hsl(var(--foreground))' }}>
                Agent wants to:
              </Typography>{' '}
              {actionDescription}
            </Typography>
          </Box>
        </Box>

        {/* Configure section (expandable) */}
        {isConfiguring && (
          <Box>
            <Typography sx={{
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              mb: 0.75,
            }}>
              Modify Action
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', mb: 1.5 }}>
              Provide an alternative action for the agent to execute instead.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Describe the modified action…"
              value={modifiedAction}
              onChange={(e) => setModifiedAction(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.85rem',
                  bgcolor: 'hsl(var(--card))',
                  '& fieldset': { borderColor: 'hsl(var(--border))' },
                  '&:hover fieldset': { borderColor: 'hsl(var(--primary) / 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'hsl(var(--primary))' },
                },
                '& .MuiOutlinedInput-input': {
                  color: 'hsl(var(--foreground))',
                },
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              <Button
                onClick={() => { setIsConfiguring(false); setModifiedAction(''); }}
                size="small"
                sx={{
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfigureSubmit}
                size="small"
                variant="contained"
                disabled={!modifiedAction.trim()}
                startIcon={<Settings size={14} />}
                sx={{
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  fontWeight: 600,
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  boxShadow: 'none',
                  '&:hover': {
                    backgroundColor: 'hsl(var(--primary) / 0.9)',
                    boxShadow: 'none',
                  },
                }}
              >
                Submit Modified Action
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer actions */}
      <Box sx={{
        px: 3,
        py: 2.5,
        borderTop: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={handleApprove}
            fullWidth
            variant="contained"
            startIcon={<CheckCircle size={15} />}
            sx={{
              fontSize: '0.8rem',
              textTransform: 'none',
              fontWeight: 600,
              backgroundColor: 'hsl(var(--severity-low))',
              color: 'hsl(var(--primary-foreground))',
              py: 1,
              boxShadow: 'none',
              '&:hover': {
                backgroundColor: 'hsl(var(--severity-low) / 0.9)',
                boxShadow: 'none',
              },
            }}
          >
            Approve
          </Button>
          {!isConfiguring && (
            <Button
              onClick={() => setIsConfiguring(true)}
              fullWidth
              variant="outlined"
              startIcon={<Settings size={15} />}
              sx={{
                fontSize: '0.8rem',
                textTransform: 'none',
                fontWeight: 500,
                borderColor: 'hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                py: 1,
                '&:hover': {
                  borderColor: 'hsl(var(--primary) / 0.5)',
                  backgroundColor: 'hsl(var(--primary) / 0.08)',
                },
              }}
            >
              Configure
            </Button>
          )}
        </Box>

        {incidentId && (
          <Button
            component={Link}
            to={`${entityBasePath}/${notification.incident_id}`}
            fullWidth
            variant="outlined"
            endIcon={<ArrowRight size={14} />}
            sx={{
              fontSize: '0.8rem',
              textTransform: 'none',
              fontWeight: 500,
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              py: 1,
              '&:hover': {
                borderColor: 'hsl(var(--primary) / 0.5)',
                backgroundColor: 'hsl(var(--primary) / 0.08)',
              },
            }}
          >
            View Full Incident
          </Button>
        )}
      </Box>
    </Drawer>
  );
};

export default AgentQuickViewDrawer;
