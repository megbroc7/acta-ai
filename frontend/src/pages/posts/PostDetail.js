import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Button, 
  Card, 
  CardMedia, 
  CardContent,
  Divider,
  Avatar,
  Grid,
  Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../services/api';

// Add this function to format dates safely with fallback
const formatDate = (dateString) => {
  if (!dateString) return 'Not published';
  
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      return 'Date pending';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (err) {
    console.error('Error formatting date:', err);
    return 'Date unavailable';
  }
};

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    // Check if we are in preview mode
    const queryParams = new URLSearchParams(location.search);
    const isPreviewMode = queryParams.get('preview') === 'true';
    setIsPreview(isPreviewMode);
    
    const fetchPostDetails = async () => {
      try {
        setLoading(true);
        
        // If in preview mode, get data from sessionStorage
        if (isPreviewMode) {
          const previewDataString = sessionStorage.getItem(`preview_${id}`);
          if (previewDataString) {
            const previewData = JSON.parse(previewDataString);
            
            // Make sure the preview data isn't too old (15 minutes max)
            const maxAgeMs = 15 * 60 * 1000; // 15 minutes
            if (Date.now() - previewData.timestamp <= maxAgeMs) {
              setPost(previewData.postData);
              setLoading(false);
              return;
            }
            // If preview data is too old, fallback to API
            sessionStorage.removeItem(`preview_${id}`);
          }
        }
        
        // Fetch from API (regular mode or preview fallback)
        console.log('Debug - Fetching post details for ID:', id);
        const response = await api.get(`/api/posts/${id}`);
        
        setPost(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching post details:', err);
        if (err.response) {
          console.error('Error response:', {
            status: err.response.status,
            data: err.response.data,
            headers: err.response.headers
          });
        }
        setError(err.message || 'Failed to fetch post details');
        setLoading(false);
      }
    };

    fetchPostDetails();
  }, [id, location.search]);

  const handleBack = () => {
    navigate('/posts');
  };

  if (loading) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading post details...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Error loading post
        </Typography>
        <Typography variant="body1">{error}</Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 4 }}
        >
          Back to Posts
        </Button>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Post not found
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mt: 4 }}
        >
          Back to Posts
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      {isPreview && (
        <Box sx={{ 
          bgcolor: '#e8f5e9', 
          color: 'text.primary', 
          p: 2, 
          mb: 4,
          borderRadius: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid #4caf50'
        }}>
          <Typography variant="subtitle1">
            <strong>Preview Mode:</strong> This is a preview of your edited post. Changes are not saved.
          </Typography>
          
          <Button
            variant="contained"
            color="success"
            size="small"
            onClick={() => navigate(`/posts/${id}/edit?fromPreview=true`)}
          >
            Return to Editor
          </Button>
        </Box>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Posts
        </Button>
        
        <Tooltip title="Edit this post">
          <Button
            variant="contained"
            color="primary"
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/posts/${id}/edit`}
          >
            Edit Post
          </Button>
        </Tooltip>
      </Box>

      <Card elevation={3}>
        {post.featured_image && (
          <CardMedia
            component="img"
            height="400"
            image={post.featured_image}
            alt={post.title}
            sx={{ objectFit: 'cover' }}
          />
        )}
        
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            {post.title}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            {post.author && post.author.avatar && (
              <Avatar 
                src={post.author.avatar} 
                alt={post.author.name || 'Author'}
                sx={{ mr: 2 }}
              />
            )}
            <Box>
              {post.author && (
                <Typography variant="subtitle1">
                  {post.author.name || 'Unknown Author'}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {formatDate(post.published_date)}
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ mb: 4 }} />
          
          <Typography variant="body1" component="div" sx={{ lineHeight: 1.8 }}>
            {/* Render HTML content safely */}
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </Typography>
          
          {post.tags && post.tags.length > 0 && (
            <Box sx={{ mt: 6 }}>
              <Typography variant="subtitle2" gutterBottom>
                Tags:
              </Typography>
              <Grid container spacing={1}>
                {post.tags.map((tag, index) => (
                  <Grid item key={index}>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => navigate(`/posts?tag=${tag}`)}
                    >
                      {tag}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default PostDetail; 