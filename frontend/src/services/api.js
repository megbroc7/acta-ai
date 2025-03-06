import axios from 'axios';

/**
 * Determines the base URL for API calls based on the environment and deployment configuration.
 * 
 * In production:
 * - If REACT_APP_API_URL is set, use it
 * - Otherwise, use the same origin but with port 8000 for direct backend access
 * - If we're behind nginx, use the /api path on the same origin
 */
const getBaseUrl = () => {
  // If REACT_APP_API_URL is explicitly set, use it
  if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim() !== '') {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production, we're likely behind nginx which proxies /api to the backend
  // So we can just use the relative /api path
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // Ensure we're not passing raw error objects to components
    // This prevents React from trying to render error objects
    if (error.response && error.response.data) {
      // If the error response contains a detail field that's an array of validation errors
      if (Array.isArray(error.response.data.detail)) {
        // Convert the validation errors to a string message
        const errorMessage = error.response.data.detail
          .map(err => `${err.loc.join('.')}: ${err.msg}`)
          .join(', ');
        
        error.message = errorMessage;
      } 
      // If the error response contains a detail field that's a string
      else if (typeof error.response.data.detail === 'string') {
        error.message = error.response.data.detail;
      }
      // If the error response is an object with type, loc, msg properties (validation error)
      else if (error.response.data.type && error.response.data.loc && error.response.data.msg) {
        error.message = `${error.response.data.loc.join('.')}: ${error.response.data.msg}`;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 