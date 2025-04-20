import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  ContentCopy as ContentCopyIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { usePrompts, useDeletePrompt, useDuplicatePrompt } from '../../hooks/usePrompts';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const PromptsList = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState(null);
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  
  // Fetch prompts using React Query
  const { 
    data: prompts = [], 
    isLoading, 
    isError, 
    error,
    refetch,
  } = usePrompts();
  
  // Delete mutation
  const deletePromptMutation = useDeletePrompt();
  
  // Duplicate mutation
  const duplicatePromptMutation = useDuplicatePrompt();
  
  // Filter prompts based on search term
  const filteredPrompts = searchTerm 
    ? prompts.filter(prompt => 
        prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prompt.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : prompts;
  
  // Menu handlers
  const handleMenuOpen = (event, promptId) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedPromptId(promptId);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedPromptId(null);
  };
  
  // Delete handlers
  const handleDeleteClick = () => {
    setPromptToDelete(selectedPromptId);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await deletePromptMutation.mutateAsync(promptToDelete);
      
      enqueueSnackbar('Template deleted successfully.', { variant: 'success' });
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    } catch (err) {
      // Improved error messaging
      const errorMessage = err.response?.data?.detail || 
                          err.message || 
                          'Failed to delete template';
      enqueueSnackbar(`Error: ${errorMessage}`, { variant: 'error' });
      console.error('Delete error details:', err);
    }
  };
  
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPromptToDelete(null);
  };
  
  // Duplicate handler
  const handleDuplicate = async (promptId) => {
    try {
      await duplicatePromptMutation.mutateAsync(promptId);
      
      enqueueSnackbar('Template duplicated successfully.', { variant: 'success' });
      handleMenuClose();
    } catch (err) {
      // Use the improved error message from the API
      const errorMessage = err.message || 'Error duplicating template';
      enqueueSnackbar(errorMessage, { variant: 'error' });
      console.error('Duplication error details:', err);
    }
  };
  
  // Render loading state
  if (isLoading) {
    return <LoadingState message="Loading prompt templates..." />;
  }
  
  // Render error state
  if (isError) {
    return (
      <ErrorState 
        message={`Error loading prompt templates: ${error?.message || 'Unknown error'}`} 
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title="Prompt Templates"
        breadcrumbs={[
          { label: 'Dashboard', link: '/' },
          { label: 'Prompt Templates', current: true }
        ]}
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          startIcon={<AddIcon />} 
          onClick={() => navigate('/prompts/new')}
        >
          Create New Template
        </Button>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      {filteredPrompts.length === 0 ? (
        <EmptyState 
          icon={<DescriptionIcon fontSize="large" />}
          title="No prompt templates found"
          description={searchTerm 
            ? "No templates match your search. Try a different search term or clear the search." 
            : "You haven't created any prompt templates yet. Create your first template to get started."}
          action={
            !searchTerm && (
              <Button
                component={RouterLink}
                to="/prompts/new"
                variant="contained"
                startIcon={<AddIcon />}
              >
                Create First Template
              </Button>
            )
          }
        />
      ) : (
        <Grid container spacing={3}>
          {filteredPrompts.map((prompt) => (
            <Grid item xs={12} sm={6} md={4} key={prompt.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" component="div" noWrap>
                      {prompt.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, prompt.id)}
                      aria-label="template options"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {prompt.description || "No description provided."}
                  </Typography>
                  
                  {prompt.variables.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" component="div" color="text.secondary" gutterBottom>
                        Variables:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {prompt.variables.slice(0, 3).map((variable, index) => (
                          <Chip 
                            key={index}
                            label={variable.name}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {prompt.variables.length > 3 && (
                          <Chip 
                            label={`+${prompt.variables.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </CardContent>
                
                <Divider />
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
                  <Button
                    component={RouterLink}
                    to={`/prompts/${prompt.id}`}
                    color="primary"
                    size="small"
                  >
                    View Details
                  </Button>
                  <Button
                    component={RouterLink}
                    to={`/prompts/${prompt.id}/edit`}
                    color="primary"
                    size="small"
                    startIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          component={RouterLink} 
          to={`/prompts/${selectedPromptId}/edit`}
          onClick={handleMenuClose}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDuplicate(selectedPromptId)}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Prompt Template"
        content="Are you sure you want to delete this prompt template? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deletePromptMutation.isPending}
      />
    </Box>
  );
};

export default PromptsList; 