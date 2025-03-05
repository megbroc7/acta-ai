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
import api from '../../services/api';

const PromptsList = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  
  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/prompts/templates');
      setPrompts(response.data);
    } catch (err) {
      setError('Failed to load prompt templates. Please try again.');
      console.error('Error fetching prompts:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMenuOpen = (event, promptId) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedPromptId(promptId);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedPromptId(null);
  };
  
  const handleDeleteClick = (prompt) => {
    setPromptToDelete(prompt);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };
  
  const handleDuplicatePrompt = async (promptId) => {
    try {
      await api.post(`/api/prompts/templates/${promptId}/duplicate`);
      fetchPrompts();
    } catch (err) {
      console.error('Error duplicating prompt:', err);
    }
    handleMenuClose();
  };
  
  const deletePrompt = async () => {
    if (!promptToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      await api.delete(`/api/prompts/templates/${promptToDelete.id}`);
      setPrompts(prompts.filter(p => p.id !== promptToDelete.id));
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    } catch (err) {
      console.error('Error deleting prompt:', err);
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const filteredPrompts = prompts.filter(prompt => 
    prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prompt.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  useEffect(() => {
    fetchPrompts();
  }, []);
  
  if (loading) {
    return <LoadingState message="Loading prompt templates..." />;
  }
  
  if (error) {
    return (
      <ErrorState
        message="Error Loading Prompts"
        details={error}
        onRetry={fetchPrompts}
      />
    );
  }
  
  return (
    <Box>
      <PageHeader
        title="Prompt Templates"
        description="Create and manage AI prompt templates for generating blog content"
        actionButton={true}
        actionButtonText="New Template"
        actionButtonLink="/prompts/new"
        actionButtonIcon={<AddIcon />}
      />
      
      {prompts.length === 0 ? (
        <EmptyState
          title="Your Prompt Collection is Empty!"
          description="No prompts yet? That's like having a magic wand without any spells! Create your first template and start crafting AI-powered content that'll make your readers say 'wow'."
          actionText="Create Template"
          actionLink="/prompts/new"
          actionIcon={<AddIcon />}
        />
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search prompt templates..."
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
              title="No Matching Templates"
              description={`No prompt templates match "${searchTerm}". Try a different search term.`}
              actionText="Clear Search"
              actionOnClick={() => setSearchTerm('')}
            />
          ) : (
            <Grid container spacing={3}>
              {filteredPrompts.map((prompt) => (
                <Grid item xs={12} md={6} lg={4} key={prompt.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h2" noWrap>
                          {prompt.name}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, prompt.id)}
                          aria-label="prompt options"
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          height: '4.5em'
                        }}
                      >
                        {prompt.description}
                      </Typography>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Chip 
                          size="small" 
                          label={`${prompt.variables?.length || 0} Variables`}
                          color="primary"
                          variant="outlined"
                        />
                        <Button
                          component={RouterLink}
                          to={`/prompts/${prompt.id}`}
                          size="small"
                          endIcon={<DescriptionIcon />}
                        >
                          View Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
      
      {/* Prompt Options Menu */}
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
        <MenuItem onClick={() => handleDuplicatePrompt(selectedPromptId)}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            const promptToDelete = prompts.find(p => p.id === selectedPromptId);
            handleDeleteClick(promptToDelete);
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
        title="Delete Prompt Template"
        message={promptToDelete ? `Are you sure you want to delete "${promptToDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete"
        confirmColor="error"
        onConfirm={deletePrompt}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setPromptToDelete(null);
        }}
        loading={deleteLoading}
      />
    </Box>
  );
};

export default PromptsList; 