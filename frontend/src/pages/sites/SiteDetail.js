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
  CircularProgress,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
  LocalOffer as TagIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Article as ArticleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

const SiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [relatedData, setRelatedData] = useState({
    posts: { data: [], loading: true, error: null },
    schedules: { data: [], loading: true, error: null },
  });

  const fetchSite = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/v1/sites/${id}`);
      setSite(response.data);
    } catch (err) {
      setError('Failed to load site details. Please try again.');
      console.error('Error fetching site:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    // Fetch posts for this site
    try {
      const postsResponse = await api.get(`/api/v1/posts?site_id=${id}`);
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
    
    // Fetch schedules for this site
    try {
      const schedulesResponse = await api.get(`/api/v1/schedules?site_id=${id}`);
      setRelatedData(prev => ({
        ...prev,
        schedules: { data: schedulesResponse.data, loading: false, error: null },
      }));
    } catch (err) {
      setRelatedData(prev => ({
        ...prev,
        schedules: { data: [], loading: false, error: 'Failed to load schedules' },
      }));
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    
    try {
      const response = await api.post(`/api/v1/sites/${id}/test-connection`);
      
      // Update the site's connection status
      setSite(prev => ({
        ...prev,
        is_connected: response.data.success,
      }));
    } catch (err) {
      console.error('Error testing connection:', err);
      
      // Mark the site as not connected
      setSite(prev => ({
        ...prev,
        is_connected: false,
      }));
    } finally {
      setTestingConnection(false);
    }
  };

  const deleteSite = async () => {
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/v1/sites/${id}`);
      navigate('/sites');
    } catch (err) {
      setError('Failed to delete site. Please try again.');
      console.error('Error deleting site:', err);
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  useEffect(() => {
    fetchSite();
    fetchRelatedData();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading site details..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Error Loading Site"
        details={error}
        onRetry={fetchSite}
      />
    );
  }

  if (!site) {
    return (
      <EmptyState
        title="Site Not Found"
        description="The WordPress site you're looking for doesn't exist or has been deleted."
        actionText="Back to Sites"
        actionLink="/sites"
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title={site.name}
        breadcrumbs={[
          { text: 'WordPress Sites', link: '/sites' },
          { text: site.name },
        ]}
        actionButton={true}
        actionButtonText="Edit Site"
        actionButtonLink={`/sites/${id}/edit`}
        actionButtonIcon={<EditIcon />}
      />
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LanguageIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Site Information</Typography>
              </Box>
              
              <Typography variant="body1" gutterBottom>
                <strong>URL:</strong>{' '}
                <a href={site.url} target="_blank" rel="noopener noreferrer">
                  {site.url}
                </a>
              </Typography>
              
              <Typography variant="body1" gutterBottom>
                <strong>API URL:</strong>{' '}
                <span>{site.api_url}</span>
              </Typography>
              
              <Typography variant="body1" gutterBottom>
                <strong>Username:</strong>{' '}
                <span>{site.username}</span>
              </Typography>
              
              <Box sx={{ mt: 3, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ mr: 1 }}>
                  <strong>Connection Status:</strong>
                </Typography>
                {testingConnection ? (
                  <Chip
                    size="small"
                    label="Testing..."
                    color="default"
                  />
                ) : site.is_connected ? (
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon />}
                    label="Connected"
                    color="success"
                  />
                ) : (
                  <Chip
                    size="small"
                    icon={<ErrorIcon />}
                    label="Not Connected"
                    color="error"
                  />
                )}
                
                <Tooltip title="Test Connection">
                  <IconButton
                    size="small"
                    onClick={testConnection}
                    disabled={testingConnection}
                    sx={{ ml: 1 }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CategoryIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Categories & Tags</Typography>
              </Box>
              
              <Typography variant="body2" gutterBottom>
                <strong>Categories:</strong> {site.categories?.length || 0}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {site.categories && site.categories.length > 0 ? (
                  site.categories.map((category) => (
                    <Chip
                      key={category.id}
                      label={category.name}
                      size="small"
                      icon={<CategoryIcon fontSize="small" />}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No categories found
                  </Typography>
                )}
              </Box>
              
              <Typography variant="body2" gutterBottom>
                <strong>Tags:</strong> {site.tags?.length || 0}
              </Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {site.tags && site.tags.length > 0 ? (
                  site.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      size="small"
                      icon={<TagIcon fontSize="small" />}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No tags found
                  </Typography>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  sx={{ ml: 2 }}
                >
                  Delete Site
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
          <Tab label="Schedules" icon={<ScheduleIcon />} iconPosition="start" />
          <Tab label="Blog Posts" icon={<ArticleIcon />} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* Schedules Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Schedules for this Site
              </Typography>
              <Button
                component={RouterLink}
                to="/schedules/new"
                variant="contained"
                size="small"
                startIcon={<ScheduleIcon />}
              >
                Create Schedule
              </Button>
            </Box>
            
            {relatedData.schedules.loading ? (
              <LoadingState message="Loading schedules..." />
            ) : relatedData.schedules.error ? (
              <Alert severity="error">{relatedData.schedules.error}</Alert>
            ) : relatedData.schedules.data.length === 0 ? (
              <EmptyState
                title="No Schedules"
                description="You haven't created any content schedules for this site yet."
                actionText="Create Schedule"
                actionLink="/schedules/new"
                actionIcon={<ScheduleIcon />}
              />
            ) : (
              <List>
                {relatedData.schedules.data.map((schedule) => (
                  <React.Fragment key={schedule.id}>
                    <ListItem
                      button
                      component={RouterLink}
                      to={`/schedules/${schedule.id}`}
                    >
                      <ListItemIcon>
                        <ScheduleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={schedule.name}
                        secondary={`Frequency: ${schedule.frequency} | Status: ${schedule.is_active ? 'Active' : 'Inactive'}`}
                      />
                      <Chip
                        label={schedule.is_active ? 'Active' : 'Inactive'}
                        color={schedule.is_active ? 'success' : 'default'}
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
      
      {/* Blog Posts Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Blog Posts for this Site
            </Typography>
            
            {relatedData.posts.loading ? (
              <LoadingState message="Loading posts..." />
            ) : relatedData.posts.error ? (
              <Alert severity="error">{relatedData.posts.error}</Alert>
            ) : relatedData.posts.data.length === 0 ? (
              <EmptyState
                title="No Posts"
                description="No blog posts have been created for this site yet."
                actionText="Create Schedule"
                actionLink="/schedules/new"
                actionIcon={<ScheduleIcon />}
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
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete WordPress Site"
        message={`Are you sure you want to delete "${site.name}"? This action cannot be undone and will remove all schedules associated with this site.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={deleteSite}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default SiteDetail; 