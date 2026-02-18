import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person as ProfileIcon,
  BarChart as UsageIcon,
  DeleteForever as DeleteIcon,
  Download as DownloadIcon,
  Gavel as LegalIcon,
  WorkspacePremium as PlanIcon,
  Check as CheckIcon,
  OpenInNew as ExternalIcon,
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

// ---------------------------------------------------------------------------
// Tier definitions (mirrors backend TIER_LIMITS)
// ---------------------------------------------------------------------------

const TIERS = [
  {
    key: 'scriptor',
    name: 'Scriptor',
    price: 29,
    features: [
      '1 connected site',
      '3 prompt templates',
      '2 active schedules',
      'Unsplash images',
      'Basic content pipeline',
    ],
    excluded: ['Review Queue', 'Match My Writing Style', 'Revise with AI', 'DALL-E images'],
  },
  {
    key: 'tribune',
    name: 'Tribune',
    price: 79,
    popular: true,
    features: [
      '3 connected sites',
      '15 prompt templates',
      '10 active schedules',
      'Unsplash + DALL-E images',
      'Review Queue workflow',
      'Match My Writing Style',
      'Revise with AI',
    ],
    excluded: ['WordPress Pending Review', 'HD DALL-E images'],
  },
  {
    key: 'imperator',
    name: 'Imperator',
    price: 249,
    features: [
      '10 connected sites',
      'Unlimited templates',
      'Unlimited schedules',
      'HD DALL-E images',
      'Review Queue workflow',
      'Match My Writing Style',
      'Revise with AI',
      'WordPress Pending Review',
    ],
    excluded: [],
  },
];

