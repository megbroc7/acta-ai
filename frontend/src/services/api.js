import axios from 'axios';
import { handleApiError, isNetworkError } from '../utils/apiErrorHandler';

// Get API URL from environment or use default
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const environment = process.env.NODE_ENV;

// Log configuration

// Create base Axios instance
const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Don't use withCredentials for simple JWT auth
  withCredentials: false,
  // Set reasonable timeouts
  timeout: 180000, // 180 seconds (increased from 15 seconds)
});

// Global connection status tracking
let isBackendAvailable = true;
export const getBackendStatus = () => isBackendAvailable;
export const setBackendStatus = (status) => {
  isBackendAvailable = status;
};

// Add request interceptor for authorization
api.interceptors.request.use(
  (config) => {
    // Add debugging for post detail route
    if (config.url && config.url.includes('/api/posts/') && !config.url.endsWith('/posts/')) {
      console.log('Debug - Token in request:', localStorage.getItem('token'));
      console.log('Debug - Headers:', config.headers);
    }
    
    // Get token from local storage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request details in development
    if (environment === 'development') {
      // Request logging was removed during cleanup
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    // Connection successful, update status
    setBackendStatus(true);
    return response;
  },
  async (error) => {
    // Check if it's a network error
    if (isNetworkError(error)) {
      setBackendStatus(false);
      
      // Create more descriptive error
      const enhancedError = new Error('Network Error: Unable to connect to the backend server');
      enhancedError.originalError = error;
      enhancedError.isNetworkError = true;
      
      // Add retry information for the client
      enhancedError.retry = async () => {
        if (error.config) {
          return api(error.config);
        }
        return Promise.reject(new Error('Cannot retry request: configuration lost'));
      };
      
      return Promise.reject(enhancedError);
    }
    
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      // Optional: Clear token if unauthorized
      // localStorage.removeItem('token');
    }
    
    // Log the error but avoid circular references
    handleApiError(error);
    
    return Promise.reject(error);
  }
);

export default api; 