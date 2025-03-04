import React, { useState, useEffect } from 'react';
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
import ErrorState from '../../components/common/ErrorState';
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

  const validationSchema = Yup.object({
    name: Yup.string().required('Site name is required'),
    url: Yup.string().url('Must be a valid URL').required('Site URL is required'),
    api_url: Yup.string().url('Must be a valid URL').required('API URL is required'),
    username: Yup.string().required('Username is required'),
    app_password: Yup.string().when('_', {
      is: () => !isEditMode,
      then: Yup.string().required('Application password is required'),
      otherwise: Yup.string(),
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
        if (isEditMode) {
          // If editing and password is empty, don't send it
          const dataToSend = { ...values };
          if (!dataToSend.app_password) {
            delete dataToSend.app_password;
          }
          
          await api.put(`/api/v1/sites/${id}`, dataToSend);
        } else {
          await api.post('/api/v1/sites', values);
        }
        
        navigate('/sites');
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to save site. Please try again.');
        console.error('Error saving site:', err);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const fetchSite = async () => {
    try {
      const response = await api.get(`/api/v1/sites/${id}`);
      const site = response.data;
      
      formik.setValues({
        name: site.name || '',
        url: site.url || '',
        api_url: site.api_url || '',
        username: site.username || '',
        app_password: '', // Don't populate password for security reasons
      });
    } catch (err) {
      setError('Failed to load site details. Please try again.');
      console.error('Error fetching site:', err);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
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
      // If editing an existing site
      if (isEditMode) {
        const response = await api.post(`/api/v1/sites/${id}/test-connection`, {
          api_url: formik.values.api_url,
          username: formik.values.username,
          app_password: formik.values.app_password || undefined,
        });
        
        setConnectionResult({
          success: response.data.success,
          message: response.data.success 
            ? 'Connection successful! WordPress API is accessible.'
            : response.data.detail || 'Connection failed. Please check your credentials.',
        });
      } 
      // If creating a new site
      else {
        const response = await api.post('/api/v1/sites/test-connection', {
          api_url: formik.values.api_url,
          username: formik.values.username,
          app_password: formik.values.app_password,
        });
        
        setConnectionResult({
          success: response.data.success,
          message: response.data.success 
            ? 'Connection successful! WordPress API is accessible.'
            : response.data.detail || 'Connection failed. Please check your credentials.',
        });
      }
    } catch (err) {
      setConnectionResult({
        success: false,
        message: err.response?.data?.detail || 'Connection failed. Please check your credentials.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Auto-fill API URL when URL changes
  useEffect(() => {
    if (formik.values.url && !formik.values.api_url) {
      let apiUrl = formik.values.url;
      
      // Ensure URL ends with /
      if (!apiUrl.endsWith('/')) {
        apiUrl += '/';
      }
      
      // Add wp-json/
      apiUrl += 'wp-json';
      
      formik.setFieldValue('api_url', apiUrl);
    }
  }, [formik.values.url]);

  // Fetch site data if in edit mode
  useEffect(() => {
    if (isEditMode) {
      fetchSite();
    }
  }, [isEditMode, id]);

  if (loading) {
    return <LoadingState message="Loading site details..." />;
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
                    "Generate this in your WordPress admin under Users > Profile"
                  }
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