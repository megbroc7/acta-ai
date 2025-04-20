import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Button,
  TextField,
  Paper,
  Grid,
  FormControl,
  FormHelperText,
  Snackbar,
  Alert,
  Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const PostEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  
  const [post, setPost] = useState({
    title: '',
    content: '',
    excerpt: '',
    tags: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Fetch post data on component mount
  useEffect(() => {
    const fetchPostDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check for a saved draft in sessionStorage first
        const draftDataString = sessionStorage.getItem(`edit_draft_${id}`);
        if (draftDataString) {
          const draftData = JSON.parse(draftDataString);
          
          // Make sure draft data isn't too old (30 minutes max)
          const maxAgeMs = 30 * 60 * 1000; // 30 minutes
          if (Date.now() - draftData.timestamp <= maxAgeMs) {
            setPost(draftData.postData);
            setLoading(false);
            return;
          }
          // If draft data is too old, fallback to API and remove the old draft
          sessionStorage.removeItem(`edit_draft_${id}`);
        }
        
        const response = await api.get(`/api/posts/${id}`);
        setPost(response.data);
      } catch (err) {
        console.error('Error fetching post details:', err);
        setError('Failed to load post. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPostDetails();
  }, [id]);

  // Handle field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setPost(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle rich text editor changes
  const handleContentChange = (content) => {
    setPost(prev => ({
      ...prev,
      content
    }));
  };

  // Handle form validation
  const validateForm = () => {
    const errors = {};
    
    if (!post.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!post.content.trim()) {
      errors.content = 'Content is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      enqueueSnackbar('Please fix the form errors before saving', { variant: 'error' });
      return;
    }
    
    try {
      setSaving(true);
      
      await api.put(`/api/posts/${id}`, post);
      
      enqueueSnackbar('Post updated successfully', { variant: 'success' });
      navigate(`/posts/${id}`);
    } catch (err) {
      console.error('Error updating post:', err);
      enqueueSnackbar('Failed to update post. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate(`/posts/${id}`);
  };

  const handlePreview = async () => {
    try {
      // Store the current draft state in sessionStorage
      const currentDraft = {
        timestamp: Date.now(),
        postData: post
      };
      sessionStorage.setItem(`edit_draft_${id}`, JSON.stringify(currentDraft));
      
      // Send current post state to preview endpoint
      const response = await api.post(`/api/posts/${id}/preview`, post);
      
      // Create a temporary preview token to store in sessionStorage
      const previewData = {
        timestamp: Date.now(),
        postData: response.data
      };
      
      // Store in sessionStorage so the preview page can access it
      sessionStorage.setItem(`preview_${id}`, JSON.stringify(previewData));
      
      // Now open preview in new tab with a special parameter
      window.open(`/posts/${id}?preview=true`, '_blank');
      
    } catch (err) {
      console.error('Error generating preview:', err);
      enqueueSnackbar('Failed to generate preview. Please try again.', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading post...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          {error}
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/posts')}
          sx={{ mt: 4 }}
        >
          Back to Posts
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Edit Post
          </Typography>
          
          <Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              sx={{ mr: 2 }}
            >
              Cancel
            </Button>
            
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<VisibilityIcon />}
              onClick={handlePreview}
              sx={{ mr: 2 }}
            >
              Preview
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 4 }} />
        
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                name="title"
                label="Post Title"
                value={post.title}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                error={!!formErrors.title}
                helperText={formErrors.title}
                required
                sx={{ mb: 2 }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Content
              </Typography>
              <Box sx={{ 
                border: formErrors.content ? '1px solid #d32f2f' : '1px solid rgba(0, 0, 0, 0.23)', 
                borderRadius: 1,
                mb: 1
              }}>
                <ReactQuill
                  value={post.content}
                  onChange={handleContentChange}
                  style={{ height: '300px', marginBottom: '50px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      ['link', 'image'],
                      ['clean']
                    ]
                  }}
                />
              </Box>
              {formErrors.content && (
                <FormHelperText error>{formErrors.content}</FormHelperText>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="excerpt"
                label="Excerpt (optional)"
                value={post.excerpt || ''}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                multiline
                rows={3}
                sx={{ mb: 2 }}
                helperText="A short summary of the post"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="tags"
                label="Tags"
                value={Array.isArray(post.tags) ? post.tags.join(', ') : ''}
                onChange={(e) => {
                  const tagsString = e.target.value;
                  const tagsArray = tagsString
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag !== '');
                  
                  setPost(prev => ({
                    ...prev,
                    tags: tagsArray
                  }));
                }}
                fullWidth
                variant="outlined"
                helperText="Separate tags with commas"
              />
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default PostEdit; 