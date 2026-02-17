import { Box, Paper, Typography } from '@mui/material';

export default function ChartCard({ title, children, sx }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 0,
        border: '1px solid',
        borderColor: 'divider',
        ...sx,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 0.5,
        }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          width: 32,
          height: 2,
          mb: 2.5,
          background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
        }}
      />
      {children}
    </Paper>
  );
}
