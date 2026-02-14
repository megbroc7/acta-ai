import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Button, Checkbox, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress,
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Edit, Publish, ThumbDown, AccessTime, EmojiEvents,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const countUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const ELASTIC = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function formatWaitTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const created = new Date(dateStr);
  const diffMs = now - created;
  const minutes = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function isOlderThan24h(dateStr) {
  if (!dateStr) return false;
  return (Date.now() - new Date(dateStr).getTime()) > 86400000;
}

export default function ReviewQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [selected, setSelected] = useState(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPostId, setRejectPostId] = useState(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts', { status: 'pending_review' }],
    queryFn: () => api.get('/posts/', { params: { status: 'pending_review' } }).then(r => r.data),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['postCounts'] });
  };

  const publishMutation = useMutation({
    mutationFn: (postId) => api.post(`/posts/${postId}/publish`),
    onSuccess: () => {
      invalidateAll();
      enqueueSnackbar('Post published', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Publish failed', { variant: 'error' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ postId, notes }) => api.post(`/posts/${postId}/reject`, { review_notes: notes }),
    onSuccess: () => {
      invalidateAll();
      enqueueSnackbar('Post rejected', { variant: 'info' });
      setRejectOpen(false);
      setRejectPostId(null);
      setRejectNotes('');
    },
  });

  const bulkPublishMutation = useMutation({
    mutationFn: (postIds) => api.post('/posts/bulk/publish', { post_ids: postIds }),
    onSuccess: (res) => {
      invalidateAll();
      setSelected(new Set());
      enqueueSnackbar(`${res.data.length} post${res.data.length === 1 ? '' : 's'} published`, { variant: 'success' });
    },
    onError: () => enqueueSnackbar('Bulk publish failed', { variant: 'error' }),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ postIds, notes }) => api.post('/posts/bulk/reject', { post_ids: postIds, review_notes: notes }),
    onSuccess: (res) => {
      invalidateAll();
      setSelected(new Set());
      setBulkRejectOpen(false);
      setRejectNotes('');
      enqueueSnackbar(`${res.data.length} post${res.data.length === 1 ? '' : 's'} rejected`, { variant: 'info' });
    },
    onError: () => enqueueSnackbar('Bulk reject failed', { variant: 'error' }),
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map(p => p.id)));
    }
  };

  const handleInlineReject = (postId) => {
    setRejectPostId(postId);
    setRejectNotes('');
    setRejectOpen(true);
  };

  const isBusy = publishMutation.isPending || bulkPublishMutation.isPending || bulkRejectMutation.isPending;

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="h4"
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
            Review Queue
          </Typography>
          {posts.length > 0 && (
            <Chip
              label={posts.length}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: '#B08D57',
                color: '#fff',
                fontSize: '0.85rem',
                height: 28,
                minWidth: 28,
              }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Posts awaiting your editorial decision before publishing.
        </Typography>
      </Box>

      {/* Bulk action toolbar */}
      {posts.length > 0 && (
        <Card
          sx={{
            mb: 3,
            border: selected.size > 0 ? '1px solid #B08D57' : '1px solid #E0DCD5',
            transition: 'border-color 0.3s',
          }}
        >
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Checkbox
                checked={selected.size === posts.length && posts.length > 0}
                indeterminate={selected.size > 0 && selected.size < posts.length}
                onChange={toggleAll}
                sx={{ color: '#B08D57', '&.Mui-checked': { color: '#B08D57' } }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 80 }}>
                {selected.size > 0 ? `${selected.size} selected` : `${posts.length} pending`}
              </Typography>
              {selected.size > 0 && (
                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Publish />}
                    onClick={() => bulkPublishMutation.mutate([...selected])}
                    disabled={isBusy}
                    sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
                  >
                    Approve {selected.size}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<ThumbDown />}
                    onClick={() => { setRejectNotes(''); setBulkRejectOpen(true); }}
                    disabled={isBusy}
                  >
                    Reject {selected.size}
                  </Button>
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {posts.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 10,
            animation: `${countUp} 0.6s ease-out both`,
          }}
        >
          <EmojiEvents
            sx={{
              fontSize: 72,
              color: '#B08D57',
              mb: 2,
              animation: `${float} 3s ease-in-out infinite`,
            }}
          />
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, mb: 1 }}
          >
            All dispatches reviewed
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', fontStyle: 'italic', maxWidth: 360, mx: 'auto' }}
          >
            The Senate approves. No posts are awaiting review.
          </Typography>
        </Box>
      )}

      {/* Post cards */}
      <Stack spacing={2}>
        {posts.map((post, i) => {
          const waiting = formatWaitTime(post.created_at);
          const isOld = isOlderThan24h(post.created_at);
          const isSelected = selected.has(post.id);

          return (
            <Card
              key={post.id}
              sx={{
                border: isSelected ? '1px solid #B08D57' : '1px solid #E0DCD5',
                animation: `${countUp} 0.4s ${0.05 + i * 0.06}s ease-out both`,
                transition: `all 0.3s ${ELASTIC}`,
                '&:hover': {
                  borderColor: '#4A7C6F',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleSelect(post.id)}
                    sx={{
                      mt: -0.5,
                      color: '#B08D57',
                      '&.Mui-checked': { color: '#B08D57' },
                    }}
                  />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' },
                        }}
                        onClick={() => navigate(`/posts/${post.id}`, { state: { from: 'review' } })}
                      >
                        {post.title}
                      </Typography>
                      {post.updated_at && (
                        <Chip
                          label="EDITED"
                          size="small"
                          icon={<Edit sx={{ fontSize: '14px !important' }} />}
                          sx={{
                            height: 22,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            bgcolor: 'rgba(176, 141, 87, 0.12)',
                            color: '#B08D57',
                            '& .MuiChip-icon': { color: '#B08D57' },
                          }}
                        />
                      )}
                    </Box>

                    {/* Metadata row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AccessTime sx={{ fontSize: 14, color: isOld ? '#B08D57' : 'text.secondary' }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: isOld ? 700 : 400,
                            color: isOld ? '#B08D57' : 'text.secondary',
                          }}
                        >
                          {waiting}
                        </Typography>
                      </Box>
                      {post.site && (
                        <Chip label={post.site.name} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.75rem' }} />
                      )}
                      {post.content && (
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(post.content.replace(/<[^>]*>/g, '').split(/\s+/).length)} words
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Inline actions */}
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, ml: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => navigate(`/posts/${post.id}/edit`, { state: { from: 'review' } })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Publish />}
                      onClick={() => publishMutation.mutate(post.id)}
                      disabled={isBusy}
                      sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<ThumbDown />}
                      onClick={() => handleInlineReject(post.id)}
                      disabled={isBusy}
                    >
                      Reject
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Single reject dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Post</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Provide feedback for why this post is being rejected:</Typography>
          <TextField
            fullWidth multiline rows={3} value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="What needs to be improved?"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            color="error" variant="contained"
            disabled={!rejectNotes.trim() || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({ postId: rejectPostId, notes: rejectNotes })}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk reject dialog */}
      <Dialog open={bulkRejectOpen} onClose={() => setBulkRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject {selected.size} Post{selected.size === 1 ? '' : 's'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            This note will be applied to all {selected.size} selected post{selected.size === 1 ? '' : 's'}:
          </Typography>
          <TextField
            fullWidth multiline rows={3} value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="What needs to be improved?"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkRejectOpen(false)}>Cancel</Button>
          <Button
            color="error" variant="contained"
            disabled={!rejectNotes.trim() || bulkRejectMutation.isPending}
            onClick={() => bulkRejectMutation.mutate({ postIds: [...selected], notes: rejectNotes })}
          >
            Reject {selected.size}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
