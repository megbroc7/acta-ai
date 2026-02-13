import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  MenuItem, Tabs, Tab, Slider, Switch, FormControlLabel, Chip,
  CircularProgress, LinearProgress, Tooltip, IconButton, Collapse, Alert, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Save, ArrowBack, AutoAwesome, HelpOutline, ExpandMore, TuneOutlined,
  PlayArrow, RestartAlt, Visibility, VisibilityOff, Article, RecordVoiceOver,
  SkipNext, ContentCopy, QuestionAnswer,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api, { fetchSSE } from '../../services/api';
import { HEADLINE_STYLES, resolveHeadlineStyle } from '../../constants/headlineStyles';
const AUDIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'general'];
const TONES = [
  'informative', 'conversational', 'professional', 'friendly',
  'authoritative', 'witty', 'empathetic', 'inspirational', 'casual', 'formal',
];
const PERSPECTIVES = [
  { value: '', label: 'None' },
  { value: 'first_person', label: 'First Person (I/We)' },
  { value: 'second_person', label: 'Second Person (You)' },
  { value: 'third_person', label: 'Third Person (They)' },
];
const KEYWORD_DENSITIES = [
  { value: '', label: 'None' },
  { value: 'low', label: 'Low — Natural mention' },
  { value: 'medium', label: 'Medium — Regular placement' },
  { value: 'high', label: 'High — Frequent use' },
];
const META_DESC_STYLES = [
  { value: '', label: 'None' },
  { value: 'concise', label: 'Concise' },
  { value: 'question', label: 'Question' },
  { value: 'benefit_driven', label: 'Benefit-Driven' },
  { value: 'statistic', label: 'Statistic' },
];

const PERSONALITY_MARKS = [
  { value: 1, label: 'Factual' },
  { value: 5, label: 'Balanced' },
  { value: 10, label: 'Opinionated' },
];

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

const PIPELINE_STAGES = [
  { key: 'outline', label: 'Outline' },
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
];

function ContentProgressBar({ progress }) {
  if (!progress) return null;
  return (
    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', backgroundColor: 'background.default' }}>
      <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
        {PIPELINE_STAGES.map(({ key, label }, idx) => {
          const stepNum = idx + 1;
          const isDone = progress.step > stepNum;
          const isActive = progress.stage === key;
          return (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isDone ? (
                <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              ) : (
                <Box sx={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700,
                  color: isActive ? 'primary.main' : 'text.disabled',
                }}>
                  {stepNum}
                </Box>
              )}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isActive ? 700 : 400,
                  color: isDone ? 'primary.main' : isActive ? 'text.primary' : 'text.disabled',
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  letterSpacing: '0.03em',
                }}
              >
                {label}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.max(0, ((progress.step - 1) / progress.total) * 100)}
        sx={{
          height: 6,
          borderRadius: 0,
          backgroundColor: '#E0DCD5',
          '& .MuiLinearProgress-bar': {
            backgroundColor: 'primary.main',
            borderRadius: 0,
          },
        }}
      />
      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary', fontSize: '0.8rem' }}>
        {progress.message}
      </Typography>
    </Box>
  );
}

function ChipInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const chips = value || [];

  const addChip = () => {
    const trimmed = input.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onChange([...chips, trimmed]);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChip();
    }
  };

  return (
    <Box>
      <TextField
        label={label}
        fullWidth
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addChip}
        placeholder={placeholder}
        helperText="Press Enter to add"
        size="small"
      />
      {chips.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {chips.map((chip) => (
            <Chip
              key={chip}
              label={chip}
              size="small"
              onDelete={() => onChange(chips.filter((c) => c !== chip))}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function FieldLabel({ label, tooltip }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {label}
      <Tooltip title={tooltip} arrow placement="right">
        <HelpOutline sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
      </Tooltip>
    </Box>
  );
}

export default function PromptForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);

  const [form, setForm] = useState({
    name: '', description: '',
    system_prompt: '',
    topic_generation_prompt: '',
    content_generation_prompt: '',
    default_word_count: 1500, default_tone: 'informative',
    content_type: 'ai_selected', writing_style: '', industry: '', audience_level: '',
    target_reader: '',
    call_to_action: '',
    experience_notes: '',
    experience_qa: null,
    // Voice & Humanization
    perspective: '',
    brand_voice_description: '',
    phrases_to_avoid: [],
    preferred_terms: [],
    personality_level: 5,
    use_anecdotes: false,
    use_rhetorical_questions: false,
    use_humor: false,
    use_contractions: true,
    // SEO
    seo_focus_keyword: '',
    seo_keywords: [],
    seo_keyword_density: '',
    seo_meta_description_style: '',
    seo_internal_linking_instructions: '',
    // Categories & Tags
    default_categories: [],
    default_tags: [],
  });

  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);

  // Test panel state
  const [testTopic, setTestTopic] = useState('');
  const [testTitles, setTestTitles] = useState([]);
  const [selectedTitleIdx, setSelectedTitleIdx] = useState(null);
  const [testTitle, setTestTitle] = useState('');
  const [testContent, setTestContent] = useState(null);
  const [testPrompts, setTestPrompts] = useState(null);
  const [testingTitle, setTestingTitle] = useState(false);
  const [testingContent, setTestingContent] = useState(false);
  const [contentProgress, setContentProgress] = useState(null); // { stage, step, total, message }
  const [showPrompts, setShowPrompts] = useState(false);

  // Interview state
  const [interviewQuestions, setInterviewQuestions] = useState([]);
  const [interviewAnswers, setInterviewAnswers] = useState([]);
  const [interviewLoading, setInterviewLoading] = useState(false);

  // Template-level experience interview
  const [experienceLoading, setExperienceLoading] = useState(false);

  // AI keyword suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const { data: template } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.get(`/templates/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name || '',
        description: template.description || '',
        system_prompt: template.system_prompt || '',
        topic_generation_prompt: template.topic_generation_prompt || '',
        content_generation_prompt: template.content_generation_prompt || '',
        default_word_count: template.default_word_count || 1500,
        default_tone: template.default_tone || 'informative',
        content_type: resolveHeadlineStyle(template.content_type),
        writing_style: template.writing_style || '',
        industry: template.industry || '',
        audience_level: template.audience_level || '',
        target_reader: template.target_reader || '',
        call_to_action: template.call_to_action || '',
        experience_notes: template.experience_notes || '',
        experience_qa: template.experience_qa || null,
        // Voice & Humanization
        perspective: template.perspective || '',
        brand_voice_description: template.brand_voice_description || '',
        phrases_to_avoid: template.phrases_to_avoid || [],
        preferred_terms: template.preferred_terms || [],
        personality_level: template.personality_level ?? 5,
        use_anecdotes: template.use_anecdotes ?? false,
        use_rhetorical_questions: template.use_rhetorical_questions ?? false,
        use_humor: template.use_humor ?? false,
        use_contractions: template.use_contractions ?? true,
        // SEO
        seo_focus_keyword: template.seo_focus_keyword || '',
        seo_keywords: template.seo_keywords || [],
        seo_keyword_density: template.seo_keyword_density || '',
        seo_meta_description_style: template.seo_meta_description_style || '',
        seo_internal_linking_instructions: template.seo_internal_linking_instructions || '',
        // Categories & Tags
        default_categories: template.default_categories || [],
        default_tags: template.default_tags || [],
      });
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? api.put(`/templates/${id}`, data) : api.post('/templates/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      enqueueSnackbar(isEdit ? 'Template updated' : 'Template created', { variant: 'success' });
      navigate('/prompts');
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(', ') : 'Failed to save';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    // Convert empty strings to null for optional fields
    const nullableStrings = [
      'writing_style', 'audience_level', 'industry',
      'description', 'perspective',
      'brand_voice_description', 'seo_focus_keyword', 'seo_keyword_density',
      'seo_meta_description_style', 'seo_internal_linking_instructions',
      'experience_notes', 'target_reader', 'call_to_action',
    ];
    nullableStrings.forEach(f => { if (!data[f]) data[f] = null; });
    // Convert empty arrays to null
    const nullableArrays = [
      'phrases_to_avoid', 'preferred_terms', 'seo_keywords', 'default_categories', 'default_tags',
    ];
    nullableArrays.forEach(f => { if (!data[f]?.length) data[f] = null; });
    // Null out experience_qa if empty
    if (!data.experience_qa?.length) data.experience_qa = null;
    saveMutation.mutate(data);
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateChecked = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const handleSuggestKeywords = async () => {
    setSuggestLoading(true);
    try {
      const res = await api.post('/templates/suggest-keywords', {
        industry: form.industry || null,
        topic: form.name || null,
        niche: form.content_type || null,
        existing_keywords: form.seo_keywords || [],
      });
      setSuggestions(res.data.keywords || []);
      // Auto-fill focus keyword if empty
      if (!form.seo_focus_keyword && res.data.focus_keyword_suggestion) {
        setForm(prev => ({ ...prev, seo_focus_keyword: res.data.focus_keyword_suggestion }));
      }
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to suggest keywords', { variant: 'error' });
    } finally {
      setSuggestLoading(false);
    }
  };

  const addSuggestedKeyword = (keyword) => {
    const current = form.seo_keywords || [];
    if (!current.includes(keyword)) {
      setForm({ ...form, seo_keywords: [...current, keyword] });
    }
    setSuggestions(suggestions.filter(s => s !== keyword));
  };

  const handleGenerateExperienceQuestions = async () => {
    setExperienceLoading(true);
    try {
      const res = await api.post(`/templates/${id}/generate-experience-questions`);
      const questions = res.data.questions || [];
      setForm(prev => ({
        ...prev,
        experience_qa: questions.map(q => ({ question: q, answer: '' })),
      }));
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to generate questions', { variant: 'error' });
    } finally {
      setExperienceLoading(false);
    }
  };

  const updateExperienceAnswer = (idx, answer) => {
    setForm(prev => {
      const qa = [...(prev.experience_qa || [])];
      qa[idx] = { ...qa[idx], answer };
      return { ...prev, experience_qa: qa };
    });
  };

  const handleGenerateInterview = async () => {
    setInterviewLoading(true);
    try {
      const res = await api.post(`/templates/${id}/test/interview`, { title: testTitle });
      const questions = res.data.questions || [];
      setInterviewQuestions(questions);
      setInterviewAnswers(new Array(questions.length).fill(''));
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Interview generation failed', { variant: 'error' });
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleTestTitle = async () => {
    setTestingTitle(true);
    setTestTitles([]);
    setSelectedTitleIdx(null);
    setTestTitle('');
    setTestContent(null);
    setTestPrompts(null);
    setInterviewQuestions([]);
    setInterviewAnswers([]);
    setInterviewLoading(false);
    try {
      const res = await api.post(`/templates/${id}/test/topic`, { topic: testTopic });
      const titles = res.data.titles || [];
      setTestTitles(titles);
      if (titles.length > 0) {
        setSelectedTitleIdx(0);
        setTestTitle(titles[0]);
      }
      setTestPrompts({
        title_system_prompt_used: res.data.title_system_prompt_used,
        topic_prompt_used: res.data.topic_prompt_used,
        system_prompt_used: null,
        content_prompt_used: null,
        outline_used: null,
      });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Title generation failed', { variant: 'error' });
    } finally {
      setTestingTitle(false);
    }
  };

  const handleTestContent = async () => {
    setTestingContent(true);
    setContentProgress({ stage: null, step: 0, total: 3, message: 'Starting...' });
    try {
      const answered = interviewAnswers.filter(a => a.trim());
      const reader = await fetchSSE(`/templates/${id}/test/content-stream`, {
        title: testTitle,
        experience_answers: answered,
      });
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages from buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete chunk
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
            setContentProgress(parsed);
          } else if (eventType === 'complete') {
            setTestContent({
              content_html: parsed.content_html,
              content_markdown: parsed.content_markdown,
              excerpt: parsed.excerpt,
            });
            setTestPrompts(prev => ({
              ...prev,
              system_prompt_used: parsed.system_prompt_used,
              content_prompt_used: parsed.content_prompt_used,
              outline_used: parsed.outline_used,
            }));
          } else if (eventType === 'error') {
            enqueueSnackbar(parsed.detail || 'Content generation failed', { variant: 'error' });
          }
        }
      }
    } catch (err) {
      enqueueSnackbar(err.message || 'Content generation failed', { variant: 'error' });
    } finally {
      setTestingContent(false);
      setContentProgress(null);
    }
  };

  const handleTestReset = () => {
    setTestTopic('');
    setTestTitles([]);
    setSelectedTitleIdx(null);
    setTestTitle('');
    setTestContent(null);
    setTestPrompts(null);
    setShowPrompts(false);
    setInterviewQuestions([]);
    setInterviewAnswers([]);
    setInterviewLoading(false);
    setContentProgress(null);
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/prompts')} sx={{ mb: 2 }}>
        Back to Templates
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
        {isEdit ? 'Edit Template' : 'New Template'}
      </Typography>

      <form onSubmit={handleSubmit}>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  minHeight: 56,
                },
              }}
            >
              <Tab label="Basic Info" />
              <Tab label="Prompts" />
              <Tab label="Voice & Tone" />
              <Tab label="SEO" />
              <Tab label="Defaults" />
              <Tab label="Test" icon={<AutoAwesome sx={{ fontSize: 18 }} />} iconPosition="start" />
            </Tabs>
          </Box>

          <CardContent sx={{ p: 3 }}>
            {/* TAB 0: Basic Info */}
            <TabPanel value={tab} index={0}>
              <Stack spacing={2.5}>
                <TextField label="Template Name" required fullWidth value={form.name} onChange={update('name')} />
                <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={update('description')} />
                <TextField label="Industry" fullWidth value={form.industry} onChange={update('industry')} placeholder="e.g. technology, healthcare, finance" />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    select
                    label={<FieldLabel label="Headline Style" tooltip="Controls the type of headlines generated. A specific style produces 5 titles of that type. AI-Selected generates one of each type, and the scheduler picks using weighted random (Listicle 35%, How-To 25%, Experience 20%, Direct Benefit 15%, Contrarian 5%)." />}
                    value={form.content_type}
                    onChange={update('content_type')}
                    sx={{ width: 300 }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {HEADLINE_STYLES.map(s => (
                      <MenuItem key={s.value} value={s.value}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.25 }}>{s.description}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Audience Level" value={form.audience_level} onChange={update('audience_level')} sx={{ width: 220 }}>
                    <MenuItem value="">None</MenuItem>
                    {AUDIENCE_LEVELS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </TextField>
                </Box>
                <TextField
                  label={<FieldLabel label="Target Reader Persona" tooltip="Describe your ideal reader. Goes beyond audience level to paint a specific picture — their role, pain points, and what they're hoping to learn. Example: 'A mid-level marketing manager at a B2B SaaS company who needs to justify budget to their VP.'" />}
                  fullWidth multiline rows={2}
                  value={form.target_reader} onChange={update('target_reader')}
                  placeholder="e.g. 'Small business owners who handle their own marketing with no dedicated team'"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            </TabPanel>

            {/* TAB 1: Prompts */}
            <TabPanel value={tab} index={1}>
              <Stack spacing={2.5}>
                <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
                  The AI's role is built automatically from your Industry, Content Type, and Audience Level on the Basic Info tab. Use the Experience Interview below to inject your real expertise, and the Advanced Prompt Controls to fine-tune prompts or add custom instructions.
                </Alert>

                {/* Experience Interview Q&A */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <FieldLabel
                      label="Your Expertise"
                      tooltip="AI-generated interview questions to extract your real experience. Your answers get injected into every post as E-E-A-T signals. Required for scheduling."
                    />
                    {isEdit && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={experienceLoading ? <CircularProgress size={16} /> : <QuestionAnswer />}
                        onClick={handleGenerateExperienceQuestions}
                        disabled={experienceLoading}
                        sx={{ ml: 'auto' }}
                      >
                        {experienceLoading
                          ? 'Generating...'
                          : form.experience_qa?.length
                            ? 'Regenerate Questions'
                            : 'Generate Interview'}
                      </Button>
                    )}
                  </Box>

                  {/* Legacy alert: old-style experience_notes without Q&A */}
                  {form.experience_notes && !form.experience_qa?.length && (
                    <Alert severity="info" variant="outlined" sx={{ mb: 2, borderColor: 'divider' }}>
                      This template has manually written experience notes. Generate an interview to switch to the guided Q&A format — your existing notes will remain until you save with new answers.
                    </Alert>
                  )}

                  {!isEdit && (
                    <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
                      Save the template first, then generate interview questions to capture your expertise.
                    </Alert>
                  )}

                  {isEdit && !form.experience_qa?.length && !experienceLoading && (
                    <Box sx={{
                      p: 4,
                      border: '2px dashed',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}>
                      <QuestionAnswer sx={{ fontSize: 40, color: 'text.disabled' }} />
                      <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center' }}>
                        Click "Generate Interview" to get AI-powered questions that extract your real expertise.
                        Your answers will be woven into every article this template produces.
                      </Typography>
                    </Box>
                  )}

                  {experienceLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary">Generating interview questions...</Typography>
                    </Box>
                  )}

                  {form.experience_qa?.length > 0 && (
                    <Stack spacing={2}>
                      {form.experience_qa.map((item, idx) => (
                        <Box key={idx} sx={{
                          p: 2,
                          border: '1px solid',
                          borderColor: item.answer?.trim() ? 'primary.main' : 'divider',
                          backgroundColor: item.answer?.trim()
                            ? 'rgba(74, 124, 111, 0.04)'
                            : 'transparent',
                          transition: 'border-color 0.2s, background-color 0.2s',
                        }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            {idx + 1}. {item.question}
                          </Typography>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            placeholder="Share your real experience — specific numbers, stories, and outcomes work best"
                            value={item.answer || ''}
                            onChange={(e) => updateExperienceAnswer(idx, e.target.value)}
                          />
                        </Box>
                      ))}
                      <Typography variant="caption" color="text.secondary">
                        Answer at least one question. Your answers are automatically formatted and saved as experience notes when you save the template.
                      </Typography>
                    </Stack>
                  )}
                </Box>

                <Button
                  onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                  startIcon={<TuneOutlined />}
                  endIcon={<ExpandMore sx={{ transform: showAdvancedPrompts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                  sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
                >
                  Advanced Prompt Controls
                </Button>

                <Collapse in={showAdvancedPrompts}>
                  <Stack spacing={2.5}>
                    <TextField
                      label={<FieldLabel label="Custom Instructions" tooltip="Optional extra context for the AI that isn't covered by the structured fields. For example: 'Always mention our proprietary method by name' or 'Cite at least two studies per section.' This is appended to the auto-built system prompt." />}
                      fullWidth multiline rows={3}
                      value={form.system_prompt} onChange={update('system_prompt')}
                      placeholder="Optional — add any additional instructions for the AI writer"
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label={<FieldLabel label="Call to Action" tooltip="The business goal for every post. The AI will naturally guide readers toward this action without being pushy. Example: 'Book a free consultation' or 'Download our starter template'." />}
                      fullWidth multiline rows={2}
                      value={form.call_to_action} onChange={update('call_to_action')}
                      placeholder="e.g. 'Sign up for our weekly newsletter' or 'Schedule a demo'"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Stack>
                </Collapse>
              </Stack>
            </TabPanel>

            {/* TAB 2: Voice & Tone */}
            <TabPanel value={tab} index={2}>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    select
                    label={<FieldLabel label="Perspective" tooltip="The point of view the AI writes from. First person (I/We) feels personal, second person (You) speaks directly to readers, third person (They) is more formal and objective." />}
                    value={form.perspective} onChange={update('perspective')} sx={{ width: 280 }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {PERSPECTIVES.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label={<FieldLabel label="Tone" tooltip="The overall emotional feel and style of the writing. This shapes how the AI sounds — from strictly professional to lighthearted and casual." />}
                    value={form.default_tone} onChange={update('default_tone')} sx={{ width: 240 }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {TONES.map(t => <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>)}
                  </TextField>
                </Box>

                <Box>
                  <FieldLabel label="Personality Level" tooltip="How opinionated the writing should be. Low = strictly factual and neutral. High = strong opinions, bold claims, and a distinctive voice." />
                  <Box sx={{ px: 2, maxWidth: 500 }}>
                    <Slider
                      value={form.personality_level}
                      onChange={(_, v) => setForm({ ...form, personality_level: v })}
                      min={1}
                      max={10}
                      step={1}
                      marks={PERSONALITY_MARKS}
                      valueLabelDisplay="auto"
                      sx={{
                        '& .MuiSlider-markLabel': { fontSize: '0.75rem' },
                      }}
                    />
                  </Box>
                </Box>

                <TextField
                  label={<FieldLabel label="Brand Voice Description" tooltip="Describe your brand's unique voice in your own words. This gives the AI a detailed personality to mimic — the more specific, the better the results." />}
                  fullWidth multiline rows={3}
                  value={form.brand_voice_description} onChange={update('brand_voice_description')}
                  placeholder="E.g., 'Friendly expert who uses analogies from everyday life...'"
                  InputLabelProps={{ shrink: true }}
                />

                <ChipInput
                  label="Phrases to Avoid"
                  value={form.phrases_to_avoid}
                  onChange={(v) => setForm({ ...form, phrases_to_avoid: v })}
                  placeholder={'e.g. "in today\'s world", "game-changer"'}
                />

                <ChipInput
                  label={<FieldLabel label="Preferred Terms" tooltip="Words or phrases the AI should always use. The mirror image of 'Phrases to Avoid' — tell the AI what TO say. Example: your brand name, proprietary terms, or industry-specific jargon you prefer over generic alternatives." />}
                  value={form.preferred_terms}
                  onChange={(v) => setForm({ ...form, preferred_terms: v })}
                  placeholder='e.g. "our platform", "client" instead of "customer"'
                />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Tooltip title={"Use don't, it's, we're instead of do not, it is, we are. Makes writing sound more natural and less robotic."} arrow>
                    <FormControlLabel
                      control={<Switch checked={form.use_contractions} onChange={updateChecked('use_contractions')} />}
                      label="Use Contractions"
                    />
                  </Tooltip>
                  <Tooltip title="Include short personal stories or examples to illustrate points. Makes content feel more relatable and human." arrow>
                    <FormControlLabel
                      control={<Switch checked={form.use_anecdotes} onChange={updateChecked('use_anecdotes')} />}
                      label="Use Anecdotes"
                    />
                  </Tooltip>
                  <Tooltip title={'Allow questions like "But what does this really mean?" to engage readers and create a conversational flow.'} arrow>
                    <FormControlLabel
                      control={<Switch checked={form.use_rhetorical_questions} onChange={updateChecked('use_rhetorical_questions')} />}
                      label="Rhetorical Questions"
                    />
                  </Tooltip>
                  <Tooltip title="Let the AI use lighthearted jokes or witty remarks where appropriate. Best for casual or lifestyle content." arrow>
                    <FormControlLabel
                      control={<Switch checked={form.use_humor} onChange={updateChecked('use_humor')} />}
                      label="Use Humor"
                    />
                  </Tooltip>
                </Box>
              </Stack>
            </TabPanel>

            {/* TAB 3: SEO */}
            <TabPanel value={tab} index={3}>
              <Stack spacing={3}>
                <TextField
                  label={<FieldLabel label="Focus Keyword" tooltip="The single most important keyword you want this post to rank for. The AI will naturally weave it into the title, headings, and body text." />}
                  fullWidth
                  value={form.seo_focus_keyword}
                  onChange={update('seo_focus_keyword')}
                  placeholder="Primary keyword to target"
                  InputLabelProps={{ shrink: true }}
                />

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Keywords
                    </Typography>
                    <Tooltip title="Get AI-powered keyword suggestions based on your template's industry and topic">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={suggestLoading ? <CircularProgress size={16} /> : <AutoAwesome />}
                        onClick={handleSuggestKeywords}
                        disabled={suggestLoading}
                        sx={{ ml: 'auto' }}
                      >
                        {suggestLoading ? 'Thinking...' : 'Suggest Keywords'}
                      </Button>
                    </Tooltip>
                  </Box>

                  <ChipInput
                    label="SEO Keywords"
                    value={form.seo_keywords}
                    onChange={(v) => setForm({ ...form, seo_keywords: v })}
                    placeholder="Add a keyword and press Enter"
                  />

                  {suggestions.length > 0 && (
                    <Box sx={{
                      mt: 2, p: 2,
                      border: '2px dashed',
                      borderColor: 'divider',
                      backgroundColor: 'background.default',
                    }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        Suggested Keywords — click to add
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {suggestions.map((kw) => (
                          <Chip
                            key={kw}
                            label={kw}
                            size="small"
                            variant="outlined"
                            onClick={() => addSuggestedKeyword(kw)}
                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'primary.light', color: 'white' } }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    select
                    label={<FieldLabel label="Keyword Density" tooltip="How often keywords appear in the text. Low = natural and subtle. Medium = regular placement in headings and paragraphs. High = frequent use for competitive keywords." />}
                    value={form.seo_keyword_density} onChange={update('seo_keyword_density')} sx={{ width: 300 }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {KEYWORD_DENSITIES.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label={<FieldLabel label="Meta Description Style" tooltip="The style for the SEO meta description (the snippet shown in search results). Concise = straightforward summary. Question = hooks with a question. Benefit-driven = focuses on what readers gain." />}
                    value={form.seo_meta_description_style} onChange={update('seo_meta_description_style')} sx={{ width: 300 }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {META_DESC_STYLES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                  </TextField>
                </Box>

                <TextField
                  label={<FieldLabel label="Internal Linking Instructions" tooltip="Tell the AI which pages on your site to link to and when. Example: 'When mentioning protein, link to /nutrition-guide. When mentioning equipment, link to /gear-reviews.'" />}
                  fullWidth multiline rows={3}
                  value={form.seo_internal_linking_instructions}
                  onChange={update('seo_internal_linking_instructions')}
                  placeholder="E.g., 'Link to our pillar page on X when mentioning Y...'"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            </TabPanel>

            {/* TAB 4: Defaults */}
            <TabPanel value={tab} index={4}>
              <Stack spacing={3}>
                <TextField
                  label={<FieldLabel label="Word Count" tooltip="Target length for generated posts. 800-1000 is good for quick reads, 1500-2000 for standard blogs, 2500+ for in-depth guides." />}
                  type="number"
                  value={form.default_word_count}
                  onChange={update('default_word_count')}
                  sx={{ width: 240 }}
                  InputLabelProps={{ shrink: true }}
                />

                <ChipInput
                  label="Default Categories"
                  value={form.default_categories}
                  onChange={(v) => setForm({ ...form, default_categories: v })}
                  placeholder="Add a category and press Enter"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                  Categories to assign to posts generated with this template.
                </Typography>

                <ChipInput
                  label="Default Tags"
                  value={form.default_tags}
                  onChange={(v) => setForm({ ...form, default_tags: v })}
                  placeholder="Add a tag and press Enter"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                  Tags to assign to posts generated with this template.
                </Typography>

              </Stack>
            </TabPanel>

            {/* TAB 5: Test */}
            <TabPanel value={tab} index={5}>
              {!isEdit ? (
                <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
                  Save the template first to use the test panel. The AI needs a saved template to generate content from.
                </Alert>
              ) : (
                <Stack spacing={3}>
                  <Alert severity="info" variant="outlined" sx={{ borderColor: 'divider' }}>
                    Test your template by generating a title and article preview. Tweak settings on other tabs, then come back here to see how they affect the output.
                  </Alert>

                  {/* Step 1: Title Generation */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, mb: 1.5 }}>
                      Step 1 — Generate Titles
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <TextField
                        label="Topic or Idea"
                        fullWidth
                        value={testTopic}
                        onChange={(e) => setTestTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && testTopic.trim() && !testingTitle) {
                            e.preventDefault();
                            handleTestTitle();
                          }
                        }}
                        placeholder='e.g. "benefits of morning exercise"'
                        size="small"
                        disabled={testingTitle}
                      />
                      <Button
                        variant="contained"
                        onClick={handleTestTitle}
                        disabled={!testTopic.trim() || testingTitle}
                        startIcon={testingTitle ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />}
                        sx={{ minWidth: 180, whiteSpace: 'nowrap' }}
                      >
                        {testingTitle ? 'Generating...' : 'Generate Titles'}
                      </Button>
                    </Stack>
                  </Box>

                  {/* Generated Titles Display — 5 variants */}
                  {(testTitles.length > 0 || testingTitle) && (
                    <Box sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(74, 124, 111, 0.04)',
                    }}>
                      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'primary.main', display: 'block', mb: 1.5 }}>
                        Generated Titles — click to select
                      </Typography>
                      {testingTitle ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                          <CircularProgress size={20} />
                          <Typography color="text.secondary">Generating 5 headline variants...</Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1}>
                          {testTitles.map((title, idx) => {
                            const resolvedStyle = resolveHeadlineStyle(form.content_type);
                            const mixedLabels = ['HOW-TO', 'CONTRARIAN', 'LISTICLE', 'EXPERIENCE', 'DIRECT BENEFIT'];
                            const singleLabel = HEADLINE_STYLES.find(s => s.value === resolvedStyle)?.label?.toUpperCase() || resolvedStyle.toUpperCase();
                            const typeLabels = resolvedStyle === 'ai_selected'
                              ? mixedLabels
                              : Array(5).fill(null).map((_, i) => `${singleLabel} ${i + 1}`);
                            const isSelected = selectedTitleIdx === idx;
                            return (
                              <Box
                                key={idx}
                                onClick={() => {
                                  setSelectedTitleIdx(idx);
                                  setTestTitle(title);
                                }}
                                sx={{
                                  p: 1.5,
                                  border: '1px solid',
                                  borderColor: isSelected ? 'primary.main' : 'divider',
                                  backgroundColor: isSelected ? 'rgba(74, 124, 111, 0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  '&:hover': {
                                    borderColor: 'primary.light',
                                    backgroundColor: 'rgba(74, 124, 111, 0.04)',
                                  },
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                }}
                              >
                                <Chip
                                  label={typeLabels[idx] || `TYPE ${idx + 1}`}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    letterSpacing: '0.05em',
                                    backgroundColor: 'warning.light',
                                    color: 'warning.contrastText',
                                    minWidth: 100,
                                    flexShrink: 0,
                                  }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 400 }}>
                                  {title}
                                </Typography>
                              </Box>
                            );
                          })}

                          {/* Editable selected title */}
                          {testTitle && (
                            <Box sx={{ mt: 1 }}>
                              <TextField
                                fullWidth
                                value={testTitle}
                                onChange={(e) => setTestTitle(e.target.value)}
                                size="small"
                                label="Selected Title (editable)"
                                helperText="You can tweak this title before generating the article"
                              />
                            </Box>
                          )}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {/* Step 2: Experience Interview (Optional) */}
                  {testTitle && !testingTitle && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, mb: 1.5 }}>
                          Step 2 — Experience Interview (Optional)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          The AI will generate targeted questions to extract your real expertise. Your answers get woven into the article as authentic E-E-A-T signals.
                        </Typography>

                        {interviewQuestions.length === 0 && !interviewLoading && (
                          <>
                            <Stack direction="row" spacing={1.5}>
                              <Button
                                variant="outlined"
                                onClick={handleGenerateInterview}
                                startIcon={<RecordVoiceOver />}
                                sx={{ minWidth: 200 }}
                                disabled={testingContent}
                              >
                                Generate Questions
                              </Button>
                              <Button
                                variant="contained"
                                onClick={handleTestContent}
                                disabled={testingContent}
                                startIcon={testingContent ? <CircularProgress size={18} color="inherit" /> : <SkipNext />}
                                sx={{ minWidth: 200 }}
                              >
                                {testingContent ? 'Generating...' : 'Skip to Article'}
                              </Button>
                            </Stack>
                            {testingContent && <ContentProgressBar progress={contentProgress} />}
                          </>
                        )}

                        {interviewLoading && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                            <CircularProgress size={20} />
                            <Typography color="text.secondary">Generating interview questions...</Typography>
                          </Box>
                        )}

                        {interviewQuestions.length > 0 && (
                          <Stack spacing={2}>
                            {interviewQuestions.map((q, idx) => (
                              <Box key={idx} sx={{
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'rgba(74, 124, 111, 0.02)',
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                  {idx + 1}. {q}
                                </Typography>
                                <TextField
                                  fullWidth
                                  multiline
                                  rows={2}
                                  size="small"
                                  placeholder="Your answer (optional — skip if not applicable)"
                                  value={interviewAnswers[idx] || ''}
                                  onChange={(e) => {
                                    const updated = [...interviewAnswers];
                                    updated[idx] = e.target.value;
                                    setInterviewAnswers(updated);
                                  }}
                                />
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </>
                  )}

                  {/* Step 3: Content Generation (shown after interview questions are generated) */}
                  {testTitle && !testingTitle && interviewQuestions.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, mb: 1.5 }}>
                          Step 3 — Generate Article
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                          <Button
                            variant="contained"
                            onClick={handleTestContent}
                            disabled={testingContent || interviewLoading}
                            startIcon={testingContent ? <CircularProgress size={18} color="inherit" /> : <Article />}
                            sx={{ minWidth: 200 }}
                          >
                            {testingContent ? 'Generating Article...' : 'Generate Article'}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={handleTestReset}
                            startIcon={<RestartAlt />}
                            disabled={testingContent}
                          >
                            Reset
                          </Button>
                        </Stack>
                        {testingContent && <ContentProgressBar progress={contentProgress} />}
                      </Box>
                    </>
                  )}

                  {/* Content Preview */}
                  {testContent && (
                    <>
                      <Divider />
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                            Article Preview
                          </Typography>
                          <Tooltip title="Copy article as markdown">
                            <IconButton
                              size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(testContent.content_markdown);
                                enqueueSnackbar('Article copied to clipboard', { variant: 'success' });
                              }}
                            >
                              <ContentCopy sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Box sx={{
                          p: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: '#fff',
                          '& h1, & h2, & h3, & h4, & h5, & h6': {
                            fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
                            fontWeight: 700,
                            mt: 3,
                            mb: 1.5,
                          },
                          '& h1': { fontSize: '1.8rem' },
                          '& h2': { fontSize: '1.4rem' },
                          '& h3': { fontSize: '1.15rem' },
                          '& p': { mb: 2, lineHeight: 1.8 },
                          '& ul, & ol': { mb: 2, pl: 3 },
                          '& li': { mb: 0.5 },
                          '& a': { color: 'primary.main' },
                          '& blockquote': {
                            borderLeft: '4px solid',
                            borderColor: 'primary.main',
                            pl: 2,
                            ml: 0,
                            fontStyle: 'italic',
                            color: 'text.secondary',
                          },
                          maxHeight: 600,
                          overflowY: 'auto',
                        }}
                          dangerouslySetInnerHTML={{ __html: testContent.content_html }}
                        />

                        {testContent.excerpt && (
                          <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', backgroundColor: 'background.default' }}>
                            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                              Excerpt
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {testContent.excerpt}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </>
                  )}

                  {/* Prompt Audit */}
                  {testPrompts && (
                    <>
                      <Divider />
                      <Box>
                        <Button
                          onClick={() => setShowPrompts(!showPrompts)}
                          startIcon={showPrompts ? <VisibilityOff /> : <Visibility />}
                          endIcon={<ExpandMore sx={{ transform: showPrompts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                          sx={{ color: 'text.secondary', mb: showPrompts ? 1.5 : 0 }}
                        >
                          {showPrompts ? 'Hide Prompts Sent' : 'View Prompts Sent'}
                        </Button>
                        <Collapse in={showPrompts}>
                          <Stack spacing={2}>
                            {testPrompts.title_system_prompt_used && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Title System Prompt (SEO Copywriter)
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {testPrompts.title_system_prompt_used}
                                </Box>
                              </Box>
                            )}
                            {testPrompts.topic_prompt_used && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Title Generation Prompt
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {testPrompts.topic_prompt_used}
                                </Box>
                              </Box>
                            )}
                            {testPrompts.system_prompt_used && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Content System Prompt (E-E-A-T + GEO)
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {testPrompts.system_prompt_used}
                                </Box>
                              </Box>
                            )}
                            {testPrompts.outline_used && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Outline Generated
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {testPrompts.outline_used}
                                </Box>
                              </Box>
                            )}
                            {interviewQuestions.length > 0 && interviewAnswers.some(a => a.trim()) && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Interview Answers
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontSize: '0.8rem',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {interviewQuestions.map((q, idx) => (
                                    interviewAnswers[idx]?.trim() ? (
                                      <Box key={idx} sx={{ mb: 1.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                          Q: {q}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                          A: {interviewAnswers[idx]}
                                        </Typography>
                                      </Box>
                                    ) : null
                                  ))}
                                </Box>
                              </Box>
                            )}
                            {testPrompts.content_prompt_used && (
                              <Box>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                  Article Generation Prompt
                                </Typography>
                                <Box sx={{
                                  p: 2,
                                  backgroundColor: 'grey.50',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}>
                                  {testPrompts.content_prompt_used}
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        </Collapse>
                      </Box>
                    </>
                  )}
                </Stack>
              )}
            </TabPanel>
          </CardContent>
        </Card>

        <Box sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" size="large" startIcon={<Save />} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </Button>
        </Box>
      </form>
    </Box>
  );
}
