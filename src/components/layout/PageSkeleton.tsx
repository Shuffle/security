import { Box, Skeleton } from '@mui/material';

/**
 * Generic content-area placeholder shown while a lazily loaded page chunk is
 * still resolving. Rendered inside DashboardLayout so the sidebar stays fully
 * interactive during the transition.
 */
export const PageSkeleton = () => (
  <Box sx={{ width: '100%' }}>
    <Skeleton variant="text" width={220} height={38} sx={{ bgcolor: 'hsl(var(--muted))' }} />
    <Skeleton variant="text" width={340} height={22} sx={{ bgcolor: 'hsl(var(--muted))', mb: 3 }} />
    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={92}
          sx={{ flex: 1, borderRadius: 2, bgcolor: 'hsl(var(--muted))' }}
        />
      ))}
    </Box>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <Skeleton
        key={i}
        variant="rounded"
        height={56}
        sx={{ borderRadius: 1.5, mb: 1.5, bgcolor: 'hsl(var(--muted))', opacity: 1 - i * 0.12 }}
      />
    ))}
  </Box>
);

export default PageSkeleton;
