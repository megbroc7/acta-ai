import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  Switch,
  FormControlLabel,
  Badge,
  Avatar,
  Stack,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Schedule as ScheduleIcon,
  Language as LanguageIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  Today as TodayIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';
import { useSnackbar } from 'notistack';

// Constants for day names and frequency options
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Helper function to get the day name from value
const getDayName = (dayValue) => {
  if (dayValue === null || dayValue === undefined) return 'N/A';
  const day = DAYS_OF_WEEK.find(d => d.value === parseInt(dayValue));
  return day ? day.label : 'Unknown';
};

// Helper function to group schedules by site and frequency
const groupSchedules = (schedules) => {
  // Group by site_id
  const groupedBySite = schedules.reduce((acc, schedule) => {
    const siteId = schedule.site_id;
    if (!acc[siteId]) {
      acc[siteId] = [];
    }
    acc[siteId].push(schedule);
    return acc;
  }, {});

  // For each site, group weekly schedules by days
  const result = [];
  
  Object.keys(groupedBySite).forEach(siteId => {
    const siteSchedules = groupedBySite[siteId];
    const siteName = siteSchedules[0]?.site?.name || `Site ${siteId}`;
    
    // Find weekly schedules for potential grouping
    const weeklySchedules = siteSchedules.filter(s => s.frequency === 'weekly');
    const nonWeeklySchedules = siteSchedules.filter(s => s.frequency !== 'weekly');
    
    // Add non-weekly schedules directly
    nonWeeklySchedules.forEach(schedule => {
      result.push({
        type: 'single',
        schedule,
        siteName
      });
    });
    
    // Group weekly schedules with similar attributes (except day_of_week)
    const weeklyGroups = {};
    
    weeklySchedules.forEach(schedule => {
      // Create a key based on site, prompt and time
      const promptId = schedule.prompt_template_id || (schedule.prompt ? schedule.prompt.id : null);
      // Using this format to create a unique identifier for similar schedules
      const key = `${schedule.site_id}-${promptId}-${schedule.time_of_day}`;
      
      if (!weeklyGroups[key]) {
        weeklyGroups[key] = {
          schedules: [],
          days: [],
          template: { ...schedule }
        };
      }
      
      weeklyGroups[key].schedules.push(schedule);
      weeklyGroups[key].days.push(schedule.day_of_week);
    });
    
    // Add weekly groups to result
    Object.values(weeklyGroups).forEach(group => {
      if (group.schedules.length > 1) {
        // Multiple schedules in a group
        result.push({
          type: 'group',
          schedules: group.schedules,
          days: group.days,
          template: group.template,
          siteName
        });
      } else if (group.schedules.length === 1) {
        // Single schedule
        result.push({
          type: 'single',
          schedule: group.schedules[0],
          siteName
        });
      }
    });
  });
  
  return result;
};

