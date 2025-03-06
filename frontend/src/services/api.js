import axios from 'axios';

/**
 * API service for making requests to the backend
 */
const api = axios.create({
  baseURL: '/api',
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