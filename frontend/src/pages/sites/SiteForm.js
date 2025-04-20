import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import api from '../../services/api';

const SiteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(!isEditMode);

  const validationSchema = Yup.object({
    name: Yup.string().required('Site name is required'),
    url: Yup.string().url('Must be a valid URL').required('Site URL is required'),
    api_url: Yup.string().url('Must be a valid URL').required('API URL is required'),
    username: Yup.string().required('Username is required'),
    app_password: Yup.string().when('_', {
      is: () => !isEditMode,
      then: () => Yup.string().required('Application password is required'),
      otherwise: () => Yup.string(),
    }),
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      url: '',
      api_url: '',
      username: '',
      app_password: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setSubmitting(true);
      setError(null);
      
      try {
        // Normalize URLs before submission
        const normalizedValues = {
          ...values,
          url: values.url.trim(),
          api_url: values.api_url.trim(),
          // Remove spaces from app_password
          app_password: values.app_password ? values.app_password.replace(/\s+/g, '') : values.app_password
        };
        
        if (isEditMode) {
          // If editing and password is empty, don't send it
          const dataToSend = { ...normalizedValues };
          if (!dataToSend.app_password) {
            delete dataToSend.app_password;
          }
          
          // Set a timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), 10000)
          );
          
          await Promise.race([
            api.put(`/api/sites/${id}`, dataToSend),
            timeoutPromise
          ]);
        } else {
          // Set a timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timed out')), 10000)
          );
          
          await Promise.race([
            api.post('/api/sites', normalizedValues),
            timeoutPromise
          ]);
        }
        
        navigate('/sites');
      } catch (err) {
        console.error('Error saving site:', err);
        setError(err.response?.data?.detail || err.message || 'Failed to save site. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const fetchSite = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/sites/${id}`);
      const site = response.data;
      
      // Check localStorage for connection status
      const savedStatus = localStorage.getItem(`site_${id}_connected`);
      
      // Set connection result if available from localStorage
      if (savedStatus === 'true') {
        setConnectionResult({
          success: true,
          message: 'Connection successful! WordPress API is accessible.'
        });
      } else if (savedStatus === 'false') {
        setConnectionResult({
          success: false,
          message: 'Not connected to WordPress API.'
        });
      }
      
      // Update form values with site data
      formik.setValues({
        name: site.name,
        url: site.url,
        api_url: site.api_url,
        username: site.username,
        app_password: '',  // Don't prefill password for security
      });
    } catch (err) {
      console.error('Error fetching site:', err);
      setError('Failed to load site details. Please try again or go back to the sites list.');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [id, formik]);

  const testConnection = async () => {
    // Don't allow testing if still loading initial data
    if (loading) {
      return;
    }
    
    // Validate form first
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      formik.setTouched({
        name: true,
        url: true,
        api_url: true,
        username: true,
        app_password: true,
      });
      return;
    }
    
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      // Normalize URLs before testing
      const api_url = formik.values.api_url.trim();
      
      // Remove spaces from app_password
      const app_password = formik.values.app_password ? formik.values.app_password.replace(/\s+/g, '') : '';
      
      // Set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timed out')), 10000)
      );
      
      // If editing an existing site
      if (isEditMode) {
        const response = await Promise.race([
          api.post(`/api/sites/${id}/test-connection`, {
            api_url,
            username: formik.values.username,
            app_password: app_password || undefined,
          }),
          timeoutPromise
        ]);
        
        // Set connection result for UI display
        setConnectionResult({
          success: response.data.success,
          message: response.data.success 
            ? 'Connection successful! WordPress API is accessible.'
            : response.data.message || 'Connection failed. Please check your credentials.',
        });
        
        // Save connection status to localStorage
        localStorage.setItem(`site_${id}_connected`, response.data.success);
        console.log(`Connection status saved to localStorage: ${response.data.success}`);
        
        // Update the connection status in the database if test was successful
        if (response.data.success) {
          try {
            // Create a complete update payload using existing form values
            const updatePayload = {
              name: formik.values.name,
              url: formik.values.url,
              api_url: formik.values.api_url,
              username: formik.values.username,
              is_connected: true  // Set the connection status to true
            };
            
            // Only include app_password if it's not empty
            if (formik.values.app_password) {
              updatePayload.app_password = app_password; // Use the version with spaces removed
            }
            
            // Send the complete update
            await api.put(`/api/sites/${id}`, updatePayload);
            console.log('Connection status updated successfully');
          } catch (updateError) {
            // Silent failure - don't confuse the user when the connection test itself was successful
            console.error('Note: Connection test was successful, but status update failed:', updateError);
          }
        }
      } 
      // If creating a new site
      else {
        const response = await Promise.race([
          api.post('/api/sites/test-connection', {
            api_url,
            username: formik.values.username,
            app_password: app_password,
          }),
          timeoutPromise
        ]);
        
        setConnectionResult({
          success: response.data.success,
          message: response.data.success 
            ? 'Connection successful! WordPress API is accessible.'
            : response.data.message || 'Connection failed. Please check your credentials.',
        });
      }
    } catch (err) {
      console.error('Connection test error:', err);
      setConnectionResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Connection failed. Please check your credentials.',
      });
      
      // If in edit mode, save failed status to localStorage
      if (isEditMode) {
        localStorage.setItem(`site_${id}_connected`, 'false');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // Auto-populate API URL when site URL changes
  useEffect(() => {
    // Skip this during loading to prevent unwanted updates
    if (loading) return;
    
    if (formik.values.url && formik.values.url.trim() !== '') {
      try {
        let apiUrl = formik.values.url.trim();
        
        // Ensure URL has protocol
        if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
          apiUrl = 'https://' + apiUrl;
        }
        
        // Remove trailing slashes
        apiUrl = apiUrl.replace(/\/+$/, '');
        
        // Add /wp-json
        apiUrl = `${apiUrl}/wp-json`;
        
        // Only update if different to prevent loops
        if (apiUrl !== formik.values.api_url) {
          formik.setFieldValue('api_url', apiUrl);
        }
      } catch (error) {
        console.error('Error updating API URL:', error);
        // Don't update on error
      }
    }
  }, [formik.values.url, loading]);

  // Fetch site data if in edit mode
  useEffect(() => {
    // Only fetch once and only in edit mode
    if (isEditMode && !initialLoadComplete) {
      fetchSite();
    }
  }, [isEditMode, initialLoadComplete, fetchSite]);

  // Show loading state
  if (loading) {
    return <LoadingState message="Loading site details..." />;
  }
  
  // Show error state if there's an error loading the site
  if (error && !initialLoadComplete) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/sites')} 
          sx={{ mt: 2 }}
        >
          Back to Sites
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={isEditMode ? 'Edit WordPress Site' : 'Add WordPress Site'}
        breadcrumbs={[
          { text: 'WordPress Sites', link: '/sites' },
          { text: isEditMode ? 'Edit Site' : 'Add Site' },
        ]}
      />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Card>
        <CardContent>
          <form onSubmit={formik.handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Site Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="name"
                  name="name"
                  label="Site Name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                  placeholder="My WordPress Blog"
                  autoComplete="off"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LanguageIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="url"
                  name="url"
                  label="Site URL"
                  value={formik.values.url}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.url && Boolean(formik.errors.url)}
                  helperText={formik.touched.url && formik.errors.url}
                  placeholder="https://example.com"
                  autoComplete="url"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  API Connection
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  id="api_url"
                  name="api_url"
                  label="API URL"
                  value={formik.values.api_url}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.api_url && Boolean(formik.errors.api_url)}
                  helperText={
                    (formik.touched.api_url && formik.errors.api_url) ||
                    "Usually your site URL followed by '/wp-json'"
                  }
                  placeholder="https://example.com/wp-json"
                  autoComplete="url"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="username"
                  name="username"
                  label="Username"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.username && Boolean(formik.errors.username)}
                  helperText={formik.touched.username && formik.errors.username}
                  placeholder="admin"
                  autoComplete="username"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  id="app_password"
                  name="app_password"
                  label={isEditMode ? "Application Password (leave empty to keep current)" : "Application Password"}
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.app_password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.app_password && Boolean(formik.errors.app_password)}
                  helperText={
                    (formik.touched.app_password && formik.errors.app_password) ||
                    "Generate this in your WordPress admin under Users > Profile. Spaces will be automatically removed."
                  }
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={testConnection}
                    disabled={testingConnection}
                    sx={{ mr: 2 }}
                  >
                    {testingConnection ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Testing Connection...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  
                  {connectionResult && (
                    <Alert 
                      severity={connectionResult.success ? 'success' : 'error'}
                      sx={{ mt: 2 }}
                    >
                      {connectionResult.message}
                    </Alert>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/sites')}
                    sx={{ mr: 2 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={20} /> : null}
                  >
                    {submitting ? 'Saving...' : 'Save Site'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SiteForm; 