import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  WorkspacePremium as PlanIcon,
  Check as CheckIcon,
  OpenInNew as ExternalIcon,
} from '@mui/icons-material';
import api from '../../services/api';

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

// ---------------------------------------------------------------------------
// Section header (matches Settings.jsx)
// ---------------------------------------------------------------------------

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
// Usage bar
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Billing() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Tier info query
  const { data: tierInfo, isLoading } = useQuery({
    queryKey: ['tierInfo'],
    queryFn: () => api.get('/billing/tier-info').then((r) => r.data),
  });

  // Handle success/cancel URL params from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      enqueueSnackbar('Subscription activated! Welcome aboard.', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tierInfo'] });
      navigate('/billing', { replace: true });
    } else if (params.get('canceled') === 'true') {
      enqueueSnackbar('Checkout canceled. No changes were made.', { variant: 'info' });
      navigate('/billing', { replace: true });
    }
  }, [location.search, enqueueSnackbar, navigate, queryClient]);

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: (tier) =>
      api.post('/billing/create-checkout-session', {
        tier,
        success_url: `${window.location.origin}/billing?success=true`,
        cancel_url: `${window.location.origin}/billing?canceled=true`,
      }),
    onSuccess: (res) => {
      window.location.href = res.data.checkout_url;
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to start checkout', { variant: 'error' });
    },
  });

  // Portal mutation
  const portalMutation = useMutation({
    mutationFn: () =>
      api.post('/billing/create-portal-session', {
        return_url: `${window.location.origin}/billing`,
      }),
    onSuccess: (res) => {
      window.location.href = res.data.portal_url;
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to open billing portal', { variant: 'error' });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto', display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const effectiveTier = tierInfo?.effective_tier;
  const isTrial = tierInfo?.trial_active;
  const hasSubscription = !!tierInfo?.subscription_tier;
  const usage = tierInfo?.usage || { sites: 0, templates: 0, schedules: 0 };
  const limits = tierInfo?.limits;
  const subscription = tierInfo?.subscription;

  // Trial days remaining
  const trialDaysLeft = isTrial && tierInfo?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tierInfo.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Button logic for tier cards
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
    // Has subscription — changes go through portal
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

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
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
        Subscription
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2, mb: 4 }}>
        Manage your subscription plan and billing.
      </Typography>

      {/* Trial alert */}
      {isTrial && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            borderRadius: 0,
            border: '1px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(74, 124, 111, 0.04)',
          }}
        >
          You are on a <strong>14-day Tribune trial</strong> with {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining.
          Subscribe to keep your access after the trial ends.
        </Alert>
      )}

      {/* No subscription or trial */}
      {!effectiveTier && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            borderRadius: 0,
            border: '2px solid #A0522D',
            bgcolor: 'rgba(160, 82, 45, 0.06)',
            '& .MuiAlert-icon': { color: '#A0522D' },
          }}
        >
          Your trial has ended. Subscribe to a plan to continue creating content and managing your sites.
        </Alert>
      )}

      {/* ── Current Plan Card ── */}
      <Card sx={{ mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: 0, boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <SectionHeader icon={<PlanIcon sx={{ color: 'primary.main' }} />} title="Current Plan" />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Chip
              label={tierDisplayName}
              sx={{
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '0.85rem',
                bgcolor: effectiveTier ? 'primary.main' : 'text.disabled',
                color: '#fff',
                borderRadius: 0,
                height: 32,
              }}
            />
            {isTrial && (
              <Chip
                label={`Trial \u2014 ${trialDaysLeft}d left`}
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: 'rgba(176, 141, 87, 0.12)',
                  color: '#B08D57',
                  borderRadius: 0,
                  border: '1px solid #B08D57',
                }}
              />
            )}
            {subscription?.cancel_at_period_end && (
              <Chip
                label="Cancels at period end"
                size="small"
                sx={{
                  fontWeight: 700,
                  bgcolor: 'rgba(160, 82, 45, 0.08)',
                  color: '#A0522D',
                  borderRadius: 0,
                  border: '1px solid #A0522D',
                }}
              />
            )}
          </Box>

          {/* Usage bars */}
          {limits && (
            <Box sx={{ maxWidth: 400 }}>
              <UsageBar label="Sites" used={usage.sites} limit={limits.sites} />
              <UsageBar label="Templates" used={usage.templates} limit={limits.templates} />
              <UsageBar label="Schedules" used={usage.schedules} limit={limits.schedules} />
            </Box>
          )}

          {/* Manage subscription button */}
          {hasSubscription && (
            <Button
              variant="outlined"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              endIcon={<ExternalIcon fontSize="small" />}
              sx={{ mt: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {portalMutation.isPending ? 'Opening...' : 'Manage Subscription'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Plan Comparison ── */}
      <Typography
        variant="h6"
        sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 3 }}
      >
        Choose Your Plan
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {TIERS.map((tier) => {
          const isCurrent = tier.key === effectiveTier && hasSubscription;
          const btnProps = getButtonProps(tier.key);

          return (
            <Grid item xs={12} md={4} key={tier.key}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: isCurrent ? '2px solid' : '1px solid',
                  borderColor: isCurrent ? 'primary.main' : 'divider',
                  borderRadius: 0,
                  boxShadow: 'none',
                  position: 'relative',
                  overflow: 'visible',
                }}
              >
                {/* Popular badge */}
                {tier.popular && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: '#B08D57',
                      color: '#fff',
                      px: 2,
                      py: 0.25,
                      fontWeight: 900,
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Most Popular
                  </Box>
                )}

                <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Tier name */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      mb: 1,
                      textAlign: 'center',
                    }}
                  >
                    {tier.name}
                  </Typography>

                  {/* Price */}
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography
                      component="span"
                      sx={{
                        fontWeight: 900,
                        fontSize: '2.5rem',
                        lineHeight: 1,
                        color: 'primary.main',
                        fontFamily: '"Inter", sans-serif',
                      }}
                    >
                      ${tier.price}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ color: 'text.secondary', fontSize: '0.85rem', ml: 0.5 }}
                    >
                      /month
                    </Typography>
                  </Box>

                  {/* Features */}
                  <Box sx={{ flexGrow: 1, mb: 3 }}>
                    {tier.features.map((feat) => (
                      <Box key={feat} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                        <CheckIcon sx={{ fontSize: 18, color: 'primary.main', mt: '2px', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {feat}
                        </Typography>
                      </Box>
                    ))}
                    {tier.excluded.map((feat) => (
                      <Box key={feat} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, opacity: 0.4 }}>
                        <Typography sx={{ fontSize: 18, lineHeight: '18px', mt: '2px', flexShrink: 0 }}>&mdash;</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', textDecoration: 'line-through' }}>
                          {feat}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Action button */}
                  <Button
                    variant={btnProps.variant}
                    disabled={btnProps.disabled || checkoutMutation.isPending || portalMutation.isPending}
                    onClick={() => handleTierAction(tier.key, btnProps.portal)}
                    fullWidth
                    sx={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      py: 1.2,
                    }}
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

      {/* Subscription info */}
      {subscription?.current_period_end && (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mb: 4 }}>
          {subscription.cancel_at_period_end
            ? `Your subscription ends on ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
            : `Next billing date: ${new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`}
        </Typography>
      )}
    </Box>
  );
}
