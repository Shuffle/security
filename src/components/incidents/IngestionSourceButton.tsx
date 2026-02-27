import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, IconButton, Popover, Typography, Chip, Button } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import { ValidatedIngestionApp } from '@/lib/ingestionDetection';

interface IngestionSourceButtonProps {
  app: ValidatedIngestionApp;
}

export const IngestionSourceButton = ({ app }: IngestionSourceButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popoverOpen = Boolean(anchorEl);
  const displayName = app.name.replace(/_/g, ' ');

  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
        sx={{
          width: 30,
          height: 30,
          border: '1px solid',
          borderColor: app.enabled ? 'rgba(34, 197, 94, 0.20)' : 'transparent',
          bgcolor: app.enabled ? 'rgba(34, 197, 94, 0.10)' : 'transparent',
          borderRadius: 1,
          opacity: app.enabled ? 1 : 0.35,
          filter: app.enabled ? 'none' : 'grayscale(1)',
          transition: 'opacity 0.15s ease, filter 0.15s ease',
          '&:hover': {
            bgcolor: app.enabled ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255,255,255,0.1)',
            opacity: app.enabled ? 1 : 0.7,
            filter: 'none',
          },
        }}
      >
        {app.image ? (
          <Box
            component="img"
            src={app.image}
            alt={app.name}
            sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'contain' }}
          />
        ) : (
          <DownloadIcon sx={{ fontSize: 16, color: app.enabled ? '#4ade80' : 'rgba(255,255,255,0.4)' }} />
        )}
      </IconButton>
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 1.5,
              p: 1.5,
              minWidth: 160,
            },
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))', textTransform: 'capitalize', mb: 1, display: 'block' }}>
          {displayName}
          {!app.enabled && (
            <Chip label="Not Active" size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem', bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }} />
          )}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Button
            component={Link}
            to={`/apps/${app.name.toLowerCase()}`}
            size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            onClick={() => setAnchorEl(null)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: '0.75rem',
              color: 'hsl(var(--foreground))',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: 'hsl(var(--muted))' },
            }}
          >
            Visit app
          </Button>
          <Button
            size="small"
            startIcon={<BlockIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              // TODO: implement disable logic
              setAnchorEl(null);
            }}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontSize: '0.75rem',
              color: 'hsl(var(--destructive))',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.1)' },
            }}
          >
            Disable app
          </Button>
        </Box>
      </Popover>
    </Box>
  );
};
