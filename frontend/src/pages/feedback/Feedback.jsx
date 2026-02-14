import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Paper,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'general', label: 'General Feedback' },
];

const CATEGORY_COLORS = {
  bug: '#A0522D',
  feature: '#4A7C6F',
  general: '#B08D57',
};

export default function Feedback() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['feedback'],
    queryFn: () => api.get('/feedback/').then((r) => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => api.post('/feedback/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      enqueueSnackbar('Feedback submitted — gratias tibi ago', { variant: 'success' });
      setCategory('general');
      setMessage('');
    },
    onError: (err) => {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to submit feedback', {
        variant: 'error',
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    submitMutation.mutate({ category, message: message.trim() });
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Page title */}
      <Typography
        variant="h4"
        sx={{
          mb: 4,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -6,
            left: 0,
            width: '100%',
            height: 3,
            background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
          },
        }}
      >
        Feedback
      </Typography>

      {/* Submission form */}
      <Paper
        variant="outlined"
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 3,
          mb: 5,
          borderColor: '#E0DCD5',
          borderLeft: '4px solid #4A7C6F',
        }}
      >
        <Typography
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            fontSize: '0.85rem',
            mb: 2,
          }}
        >
          Submit Feedback
        </Typography>

        <TextField
          select
          fullWidth
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          sx={{ mb: 2 }}
          size="small"
        >
          {CATEGORIES.map((c) => (
            <MenuItem key={c.value} value={c.value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={10}
          label="Your message"
          placeholder="Describe the bug, feature idea, or feedback..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={!message.trim() || submitMutation.isPending}
          startIcon={
            submitMutation.isPending ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <SendIcon />
            )
          }
          sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit'}
        </Button>
      </Paper>

      {/* Previous submissions */}
      <Typography
        sx={{
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontSize: '0.85rem',
          mb: 2,
        }}
      >
        Your Submissions
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : submissions.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            borderColor: '#E0DCD5',
            borderStyle: 'dashed',
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              mb: 1,
              color: '#B08D57',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            No submissions yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your voice shapes the forum. Submit your first feedback above.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {submissions.map((item) => (
            <Paper
              key={item.id}
              variant="outlined"
              sx={{
                p: 2.5,
                borderColor: '#E0DCD5',
                borderLeft: `4px solid ${CATEGORY_COLORS[item.category] || '#B08D57'}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Chip
                  label={
                    CATEGORIES.find((c) => c.value === item.category)?.label || item.category
                  }
                  size="small"
                  sx={{
                    bgcolor: CATEGORY_COLORS[item.category] || '#B08D57',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    height: 24,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {item.message}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
