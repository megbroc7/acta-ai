import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Autocomplete,
  Chip,
  RadioGroup,
  Radio,
  FormLabel,
  Paper,
  IconButton,
  Tooltip,
  Checkbox,
  Divider,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import api from '../../services/api';
import { useSnackbar } from 'notistack';

// Frequency options
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

// Days of week
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Post status options
const POST_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'publish', label: 'Published' },
];

// Frequency help text
const FREQUENCY_HELP_TEXT = {
  daily: "Limited to one daily schedule per account",
  weekly: "Limited to one schedule per day of the week",
  monthly: "Limited to one schedule per day of the month",
  custom: "Use cron syntax for custom scheduling"
};

// Helper function to get the day name from value
const getDayName = (dayValue) => {
  const day = DAYS_OF_WEEK.find(d => d.value.toString() === dayValue.toString());
  return day ? day.label : 'Unknown';
};

// Helper function to parse a time string (HH:MM) into a Date object
const parseTimeString = (timeString) => {
  if (!timeString) return null;
  
  try {
    const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    return date;
  } catch (error) {
    console.error('Error parsing time string:', error);
    return null;
  }
};

// Helper function to format the list of selected days for user feedback
const formatSelectedDays = (dayValues) => {
  if (!dayValues || dayValues.length === 0) return '';
  
  const dayNames = dayValues.map(d => getDayName(d));
  
  if (dayNames.length === 1) return dayNames[0];
  if (dayNames.length === 2) return `${dayNames[0]} and ${dayNames[1]}`;
  
  const lastDay = dayNames.pop();
  return `${dayNames.join(', ')}, and ${lastDay}`;
};

// Helper to safely handle API error objects - specific to this component
const getSafeScheduleErrorMessage = (error) => {
  // If already a string, just return it
  if (typeof error === 'string') return error;
  
  // Handle FastAPI validation error structure
  if (error && typeof error === 'object') {
    // If it's the specific object structure we're seeing
    if (error.type && error.loc && error.msg) {
      return error.msg;
    }
    
    // Handle array of validation errors
    if (Array.isArray(error)) {
      return error.map(err => 
        err.msg || (typeof err === 'string' ? err : JSON.stringify(err))
      ).join('. ');
    }
  }
  
  // Fallback to string coercion, but avoid [object Object]
  return error?.toString?.() !== '[object Object]' 
    ? error?.toString?.() 
    : 'Validation error occurred. Please check your form.';
};

const ScheduleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [sites, setSites] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [promptVariables, setPromptVariables] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  
  const { enqueueSnackbar } = useSnackbar();
  
  // Initial form values
  const initialValues = {
    site_id: '',
    prompt_template_id: '',
    topics: '',
    name: '',
    frequency: 'daily',
    day_of_week: '1', // Monday
    day_of_month: '1',
    time: new Date(new Date().setHours(9, 0, 0, 0)),
    hour: 9,
    minute: 0,
    time_of_day: '09:00',
    post_status: 'publish',
    categories: [],
    tags: [],
    category_ids: [],
    tag_ids: [],
    word_count: 800,
    tone: 'professional',
    prompt_replacements: {},
    variable_values: {},
    is_active: true
  };
  
  // Form validation schema
  const validationSchema = Yup.object({
    site_id: Yup.string().required('Site is required'),
    prompt_template_id: Yup.string().required('Prompt Template is required'),
    name: Yup.string().required('Name is required'),
    frequency: Yup.string().required('Frequency is required'),
    day_of_week: Yup.string()
      .when('frequency', {
        is: 'weekly',
        then: () => Yup.string().required('Day of week is required'),
        otherwise: () => Yup.string().nullable(),
      }),
    day_of_month: Yup.string()
      .when('frequency', {
        is: 'monthly',
        then: () => Yup.string().required('Day of month is required'),
        otherwise: () => Yup.string().nullable(),
      }),
    time_of_day: Yup.string().required('Time is required')
  });
  
  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    setSubmitting(true);
    setError(null);
    
    try {
      // Prepare data for API
      const apiData = { ...values };
      
      // Ensure topics is always an array before submission
      if (typeof apiData.topics === 'string') {
        // If it's a non-empty string, split by newlines
        apiData.topics = apiData.topics.trim() !== '' 
          ? apiData.topics.split('\n').filter(topic => topic.trim() !== '')
          : [];
      } else if (!Array.isArray(apiData.topics)) {
        // If it's neither string nor array, use empty array
        apiData.topics = [];
      }
      
      // If we're editing, just update the existing schedule
      if (isEditMode) {
        await api.put(`/api/schedules/${id}`, apiData);
        navigate('/schedules');
        enqueueSnackbar(`Schedule updated successfully`, { variant: 'success' });
      } else {
        await api.post('/api/schedules/', apiData);
        navigate('/schedules');
        enqueueSnackbar(`Schedule created successfully`, { variant: 'success' });
      }
    } catch (err) {
      // Extract the error following existing pattern
      const errorDetail = err.response?.data?.detail || 
                        err.message || 
                        'Failed to save schedule. Please try again.';
      
      // Apply safe conversion for the Alert component
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      setError(safeErrorMessage);
      
      // Use original error detail for the snackbar
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error saving schedule:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Fetch schedule data
  const fetchSchedule = useCallback(async (scheduleId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/schedules/${scheduleId}`);
      const data = response.data;
      
      // Debug: Log full schedule data from API
      console.log('Schedule data from API:', data);
      console.log('Site ID in API response:', data.site_id);
      console.log('Site object in API response:', data.site);
      
      // Debug: Check if site_id in response matches any available site
      if (data.site_id) {
        console.log(`Checking if site_id ${data.site_id} exists in available sites`);
      }
      
      // Prepare form data
      const formData = {
        ...data,
        site_id: data.site_id?.toString() || '',
        prompt_template_id: (data.prompt?.id?.toString() || data.prompt_template_id?.toString() || ''),
        day_of_week: data.day_of_week ? data.day_of_week.toString() : '1',
        day_of_month: data.day_of_month ? data.day_of_month.toString() : '1',
        time: parseTimeString(data.time_of_day || '09:00'),
        hour: parseInt(data.time_of_day?.split(':')[0] || '9'),
        minute: parseInt(data.time_of_day?.split(':')[1] || '0'),
        category_ids: data.category_ids || [],
        tag_ids: data.tag_ids || [],
        topics: Array.isArray(data.topics) ? data.topics.join('\n') : '',
        prompt_replacements: data.prompt_replacements || {},
        variable_values: data.variable_values || {}
      };
      
      // Debug: Log processed form data
      console.log('Processed form data:', formData);
      console.log('site_id in form data:', formData.site_id);
      
      setSchedule(data);
      return formData;
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 
                       err.message || 
                       'Failed to load schedule data';
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      setError(safeErrorMessage);
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error loading schedule:', err);
      return initialValues;
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  // Fetch sites
  const fetchSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const response = await api.get('/api/sites/');
      // Debug: Log sites from API
      console.log('Sites loaded from API:', response.data);
      
      // Debug: Carefully examine each site object structure
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((site, index) => {
          console.log(`Site ${index} structure:`, {
            id: site.id,
            name: site.name,
            url: site.url,
            // Add other key properties to examine
          });
        });
      }
      
      setSites(response.data);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 
                       err.message || 
                       'Failed to load sites. Please try again.';
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error fetching sites:', err);
    } finally {
      setLoadingSites(false);
    }
  }, [enqueueSnackbar]);

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    setLoadingPrompts(true);
    try {
      const response = await api.get('/api/templates/');
      setPrompts(response.data);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 
                       err.message || 
                       'Failed to load prompts. Please try again.';
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error fetching prompts:', err);
    } finally {
      setLoadingPrompts(false);
    }
  }, [enqueueSnackbar]);
  
  // Fetch categories
  const fetchCategories = useCallback(async (siteId) => {
    setLoadingCategories(true);
    try {
      // Check if site is connected first by checking localStorage
      const isConnected = localStorage.getItem(`site_${siteId}_connected`) === 'true';
      
      if (!isConnected) {
        // If site is not connected, don't try to fetch categories
        console.log('Site is not connected. Skipping category fetch.');
        setCategories([]);
        return;
      }
      
      const response = await api.get(`/api/sites/${siteId}/categories`);
      // Use an empty array as fallback to ensure we never set undefined
      setCategories(response.data || []);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 
                       err.message || 
                       'Failed to load categories. Please try again.';
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error fetching categories:', err);
      // Set empty categories on error, never undefined
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, [enqueueSnackbar]);

  // Fetch tags
  const fetchTags = useCallback(async (siteId) => {
    setLoadingTags(true);
    try {
      // Check if site is connected first by checking localStorage
      const isConnected = localStorage.getItem(`site_${siteId}_connected`) === 'true';
      
      if (!isConnected) {
        // If site is not connected, don't try to fetch tags
        console.log('Site is not connected. Skipping tag fetch.');
        setTags([]);
        return;
      }
      
      const response = await api.get(`/api/sites/${siteId}/tags`);
      // Use an empty array as fallback to ensure we never set undefined
      setTags(response.data || []);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || 
                       err.message || 
                       'Failed to load tags. Please try again.';
      const safeErrorMessage = getSafeScheduleErrorMessage(errorDetail);
      enqueueSnackbar(safeErrorMessage, { variant: 'error' });
      console.error('Error fetching tags:', err);
      // Set empty tags on error, never undefined
      setTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [enqueueSnackbar]);
  
  // useEffect to load initial data
  useEffect(() => {
    console.log('useEffect for initial data load triggered');
    fetchSites();
    fetchPrompts();
    
    if (isEditMode && id) {
      console.log('Fetching schedule in edit mode, id:', id);
      fetchSchedule(id);
    }
  }, [isEditMode, id, fetchSchedule, fetchSites, fetchPrompts]);
  
  // useEffect to load categories and tags when schedule is loaded
  useEffect(() => {
    if (schedule && schedule.site_id) {
      console.log('Loading data for site_id:', schedule.site_id, 'type:', typeof schedule.site_id);
      fetchCategories(schedule.site_id);
      fetchTags(schedule.site_id);
    }
  }, [isEditMode, schedule, fetchCategories, fetchTags]);
  
  // Initialize selectedDays when in edit mode
  useEffect(() => {
    if (isEditMode && schedule) {
      // If editing an existing schedule, initialize with the current day
      setSelectedDays([schedule.day_of_week?.toString()]);
    }
  }, [isEditMode, schedule]);
  
  // Fetch categories and tags when site changes
  const handleSiteChange = (siteId, setFieldValue) => {
    // Debug: Log site change event
    console.log('handleSiteChange called with siteId:', siteId, 'type:', typeof siteId);
    
    // Convert to string and ensure value is set properly
    const siteIdStr = siteId.toString();
    
    // Store the selected site ID in localStorage to prevent it from being reset
    localStorage.setItem(`schedule_edit_site_id_${id || 'new'}`, siteIdStr);
    
    setFieldValue('site_id', siteIdStr);
    
    console.log('Site changed to:', siteIdStr);
    
    // Always reset to empty arrays, never undefined
    setFieldValue('categories', []);
    setFieldValue('tags', []);
    
    // Ensure the form knows the field has been touched to trigger validation
    setTimeout(() => {
      setFieldValue('site_id', siteIdStr, true); // Third param triggers validation
    }, 0);
    
    // Set loading states before fetching
    setLoadingCategories(true);
    setLoadingTags(true);
    
    // Check if the site is connected
    const isConnected = localStorage.getItem(`site_${siteId}_connected`) === 'true';
    
    if (!isConnected) {
      // If not connected, show a warning
      enqueueSnackbar('This WordPress site is not connected. You may not be able to fetch categories or tags.', { 
        variant: 'warning',
        autoHideDuration: 6000
      });
    }
    
    // Fetch data
    fetchCategories(siteId);
    fetchTags(siteId);
  };
  
  // Update variable values when prompt changes
  const handlePromptChange = (promptId, setFieldValue) => {
    // Convert to string to ensure consistent type handling
    const promptIdString = promptId?.toString() || '';
    
    setFieldValue('prompt_template_id', promptIdString);
    
    // Find the selected prompt - use string comparison for consistency
    const selectedPrompt = prompts.find(p => p.id.toString() === promptIdString);
    
    // Initialize variable values with default values
    if (selectedPrompt && selectedPrompt.variables) {
      const variableValues = {};
      
      // Initialize promptReplacements object from template variables
      let foundBlogTopic = false;
      const promptReplacements = {};
      
      selectedPrompt.variables.forEach(variable => {
        variableValues[variable.key] = variable.default_value || '';
        
        // Check for blog_topic variable (case insensitive)
        if (variable.key.toLowerCase() === 'blog_topic' || 
            variable.name?.toLowerCase().includes('blog topic')) {
          promptReplacements.blog_topic = variable.default_value || '';
          foundBlogTopic = true;
        }
      });
      
      // Only update prompt_replacements if we found a blog_topic
      if (foundBlogTopic) {
        console.log('Setting blog_topic to:', promptReplacements.blog_topic);
        setFieldValue('prompt_replacements', promptReplacements);
      }
      
      setFieldValue('variable_values', variableValues);
    } else {
      // If no variables in the new prompt, provide an empty object
      // to avoid validation issues
      setFieldValue('variable_values', {});
    }
    
    // Make sure to run validations after changing values
    // This ensures isValid gets updated correctly
    setTimeout(() => {
      setFieldValue('prompt_template_id', promptIdString, true);
    }, 0);
  };
  
  // Try to get stored site_id from localStorage
  const storedSiteId = localStorage.getItem(`schedule_edit_site_id_${id || 'new'}`);
  
  // Prepare form values for edit mode
  const formInitialValues = isEditMode && schedule ? {
    name: schedule.name,
    // For site_id, use stored value if available, otherwise use schedule.site_id
    site_id: storedSiteId || schedule.site_id?.toString() || '',
    // For prompt_template_id, use prompt.id or fall back to prompt_template_id
    prompt_template_id: (schedule.prompt?.id?.toString() || schedule.prompt_template_id?.toString() || ''),
    frequency: schedule.frequency,
    time: schedule.time_of_day ? parseTimeString(schedule.time_of_day) : new Date(),
    time_of_day: schedule.time_of_day || '09:00',
    day_of_week: schedule.day_of_week?.toString() || '1',
    day_of_month: schedule.day_of_month?.toString() || '1',
    post_status: schedule.post_status || 'draft',
    topics: Array.isArray(schedule.topics) ? schedule.topics.join('\n') : '',
    word_count: schedule.word_count || 800,
    tone: schedule.tone || 'professional',
    categories: schedule.categories || [],
    tags: schedule.tags || [],
    category_ids: schedule.category_ids || [],
    tag_ids: schedule.tag_ids || [],
    include_images: schedule.include_images || false,
    enable_review: schedule.enable_review !== false,
    is_active: schedule.is_active !== false,
    variable_values: schedule.variable_values || {},
    prompt_replacements: schedule.prompt_replacements || {}
  } : initialValues;
  
  // Log the form values and see when they change
  console.log('Form initial values calculated:', formInitialValues);
  console.log('Form initial site_id:', formInitialValues.site_id);
  
  if (loading) {
    return <LoadingState message="Loading schedule..." />;
  }
  
  if (isEditMode && error) {
    return (
      <ErrorState
        message="Error Loading Schedule"
        details={error}
        onRetry={() => fetchSchedule(id)}
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title={isEditMode ? 'Edit Schedule' : 'Create Schedule'}
        breadcrumbs={[
          { text: 'Content Schedules', link: '/schedules' },
          { text: isEditMode ? 'Edit Schedule' : 'New Schedule' },
        ]}
        actionButton={true}
        actionButtonText="Back to Schedules"
        actionButtonLink="/schedules"
        actionButtonIcon={<ArrowBackIcon />}
        actionButtonVariant="outlined"
      />
      
      {submitting && <LoadingState message="Saving schedule..." />}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof error === 'string' ? error : getSafeScheduleErrorMessage(error)}
        </Alert>
      )}
      
      <Formik
        initialValues={formInitialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {(formik) => {
          console.log('Formik values:', formik.values);
          console.log('Available sites:', sites);
          
          return (
          <Form>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          fullWidth
                          label="Schedule Name"
                          name="name"
                          variant="outlined"
                          error={formik.touched.name && Boolean(formik.errors.name)}
                          helperText={formik.touched.name && formik.errors.name}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.site_id && Boolean(formik.errors.site_id)}
                          disabled={submitting || loadingSites}
                        >
                          <InputLabel>WordPress Site</InputLabel>
                          <Select
                            id="site_id"
                            name="site_id"
                            value={formik.values.site_id || ""}
                            onChange={(e) => handleSiteChange(e.target.value, formik.setFieldValue)}
                            onBlur={formik.handleBlur}
                            label="WordPress Site"
                          >
                            {/* Debug: Log currently selected site_id and the current sites array */}
                            {console.log('Rendering site dropdown with selected value:', formik.values.site_id)}
                            {console.log('Current sites array when rendering dropdown:', JSON.stringify(sites))}
                            
                            {loadingSites ? (
                              <MenuItem disabled>Loading sites...</MenuItem>
                            ) : sites.length === 0 ? (
                              <MenuItem disabled>No sites available</MenuItem>
                            ) : (
                              sites.map((site) => {
                                // Debug: Log each site option
                                console.log(`Site option: id=${site.id}, name=${site.name}, value=${site.id.toString()}`);
                                return (
                                  <MenuItem key={site.id} value={site.id.toString()}>
                                    {site.name}
                                  </MenuItem>
                                );
                              })
                            )}
                          </Select>
                          {formik.touched.site_id && formik.errors.site_id && (
                            <FormHelperText>{formik.errors.site_id}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.prompt_template_id && Boolean(formik.errors.prompt_template_id)}
                          disabled={submitting || loadingPrompts}
                        >
                          <InputLabel>Prompt Template</InputLabel>
                          <Select
                            id="prompt_template_id"
                            name="prompt_template_id"
                            value={formik.values.prompt_template_id}
                            onChange={(e) => handlePromptChange(e.target.value, formik.setFieldValue)}
                            onBlur={formik.handleBlur}
                            label="Prompt Template"
                          >
                            {loadingPrompts ? (
                              <MenuItem disabled>Loading prompts...</MenuItem>
                            ) : prompts.length === 0 ? (
                              <MenuItem disabled>No prompts available</MenuItem>
                            ) : (
                              prompts.map((prompt) => (
                                <MenuItem key={prompt.id} value={prompt.id.toString()}>
                                  {prompt.name}
                                </MenuItem>
                              ))
                            )}
                          </Select>
                          {formik.touched.prompt_template_id && formik.errors.prompt_template_id && (
                            <FormHelperText>{formik.errors.prompt_template_id}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              id="is_active"
                              name="is_active"
                              checked={formik.values.is_active}
                              onChange={formik.handleChange}
                              disabled={submitting}
                              color="primary"
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography>
                                {formik.values.is_active ? 'Active' : 'Inactive'}
                              </Typography>
                              <Tooltip title={formik.values.is_active ? 'Schedule is active and will run automatically' : 'Schedule is paused and will not run automatically'}>
                                <IconButton size="small">
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          }
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Schedule Settings */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Scheduling Options
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 3, backgroundColor: '#e8f5e9', '& .MuiAlert-icon': { color: '#4caf50' } }}>
                      <strong>How scheduling works:</strong>
                      <ul style={{ margin: '5px 0 0 20px', paddingLeft: 0 }}>
                        <li><strong>Daily:</strong> Creates posts every day at the specified time</li>
                        <li><strong>Weekly:</strong> Creates posts on one specific day each week</li>
                        <li><strong>Monthly:</strong> Creates posts on one specific day each month</li>
                      </ul>
                      To post on multiple days, you'll need to create separate schedules for each day.
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.frequency && Boolean(formik.errors.frequency)}
                          disabled={submitting}
                        >
                          <InputLabel>Frequency</InputLabel>
                          <Select
                            id="frequency"
                            name="frequency"
                            value={formik.values.frequency}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            label="Frequency"
                          >
                            {FREQUENCY_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                          {formik.touched.frequency && formik.errors.frequency ? (
                            <FormHelperText>{formik.errors.frequency}</FormHelperText>
                          ) : (
                            <FormHelperText>{FREQUENCY_HELP_TEXT[formik.values.frequency]}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <TimePicker
                            label="Time"
                            value={formik.values.time}
                            onChange={(value) => {
                              formik.setFieldValue('time', value);
                              // Also update time_of_day for API submission
                              if (value) {
                                const hours = value.getHours().toString().padStart(2, '0');
                                const minutes = value.getMinutes().toString().padStart(2, '0');
                                formik.setFieldValue('time_of_day', `${hours}:${minutes}`);
                              }
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                fullWidth
                                error={formik.touched.time && Boolean(formik.errors.time)}
                                helperText={formik.touched.time && formik.errors.time}
                                disabled={submitting}
                              />
                            )}
                          />
                        </LocalizationProvider>
                      </Grid>
                      
                      {formik.values.frequency === 'weekly' && (
                        <Grid item xs={12}>
                          <FormControl 
                            fullWidth
                            error={formik.touched.day_of_week && Boolean(formik.errors.day_of_week)}
                            disabled={submitting}
                          >
                            <InputLabel>Day of Week</InputLabel>
                            <Select
                              id="day_of_week"
                              name="day_of_week"
                              value={formik.values.day_of_week}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              label="Day of Week"
                            >
                              {DAYS_OF_WEEK.map((day) => (
                                <MenuItem key={day.value} value={day.value.toString()}>
                                  {day.label}
                                </MenuItem>
                              ))}
                            </Select>
                            {formik.touched.day_of_week && formik.errors.day_of_week && (
                              <FormHelperText>{formik.errors.day_of_week}</FormHelperText>
                            )}
                          </FormControl>
                        </Grid>
                      )}
                      
                      {formik.values.frequency === 'monthly' && (
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            id="day_of_month"
                            name="day_of_month"
                            label="Day of Month"
                            type="number"
                            InputProps={{ inputProps: { min: 1, max: 28 } }}
                            value={formik.values.day_of_month}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            error={formik.touched.day_of_month && Boolean(formik.errors.day_of_month)}
                            helperText={
                              (formik.touched.day_of_month && formik.errors.day_of_month) ||
                              "Choose a day between 1-28 to avoid month-end issues"
                            }
                            disabled={submitting}
                          />
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.post_status && Boolean(formik.errors.post_status)}
                          disabled={submitting}
                        >
                          <FormLabel>Post Status</FormLabel>
                          <RadioGroup
                            id="post_status"
                            name="post_status"
                            value={formik.values.post_status}
                            onChange={formik.handleChange}
                          >
                            {POST_STATUS_OPTIONS.map((option) => (
                              <FormControlLabel
                                key={option.value}
                                value={option.value}
                                control={<Radio />}
                                label={option.label}
                                disabled={submitting}
                              />
                            ))}
                          </RadioGroup>
                          {formik.touched.post_status && formik.errors.post_status && (
                            <FormHelperText>{formik.errors.post_status}</FormHelperText>
                          )}
                        </FormControl>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Categories and Tags */}
              <Grid item xs={12} md={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Categories and Tags
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 2, backgroundColor: '#e8f5e9', '& .MuiAlert-icon': { color: '#4caf50' } }}>
                      These are pulled from your WordPress site. Need a new category or tag? Create it in WordPress first.
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Autocomplete
                          multiple
                          id="categories"
                          options={categories}
                          getOptionLabel={(option) => option.name}
                          value={formik.values.categories}
                          onChange={(event, newValue) => {
                            formik.setFieldValue('categories', newValue);
                          }}
                          loading={loadingCategories}
                          disabled={submitting || !formik.values.site_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Categories"
                              placeholder="Select categories"
                              helperText="Select categories for the generated posts"
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => {
                              const tagProps = getTagProps({ index });
                              // Extract key from tagProps if it exists
                              const { key, ...otherProps } = tagProps;
                              return (
                                <Chip
                                  key={key || option.id || `category-${index}`}
                                  label={option.name}
                                  {...otherProps}
                                  disabled={submitting}
                                />
                              );
                            })
                          }
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Autocomplete
                          multiple
                          id="tags"
                          options={tags}
                          getOptionLabel={(option) => option.name}
                          value={formik.values.tags}
                          onChange={(event, newValue) => {
                            formik.setFieldValue('tags', newValue);
                          }}
                          loading={loadingTags}
                          disabled={submitting || !formik.values.site_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Tags"
                              placeholder="Select tags"
                              helperText="Select tags for the generated posts"
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => {
                              const tagProps = getTagProps({ index });
                              // Extract key from tagProps if it exists
                              const { key, ...otherProps } = tagProps;
                              return (
                                <Chip
                                  key={key || option.id || `tag-${index}`}
                                  label={option.name}
                                  {...otherProps}
                                  disabled={submitting}
                                />
                              );
                            })
                          }
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Unified Prompt Variables - Clean Implementation */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Prompt Variables
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 2 }}>
                      These variables will be used when generating content with this template.
                    </Alert>
                    
                    <Grid container spacing={3}>
                      {/* Core Content Variables - Always show these */}
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          id="blog_topic"
                          name="prompt_replacements.blog_topic"
                          label="Blog Topic"
                          value={formik.values.prompt_replacements?.blog_topic || ''}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            formik.setFieldValue('prompt_replacements', {
                              ...formik.values.prompt_replacements,
                              blog_topic: newValue
                            });
                          }}
                          helperText="The specific title or subject of your blog post"
                          disabled={submitting}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          id="word_count"
                          name="word_count"
                          label="Word Count"
                          type="number"
                          value={formik.values.word_count || 800}
                          onChange={formik.handleChange}
                          helperText="How long the blog post should be"
                          disabled={submitting}
                          InputProps={{
                            inputProps: { min: 300, max: 2500 }
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth disabled={submitting}>
                          <InputLabel>Tone</InputLabel>
                          <Select
                            id="tone"
                            name="tone"
                            value={formik.values.tone || 'professional'}
                            onChange={formik.handleChange}
                            label="Tone"
                          >
                            <MenuItem value="professional">Professional</MenuItem>
                            <MenuItem value="casual">Casual</MenuItem>
                            <MenuItem value="friendly">Friendly</MenuItem>
                            <MenuItem value="authoritative">Authoritative</MenuItem>
                            <MenuItem value="informative">Informative</MenuItem>
                          </Select>
                          <FormHelperText>The writing style for the blog post</FormHelperText>
                        </FormControl>
                      </Grid>
                      
                      {/* Extra Template Variables - Only if there are *true* unique ones */}
                      {(() => {
                        // Only run this if a template is selected
                        if (!formik.values.prompt_template_id) return null;
                        
                        const template = prompts.find(p => p.id?.toString() === formik.values.prompt_template_id);
                        const templateVariables = template?.variables || [];
                        
                        // Only show true unique variables (not blog_topic/tone/word_count)
                        // Use a case-insensitive, fuzzy-match approach to be safer
                        const standardVarPatterns = [/blog.*topic/i, /word.*count/i, /tone/i];
                        
                        const uniqueTemplateVariables = templateVariables.filter(variable => {
                          // Check if this variable appears to be one of our standard ones
                          const isStandard = standardVarPatterns.some(pattern => 
                            pattern.test(variable.key) || pattern.test(variable.name)
                          );
                          return !isStandard;
                        });
                        
                        // Only render this section if we actually have unique variables
                        if (uniqueTemplateVariables.length === 0) return null;
                        
                        return (
                          <>
                            <Grid item xs={12}>
                              <Divider sx={{ my: 2 }} />
                            </Grid>
                            
                            {/* Render each unique template variable */}
                            {uniqueTemplateVariables.map((variable) => (
                              <Grid item xs={12} md={6} key={variable.key}>
                                {variable.type === 'text' && (
                                  <TextField
                                    fullWidth
                                    id={`variable_values.${variable.key}`}
                                    name={`variable_values.${variable.key}`}
                                    label={variable.name}
                                    value={formik.values.variable_values[variable.key] || ''}
                                    onChange={formik.handleChange}
                                    helperText={variable.description}
                                    disabled={submitting}
                                  />
                                )}
                                
                                {/* Other variable types... */}
                                {variable.type === 'number' && (
                                  <TextField
                                    fullWidth
                                    id={`variable_values.${variable.key}`}
                                    name={`variable_values.${variable.key}`}
                                    label={variable.name}
                                    type="number"
                                    value={formik.values.variable_values[variable.key] || ''}
                                    onChange={formik.handleChange}
                                    helperText={variable.description}
                                    disabled={submitting}
                                  />
                                )}
                                
                                {variable.type === 'select' && (
                                  <FormControl fullWidth disabled={submitting}>
                                    <InputLabel>{variable.name}</InputLabel>
                                    <Select
                                      id={`variable_values.${variable.key}`}
                                      name={`variable_values.${variable.key}`}
                                      value={formik.values.variable_values[variable.key] || ''}
                                      onChange={formik.handleChange}
                                      label={variable.name}
                                    >
                                      {variable.options.map((option) => (
                                        <MenuItem key={option} value={option}>
                                          {option}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                    <FormHelperText>{variable.description}</FormHelperText>
                                  </FormControl>
                                )}
                                
                                {variable.type === 'multiselect' && (
                                  <Autocomplete
                                    multiple
                                    id={`variable_values.${variable.key}`}
                                    options={variable.options}
                                    value={formik.values.variable_values[variable.key] || []}
                                    onChange={(event, newValue) => {
                                      formik.setFieldValue(`variable_values.${variable.key}`, newValue);
                                    }}
                                    disabled={submitting}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label={variable.name}
                                        placeholder="Select options"
                                        helperText={variable.description}
                                      />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                      value.map((option, index) => {
                                        const tagProps = getTagProps({ index });
                                        // Extract key from tagProps if it exists
                                        const { key, ...otherProps } = tagProps;
                                        return (
                                          <Chip
                                            key={key || option.id || `tag-${index}`}
                                            label={option}
                                            {...otherProps}
                                            disabled={submitting}
                                          />
                                        );
                                      })
                                    }
                                  />
                                )}
                                
                                {variable.type === 'boolean' && (
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        id={`variable_values.${variable.key}`}
                                        name={`variable_values.${variable.key}`}
                                        checked={Boolean(formik.values.variable_values[variable.key])}
                                        onChange={formik.handleChange}
                                        disabled={submitting}
                                      />
                                    }
                                    label={
                                      <Box>
                                        <Typography>{variable.name}</Typography>
                                        <Typography variant="caption" color="textSecondary">
                                          {variable.description}
                                        </Typography>
                                      </Box>
                                    }
                                  />
                                )}
                              </Grid>
                            ))}
                          </>
                        );
                      })()}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Submit Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {/* Debug info - will show errors if button is disabled */}
                  {!formik.isValid && (
                    <Box sx={{ 
                      color: 'error.main', 
                      mr: 2, 
                      mb: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'error.light',
                      borderRadius: 1
                    }}>
                      <Typography variant="subtitle2">Form has validation errors:</Typography>
                      <pre>{JSON.stringify(formik.errors, null, 2)}</pre>
                    </Box>
                  )}
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    type="submit"
                    disabled={submitting || !formik.isValid}
                    sx={{ minWidth: 150 }}
                  >
                    {submitting ? 'Saving...' : isEditMode ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Form>
          );
        }}
      </Formik>
    </Box>
  );
};

export default ScheduleForm; 