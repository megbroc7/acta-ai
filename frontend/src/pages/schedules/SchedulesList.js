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
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

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
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/v1/schedules');
      setSchedules(response.data);
    } catch (err) {
      setError('Failed to load schedules. Please try again.');
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMenuOpen = (event, scheduleId) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedScheduleId(scheduleId);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
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
      await api.delete(`/api/v1/schedules/${scheduleToDelete.id}`);
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
      const newStatus = !currentStatus;
      await api.patch(`/api/v1/schedules/${scheduleId}`, {
        is_active: newStatus
      });
      
      // Update the local state
      setSchedules(schedules.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, is_active: newStatus } 
          : schedule
      ));
    } catch (err) {
      console.error('Error updating schedule status:', err);
    } finally {
      setStatusUpdateLoading(null);
    }
  };
  
  const runScheduleNow = async (scheduleId) => {
    try {
      await api.post(`/api/v1/schedules/${scheduleId}/run-now`);
      // Optionally show a success message or update the UI
    } catch (err) {
      console.error('Error running schedule:', err);
    }
    handleMenuClose();
  };
  
  const filteredSchedules = schedules.filter(schedule => 
    schedule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (schedule.description && schedule.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (schedule.site && schedule.site.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
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
      
      {schedules.length === 0 ? (
        <EmptyState
          title="No Schedules Yet? Time to Plan Ahead!"
          description="Your content calendar is looking emptier than a beach in winter! Create a schedule and let AI handle your content creation while you sip your favorite beverage."
          actionText="Create Schedule"
          actionLink="/schedules/new"
          actionIcon={<AddIcon />}
        />
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
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
          </Box>
          
          {filteredSchedules.length === 0 ? (
            <EmptyState
              title="No Matching Schedules"
              description={`No schedules match "${searchTerm}". Try a different search term.`}
              actionText="Clear Search"
              actionOnClick={() => setSearchTerm('')}
            />
          ) : (
            <Grid container spacing={3}>
              {filteredSchedules.map((schedule) => (
                <Grid item xs={12} md={6} lg={4} key={schedule.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h2" noWrap>
                          {schedule.name}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, schedule.id)}
                          aria-label="schedule options"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <LanguageIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" noWrap>
                          {schedule.site ? schedule.site.name : 'No site assigned'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <ScheduleIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2">
                          {formatFrequency(schedule.frequency)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <DescriptionIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" noWrap>
                          {schedule.prompt ? schedule.prompt.name : 'No prompt template assigned'}
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Box>
                          <Typography variant="caption" display="block" color="text.secondary">
                            Next Run:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {formatNextRun(schedule.next_run_at)}
                          </Typography>
                        </Box>
                        
                        <FormControlLabel
                          control={
                            <Switch
                              checked={schedule.is_active}
                              onChange={() => toggleScheduleStatus(schedule.id, schedule.is_active)}
                              disabled={statusUpdateLoading === schedule.id}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Chip 
                              size="small" 
                              label={schedule.is_active ? "Active" : "Inactive"}
                              color={schedule.is_active ? "success" : "default"}
                            />
                          }
                          labelPlacement="start"
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                        <Button
                          component={RouterLink}
                          to={`/schedules/${schedule.id}`}
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                        >
                          View Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
      
      {/* Schedule Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          onClick={() => runScheduleNow(selectedScheduleId)}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Run Now</ListItemText>
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
        <Divider />
        <MenuItem 
          onClick={() => {
            const scheduleToDelete = schedules.find(s => s.id === selectedScheduleId);
            handleDeleteClick(scheduleToDelete);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Schedule"
        message={scheduleToDelete ? `Are you sure you want to delete "${scheduleToDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={deleteSchedule}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setScheduleToDelete(null);
        }}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default SchedulesList; 