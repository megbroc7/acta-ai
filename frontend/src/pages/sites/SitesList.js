import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Language as LanguageIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

const SitesList = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingSiteId, setTestingSiteId] = useState(null);

  const openMenu = (event, site) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedSite(site);
  };

  const closeMenu = () => {
    setMenuAnchorEl(null);
    setSelectedSite(null);
  };

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
    closeMenu();
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const fetchSites = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/sites');
      
      // Get connection status from localStorage and merge with fetched sites
      const sitesWithConnectionStatus = response.data.map(site => {
        // Try to get saved connection status from localStorage
        const savedStatus = localStorage.getItem(`site_${site.id}_connected`);
        return {
          ...site,
          // Use saved status if available, otherwise default to false
          is_connected: savedStatus === 'true'
        };
      });
      
      setSites(sitesWithConnectionStatus);
    } catch (err) {
      setError('Failed to load WordPress sites. Please try again.');
      console.error('Error fetching sites:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSite = async () => {
    if (!selectedSite) return;
    
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/sites/${selectedSite.id}`);
      setSites(sites.filter(site => site.id !== selectedSite.id));
      closeDeleteDialog();
    } catch (err) {
      setError('Failed to delete site. Please try again.');
      console.error('Error deleting site:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const testConnection = async (siteId) => {
    setTestingSiteId(siteId);
    setTestingConnection(true);
    
    try {
      // Find the site data first
      const site = sites.find(s => s.id === siteId);
      
      if (!site) {
        console.error('Site not found');
        return;
      }
      
      // Send the required fields in the request body
      const response = await api.post(`/api/sites/${siteId}/test-connection`, {
        api_url: site.api_url,
        username: site.username,
        // We don't send app_password as it's not stored in the site object for security
        // The backend will use the stored password
      });
      
      // Update the site's connection status in the list
      setSites(sites.map(s => 
        s.id === siteId 
          ? { ...s, is_connected: response.data.success } 
          : s
      ));
      
      // Save connection status to localStorage
      localStorage.setItem(`site_${siteId}_connected`, response.data.success);
      console.log(`Connection status saved to localStorage: ${response.data.success}`);
      
      // If connection was successful, update the database too
      if (response.data.success) {
        try {
          // Find the current site data
          const site = sites.find(s => s.id === siteId);
          
          if (site) {
            // Update the site in the database with is_connected status
            await api.put(`/api/sites/${siteId}`, {
              name: site.name,
              url: site.url,
              api_url: site.api_url,
              username: site.username,
              is_connected: true
            });
            console.log('Connection status updated in database');
          }
        } catch (updateError) {
          console.error('Failed to update connection status in database:', updateError);
          // Don't show this error to the user - the UI already shows as connected
        }
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      
      // Mark the site as not connected
      setSites(sites.map(site => 
        site.id === siteId 
          ? { ...site, is_connected: false } 
          : site
      ));
      
      // Save failed status to localStorage
      localStorage.setItem(`site_${siteId}_connected`, 'false');
    } finally {
      setTestingConnection(false);
      setTestingSiteId(null);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  if (loading) {
    return <LoadingState message="Loading WordPress sites..." />;
  }

  if (error) {
    return (
      <ErrorState
        message="Error Loading Sites"
        details={error}
        onRetry={fetchSites}
      />
    );
  }

  return (
    <Box>
      <PageHeader
        title="WordPress Sites"
        actionButton={true}
        actionButtonText="Add Site"
        actionButtonLink="/sites/new"
      />
      
      {sites.length === 0 ? (
        <EmptyState
          title="No WordPress Sites"
          description="Time to unleash your WordPress site's superpowers! Connect now and let AI do the heavy lifting while you sip coffee and look brilliant."
          actionText="Add WordPress Site"
          actionLink="/sites/new"
        />
      ) : (
        <Grid container spacing={3}>
          {sites.map((site) => (
            <Grid item xs={12} sm={6} md={4} key={site.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <LanguageIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="h2" noWrap>
                        {site.name}
                      </Typography>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => openMenu(e, site)}
                      aria-label="site options"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom noWrap>
                    {site.url}
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      Connection:
                    </Typography>
                    {testingConnection && testingSiteId === site.id ? (
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
                        onClick={() => testConnection(site.id)}
                        disabled={testingConnection}
                        sx={{ ml: 1 }}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      Categories: {site.categories?.length || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Tags: {site.tags?.length || 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Site Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={closeMenu}
      >
        <MenuItem
          component={RouterLink}
          to={selectedSite ? `/sites/${selectedSite.id}` : '#'}
        >
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem
          component={RouterLink}
          to={selectedSite ? `/sites/${selectedSite.id}/edit` : '#'}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={openDeleteDialog}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete WordPress Site"
        message={`Are you sure you want to delete "${selectedSite?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={deleteSite}
        onCancel={closeDeleteDialog}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default SitesList; 