import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Add, MoreVert, Edit, Delete, Refresh, Language,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';
import ListSkeleton from '../../components/common/ListSkeleton';

export default function SitesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites/').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/sites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      enqueueSnackbar('Site deleted', { variant: 'success' });
      setDeleteOpen(false);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id) => api.post(`/sites/${id}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      enqueueSnackbar('Categories and tags refreshed', { variant: 'success' });
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
          Sites
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/sites/new')}>
          Add Site
        </Button>
      </Box>

      {isLoading ? (
        <ListSkeleton variant="cards" />
      ) : sites.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Language sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" gutterBottom sx={{ fontStyle: 'italic' }}>
              No provinces claimed
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Connect your first site to extend the reach of your empire.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/sites/new')}>
              Add Site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {sites.map((site) => (
            <Grid item xs={12} md={6} lg={4} key={site.id}>
              <Card
                sx={{
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    borderColor: 'primary.light',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6">{site.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {site.url}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Chip
                        label={site.platform ? site.platform.charAt(0).toUpperCase() + site.platform.slice(1) : 'WordPress'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, letterSpacing: '0.03em' }}
                      />
                      {['shopify', 'wix'].includes(site.platform) ? (
                        <Chip
                          label="Coming Soon"
                          size="small"
                          sx={{ fontWeight: 700, color: 'warning.main', borderColor: 'warning.main' }}
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          label={site.is_active ? 'Active' : 'Inactive'}
                          color={site.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      )}
                    </Box>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  {site.platform === 'wordpress' && (
                    <IconButton
                      size="small"
                      onClick={() => refreshMutation.mutate(site.id)}
                      title="Refresh categories & tags"
                    >
                      <Refresh fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      setAnchorEl(e.currentTarget);
                      setSelectedSite(site);
                    }}
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
        <MenuItem onClick={() => { setAnchorEl(null); navigate(`/sites/${selectedSite?.id}/edit`); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); setDeleteOpen(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Site</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{selectedSite?.name}</strong>? This will also delete all schedules and posts for this site.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(selectedSite?.id)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
