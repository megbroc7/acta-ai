import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  MenuItem, Divider, IconButton, Collapse,
  Tooltip,
} from '@mui/material';
import { Save, ArrowBack, Add, Close, ExpandMore } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../../services/api';

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'custom'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMEZONES = [
  'UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
];

export default function ScheduleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    name: '', site_id: '', prompt_template_id: '',
    frequency: 'daily', custom_cron: '', day_of_week: 1, day_of_month: 1,
    time_of_day: '09:00', timezone: 'UTC',
    topics: [], // [{topic: string, experience: string}]
    word_count: '', tone: '',
    post_status: 'pending_review',
  });
  const [topicInput, setTopicInput] = useState('');
  const [expandedTopic, setExpandedTopic] = useState(null);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites/').then(r => r.data),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates/').then(r => r.data),
  });

  const { data: schedule } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => api.get(`/schedules/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (schedule) {
      // Normalize topics: support legacy string[] and new {topic, experience}[]
      const rawTopics = schedule.topics || [];
      const normalizedTopics = rawTopics.map(t =>
        typeof t === 'string' ? { topic: t, experience: '' } : { topic: t.topic || '', experience: t.experience || '' }
      );
      setForm({
        name: schedule.name || '',
        site_id: schedule.site_id || '',
        prompt_template_id: schedule.prompt_template_id || '',
        frequency: schedule.frequency || 'daily',
        custom_cron: schedule.custom_cron || '',
        day_of_week: schedule.day_of_week ?? 1,
        day_of_month: schedule.day_of_month ?? 1,
        time_of_day: schedule.time_of_day || '09:00',
        timezone: schedule.timezone || 'UTC',
        topics: normalizedTopics,
        word_count: schedule.word_count || '',
        tone: schedule.tone || '',
        post_status: schedule.post_status === 'draft' ? 'pending_review' : (schedule.post_status || 'pending_review'),
      });
    }
  }, [schedule]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/schedules/${id}`, data) : api.post('/schedules/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      enqueueSnackbar(isEdit ? 'Schedule updated' : 'Schedule created', { variant: 'success' });
      navigate('/schedules');
    },
    onError: (err) => enqueueSnackbar(err.response?.data?.detail || 'Failed to save', { variant: 'error' }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.word_count) data.word_count = null;
    if (!data.tone) data.tone = null;
    if (!data.custom_cron) data.custom_cron = null;
    if (data.frequency !== 'weekly') data.day_of_week = null;
    if (data.frequency !== 'monthly') data.day_of_month = null;
    if (data.frequency !== 'custom') data.custom_cron = null;
    saveMutation.mutate(data);
  };

  const addTopic = () => {
    const text = topicInput.trim();
    if (text && !form.topics.some(t => t.topic === text)) {
      setForm({ ...form, topics: [...form.topics, { topic: text, experience: '' }] });
      setTopicInput('');
      setExpandedTopic(form.topics.length); // auto-expand the new one
    }
  };

  const removeTopic = (idx) => {
    const updated = form.topics.filter((_, i) => i !== idx);
    setForm({ ...form, topics: updated });
    if (expandedTopic === idx) setExpandedTopic(null);
    else if (expandedTopic > idx) setExpandedTopic(expandedTopic - 1);
  };

  const updateTopicExperience = (idx, value) => {
    const updated = [...form.topics];
    updated[idx] = { ...updated[idx], experience: value };
    setForm({ ...form, topics: updated });
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateChecked = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/schedules')} sx={{ mb: 2 }}>
        Back to Schedules
      </Button>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: 3,
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
        {isEdit ? 'Edit Schedule' : 'New Schedule'}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Basic Info</Typography>
              <Stack spacing={2}>
                <TextField label="Schedule Name" required fullWidth value={form.name} onChange={update('name')} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField select label="Site" required fullWidth value={form.site_id} onChange={update('site_id')}>
                    <MenuItem value="">Select a site</MenuItem>
                    {sites.filter(s => !['shopify', 'wix'].includes(s.platform)).map(s => (
                      <MenuItem key={s.id} value={s.id}>{s.name} ({s.platform ? s.platform.charAt(0).toUpperCase() + s.platform.slice(1) : 'WordPress'})</MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Template" required fullWidth value={form.prompt_template_id} onChange={update('prompt_template_id')}>
                    <MenuItem value="">Select a template</MenuItem>
                    {templates.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </TextField>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Schedule Timing</Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField select label="Frequency" required value={form.frequency} onChange={update('frequency')} sx={{ width: { xs: '100%', sm: 200 } }}>
                    {FREQUENCIES.map(f => <MenuItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</MenuItem>)}
                  </TextField>
                  {form.frequency === 'weekly' && (
                    <TextField select label="Day of Week" value={form.day_of_week} onChange={update('day_of_week')} sx={{ width: { xs: '100%', sm: 200 } }}>
                      {DAYS_OF_WEEK.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
                    </TextField>
                  )}
                  {form.frequency === 'monthly' && (
                    <TextField
                      label="Day of Month" type="number" value={form.day_of_month}
                      onChange={update('day_of_month')} sx={{ width: { xs: '100%', sm: 200 } }}
                      inputProps={{ min: 1, max: 28 }}
                    />
                  )}
                  {form.frequency === 'custom' && (
                    <TextField label="Cron Expression" value={form.custom_cron} onChange={update('custom_cron')} sx={{ width: { xs: '100%', sm: 200 } }} placeholder="0 9 * * MON" />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Time of Day" type="time" required value={form.time_of_day}
                    onChange={update('time_of_day')} sx={{ width: { xs: '100%', sm: 200 } }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField select label="Timezone" value={form.timezone} onChange={update('timezone')} sx={{ width: { xs: '100%', sm: 200 } }}>
                    {TIMEZONES.map(tz => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                  </TextField>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Content Calendar</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your template defines <em>how</em> the AI writes. These topics define <em>what</em> it writes about. The scheduler will cycle through them in order, generating a fresh article for each one. You can also add a specific experience note per topic — a personal anecdote, data point, or opinion that gets woven into that article.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  label="Add a topic" fullWidth size="small" value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
                  placeholder='e.g. "benefits of morning exercise"'
                />
                <IconButton onClick={addTopic} color="primary"><Add /></IconButton>
              </Box>
              <Stack spacing={1}>
                {form.topics.map((item, idx) => (
                  <Box key={idx} sx={{
                    border: '1px solid',
                    borderColor: expandedTopic === idx ? 'primary.main' : 'divider',
                    transition: 'border-color 0.15s',
                  }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', p: 1.5, gap: 1,
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'rgba(74, 124, 111, 0.03)' },
                    }}
                      onClick={() => setExpandedTopic(expandedTopic === idx ? null : idx)}
                    >
                      <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                        {item.topic}
                      </Typography>
                      {item.experience?.trim() && (
                        <Tooltip title="Has experience note">
                          <Typography variant="caption" sx={{
                            color: 'primary.main', fontWeight: 700, fontSize: '0.65rem',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            EXP
                          </Typography>
                        </Tooltip>
                      )}
                      <ExpandMore sx={{
                        fontSize: 20, color: 'text.secondary',
                        transform: expandedTopic === idx ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }} />
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeTopic(idx); }}>
                        <Close sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                    <Collapse in={expandedTopic === idx}>
                      <Box sx={{ px: 1.5, pb: 1.5 }}>
                        <TextField
                          fullWidth multiline rows={2} size="small"
                          label="Your experience with this topic"
                          placeholder="e.g. I tried this in 2024 and lost $5k before figuring out what actually works..."
                          value={item.experience || ''}
                          onChange={(e) => updateTopicExperience(idx, e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          helperText="Optional — specific anecdotes, data, or opinions that make this article uniquely yours"
                        />
                      </Box>
                    </Collapse>
                  </Box>
                ))}
                {form.topics.length === 0 && (
                  <Typography variant="body2" color="text.disabled">No topics added yet</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Options</Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Word Count Override" type="number" value={form.word_count}
                    onChange={update('word_count')} sx={{ width: { xs: '100%', sm: 200 } }}
                    helperText="Leave blank to use template default"
                  />
                  <TextField
                    label="Tone Override" value={form.tone} onChange={update('tone')} sx={{ width: { xs: '100%', sm: 200 } }}
                    helperText="Leave blank to use template default"
                  />
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField select label="Post Status" value={form.post_status} onChange={update('post_status')} sx={{ width: { xs: '100%', sm: 200 } }}
                    helperText={
                      form.post_status === 'publish' ? 'Auto-publish to your site immediately' :
                      'Hold for editorial review before publishing'
                    }
                  >
                    <MenuItem value="pending_review">Review First</MenuItem>
                    <MenuItem value="publish">Auto-Publish</MenuItem>
                  </TextField>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box>
            <Button
              type="submit" variant="contained" size="large" startIcon={<Save />}
              disabled={saveMutation.isPending || form.topics.length === 0}
            >
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </Box>
        </Stack>
      </form>
    </Box>
  );
}
