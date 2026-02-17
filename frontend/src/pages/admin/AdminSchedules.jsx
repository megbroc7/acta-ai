import { Box, Typography } from '@mui/material';
import ScheduleOversight from './components/ScheduleOversight';

export default function AdminSchedules() {
  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          mb: 4,
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
        Schedule Oversight
      </Typography>
      <ScheduleOversight />
    </Box>
  );
}
