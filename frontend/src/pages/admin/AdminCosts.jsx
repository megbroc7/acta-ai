import { useState } from 'react';
import { Box, Typography, MenuItem, Select, FormControl } from '@mui/material';
import UserCostBreakdown from './components/UserCostBreakdown';

const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

export default function AdminCosts() {
  const [days, setDays] = useState(30);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            position: 'relative',
            display: 'inline-block',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -6,
              left: 0,
              width: '100%',
              height: 3,
              background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
            },
          }}
        >
          Cost Breakdown
        </Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            sx={{ borderRadius: 0, fontWeight: 600, fontSize: '0.85rem' }}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <UserCostBreakdown days={days} />
    </Box>
  );
}
