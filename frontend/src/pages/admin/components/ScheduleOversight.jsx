import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import api from '../../../services/api';
import ChartCard from './ChartCard';

const TH_SX = {
  fontWeight: 800,
  textTransform: 'uppercase',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
};

function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  if (diff < 0) return 'overdue';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `in ${Math.floor(hours / 24)}d`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

export default function ScheduleOversight() {
  const [activeOnly, setActiveOnly] = useState(false);
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data, isLoading } = useQuery({
    queryKey: ['adminSchedules', activeOnly],
    queryFn: () =>
      api.get(`/admin/schedules?active_only=${activeOnly}`).then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (scheduleId) =>
      api.patch(`/admin/schedules/${scheduleId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      enqueueSnackbar('Schedule updated', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(
        err.response?.data?.detail || 'Failed to toggle schedule',
        { variant: 'error' }
      );
    },
  });

  const schedules = data ?? [];
  const activeCount = schedules.filter((s) => s.is_active).length;

  return (
    <ChartCard title="Schedule Oversight" sx={{ gridColumn: '1 / -1' }}>
      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' },
                }}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active only
              </Typography>
            }
          />
          <Chip
            label={`${activeCount} active`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.7rem',
              bgcolor: activeCount > 0 ? 'rgba(74, 124, 111, 0.12)' : 'rgba(0, 0, 0, 0.06)',
              color: activeCount > 0 ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: activeCount > 0 ? 'rgba(74, 124, 111, 0.25)' : 'rgba(0, 0, 0, 0.12)',
            }}
          />
          <Chip
            label={`${schedules.length} total`}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.7rem',
              bgcolor: 'rgba(0, 0, 0, 0.06)',
              color: 'text.secondary',
            }}
          />
        </Box>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: 'primary.main' }} />
        </Box>
      )}

      {!isLoading && schedules.length === 0 && (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {activeOnly ? 'No active schedules' : 'No schedules created yet'}
          </Typography>
        </Box>
      )}

      {!isLoading && schedules.length > 0 && (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={TH_SX}>Schedule</TableCell>
                <TableCell sx={TH_SX}>Owner</TableCell>
                <TableCell sx={TH_SX}>Site</TableCell>
                <TableCell sx={{ ...TH_SX, display: { xs: 'none', md: 'table-cell' } }}>Template</TableCell>
                <TableCell align="center" sx={TH_SX}>Frequency</TableCell>
                <TableCell sx={{ ...TH_SX, display: { xs: 'none', sm: 'table-cell' } }}>Next Run</TableCell>
                <TableCell sx={{ ...TH_SX, display: { xs: 'none', sm: 'table-cell' } }}>Last Run</TableCell>
                <TableCell align="center" sx={TH_SX}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((s) => {
                const rel = relativeTime(s.next_run);
                return (
                  <TableRow key={s.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.user_full_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.user_email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.site_name}
                        </Typography>
                        <Chip
                          label={s.site_platform}
                          size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.template_name}
                      </Typography>
                      {s.template_industry && (
                        <Typography variant="caption" color="text.secondary">
                          {s.template_industry}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={s.frequency}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {s.next_run ? (
                        <Tooltip title={new Date(s.next_run).toLocaleString()}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                              {formatDateTime(s.next_run)}
                            </Typography>
                            {rel && (
                              <Typography
                                variant="caption"
                                sx={{
                                  fontWeight: 700,
                                  color: rel === 'overdue' ? 'error.main' : 'primary.main',
                                }}
                              >
                                {rel}
                              </Typography>
                            )}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">--</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {formatDateTime(s.last_run)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={s.is_active ? 'Click to pause' : 'Click to activate'}>
                        <Chip
                          label={s.is_active ? 'Active' : 'Paused'}
                          size="small"
                          onClick={() => toggleMutation.mutate(s.id)}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            bgcolor: s.is_active
                              ? 'rgba(74, 124, 111, 0.12)'
                              : 'rgba(0, 0, 0, 0.06)',
                            color: s.is_active ? 'primary.main' : 'text.secondary',
                            border: '1px solid',
                            borderColor: s.is_active
                              ? 'rgba(74, 124, 111, 0.3)'
                              : 'rgba(0, 0, 0, 0.12)',
                            '&:hover': {
                              bgcolor: s.is_active
                                ? 'rgba(160, 82, 45, 0.12)'
                                : 'rgba(74, 124, 111, 0.12)',
                            },
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ChartCard>
  );
}
