import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Grid,
  MenuItem,
  IconButton,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as ProfileIcon,
  BarChart as UsageIcon,
  DeleteForever as DeleteIcon,
  Download as DownloadIcon,
  Gavel as LegalIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const TIMEZONES = [
  'UTC',
  'US/Eastern',
  'US/Central',
  'US/Mountain',
  'US/Pacific',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Toronto',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Mexico_City',
];

function SectionHeader({ icon, title }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(74, 124, 111, 0.08)',
          border: '1px solid',
          borderColor: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </Typography>
    </Box>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Usage summary query
  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['usageSummary'],
    queryFn: () => api.get('/settings/usage').then((r) => r.data),
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/settings/profile', data),
    onSuccess: (res) => {
      setUser(res.data);
      enqueueSnackbar('Profile updated', { variant: 'success' });
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to update profile', { variant: 'error' });
    },
  });

  // Password change mutation
  const passwordMutation = useMutation({
    mutationFn: (data) => api.put('/settings/password', data),
    onSuccess: () => {
      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to change password', { variant: 'error' });
    },
  });

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (data) => api.delete('/settings/account', { data }),
    onSuccess: () => {
      enqueueSnackbar('Account deleted', { variant: 'success' });
      logout();
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to delete account', { variant: 'error' });
    },
  });

  const handleDeleteAccount = () => {
    deleteMutation.mutate({ password: deletePassword });
  };

  const [exporting, setExporting] = useState(false);
  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/settings/export-data');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'acta-ai-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Data exported successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to export data', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleProfileSave = () => {
    const updates = {};
    if (fullName !== user?.full_name) updates.full_name = fullName;
    if (email !== user?.email) updates.email = email;
    if (timezone !== user?.timezone) updates.timezone = timezone;

    if (Object.keys(updates).length === 0) {
      enqueueSnackbar('No changes to save', { variant: 'info' });
      return;
    }
    profileMutation.mutate(updates);
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      enqueueSnackbar('New passwords do not match', { variant: 'error' });
      return;
    }
    passwordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const profileDirty =
    fullName !== (user?.full_name || '') ||
    email !== (user?.email || '') ||
    timezone !== (user?.timezone || 'UTC');

  const passwordReady =
    currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0;

  const formatNumber = (n) => (n || 0).toLocaleString();

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Page title */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          mb: 1,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: 0,
            width: '100%',
            height: 4,
            background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
          },
        }}
      >
        Settings
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, mb: 4 }}>
        Manage your profile and review your account usage.
      </Typography>

      {/* ── Profile Section ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<ProfileIcon sx={{ color: 'primary.main' }} />} title="Profile" />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                size="small"
              >
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    {tz}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleProfileSave}
                disabled={!profileDirty || profileMutation.isPending}
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Password change */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Change Password
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Current Password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="New Password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                size="small"
                helperText="Minimum 8 characters"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNew(!showNew)}>
                        {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                size="small"
                error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                helperText={
                  confirmPassword.length > 0 && newPassword !== confirmPassword
                    ? 'Passwords do not match'
                    : ''
                }
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                onClick={handlePasswordChange}
                disabled={!passwordReady || passwordMutation.isPending}
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Usage Summary ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<UsageIcon sx={{ color: 'primary.main' }} />} title="Usage Summary" />

          {usageLoading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Member since{' '}
                {usage?.member_since
                  ? new Date(usage.member_since).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </Typography>

              {/* Posts */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Content
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Total Posts" value={formatNumber(usage?.total_posts)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Published" value={formatNumber(usage?.published_posts)} color="primary.main" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="In Review" value={formatNumber(usage?.pending_review_posts)} color="warning.main" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Drafts" value={formatNumber(usage?.draft_posts)} color="text.secondary" />
                </Grid>
              </Grid>

              {/* Executions */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                AI Executions
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Total Runs" value={formatNumber(usage?.total_executions)} />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Successful" value={formatNumber(usage?.successful_executions)} color="primary.main" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Failed" value={formatNumber(usage?.failed_executions)} color="error.main" />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatBox label="Total Tokens" value={formatNumber(usage?.total_tokens)} />
                </Grid>
              </Grid>

            </>
          )}
        </CardContent>
      </Card>

      {/* ── Data & Privacy ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<DownloadIcon sx={{ color: 'primary.main' }} />} title="Data & Privacy" />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Download a complete copy of all your data in JSON format. This includes your profile,
            sites, templates, schedules, posts, execution history, and feedback.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleExportData}
            disabled={exporting}
            startIcon={<DownloadIcon />}
            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mr: 2 }}
          >
            {exporting ? 'Exporting...' : 'Export My Data'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Legal ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<LegalIcon sx={{ color: 'primary.main' }} />} title="Legal" />
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <MuiLink
              component={Link}
              to="/terms"
              underline="hover"
              sx={{ fontWeight: 600, fontSize: '0.95rem' }}
            >
              Terms of Service
            </MuiLink>
            <MuiLink
              component={Link}
              to="/privacy"
              underline="hover"
              sx={{ fontWeight: 600, fontSize: '0.95rem' }}
            >
              Privacy Policy
            </MuiLink>
          </Box>
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'error.main', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<DeleteIcon sx={{ color: 'error.main' }} />} title="Danger Zone" />
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteOpen(false);
            setDeletePassword('');
            setShowDeletePassword(false);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 0, border: '1px solid', borderColor: 'error.main' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'error.main' }}>
          Delete Account
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>
            This action is permanent and cannot be reversed.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Deleting your account will permanently remove:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>All your connected sites</Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>All prompt templates and experience interviews</Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>All schedules and execution history</Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>All generated blog posts</Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>All notifications and feedback submissions</Typography>
          </Box>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 0 }}>
            Posts already published to your WordPress or Shopify sites will not be removed — only the records within Acta AI.
          </Alert>
          <TextField
            fullWidth
            label="Enter your password to confirm"
            type={showDeletePassword ? 'text' : 'password'}
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            size="small"
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowDeletePassword(!showDeletePassword)}>
                    {showDeletePassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteOpen(false);
              setDeletePassword('');
              setShowDeletePassword(false);
            }}
            disabled={deleteMutation.isPending}
            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            disabled={deletePassword.length === 0 || deleteMutation.isPending}
            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete My Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function StatBox({ label, value, color, highlight }) {
  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: highlight ? 'primary.main' : 'divider',
        bgcolor: highlight ? 'rgba(74, 124, 111, 0.04)' : 'transparent',
        textAlign: 'center',
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 900,
          color: color || 'text.primary',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
    </Box>
  );
}
