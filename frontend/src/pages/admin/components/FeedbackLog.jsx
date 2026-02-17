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
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'general', label: 'General' },
];

const CATEGORY_CHIP_STYLES = {
  bug: { bgcolor: 'rgba(160, 82, 45, 0.12)', color: '#A0522D', borderColor: 'rgba(160, 82, 45, 0.25)' },
  feature: { bgcolor: 'rgba(74, 124, 111, 0.12)', color: '#4A7C6F', borderColor: 'rgba(74, 124, 111, 0.25)' },
  general: { bgcolor: 'rgba(176, 141, 87, 0.12)', color: '#B08D57', borderColor: 'rgba(176, 141, 87, 0.25)' },
};

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

export default function FeedbackLog() {
  const [days, setDays] = useState(90);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['adminFeedback', days, category, offset],
    queryFn: () => {
      let url = `/admin/feedback?days=${days}&limit=${PAGE_SIZE}&offset=${offset}`;
      if (category) url += `&category=${category}`;
      return api.get(url).then((r) => r.data);
    },
  });

  const total = data?.total ?? 0;
  const entries = data?.entries ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ChartCard
      title="Feedback Log"
      sx={{ gridColumn: '1 / -1' }}
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
          <FormControl size="small">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
              sx={{ borderRadius: 0, fontWeight: 600, fontSize: '0.8rem', minWidth: 130 }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {total > 0 && (
            <Chip
              label={`${total} entr${total !== 1 ? 'ies' : 'y'}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                bgcolor: 'rgba(74, 124, 111, 0.12)',
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'rgba(74, 124, 111, 0.25)',
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
            No feedback in the last {days} days
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
                <TableCell sx={TH_SX}>Category</TableCell>
                <TableCell sx={TH_SX}>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => {
                const chipStyle = CATEGORY_CHIP_STYLES[e.category] || CATEGORY_CHIP_STYLES.general;
                return (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {formatTimestamp(e.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.user_full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.user_email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={e.category}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          border: '1px solid',
                          ...chipStyle,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={e.message}
                        placement="top-start"
                        slotProps={{
                          tooltip: {
                            sx: {
                              maxWidth: 500,
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
                            maxWidth: 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'help',
                          }}
                        >
                          {e.message}
                        </Typography>
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
