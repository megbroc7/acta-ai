import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  CircularProgress,
} from '@mui/material';
import api from '../../../services/api';

const COLUMNS = [
  { id: 'full_name', label: 'User', align: 'left' },
  { id: 'total_executions', label: 'Executions', align: 'right' },
  { id: 'total_tokens', label: 'Tokens', align: 'right' },
  { id: 'text_cost_usd', label: 'Text Cost', align: 'right' },
  { id: 'image_cost_usd', label: 'Image Cost', align: 'right' },
  { id: 'total_cost_usd', label: 'Total', align: 'right' },
];

function fmt(val) {
  return `$${val.toFixed(4)}`;
}

function fmtTokens(val) {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

export default function UserCostBreakdown({ days }) {
  const [orderBy, setOrderBy] = useState('total_cost_usd');
  const [order, setOrder] = useState('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['userCosts', days],
    queryFn: () => api.get(`/admin/user-costs?days=${days}`).then((r) => r.data),
  });

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrder('desc');
    }
  };

  const sorted = data
    ? [...data].sort((a, b) => {
        const aVal = a[orderBy] ?? 0;
        const bVal = b[orderBy] ?? 0;
        if (typeof aVal === 'string') {
          return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      })
    : [];

  // Footer totals
  const totals = (data || []).reduce(
    (acc, row) => ({
      executions: acc.executions + row.total_executions,
      tokens: acc.tokens + row.total_tokens,
      text: acc.text + row.text_cost_usd,
      image: acc.image + row.image_cost_usd,
      total: acc.total + row.total_cost_usd,
    }),
    { executions: 0, tokens: 0, text: 0, image: 0, total: 0 },
  );

  const topSpender = sorted.length > 0 ? sorted[0]?.user_id : null;

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}
    >
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.85rem' }}
        >
          Per-User Cost Breakdown
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: 'primary.main' }} />
        </Box>
      ) : !data?.length ? (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No execution data for this period
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align}
                  sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}
                >
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : 'desc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => (
              <TableRow
                key={row.user_id}
                sx={{
                  ...(orderBy === 'total_cost_usd' && row.user_id === topSpender
                    ? { bgcolor: 'rgba(176, 141, 87, 0.08)' }
                    : {}),
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.full_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {row.email}
                  </Typography>
                </TableCell>
                <TableCell align="right">{row.total_executions}</TableCell>
                <TableCell align="right">{fmtTokens(row.total_tokens)}</TableCell>
                <TableCell align="right">{fmt(row.text_cost_usd)}</TableCell>
                <TableCell align="right">{fmt(row.image_cost_usd)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#B08D57' }}>
                  {fmt(row.total_cost_usd)}
                </TableCell>
              </TableRow>
            ))}
            {/* Footer totals */}
            <TableRow sx={{ bgcolor: 'rgba(74, 124, 111, 0.06)' }}>
              <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                Total
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{totals.executions}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtTokens(totals.tokens)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(totals.text)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(totals.image)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800, color: '#B08D57' }}>{fmt(totals.total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
