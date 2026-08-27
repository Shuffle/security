import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { recordCrash } from '@/lib/crashReporter';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    recordCrash(error, {
      source: 'react_boundary',
      componentStack: errorInfo.componentStack || undefined,
      extra: { componentName: this.props.name || 'ComponentErrorBoundary' },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            my: 1.5,
            borderRadius: 2,
            bgcolor: 'hsl(var(--muted) / 0.5)',
            borderColor: 'hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertCircle size={18} style={{ color: 'hsl(var(--destructive, #ef4444))', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {this.props.name ? `${this.props.name} failed to load` : 'Unable to display this section'}
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'A rendering error occurred in this component.'}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={this.handleRetry}
              startIcon={<RefreshCw size={14} />}
              sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.5, px: 1.5 }}
            >
              Retry
            </Button>
          </Box>
        </Paper>
      );
    }

    return this.props.children;
  }
}
