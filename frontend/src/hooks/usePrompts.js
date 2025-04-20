import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { handleApiError, isNetworkError } from '../utils/apiErrorHandler';
import { getBackendStatus } from '../services/api';

// Query key for templates list
const TEMPLATES_QUERY_KEY = 'templates';

/**
 * Hook for fetching all prompt templates
 */
export const usePrompts = () => {
  return useQuery({
    queryKey: [TEMPLATES_QUERY_KEY],
    queryFn: async () => {
      try {
        const response = await api.get('/api/templates/');
        
        // Process and validate the data
        if (Array.isArray(response.data)) {
          return response.data.map(template => ({
            ...template,
            id: template.id,
            name: template.name || 'Untitled Template',
            description: template.description || '',
            system_prompt: template.system_prompt || '',
            topic_generation_prompt: template.topic_generation_prompt || '',
            content_generation_prompt: template.content_generation_prompt || '',
            variables: Array.isArray(template.variables) ? template.variables : []
          }));
        }
        
        throw new Error('Invalid response format from server');
      } catch (error) {
        // Enhanced error handling
        if (isNetworkError(error)) {
          throw new Error('Network error: Unable to connect to backend. Please check your connection.');
        }
        throw error;
      }
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return false;
      }
      // For network errors or 5xx errors, retry up to 3 times
      return failureCount < 3;
    },
    // Only enable query if we have a backend connection
    enabled: getBackendStatus(),
  });
};

/**
 * Hook for fetching a single prompt template by ID
 */
export const usePrompt = (id) => {
  return useQuery({
    queryKey: [TEMPLATES_QUERY_KEY, id],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/templates/${id}`);
        
        if (!response.data) {
          throw new Error('No data returned from server');
        }
        
        // Handle variables parsing
        let variables = [];
        if (response.data.variables) {
          if (Array.isArray(response.data.variables)) {
            variables = response.data.variables;
          } else if (typeof response.data.variables === 'string') {
            try {
              const parsed = JSON.parse(response.data.variables);
              variables = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              // Failed to parse variables string - default to empty array
              variables = [];
            }
          }
        }
        
        // Return processed template with defaults
        return {
          ...response.data,
          name: response.data.name || 'Untitled Template',
          description: response.data.description || '',
          system_prompt: response.data.system_prompt || '',
          topic_generation_prompt: response.data.topic_generation_prompt || '',
          content_generation_prompt: response.data.content_generation_prompt || '',
          variables: variables
        };
      } catch (error) {
        // Enhanced error handling
        if (isNetworkError(error)) {
          throw new Error('Network error: Unable to load template. Please check your connection.');
        }
        throw error;
      }
    },
    enabled: !!id && getBackendStatus(), // Only run query if we have an ID and backend is available
    retry: (failureCount, error) => {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for deleting a prompt template
 */
export const useDeletePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      try {
        await api.delete(`/api/templates/${id}`);
        return id;
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error('Network error: Unable to delete template. Please check your connection and try again.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the templates list to trigger a refetch
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] });
    },
    retry: 1,
  });
};

/**
 * Hook for duplicating a prompt template
 */
export const useDuplicatePrompt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      try {
        // Use the dedicated duplication endpoint
        const response = await api.post(`/api/templates/${id}/duplicate`);
        return response.data;
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error('Network error: Unable to duplicate template. Please check your connection and try again.');
        }
        // Add more detail to the error message
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to duplicate template';
        throw new Error(`Error duplicating template: ${errorMessage}`);
      }
    },
    onSuccess: () => {
      // Invalidate the templates list to trigger a refetch
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] });
    },
    retry: 1,
  });
}; 