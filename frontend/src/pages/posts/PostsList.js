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
  FormControl,
  InputLabel,
  Select,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  CloudUpload as CloudUploadIcon,
  Article as ArticleIcon,
  Language as LanguageIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

const PostsList = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(null);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    site_id: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  
  const fetchPosts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query params for filtering
      const params = new URLSearchParams();
      if (filters.site_id) params.append('site_id', filters.site_id);
      if (filters.status) params.append('status', filters.status);
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/api/v1/posts${queryString}`);
      setPosts(response.data);
    } catch (err) {
      setError('Failed to load posts. Please try again.');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSites = async () => {
    try {
      const response = await api.get('/api/v1/sites');
      setSites(response.data);
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };
  
  const handleMenuOpen = (event, postId) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedPostId(postId);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedPostId(null);
  };
  
  const handleDeleteClick = (post) => {
    setPostToDelete(post);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };
  
  const deletePost = async () => {
    if (!postToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/v1/posts/${postToDelete.id}`);
      setPosts(posts.filter(p => p.id !== postToDelete.id));
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    } catch (err) {
      console.error('Error deleting post:', err);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const publishPost = async (postId) => {
    setPublishLoading(postId);
    
    try {
      const response = await api.post(`/api/v1/posts/${postId}/publish`);
      
      // Update the post status in the local state
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, status: 'published', wordpress_id: response.data.wordpress_id } 
          : post
      ));
    } catch (err) {
      console.error('Error publishing post:', err);
    } finally {
      setPublishLoading(null);
      handleMenuClose();
    }
  };
  
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      site_id: '',
      status: '',
    });
  };
  
  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (post.excerpt && post.excerpt.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (post.site && post.site.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Format post status for display
  const formatStatus = (status) => {
    switch (status) {
      case 'draft':
        return { label: 'Draft', color: 'default' };
      case 'published':
        return { label: 'Published', color: 'success' };
      case 'pending_review':
        return { label: 'Pending Review', color: 'warning' };
      case 'failed':
        return { label: 'Failed', color: 'error' };
      default:
        return { label: status, color: 'default' };
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get excerpt from content
  const getExcerpt = (content, maxLength = 150) => {
    if (!content) return '';
    
    if (content.length <= maxLength) return content;
    
    return content.substring(0, maxLength) + '...';
  };
  
  useEffect(() => {
    fetchPosts();
    fetchSites();
  }, [filters, fetchPosts, fetchSites]);
  
  if (loading) {
    return <LoadingState message="Loading blog posts..." />;
  }
  
  if (error) {
    return (
      <ErrorState
        message="Error Loading Posts"
        details={error}
        onRetry={fetchPosts}
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title="Blog Posts"
        description="View and manage your WordPress blog posts"
        actionButton={true}
        actionButtonText="New Post"
        actionButtonLink="/posts/new"
        actionButtonIcon={<AddIcon />}
      />
      
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={showFilters ? 8 : 12}>
            <TextField
              fullWidth
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                      edge="end"
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4} sx={{ display: showFilters ? 'block' : 'none' }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Site</InputLabel>
              <Select
                value={filters.site_id}
                onChange={(e) => handleFilterChange('site_id', e.target.value)}
                label="Filter by Site"
              >
                <MenuItem value="">All Sites</MenuItem>
                {sites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    {site.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4} sx={{ display: showFilters ? 'block' : 'none' }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Filter by Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="pending_review">Pending Review</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              startIcon={showFilters ? <ClearIcon /> : <FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ mr: 1 }}
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            
            {showFilters && (
              <Button
                onClick={clearFilters}
                disabled={!filters.site_id && !filters.status}
              >
                Clear Filters
              </Button>
            )}
          </Grid>
        </Grid>
      </Box>
      
      {posts.length === 0 ? (
        <EmptyState
          title="No Blog Posts"
          description="You haven't created any blog posts yet."
          actionText="Create Post"
          actionLink="/posts/new"
          actionIcon={<AddIcon />}
        />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          title="No Matching Posts"
          description={`No posts match "${searchTerm}". Try a different search term or clear your filters.`}
          actionText="Clear Search"
          actionOnClick={() => setSearchTerm('')}
        />
      ) : (
        <Grid container spacing={3}>
          {filteredPosts.map((post) => {
            const statusInfo = formatStatus(post.status);
            
            return (
              <Grid item xs={12} key={post.id}>
                <Card 
                  sx={{ 
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    }
                  }}
                >
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                          <ArticleIcon color="primary" sx={{ mr: 1, mt: 0.5 }} />
                          <Typography variant="h6" component="h2">
                            {post.title}
                          </Typography>
                        </Box>
                        
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ mb: 2 }}
                        >
                          {getExcerpt(post.excerpt || post.content)}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LanguageIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="body2" noWrap>
                            {post.site ? post.site.name : 'No site assigned'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                          {post.categories && post.categories.length > 0 && post.categories.map((category) => (
                            <Chip
                              key={category.id}
                              label={category.name}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                          
                          {post.tags && post.tags.length > 0 && post.tags.map((tag) => (
                            <Chip
                              key={tag.id}
                              label={tag.name}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Chip 
                            label={statusInfo.label}
                            color={statusInfo.color}
                            size="small"
                          />
                          
                          <IconButton 
                            size="small" 
                            onClick={(e) => handleMenuOpen(e, post.id)}
                            aria-label="post options"
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                          <strong>Created:</strong> {formatDate(post.created_at)}
                        </Typography>
                        
                        {post.published_at && (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Published:</strong> {formatDate(post.published_at)}
                          </Typography>
                        )}
                        
                        {post.schedule && (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Schedule:</strong>{' '}
                            <Button
                              component={RouterLink}
                              to={`/schedules/${post.schedule.id}`}
                              size="small"
                            >
                              {post.schedule.name}
                            </Button>
                          </Typography>
                        )}
                        
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                          <Button
                            component={RouterLink}
                            to={`/posts/${post.id}`}
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityIcon />}
                          >
                            View Post
                          </Button>
                          
                          {post.status === 'draft' && (
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              startIcon={<CloudUploadIcon />}
                              onClick={() => publishPost(post.id)}
                              disabled={publishLoading === post.id}
                              sx={{ ml: 1 }}
                            >
                              Publish
                            </Button>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      
      {/* Post Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          component={RouterLink} 
          to={`/posts/${selectedPostId}`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View</ListItemText>
        </MenuItem>
        <MenuItem 
          component={RouterLink} 
          to={`/posts/${selectedPostId}/edit`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {posts.find(p => p.id === selectedPostId)?.status === 'draft' && (
          <MenuItem 
            onClick={() => publishPost(selectedPostId)}
            disabled={publishLoading === selectedPostId}
          >
            <ListItemIcon>
              <CloudUploadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Publish</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem 
          onClick={() => {
            const postToDelete = posts.find(p => p.id === selectedPostId);
            handleDeleteClick(postToDelete);
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
        title="Delete Blog Post"
        message={postToDelete ? `Are you sure you want to delete "${postToDelete.title}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={deletePost}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setPostToDelete(null);
        }}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default PostsList; 