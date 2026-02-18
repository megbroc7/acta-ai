import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import api from '../../services/api';

const TIER_COLORS = {
  imperator: { bg: 'rgba(74, 124, 111, 0.12)', color: '#2D5E4A', label: 'Imperator' },
  tribune: { bg: 'rgba(176, 141, 87, 0.12)', color: '#8B6914', label: 'Tribune' },
  scriptor: { bg: 'rgba(0, 0, 0, 0.06)', color: '#666', label: 'Scriptor' },
};

const STATUS_CHIPS = {
  active: { color: 'success', label: 'Active' },
  trialing: { color: 'info', label: 'Trialing' },
  past_due: { color: 'warning', label: 'Past Due' },
  canceled: { color: 'default', label: 'Canceled' },
  unpaid: { color: 'error', label: 'Unpaid' },
};

function TierBadge({ tier }) {
  if (!tier) return <Typography variant="body2" color="text.secondary">--</Typography>;
  const cfg = TIER_COLORS[tier] || TIER_COLORS.scriptor;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: cfg.bg,
        color: cfg.color,
        fontWeight: 700,
        fontSize: '0.75rem',
        borderRadius: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    />
  );
}

function StatusChip({ status }) {
  if (!status) return <Typography variant="body2" color="text.secondary">--</Typography>;
  const cfg = STATUS_CHIPS[status] || { color: 'default', label: status };
  return <Chip label={cfg.label} color={cfg.color} size="small" sx={{ borderRadius: 0, fontWeight: 600 }} />;
}

export default function AdminBilling() {
  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: ['adminSubscriptions'],
    queryFn: () => api.get('/admin/subscriptions').then(r => r.data),
  });

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          position: 'relative',
          display: 'inline-block',
          mb: 4,
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
        Subscriptions
      </Typography>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ borderRadius: 0, mb: 3 }}>
          Failed to load subscription data.
        </Alert>
      )}

      {subscriptions && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E0DCD5', borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(74, 124, 111, 0.04)' }}>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Plan</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Effective Tier</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Period End</TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Trial</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.map((row) => (
                <TableRow key={row.user_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                  </TableCell>
                  <TableCell><TierBadge tier={row.subscription_tier} /></TableCell>
                  <TableCell><TierBadge tier={row.effective_tier} /></TableCell>
                  <TableCell><StatusChip status={row.subscription_status} /></TableCell>
                  <TableCell>
                    {row.current_period_end
                      ? new Date(row.current_period_end).toLocaleDateString()
                      : '--'}
                    {row.cancel_at_period_end && (
                      <Chip
                        label="Canceling"
                        size="small"
                        sx={{
                          ml: 1,
                          borderRadius: 0,
                          bgcolor: 'rgba(160, 82, 45, 0.1)',
                          color: '#A0522D',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.trial_active ? (
                      <Chip
                        label={`Ends ${new Date(row.trial_ends_at).toLocaleDateString()}`}
                        size="small"
                        color="info"
                        sx={{ borderRadius: 0, fontWeight: 600 }}
                      />
                    ) : row.trial_ends_at ? (
                      <Typography variant="caption" color="text.secondary">
                        Expired {new Date(row.trial_ends_at).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">--</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No users found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
