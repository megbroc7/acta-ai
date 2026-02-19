import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch, Tooltip,
  CircularProgress, Collapse,
} from '@mui/material';
import {
  Add, MoreVert, Edit, Delete, Schedule, PlayArrow, Pause,
  ExpandMore, ExpandLess, CheckCircle, Cancel as CancelIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import ListSkeleton from '../../components/common/ListSkeleton';

const FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom' };

const SCRIBE_MESSAGES = [
  'Summoning the scribe...',
  'Unfurling the papyrus...',
  'Mixing the ink...',
  'Consulting the muses...',
  'The quill touches parchment...',
  'Composing the opening proclamation...',
  'Weaving arguments with rhetorical precision...',
  'Cross-referencing the archives...',
  'Reviewing for the Senate\'s approval...',
  'Applying the imperial seal...',
];

export default function SchedulesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [scribeMsg, setScribeMsg] = useState(0);
  const scribeInterval = useRef(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get('/schedules/').then(r => r.data),
  });

  const {
    data: execData,
    isLoading: execLoading,
    isError: execIsError,
    error: execError,
  } = useQuery({
    queryKey: ['executions', expandedId],
    queryFn: () => api.get(`/schedules/${expandedId}/executions?limit=5`).then(r => r.data),
    enabled: !!expandedId,
  });
  const executions = execData?.entries || [];
  const execTotal = execData?.total || 0;
  const execErrorMessage =
    execError?.response?.data?.detail
    || execError?.message
    || 'Failed to load execution history';

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      enqueueSnackbar('Schedule deleted', { variant: 'success' });
      setDeleteOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) =>
      api.patch(`/schedules/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (id) => api.post(`/schedules/${id}/trigger`, null, { timeout: 90000 }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      const data = res.data;
      if (data.success) {
        enqueueSnackbar(`Post generated: "${data.title}"`, { variant: 'success' });
      } else {
        enqueueSnackbar(`Generation failed: ${data.error_message}`, { variant: 'error' });
      }
      setTriggerOpen(false);
      setTriggerTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to trigger schedule', { variant: 'error' });
      setTriggerOpen(false);
      setTriggerTarget(null);
    },
  });

  useEffect(() => {
    if (!triggerMutation.isPending) {
      clearInterval(scribeInterval.current);
      return undefined;
    }

    scribeInterval.current = setInterval(() => {
      setScribeMsg(prev => (prev + 1) % SCRIBE_MESSAGES.length);
    }, 4000);

    return () => {
      clearInterval(scribeInterval.current);
    };
  }, [triggerMutation.isPending]);

  const formatExecTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          Schedules
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/schedules/new')}>
          New Schedule
        </Button>
      </Box>

      {isLoading ? (
        <ListSkeleton variant="cards" />
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Schedule sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" gutterBottom sx={{ fontStyle: 'italic' }}>
              No edicts decreed
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Set a schedule to dispatch your content on a regular cadence.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/schedules/new')}>
              New Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {schedules.map((sched) => (
            <Grid item xs={12} md={6} lg={4} key={sched.id}>
              <Card
                sx={{
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    borderColor: 'primary.light',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" noWrap>{sched.name}</Typography>
                      {sched.site && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {sched.site.name}
                        </Typography>
                      )}
                    </Box>
                    <Tooltip title={sched.is_active ? 'Active' : 'Paused'}>
                      <Switch
                        size="small"
                        checked={sched.is_active}
                        onChange={() => toggleMutation.mutate({ id: sched.id, active: !sched.is_active })}
                        color="success"
                      />
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      icon={sched.is_active ? <PlayArrow /> : <Pause />}
                      label={sched.is_active ? 'Active' : 'Paused'}
                      color={sched.is_active ? 'success' : 'default'}
                      size="small"
                    />
                    <Chip label={FREQ_LABELS[sched.frequency] || sched.frequency} size="small" variant="outlined" />
                    <Chip label={`${sched.topics?.length || 0} topics`} size="small" variant="outlined" />
                    {sched.prompt_template && (
                      <Chip label={sched.prompt_template.name} size="small" variant="outlined" />
                    )}
                  </Box>
                  {sched.time_of_day && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Runs at {sched.time_of_day} {sched.timezone}
                    </Typography>
                  )}
                </CardContent>

                {/* Execution History Toggle + Collapsible */}
                <Box sx={{ px: 2 }}>
                  <Button
                    size="small"
                    onClick={() => setExpandedId(expandedId === sched.id ? null : sched.id)}
                    endIcon={expandedId === sched.id ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.8rem' }}
                  >
                    Execution History
                  </Button>
                  <Collapse in={expandedId === sched.id} timeout="auto" unmountOnExit>
                    <Box sx={{ pb: 1.5, pt: 0.5 }}>
                      {execLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                          <CircularProgress size={20} />
                        </Box>
                      ) : execIsError ? (
                        <Typography variant="body2" color="error.main" sx={{ py: 1 }}>
                          {execErrorMessage}
                        </Typography>
                      ) : executions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                          No executions yet
                        </Typography>
                      ) : (
                        <>
                          {executions.map((exec) => (
                            <Box
                              key={exec.id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 0.5,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&:last-child': { borderBottom: 'none' },
                              }}
                            >
                              {exec.success ? (
                                <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <Tooltip title={exec.error_message || 'Failed'}>
                                  <CancelIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                </Tooltip>
                              )}
                              <Typography variant="caption" sx={{ minWidth: 100 }}>
                                {formatExecTime(exec.execution_time)}
                              </Typography>
                              <Chip
                                label={exec.execution_type}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              {!exec.success && exec.error_category && (
                                <Chip
                                  label={exec.error_category.replace(/_/g, ' ')}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    bgcolor: 'transparent',
                                    border: '1px solid #A0522D',
                                    color: '#A0522D',
                                  }}
                                />
                              )}
                              {exec.duration_ms != null && (
                                <Typography variant="caption" color="text.secondary">
                                  {(exec.duration_ms / 1000).toFixed(1)}s
                                </Typography>
                              )}
                            </Box>
                          ))}
                          {execTotal > 5 && (
                            <Button
                              size="small"
                              onClick={() => navigate(`/schedules/${sched.id}/history`)}
                              sx={{ mt: 1, textTransform: 'none', fontSize: '0.75rem' }}
                            >
                              View Full History ({execTotal} total)
                            </Button>
                          )}
                        </>
                      )}
                    </Box>
                  </Collapse>
                </Box>

                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    {sched.is_active && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={triggerMutation.isPending && triggerTarget === sched.id
                          ? <CircularProgress size={16} />
                          : <PlayArrow />}
                        disabled={triggerMutation.isPending}
                        onClick={() => { setTriggerTarget(sched.id); setTriggerOpen(true); }}
                        sx={{ textTransform: 'none' }}
                      >
                        {triggerMutation.isPending && triggerTarget === sched.id ? 'Generating...' : 'Run Now'}
                      </Button>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => { setAnchorEl(e.currentTarget); setSelected(sched); }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { setAnchorEl(null); navigate(`/schedules/${selected?.id}/edit`); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Edit
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); setDeleteOpen(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{selected?.name}</strong>? This will also delete all posts generated by this schedule.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(selected?.id)}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Trigger Confirmation / Scribe Progress */}
      <Dialog
        open={triggerOpen}
        onClose={triggerMutation.isPending ? undefined : () => { setTriggerOpen(false); setTriggerTarget(null); }}
        PaperProps={{ sx: { minWidth: 400 } }}
      >
        {triggerMutation.isPending ? (
          <>
            <DialogContent sx={{ textAlign: 'center', py: 5, px: 4 }}>
              <Typography
                variant="h6"
                sx={{
                  fontStyle: 'italic',
                  color: 'text.secondary',
                  fontWeight: 400,
                  transition: 'opacity 0.4s ease',
                  minHeight: 32,
                }}
              >
                {SCRIBE_MESSAGES[scribeMsg]}
              </Typography>
              <Box sx={{
                mt: 3, mb: 1, height: 2,
                background: 'linear-gradient(90deg, transparent, #B08D57, #D4A574, #B08D57, transparent)',
                animation: 'shimmer 2s infinite linear',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-200% 0' },
                  '100%': { backgroundPosition: '200% 0' },
                },
                backgroundSize: '200% 100%',
              }} />
            </DialogContent>
          </>
        ) : (
          <>
            <DialogTitle>Run Schedule Now</DialogTitle>
            <DialogContent>
              <Typography>
                This will generate and publish a blog post immediately. Continue?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setTriggerOpen(false); setTriggerTarget(null); }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setScribeMsg(0);
                  triggerMutation.mutate(triggerTarget);
                }}
              >
                Generate Post
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
