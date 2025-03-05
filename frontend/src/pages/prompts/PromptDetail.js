import React, { useState, useEffect, useCallback } from 'react';
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  Code as CodeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import api from '../../services/api';

// Map variable types to readable labels
const variableTypeLabels = {
  text: 'Text',
  number: 'Number',
  select: 'Select (Dropdown)',
  multiselect: 'Multi-Select',
  boolean: 'Boolean (Yes/No)',
};

const PromptDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Transform placeholders to variables format for display
  const transformPlaceholdersToVariables = useCallback((placeholders) => {
    if (!placeholders || Object.keys(placeholders).length === 0) {
      return [];
    }
    
    return Object.entries(placeholders).map(([key, defaultValue]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      key: key,
      type: 'text',
      default_value: defaultValue,
      description: `Variable for ${key.replace(/_/g, ' ')}`
    }));
  }, []);
  
  // Wrap fetchPrompt in useCallback
  const fetchPrompt = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/prompts/templates/${id}`);
      console.log('Prompt data:', response.data);
      console.log('Placeholders:', response.data.placeholders);
      console.log('Placeholders type:', typeof response.data.placeholders);
      if (response.data.placeholders) {
        console.log('Placeholders keys:', Object.keys(response.data.placeholders));
      }
      setPrompt(response.data);
    } catch (err) {
      console.error('Error fetching prompt:', err);
      setError('Failed to load prompt template. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  const handleDelete = async () => {
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/prompts/templates/${id}`);
      navigate('/prompts');
    } catch (err) {
      setError('Failed to delete prompt template. Please try again.');
      console.error('Error deleting prompt:', err);
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const handleDuplicate = async () => {
    try {
      await api.post(`/api/prompts/templates/${id}/duplicate`);
      navigate('/prompts');
    } catch (err) {
      setError('Failed to duplicate prompt template. Please try again.');
      console.error('Error duplicating prompt:', err);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  const highlightVariables = (content, placeholders) => {
    if (!content) return '';
    if (!placeholders || Object.keys(placeholders).length === 0) return content;
    
    let highlightedContent = content;
    
    // Replace each placeholder with a highlighted version
    Object.keys(placeholders).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      highlightedContent = highlightedContent.replace(
        regex,
        `<span class="variable-highlight" style="background-color: #e3f2fd; padding: 2px 4px; border-radius: 4px; font-weight: 500; color: #1976d2;">{${key}}</span>`
      );
    });
    
    return highlightedContent;
  };
  
  useEffect(() => {
    fetchPrompt();
  }, [id, fetchPrompt]);
  
  if (loading) {
    return <LoadingState message="Loading prompt template..." />;
  }
  
  if (error) {
    return (
      <ErrorState
        message="Error Loading Prompt Template"
        details={error}
        onRetry={fetchPrompt}
      />
    );
  }
  
  if (!prompt) {
    return (
      <Box>
        <Typography variant="h5" color="error" gutterBottom>
          Prompt Template Not Found
        </Typography>
        <Button
          component={RouterLink}
          to="/prompts"
          variant="contained"
          startIcon={<ArrowBackIcon />}
        >
          Back to Templates
        </Button>
      </Box>
    );
  }
  
  return (
    <Box>
      <PageHeader
        title={prompt.name}
        breadcrumbs={[
          { text: 'Prompt Templates', link: '/prompts' },
          { text: prompt.name },
        ]}
        actionButton={true}
        actionButtonText="Back to Templates"
        actionButtonLink="/prompts"
        actionButtonIcon={<ArrowBackIcon />}
        actionButtonVariant="outlined"
      />
      
      {copySuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Copied to clipboard!
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Prompt Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Typography variant="h5" component="h1">
                  {prompt.name}
                </Typography>
                
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleDuplicate}
                    sx={{ mr: 1 }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/prompts/${id}/edit`}
                    variant="outlined"
                    startIcon={<EditIcon />}
                    sx={{ mr: 1 }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
              
              <Typography variant="body1" paragraph>
                {prompt.description}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Prompt Content
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                System Prompt
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  position: 'relative',
                  '& .variable-highlight': {
                    backgroundColor: '#e3f2fd',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontWeight: 500,
                    color: '#1976d2'
                  }
                }}
              >
                <Tooltip title="Copy system prompt">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(prompt.system_prompt)}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: highlightVariables(prompt.system_prompt, prompt.placeholders) 
                  }} 
                />
              </Paper>
              
              <Typography variant="subtitle1" gutterBottom>
                Topic Generation Prompt
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mb: 3, 
                  position: 'relative',
                  '& .variable-highlight': {
                    backgroundColor: '#e3f2fd',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontWeight: 500,
                    color: '#1976d2'
                  }
                }}
              >
                <Tooltip title="Copy topic generation prompt">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(prompt.topic_generation_prompt)}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: highlightVariables(prompt.topic_generation_prompt, prompt.placeholders) 
                  }} 
                />
              </Paper>
              
              <Typography variant="subtitle1" gutterBottom>
                Content Generation Prompt
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  position: 'relative',
                  '& .variable-highlight': {
                    backgroundColor: '#e3f2fd',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    fontWeight: 500,
                    color: '#1976d2'
                  }
                }}
              >
                <Tooltip title="Copy content generation prompt">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(prompt.content_generation_prompt)}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: highlightVariables(prompt.content_generation_prompt, prompt.placeholders) 
                  }} 
                />
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Variables */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Variables
                <Chip 
                  label={`${prompt.placeholders ? Object.keys(prompt.placeholders).length : 0} Variables`}
                  color="primary"
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Typography>
              
              {prompt.placeholders && Object.keys(prompt.placeholders).length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Key</TableCell>
                        <TableCell>Default Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transformPlaceholdersToVariables(prompt.placeholders).map((variable, index) => (
                        <TableRow key={index}>
                          <TableCell>{variable.name}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CodeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                              <Typography 
                                variant="body2" 
                                component="code"
                                sx={{ 
                                  backgroundColor: 'grey.100',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                }}
                              >
                                {`{${variable.key}}`}
                              </Typography>
                              <Tooltip title="Copy variable placeholder">
                                <IconButton 
                                  size="small" 
                                  onClick={() => copyToClipboard(`{${variable.key}}`)}
                                  sx={{ ml: 1 }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                          <TableCell>{variable.default_value || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  This prompt template doesn't have any variables.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Usage Examples */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage
              </Typography>
              
              <Typography variant="body2" paragraph>
                This prompt template can be used when creating a new blog post or setting up a content schedule.
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  component={RouterLink}
                  to="/posts/new"
                  variant="contained"
                  color="primary"
                >
                  Create Blog Post
                </Button>
                <Button
                  component={RouterLink}
                  to="/schedules/new"
                  variant="outlined"
                >
                  Set Up Schedule
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Default Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Default Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Default Word Count
                    </Typography>
                    <Typography variant="h6">
                      {prompt.default_word_count} words
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Default Tone
                    </Typography>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {prompt.default_tone}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Prompt Template"
        message={`Are you sure you want to delete "${prompt.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default PromptDetail; 