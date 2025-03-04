import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Alert,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Language as LanguageIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  ArrowBack as ArrowBackIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

const ScheduleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowSuccess, setRunNowSuccess] = useState(false);
  const [relatedData, setRelatedData] = useState({
    posts: { data: [], loading: true, error: null },
    history: { data: [], loading: true, error: null },
  });
  
  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/v1/schedules/${id}`);
      setSchedule(response.data);
    } catch (err) {
      setError('Failed to load schedule details. Please try again.');
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRelatedData = async () => {
    // Fetch posts for this schedule
    try {
      const postsResponse = await api.get(`/api/v1/posts?schedule_id=${id}`);
      setRelatedData(prev => ({
        ...prev,
        posts: { data: postsResponse.data, loading: false, error: null },
      }));
    } catch (err) {
      setRelatedData(prev => ({
        ...prev,
        posts: { data: [], loading: false, error: 'Failed to load posts' },
      }));
    }
    
    // Fetch execution history for this schedule
    try {
      const historyResponse = await api.get(`/api/v1/schedules/${id}/history`);
      setRelatedData(prev => ({
        ...prev,
        history: { data: historyResponse.data, loading: false, error: null },
      }));
    } catch (err) {
      setRelatedData(prev => ({
        ...prev,
        history: { data: [], loading: false, error: 'Failed to load execution history' },
      }));
    }
  };
  
  const handleDelete = async () => {
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/v1/schedules/${id}`);
      navigate('/schedules');
    } catch (err) {
      setError('Failed to delete schedule. Please try again.');
      console.error('Error deleting schedule:', err);
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const toggleScheduleStatus = async () => {
    if (!schedule) return;
    
    setStatusUpdateLoading(true);
    
    try {
      const newStatus = !schedule.is_active;
      await api.patch(`/api/v1/schedules/${id}`, {
        is_active: newStatus
      });
      
      // Update the local state
      setSchedule(prev => ({
        ...prev,
        is_active: newStatus
      }));
    } catch (err) {
      setError('Failed to update schedule status. Please try again.');
      console.error('Error updating schedule status:', err);
    } finally {
      setStatusUpdateLoading(false);
    }
  };
  
  const runScheduleNow = async () => {
    setRunNowLoading(true);
    setRunNowSuccess(false);
    
    try {
      await api.post(`/api/v1/schedules/${id}/run-now`);
      setRunNowSuccess(true);
      
      // Refresh the posts data after a short delay
      setTimeout(() => {
        fetchRelatedData();
      }, 2000);
    } catch (err) {
      setError('Failed to run schedule. Please try again.');
      console.error('Error running schedule:', err);
    } finally {
      setRunNowLoading(false);
    }
  };
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Format frequency for display
  const formatFrequency = (frequency) => {
    if (!frequency) return 'Unknown';
    
    switch (frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      case 'custom':
        return 'Custom';
      default:
        return frequency;
    }
  };
  
  // Format next run time
  const formatNextRun = (nextRun) => {
    if (!nextRun) return 'Not scheduled';
    
    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  // Format days of week
  const formatDaysOfWeek = (days) => {
    if (!days || !Array.isArray(days) || days.length === 0) return 'None';
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map(day => dayNames[day]).join(', ');
  };
  
  useEffect(() => {
    fetchSchedule();
    fetchRelatedData();
  }, [id]);
  
  if (loading) {
    return <LoadingState message="Loading schedule details..." />;
  }
  
  if (error) {
    return (
      <ErrorState
        message="Error Loading Schedule"
        details={error}
        onRetry={fetchSchedule}
      />
    );
  }
  
  if (!schedule) {
    return (
      <EmptyState
        title="Schedule Not Found"
        description="The schedule you're looking for doesn't exist or has been deleted."
        actionText="Back to Schedules"
        actionLink="/schedules"
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title={schedule.name}
        breadcrumbs={[
          { text: 'Content Schedules', link: '/schedules' },
          { text: schedule.name },
        ]}
        actionButton={true}
        actionButtonText="Back to Schedules"
        actionButtonLink="/schedules"
        actionButtonIcon={<ArrowBackIcon />}
        actionButtonVariant="outlined"
      />
      
      {runNowSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Schedule executed successfully! New content is being generated.
        </Alert>
      )}
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Schedule Information</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body1" sx={{ mr: 1 }}>
                  <strong>Status:</strong>
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={schedule.is_active}
                      onChange={toggleScheduleStatus}
                      disabled={statusUpdateLoading}
                      color="primary"
                    />
                  }
                  label={
                    <Chip 
                      size="small" 
                      label={schedule.is_active ? "Active" : "Inactive"}
                      color={schedule.is_active ? "success" : "default"}
                    />
                  }
                  labelPlacement="end"
                />
              </Box>
              
              <Typography variant="body1" gutterBottom>
                <strong>Frequency:</strong>{' '}
                {formatFrequency(schedule.frequency)}
              </Typography>
              
              {schedule.frequency === 'weekly' && (
                <Typography variant="body1" gutterBottom>
                  <strong>Days:</strong>{' '}
                  {formatDaysOfWeek(schedule.days_of_week)}
                </Typography>
              )}
              
              {schedule.frequency === 'monthly' && (
                <Typography variant="body1" gutterBottom>
                  <strong>Day of Month:</strong>{' '}
                  {schedule.day_of_month || 1}
                </Typography>
              )}
              
              <Typography variant="body1" gutterBottom>
                <strong>Time:</strong>{' '}
                {schedule.time ? new Date(schedule.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not set'}
              </Typography>
              
              <Typography variant="body1" gutterBottom>
                <strong>Next Run:</strong>{' '}
                {formatNextRun(schedule.next_run_at)}
              </Typography>
              
              <Typography variant="body1" gutterBottom>
                <strong>Post Status:</strong>{' '}
                <Chip 
                  size="small" 
                  label={schedule.post_status === 'publish' ? 'Published' : 'Draft'}
                  color={schedule.post_status === 'publish' ? 'success' : 'default'}
                />
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LanguageIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">WordPress Site</Typography>
              </Box>
              
              {schedule.site ? (
                <>
                  <Typography variant="body1" gutterBottom>
                    <strong>Site:</strong>{' '}
                    <Button
                      component={RouterLink}
                      to={`/sites/${schedule.site.id}`}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      {schedule.site.name}
                    </Button>
                  </Typography>
                  
                  <Typography variant="body1" gutterBottom>
                    <strong>URL:</strong>{' '}
                    <a href={schedule.site.url} target="_blank" rel="noopener noreferrer">
                      {schedule.site.url}
                    </a>
                  </Typography>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Categories:</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      {schedule.categories && schedule.categories.length > 0 ? (
                        schedule.categories.map((category) => (
                          <Chip
                            key={category.id}
                            label={category.name}
                            size="small"
                            icon={<CategoryIcon fontSize="small" />}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No categories selected
                        </Typography>
                      )}
                    </Box>
                    
                    <Typography variant="body2" gutterBottom>
                      <strong>Tags:</strong>
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {schedule.tags && schedule.tags.length > 0 ? (
                        schedule.tags.map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            icon={<TagIcon fontSize="small" />}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No tags selected
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography variant="body1" color="error">
                  No WordPress site assigned
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DescriptionIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Prompt Template</Typography>
              </Box>
              
              {schedule.prompt ? (
                <>
                  <Typography variant="body1" gutterBottom>
                    <strong>Template:</strong>{' '}
                    <Button
                      component={RouterLink}
                      to={`/prompts/${schedule.prompt.id}`}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      {schedule.prompt.name}
                    </Button>
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    {schedule.prompt.description}
                  </Typography>
                  
                  {schedule.variable_values && Object.keys(schedule.variable_values).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Variable Values:</strong>
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Grid container spacing={2}>
                          {Object.entries(schedule.variable_values).map(([key, value]) => (
                            <Grid item xs={12} sm={6} md={4} key={key}>
                              <Typography variant="body2">
                                <strong>{key}:</strong>{' '}
                                {Array.isArray(value) ? value.join(', ') : value.toString()}
                              </Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
                    </Box>
                  )}
                </>
              ) : (
                <Typography variant="body1" color="error">
                  No prompt template assigned
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={runNowLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    onClick={runScheduleNow}
                    disabled={runNowLoading || !schedule.is_active}
                    sx={{ mr: 2 }}
                  >
                    {runNowLoading ? 'Running...' : 'Run Now'}
                  </Button>
                  
                  <Button
                    component={RouterLink}
                    to={`/schedules/${id}/edit`}
                    variant="outlined"
                    startIcon={<EditIcon />}
                    sx={{ mr: 2 }}
                  >
                    Edit Schedule
                  </Button>
                </Box>
                
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete Schedule
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Generated Posts" icon={<ArticleIcon />} iconPosition="start" />
          <Tab label="Execution History" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* Generated Posts Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Posts Generated by this Schedule
            </Typography>
            
            {relatedData.posts.loading ? (
              <LoadingState message="Loading posts..." />
            ) : relatedData.posts.error ? (
              <Alert severity="error">{relatedData.posts.error}</Alert>
            ) : relatedData.posts.data.length === 0 ? (
              <EmptyState
                title="No Posts Generated Yet"
                description="This schedule hasn't generated any blog posts yet."
                actionText="Run Schedule Now"
                actionOnClick={runScheduleNow}
                actionIcon={<RefreshIcon />}
                actionDisabled={runNowLoading || !schedule.is_active}
              />
            ) : (
              <List>
                {relatedData.posts.data.map((post) => (
                  <React.Fragment key={post.id}>
                    <ListItem
                      button
                      component={RouterLink}
                      to={`/posts/${post.id}`}
                    >
                      <ListItemIcon>
                        <ArticleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={post.title}
                        secondary={`Status: ${post.status} | Created: ${new Date(post.created_at).toLocaleDateString()}`}
                      />
                      <Chip
                        label={post.status}
                        color={
                          post.status === 'published' ? 'success' :
                          post.status === 'draft' ? 'default' :
                          post.status === 'pending_review' ? 'warning' :
                          'error'
                        }
                        size="small"
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Execution History Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Execution History
            </Typography>
            
            {relatedData.history.loading ? (
              <LoadingState message="Loading execution history..." />
            ) : relatedData.history.error ? (
              <Alert severity="error">{relatedData.history.error}</Alert>
            ) : relatedData.history.data.length === 0 ? (
              <EmptyState
                title="No Execution History"
                description="This schedule hasn't been executed yet."
                actionText="Run Schedule Now"
                actionOnClick={runScheduleNow}
                actionIcon={<RefreshIcon />}
                actionDisabled={runNowLoading || !schedule.is_active}
              />
            ) : (
              <List>
                {relatedData.history.data.map((execution) => (
                  <React.Fragment key={execution.id}>
                    <ListItem>
                      <ListItemIcon>
                        {execution.success ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={`Execution on ${new Date(execution.executed_at).toLocaleString()}`}
                        secondary={execution.success ? 'Successful' : `Failed: ${execution.error_message}`}
                      />
                      {execution.post_id && (
                        <Button
                          component={RouterLink}
                          to={`/posts/${execution.post_id}`}
                          size="small"
                          variant="outlined"
                        >
                          View Post
                        </Button>
                      )}
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Schedule"
        message={`Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default ScheduleDetail; 