import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';
import api from '../../../services/api';
import ChartCard from './ChartCard';

const TH_SX = {
  fontWeight: 800,
  textTransform: 'uppercase',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
};

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const PAGE_SIZE = 20;

function formatTimestamp(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ErrorLog() {
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['adminErrors', days, offset],
    queryFn: () =>
      api
        .get(`/admin/errors?days=${days}&limit=${PAGE_SIZE}&offset=${offset}`)
        .then((r) => r.data),
  });

  const total = data?.total ?? 0;
  const entries = data?.entries ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ChartCard
      title="Error Log"
      sx={{
        gridColumn: '1 / -1',
        borderColor: total > 0 ? 'rgba(160, 82, 45, 0.3)' : undefined,
      }}
    >
      {/* Controls row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FormControl size="small">
            <Select
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setPage(0);
              }}
              sx={{ borderRadius: 0, fontWeight: 600, fontSize: '0.8rem', minWidth: 100 }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {total > 0 && (
            <Chip
              label={`${total} error${total !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                bgcolor: 'rgba(160, 82, 45, 0.12)',
                color: 'error.main',
                border: '1px solid',
                borderColor: 'rgba(160, 82, 45, 0.25)',
              }}
            />
          )}
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 0.5 }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </Typography>
            <IconButton size="small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <PrevIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <NextIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: 'primary.main' }} />
        </Box>
      )}

      {!isLoading && entries.length === 0 && (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No errors in the last {days} days
          </Typography>
        </Box>
      )}

      {!isLoading && entries.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={TH_SX}>Time</TableCell>
                <TableCell sx={TH_SX}>User</TableCell>
                <TableCell sx={TH_SX}>Schedule</TableCell>
                <TableCell sx={TH_SX}>Type</TableCell>
                <TableCell sx={TH_SX}>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {formatTimestamp(e.execution_time)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.user_full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{e.user_email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.schedule_name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={e.execution_type}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip
                      title={e.error_message || 'No details'}
                      placement="top-start"
                      slotProps={{
                        tooltip: {
                          sx: {
                            maxWidth: 500,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            whiteSpace: 'pre-wrap',
                            borderRadius: 0,
                          },
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.8rem',
                          color: 'error.main',
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                        }}
                      >
                        {e.error_message || 'No error message recorded'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ChartCard>
  );
}
