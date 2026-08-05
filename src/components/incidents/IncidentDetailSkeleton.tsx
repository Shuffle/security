import { Box, Skeleton } from '@mui/material';

const line = { bgcolor: 'hsl(var(--muted))' };

const CardBlock = ({ headerWidth, rows, height }: { headerWidth: number; rows?: number; height?: number }) => (
  <Box
    sx={{
      border: '1px solid hsl(var(--border))',
      borderRadius: 2,
      bgcolor: 'hsl(var(--card))',
      p: 2,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Skeleton variant="text" width={headerWidth} height={20} sx={line} />
      <Skeleton variant="rounded" width={64} height={22} sx={{ ...line, borderRadius: '6px' }} />
    </Box>
    {height ? (
      <Skeleton variant="rounded" height={height} sx={{ ...line, borderRadius: 1.5 }} />
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: rows ?? 3 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            height={16}
            width={`${100 - i * 12}%`}
            sx={line}
          />
        ))}
      </Box>
    )}
  </Box>
);

/**
 * Skeleton that mirrors the real incident detail layout (header + tabs +
 * main column with sections + 360px right sidebar), so the page does not
 * visually jump once the incident data arrives.
 */
export const IncidentDetailSkeleton = () => (
  <Box sx={{ maxWidth: 1400, width: '100%', mx: 'auto' }}>
    {/* Back link + title row */}
    <Skeleton variant="text" width={120} height={18} sx={{ ...line, mb: 1.5 }} />
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" height={34} width="55%" sx={{ ...line, mb: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[70, 90, 60, 110].map((w, i) => (
            <Skeleton key={i} variant="rounded" width={w} height={24} sx={{ ...line, borderRadius: '6px' }} />
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {[36, 36, 110].map((w, i) => (
          <Skeleton key={i} variant="rounded" width={w} height={36} sx={{ ...line, borderRadius: 1 }} />
        ))}
      </Box>
    </Box>

    {/* Tabs */}
    <Box sx={{ display: 'flex', gap: 3, borderBottom: '1px solid hsl(var(--border))', pb: 1.25, mb: 2.5 }}>
      {[70, 60, 95, 100, 60].map((w, i) => (
        <Skeleton key={i} variant="text" width={w} height={18} sx={line} />
      ))}
    </Box>

    {/* Main grid: content + right sidebar */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
        gap: 2.5,
        alignItems: 'start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
        <CardBlock headerWidth={110} rows={4} />
        <CardBlock headerWidth={140} height={220} />
        <CardBlock headerWidth={90} rows={3} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <CardBlock headerWidth={80} rows={6} />
        <CardBlock headerWidth={120} rows={3} />
      </Box>
    </Box>
  </Box>
);

export default IncidentDetailSkeleton;
