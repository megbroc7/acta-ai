import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const CATEGORY_COLORS = {
  api_rate_limit: '#B08D57',
  api_auth: '#A0522D',
  api_quota: '#A0522D',
  api_timeout: '#B08D57',
  publish_auth: '#A0522D',
  publish_connection: '#B08D57',
  publish_timeout: '#B08D57',
  content_error: '#B08D57',
  image_error: '#B08D57',
  config_error: '#A0522D',
  unknown: '#888',
};

const CATEGORY_TITLES = {
  api_rate_limit: 'Rate Limited',
  api_auth: 'API Key Invalid',
  api_quota: 'Quota Exceeded',
  api_timeout: 'Timeout',
  publish_auth: 'Site Auth Failed',
  publish_connection: 'Site Unreachable',
  publish_timeout: 'Publish Timeout',
  content_error: 'Content Error',
  image_error: 'Image Error',
  config_error: 'Config Error',
  unknown: 'Unknown',
};

const PAGE_SIZE = 20;

export default function ScheduleHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState(null); // null | 'success' | 'failure'

  const { data: schedule } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => api.get(`/schedules/${id}`).then(r => r.data),
  });

  const { data: execData, isLoading } = useQuery({
    queryKey: ['executionHistory', id, page, filter],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (filter) params.set('success_filter', filter);
      return api.get(`/schedules/${id}/executions/?${params}`).then(r => r.data);
    },
  });

  const total = execData?.total || 0;
  const entries = execData?.entries || [];

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms) => {
    if (ms == null) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/schedules')}
          sx={{ textTransform: 'none' }}
        >
          Back
        </Button>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            position: 'relative',
            display: 'inline-block',
            pb: 1,
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 60,
              height: 4,
              backgroundColor: 'primary.main',
            },
          }}
        >
          Execution History
        </Typography>
      </Box>

      {schedule && (
        <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
          {schedule.name}
        </Typography>
      )}

      {/* Filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip
          label="All"
          variant={filter === null ? 'filled' : 'outlined'}
          onClick={() => { setFilter(null); setPage(0); }}
          color={filter === null ? 'primary' : 'default'}
          size="small"
        />
        <Chip
          label="Successes Only"
          variant={filter === 'success' ? 'filled' : 'outlined'}
          onClick={() => { setFilter('success'); setPage(0); }}
          color={filter === 'success' ? 'success' : 'default'}
          size="small"
        />
        <Chip
          label="Failures Only"
          variant={filter === 'failure' ? 'filled' : 'outlined'}
          onClick={() => { setFilter('failure'); setPage(0); }}
          color={filter === 'failure' ? 'error' : 'default'}
          size="small"
        />
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Error Category</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Error Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3 }}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, fontStyle: 'italic' }}>
                  No executions found
                </TableCell>
              </TableRow>
            ) : (
              entries.map((exec) => (
                <TableRow
                  key={exec.id}
                  sx={{
                    bgcolor: exec.success ? 'transparent' : 'rgba(160, 82, 45, 0.04)',
                  }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatTime(exec.execution_time)}
                  </TableCell>
                  <TableCell>
                    {exec.success ? (
                      <Chip
                        icon={<CheckCircle sx={{ fontSize: '16px !important' }} />}
                        label="Success"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<CancelIcon sx={{ fontSize: '16px !important' }} />}
                        label="Failed"
                        color="error"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={exec.execution_type}
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell>{formatDuration(exec.duration_ms)}</TableCell>
                  <TableCell>
                    {exec.error_category && (
                      <Chip
                        label={CATEGORY_TITLES[exec.error_category] || exec.error_category}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          bgcolor: 'transparent',
                          border: '1px solid',
                          borderColor: CATEGORY_COLORS[exec.error_category] || '#888',
                          color: CATEGORY_COLORS[exec.error_category] || '#888',
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>
                    {exec.error_message && (
                      <Tooltip title={exec.error_message} placement="top-start">
                        <Typography
                          variant="caption"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            color: 'text.secondary',
                          }}
                        >
                          {exec.error_message}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {total > PAGE_SIZE && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      )}
    </Box>
  );
}
