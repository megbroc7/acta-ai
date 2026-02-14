import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

export default function PostEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    title: '', content: '', excerpt: '',
  });

  const { data: post } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
      });
    }
  }, [post]);

  const saveMutation = useMutation({
    mutationFn: (data) => api.put(`/posts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      enqueueSnackbar('Post updated', { variant: 'success' });
      navigate(`/posts/${id}`);
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Failed to save', { variant: 'error' }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.excerpt) data.excerpt = null;
    saveMutation.mutate(data);
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(`/posts/${id}`)} sx={{ mb: 2 }}>
        Back to Post
      </Button>
      <Typography variant="h4" sx={{ mb: 3 }}>Edit Post</Typography>

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                <TextField label="Title" required fullWidth value={form.title} onChange={update('title')} />
                <TextField label="Excerpt" fullWidth multiline rows={2} value={form.excerpt} onChange={update('excerpt')} />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Content</Typography>
              <TextField
                fullWidth multiline rows={20} value={form.content} onChange={update('content')}
                placeholder="Write your post content here (HTML supported)..."
                sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 14 } }}
              />
            </CardContent>
          </Card>

          <Box>
            <Button type="submit" variant="contained" size="large" startIcon={<Save />} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Update Post'}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}
