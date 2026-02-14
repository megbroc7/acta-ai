import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Button, Stack, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import {
  ArrowBack, Edit, Publish, ThumbDown, OpenInNew, Gavel,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const STATUS_COLORS = {
  draft: 'default', pending_review: 'warning', published: 'success', rejected: 'error',
};
const STATUS_LABELS = {
  draft: 'Draft', pending_review: 'Pending Review', published: 'Published', rejected: 'Rejected',
};

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const fromReview = location.state?.from === 'review';

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then(r => r.data),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post(`/posts/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['postCounts'] });
      enqueueSnackbar('Post published', { variant: 'success' });
      if (fromReview) {
        setTimeout(() => navigate('/review'), 600);
      }
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Publish failed', { variant: 'error' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (notes) => api.post(`/posts/${id}/reject`, { review_notes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['postCounts'] });
      enqueueSnackbar('Post rejected', { variant: 'info' });
      setRejectOpen(false);
      if (fromReview) {
        setTimeout(() => navigate('/review'), 600);
      }
    },
  });

  if (isLoading) return <Typography color="text.secondary">Loading...</Typography>;
  if (!post) return <Typography color="error">Post not found</Typography>;

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(fromReview ? '/review' : '/posts')}
        sx={{ mb: 2 }}
      >
        {fromReview ? 'Back to Review Queue' : 'Back to Posts'}
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
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
            {post.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={STATUS_LABELS[post.status] || post.status}
              color={STATUS_COLORS[post.status] || 'default'}
              size="small"
            />
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
            {post.site && <Chip label={post.site.name} size="small" variant="outlined" />}
            <Typography variant="caption" color="text.secondary">
              Created {new Date(post.created_at).toLocaleDateString()}
            </Typography>
            {post.published_at && (
              <Typography variant="caption" color="text.secondary">
                 &middot; Published {new Date(post.published_at).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          {post.published_url && (
            <Button
              variant="outlined" size="small" startIcon={<OpenInNew />}
              href={post.published_url} target="_blank"
            >
              View Live
            </Button>
          )}
          <Button
            variant="outlined" size="small" startIcon={<Edit />}
            onClick={() => navigate(`/posts/${id}/edit`, { state: { from: fromReview ? 'review' : undefined } })}
          >
            Edit
          </Button>
          {post.status !== 'published' && (
            <>
              <Button
                variant="contained" size="small" startIcon={<Publish />}
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                Publish
              </Button>
              <Button
                variant="outlined" size="small" color="error" startIcon={<ThumbDown />}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </>
          )}
        </Stack>
      </Box>

      {/* Review Decision Bar */}
      {post.status === 'pending_review' && (
        <Card
          sx={{
            mb: 3,
            border: '2px solid #B08D57',
            bgcolor: 'rgba(176, 141, 87, 0.04)',
          }}
        >
          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Gavel sx={{ color: '#B08D57', fontSize: 28 }} />
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: '#B08D57',
                    }}
                  >
                    Awaiting Your Decision
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Review the content below, then approve or reject this post.
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => navigate(`/posts/${id}/edit`, { state: { from: fromReview ? 'review' : undefined } })}
                >
                  Edit First
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ThumbDown />}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Publish />}
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
                >
                  Approve & Publish
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      <Stack spacing={3}>
        {post.featured_image_url && (
          <Card>
            <Box
              component="img"
              src={post.featured_image_url}
              alt={`Featured image for ${post.title}`}
              sx={{
                width: '100%',
                maxHeight: 400,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </Card>
        )}

        {post.excerpt && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>Excerpt</Typography>
              <Typography variant="body1">{post.excerpt}</Typography>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>Content</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box
              sx={{ '& h1,& h2,& h3': { mt: 2, mb: 1 }, '& p': { mb: 1.5 }, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </CardContent>
        </Card>

        {post.review_notes && (
          <Card sx={{ borderLeft: 3, borderColor: 'error.main' }}>
            <CardContent>
              <Typography variant="subtitle2" color="error" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>Review Notes</Typography>
              <Typography variant="body2">{post.review_notes}</Typography>
            </CardContent>
          </Card>
        )}

        {(post.system_prompt_used || post.topic_prompt_used || post.content_prompt_used) && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>Prompt Audit Trail</Typography>
              <Stack spacing={1.5}>
                {post.system_prompt_used && (
                  <Box>
                    <Typography variant="caption" fontWeight={600}>System Prompt</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontSize: 13 }}>
                      {post.system_prompt_used}
                    </Typography>
                  </Box>
                )}
                {post.topic_prompt_used && (
                  <Box>
                    <Typography variant="caption" fontWeight={600}>Topic Prompt</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontSize: 13 }}>
                      {post.topic_prompt_used}
                    </Typography>
                  </Box>
                )}
                {post.content_prompt_used && (
                  <Box>
                    <Typography variant="caption" fontWeight={600}>Content Prompt</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary', fontSize: 13 }}>
                      {post.content_prompt_used}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Post</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Provide feedback for why this post is being rejected:</Typography>
          <TextField
            fullWidth multiline rows={3} value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="What needs to be improved?"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            color="error" variant="contained"
            disabled={!rejectNotes.trim() || rejectMutation.isPending}
            onClick={() => rejectMutation.mutate(rejectNotes)}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