function UsageBar({ label, used, limit }) {
  const isUnlimited = limit === null || limit === undefined;
  const pct = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const atLimit = !isUnlimited && used >= limit;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', fontSize: '0.75rem' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', color: atLimit ? 'error.main' : 'text.secondary' }}>
          {used} / {isUnlimited ? '\u221E' : limit}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={isUnlimited ? 0 : pct}
        sx={{
          height: 8,
          borderRadius: 0,
          bgcolor: 'rgba(0,0,0,0.06)',
          '& .MuiLinearProgress-bar': {
            bgcolor: atLimit ? 'error.main' : 'primary.main',
            borderRadius: 0,
          },
        }}
      />
    </Box>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // ── Subscription / Billing ──
  const { data: tierInfo, isLoading: tierLoading } = useQuery({
    queryKey: ['tierInfo'],
    queryFn: () => api.get('/billing/tier-info').then((r) => r.data),
  });

  // Handle Stripe redirect success/cancel params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      enqueueSnackbar('Subscription activated! Welcome aboard.', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tierInfo'] });
      navigate('/settings', { replace: true });
    } else if (params.get('canceled') === 'true') {
      enqueueSnackbar('Checkout canceled. No changes were made.', { variant: 'info' });
      navigate('/settings', { replace: true });
    }
  }, [location.search, enqueueSnackbar, navigate, queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: (tier) =>
      api.post('/billing/create-checkout-session', {
        tier,
        success_url: `${window.location.origin}/settings?success=true`,
        cancel_url: `${window.location.origin}/settings?canceled=true`,
      }),
    onSuccess: (res) => {
      window.location.href = res.data.checkout_url;
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to start checkout', { variant: 'error' });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () =>
      api.post('/billing/create-portal-session', {
        return_url: `${window.location.origin}/settings`,
      }),
    onSuccess: (res) => {
      window.location.href = res.data.portal_url;
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to open billing portal', { variant: 'error' });
    },
  });

  const effectiveTier = tierInfo?.effective_tier;
  const isTrial = tierInfo?.trial_active;
  const hasSubscription = !!tierInfo?.subscription_tier;
  const tierUsage = tierInfo?.usage || { sites: 0, templates: 0, schedules: 0 };
  const limits = tierInfo?.limits;
  const subscription = tierInfo?.subscription;

  const trialDaysLeft = isTrial && tierInfo?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tierInfo.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  const getButtonProps = (tierKey) => {
    if (tierKey === effectiveTier && hasSubscription) {
      return { label: 'Current Plan', disabled: true, variant: 'outlined' };
    }
    if (tierKey === effectiveTier && isTrial) {
      return { label: 'Subscribe', disabled: false, variant: 'contained' };
    }
    if (!hasSubscription) {
      return { label: 'Subscribe', disabled: false, variant: 'contained' };
    }
    const tierOrder = ['scriptor', 'tribune', 'imperator'];
    const currentIdx = tierOrder.indexOf(effectiveTier);
    const targetIdx = tierOrder.indexOf(tierKey);
    if (targetIdx > currentIdx) {
      return { label: 'Upgrade', disabled: false, variant: 'contained' };
    }
    return { label: 'Manage Plan', disabled: false, variant: 'outlined', portal: true };
  };

  const handleTierAction = (tierKey, portal) => {
    if (portal) {
      portalMutation.mutate();
    } else {
      checkoutMutation.mutate(tierKey);
    }
  };

  const tierDisplayName = TIERS.find((t) => t.key === effectiveTier)?.name || effectiveTier || 'None';

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
        Manage your subscription, profile, and account.
      </Typography>

      {/* ── Subscription Section ── */}
      <Card sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<PlanIcon sx={{ color: 'primary.main' }} />} title="Subscription" />

          {tierLoading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              {/* Trial alert */}
              {isTrial && (
                <Alert
                  severity="info"
                  sx={{ mb: 3, borderRadius: 0, border: '1px solid', borderColor: 'primary.main', bgcolor: 'rgba(74, 124, 111, 0.04)' }}
                >
                  You are on a <strong>14-day Tribune trial</strong> with {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining.
                  Subscribe to keep your access after the trial ends.
                </Alert>
              )}

              {/* Expired trial */}
              {!effectiveTier && (
                <Alert
                  severity="warning"
                  sx={{ mb: 3, borderRadius: 0, border: '2px solid #A0522D', bgcolor: 'rgba(160, 82, 45, 0.06)', '& .MuiAlert-icon': { color: '#A0522D' } }}
                >
                  Your trial has ended. Subscribe to a plan to continue creating content and managing your sites.
                </Alert>
              )}

              {/* Current plan badge + usage */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Chip
                  label={tierDisplayName}
                  sx={{
                    fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.85rem',
                    bgcolor: effectiveTier ? 'primary.main' : 'text.disabled', color: '#fff', borderRadius: 0, height: 32,
                  }}
                />
                {isTrial && (
                  <Chip
                    label={`Trial \u2014 ${trialDaysLeft}d left`}
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: 'rgba(176, 141, 87, 0.12)', color: '#B08D57', borderRadius: 0, border: '1px solid #B08D57' }}
                  />
                )}
                {subscription?.cancel_at_period_end && (
                  <Chip
                    label="Cancels at period end"
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: 'rgba(160, 82, 45, 0.08)', color: '#A0522D', borderRadius: 0, border: '1px solid #A0522D' }}
                  />
                )}
              </Box>

              {limits && (
                <Box sx={{ maxWidth: 400, mb: 2 }}>
                  <UsageBar label="Sites" used={tierUsage.sites} limit={limits.sites} />
                  <UsageBar label="Templates" used={tierUsage.templates} limit={limits.templates} />
                  <UsageBar label="Schedules" used={tierUsage.schedules} limit={limits.schedules} />
                </Box>
              )}

              {hasSubscription && (
                <Button
                  variant="outlined"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  endIcon={<ExternalIcon fontSize="small" />}
                  sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}
                >
                  {portalMutation.isPending ? 'Opening...' : 'Manage Subscription'}
                </Button>
              )}

              {subscription?.current_period_end && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  {subscription.cancel_at_period_end
                    ? `Your subscription ends on ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
                    : `Next billing date: ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`}
                </Typography>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Plan comparison */}
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Choose Your Plan
              </Typography>

              <Grid container spacing={2}>
                {TIERS.map((tier) => {
                  const isCurrent = tier.key === effectiveTier && hasSubscription;
                  const btnProps = getButtonProps(tier.key);

                  return (
                    <Grid item xs={12} sm={4} key={tier.key}>
                      <Card
                        sx={{
                          height: '100%', display: 'flex', flexDirection: 'column',
                          border: isCurrent ? '2px solid' : '1px solid',
                          borderColor: isCurrent ? 'primary.main' : 'divider',
                          borderRadius: 0, boxShadow: 'none', position: 'relative', overflow: 'visible',
                        }}
                      >
                        {tier.popular && (
                          <Box
                            sx={{
                              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                              bgcolor: '#B08D57', color: '#fff', px: 2, py: 0.25,
                              fontWeight: 900, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
                            }}
                          >
                            Most Popular
                          </Box>
                        )}
                        <CardContent sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5, textAlign: 'center' }}>
                            {tier.name}
                          </Typography>
                          <Box sx={{ textAlign: 'center', mb: 2 }}>
                            <Typography component="span" sx={{ fontWeight: 900, fontSize: '2rem', lineHeight: 1, color: 'primary.main', fontFamily: '"Inter", sans-serif' }}>
                              ${tier.price}
                            </Typography>
                            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.8rem', ml: 0.5 }}>
                              /mo
                            </Typography>
                          </Box>
                          <Box sx={{ flexGrow: 1, mb: 2 }}>
                            {tier.features.map((feat) => (
                              <Box key={feat} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                                <CheckIcon sx={{ fontSize: 16, color: 'primary.main', mt: '2px', flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{feat}</Typography>
                              </Box>
                            ))}
                            {tier.excluded.map((feat) => (
                              <Box key={feat} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5, opacity: 0.4 }}>
                                <Typography sx={{ fontSize: 16, lineHeight: '16px', mt: '2px', flexShrink: 0 }}>&mdash;</Typography>
                                <Typography variant="body2" sx={{ fontSize: '0.8rem', textDecoration: 'line-through' }}>{feat}</Typography>
                              </Box>
                            ))}
                          </Box>
                          <Button
                            variant={btnProps.variant}
                            disabled={btnProps.disabled || checkoutMutation.isPending || portalMutation.isPending}
                            onClick={() => handleTierAction(tier.key, btnProps.portal)}
                            fullWidth
                            size="small"
                            sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', py: 1 }}
                          >
                            {(checkoutMutation.isPending || portalMutation.isPending) && !btnProps.disabled
                              ? 'Redirecting...'
                              : btnProps.label}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </CardContent>
      </Card>

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
