import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, FieldArray } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Alert,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import api from '../../services/api';
import { useSnackbar } from 'notistack';
import { useFormik } from 'formik';

// Variable types for prompt templates
const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'boolean', label: 'Boolean (Yes/No)' },
];

// Create a simple component for repeated patterns to reduce re-renders
const PromptCard = React.memo(({ title, children, sx = {} }) => (
  <Card sx={{ 
    border: '1px solid rgba(111, 207, 117, 0.3)', 
    boxShadow: '0 0 15px rgba(111, 207, 117, 0.2)',
    ...sx
  }}>
    <CardContent>
      {title && (
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
      )}
      {children}
    </CardContent>
  </Card>
));

// Create an error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the form.'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <Box sx={{ mt: 4, textAlign: 'left', fontFamily: 'monospace', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Error details (development only):
              </Typography>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
                {this.state.error?.stack || JSON.stringify(this.state.error)}
              </pre>
            </Box>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

const PromptForm = () => {
  console.log('[PromptForm] Component rendering started');
  const { id } = useParams();
  console.log('[PromptForm] ID from URL params:', id);
  const navigate = useNavigate();
  const isEditMode = !!id;
  console.log('[PromptForm] Edit mode:', isEditMode);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState(null);
  
  const { enqueueSnackbar } = useSnackbar();
  
  // Initial form values
  const initialValues = useMemo(() => {
    console.log('[PromptForm] Creating initial values');
    return {
    name: '',
    description: '',
    system_prompt: '',
    topic_generation_prompt: '',
    content_generation_prompt: '',
    default_word_count: 800,
    default_tone: 'informative',
    content_type: 'blog_post',
    writing_style: 'standard',
    industry: '',
    audience_level: 'general',
    special_requirements: '',
    variables: []
  };
  }, []);
  
  // Custom validation function for template content
  const validateTemplateContent = useCallback((value) => {
    // Check for null or undefined value
    if (!value) {
      return true; // Empty templates are valid
    }
    
    // Check for properly formed variable placeholders
    try {
      // Simple validation for matching {{ and }} pairs
      const openBraces = (value.match(/\{\{/g) || []).length;
      const closeBraces = (value.match(/\}\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        return "Template contains unmatched {{ or }} pairs";
      }
      
      return true;
    } catch (error) {
      console.error("Template validation error:", error);
      return "Invalid template syntax";
    }
  }, []);
  
  // Form validation schema
  const validationSchema = useMemo(() => Yup.object({
    name: Yup.string().required('Name is required'),
    system_prompt: Yup.string().required('System prompt is required'),
    topic_generation_prompt: Yup.string().required('Topic generation prompt is required'),
    content_generation_prompt: Yup.string().required('Content generation prompt is required'),
    default_word_count: Yup.number().required('Default word count is required').min(100, 'Minimum word count is 100'),
    default_tone: Yup.string().required('Default tone is required'),
    content_type: Yup.string(),
    writing_style: Yup.string(),
    industry: Yup.string(),
    audience_level: Yup.string(),
    special_requirements: Yup.string(),
    variables: Yup.array().of(
      Yup.object().shape({
        name: Yup.string().required('Name is required'),
        key: Yup.string().required('Key is required'),
        type: Yup.string().required('Type is required'),
        options: Yup.mixed().when('type', {
          is: 'select',
          then: (schema) => 
            Yup.array()
              .of(Yup.string().required('Option is required'))
              .min(1, 'At least one option is required'),
          otherwise: (schema) => Yup.mixed().notRequired()
        })
      })
    )
  }), []);
  
  // Utility function to safely get error message
  const getSafeErrorMessage = useCallback((error) => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      // Extract msg field if this is a parser error object
      if (error.msg) return error.msg;
      // Try to stringify the object
      try {
        return JSON.stringify(error);
      } catch (e) {
        return "An error occurred";
      }
    }
    return "Unknown error";
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback(async (values, { setSubmitting }) => {
    console.log('Form submission started', values);
    setSubmitting(true);
    setError(null);
    try {
      // Check for template syntax errors before submitting
      const contentValidation = validateTemplateContent(values.content_generation_prompt);
      if (contentValidation !== true) {
        setError(contentValidation);
        enqueueSnackbar(contentValidation, { variant: 'error' });
        setSubmitting(false);
        return;
      }
      
      // Ensure variables is always an array before submitting
      const formData = {
        ...values,
        variables: Array.isArray(values.variables) ? values.variables : []
      };
      
      // Always set required fields for backend validation
      // These are required fields according to the PromptTemplateCreate model
      if (!formData.system_prompt) {
        formData.system_prompt = "You are a helpful assistant that generates blog content.";
      }
      
      if (!formData.topic_generation_prompt) {
        formData.topic_generation_prompt = "Generate an interesting topic for a blog post.";
      }
      
      // Set content_generation_prompt to the content value
      formData.content_generation_prompt = values.content_generation_prompt;
      
      // Add default values for other required fields if they don't exist
      if (!formData.default_word_count) {
        formData.default_word_count = 1500;
      }
      
      if (!formData.default_tone) {
        formData.default_tone = "informative";
      }
      
      // Ensure placeholders exists
      if (!formData.placeholders) {
        formData.placeholders = {};
      }
      
      // If in edit mode, copy over additional fields from the original prompt
      if (isEditMode && prompt) {
        // Keep any existing values from the prompt that weren't updated
        formData.system_prompt = formData.system_prompt || prompt.system_prompt;
        formData.topic_generation_prompt = formData.topic_generation_prompt || prompt.topic_generation_prompt;
        formData.content_generation_prompt = values.content_generation_prompt;
        formData.default_word_count = formData.default_word_count || prompt.default_word_count;
        formData.default_tone = formData.default_tone || prompt.default_tone;
        formData.placeholders = formData.placeholders || prompt.placeholders;
        
        // Ensure advanced fields are set properly
        formData.content_type = formData.content_type || prompt.content_type || 'blog_post';
        formData.writing_style = formData.writing_style || prompt.writing_style || 'standard';
        formData.industry = formData.industry || prompt.industry || '';
        formData.audience_level = formData.audience_level || prompt.audience_level || 'general';
        formData.special_requirements = formData.special_requirements || prompt.special_requirements || '';
      } else {
        // For new templates, set defaults for advanced fields if not provided
        formData.content_type = formData.content_type || 'blog_post';
        formData.writing_style = formData.writing_style || 'standard';
        formData.audience_level = formData.audience_level || 'general';
      }
      
      // Trim the name field to remove any trailing spaces
      formData.name = formData.name.trim();
      
      // Ensure is_default is set (most templates are not default)
      if (formData.is_default === undefined) {
        formData.is_default = false;
      }
      
      console.log("Submitting template:", formData);
      
      // Log the API endpoint we're using to help debug
      console.log(`Using API endpoint: ${isEditMode ? `/api/templates/${id}` : '/api/templates/'}`);
      
      if (isEditMode) {
        await api.put(`/api/templates/${id}`, formData);
      } else {
        await api.post('/api/templates/', formData);
      }
      navigate('/prompts');
      enqueueSnackbar(`Prompt template ${isEditMode ? 'updated' : 'created'} successfully`, { variant: 'success' });
    } catch (err) {
      console.error("Template submission error details:", err);
      if (err.response) {
        console.error("Server response status:", err.response.status);
        console.error("Server response data:", err.response.data);
      }
      const errorMessage = getSafeErrorMessage(err);
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [
    isEditMode, 
    id, 
    prompt, 
    validateTemplateContent, 
    getSafeErrorMessage, 
    navigate, 
    enqueueSnackbar
  ]);
  
  // Generate a unique key from the variable name
  const generateVariableKey = useCallback((name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }, []);
  
  // Insert variable placeholder into prompt content
  const insertVariablePlaceholder = useCallback((formik, variableKey) => {
    if (!formik || !variableKey) return;
    
    const content = formik.values.content_generation_prompt || '';
    const placeholder = `{{${variableKey}}}`;
    
    // Get the textarea element - using the correct ID
    const textareaElement = document.getElementById('content_generation_prompt');
    
    // Default to adding at the end if no cursor position is available
    let cursorPosition = content.length;
    
    // Only try to get selection if the element exists
    if (textareaElement) {
      cursorPosition = textareaElement.selectionStart || content.length;
    } else {
      console.warn('Content textarea element not found, appending at the end');
    }
    
    const newContent = 
      content.substring(0, cursorPosition) + 
      placeholder + 
      content.substring(cursorPosition);
    
    formik.setFieldValue('content_generation_prompt', newContent);
  }, []);
  
  // Fetch prompt data for edit mode
  const fetchPrompt = useCallback(async () => {
    console.log('Fetching prompt template:', id);
    if (!id || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Debug the API URL being used
      console.log(`Making API request to: /api/templates/${id}`);
      const response = await api.get(`/api/templates/${id}`);
      console.log('Prompt template data received:', response.data);
      
      // Process variables with better error handling
      let variables = [];
      if (response.data.variables) {
        if (Array.isArray(response.data.variables)) {
          variables = response.data.variables;
        } else if (typeof response.data.variables === 'string') {
          // Try to parse if it's a JSON string
          try {
            const parsed = JSON.parse(response.data.variables);
            variables = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('Failed to parse variables string:', e);
          }
        } else if (typeof response.data.variables === 'object') {
          console.warn('Variables is an object but not an array, using empty array');
        }
      }
      
      // Create a properly formatted prompt object for the state
      const promptData = {
        id: response.data.id,
        name: response.data.name || '',
        description: response.data.description || '',
        system_prompt: response.data.system_prompt || '',
        topic_generation_prompt: response.data.topic_generation_prompt || '',
        content_generation_prompt: response.data.content_generation_prompt || response.data.system_prompt || '',
        default_word_count: response.data.default_word_count || 800,
        default_tone: response.data.default_tone || 'informative',
        content_type: response.data.content_type || 'blog_post',
        writing_style: response.data.writing_style || 'standard',
        industry: response.data.industry || '',
        audience_level: response.data.audience_level || 'general',
        special_requirements: response.data.special_requirements || '',
        placeholders: response.data.placeholders || {},
        variables: variables || [],
      };
      
      setPrompt(promptData);
      console.log('Prompt data processed and set to state:', promptData);
    } catch (err) {
      console.error('Error fetching prompt:', err);
      const errorMessage = getSafeErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, loading, getSafeErrorMessage]);
  
  // Effect to fetch data when in edit mode
  useEffect(() => {
    console.log('[PromptForm] useEffect for fetching data. isEditMode:', isEditMode);
    if (isEditMode) {
      fetchPrompt();
    }
  }, [isEditMode, fetchPrompt]);
  
  // Prepare form values for edit mode
  const formInitialValues = useMemo(() => {
    console.log('[PromptForm] Computing form initial values, isEditMode:', isEditMode, 'prompt:', prompt ? 'exists' : 'null');
    
    if (isEditMode && prompt) {
      console.log('[PromptForm] Using prompt data for initial values');
      return {
        name: prompt.name || '',
        description: prompt.description || '',
        system_prompt: prompt.system_prompt || '',
        topic_generation_prompt: prompt.topic_generation_prompt || '',
        content_generation_prompt: prompt.content_generation_prompt || '',
        default_word_count: prompt.default_word_count || 800,
        default_tone: prompt.default_tone || 'informative',
        content_type: prompt.content_type || 'blog_post',
        writing_style: prompt.writing_style || 'standard',
        industry: prompt.industry || '',
        audience_level: prompt.audience_level || 'general',
        special_requirements: prompt.special_requirements || '',
        variables: Array.isArray(prompt.variables) ? prompt.variables : []
      };
    }
    
    console.log('[PromptForm] Using default initial values');
    return initialValues;
  }, [isEditMode, prompt, initialValues]);
  
  if (loading) {
    console.log('[PromptForm] Rendering loading state');
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
        <Typography variant="h6">
          Loading prompt template...
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          This may take a moment
        </Typography>
      </Box>
    );
  }
  
  if (isEditMode && error) {
    console.log('[PromptForm] Rendering error state:', error);
    return (
      <ErrorState
        message="Error Loading Prompt Template"
        details={error}
        onRetry={fetchPrompt}
      />
    );
  }
  
  console.log('[PromptForm] Rendering main form');
  return (
    <ErrorBoundary>
    <Box>
      <PageHeader
        title={isEditMode ? 'Edit Prompt Template' : 'Create Prompt Template'}
        breadcrumbs={[
          { text: 'Prompt Templates', link: '/prompts' },
          { text: isEditMode ? 'Edit Template' : 'New Template' },
        ]}
        actionButton={true}
        actionButtonText="Back to Templates"
        actionButtonLink="/prompts"
        actionButtonIcon={<ArrowBackIcon />}
        actionButtonVariant="outlined"
      />
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {getSafeErrorMessage(error)}
        </Alert>
      )}
      
      <Formik
        initialValues={formInitialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
          enableReinitialize={true}
      >
        {(formik) => (
          <Form>
              {/* Prompt Engineering Golden Rules card at the top */}
              <Card sx={{ mb: 3, border: '1px solid rgba(111, 207, 117, 0.3)', boxShadow: '0 0 15px rgba(111, 207, 117, 0.2)' }}>
                <CardContent sx={{ 
                  backgroundColor: 'rgba(46, 125, 50, 0.1)', 
                  backgroundImage: 'linear-gradient(to bottom, rgba(111, 207, 117, 0.12), rgba(46, 125, 50, 0.05))'
                }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ color: '#6FCF75', fontWeight: 'bold' }}>
                    💡 Prompt Engineering Golden Rules 💡
                  </Typography>
                  
                  <Box sx={{ 
                    backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                    p: 2, 
                    borderRadius: 2, 
                    mb: 2, 
                    border: '1px solid rgba(111, 207, 117, 0.15)',
                    boxShadow: 'inset 0 0 10px rgba(111, 207, 117, 0.1)'
                  }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                          <Box component="span" sx={{ color: '#6FCF75', mr: 1, mt: 0.3, fontWeight: 'bold' }}>1.</Box>
                          <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                            <strong style={{ color: '#6FCF75' }}>Be absurdly specific</strong> - The difference between "write a blog post about gardening" and "write a 1200-word beginner's guide to growing tomatoes in small apartments with step-by-step instructions" is night and day! Details = better results.
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                          <Box component="span" sx={{ color: '#6FCF75', mr: 1, mt: 0.3, fontWeight: 'bold' }}>2.</Box>
                          <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                            <strong style={{ color: '#6FCF75' }}>Structure explicitly</strong> - Don't let the AI guess the outline. Tell it exactly what sections you want, how many paragraphs each should contain, and what information belongs where.
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                          <Box component="span" sx={{ color: '#6FCF75', mr: 1, mt: 0.3, fontWeight: 'bold' }}>3.</Box>
                          <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                            <strong style={{ color: '#6FCF75' }}>Show, don't just tell</strong> - Include examples of what good looks like: "Use engaging opening sentences like 'Have you ever wondered...' or 'Imagine a world where...'"
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                          <Box component="span" sx={{ color: '#6FCF75', mr: 1, mt: 0.3, fontWeight: 'bold' }}>4.</Box>
                          <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                            <strong style={{ color: '#6FCF75' }}>Test and refine</strong> - Your first prompt will rarely be perfect. Generate content, see what works and what doesn't, then tweak your prompt. Rinse and repeat until it's awesome!
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
              
              {/* Template example loader button */}
            {!isEditMode && (
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                      formik.resetForm({
                        values: {
                          name: "Comprehensive SEO-Optimized Blog Post Template",
                          description: "A detailed template for creating highly structured, SEO-friendly blog posts that engage readers and drive conversions",
                          
                          // System prompt - defines the AI's role and capabilities
                          system_prompt: "You are an expert content strategist and SEO writer with 10+ years of experience creating high-performing blog content. You specialize in writing engaging, informative content that ranks well in search engines while providing genuine value to readers. You have a knack for explaining complex topics in simple terms and creating content that converts readers into customers. Your writing is always evidence-based, practical, and tailored to the target audience's needs.",
                          
                          // Topic generation prompt - helps create engaging titles
                          topic_generation_prompt: `Generate an SEO-optimized blog post title about {{topic}} that will appeal to {{audience_level}} readers.

Your title should:
1. Be between 50-60 characters long (ideal for search engines)
2. Include the primary keyword near the beginning
3. Use one of these high-converting patterns:
   - How to [Achieve Desired Outcome] in [Timeframe/Simplicity] (e.g., "How to Learn Python in Just 2 Weeks")
   - [Number] [Adjective] Ways to [Solve Problem] (e.g., "7 Proven Ways to Increase Website Conversion")
   - The Ultimate Guide to [Topic] for [Audience] (e.g., "The Ultimate Guide to Email Marketing for Small Businesses")
   - Why [Common Belief] is Wrong and What to Do Instead
   - [Achieve Desirable Outcome] Without [Common Obstacle]

Create a title that is specific, indicates clear value, and creates curiosity or urgency.`,

                          // Content generation prompt - comprehensive with clear structure and formatting
                          content_generation_prompt: `Write a comprehensive {{word_count}}-word blog post about {{topic}} for {{audience_level}} readers using a {{tone}} tone.

STRUCTURE:
1. Start with an attention-grabbing introduction that:
   - Highlights a surprising statistic, asks a compelling question, or shares a relevant story
   - Clearly identifies the reader's pain point or challenge
   - Establishes your credibility on this topic
   - Promises specific value they'll get from reading (what they'll learn or be able to do)
   - Ends with a brief overview of what the post will cover

2. Create {{sections}} main sections, each with:
   - A descriptive H2 heading that includes relevant keywords
   - A strong opening paragraph explaining why this section matters
   - 2-3 paragraphs of detailed explanation with evidence and reasoning
   - At least one specific real-world example, case study, or data point
   - A practical tip, actionable takeaway, or key insight in a callout box
   - A transition to the next section that maintains reader flow

3. Include a dedicated "Common Mistakes to Avoid" or "Pro Tips" section with:
   - An H2 heading
   - A brief introduction explaining why these insights matter
   - A bulleted or numbered list of 5-7 specific tips or mistakes
   - Brief explanation for each point (1-2 sentences)

4. Include a "Comparison Table" section with:
   - An H2 heading like "Feature Comparison" or "Options Comparison"
   - A brief introduction explaining what the table compares
   - An HTML table comparing at least 3 options (products, methods, tools, etc.)
   - Format the table with proper <table>, <tr>, <th>, and <td> HTML tags
   - Include a caption or explanation after the table summarizing key insights

5. End with a conclusion that:
   - Summarizes the key points covered
   - Reinforces the main benefit or transformation
   - Includes a specific next step or actionable advice
   - Ends with a {{cta}} that feels natural and helpful

FORMATTING:
- Use ## for main (H2) headings
- Use ### for subheadings (H3)
- Use **bold** for key concepts, terms, or points
- Use *italics* for emphasis or to highlight quotes
- Use > for important callout boxes or quotes
- Use numbered lists for sequential steps
- Use bullet lists for non-sequential items
- Keep paragraphs short (3-5 sentences maximum)
- Include at least {{examples}} practical examples throughout the post
- Break up long text with relevant subheadings every 200-300 words

WRITING GUIDELINES:
- Write in a {{tone}} but authoritative voice that builds trust
- Use "you" and "your" to directly address the reader
- Avoid jargon unless immediately explained in simple terms
- Include specific numbers, percentages, or statistics with sources where possible
- Use metaphors or analogies to explain complex concepts
- Vary sentence length and structure for readability
- Focus on practical value, not just theory
- Address common objections or concerns the reader might have
- Include transition phrases between sections to maintain flow
- Write as if explaining to a smart friend who isn't an expert in this field

The blog post should feel comprehensive, evidence-based, and genuinely helpful. Include your {{experience_years}} years of expertise in a natural way that builds credibility without bragging.`,

                          default_word_count: 1500,
                          default_tone: "conversational",
                          content_type: "how_to",
                          writing_style: "storytelling",
                          industry: "marketing",
                          audience_level: "intermediate",
                          special_requirements: "Incorporate latest industry data and trends. Include actionable takeaways in each section. Optimize for both search engines and reader engagement. Use conversational tone but maintain professionalism.",
                          
                          // Comprehensive set of variables
                      variables: [
                        {
                          name: "Blog Topic",
                          key: "topic",
                          type: "text",
                              description: "The specific subject of your blog post",
                              default_value: "Content Marketing Strategies for 2024",
                          options: []
                        },
                        {
                          name: "Word Count",
                          key: "word_count",
                          type: "number",
                          description: "How long the blog post should be",
                              options: ["conversational", "professional", "friendly", "authoritative", "informative", "casual", "inspirational"]
                            },
                            {
                              name: "Number of Sections",
                              key: "sections",
                              type: "number",
                              description: "How many main sections the blog post should have",
                              default_value: "4",
                          options: []
                        },
                        {
                              name: "Examples",
                              key: "examples",
                              type: "number",
                              description: "Minimum number of examples to include",
                              default_value: "3",
                              options: []
                            },
                            {
                              name: "Call to Action",
                              key: "cta",
                          type: "select",
                              description: "The call-to-action for the end of the content",
                              default_value: "Subscribe to our newsletter",
                              options: ["Subscribe to our newsletter", "Contact us for more information", "Learn more about our services", "Start your free trial today", "Buy now and save 20%", "Download our free guide", "Register for the upcoming webinar", "Get started in just 5 minutes"]
                            },
                            {
                              name: "Experience Years",
                              key: "experience_years",
                              type: "number",
                              description: "Years of expertise the content creator has (for authority)",
                              default_value: "10",
                              options: []
                            }
                          ]
                        }
                    });
                  }}
                >
                  Load Example Template
                </Button>
              </Box>
            )}
            
              {/* The rest of your form content */}
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                  <PromptCard title="Basic Information" sx={{ mb: 3 }}>
                    <Alert severity="info" sx={{ 
                      mb: 3, 
                      backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                      color: '#EEEEEE',
                      border: '1px solid rgba(111, 207, 117, 0.2)',
                      '& .MuiAlert-icon': { color: '#6FCF75' } 
                    }}>
                      <strong style={{ color: '#6FCF75' }}>Getting Started with Prompt Templates</strong>
                      <Typography variant="body2" sx={{ mt: 1, color: '#EEEEEE' }}>
                        Think of prompt templates as your AI content recipe cards! A good recipe needs a clear name and description - future you will thank you when scrolling through dozens of templates. Be specific about what this template creates (e.g., "SEO-Optimized Blog Post for Tech Products" is much better than just "Blog Post").
                      </Typography>
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          id="name"
                          name="name"
                          label="Template Name"
                          value={formik.values.name}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.name && Boolean(formik.errors.name)}
                          helperText={(formik.touched.name && typeof formik.errors.name === 'string' ? formik.errors.name : "") || "Give your template a descriptive name (e.g., 'How-To Article Template')"}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          id="description"
                          name="description"
                          label="Description"
                          multiline
                          rows={2}
                          value={formik.values.description}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.description && Boolean(formik.errors.description)}
                          helperText={(formik.touched.description && typeof formik.errors.description === 'string' ? formik.errors.description : "") || "Explain what this template is best used for and any special instructions"}
                        />
                      </Grid>
                    </Grid>
                  </PromptCard>
              </Grid>
              
              {/* Advanced Settings */}
              <Grid item xs={12}>
                  <PromptCard title="Advanced Content Settings" sx={{ mb: 3 }}>
                    <Alert severity="info" sx={{ 
                      mb: 3, 
                      backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                      color: '#EEEEEE',
                      border: '1px solid rgba(111, 207, 117, 0.2)',
                      '& .MuiAlert-icon': { color: '#6FCF75' } 
                    }}>
                      <strong style={{ color: '#6FCF75' }}>Fine-Tune Content Settings for Better Results</strong>
                      <Typography variant="body2" sx={{ mt: 1, color: '#EEEEEE' }}>
                        Here's where the magic happens! These settings tell the AI exactly what flavor of content you want. Writing for tech nerds? Select "advanced" audience level. Need a formal finance article? Choose "formal" writing style and "finance" industry. The more specific you are, the less you'll need to edit later. It's like giving the AI GPS coordinates instead of just saying "go north" and hoping for the best! 😉
                    </Typography>
                      <Typography variant="body2" sx={{ mt: 2, color: '#EEEEEE' }}>
                        <strong style={{ color: '#6FCF75' }}>Writing Style vs. Tone - What's the difference?</strong>
                        <Box sx={{ display: 'flex', mt: 1 }}>
                          <Box sx={{ flex: 1, mr: 2, p: 1, backgroundColor: 'rgba(111, 207, 117, 0.08)', borderRadius: 1, border: '1px solid rgba(111, 207, 117, 0.15)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6FCF75', mb: 0.5 }}>Writing Style:</Typography>
                            <Typography variant="body2" sx={{ color: '#EEEEEE', fontSize: '0.9rem' }}>
                              The overall structure and approach to content. For example:
                              <ul style={{ marginTop: '4px', marginBottom: '4px', paddingLeft: '20px' }}>
                                <li><b>Academic</b> - Citations, methodical arguments, formal structure</li>
                                <li><b>Storytelling</b> - Narrative flow, characters, plot development</li>
                                <li><b>Technical</b> - Step-by-step instructions, precise terminology</li>
                              </ul>
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, p: 1, backgroundColor: 'rgba(111, 207, 117, 0.08)', borderRadius: 1, border: '1px solid rgba(111, 207, 117, 0.15)' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6FCF75', mb: 0.5 }}>Tone:</Typography>
                            <Typography variant="body2" sx={{ color: '#EEEEEE', fontSize: '0.9rem' }}>
                              The emotional feel and attitude conveyed in the writing. For example:
                              <ul style={{ marginTop: '4px', marginBottom: '4px', paddingLeft: '20px' }}>
                                <li><b>Humorous</b> - Light-hearted, witty, entertaining</li>
                                <li><b>Authoritative</b> - Confident, expert, commanding</li>
                                <li><b>Empathetic</b> - Understanding, compassionate, supportive</li>
                              </ul>
                            </Typography>
                          </Box>
                        </Box>
                      </Typography>
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="content-type-label">Content Type</InputLabel>
                          <Select
                            labelId="content-type-label"
                            id="content_type"
                            name="content_type"
                            value={formik.values.content_type}
                            onChange={formik.handleChange}
                            label="Content Type"
                          >
                            <MenuItem value="blog_post">Blog Post</MenuItem>
                            <MenuItem value="article">Article</MenuItem>
                            <MenuItem value="tutorial">Tutorial</MenuItem>
                            <MenuItem value="review">Review</MenuItem>
                            <MenuItem value="news">News</MenuItem>
                            <MenuItem value="opinion">Opinion</MenuItem>
                            <MenuItem value="how_to">How-To Guide</MenuItem>
                            <MenuItem value="listicle">Listicle</MenuItem>
                          </Select>
                          <FormHelperText>The type of content to generate</FormHelperText>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="writing-style-label">Writing Style</InputLabel>
                          <Select
                            labelId="writing-style-label"
                            id="writing_style"
                            name="writing_style"
                            value={formik.values.writing_style}
                            onChange={formik.handleChange}
                            label="Writing Style"
                          >
                            <MenuItem value="standard">Standard</MenuItem>
                            <MenuItem value="conversational">Conversational</MenuItem>
                            <MenuItem value="formal">Formal</MenuItem>
                            <MenuItem value="academic">Academic</MenuItem>
                            <MenuItem value="technical">Technical</MenuItem>
                            <MenuItem value="casual">Casual</MenuItem>
                            <MenuItem value="storytelling">Storytelling</MenuItem>
                          </Select>
                          <FormHelperText>The overall writing style for the content</FormHelperText>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          id="industry"
                          name="industry"
                          label="Industry"
                          value={formik.values.industry}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.industry && Boolean(formik.errors.industry)}
                          helperText={(formik.touched.industry && typeof formik.errors.industry === 'string' ? formik.errors.industry : "") || "Specific industry focus (e.g., 'finance', 'health', 'technology')"}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="audience-level-label">Audience Level</InputLabel>
                          <Select
                            labelId="audience-level-label"
                            id="audience_level"
                            name="audience_level"
                            value={formik.values.audience_level}
                            onChange={formik.handleChange}
                            label="Audience Level"
                          >
                            <MenuItem value="general">General</MenuItem>
                            <MenuItem value="beginner">Beginner</MenuItem>
                            <MenuItem value="intermediate">Intermediate</MenuItem>
                            <MenuItem value="advanced">Advanced</MenuItem>
                            <MenuItem value="expert">Expert</MenuItem>
                          </Select>
                          <FormHelperText>The knowledge level of the target audience</FormHelperText>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="default-tone-label">Default Tone</InputLabel>
                          <Select
                            labelId="default-tone-label"
                            id="default_tone"
                            name="default_tone"
                            value={formik.values.default_tone}
                            onChange={formik.handleChange}
                            label="Default Tone"
                          >
                            <MenuItem value="friendly">Friendly</MenuItem>
                            <MenuItem value="professional">Professional</MenuItem>
                            <MenuItem value="casual">Casual</MenuItem>
                            <MenuItem value="informative">Informative</MenuItem>
                            <MenuItem value="authoritative">Authoritative</MenuItem>
                            <MenuItem value="conversational">Conversational</MenuItem>
                            <MenuItem value="humorous">Humorous</MenuItem>
                            <MenuItem value="motivational">Motivational</MenuItem>
                            <MenuItem value="educational">Educational</MenuItem>
                            <MenuItem value="analytical">Analytical</MenuItem>
                            <MenuItem value="persuasive">Persuasive</MenuItem>
                            <MenuItem value="enthusiastic">Enthusiastic</MenuItem>
                            <MenuItem value="empathetic">Empathetic</MenuItem>
                            <MenuItem value="factual">Factual</MenuItem>
                            <MenuItem value="scientific">Scientific</MenuItem>
                            <MenuItem value="storytelling">Storytelling</MenuItem>
                            <MenuItem value="inspirational">Inspirational</MenuItem>
                            <MenuItem value="poetic">Poetic</MenuItem>
                            <MenuItem value="provocative">Provocative</MenuItem>
                            <MenuItem value="nostalgic">Nostalgic</MenuItem>
                          </Select>
                          <FormHelperText>The default tone for content generation</FormHelperText>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          id="special_requirements"
                          name="special_requirements"
                          label="Special Requirements"
                          multiline
                          rows={3}
                          value={formik.values.special_requirements}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.special_requirements && Boolean(formik.errors.special_requirements)}
                          helperText={(formik.touched.special_requirements && typeof formik.errors.special_requirements === 'string' ? formik.errors.special_requirements : "") || "Any special instructions or requirements for content generation"}
                        />
                      </Grid>
                    </Grid>
                  </PromptCard>
              </Grid>
              
              {/* System Prompt */}
              <Grid item xs={12}>
                  <PromptCard title="System Prompt" sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#6FCF75', fontWeight: 'bold' }}>
                        Initial Instructions for AI
                      </Typography>
                      <Tooltip title="This is the initial instruction that sets the AI's behavior and capabilities. It defines the AI's role and general approach to content creation.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Alert severity="info" sx={{ 
                      mb: 3, 
                      backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                      color: '#EEEEEE',
                      border: '1px solid rgba(111, 207, 117, 0.2)',
                      '& .MuiAlert-icon': { color: '#6FCF75' } 
                    }}>
                      <strong style={{ color: '#6FCF75' }}>The Secret Sauce: System Prompt Magic ✨</strong>
                      <Typography variant="body2" sx={{ mt: 1, color: '#EEEEEE' }}>
                        This is where you set the AI's personality and expertise. Think of it as casting the perfect actor for your content:
                        <br /><br />
                        • <strong>Define their role:</strong> "You are an expert fintech blogger with 10+ years experience..." (The more specific, the better!)
                        <br />
                        • <strong>Set the tone:</strong> "Write in a conversational but authoritative tone that makes complex topics accessible..."
                        <br />
                        • <strong>Add guardrails:</strong> "Never use jargon without explanations. Always include real-world examples."
                      </Typography>
                    </Alert>
                    
                    <TextField
                      fullWidth
                      id="system_prompt"
                      name="system_prompt"
                      multiline
                      rows={6}
                      value={formik.values.system_prompt}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.system_prompt && Boolean(formik.errors.system_prompt)}
                      helperText={
                        (formik.touched.system_prompt && typeof formik.errors.system_prompt === 'string' ? formik.errors.system_prompt : "") ||
                        "Define the AI's role and general approach to content creation"
                      }
                      sx={{ fontFamily: 'monospace' }}
                      placeholder="You are a helpful content creation assistant who specializes in writing engaging and informative blog posts..."
                    />
                  </PromptCard>
              </Grid>
              
                {/* Topic & Content Generation */}
              <Grid item xs={12} md={6}>
                  <PromptCard title="Topic Generation Prompt" sx={{ height: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#6FCF75', fontWeight: 'bold' }}>
                        Title & Topic Instructions
                      </Typography>
                      <Tooltip title="This prompt guides the AI in generating a specific topic or title based on a general idea.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Alert severity="info" sx={{ 
                      mb: 3, 
                      backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                      color: '#EEEEEE',
                      border: '1px solid rgba(111, 207, 117, 0.2)',
                      '& .MuiAlert-icon': { color: '#6FCF75' } 
                    }}>
                      <strong style={{ color: '#6FCF75' }}>Title Talk: Getting Clickable Headlines 🔍</strong>
                      <Typography variant="body2" sx={{ mt: 1, color: '#EEEEEE' }}>
                        This prompt helps the AI generate engaging topics or titles. Great headlines are the difference between "meh" and "must read!"
                        <br /><br />
                        Use this prompt to tell the AI about SEO considerations, define headline formulas, and set style rules.
                      </Typography>
                      
                      <Box sx={{ display: 'flex', mt: 2 }}>
                        <Box sx={{ flex: 1, mr: 2, p: 1, backgroundColor: 'rgba(111, 207, 117, 0.08)', borderRadius: 1, border: '1px solid rgba(111, 207, 117, 0.15)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6FCF75', mb: 0.5 }}>Winning Headline Formulas:</Typography>
                          <Typography variant="body2" sx={{ color: '#EEEEEE', fontSize: '0.9rem' }}>
                            • How-to: "How to [Outcome] Without [Pain Point]"
                            <br />
                            • List: "[Number] Ways to [Solve Problem]"
                            <br />
                            • Question: "Are You Making These [Topic] Mistakes?"
                            <br />
                            • Ultimate Guide: "Step-by-Step Guide to [Process]"
                          </Typography>
                        </Box>
                        
                        <Box sx={{ flex: 1, p: 1, backgroundColor: 'rgba(111, 207, 117, 0.08)', borderRadius: 1, border: '1px solid rgba(111, 207, 117, 0.15)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6FCF75', mb: 0.5 }}>SEO Title Tips:</Typography>
                          <Typography variant="body2" sx={{ color: '#EEEEEE', fontSize: '0.9rem' }}>
                            • Place keywords near the beginning
                            <br />
                            • Keep under 60 characters
                            <br />
                            • Use power words (essential, proven, etc.)
                            <br />
                            • No clickbait - deliver what you promise
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 2, color: '#B0B0B0', fontSize: '0.85rem' }}>Example prompt:</Typography>
                      <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(17, 25, 18, 0.8)', p: 1, mt: 0.5, borderRadius: 1, fontSize: '0.8rem', color: '#EEEEEE', border: '1px solid rgba(111, 207, 117, 0.2)' }}>
                        "Generate 5 SEO-optimized blog titles about {'{{'}topic{'}}'}  that appeal to {'{{'}audience_level{'}}'}  readers. Each title should include the keyword '{'{{'}primary_keyword{'}}'}' near the beginning and use one of these formats: how-to, list, question, or ultimate guide."
                      </Typography>
                    </Alert>
                    
                                    <TextField
                                      fullWidth
                      id="topic_generation_prompt"
                      name="topic_generation_prompt"
                      multiline
                      rows={10}
                      value={formik.values.topic_generation_prompt}
                                      onChange={formik.handleChange}
                                      onBlur={formik.handleBlur}
                      error={formik.touched.topic_generation_prompt && Boolean(formik.errors.topic_generation_prompt)}
                                      helperText={
                        (formik.touched.topic_generation_prompt && typeof formik.errors.topic_generation_prompt === 'string' ? formik.errors.topic_generation_prompt : "") ||
                        "Instructions for generating a specific topic or title"
                                      }
                      sx={{ fontFamily: 'monospace' }}
                      placeholder="Generate an engaging blog post title about {idea}. Make it clear, compelling, and between 40-60 characters..."
                                    />
                  </PromptCard>
                                  </Grid>
                                  
              <Grid item xs={12} md={6}>
                  <PromptCard title="Content Generation Prompt" sx={{ height: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ color: '#6FCF75', fontWeight: 'bold' }}>
                        Content Creation Instructions
                      </Typography>
                      <Tooltip title="This prompt tells the AI how to structure and write the actual content.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Alert severity="info" sx={{ 
                      mb: 3, 
                      backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                      color: '#EEEEEE',
                      border: '1px solid rgba(111, 207, 117, 0.2)',
                      '& .MuiAlert-icon': { color: '#6FCF75' } 
                    }}>
                      <strong style={{ color: '#6FCF75' }}>The Main Event: Content That Actually Works! 🚀</strong>
                      <Typography variant="body2" sx={{ mt: 1, color: '#EEEEEE' }}>
                        This is your content blueprint - the more detailed, the better! Here's how to make it shine:
                        <br /><br />
                        • <strong>Set clear structure:</strong> "Create 5 sections with H2 headings..."
                        <br />
                        • <strong>Include formatting:</strong> "Use bullet points for lists of tips..."
                        <br />
                        • <strong>Define special elements:</strong> "Include 2 expert quotes and a callout box..."
                        <br /><br />
                        Pro tip: Don't be afraid to get bossy with your instructions - specificity is key!
                        <br /><br />
                        • <strong style={{ color: '#6FCF75' }}>Include charts and tables:</strong>
                        <Box sx={{ pl: 2, pr: 2, py: 1, my: 1, backgroundColor: 'rgba(111, 207, 117, 0.08)', borderRadius: 1, border: '1px solid rgba(111, 207, 117, 0.15)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#6FCF75' }}>How to Set This Up:</Typography>
                          <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                            In your prompt template, you would:
                            <ul style={{ marginTop: '4px', marginBottom: '8px' }}>
                              <li>Specify where charts/tables should appear</li>
                              <li>Include details about what data to display</li>
                              <li>Mention what format to use (HTML, shortcode, block)</li>
                            </ul>
                            <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1, color: '#B0B0B0' }}>Example:</Typography>
                            <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', backgroundColor: 'rgba(17, 25, 18, 0.8)', p: 1, mt: 0.5, borderRadius: 1, fontSize: '0.8rem', color: '#EEEEEE', border: '1px solid rgba(111, 207, 117, 0.2)' }}>
                              "In the 'Product Comparison' section, include an HTML table with the following:<br/>
                              - Table should have 4 columns: Feature, Product A, Product B, Product C<br/>
                              - Compare at least 5 key features"
                            </Typography>
                          </Typography>
                        </Box>
                      </Typography>
                    </Alert>
                    
                                    <TextField
                                      fullWidth
                      id="content_generation_prompt"
                      name="content_generation_prompt"
                      multiline
                      rows={10}
                      value={formik.values.content_generation_prompt}
                                      onChange={formik.handleChange}
                                      onBlur={formik.handleBlur}
                      error={formik.touched.content_generation_prompt && Boolean(formik.errors.content_generation_prompt)}
                      helperText={
                        (formik.touched.content_generation_prompt && typeof formik.errors.content_generation_prompt === 'string' ? formik.errors.content_generation_prompt : "") ||
                        "Instructions for generating the actual content"
                      }
                      sx={{ fontFamily: 'monospace' }}
                      placeholder="Write a {word_count}-word article about {topic} in a {tone} tone. Structure it with an introduction, 3-5 main sections, and a conclusion..."
                                    />
                                  
                    {formik.values.variables.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                                      <Typography variant="subtitle2" gutterBottom>
                          Quick Insert Variables:
                                      </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formik.values.variables.map((variable, index) => (
                            <Chip
                              key={index}
                              label={variable.key}
                              onClick={() => insertVariablePlaceholder(formik, variable.key)}
                              icon={<CodeIcon fontSize="small" />}
                              clickable
                              color="primary"
                              variant="outlined"
                              sx={{ borderColor: 'rgba(111, 207, 117, 0.5)' }}
                            />
                          ))}
                                          </Box>
                        </Box>
                    )}
                  </PromptCard>
                </Grid>
                
                {/* Template Variables Section */}
                <Grid item xs={12}>
                  <PromptCard title="Template Variables" sx={{ mb: 3 }}>
                    <FieldArray name="variables">
                      {({ push, remove }) => (
                        <>
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ color: '#6FCF75', fontWeight: 'bold', mb: 1 }}>
                              Variables: Where Templates Get Their Superpowers! ⚡
                            </Typography>
                            <Box sx={{ 
                              backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                              p: 2, 
                              borderRadius: 2,
                              border: '1px solid rgba(111, 207, 117, 0.15)',
                              boxShadow: 'inset 0 0 10px rgba(111, 207, 117, 0.1)'
                            }}>
                              <Typography variant="body2" sx={{ color: '#EEEEEE' }}>
                                Variables are what make templates reusable. They're the "fill-in-the-blank" parts that can be customized each time you generate content. Key examples include:
                                <br /><br />
                                • <strong style={{ color: '#6FCF75' }}>word_count</strong> - Control the length of your content
                                <br />
                                • <strong style={{ color: '#6FCF75' }}>topic</strong> - The main subject of your content  
                                <br />
                                • <strong style={{ color: '#6FCF75' }}>tone</strong> - How the content should sound
                                <br /><br />
                                Pro tip: Variables appear as <code style={{ color: '#6FCF75', backgroundColor: 'rgba(111, 207, 117, 0.1)', padding: '0 4px' }}>&#123;&#123;variable_name&#125;&#125;</code> in your prompts!
                              </Typography>
                            </Box>
                          </Box>
                          
                          {/* Revert to original simple Add Variable button */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1">
                              Your Template Variables
                            </Typography>
                            <Button
                              variant="outlined"
                              startIcon={<AddIcon />}
                              onClick={() => {
                                push({
                                  name: "",
                                  key: "",
                                  type: "text",
                                  description: "",
                                  default_value: "",
                                  options: []
                                });
                              }}
                            >
                              Add Variable
                            </Button>
                          </Box>
                          
                          <Grid container spacing={2}>
                            {formik.values.variables.length > 0 ? (
                              formik.values.variables.map((variable, index) => (
                                <Grid item xs={12} sm={6} md={4} key={index}>
                                  <Card variant="outlined" sx={{ height: '100%' }}>
                                    <CardContent>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="bold">
                                          {variable.name || `Variable ${index + 1}`}
                                        </Typography>
                                        <IconButton 
                                          size="small" 
                                          color="error"
                                          onClick={() => remove(index)}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                      
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Display Name"
                                        name={`variables.${index}.name`}
                                        value={variable.name}
                                        onChange={formik.handleChange}
                                        sx={{ mb: 2 }}
                                      />
                                      
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Variable Key"
                                        name={`variables.${index}.key`}
                                        value={variable.key}
                                        onChange={(e) => {
                                          if (!variable.key || variable.key === generateVariableKey(variable.name)) {
                                            // Auto-generate key from name if empty or matches the pattern
                                            const newKey = generateVariableKey(e.target.value || variable.name);
                                            formik.setFieldValue(`variables.${index}.key`, newKey);
                                          } else {
                                            formik.handleChange(e);
                                          }
                                        }}
                                        sx={{ mb: 2 }}
                                      />
                                      
                                      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                        <InputLabel>Type</InputLabel>
                                        <Select
                                          label="Type"
                                          name={`variables.${index}.type`}
                                          value={variable.type}
                                          onChange={formik.handleChange}
                                        >
                                          {VARIABLE_TYPES.map((type) => (
                                            <MenuItem key={type.value} value={type.value}>
                                              {type.label}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                      
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Default Value"
                                        name={`variables.${index}.default_value`}
                                        value={variable.default_value}
                                        onChange={formik.handleChange}
                                        sx={{ mb: 2 }}
                                      />
                                      
                                      {variable.type === "select" && (
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Options (comma-separated)"
                                          name={`variables.${index}.options_string`}
                                          value={Array.isArray(variable.options) ? variable.options.join(", ") : ""}
                                          onChange={(e) => {
                                            const optionsArray = e.target.value.split(",").map(opt => opt.trim()).filter(opt => opt);
                                            formik.setFieldValue(`variables.${index}.options`, optionsArray);
                                          }}
                                        />
                      )}
                  </CardContent>
                </Card>
              </Grid>
                              ))
                            ) : (
                              <Grid item xs={12}>
                                <Paper 
                                  sx={{ 
                                    p: 3, 
                                    textAlign: 'center',
                                    backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                                    color: '#EEEEEE',
                                    border: '1px solid rgba(111, 207, 117, 0.3)'
                                  }}
                                >
                                  <Typography variant="body1" sx={{ color: '#EEEEEE', mb: 2 }}>
                                    No variables added yet. Variables make your template flexible and reusable!
                                  </Typography>
                                  <Button 
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                      push({
                                        name: "Topic",
                                        key: "topic",
                                        type: "text",
                                        description: "The main subject of the content",
                                        default_value: "",
                                        options: []
                                      });
                                    }}
                                  >
                                    Add First Variable
                                  </Button>
                                </Paper>
                              </Grid>
                            )}
                          </Grid>
                        </>
                      )}
                    </FieldArray>
                  </PromptCard>
            </Grid>
            
                {/* Add CREATE TEMPLATE button here, after the Variables section */}
              <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    type="submit"
                      disabled={formik.isSubmitting || !formik.isValid}
                      sx={{ 
                        py: 1.5, 
                        px: 4, 
                        fontSize: '1.2rem',
                        minWidth: 220,
                        background: 'linear-gradient(45deg, #2e7d32 30%, #6FCF75 90%)',
                        boxShadow: '0 3px 5px 2px rgba(111, 207, 117, .3)'
                      }}
                    >
                      {formik.isSubmitting ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
                  </Button>
                </Box>
              </Grid>
            
                {/* Helpful Examples Section */}
            {!isEditMode && (
              <Grid item xs={12}>
                    <PromptCard title="Sample Prompt Patterns" sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ color: '#6FCF75', fontWeight: 'bold' }}>
                        ✨ Proven Prompt Patterns That Work ✨
                    </Typography>
                    
                      <Paper elevation={2} sx={{ 
                        p: 3, 
                        mb: 3, 
                        backgroundColor: 'rgba(17, 25, 18, 0.6)', 
                        color: '#EEEEEE',
                        border: '1px solid rgba(111, 207, 117, 0.3)',
                        boxShadow: 'inset 0 0 10px rgba(111, 207, 117, 0.1)'
                      }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#6FCF75' }}>
                          🏆 Super-Detailed Blog Post Prompt:
                      </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', mb: 2, color: '#EEEEEE' }}>
                          {`Write a comprehensive {{word_count}}-word blog post about {{topic}} with a {{tone}} tone.

STRUCTURE:
1. Start with an attention-grabbing introduction using a surprising statistic, question, or story
2. Include a brief overview that tells the reader what they'll learn
3. Create {{sections}} main sections, each with:
   - A clear H2 heading that includes the section's main point
   - 2-3 paragraphs of explanation
   - At least one real-world example or case study
   - A bulleted list of actionable tips or key takeaways
4. End with a conclusion that summarizes the main points
5. Include a {{cta}} as the final sentence

FORMATTING:
- Use ## for main section headings
- Use ### for sub-section headings
- Use **bold** for important terms or concepts
- Use *italics* for emphasis
- Use > for quotes or important callouts
- Use numbered lists for sequential steps
- Use bullet lists for non-sequential items

WRITING GUIDELINES:
- Write in an {{tone}} but authoritative voice
- Avoid jargon unless immediately explained
- Include statistics with sources when possible
- Address the reader directly using "you"
- Keep paragraphs short (3-4 sentences maximum)
- Vary sentence length for readability`}
                          </Typography>
                        
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#6FCF75' }}>
                          🚀 Quick Product Description Prompt:
                    </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#EEEEEE' }}>
                          {`Create a compelling {{word_count}}-word product description for {{product_name}}, a {{product_type}} for {{target_audience}}.

The description should:
- Start with a hook that identifies the problem this product solves
- Highlight {{features_count}} key features, focusing on benefits rather than specifications
- Include sensory language that helps the customer imagine using the product
- Address {{pain_point}} and explain how this product solves it
- End with a strong {{cta}} that creates urgency

Tone should be {{tone}} and persuasive, without using clichés or hyperbole.

Format with short paragraphs, bullet points for features, and include suggested placement for customer testimonials.`}
                      </Typography>
                    </Paper>
                    </PromptCard>
              </Grid>
            )}
                
                {/* More sections */}
                {/* ... */}
              </Grid>
          </Form>
        )}
      </Formik>
    </Box>
    </ErrorBoundary>
  );
};

export default PromptForm; 