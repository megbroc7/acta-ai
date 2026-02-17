import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import UserManagement from './components/UserManagement';

export default function AdminUsers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['adminDashboard', 30],
    queryFn: () => api.get('/admin/dashboard?days=30').then((r) => r.data),
  });

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
        User Management
      </Typography>
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          Failed to load user data.
        </Alert>
      )}
      {data && <UserManagement data={data.user_activity} />}
    </Box>
  );
}
