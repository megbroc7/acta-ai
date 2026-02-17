import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Switch,
  Paper,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as OkIcon,
} from '@mui/icons-material';
import api from '../../../services/api';

export default function MaintenanceToggle({ isActive }) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => api.post('/admin/maintenance/toggle'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['maintenanceStatus'] });
    },
  });

  const active = Boolean(isActive);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 0,
        border: '2px solid',
        borderColor: active ? '#A0522D' : 'divider',
        bgcolor: active ? 'rgba(160, 82, 45, 0.04)' : 'transparent',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {active ? (
            <WarningIcon sx={{ color: '#A0522D', fontSize: 28 }} />
          ) : (
            <OkIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          )}
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontSize: '0.95rem',
                color: active ? '#A0522D' : 'primary.main',
              }}
            >
              {active ? 'ALL AI GENERATION PAUSED' : 'System Operating Normally'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Maintenance Mode
            </Typography>
          </Box>
        </Box>
        <Switch
          checked={active}
          onChange={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: '#A0522D',
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: '#A0522D',
            },
            '& .MuiSwitch-track': {
              backgroundColor: 'primary.main',
            },
            transform: 'scale(1.3)',
          }}
        />
      </Box>

      {active && (
        <Alert
          severity="warning"
          icon={false}
          sx={{
            mt: 2,
            borderRadius: 0,
            bgcolor: 'rgba(176, 141, 87, 0.08)',
            border: '1px solid',
            borderColor: 'rgba(176, 141, 87, 0.3)',
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            While maintenance mode is active:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>Scheduled runs are silently skipped</li>
            <li>"Run Now" returns 503</li>
            <li>Test panel content generation is blocked</li>
            <li>"Revise with AI" is blocked</li>
          </Typography>
        </Alert>
      )}
    </Paper>
  );
}
