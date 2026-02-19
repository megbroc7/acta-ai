import { useState, Fragment } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
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
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  KeyboardArrowRight as ExpandRightIcon,
  LockReset as ResetIcon,
} from '@mui/icons-material';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/useAuth';
import ChartCard from './ChartCard';

const TH_SX = {
  fontWeight: 800,
  textTransform: 'uppercase',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
};

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusColor(status) {
  const map = {
    draft: 'default',
    pending_review: 'warning',
    published: 'success',
    rejected: 'error',
  };
  return map[status] || 'default';
}

// --- Detail Row (lazy-loaded) ---

function UserDetailRow({ userId, colSpan }) {
  const { data, isLoading } = useQuery({
    queryKey: ['adminUserDetail', userId],
    queryFn: () => api.get(`/admin/users/${userId}/detail`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} sx={{ py: 3, textAlign: 'center' }}>
          <CircularProgress size={24} sx={{ color: 'primary.main' }} />
        </TableCell>
      </TableRow>
    );
  }

  if (!data) return null;

  const sectionTitleSx = {
    fontWeight: 800,
    textTransform: 'uppercase',
    fontSize: '0.7rem',
    letterSpacing: '0.06em',
    mb: 1,
  };

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ py: 2, px: 3, bgcolor: 'rgba(74, 124, 111, 0.03)' }}>
        {/* 4-column grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, minmax(0, 1fr))' },
            gap: 3,
          }}
        >
          {/* Sites */}
          <Box>
            <Typography sx={sectionTitleSx}>Sites ({data.sites.length})</Typography>
            {data.sites.length === 0 ? (
              <Typography variant="caption" color="text.secondary">None</Typography>
            ) : (
              data.sites.map((s, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                  <Chip label={s.platform} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                  {!s.is_active && (
                    <Chip label="Inactive" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
              ))
            )}
          </Box>

          {/* Templates */}
          <Box>
            <Typography sx={sectionTitleSx}>Templates ({data.templates.length})</Typography>
            {data.templates.length === 0 ? (
              <Typography variant="caption" color="text.secondary">None</Typography>
            ) : (
              data.templates.map((t, i) => (
                <Box key={i} sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                  {t.industry && (
                    <Typography variant="caption" color="text.secondary">{t.industry}</Typography>
                  )}
                </Box>
              ))
            )}
          </Box>

          {/* Schedules */}
          <Box>
            <Typography sx={sectionTitleSx}>Schedules ({data.schedules.length})</Typography>
            {data.schedules.length === 0 ? (
              <Typography variant="caption" color="text.secondary">None</Typography>
            ) : (
              data.schedules.map((s, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                  <Chip label={s.frequency} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                  {s.is_active ? (
                    <Chip label="Active" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                  ) : (
                    <Chip label="Paused" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
              ))
            )}
          </Box>

          {/* Recent Posts */}
          <Box>
            <Typography sx={sectionTitleSx}>Recent Posts ({data.recent_posts.length})</Typography>
            {data.recent_posts.length === 0 ? (
              <Typography variant="caption" color="text.secondary">None</Typography>
            ) : (
              data.recent_posts.map((p, i) => (
                <Box key={i} sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                    {p.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={p.status.replace('_', ' ')}
                      size="small"
                      color={statusColor(p.status)}
                      sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(p.created_at)}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* Recent errors */}
        {data.recent_errors.length > 0 && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ ...sectionTitleSx, color: 'error.main' }}>
              Recent Errors ({data.recent_errors.length})
            </Typography>
            {data.recent_errors.map((e, i) => (
              <Box
                key={i}
                sx={{
                  mb: 1,
                  p: 1.5,
                  bgcolor: 'rgba(160, 82, 45, 0.06)',
                  border: '1px solid',
                  borderColor: 'rgba(160, 82, 45, 0.15)',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {formatDate(e.execution_time)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25, fontSize: '0.8rem' }}>
                  {e.error_message || 'No error message recorded'}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </TableCell>
    </TableRow>
  );
}

// --- Main Component ---

export default function UserManagement({ data }) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [expandedUser, setExpandedUser] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null); // user object or null
  const [resetDialog, setResetDialog] = useState(null); // user object or null
  const [tempPassword, setTempPassword] = useState(null); // { email, password } or null

  // --- Mutations ---

  const toggleActiveMutation = useMutation({
    mutationFn: (userId) => api.patch(`/admin/users/${userId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      enqueueSnackbar('User status updated', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to update status', { variant: 'error' });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: (userId) => api.patch(`/admin/users/${userId}/toggle-admin`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      enqueueSnackbar('User role updated', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to update role', { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      setDeleteDialog(null);
      enqueueSnackbar('User deleted', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to delete user', { variant: 'error' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId) => api.post(`/admin/users/${userId}/reset-password`),
    onSuccess: (res) => {
      setResetDialog(null);
      setTempPassword({
        email: resetDialog?.email,
        password: res.data.temporary_password,
      });
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to reset password', { variant: 'error' });
    },
  });

  if (!data?.length) {
    return <ChartCard title="User Management"><em>No users yet</em></ChartCard>;
  }

  const isSelf = (userId) => currentUser?.id === userId;
  const colSpan = 8;

  return (
    <ChartCard title="User Management" sx={{ gridColumn: '1 / -1' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...TH_SX, width: 40 }} />
              <TableCell sx={TH_SX}>User</TableCell>
              <TableCell align="center" sx={TH_SX}>Status</TableCell>
              <TableCell align="center" sx={TH_SX}>Role</TableCell>
              <TableCell align="center" sx={{ ...TH_SX, display: { xs: 'none', sm: 'table-cell' } }}>Sites</TableCell>
              <TableCell align="center" sx={{ ...TH_SX, display: { xs: 'none', sm: 'table-cell' } }}>Templates</TableCell>
              <TableCell align="center" sx={{ ...TH_SX, display: { xs: 'none', sm: 'table-cell' } }}>Posts</TableCell>
              <TableCell align="center" sx={TH_SX}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((u) => {
              const isExpanded = expandedUser === u.id;
              const self = isSelf(u.id);

              return (
                <Fragment key={u.id}>
                  <TableRow hover sx={self ? { bgcolor: 'rgba(74, 124, 111, 0.04)' } : undefined}>
                    {/* Expand */}
                    <TableCell sx={{ width: 40, px: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      >
                        {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ExpandRightIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>

                    {/* User info */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.full_name}
                        {self && (
                          <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'primary.main', fontWeight: 700 }}>
                            (you)
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                    </TableCell>

                    {/* Status chip */}
                    <TableCell align="center">
                      <Tooltip title={self ? "Cannot change your own status" : `Click to ${u.is_active ? 'deactivate' : 'activate'}`}>
                        <span>
                          <Chip
                            label={u.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            onClick={self ? undefined : () => toggleActiveMutation.mutate(u.id)}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              cursor: self ? 'default' : 'pointer',
                              bgcolor: u.is_active ? 'rgba(74, 124, 111, 0.12)' : 'rgba(160, 82, 45, 0.12)',
                              color: u.is_active ? 'primary.main' : 'error.main',
                              border: '1px solid',
                              borderColor: u.is_active ? 'rgba(74, 124, 111, 0.3)' : 'rgba(160, 82, 45, 0.3)',
                              '&:hover': self ? {} : {
                                bgcolor: u.is_active ? 'rgba(160, 82, 45, 0.12)' : 'rgba(74, 124, 111, 0.12)',
                              },
                            }}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>

                    {/* Role chip */}
                    <TableCell align="center">
                      <Tooltip title={self ? "Cannot change your own role" : `Click to ${u.is_admin ? 'demote' : 'promote'}`}>
                        <span>
                          <Chip
                            label={u.is_admin ? 'Admin' : 'User'}
                            size="small"
                            onClick={self ? undefined : () => toggleAdminMutation.mutate(u.id)}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              cursor: self ? 'default' : 'pointer',
                              bgcolor: u.is_admin ? 'rgba(176, 141, 87, 0.15)' : 'rgba(0, 0, 0, 0.06)',
                              color: u.is_admin ? 'warning.main' : 'text.secondary',
                              border: '1px solid',
                              borderColor: u.is_admin ? 'rgba(176, 141, 87, 0.35)' : 'rgba(0, 0, 0, 0.12)',
                              '&:hover': self ? {} : {
                                bgcolor: u.is_admin ? 'rgba(0, 0, 0, 0.06)' : 'rgba(176, 141, 87, 0.15)',
                              },
                            }}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>

                    {/* Counts */}
                    <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{u.sites}</TableCell>
                    <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{u.templates}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'table-cell' } }}>{u.posts}</TableCell>

                    {/* Actions */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="Reset Password">
                          <IconButton size="small" onClick={() => setResetDialog(u)}>
                            <ResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={self ? "Cannot delete yourself" : "Delete User"}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={self}
                              onClick={() => setDeleteDialog(u)}
                              sx={{ color: self ? undefined : 'error.main' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Expandable detail row */}
                  {isExpanded && <UserDetailRow userId={u.id} colSpan={colSpan} />}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        PaperProps={{ sx: { borderRadius: 0, maxWidth: 440 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '1rem' }}>
          Delete User
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete <strong>{deleteDialog?.full_name}</strong> ({deleteDialog?.email})
            and all their sites, templates, schedules, and posts. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(null)} sx={{ borderRadius: 0 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteMutation.mutate(deleteDialog?.id)}
            disabled={deleteMutation.isPending}
            sx={{ borderRadius: 0 }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password confirmation dialog */}
      <Dialog
        open={!!resetDialog}
        onClose={() => setResetDialog(null)}
        PaperProps={{ sx: { borderRadius: 0, maxWidth: 440 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '1rem' }}>
          Reset Password
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Generate a temporary password for <strong>{resetDialog?.full_name}</strong> ({resetDialog?.email})?
            Their current password will stop working immediately.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialog(null)} sx={{ borderRadius: 0 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => resetPasswordMutation.mutate(resetDialog?.id)}
            disabled={resetPasswordMutation.isPending}
            sx={{ borderRadius: 0 }}
          >
            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Temp password result dialog */}
      <Dialog
        open={!!tempPassword}
        onClose={() => setTempPassword(null)}
        PaperProps={{ sx: { borderRadius: 0, maxWidth: 480 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '1rem' }}>
          Temporary Password
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Send this password to <strong>{tempPassword?.email}</strong>. They should change it after logging in.
          </DialogContentText>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 2,
              bgcolor: 'rgba(74, 124, 111, 0.06)',
              border: '1px solid',
              borderColor: 'divider',
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700 }}>
              {tempPassword?.password}
            </Typography>
            <Tooltip title="Copy to clipboard">
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword?.password || '');
                  enqueueSnackbar('Copied to clipboard', { variant: 'success' });
                }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setTempPassword(null)} sx={{ borderRadius: 0 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </ChartCard>
  );
}
