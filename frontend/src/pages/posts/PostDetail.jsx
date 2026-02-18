import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Button, Stack, Chip, Divider, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  LinearProgress, CircularProgress, Tooltip, IconButton,
} from '@mui/material';
import {
  ArrowBack, Edit, Publish, ThumbDown, OpenInNew, Gavel, ImageOutlined,
  AutoFixHigh, CheckCircle, ContentCopy, LinkedIn, Refresh, RecordVoiceOver,
  CheckCircleOutline, ExpandMore, Code,
} from '@mui/icons-material';
import TurndownService from 'turndown';
import { useSnackbar } from 'notistack';
import api, { fetchSSE } from '../../services/api';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

// Strip FAQ schema script tag from content for clean copying
function stripSchemaScript(html) {
  const marker = '<script type="application/ld+json">';
  const idx = html.indexOf(marker);
  if (idx === -1) return html;
  const endTag = '<' + '/script>';
  const endIdx = html.indexOf(endTag, idx);
  if (endIdx === -1) return html;
  return (html.substring(0, idx) + html.substring(endIdx + endTag.length)).trim();
}

const STATUS_COLORS = {
  draft: 'default', pending_review: 'warning', published: 'success', rejected: 'error',
};
const STATUS_LABELS = {
  draft: 'Draft', pending_review: 'Pending Review', published: 'Published', rejected: 'Rejected',
};

const REVISION_STAGES = [
  { key: 'revise', label: 'Revise' },
  { key: 'polish', label: 'Polish' },
];