const SchedulesList = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(null);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  
  const { enqueueSnackbar } = useSnackbar();
  
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/schedules');
      setSchedules(response.data);
    } catch (err) {
      setError('Failed to load schedules. Please try again.');
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMenuOpen = (event, scheduleId) => {
    setAnchorEl(event.currentTarget);
    setSelectedScheduleId(scheduleId);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedScheduleId(null);
  };
  
  const handleDeleteClick = (schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };
  
  const deleteSchedule = async () => {
    if (!scheduleToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/schedules/${scheduleToDelete.id}`);
      setSchedules(schedules.filter(s => s.id !== scheduleToDelete.id));
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    } catch (err) {
      console.error('Error deleting schedule:', err);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const toggleScheduleStatus = async (scheduleId, currentStatus) => {
    setStatusUpdateLoading(scheduleId);
    
    try {
      if (currentStatus) {
        await api.patch(`/api/schedules/${scheduleId}/deactivate`);
      } else {
        await api.patch(`/api/schedules/${scheduleId}/activate`);
      }
      // Update the schedule in the state
      setSchedules(schedules.map(s => 
        s.id === scheduleId ? { ...s, is_active: !currentStatus } : s
      ));
    } catch (err) {
      console.error('Error updating schedule status:', err);
    } finally {
      setStatusUpdateLoading(null);
    }
  };
  
  const runScheduleNow = async (scheduleId) => {
    // Set loading state for this specific schedule
    setStatusUpdateLoading(scheduleId);
    
    try {
      console.log(`Attempting to run schedule with ID: ${scheduleId}`);
      const response = await api.post(`/api/schedules/${scheduleId}/run-now`);
      console.log('Schedule run response:', response);
      
      // Show success message
      enqueueSnackbar('Schedule execution has been triggered! Check execution history for results.', { variant: 'success' });
      
      // Refresh schedules after a delay
      console.log('Scheduling refresh after 5 seconds...');
      setTimeout(() => {
        console.log('Refreshing schedules...');
        fetchSchedules();
      }, 5000);
    } catch (err) {
      console.error('Error running schedule:', err);
      console.error('Error type:', err.constructor.name);
      
      // Handle different error types
      let errorMessage = err.message || 'Unknown error';
      let variant = 'error';
      
      // Check for timeout errors
      if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 504)) {
        console.log('Timeout error detected');
        errorMessage = 'The request timed out. The content generation process may still be running in the background.';
        variant = 'warning'; // Use warning instead of error for timeouts
        
        // Refresh schedules after a longer delay for timeouts
        setTimeout(() => {
          fetchSchedules();
        }, 10000);
      } else if (err.response) {
        // Server returned an error response
        console.log('Server error response:', err.response);
        errorMessage = err.response.data?.detail || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request was made but no response received
        console.log('Network error - no response received');
        errorMessage = 'No response received from server. Please check your network connection.';
      }
      
      console.log('Showing error notification:', errorMessage);
      enqueueSnackbar(`Failed to run schedule: ${errorMessage}`, { variant });
    } finally {
      // Clear loading state after operation completes (success or error)
      setStatusUpdateLoading(null);
      
      // If we were called from the menu, close it
      if (anchorEl) {
        handleMenuClose();
      }
    }
  };
  
  const handleDeleteFromMenu = () => {
    const scheduleToDelete = schedules.find(s => s.id === selectedScheduleId);
    if (scheduleToDelete) {
      handleDeleteClick(scheduleToDelete);
    }
    handleMenuClose();
  };
  
  const handleRunNowFromMenu = () => {
    runScheduleNow(selectedScheduleId);
    handleMenuClose();
  };
  
  const filteredSchedules = schedules.filter(schedule => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (schedule.name && schedule.name.toLowerCase().includes(searchLower)) ||
      (schedule.site?.name && schedule.site.name.toLowerCase().includes(searchLower)) ||
      (schedule.prompt_template?.name && schedule.prompt_template.name.toLowerCase().includes(searchLower))
    );
  });
  
  // Group filtered schedules for display
  const groupedSchedules = groupSchedules(filteredSchedules);
  
  // Format time string for display (HH:MM format)
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  // Helper to format days of week for display
  const formatDays = (days) => {
    if (!days || days.length === 0) return 'No days selected';
    
    const dayNames = days.map(day => getDayName(day));
    
    if (dayNames.length === 1) return dayNames[0];
    if (dayNames.length === 2) return `${dayNames[0]} and ${dayNames[1]}`;
    if (dayNames.length === 7) return 'Every day';
    
    // Sort days to be in order of the week
    const sortedDays = [...days].sort((a, b) => parseInt(a) - parseInt(b));
    const sortedDayNames = sortedDays.map(day => getDayName(day));
    
    if (sortedDayNames.length <= 3) {
      const last = sortedDayNames.pop();
      return `${sortedDayNames.join(', ')} and ${last}`;
    }
    
    return `${sortedDayNames.length} days: ${sortedDayNames.join(', ')}`;
  };
  
  // Render schedule frequency and timing info
  const renderScheduleFrequency = (schedule) => {
    switch (schedule.frequency) {
      case 'daily':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">Daily at {formatTime(schedule.time_of_day)}</Typography>
          </Box>
        );
      case 'weekly':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TodayIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">
              {getDayName(schedule.day_of_week)}s at {formatTime(schedule.time_of_day)}
            </Typography>
          </Box>
        );
      case 'monthly':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">
              Monthly (Day {schedule.day_of_month}) at {formatTime(schedule.time_of_day)}
            </Typography>
          </Box>
        );
      default:
        return (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ScheduleIcon fontSize="small" sx={{ mr: 0.5 }} />
            <Typography variant="body2">{schedule.frequency}</Typography>
          </Box>
        );
    }
  };
  
  // Render a single schedule card
  const renderScheduleCard = (item) => {
    if (item.type === 'single') {
      const schedule = item.schedule;
      
      return (
        <Card key={schedule.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="h6" component="h2">
                  {schedule.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <LanguageIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {schedule.site?.name || `Site ${schedule.site_id}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <DescriptionIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {(schedule.prompt_template?.name || schedule.prompt?.name) || "No template assigned"}
                </Typography>
                {renderScheduleFrequency(schedule)}
              </Box>
              
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={schedule.is_active}
                      onChange={() => toggleScheduleStatus(schedule.id, schedule.is_active)}
                      disabled={statusUpdateLoading === schedule.id}
                    />
                  }
                  label={schedule.is_active ? "Active" : "Inactive"}
                />
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, schedule.id)}
                  aria-label="schedule options"
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={statusUpdateLoading === schedule.id ? 
                  <CircularProgress size={16} color="inherit" /> : 
                  <RefreshIcon />}
                onClick={() => runScheduleNow(schedule.id)}
                disabled={statusUpdateLoading === schedule.id || !schedule.is_active}
                sx={{ 
                  mr: 1,
                  minWidth: '100px',
                  position: 'relative',
                  animation: statusUpdateLoading === schedule.id ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { borderColor: 'primary.main' },
                    '50%': { borderColor: 'primary.dark' },
                    '100%': { borderColor: 'primary.main' },
                  },
                }}
              >
                {statusUpdateLoading === schedule.id ? 'Running...' : 'Run Now'}
              </Button>
              <Button
                component={RouterLink}
                to={`/schedules/${schedule.id}`}
                variant="contained"
                size="small"
                endIcon={<ArrowForwardIcon />}
              >
                View Details
              </Button>
            </Box>
          </CardContent>
        </Card>
      );
    } else if (item.type === 'group') {
      // Grouped schedule display
      const template = item.template;
      
      return (
        <Card key={`group-${item.schedules[0].id}`} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="h6" component="h2">
                    {template.name}
                  </Typography>
                  <Chip 
                    label={`${item.schedules.length} schedules`} 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1 }} 
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <LanguageIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {item.siteName}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <DescriptionIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {(template.prompt_template?.name || template.prompt?.name) || "No template assigned"}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <TodayIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">
                    Weekly ({formatDays(item.days)}) at {formatTime(template.time_of_day)}
                  </Typography>
                </Box>
              </Box>
              
              <Box>
                <Stack direction="row" spacing={1}>
                  {item.schedules.map((s, index) => (
                    <Tooltip key={s.id} title={`${getDayName(s.day_of_week)} schedule`}>
                      <Badge color={s.is_active ? "success" : "error"} variant="dot">
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem' }}>
                          {getDayName(s.day_of_week).charAt(0)}
                        </Avatar>
                      </Badge>
                    </Tooltip>
                  ))}
                </Stack>
                
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, item.schedules[0].id)}
                  aria-label="schedule options"
                  sx={{ mt: 1 }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                component={RouterLink}
                to={`/schedules/${item.schedules[0].id}`}
                variant="contained"
                size="small"
                endIcon={<ArrowForwardIcon />}
              >
                View Details
              </Button>
            </Box>
          </CardContent>
        </Card>
      );
    }
    
    return null;
  };
  
  useEffect(() => {
    fetchSchedules();
  }, []);
  
  if (loading) {
    return <LoadingState message="Loading schedules..." />;
  }
  
  if (error) {
    return (
      <ErrorState
        message="Error Loading Schedules"
        details={error}
        onRetry={fetchSchedules}
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title="Content Schedules"
        description="Automate content creation with scheduled blog posts"
        actionButton={true}
        actionButtonText="New Schedule"
        actionButtonLink="/schedules/new"
        actionButtonIcon={<AddIcon />}
      />
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search schedules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>
      
      {groupedSchedules.length === 0 ? (
        <EmptyState
          title="No Schedules Found"
          description="Create your first content schedule to automate blog post creation"
          actionText="Create Schedule"
          actionLink="/schedules/new"
          actionIcon={<AddIcon />}
        />
      ) : (
        <Box>
          {groupedSchedules.map(item => renderScheduleCard(item))}
        </Box>
      )}
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          component={RouterLink} 
          to={`/schedules/${selectedScheduleId}`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <ArrowForwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem 
          component={RouterLink} 
          to={`/schedules/${selectedScheduleId}/edit`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleRunNowFromMenu()}>
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Run Now</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleDeleteFromMenu()}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Schedule"
        content={`Are you sure you want to delete "${scheduleToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteSchedule}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default SchedulesList; 