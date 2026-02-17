import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, CardActions, Grid, Chip, Button, Stack,
  List, ListItem, ListItemText, Divider,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Language, Description, Schedule, Article, Add, ArrowForward,
  AccessTime, Warning, AutoMode,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Keyframe animations (from About page patterns)
// ---------------------------------------------------------------------------

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const countUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(74, 124, 111, 0); }
  50% { box-shadow: 0 0 12px 3px rgba(74, 124, 111, 0.2); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  draft: 'default', pending_review: 'warning', published: 'success', rejected: 'error',
};
const STATUS_LABELS = {
  draft: 'Draft', pending_review: 'Pending Review', published: 'Published', rejected: 'Rejected',
};

const ELASTIC = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date - now;
  const absDiffMs = Math.abs(diffMs);
  const minutes = Math.round(absDiffMs / 60000);
  const hours = Math.round(absDiffMs / 3600000);
  const days = Math.round(absDiffMs / 86400000);

  let label;
  if (minutes < 2) label = 'just now';
  else if (minutes < 60) label = `${minutes}m`;
  else if (hours < 24) label = `${hours}h`;
  else label = `${days}d`;

  if (minutes < 2) return label;
  return diffMs > 0 ? `in ${label}` : `${label} ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }) {
  return (
    <Box sx={{ mb: 3, position: 'relative' }}>
      <Typography
        sx={{
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontSize: '1.15rem',
          color: '#2A2A2A',
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -8,
            left: 0,
            width: '60%',
            height: 3,
            background: 'linear-gradient(90deg, #2A2A2A, transparent)',
          },
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function StatNumber({ value, label, delay, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        textAlign: 'center',
        cursor: 'pointer',
        animation: `${countUp} 0.6s ${delay}s ease-out both`,
        transition: `transform 0.4s ${ELASTIC}`,
        '&:hover': {
          transform: 'scale(1.08)',
        },
        '&:hover .stat-value': {
          background: 'linear-gradient(135deg, #2D5E4A, #B08D57)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
        },
        '&:hover .stat-label': {
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          textDecorationColor: '#B08D57',
        },
        '&:hover .stat-arrow': {
          opacity: 1,
          transform: 'translateX(0)',
        },
      }}
    >
      <Typography
        className="stat-value"
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2.2rem', md: '2.8rem' },
          lineHeight: 1,
          background: 'linear-gradient(135deg, #2D5E4A, #4A7C6F, #6B9E8A)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          letterSpacing: '-0.03em',
          transition: 'all 0.3s ease',
        }}
      >
        {value}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <Typography
          className="stat-label"
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#B08D57',
            fontSize: '0.7rem',
            transition: 'all 0.3s ease',
          }}
        >
          {label}
        </Typography>
        <ArrowForward
          className="stat-arrow"
          sx={{
            fontSize: '0.65rem',
            color: '#B08D57',
            opacity: 0,
            transform: 'translateX(-4px)',
            transition: 'all 0.3s ease',
          }}
        />
      </Box>
    </Box>
  );
}

function QuickAction({ icon, label, onClick, delay }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        cursor: 'pointer',
        animation: `${countUp} 0.5s ${delay}s ease-out both`,
        '& .action-icon': {
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(74, 124, 111, 0.08)',
          color: '#4A7C6F',
          transition: `all 0.4s ${ELASTIC}`,
        },
        '&:hover .action-icon': {
          background: 'linear-gradient(135deg, #4A7C6F, #6B9E8A)',
          color: '#fff',
          transform: 'rotate(-8deg) scale(1.1)',
        },
        '&:hover .action-label': {
          color: '#2D5E4A',
        },
      }}
    >
      <Box className="action-icon">
        {icon}
      </Box>
      <Typography
        className="action-label"
        sx={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'text.secondary',
          transition: 'color 0.3s',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites/').then(r => r.data),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates/').then(r => r.data),
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get('/schedules/').then(r => r.data),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api.get('/posts/').then(r => r.data),
  });

  const { data: attentionSchedules = [] } = useQuery({
    queryKey: ['attentionSchedules'],
    queryFn: () => api.get('/schedules/attention').then(r => r.data),
  });

  const activeSchedules = schedules.filter(s => s.is_active);
  const recentPosts = posts.slice(0, 5);
  const pendingReview = posts.filter(p => p.status === 'pending_review');

  const nextRun = activeSchedules
    .filter(s => s.next_run)
    .sort((a, b) => new Date(a.next_run) - new Date(b.next_run))[0]?.next_run;

  const firstName = user?.email?.split('@')[0]?.split('.')[0] || 'Commander';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const publishedCount = posts.filter(p => p.status === 'published').length;

  return (
    <Box>
      {/* ----------------------------------------------------------------- */}
      {/* HERO GREETING                                                     */}
      {/* ----------------------------------------------------------------- */}
      <Box sx={{ mb: 5, mt: 1, position: 'relative' }}>
        {/* Shimmer accent bar */}
        <Box
          sx={{
            position: 'absolute',
            top: -8,
            left: 0,
            width: 120,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #B08D57, #D4A574, transparent)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 3s linear infinite`,
          }}
        />

        <Typography
          sx={{
            fontSize: { xs: '1.6rem', md: '2rem' },
            fontWeight: 800,
            fontFamily: '"Roboto Condensed", sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            lineHeight: 1.2,
            mt: 1,
          }}
        >
          Welcome back,{' '}
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, #2D5E4A, #4A7C6F, #B08D57)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {displayName}
          </Box>
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: 'text.secondary',
            letterSpacing: '0.02em',
            animation: `${countUp} 0.5s 0.2s ease-out both`,
          }}
        >
          {activeSchedules.length} active {activeSchedules.length === 1 ? 'schedule' : 'schedules'}
          {publishedCount > 0 && <> &middot; {publishedCount} {publishedCount === 1 ? 'post' : 'posts'} published</>}
          {nextRun && <> &middot; Next run {formatRelativeTime(nextRun)}</>}
        </Typography>
      </Box>

      {/* ----------------------------------------------------------------- */}
      {/* STATS STRIP                                                       */}
      {/* ----------------------------------------------------------------- */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 3,
          py: 3.5,
          px: 2,
          mb: 5,
          position: 'relative',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #E0DCD5, #B08D57, #E0DCD5, transparent)',
          },
          '&::before': { top: 0 },
          '&::after': { bottom: 0 },
        }}
      >
        <StatNumber value={sites.length} label="Sites" delay={0.1} onClick={() => navigate('/sites')} />
        <StatNumber value={templates.length} label="Templates" delay={0.2} onClick={() => navigate('/prompts')} />
        <StatNumber value={activeSchedules.length} label="Active Schedules" delay={0.3} onClick={() => navigate('/schedules')} />
        <StatNumber value={posts.length} label="Blog Posts" delay={0.4} onClick={() => navigate('/posts')} />
        {pendingReview.length > 0 && (
          <StatNumber value={pendingReview.length} label="Pending Review" delay={0.5} onClick={() => navigate('/review')} />
        )}
      </Box>

      {/* ----------------------------------------------------------------- */}
      {/* RECENT CONTENT + SIDEBAR                                          */}
      {/* ----------------------------------------------------------------- */}
      <SectionLabel>Recent Activity</SectionLabel>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        {/* ---- Left column: Recent Posts ---- */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ position: 'relative', overflow: 'hidden' }}>
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  position: 'relative',
                  display: 'inline-block',
                  pb: 1,
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: 2,
                    backgroundColor: 'primary.main',
                  },
                }}
              >
                Recent Blog Posts
              </Typography>

              {recentPosts.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <Article
                    sx={{
                      fontSize: 56,
                      color: '#E0DCD5',
                      mb: 2,
                      animation: `${float} 3s ease-in-out infinite`,
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{ color: 'text.secondary', fontStyle: 'italic', maxWidth: 320, mx: 'auto' }}
                  >
                    No dispatches from the forum yet. Create a template and set a schedule to begin publishing.
                  </Typography>
                </Box>
              ) : (
                <List sx={{ mt: 2 }}>
                  {recentPosts.map((post, i) => (
                    <React.Fragment key={post.id}>
                      <ListItem
                        button
                        onClick={() => navigate(`/posts/${post.id}`)}
                        sx={{
                          py: 2,
                          borderLeft: '3px solid transparent',
                          animation: `${countUp} 0.4s ${0.1 + i * 0.08}s ease-out both`,
                          transition: `all 0.4s ${ELASTIC}`,
                          '&:hover': {
                            backgroundColor: 'rgba(74, 124, 111, 0.06)',
                            transform: 'translateX(4px)',
                            borderLeftColor: '#4A7C6F',
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {post.title}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={STATUS_LABELS[post.status] || post.status}
                                color={STATUS_COLORS[post.status] || 'default'}
                                size="small"
                              />
                              {post.schedule_id && (
                                <Chip
                                  icon={<AutoMode sx={{ fontSize: '14px !important' }} />}
                                  label="Auto"
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 22, fontSize: '0.75rem' }}
                                />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {new Date(post.created_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {i < recentPosts.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button
                variant="outlined"
                size="small"
                endIcon={<ArrowForward sx={{ fontSize: '16px !important' }} />}
                onClick={() => navigate('/posts')}
              >
                View All Posts
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* ---- Right column: Sidebar ---- */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            {/* Pending Review */}
            {pendingReview.length > 0 && (
              <Card
                sx={{
                  borderLeft: 4,
                  borderColor: 'warning.main',
                  animation: `${countUp} 0.5s 0.15s ease-out both`,
                  transition: `all 0.4s ${ELASTIC}`,
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>Pending Review</Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #B08D57, #D4A574)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                    }}
                  >
                    {pendingReview.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pendingReview.length === 1 ? 'post needs' : 'posts need'} your review
                  </Typography>
                  <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                    {pendingReview.slice(0, 3).map(p => (
                      <Typography
                        key={p.id}
                        variant="body2"
                        sx={{
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          '&:hover': { color: 'primary.main' },
                        }}
                        onClick={() => navigate(`/posts/${p.id}`, { state: { from: 'review' } })}
                      >
                        {p.title}
                      </Typography>
                    ))}
                    {pendingReview.length > 3 && (
                      <Typography variant="caption" color="text.secondary">
                        +{pendingReview.length - 3} more
                      </Typography>
                    )}
                  </Stack>
                  {pendingReview.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Oldest: {formatRelativeTime(pendingReview[pendingReview.length - 1]?.created_at)}
                    </Typography>
                  )}
                  <Button variant="outlined" size="small" onClick={() => navigate('/review')}>
                    Review Queue
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Needs Attention */}
            {attentionSchedules.length > 0 && (
              <Card
                sx={{
                  borderLeft: 4,
                  borderColor: 'error.main',
                  animation: `${countUp} 0.5s 0.2s ease-out both`,
                  transition: `all 0.4s ${ELASTIC}`,
                  '&:hover': { transform: 'translateY(-4px)' },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Warning sx={{ color: 'error.main' }} />
                    <Typography variant="h6">Needs Attention</Typography>
                  </Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 900,
                      color: 'error.main',
                    }}
                  >
                    {attentionSchedules.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {attentionSchedules.length === 1 ? 'schedule has' : 'schedules have'} failed retries
                  </Typography>
                  <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                    {attentionSchedules.slice(0, 3).map(s => (
                      <Box key={s.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                          {!s.is_active && (
                            <Chip label="PAUSED" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                          )}
                          <Typography component="span" variant="caption" color="error.main">
                            ({s.retry_count} {s.retry_count === 1 ? 'retry' : 'retries'})
                          </Typography>
                        </Box>
                        {s.error_title && (
                          <Chip
                            label={s.error_title}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              bgcolor: 'transparent',
                              border: '1px solid #A0522D',
                              color: '#A0522D',
                              mb: 0.5,
                            }}
                          />
                        )}
                        {s.error_guidance && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                            {s.error_guidance}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          {(s.last_error_category === 'publish_auth' || s.last_error_category === 'publish_connection') && (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => navigate(`/sites/${s.site_id}/edit`)}
                              sx={{ textTransform: 'none', fontSize: '0.7rem', p: 0, minWidth: 0 }}
                            >
                              Edit Site
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => navigate(`/schedules/${s.id}/edit`)}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', p: 0, minWidth: 0 }}
                          >
                            Edit Schedule
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => navigate(`/schedules/${s.id}/history`)}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', p: 0, minWidth: 0 }}
                          >
                            View History
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                  {attentionSchedules.length > 3 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      +{attentionSchedules.length - 3} more
                    </Typography>
                  )}
                  <Button variant="outlined" size="small" onClick={() => navigate('/schedules')}>
                    View All Schedules
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card sx={{ animation: `${countUp} 0.5s 0.25s ease-out both` }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    position: 'relative',
                    display: 'inline-block',
                    pb: 1,
                    mb: 2,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: 2,
                      backgroundColor: 'primary.main',
                    },
                  }}
                >
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 1 }}>
                  <QuickAction
                    icon={<Language />}
                    label="Add Site"
                    onClick={() => navigate('/sites/new')}
                    delay={0.3}
                  />
                  <QuickAction
                    icon={<Description />}
                    label="Template"
                    onClick={() => navigate('/prompts/new')}
                    delay={0.38}
                  />
                  <QuickAction
                    icon={<Schedule />}
                    label="Schedule"
                    onClick={() => navigate('/schedules/new')}
                    delay={0.46}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Active Schedules */}
            {activeSchedules.length > 0 && (
              <Card sx={{ animation: `${countUp} 0.5s 0.3s ease-out both` }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      fontWeight: 700,
                      position: 'relative',
                      display: 'inline-block',
                      pb: 1,
                      mb: 1,
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: 2,
                        backgroundColor: 'primary.main',
                      },
                    }}
                  >
                    Active Schedules
                  </Typography>
                  <Stack spacing={1.5}>
                    {activeSchedules.slice(0, 3).map(sched => (
                      <Box
                        key={sched.id}
                        onClick={() => navigate(`/schedules/${sched.id}/edit`)}
                        sx={{
                          cursor: 'pointer',
                          p: 1.5,
                          border: '1px solid transparent',
                          transition: `all 0.4s ${ELASTIC}`,
                          '&:hover': {
                            borderColor: '#E0DCD5',
                            backgroundColor: 'rgba(74, 124, 111, 0.04)',
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* Pulse indicator */}
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: '#4A7C6F',
                                animation: `${pulseGlow} 2s ease-in-out infinite`,
                                flexShrink: 0,
                              }}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{sched.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {sched.frequency} &middot; {sched.time_of_day}
                              </Typography>
                            </Box>
                          </Box>
                          <Chip label={`${sched.topics?.length || 0} topics`} size="small" variant="outlined" />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.5, pl: 2.5 }}>
                          {sched.last_run && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                              <AccessTime sx={{ fontSize: 11 }} />
                              Last: {formatRelativeTime(sched.last_run)}
                            </Typography>
                          )}
                          {sched.next_run && (
                            <Typography variant="caption" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                              <AccessTime sx={{ fontSize: 11 }} />
                              Next: {formatRelativeTime(sched.next_run)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
