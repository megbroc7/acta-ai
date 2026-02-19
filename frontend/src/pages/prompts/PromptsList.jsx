import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Add, MoreVert, Edit, Delete, ContentCopy, Description,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import { getStyleLabel } from '../../constants/headlineStyles';
import ListSkeleton from '../../components/common/ListSkeleton';

export default function PromptsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates/').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      enqueueSnackbar('Template deleted', { variant: 'success' });
      setDeleteOpen(false);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => api.post(`/templates/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      enqueueSnackbar('Template duplicated', { variant: 'success' });
    },
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            position: 'relative',
            display: 'inline-block',
            pb: 1,
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: 60,
              height: 4,
              backgroundColor: 'primary.main',
            },
          }}
        >
          Templates
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/prompts/new')}>
          New Template
        </Button>
      </Box>

      {isLoading ? (
        <ListSkeleton variant="cards" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Description sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" gutterBottom sx={{ fontStyle: 'italic' }}>
              The scrolls are empty
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Draft your first prompt template to instruct the scribes.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/prompts/new')}>
              New Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {templates.map((tpl) => (
            <Grid item xs={12} md={6} lg={4} key={tpl.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    borderColor: 'primary.light',
                  },
                }}
                onClick={() => navigate(`/prompts/${tpl.id}/edit`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6">{tpl.name}</Typography>
                    {tpl.is_default && <Chip label="Default" size="small" color="primary" />}
                  </Box>
                  {tpl.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {tpl.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                    <Chip label={`${tpl.default_word_count} words`} size="small" variant="outlined" />
                    <Chip label={tpl.default_tone} size="small" variant="outlined" />
                    {tpl.content_type && <Chip label={getStyleLabel(tpl.content_type)} size="small" variant="outlined" />}
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => duplicateMutation.mutate(tpl.id)} title="Duplicate">
                    <ContentCopy fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => { setAnchorEl(e.currentTarget); setSelected(tpl); }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { setAnchorEl(null); navigate(`/prompts/${selected?.id}/edit`); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Edit
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); setDeleteOpen(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>Delete
        </MenuItem>
      </Menu>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{selected?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(selected?.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
