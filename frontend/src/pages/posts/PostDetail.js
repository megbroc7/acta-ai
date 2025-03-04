import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { API_BASE_URL } from '../../config';

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/posts/${id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch post: ${response.status}`);
        }
        
        const data = await response.json();
        setPost(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching post details:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPostDetails();
  }, [id]);

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
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
        sx={{ mb: 4 }}
      >
        Back to Posts
      </Button>

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
                {new Date(post.published_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
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