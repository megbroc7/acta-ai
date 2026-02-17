import { Box, Typography } from '@mui/material';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

export default function AdminTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: CHART_COLORS.stone,
        borderTop: `3px solid ${CHART_COLORS.bronze}`,
        p: 1.5,
        borderRadius: 0,
        ...CHART_FONT,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {payload.map((entry, i) => (
        <Typography
          key={i}
          variant="caption"
          sx={{ display: 'block', color: entry.color || CHART_COLORS.text }}
        >
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </Typography>
      ))}
    </Box>
  );
}
