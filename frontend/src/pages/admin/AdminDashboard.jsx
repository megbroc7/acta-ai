import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  MenuItem,
  Select,
  FormControl,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People as UsersIcon,
  Language as SitesIcon,
  Description as TemplatesIcon,
  Schedule as SchedulesIcon,
  Article as PostsIcon,
  PlayArrow as ActiveIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import PostsOverTimeChart from './components/PostsOverTimeChart';
import StatusBreakdownChart from './components/StatusBreakdownChart';
import PlatformChart from './components/PlatformChart';
import SchedulerHealthChart from './components/SchedulerHealthChart';
import CostEstimateChart from './components/CostEstimateChart';
import SignupsChart from './components/SignupsChart';
import MaintenanceToggle from './components/MaintenanceToggle';

const PERIOD_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
];

function StatCard({ icon, label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 0,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(74, 124, 111, 0.08)',
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
          {value ?? '--'}
        </Typography>
        <Typography
          variant="caption"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, color: 'text.secondary' }}
        >
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminDashboard', days],
    queryFn: () => api.get(`/admin/dashboard?days=${days}`).then((r) => r.data),
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
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
            System Administration
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Platform-wide overview and metrics
          </Typography>
        </Box>
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

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 3 }}>
          {error.response?.status === 403
            ? 'You do not have admin access.'
            : 'Failed to load dashboard data.'}
        </Alert>
      )}

      {data && (
        <>
          {/* Stats strip */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
              gap: 2,
              mb: 4,
            }}
          >
            <StatCard icon={<UsersIcon />} label="Users" value={data.total_users} />
            <StatCard icon={<SitesIcon />} label="Sites" value={data.total_sites} />
            <StatCard icon={<TemplatesIcon />} label="Templates" value={data.total_templates} />
            <StatCard icon={<SchedulesIcon />} label="Schedules" value={data.total_schedules} />
            <StatCard icon={<PostsIcon />} label="Posts" value={data.total_posts} />
            <StatCard icon={<ActiveIcon />} label="Active Schedules" value={data.active_schedules} />
          </Box>

          {/* Chart grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <PostsOverTimeChart data={data.posts_over_time} />
            <StatusBreakdownChart data={data.status_breakdown} />
            <SchedulerHealthChart data={data.scheduler_health} />
            <PlatformChart data={data.platform_breakdown} />
            <CostEstimateChart data={data.cost_estimates} />
            <SignupsChart data={data.signups_over_time} />
          </Box>

          {/* Maintenance toggle */}
          <Box sx={{ mt: 3 }}>
            <MaintenanceToggle isActive={data.maintenance_mode} />
          </Box>
        </>
      )}
    </Box>
  );
}
