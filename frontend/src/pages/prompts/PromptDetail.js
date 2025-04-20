import React, { useState } from 'react';
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
import { usePrompt, useDeletePrompt, useDuplicatePrompt } from '../../hooks/usePrompts';
import { useSnackbar } from 'notistack';

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
  const { enqueueSnackbar } = useSnackbar();
  
  // Local state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  
  // Use React Query hooks
  const { 
    data: prompt, 
    isLoading, 
    isError, 
    error 
  } = usePrompt(id);
  
  // Delete mutation
  const deletePromptMutation = useDeletePrompt();
  
  // Duplicate mutation
  const duplicatePromptMutation = useDuplicatePrompt();
  
  // Handle copy to clipboard
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopySuccess(label);
        setTimeout(() => setCopySuccess(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        enqueueSnackbar('Failed to copy to clipboard', { variant: 'error' });
      });
  };
  
  // Handle delete
  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await deletePromptMutation.mutateAsync(id);
      enqueueSnackbar('Template deleted successfully', { variant: 'success' });
      navigate('/prompts');
    } catch (err) {
      enqueueSnackbar(`Error deleting template: ${err.message}`, { variant: 'error' });
    } finally {
      setDeleteDialogOpen(false);
    }
  };
  
  // Handle duplicate
  const handleDuplicate = async () => {
    try {
      await duplicatePromptMutation.mutateAsync(id);
      enqueueSnackbar('Template duplicated successfully', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(`Error duplicating template: ${err.message}`, { variant: 'error' });
    }
  };
  
  // Show loading state
  if (isLoading) {
    return <LoadingState message="Loading prompt template..." />;
  }
  
  // Show error state
  if (isError) {
    return (
      <ErrorState 
        message={`Error loading template: ${error?.message || 'Unknown error'}`}
      />
    );
  }
  
  // Ensure we have a prompt
  if (!prompt) {
    return <ErrorState message="Template not found" />;
  }
  
  return (
    <Box sx={{ pb: 4 }}>
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
      />
      
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={handleDuplicate}
          disabled={duplicatePromptMutation.isPending}
        >
          Duplicate
        </Button>
        <Button
          component={RouterLink}
          to={`/prompts/${id}/edit`}
          variant="contained"
          startIcon={<EditIcon />}
        >
          Edit Template
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {/* System Prompt */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  System Prompt
                </Typography>
                <Tooltip title="Copy system prompt">
                  <IconButton
                    onClick={() => handleCopy(prompt.system_prompt, 'system')}
                    size="small"
                    color={copySuccess === 'system' ? 'success' : 'default'}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  maxHeight: '300px',
                  overflow: 'auto',
                  bgcolor: 'grey.50'
                }}
              >
                {prompt.system_prompt || <em>No system prompt defined</em>}
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Advanced Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Advanced Content Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Content Type
                  </Typography>
                  <Typography variant="body1">
                    {prompt.content_type || 'Not specified'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Writing Style
                  </Typography>
                  <Typography variant="body1">
                    {prompt.writing_style || 'Not specified'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Industry
                  </Typography>
                  <Typography variant="body1">
                    {prompt.industry || 'General'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Audience Level
                  </Typography>
                  <Typography variant="body1">
                    {prompt.audience_level || 'General'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Default Word Count
                  </Typography>
                  <Typography variant="body1">
                    {prompt.default_word_count}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Default Tone
                  </Typography>
                  <Typography variant="body1">
                    {prompt.default_tone}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Special Requirements
                  </Typography>
                  <Typography variant="body1">
                    {prompt.special_requirements || 'None specified'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Topic Generation Prompt */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Topic Generation Prompt
                </Typography>
                <Tooltip title="Copy topic generation prompt">
                  <IconButton
                    onClick={() => handleCopy(prompt.topic_generation_prompt, 'topic')}
                    size="small"
                    color={copySuccess === 'topic' ? 'success' : 'default'}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  height: '200px',
                  overflow: 'auto',
                  bgcolor: 'grey.50'
                }}
              >
                {prompt.topic_generation_prompt || <em>No topic generation prompt defined</em>}
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Content Generation Prompt */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Content Generation Prompt
                </Typography>
                <Tooltip title="Copy content generation prompt">
                  <IconButton
                    onClick={() => handleCopy(prompt.content_generation_prompt, 'content')}
                    size="small"
                    color={copySuccess === 'content' ? 'success' : 'default'}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  height: '200px',
                  overflow: 'auto',
                  bgcolor: 'grey.50'
                }}
              >
                {prompt.content_generation_prompt || <em>No content generation prompt defined</em>}
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Variables */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Variables
              </Typography>
              
              {prompt.variables && prompt.variables.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Default Value</TableCell>
                        <TableCell>Options</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {prompt.variables.map((variable, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" component="code" sx={{ fontWeight: 'bold' }}>
                              {variable.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {variableTypeLabels[variable.type] || variable.type}
                          </TableCell>
                          <TableCell>{variable.description || '-'}</TableCell>
                          <TableCell>
                            {variable.required ? (
                              <Chip size="small" color="primary" label="Required" />
                            ) : (
                              <Chip size="small" variant="outlined" label="Optional" />
                            )}
                          </TableCell>
                          <TableCell>
                            {variable.default !== undefined && variable.default !== '' 
                              ? variable.default.toString() 
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {variable.options && variable.options.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {variable.options.map((option, idx) => (
                                  <Chip 
                                    key={idx} 
                                    label={option} 
                                    size="small" 
                                    variant="outlined" 
                                  />
                                ))}
                              </Box>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  This template doesn't have any variables defined.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDeleteClick}
        >
          Delete Template
        </Button>
      </Box>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Prompt Template"
        content={`Are you sure you want to delete "${prompt.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
        loading={deletePromptMutation.isPending}
      />
    </Box>
  );
};

export default PromptDetail; 