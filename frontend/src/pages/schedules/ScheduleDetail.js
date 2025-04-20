import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Switch,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Language as LanguageIcon,
  Description as DescriptionIcon,
  Article as ArticleIcon,
  ArrowBack as ArrowBackIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  History as HistoryIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
  Help as HelpIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { format, parseISO } from 'date-fns';

const ScheduleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
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
  
  // Wrap fetchSchedule in useCallback
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching schedule with ID: ${id}`);
      const response = await api.get(`/api/schedules/${id}`);
      console.log('Schedule data received:', response.data);
      
      // Debug: Check next_run_at format
      console.log('next_run_at value:', response.data.next_run_at);
      console.log('next_run_at type:', typeof response.data.next_run_at);
      console.log('Is next_run_at null or undefined?', response.data.next_run_at == null);
      
      setSchedule(response.data);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      
      let errorMessage = 'Failed to load schedule. Please try again.';
      
      if (err.response) {
        // The request was made and the server responded with an error
        console.error('Server error details:', err.response.data);
        errorMessage = `Server error: ${err.response.status} - ${err.response.data?.detail || 'Unknown error'}`;
      } else if (err.request) {
        // The request was made but no response was received
        console.error('Network error - no response received');
        errorMessage = 'Network error: Unable to connect to the backend server';
      } else {
        // Something happened in setting up the request
        console.error('Request setup error:', err.message);
        errorMessage = `Error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  // Wrap fetchRelatedData in useCallback
  const fetchRelatedData = useCallback(async () => {
    try {
      // Schedule posts
      const postsResponse = await api.get(`/api/posts?schedule_id=${id}`);
      setRelatedData(prev => ({
        ...prev,
        posts: { data: postsResponse.data, loading: false, error: null },
      }));
      
      // Execution history
      try {
        const historyResponse = await api.get(`/api/schedules/${id}/execution-history`);
        setRelatedData(prev => ({
          ...prev,
          history: { data: historyResponse.data, loading: false, error: null },
        }));
      } catch (historyErr) {
        console.error('Error fetching execution history:', historyErr);
        setRelatedData(prev => ({
          ...prev,
          history: { data: [], loading: false, error: 'Failed to load execution history' },
        }));
      }
    } catch (err) {
      console.error('Error fetching related data:', err);
      setRelatedData(prev => ({
        ...prev,
        posts: { data: [], loading: false, error: 'Failed to load posts' },
      }));
    }
  }, [id]);
  
  const handleDelete = async () => {
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/schedules/${id}`);
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
    setError(null); // Clear any previous errors
    
    // Remember the current status before toggling
    const currentStatus = schedule.is_active;
    const newStatus = !currentStatus;
    
    try {
      console.log(`Attempting to ${currentStatus ? 'deactivate' : 'activate'} schedule ${id}`);
      
      // Optimistically update UI first - this improves perceived performance
      setSchedule(prev => ({
        ...prev,
        is_active: newStatus,
        // If activating, we'll set next_run_at to a temporary placeholder value
        // This will let the user know we're calculating it
        ...(newStatus ? { next_run_at: null } : {})
      }));
      
      // Use the specific endpoints for activation/deactivation
      try {
        let response;
        if (currentStatus) {
          response = await api.patch(`/api/schedules/${id}/deactivate`);
          console.log(`Successfully deactivated schedule ${id}`);
        } else {
          response = await api.patch(`/api/schedules/${id}/activate`);
          console.log(`Successfully activated schedule ${id}`);
          
          // Log the response to help debug next_run issues
          console.log('Activate response data:', response.data);
          if (response.data.debug_info) {
            console.log('Next run debug info:', response.data.debug_info);
          }
        }
        
        // Show success message
        enqueueSnackbar(`Schedule ${currentStatus ? 'deactivated' : 'activated'} successfully`, { 
          variant: 'success' 
        });
        
        // After successful activation, always do a fresh fetch to get the latest data
        // especially important for next_run_at
        setTimeout(() => {
          fetchSchedule();
        }, 1000);
      } catch (apiErr) {
        // The API call failed, but we'll still try to refresh to get the true state
        console.error('API Error in toggle, will try to recover by refreshing:', apiErr);
        
        // Don't show the error yet - we'll first verify if the action actually succeeded
        setTimeout(() => {
          // Try to fetch the schedule to see if the status actually changed
          fetchSchedule().then(() => {
            // After fetching, check if the status matches what we expected
            if (schedule && schedule.is_active === newStatus) {
              // It worked despite the error!
              console.log('Status toggle succeeded despite API error');
              enqueueSnackbar(`Schedule ${currentStatus ? 'deactivated' : 'activated'} successfully`, { 
                variant: 'success' 
              });
              setError(null); // Clear any error since it worked
            } else {
              // Status didn't change - show error now
              const errorMessage = createErrorMessage(apiErr);
              setError(errorMessage);
              
              // Revert optimistic update
              setSchedule(prev => ({
                ...prev,
                is_active: currentStatus
              }));
            }
          });
        }, 1000);
        
        // Rethrow to skip the rest of the success path
        throw apiErr;
      }
      
      // If we're activating the schedule, refresh to get the updated next_run
      if (newStatus) {
        // Give the backend a moment to calculate next_run
        setTimeout(() => {
          fetchSchedule();
        }, 1000);
      }
    } catch (err) {
      // This only runs if we rethrow from the inner catch
      console.error('Error updating schedule status:', err);
      
      // Error message is now handled in the inner try/catch with recovery attempt
    } finally {
      setStatusUpdateLoading(false);
    }
  };
  
  // Helper to create error messages
  const createErrorMessage = (err) => {
    let errorMessage = 'Failed to update schedule status. Please try again.';
    
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Server error details:', err.response.data);
      errorMessage = `Server error: ${err.response.status} - ${err.response.data?.detail || 'Unknown error'}`;
    } else if (err.request) {
      // The request was made but no response was received
      console.error('Network error - no response received');
      errorMessage = 'Network error: Unable to connect to the backend server';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', err.message);
      errorMessage = `Error: ${err.message}`;
    }
    
    return errorMessage;
  };
  
  const runScheduleNow = async (event) => {
    // Prevent any default event behavior that might interfere
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    
    console.log('RUN NOW button clicked, setting loading state...');
    setRunNowLoading(true);
    setRunNowSuccess(false);
    setError(null); // Clear any previous errors
    
    try {
      console.log(`Attempting to run schedule with ID: ${id} - Making API call now...`);
      const startTime = new Date();
      const response = await api.post(`/api/schedules/${id}/run-now`);
      const endTime = new Date();
      const requestTime = (endTime - startTime) / 1000;
      
      console.log(`Schedule run API call completed in ${requestTime} seconds`);
      console.log('Schedule run response:', response);
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data:', response.data);
      
      // Check for errors in the response data
      if (response.data && response.data.error) {
        throw new Error(response.data.error);
      }
      
      console.log('Setting success state and showing notification...');
      setRunNowSuccess(true);
      
      // Show success alert
      enqueueSnackbar('Schedule execution has been triggered! Check execution history for results.', { variant: 'success' });
      
      // Wait a moment to allow background job to start, then refresh data
      console.log('Scheduling data refresh after timeout...');
      setTimeout(() => {
        console.log('Refreshing schedule and related data...');
        fetchSchedule(); // Refresh schedule data
        fetchRelatedData(); // Refresh posts and execution history
      }, 5000); // 5 seconds delay to allow background job to complete
      
    } catch (err) {
      console.error('Error running schedule:', err);
      console.error('Error type:', err.constructor.name);
      
      // Handle different error types
      let errorMessage = err.message || 'Unknown error';
      let variant = 'error';
      
      // Check for timeout errors
      if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 504)) {
        console.log('Timeout error detected');
        errorMessage = 'The request timed out. The content generation process may still be running in the background. Check execution history in a few minutes.';
        variant = 'warning'; // Use warning instead of error for timeouts
        
        // Still consider this a partial success
        setRunNowSuccess(true);
        
        // Refresh data after a longer delay for timeouts
        setTimeout(() => {
          console.log('Refreshing data after timeout error...');
          fetchSchedule(); // Refresh schedule data
          fetchRelatedData(); // Refresh posts and execution history
        }, 10000); // 10 seconds delay for timeout cases
      } else if (err.response) {
        // Server returned an error response
        console.log('Server error response:', err.response);
        console.log('Status code:', err.response.status);
        console.log('Response data:', err.response.data);
        
        if (err.response.status === 401) {
          errorMessage = 'Authentication error: Please refresh the page and log in again.';
        } else if (err.response.status === 403) {
          errorMessage = 'Permission denied: You do not have permission to run this schedule.';
        } else if (err.response.status === 404) {
          errorMessage = 'Schedule not found: The schedule may have been deleted.';
        } else if (err.response.status === 400) {
          errorMessage = `Invalid request: ${err.response.data?.detail || 'Please check schedule settings.'}`;
        } else {
          errorMessage = err.response.data?.detail || `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        // Request was made but no response received
        console.log('Network error - no response received');
        errorMessage = 'No response received from server. Please check your network connection.';
      }
      
      console.log('Setting error state and showing notification:', errorMessage);
      setError(`Failed to run schedule: ${errorMessage}`);
      enqueueSnackbar(`Failed to run schedule: ${errorMessage}`, { variant });
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
  
  // Format time string for display (HH:MM format to 12-hour with AM/PM)
  const formatTime = (timeString) => {
    if (!timeString) return 'Not set';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  // Format next run time
  const formatNextRun = (nextRun) => {
    // Add debugging information
    console.log('formatNextRun called with:', nextRun);
    console.log('schedule object:', schedule);
    
    // Fix for null/undefined nextRun
    if (nextRun == null) {
      // For active schedules, show a message that we're waiting for next run calculation
      if (schedule && schedule.is_active) {
        console.log('Schedule is active but nextRun is null/undefined');
        
        // Check if we have next_run (non-ISO format) as a fallback
        if (schedule.next_run) {
          console.log('Using schedule.next_run as fallback:', schedule.next_run);
          nextRun = schedule.next_run;
        } else {
          return 'Calculating next run time...';
        }
      } else {
        return 'Not scheduled';
      }
    }
    
    try {
      // Make sure we have a string for ISO parsing
      if (typeof nextRun === 'object' && nextRun !== null && nextRun.toString) {
        nextRun = nextRun.toString();
      }
      
      const date = new Date(nextRun);
      console.log('Parsed date object:', date);
      console.log('Date valid?', !isNaN(date.getTime()));
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid next_run date:', nextRun);
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffMs = date - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return 'Overdue';
      } else if (diffDays === 0) {
        // Only show "Today" if the date is actually today
        const today = new Date();
        if (date.getFullYear() === today.getFullYear() && 
            date.getMonth() === today.getMonth() && 
            date.getDate() === today.getDate()) {
          return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          // This is a future date but the diffDays calculation was incorrect
          return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } else if (diffDays === 1) {
        // Only show "Tomorrow" if the date is actually tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.getFullYear() === tomorrow.getFullYear() && 
            date.getMonth() === tomorrow.getMonth() && 
            date.getDate() === tomorrow.getDate()) {
          return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
          return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } else if (diffDays < 7) {
        return `${date.toLocaleDateString([], { weekday: 'long' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (error) {
      console.error('Error formatting next_run:', error);
      return 'Error formatting date';
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
  }, [id, fetchSchedule, fetchRelatedData]);
  
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
                {formatTime(schedule.time_of_day)}
              </Typography>
              
              <Typography variant="body1" gutterBottom>
                <strong>Next Run:</strong>{' '}
                <Box component="span" sx={{
                  fontWeight: 'medium',
                  color: schedule && schedule.is_active ? 'primary.main' : 'text.secondary',
                  // Add a subtle highlight to the next run text
                  bgcolor: schedule && schedule.is_active && schedule.next_run_at ? 'action.hover' : 'transparent',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1
                }}>
                  {formatNextRun(schedule.next_run_at)}
                </Box>
                {schedule && schedule.is_active && schedule.next_run_at && (
                  <Tooltip title={`Raw datetime: ${schedule.next_run_at}`}>
                    <HelpIcon sx={{ fontSize: 16, ml: 1, color: 'text.secondary', cursor: 'help' }} />
                  </Tooltip>
                )}
              </Typography>
              
              <Typography variant="body1" gutterBottom component="div">
                <strong>Post Status:</strong>{' '}
              </Typography>
              <Chip 
                size="small" 
                label={schedule.post_status === 'publish' ? 'Published' : 'Draft'}
                color={schedule.post_status === 'publish' ? 'success' : 'default'}
              />
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
              
              {/* Check for either prompt or prompt_template property */}
              {(schedule.prompt || schedule.prompt_template) ? (
                <>
                  <Typography variant="body1" gutterBottom>
                    <strong>Template:</strong>{' '}
                    <Button
                      component={RouterLink}
                      to={`/prompts/${schedule.prompt?.id || schedule.prompt_template?.id}`}
                      size="small"
                      sx={{ ml: 1 }}
                    >
                      {schedule.prompt?.name || schedule.prompt_template?.name}
                    </Button>
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    {schedule.prompt?.description || schedule.prompt_template?.description}
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
                    sx={{ 
                      mr: 2,
                      position: 'relative',
                      // Add pulsing effect when button is clicked but not yet loaded
                      animation: runNowLoading ? 'pulse 1.5s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { backgroundColor: 'primary.main' },
                        '50%': { backgroundColor: 'primary.dark' },
                        '100%': { backgroundColor: 'primary.main' },
                      },
                      // Make button more prominent
                      fontWeight: 'bold',
                      minWidth: '120px',
                      boxShadow: 3
                    }}
                  >
                    {runNowLoading ? 'Running...' : 'Run Now'}
                    {runNowSuccess && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          bgcolor: 'success.main',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'white',
                          zIndex: 1,
                        }}
                      >
                        <CheckIcon fontSize="small" />
                      </Box>
                    )}
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
                    <ListItem
                      alignItems="flex-start"
                      sx={{ 
                        flexDirection: 'column', 
                        alignItems: 'flex-start',
                        backgroundColor: execution.success ? 'rgba(76, 175, 80, 0.05)' : 'rgba(239, 83, 80, 0.05)'
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1">
                            {new Date(execution.execution_time).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              Type: {execution.execution_type === 'manual' ? 'Manual Execution' : 'Scheduled Run'}
                            </Typography>
                            <br />
                            {execution.success ? (
                              <Chip 
                                color="success" 
                                size="small" 
                                icon={<CheckCircleOutlineIcon />} 
                                label="Success" 
                                sx={{ mt: 1 }} 
                              />
                            ) : (
                              <>
                                <Chip 
                                  color="error" 
                                  size="small" 
                                  icon={<ErrorOutlineIcon />} 
                                  label="Failed" 
                                  sx={{ mt: 1 }} 
                                />
                                {execution.error_message && (
                                  <Typography 
                                    variant="body2" 
                                    color="error" 
                                    component="div"
                                    sx={{ 
                                      mt: 1, 
                                      p: 1.5, 
                                      whiteSpace: 'pre-wrap', 
                                      wordBreak: 'break-word',
                                      backgroundColor: 'rgba(239, 83, 80, 0.08)',
                                      borderRadius: 1,
                                      border: '1px solid rgba(239, 83, 80, 0.2)',
                                      maxHeight: '200px',
                                      overflow: 'auto'
                                    }}
                                  >
                                    <strong>Error:</strong> {execution.error_message}
                                  </Typography>
                                )}
                              </>
                            )}
                          </>
                        }
                      />
                      {execution.post_id && (
                        <Button 
                          variant="outlined" 
                          size="small" 
                          component={RouterLink} 
                          to={`/posts/${execution.post_id}`}
                          sx={{ mt: 1 }}
                          startIcon={<ArticleIcon />}
                        >
                          View Post
                        </Button>
                      )}
                    </ListItem>
                    <Divider component="li" />
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