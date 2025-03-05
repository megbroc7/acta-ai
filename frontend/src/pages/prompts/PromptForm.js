import React, { useState, useEffect, useCallback } from 'react';
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
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Help as HelpIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import api from '../../services/api';

// Variable types for prompt templates
const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'boolean', label: 'Boolean (Yes/No)' },
];

const PromptForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState(null);
  
  // Initial form values
  const initialValues = {
    name: '',
    description: '',
    system_prompt: '',
    topic_generation_prompt: '',
    content_generation_prompt: '',
    default_word_count: 1500,
    default_tone: 'informative',
    variables: [],
  };
  
  // Validation schema
  const validationSchema = Yup.object({
    name: Yup.string().required('Name is required'),
    description: Yup.string().required('Description is required'),
    system_prompt: Yup.string().required('System prompt is required'),
    topic_generation_prompt: Yup.string().required('Topic generation prompt is required'),
    content_generation_prompt: Yup.string().required('Content generation prompt is required'),
    variables: Yup.array().of(
      Yup.object().shape({
        name: Yup.string().required('Variable name is required'),
        key: Yup.string()
          .required('Variable key is required')
          .matches(/^[a-zA-Z0-9_]+$/, 'Key can only contain letters, numbers, and underscores')
          .test(
            'unique-key',
            'Variable keys must be unique',
            function (value) {
              const { variables } = this.parent;
              return variables.filter(v => v.key === value).length <= 1;
            }
          ),
        type: Yup.string().required('Variable type is required'),
        description: Yup.string(),
        default_value: Yup.string(),
        options: Yup.array().when('type', {
          is: (type) => ['select', 'multiselect'].includes(type),
          then: Yup.array()
            .of(Yup.string().required('Option value is required'))
            .min(1, 'At least one option is required'),
          otherwise: Yup.array(),
        }),
      })
    ),
  });
  
  // Wrap fetchPrompt in useCallback
  const fetchPrompt = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/prompts/templates/${id}`);
      setPrompt(response.data);
    } catch (err) {
      console.error('Error fetching prompt:', err);
      setError('Failed to load prompt template. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  const handleSubmit = async (values, { setSubmitting }) => {
    setSaving(true);
    setError(null);
    
    try {
      if (isEditMode) {
        await api.put(`/api/prompts/templates/${id}`, values);
      } else {
        await api.post('/api/prompts/templates', values);
      }
      navigate('/prompts');
    } catch (err) {
      setError('Failed to save prompt template. Please try again.');
      console.error('Error saving prompt:', err);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };
  
  // Generate a unique key from the variable name
  const generateVariableKey = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };
  
  // Insert variable placeholder into prompt content
  const insertVariablePlaceholder = (formik, variableKey, fieldName) => {
    const content = formik.values[fieldName];
    const placeholder = `{${variableKey}}`;
    const cursorPosition = document.getElementById(`prompt-${fieldName}`).selectionStart;
    
    const newContent = 
      content.substring(0, cursorPosition) + 
      placeholder + 
      content.substring(cursorPosition);
    
    formik.setFieldValue(fieldName, newContent);
  };
  
  useEffect(() => {
    if (isEditMode) {
      fetchPrompt();
    }
  }, [id, isEditMode, fetchPrompt]);
  
  if (loading) {
    return <LoadingState message="Loading prompt template..." />;
  }
  
  if (isEditMode && error) {
    return (
      <ErrorState
        message="Error Loading Prompt Template"
        details={error}
        onRetry={fetchPrompt}
      />
    );
  }
  
  // Prepare form values for edit mode
  const formInitialValues = isEditMode && prompt ? {
    name: prompt.name,
    description: prompt.description,
    system_prompt: prompt.system_prompt || '',
    topic_generation_prompt: prompt.topic_generation_prompt || '',
    content_generation_prompt: prompt.content_generation_prompt || '',
    default_word_count: prompt.default_word_count || 1500,
    default_tone: prompt.default_tone || 'informative',
    variables: prompt.variables || [],
  } : initialValues;
  
  return (
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
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Formik
        initialValues={formInitialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {(formik) => (
          <Form>
            <Grid container spacing={3}>
              {/* Introduction Card */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      What are Prompt Templates?
                    </Typography>
                    <Typography variant="body2" paragraph>
                      Prompt templates are pre-designed instructions for AI models that help generate consistent, high-quality content. 
                      They provide structure and guidance to the AI, ensuring it produces content that meets your specific requirements.
                    </Typography>
                    <Typography variant="body2" paragraph>
                      A good prompt template includes:
                    </Typography>
                    <ul>
                      <li>
                        <Typography variant="body2">
                          <strong>System Prompt:</strong> Sets the overall context and behavior for the AI
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          <strong>Topic Generation Prompt:</strong> Helps the AI generate relevant topics
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          <strong>Content Generation Prompt:</strong> Guides the AI in creating the actual content
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          <strong>Variables:</strong> Customizable elements that can be changed for each use
                        </Typography>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Basic Information */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Basic Information
                    </Typography>
                    
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
                          helperText={formik.touched.name && formik.errors.name}
                          disabled={saving}
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
                          helperText={formik.touched.description && formik.errors.description}
                          disabled={saving}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Prompt Content */}
              <Grid item xs={12} md={8}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        System Prompt
                      </Typography>
                      <Tooltip title="The system prompt sets the overall context and behavior for the AI. It defines the AI's role, tone, and general instructions.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <TextField
                      fullWidth
                      id="prompt-system_prompt"
                      name="system_prompt"
                      multiline
                      rows={4}
                      value={formik.values.system_prompt}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.system_prompt && Boolean(formik.errors.system_prompt)}
                      helperText={
                        (formik.touched.system_prompt && formik.errors.system_prompt) ||
                        "Example: You are an expert content writer specializing in {industry} with 15+ years of experience."
                      }
                      disabled={saving}
                      sx={{ fontFamily: 'monospace', mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Topic Generation Prompt
                      </Typography>
                      <Tooltip title="This prompt helps the AI generate relevant topics based on your requirements. It's used when you want the AI to suggest topics rather than providing them yourself.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <TextField
                      fullWidth
                      id="prompt-topic_generation_prompt"
                      name="topic_generation_prompt"
                      multiline
                      rows={4}
                      value={formik.values.topic_generation_prompt}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.topic_generation_prompt && Boolean(formik.errors.topic_generation_prompt)}
                      helperText={
                        (formik.touched.topic_generation_prompt && formik.errors.topic_generation_prompt) ||
                        "Example: Generate 5 blog post topics about {topic} that would interest {target_audience}."
                      }
                      disabled={saving}
                      sx={{ fontFamily: 'monospace', mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Content Generation Prompt
                      </Typography>
                      <Tooltip title="This prompt guides the AI in creating the actual content. It should include specific instructions about structure, tone, style, and any other requirements.">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <TextField
                      fullWidth
                      id="prompt-content_generation_prompt"
                      name="content_generation_prompt"
                      multiline
                      rows={6}
                      value={formik.values.content_generation_prompt}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.content_generation_prompt && Boolean(formik.errors.content_generation_prompt)}
                      helperText={
                        (formik.touched.content_generation_prompt && formik.errors.content_generation_prompt) ||
                        "Example: Write a {word_count}-word blog post about {topic} in a {tone} tone."
                      }
                      disabled={saving}
                      sx={{ fontFamily: 'monospace' }}
                    />
                    
                    {formik.values.variables.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Insert Variable:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formik.values.variables.map((variable, index) => (
                            <Chip
                              key={index}
                              label={variable.key}
                              onClick={() => {
                                // Get the currently focused element
                                const activeElement = document.activeElement;
                                let fieldName = 'system_prompt';
                                
                                if (activeElement) {
                                  if (activeElement.id === 'prompt-system_prompt') {
                                    fieldName = 'system_prompt';
                                  } else if (activeElement.id === 'prompt-topic_generation_prompt') {
                                    fieldName = 'topic_generation_prompt';
                                  } else if (activeElement.id === 'prompt-content_generation_prompt') {
                                    fieldName = 'content_generation_prompt';
                                  }
                                }
                                
                                insertVariablePlaceholder(formik, variable.key, fieldName);
                              }}
                              icon={<CodeIcon fontSize="small" />}
                              clickable
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Variables */}
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Variables
                      </Typography>
                      <Tooltip title="Variables allow users to customize the prompt when generating content">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <FieldArray name="variables">
                      {({ push, remove }) => (
                        <Box>
                          {formik.values.variables.length > 0 ? (
                            formik.values.variables.map((variable, index) => (
                              <Paper 
                                key={index} 
                                elevation={1} 
                                sx={{ p: 2, mb: 2, position: 'relative' }}
                              >
                                <IconButton
                                  size="small"
                                  onClick={() => remove(index)}
                                  sx={{ position: 'absolute', top: 8, right: 8 }}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                                
                                <Grid container spacing={2}>
                                  <Grid item xs={12}>
                                    <TextField
                                      fullWidth
                                      label="Variable Name"
                                      name={`variables.${index}.name`}
                                      value={variable.name}
                                      onChange={(e) => {
                                        formik.handleChange(e);
                                        // Auto-generate key if empty
                                        if (!variable.key) {
                                          const key = generateVariableKey(e.target.value);
                                          formik.setFieldValue(`variables.${index}.key`, key);
                                        }
                                      }}
                                      onBlur={formik.handleBlur}
                                      error={
                                        formik.touched.variables?.[index]?.name && 
                                        Boolean(formik.errors.variables?.[index]?.name)
                                      }
                                      helperText={
                                        formik.touched.variables?.[index]?.name && 
                                        formik.errors.variables?.[index]?.name
                                      }
                                      disabled={saving}
                                    />
                                  </Grid>
                                  
                                  <Grid item xs={12}>
                                    <TextField
                                      fullWidth
                                      label="Variable Key"
                                      name={`variables.${index}.key`}
                                      value={variable.key}
                                      onChange={formik.handleChange}
                                      onBlur={formik.handleBlur}
                                      error={
                                        formik.touched.variables?.[index]?.key && 
                                        Boolean(formik.errors.variables?.[index]?.key)
                                      }
                                      helperText={
                                        (formik.touched.variables?.[index]?.key && 
                                        formik.errors.variables?.[index]?.key) ||
                                        "Used in prompt as {" + (variable.key || "key") + "}"
                                      }
                                      disabled={saving}
                                    />
                                  </Grid>
                                  
                                  <Grid item xs={12}>
                                    <FormControl 
                                      fullWidth
                                      error={
                                        formik.touched.variables?.[index]?.type && 
                                        Boolean(formik.errors.variables?.[index]?.type)
                                      }
                                    >
                                      <InputLabel>Variable Type</InputLabel>
                                      <Select
                                        name={`variables.${index}.type`}
                                        value={variable.type || ''}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        label="Variable Type"
                                        disabled={saving}
                                      >
                                        {VARIABLE_TYPES.map((type) => (
                                          <MenuItem key={type.value} value={type.value}>
                                            {type.label}
                                          </MenuItem>
                                        ))}
                                      </Select>
                                      {formik.touched.variables?.[index]?.type && 
                                       formik.errors.variables?.[index]?.type && (
                                        <FormHelperText>
                                          {formik.errors.variables[index].type}
                                        </FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>
                                  
                                  <Grid item xs={12}>
                                    <TextField
                                      fullWidth
                                      label="Description"
                                      name={`variables.${index}.description`}
                                      value={variable.description || ''}
                                      onChange={formik.handleChange}
                                      onBlur={formik.handleBlur}
                                      disabled={saving}
                                      helperText="Explain what this variable is used for"
                                    />
                                  </Grid>
                                  
                                  <Grid item xs={12}>
                                    <TextField
                                      fullWidth
                                      label="Default Value"
                                      name={`variables.${index}.default_value`}
                                      value={variable.default_value || ''}
                                      onChange={formik.handleChange}
                                      onBlur={formik.handleBlur}
                                      disabled={saving}
                                    />
                                  </Grid>
                                  
                                  {/* Options for select/multiselect types */}
                                  {['select', 'multiselect'].includes(variable.type) && (
                                    <Grid item xs={12}>
                                      <Typography variant="subtitle2" gutterBottom>
                                        Options
                                      </Typography>
                                      
                                      <FieldArray name={`variables.${index}.options`}>
                                        {({ push: pushOption, remove: removeOption }) => (
                                          <Box>
                                            {(variable.options || []).map((option, optionIndex) => (
                                              <Box 
                                                key={optionIndex} 
                                                sx={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center',
                                                  mb: 1 
                                                }}
                                              >
                                                <TextField
                                                  fullWidth
                                                  size="small"
                                                  label={`Option ${optionIndex + 1}`}
                                                  name={`variables.${index}.options.${optionIndex}`}
                                                  value={option}
                                                  onChange={formik.handleChange}
                                                  onBlur={formik.handleBlur}
                                                  error={
                                                    formik.touched.variables?.[index]?.options?.[optionIndex] && 
                                                    Boolean(formik.errors.variables?.[index]?.options?.[optionIndex])
                                                  }
                                                  helperText={
                                                    formik.touched.variables?.[index]?.options?.[optionIndex] && 
                                                    formik.errors.variables?.[index]?.options?.[optionIndex]
                                                  }
                                                  disabled={saving}
                                                />
                                                <IconButton
                                                  size="small"
                                                  onClick={() => removeOption(optionIndex)}
                                                  disabled={saving}
                                                >
                                                  <DeleteIcon fontSize="small" />
                                                </IconButton>
                                              </Box>
                                            ))}
                                            
                                            <Button
                                              size="small"
                                              startIcon={<AddIcon />}
                                              onClick={() => pushOption('')}
                                              disabled={saving}
                                            >
                                              Add Option
                                            </Button>
                                            
                                            {formik.touched.variables?.[index]?.options && 
                                             formik.errors.variables?.[index]?.options && 
                                             typeof formik.errors.variables[index].options === 'string' && (
                                              <FormHelperText error>
                                                {formik.errors.variables[index].options}
                                              </FormHelperText>
                                            )}
                                          </Box>
                                        )}
                                      </FieldArray>
                                    </Grid>
                                  )}
                                </Grid>
                              </Paper>
                            ))
                          ) : (
                            <Typography color="textSecondary" sx={{ mb: 2 }}>
                              No variables defined yet. Add variables to make your prompt template dynamic.
                            </Typography>
                          )}
                          
                          <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => push({
                              name: '',
                              key: '',
                              type: 'text',
                              description: '',
                              default_value: '',
                              options: [],
                            })}
                            disabled={saving}
                            fullWidth
                          >
                            Add Variable
                          </Button>
                        </Box>
                      )}
                    </FieldArray>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Default Settings */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Default Settings
                      </Typography>
                      <Tooltip title="These settings provide default values for common content parameters">
                        <IconButton size="small">
                          <HelpIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Default Word Count"
                          name="default_word_count"
                          value={formik.values.default_word_count}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          error={formik.touched.default_word_count && Boolean(formik.errors.default_word_count)}
                          helperText={(formik.touched.default_word_count && formik.errors.default_word_count) || "Recommended: 800-1500 for blog posts"}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">words</InputAdornment>,
                          }}
                          disabled={saving}
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Default Tone</InputLabel>
                          <Select
                            name="default_tone"
                            value={formik.values.default_tone}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            label="Default Tone"
                            error={formik.touched.default_tone && Boolean(formik.errors.default_tone)}
                            disabled={saving}
                          >
                            <MenuItem value="conversational">Conversational</MenuItem>
                            <MenuItem value="professional">Professional</MenuItem>
                            <MenuItem value="informative">Informative</MenuItem>
                            <MenuItem value="persuasive">Persuasive</MenuItem>
                            <MenuItem value="entertaining">Entertaining</MenuItem>
                            <MenuItem value="authoritative">Authoritative</MenuItem>
                          </Select>
                          <FormHelperText>
                            {(formik.touched.default_tone && formik.errors.default_tone) || "Choose a tone that matches your brand voice"}
                          </FormHelperText>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Submit Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    type="submit"
                    disabled={saving || !formik.isValid}
                    sx={{ minWidth: 150 }}
                  >
                    {saving ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default PromptForm;