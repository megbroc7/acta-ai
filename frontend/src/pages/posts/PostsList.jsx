import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent,
  Chip, IconButton, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Paper, TablePagination,
} from '@mui/material';
import {
  MoreVert, Edit, Delete, Visibility, Article,
  Publish, ThumbDown,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const STATUS_COLORS = {
  draft: 'default',
  pending_review: 'warning',
  published: 'success',
  rejected: 'error',
};
const STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  rejected: 'Rejected',
};

export default function PostsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts', statusFilter],
    queryFn: () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      return api.get(`/posts/${params}`).then(r => r.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      enqueueSnackbar('Post deleted', { variant: 'success' });
      setDeleteOpen(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/posts/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      enqueueSnackbar('Post published', { variant: 'success' });
      setAnchorEl(null);
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Publish failed', { variant: 'error' }),
  });

  const paginatedPosts = posts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
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
          Posts
        </Typography>
        <TextField
          select label="Filter by Status" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          sx={{ width: { xs: '100%', sm: 200 } }} size="small"
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="pending_review">Pending Review</MenuItem>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      </Box>

      {isLoading ? (
        <Typography color="text.secondary">Loading...</Typography>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Article sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
            <Typography variant="h6" gutterBottom sx={{ fontStyle: 'italic' }}>
              No dispatches yet
            </Typography>
            <Typography color="text.secondary">
              Your tablets await inscription. Posts will appear once your schedules generate content.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Paper>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Site</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedPosts.map((post) => (
                  <TableRow
                    key={post.id} hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: 300 }}>
                        {post.title}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="body2" color="text.secondary">
                        {post.site?.name || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[post.status] || post.status}
                        color={STATUS_COLORS[post.status] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(post.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => { setAnchorEl(e.currentTarget); setSelected(post); }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {posts.length > rowsPerPage && (
            <TablePagination
              component="div" count={posts.length}
              rowsPerPage={rowsPerPage} page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPageOptions={[]}
            />
          )}
        </Paper>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { setAnchorEl(null); navigate(`/posts/${selected?.id}`); }}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>View
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); navigate(`/posts/${selected?.id}/edit`); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Edit
        </MenuItem>
        {selected?.status !== 'published' && (
          <MenuItem onClick={() => publishMutation.mutate(selected?.id)}>
            <ListItemIcon><Publish fontSize="small" /></ListItemIcon>Publish
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAnchorEl(null); setDeleteOpen(true); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>Delete
        </MenuItem>
      </Menu>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Post</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{selected?.title}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(selected?.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
