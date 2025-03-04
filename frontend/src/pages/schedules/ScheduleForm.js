import React, { useState, useEffect } from 'react';
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
  Divider,
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
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import api from '../../services/api';

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

const ScheduleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [schedule, setSchedule] = useState(null);
  
  // Options for dropdowns
  const [sites, setSites] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  
  // Initial form values
  const initialValues = {
    name: '',
    site_id: '',
    prompt_id: '',
    frequency: 'daily',
    time: new Date(),
    days_of_week: [1], // Monday by default
    day_of_month: 1,
    post_status: 'draft',
    categories: [],
    tags: [],
    is_active: true,
    variable_values: {},
  };
  
  // Validation schema
  const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    site_id: Yup.string().required('WordPress site is required'),
    prompt_id: Yup.string().required('Prompt template is required'),
    frequency: Yup.string().required('Frequency is required'),
    time: Yup.date().required('Time is required'),
    days_of_week: Yup.array().when('frequency', {
      is: 'weekly',
      then: Yup.array().min(1, 'At least one day of the week is required'),
      otherwise: Yup.array(),
    }),
    day_of_month: Yup.number().when('frequency', {
      is: 'monthly',
      then: Yup.number()
        .required('Day of month is required')
        .min(1, 'Day must be between 1 and 28')
        .max(28, 'Day must be between 1 and 28'),
      otherwise: Yup.number(),
    }),
    post_status: Yup.string().required('Post status is required'),
  });
  
  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/v1/schedules/${id}`);
      setSchedule(response.data);
    } catch (err) {
      setError('Failed to load schedule. Please try again.');
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSites = async () => {
    setLoadingSites(true);
    
    try {
      const response = await api.get('/api/v1/sites');
      setSites(response.data);
    } catch (err) {
      console.error('Error fetching sites:', err);
    } finally {
      setLoadingSites(false);
    }
  };
  
  const fetchPrompts = async () => {
    setLoadingPrompts(true);
    
    try {
      const response = await api.get('/api/v1/prompts');
      setPrompts(response.data);
    } catch (err) {
      console.error('Error fetching prompts:', err);
    } finally {
      setLoadingPrompts(false);
    }
  };
  
  const fetchCategories = async (siteId) => {
    if (!siteId) {
      setCategories([]);
      return;
    }
    
    setLoadingCategories(true);
    
    try {
      const response = await api.get(`/api/v1/sites/${siteId}/categories`);
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };
  
  const fetchTags = async (siteId) => {
    if (!siteId) {
      setTags([]);
      return;
    }
    
    setLoadingTags(true);
    
    try {
      const response = await api.get(`/api/v1/sites/${siteId}/tags`);
      setTags(response.data);
    } catch (err) {
      console.error('Error fetching tags:', err);
    } finally {
      setLoadingTags(false);
    }
  };
  
  const handleSubmit = async (values, { setSubmitting }) => {
    setSaving(true);
    setError(null);
    
    try {
      // Format the time value
      const formattedValues = {
        ...values,
        time: values.time ? new Date(values.time).toISOString() : null,
      };
      
      if (isEditMode) {
        await api.put(`/api/v1/schedules/${id}`, formattedValues);
      } else {
        await api.post('/api/v1/schedules', formattedValues);
      }
      navigate('/schedules');
    } catch (err) {
      setError('Failed to save schedule. Please try again.');
      console.error('Error saving schedule:', err);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };
  
  useEffect(() => {
    fetchSites();
    fetchPrompts();
    
    if (isEditMode) {
      fetchSchedule();
    }
  }, [id, isEditMode]);
  
  // Fetch categories and tags when site changes
  const handleSiteChange = (siteId, setFieldValue) => {
    setFieldValue('site_id', siteId);
    setFieldValue('categories', []);
    setFieldValue('tags', []);
    
    fetchCategories(siteId);
    fetchTags(siteId);
  };
  
  // Update variable values when prompt changes
  const handlePromptChange = (promptId, setFieldValue) => {
    setFieldValue('prompt_id', promptId);
    setFieldValue('variable_values', {});
    
    // Find the selected prompt
    const selectedPrompt = prompts.find(p => p.id === promptId);
    
    // Initialize variable values with default values
    if (selectedPrompt && selectedPrompt.variables) {
      const variableValues = {};
      selectedPrompt.variables.forEach(variable => {
        variableValues[variable.key] = variable.default_value || '';
      });
      setFieldValue('variable_values', variableValues);
    }
  };
  
  if (loading) {
    return <LoadingState message="Loading schedule..." />;
  }
  
  if (isEditMode && error) {
    return (
      <ErrorState
        message="Error Loading Schedule"
        details={error}
        onRetry={fetchSchedule}
      />
    );
  }
  
  // Prepare form values for edit mode
  const formInitialValues = isEditMode && schedule ? {
    name: schedule.name,
    site_id: schedule.site_id,
    prompt_id: schedule.prompt_id,
    frequency: schedule.frequency,
    time: schedule.time ? new Date(schedule.time) : new Date(),
    days_of_week: schedule.days_of_week || [1],
    day_of_month: schedule.day_of_month || 1,
    post_status: schedule.post_status || 'draft',
    categories: schedule.categories || [],
    tags: schedule.tags || [],
    is_active: schedule.is_active,
    variable_values: schedule.variable_values || {},
  } : initialValues;
  
  // If editing, fetch categories and tags for the selected site
  useEffect(() => {
    if (isEditMode && schedule && schedule.site_id) {
      fetchCategories(schedule.site_id);
      fetchTags(schedule.site_id);
    }
  }, [isEditMode, schedule]);
  
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
      
      {saving && <LoadingState message="Saving schedule..." />}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Formik
        initialValues={formInitialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {(formik) => (
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
                          disabled={saving || loadingSites}
                        >
                          <InputLabel>WordPress Site</InputLabel>
                          <Select
                            id="site_id"
                            name="site_id"
                            value={formik.values.site_id}
                            onChange={(e) => handleSiteChange(e.target.value, formik.setFieldValue)}
                            onBlur={formik.handleBlur}
                            label="WordPress Site"
                          >
                            {loadingSites ? (
                              <MenuItem disabled>Loading sites...</MenuItem>
                            ) : sites.length === 0 ? (
                              <MenuItem disabled>No sites available</MenuItem>
                            ) : (
                              sites.map((site) => (
                                <MenuItem key={site.id} value={site.id}>
                                  {site.name}
                                </MenuItem>
                              ))
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
                          error={formik.touched.prompt_id && Boolean(formik.errors.prompt_id)}
                          disabled={saving || loadingPrompts}
                        >
                          <InputLabel>Prompt Template</InputLabel>
                          <Select
                            id="prompt_id"
                            name="prompt_id"
                            value={formik.values.prompt_id}
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
                                <MenuItem key={prompt.id} value={prompt.id}>
                                  {prompt.name}
                                </MenuItem>
                              ))
                            )}
                          </Select>
                          {formik.touched.prompt_id && formik.errors.prompt_id && (
                            <FormHelperText>{formik.errors.prompt_id}</FormHelperText>
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
                              disabled={saving}
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
                    
                    <Alert severity="info" sx={{ mb: 3 }}>
                      Note: You can only have one active schedule per day. This means one daily schedule,
                      one schedule per each day of the week, or one schedule per each day of the month.
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.frequency && Boolean(formik.errors.frequency)}
                          disabled={saving}
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
                            onChange={(value) => formik.setFieldValue('time', value)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                fullWidth
                                error={formik.touched.time && Boolean(formik.errors.time)}
                                helperText={formik.touched.time && formik.errors.time}
                                disabled={saving}
                              />
                            )}
                          />
                        </LocalizationProvider>
                      </Grid>
                      
                      {formik.values.frequency === 'weekly' && (
                        <Grid item xs={12}>
                          <FormControl 
                            fullWidth
                            error={formik.touched.days_of_week && Boolean(formik.errors.days_of_week)}
                            disabled={saving}
                          >
                            <FormLabel>Days of Week</FormLabel>
                            <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                              {DAYS_OF_WEEK.map((day) => (
                                <FormControlLabel
                                  key={day.value}
                                  control={
                                    <Checkbox
                                      checked={formik.values.days_of_week.includes(day.value)}
                                      onChange={(e) => {
                                        const currentDays = [...formik.values.days_of_week];
                                        if (e.target.checked) {
                                          if (!currentDays.includes(day.value)) {
                                            currentDays.push(day.value);
                                          }
                                        } else {
                                          const index = currentDays.indexOf(day.value);
                                          if (index !== -1) {
                                            currentDays.splice(index, 1);
                                          }
                                        }
                                        formik.setFieldValue('days_of_week', currentDays);
                                      }}
                                      disabled={saving}
                                    />
                                  }
                                  label={day.label}
                                />
                              ))}
                            </Paper>
                            {formik.touched.days_of_week && formik.errors.days_of_week && (
                              <FormHelperText>{formik.errors.days_of_week}</FormHelperText>
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
                            disabled={saving}
                          />
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <FormControl 
                          fullWidth
                          error={formik.touched.post_status && Boolean(formik.errors.post_status)}
                          disabled={saving}
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
                                disabled={saving}
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
                          disabled={saving || !formik.values.site_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Categories"
                              placeholder="Select categories"
                              helperText="Select categories for the generated posts"
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                label={option.name}
                                {...getTagProps({ index })}
                                disabled={saving}
                              />
                            ))
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
                          disabled={saving || !formik.values.site_id}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Tags"
                              placeholder="Select tags"
                              helperText="Select tags for the generated posts"
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                label={option.name}
                                {...getTagProps({ index })}
                                disabled={saving}
                              />
                            ))
                          }
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Prompt Variables */}
              {formik.values.prompt_id && (
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Prompt Variables
                      </Typography>
                      
                      {prompts.find(p => p.id === formik.values.prompt_id)?.variables?.length > 0 ? (
                        <Grid container spacing={2}>
                          {prompts.find(p => p.id === formik.values.prompt_id)?.variables.map((variable) => (
                            <Grid item xs={12} md={6} key={variable.key}>
                              {variable.type === 'text' && (
                                <TextField
                                  fullWidth
                                  id={`variable_values.${variable.key}`}
                                  name={`variable_values.${variable.key}`}
                                  label={variable.name}
                                  value={formik.values.variable_values[variable.key] || ''}
                                  onChange={formik.handleChange}
                                  onBlur={formik.handleBlur}
                                  helperText={variable.description}
                                  disabled={saving}
                                />
                              )}
                              
                              {variable.type === 'number' && (
                                <TextField
                                  fullWidth
                                  id={`variable_values.${variable.key}`}
                                  name={`variable_values.${variable.key}`}
                                  label={variable.name}
                                  type="number"
                                  value={formik.values.variable_values[variable.key] || ''}
                                  onChange={formik.handleChange}
                                  onBlur={formik.handleBlur}
                                  helperText={variable.description}
                                  disabled={saving}
                                />
                              )}
                              
                              {variable.type === 'select' && (
                                <FormControl fullWidth disabled={saving}>
                                  <InputLabel>{variable.name}</InputLabel>
                                  <Select
                                    id={`variable_values.${variable.key}`}
                                    name={`variable_values.${variable.key}`}
                                    value={formik.values.variable_values[variable.key] || ''}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
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
                                  disabled={saving}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={variable.name}
                                      placeholder="Select options"
                                      helperText={variable.description}
                                    />
                                  )}
                                  renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                      <Chip
                                        label={option}
                                        {...getTagProps({ index })}
                                        disabled={saving}
                                      />
                                    ))
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
                                      disabled={saving}
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
                        </Grid>
                      ) : (
                        <Typography color="textSecondary">
                          This prompt template doesn't have any variables.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {/* Submit Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    type="submit"
                    disabled={saving || !formik.isValid}
                    sx={{ minWidth: 150 }}
                  >
                    {saving ? 'Saving...' : isEditMode ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default ScheduleForm; 