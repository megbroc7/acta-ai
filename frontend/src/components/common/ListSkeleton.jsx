import { Box, Grid, Paper, Skeleton } from '@mui/material';

function TableSkeleton({ rows = 4 }) {
  return (
    <Paper>
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #E0DCD5',
        }}
      >
        <Skeleton variant="text" width="40%" height={20} animation="wave" />
        <Skeleton variant="text" width="15%" height={20} animation="wave" sx={{ display: { xs: 'none', md: 'block' } }} />
        <Skeleton variant="text" width="12%" height={20} animation="wave" />
        <Skeleton variant="text" width="15%" height={20} animation="wave" sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ flex: 1 }} />
        <Skeleton variant="text" width={40} height={20} animation="wave" />
      </Box>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.75,
            borderBottom: i < rows - 1 ? '1px solid #E0DCD5' : 'none',
          }}
        >
          <Skeleton variant="text" width={`${30 + Math.random() * 20}%`} height={18} animation="wave" />
          <Skeleton variant="text" width="12%" height={18} animation="wave" sx={{ display: { xs: 'none', md: 'block' } }} />
          <Skeleton variant="rounded" width={80} height={24} animation="wave" sx={{ borderRadius: '12px' }} />
          <Skeleton variant="text" width="10%" height={18} animation="wave" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="circular" width={28} height={28} animation="wave" />
        </Box>
      ))}
    </Paper>
  );
}

function CardsSkeleton({ rows = 4 }) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: rows }).map((_, i) => (
        <Grid item xs={12} md={6} lg={4} key={i}>
          <Box
            sx={{
              border: '1px solid #E0DCD5',
              borderTop: '3px solid #B08D57',
              p: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Skeleton variant="text" width="60%" height={28} animation="wave" />
              <Skeleton variant="rounded" width={60} height={24} animation="wave" sx={{ borderRadius: '12px' }} />
            </Box>
            <Skeleton variant="text" width="85%" height={16} animation="wave" />
            <Skeleton variant="text" width="55%" height={16} animation="wave" sx={{ mt: 0.5 }} />
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Skeleton variant="rounded" width={72} height={24} animation="wave" sx={{ borderRadius: '12px' }} />
              <Skeleton variant="rounded" width={56} height={24} animation="wave" sx={{ borderRadius: '12px' }} />
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

export default function ListSkeleton({ variant = 'cards', rows = 4 }) {
  if (variant === 'table') return <TableSkeleton rows={rows} />;
  return <CardsSkeleton rows={rows} />;
}