function RevisionProgressBar({ progress }) {
  const { step, total, message } = progress;
  const stages = REVISION_STAGES.slice(0, total);
  const pct = total > 0 ? (step / total) * 100 : 0;

  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mb: 2 }}>
        {stages.map((s, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  bgcolor: isDone ? '#4A7C6F' : isActive ? '#B08D57' : '#E0DCD5',
                  color: (isDone || isActive) ? '#fff' : '#8A857E',
                  transition: 'all 0.3s',
                }}
              >
                {isDone ? <CheckCircle sx={{ fontSize: 18 }} /> : stepNum}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#B08D57' : isDone ? '#4A7C6F' : '#8A857E',
                  textTransform: 'uppercase', letterSpacing: '0.03em',
                }}
              >
                {s.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          bgcolor: '#E0DCD5',
          '& .MuiLinearProgress-bar': { bgcolor: '#B08D57', transition: 'transform 0.5s ease' },
        }}
      />
      {message && (
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1, fontStyle: 'italic', color: '#8A857E' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}

function FeaturedImageCard({ url, title, published, altText }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <Card>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 2,
            bgcolor: 'rgba(176, 141, 87, 0.06)',
            borderLeft: '3px solid #B08D57',
          }}
        >
          <ImageOutlined sx={{ color: '#B08D57', fontSize: 28 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#5A554E' }}>
              Featured image was generated
            </Typography>
            <Typography variant="caption" sx={{ color: '#8A857E' }}>
              {published
                ? 'The image is live on your published site. The preview link has expired here.'
                : 'The temporary preview link has expired. Generate a new post to get a fresh image.'}
            </Typography>
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <Box
        component="img"
        src={url}
        alt={altText || `Featured image for ${title}`}
        onError={() => setImgFailed(true)}
        sx={{
          width: '100%',
          maxHeight: 400,
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </Card>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  // Revision state
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseFeedback, setReviseFeedback] = useState('');
  const [revising, setRevising] = useState(false);
  const [revisionProgress, setRevisionProgress] = useState({ step: 0, total: 2, message: '' });
  const [revisionPreview, setRevisionPreview] = useState(null); // { content_html, excerpt }

  // LinkedIn repurpose state
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinText, setLinkedinText] = useState('');
  const [linkedinVoiceApplied, setLinkedinVoiceApplied] = useState(false);

  // Mark as Published state (copy platform)
  const [markPublishedOpen, setMarkPublishedOpen] = useState(false);
  const [markPublishedUrl, setMarkPublishedUrl] = useState('');
  const [showFaqSchema, setShowFaqSchema] = useState(false);

  const fromReview = location.state?.from === 'review';

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get(`/posts/${id}`).then(r => r.data),
  });

  // Declare all mutations before any conditional returns (temporal dead zone gotcha)
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

  const acceptRevisionMutation = useMutation({
    mutationFn: (revision) => api.put(`/posts/${id}`, {
      content: revision.content_html,
      excerpt: revision.excerpt,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      enqueueSnackbar('Revision accepted — content updated', { variant: 'success' });
      setReviseOpen(false);
      setRevisionPreview(null);
      setReviseFeedback('');
    },
    onError: () => enqueueSnackbar('Failed to save revision', { variant: 'error' }),
  });

  const markPublishedMutation = useMutation({
    mutationFn: (url) => api.post(`/posts/${id}/mark-published`, { published_url: url || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['postCounts'] });
      enqueueSnackbar('Post marked as published', { variant: 'success' });
      setMarkPublishedOpen(false);
      setMarkPublishedUrl('');
      if (fromReview) {
        setTimeout(() => navigate('/review'), 600);
      }
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Failed to mark as published', { variant: 'error' }),
  });

  const handleRevise = async () => {
    setRevising(true);
    setRevisionPreview(null);
    setRevisionProgress({ step: 0, total: 2, message: 'Starting...' });
    try {
      const reader = await fetchSSE(`/posts/${id}/revise-stream`, {
        feedback: reviseFeedback,
      });
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = 'message';
          let data = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (!data) continue;
          const parsed = JSON.parse(data);

          if (eventType === 'progress') {
            setRevisionProgress(parsed);
          } else if (eventType === 'complete') {
            setRevisionPreview(parsed);
          } else if (eventType === 'error') {
            enqueueSnackbar(parsed.detail || 'Revision failed', { variant: 'error' });
          }
        }
      }
    } catch (err) {
      enqueueSnackbar(err.message || 'Revision failed', { variant: 'error' });
    } finally {
      setRevising(false);
    }
  };

  const handleReviseDialogClose = () => {
    if (revising) return; // locked during revision
    setReviseOpen(false);
    setRevisionPreview(null);
    setReviseFeedback('');
    setRevisionProgress({ step: 0, total: 2, message: '' });
  };

  const handleReviseAgain = () => {
    setRevisionPreview(null);
    setRevisionProgress({ step: 0, total: 2, message: '' });
  };

  const generateLinkedinPost = async ({ closeOnError = true } = {}) => {
    setLinkedinLoading(true);
    setLinkedinText('');
    try {
      const res = await api.post(`/posts/${id}/repurpose-linkedin`);
      setLinkedinText(res.data.linkedin_post);
      setLinkedinVoiceApplied(res.data.voice_applied || false);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to generate LinkedIn post';
      enqueueSnackbar(detail, { variant: 'error' });
      if (closeOnError) setLinkedinOpen(false);
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleLinkedinOpen = () => {
    setLinkedinOpen(true);
    generateLinkedinPost({ closeOnError: true });
  };

  if (isLoading) return <Typography color="text.secondary">Loading...</Typography>;
  if (!post) return <Typography color="error">Post not found</Typography>;

  const canRevise = post.status === 'draft' || post.status === 'pending_review';
  const isCopyPlatform = post?.site?.platform === 'copy';

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(fromReview ? '/review' : '/posts')}
        sx={{ mb: 2 }}
      >
        {fromReview ? 'Back to Review Queue' : 'Back to Posts'}
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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
          {canRevise && post.status === 'draft' && (
            <Button
              variant="outlined" size="small" startIcon={<AutoFixHigh />}
              onClick={() => setReviseOpen(true)}
              sx={{
                color: '#B08D57', borderColor: '#B08D57',
                '&:hover': { borderColor: '#8A6D3B', bgcolor: 'rgba(176, 141, 87, 0.06)' },
              }}
            >
              Revise with AI
            </Button>
          )}
          <Button
            variant="outlined" size="small" startIcon={<LinkedIn />}
            onClick={handleLinkedinOpen}
            disabled={linkedinLoading}
            sx={{
              color: '#0A66C2', borderColor: '#0A66C2',
              '&:hover': { borderColor: '#004182', bgcolor: 'rgba(10, 102, 194, 0.06)' },
            }}
          >
            LinkedIn
          </Button>
          {post.status !== 'published' && (
            <>
              {isCopyPlatform ? (
                <Button
                  variant="contained" size="small" startIcon={<CheckCircleOutline />}
                  onClick={() => setMarkPublishedOpen(true)}
                  disabled={markPublishedMutation.isPending}
                >
                  Mark as Published
                </Button>
              ) : (
                <Button
                  variant="contained" size="small" startIcon={<Publish />}
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                >
                  Publish
                </Button>
              )}
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => navigate(`/posts/${id}/edit`, { state: { from: fromReview ? 'review' : undefined } })}
                >
                  Edit First
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutoFixHigh />}
                  onClick={() => setReviseOpen(true)}
                  sx={{
                    color: '#B08D57', borderColor: '#B08D57',
                    '&:hover': { borderColor: '#8A6D3B', bgcolor: 'rgba(176, 141, 87, 0.06)' },
                  }}
                >
                  Revise with AI
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ThumbDown />}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
                {isCopyPlatform ? (
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleOutline />}
                    onClick={() => setMarkPublishedOpen(true)}
                    disabled={markPublishedMutation.isPending}
                    sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
                  >
                    Approve & Mark Published
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<Publish />}
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
                  >
                    Approve & Publish
                  </Button>
                )}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      <Stack spacing={3}>
        {post.featured_image_url && (
          <FeaturedImageCard url={post.featured_image_url} title={post.title} published={post.status === 'published'} altText={post.image_alt_text} />
        )}

        {post.excerpt && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: '0.03em', mb: 0 }}>Excerpt</Typography>
                <Tooltip title="Copy excerpt">
                  <IconButton size="small" onClick={() => {
                    navigator.clipboard.writeText(post.excerpt);
                    enqueueSnackbar('Excerpt copied', { variant: 'success' });
                  }}>
                    <ContentCopy sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="body1" sx={{ mt: 1 }}>{post.excerpt}</Typography>
            </CardContent>
          </Card>
        )}

        {/* SEO Metadata Card */}
        {(post.meta_title || post.meta_description || post.image_alt_text) && (
          <Card sx={{ borderLeft: 3, borderColor: '#4A7C6F' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{
                textTransform: 'uppercase', letterSpacing: '0.03em',
                color: '#4A7C6F', fontWeight: 700, mb: 1.5,
              }}>
                SEO Metadata
              </Typography>

              {post.meta_title && (
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Meta Title
                    </Typography>
                    <Chip
                      label={`${post.meta_title.length} chars`}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: post.meta_title.length <= 60 ? 'rgba(74, 124, 111, 0.12)' : post.meta_title.length <= 78 ? 'rgba(176, 141, 87, 0.15)' : 'rgba(160, 82, 45, 0.15)',
                        color: post.meta_title.length <= 60 ? '#4A7C6F' : post.meta_title.length <= 78 ? '#B08D57' : '#A0522D',
                      }}
                    />
                    <Tooltip title="Copy meta title">
                      <IconButton size="small" onClick={() => {
                        navigator.clipboard.writeText(post.meta_title);
                        enqueueSnackbar('Meta title copied', { variant: 'success' });
                      }}>
                        <ContentCopy sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#1a0dab', fontWeight: 500 }}>
                    {post.meta_title}
                  </Typography>
                </Box>
              )}

              {post.meta_description && (
                <Box sx={{ mb: post.image_alt_text ? 1.5 : 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Meta Description
                    </Typography>
                    <Chip
                      label={`${post.meta_description.length} chars`}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: (post.meta_description.length >= 140 && post.meta_description.length <= 160) ? 'rgba(74, 124, 111, 0.12)' : 'rgba(176, 141, 87, 0.15)',
                        color: (post.meta_description.length >= 140 && post.meta_description.length <= 160) ? '#4A7C6F' : '#B08D57',
                      }}
                    />
                    <Tooltip title="Copy meta description">
                      <IconButton size="small" onClick={() => {
                        navigator.clipboard.writeText(post.meta_description);
                        enqueueSnackbar('Meta description copied', { variant: 'success' });
                      }}>
                        <ContentCopy sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {post.meta_description}
                  </Typography>
                </Box>
              )}

              {post.image_alt_text && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Image Alt Text
                    </Typography>
                    <Chip
                      label={`${post.image_alt_text.length} chars`}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: post.image_alt_text.length <= 125 ? 'rgba(74, 124, 111, 0.12)' : 'rgba(176, 141, 87, 0.15)',
                        color: post.image_alt_text.length <= 125 ? '#4A7C6F' : '#B08D57',
                      }}
                    />
                    <Tooltip title="Copy alt text">
                      <IconButton size="small" onClick={() => {
                        navigator.clipboard.writeText(post.image_alt_text);
                        enqueueSnackbar('Alt text copied', { variant: 'success' });
                      }}>
                        <ContentCopy sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {post.image_alt_text}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* FAQ Schema Card */}
        {(() => {
          try {
            const content = post.content || '';
            const marker = 'application/ld+json';
            const markerIdx = content.indexOf(marker);
            if (markerIdx === -1) return null;
            const jsonStart = content.indexOf('{', markerIdx);
            const scriptEnd = content.indexOf('<' + '/script>', markerIdx);
            if (jsonStart === -1 || scriptEnd === -1) return null;
            const jsonStr = content.substring(jsonStart, scriptEnd).trim();
            const schema = JSON.parse(jsonStr);
            if (schema['@type'] !== 'FAQPage' || !schema.mainEntity?.length) return null;
            const pairs = schema.mainEntity;
            return (
              <Card sx={{ borderLeft: 3, borderColor: '#B08D57' }}>
                <CardContent>
                  <Box
                    onClick={() => setShowFaqSchema(!showFaqSchema)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                  >
                    <Typography variant="subtitle2" sx={{
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                      color: '#B08D57', fontWeight: 700,
                    }}>
                      FAQ Schema
                    </Typography>
                    <Chip
                      label={`${pairs.length} Q&A`}
                      size="small"
                      sx={{
                        height: 20, fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: 'rgba(176, 141, 87, 0.15)',
                        color: '#B08D57',
                      }}
                    />
                    <Tooltip title="Copy JSON-LD">
                      <IconButton size="small" onClick={(e) => {
                        e.stopPropagation();
                        const scriptTag = '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n<' + '/script>';
                        navigator.clipboard.writeText(scriptTag);
                        enqueueSnackbar('FAQ schema copied', { variant: 'success' });
                      }}>
                        <ContentCopy sx={{ fontSize: 14, color: '#B08D57' }} />
                      </IconButton>
                    </Tooltip>
                    <ExpandMore sx={{
                      fontSize: 18, color: '#B08D57', ml: 'auto',
                      transform: showFaqSchema ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s',
                    }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Invisible structured data that helps your post appear in Google rich snippets and AI answer engines.
                  </Typography>
                  <Collapse in={showFaqSchema}>
                    <Box sx={{ mt: 1.5 }}>
                      {pairs.map((item, idx) => (
                        <Box key={idx} sx={{ mb: idx < pairs.length - 1 ? 1.5 : 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                            Q: {item.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.acceptedAnswer?.text}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            );
          } catch { return null; }
        })()}

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>Content</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Copy as Markdown">
                  <IconButton size="small" onClick={() => {
                    const clean = stripSchemaScript(post.content);
                    navigator.clipboard.writeText(turndown.turndown(clean));
                    enqueueSnackbar('Markdown copied to clipboard', { variant: 'success' });
                  }}>
                    <ContentCopy sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy as HTML">
                  <IconButton size="small" onClick={() => {
                    const clean = stripSchemaScript(post.content);
                    navigator.clipboard.writeText(clean);
                    enqueueSnackbar('HTML copied to clipboard', { variant: 'success' });
                  }}>
                    <Code sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box
              sx={{ '& h1,& h2,& h3': { mt: 2, mb: 1 }, '& p': { mb: 1.5 }, lineHeight: 1.7, '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', backgroundColor: 'rgba(74, 124, 111, 0.06)', pl: 2.5, pr: 2.5, py: 2, ml: 0, my: 2.5, fontStyle: 'normal', '& p': { mb: 0 } } }}
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

      {/* Reject Dialog */}
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

      {/* Revise with AI Dialog */}
      <Dialog
        open={reviseOpen}
        onClose={handleReviseDialogClose}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={revising}
      >
        {!revisionPreview ? (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoFixHigh sx={{ color: '#B08D57' }} />
              <span>Revise with AI</span>
            </DialogTitle>
            <DialogContent>
              {revising ? (
                <RevisionProgressBar progress={revisionProgress} />
              ) : (
                <>
                  <Typography sx={{ mb: 2 }} color="text.secondary">
                    Describe what you want changed. The AI will revise the article while preserving everything that works.
                  </Typography>
                  <TextField
                    fullWidth multiline rows={4} value={reviseFeedback}
                    onChange={(e) => setReviseFeedback(e.target.value)}
                    placeholder='e.g. "Make the intro punchier, add more data to section 3, tone down the conclusion"'
                    autoFocus
                  />
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleReviseDialogClose} disabled={revising}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleRevise}
                disabled={!reviseFeedback.trim() || revising}
                startIcon={revising ? <CircularProgress size={18} color="inherit" /> : <AutoFixHigh />}
                sx={{ bgcolor: '#B08D57', '&:hover': { bgcolor: '#8A6D3B' } }}
              >
                {revising ? 'Revising...' : 'Revise'}
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ color: '#4A7C6F' }} />
              <span>Revision Preview</span>
            </DialogTitle>
            <DialogContent>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Review the revised content below. Accept to save, revise again to iterate, or discard.
              </Typography>
              <Card variant="outlined" sx={{ maxHeight: 450, overflow: 'auto' }}>
                <CardContent>
                  <Box
                    sx={{ '& h1,& h2,& h3': { mt: 2, mb: 1 }, '& p': { mb: 1.5 }, lineHeight: 1.7, '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', backgroundColor: 'rgba(74, 124, 111, 0.06)', pl: 2.5, pr: 2.5, py: 2, ml: 0, my: 2.5, fontStyle: 'normal', '& p': { mb: 0 } } }}
                    dangerouslySetInnerHTML={{ __html: revisionPreview.content_html }}
                  />
                </CardContent>
              </Card>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleReviseDialogClose}>
                Discard
              </Button>
              <Button
                variant="outlined"
                onClick={handleReviseAgain}
                startIcon={<AutoFixHigh />}
                sx={{
                  color: '#B08D57', borderColor: '#B08D57',
                  '&:hover': { borderColor: '#8A6D3B', bgcolor: 'rgba(176, 141, 87, 0.06)' },
                }}
              >
                Revise Again
              </Button>
              <Button
                variant="contained"
                onClick={() => acceptRevisionMutation.mutate(revisionPreview)}
                disabled={acceptRevisionMutation.isPending}
                startIcon={acceptRevisionMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
                sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
              >
                Accept Revision
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Mark as Published Dialog (Copy & Paste platform) */}
      <Dialog
        open={markPublishedOpen}
        onClose={() => { if (!markPublishedMutation.isPending) setMarkPublishedOpen(false); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutline sx={{ color: '#4A7C6F' }} />
          <span>Mark as Published</span>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }} color="text.secondary">
            Confirm that you've pasted this content on your site. Optionally provide the live URL so you can access it from Acta AI.
          </Typography>
          <TextField
            fullWidth
            label="Published URL (optional)"
            value={markPublishedUrl}
            onChange={(e) => setMarkPublishedUrl(e.target.value)}
            placeholder={post?.site?.url || 'https://yourblog.com/my-post'}
            helperText="The URL where this post is live. Leave blank to use your site URL."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkPublishedOpen(false)} disabled={markPublishedMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={markPublishedMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutline />}
            onClick={() => markPublishedMutation.mutate(markPublishedUrl)}
            disabled={markPublishedMutation.isPending}
            sx={{ bgcolor: '#4A7C6F', '&:hover': { bgcolor: '#2D5E4A' } }}
          >
            {markPublishedMutation.isPending ? 'Saving...' : 'Confirm Published'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* LinkedIn Repurpose Dialog */}
      <Dialog
        open={linkedinOpen}
        onClose={() => { if (!linkedinLoading) setLinkedinOpen(false); }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={linkedinLoading}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkedIn sx={{ color: '#0A66C2' }} />
          <span>LinkedIn Post</span>
          {linkedinVoiceApplied && !linkedinLoading && (
            <Tooltip title="Your writing voice profile from 'Match My Writing Style' was used to shape this post">
              <Chip
                icon={<RecordVoiceOver sx={{ fontSize: 14 }} />}
                label="Your Voice"
                size="small"
                sx={{
                  ml: 'auto',
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.65rem',
                  bgcolor: 'rgba(74, 124, 111, 0.12)',
                  color: '#4A7C6F',
                  '& .MuiChip-icon': { color: '#4A7C6F' },
                }}
              />
            </Tooltip>
          )}
        </DialogTitle>
        <DialogContent>
          {linkedinLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#0A66C2' }} />
              <Typography variant="body2" color="text.secondary">
                Generating your LinkedIn post...
              </Typography>
            </Box>
          ) : (() => {
            const firstLine = linkedinText.split('\n')[0] || '';
            const hookLen = firstLine.length;
            const hookOk = hookLen <= 150;
            return (
              <>
                {/* Hook preview */}
                <Box sx={{
                  mb: 2, p: 1.5,
                  border: '1px solid',
                  borderColor: hookOk ? '#4A7C6F' : '#A0522D',
                  bgcolor: hookOk ? 'rgba(74, 124, 111, 0.04)' : 'rgba(160, 82, 45, 0.04)',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="caption" sx={{
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                      color: hookOk ? '#4A7C6F' : '#A0522D',
                    }}>
                      Hook Preview
                    </Typography>
                    <Chip
                      label={`${hookLen} / 150 chars`}
                      size="small"
                      sx={{
                        height: 20, fontWeight: 600, fontSize: '0.65rem',
                        bgcolor: hookOk ? 'rgba(74, 124, 111, 0.12)' : 'rgba(160, 82, 45, 0.15)',
                        color: hookOk ? '#4A7C6F' : '#A0522D',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{
                    fontFamily: 'Inter, sans-serif', fontWeight: 600, lineHeight: 1.5,
                  }}>
                    {firstLine}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {hookOk
                      ? 'This line appears before LinkedIn\'s "See more" button.'
                      : 'This line exceeds 150 characters and will be truncated by LinkedIn.'}
                  </Typography>
                </Box>

                {/* Full post */}
                <TextField
                  fullWidth
                  multiline
                  minRows={8}
                  maxRows={16}
                  value={linkedinText}
                  InputProps={{ readOnly: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      lineHeight: 1.6,
                    },
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                  <Chip
                    label={`${linkedinText.length} characters`}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      bgcolor: linkedinText.length <= 1500 ? 'rgba(74, 124, 111, 0.12)' : 'rgba(160, 82, 45, 0.15)',
                      color: linkedinText.length <= 1500 ? '#4A7C6F' : '#A0522D',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    LinkedIn recommends ~1300 characters
                  </Typography>
                </Box>
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkedinOpen(false)} disabled={linkedinLoading}>
            Close
          </Button>
          {!linkedinLoading && linkedinText && (
            <>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={() => generateLinkedinPost({ closeOnError: false })}
                sx={{
                  color: '#0A66C2', borderColor: '#0A66C2',
                  '&:hover': { borderColor: '#004182', bgcolor: 'rgba(10, 102, 194, 0.06)' },
                }}
              >
                Regenerate
              </Button>
              <Button
                variant="contained"
                startIcon={<ContentCopy />}
                onClick={() => {
                  navigator.clipboard.writeText(linkedinText);
                  enqueueSnackbar('LinkedIn post copied to clipboard', { variant: 'success' });
                }}
                sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' } }}
              >
                Copy to Clipboard
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
