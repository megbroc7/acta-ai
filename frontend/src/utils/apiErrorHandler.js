/**
 * API Error Handler Utility
 * 
 * This module provides consistent error handling for API calls and
 * helps with network connectivity testing and improved error messages.
 */

/**
 * Checks if the error is a network connection issue
 * @param {Error} error - The error object from an API call
 * @returns {boolean} True if it's a network connectivity issue
 */
export const isNetworkError = (error) => {
  return (
    !error.response && 
    error.message && (
      error.message.includes('Network Error') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('failed to fetch') ||
      error.message.includes('Network request failed')
    )
  );
};

/**
 * Checks if the error is an authentication issue
 * @param {Error} error - The error object from an API call
 * @returns {boolean} True if it's an authentication error
 */
export const isAuthError = (error) => {
  return error.response && (error.response.status === 401 || error.response.status === 403);
};

/**
 * Gets a user-friendly error message
 * @param {Error} error - The error object from an API call
 * @returns {string} A friendly error message
 */
export const getFriendlyErrorMessage = (error) => {
  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection and ensure the backend server is running.';
  }
  
  if (isAuthError(error)) {
    return 'Authentication error. Please log in again.';
  }
  
  // Server returned an error message
  if (error.response && error.response.data) {
    if (typeof error.response.data === 'string') {
      return error.response.data;
    }
    
    if (error.response.data.detail) {
      return error.response.data.detail;
    }
    
    if (error.response.data.message) {
      return error.response.data.message;
    }
  }
  
  // Default fallback message
  return error.message || 'An unexpected error occurred';
};

/**
 * Handles API errors with consistent formatting
 * @param {Error} error - The error object from an API call
 * @param {function} enqueueSnackbar - The notistack enqueueSnackbar function (optional)
 * @param {string} prefix - Prefix to add to the error message (optional)
 * @returns {string} The formatted error message
 */
export const handleApiError = (error, enqueueSnackbar, prefix = '') => {
  const message = `${prefix ? `${prefix}: ` : ''}${getFriendlyErrorMessage(error)}`;
  
  // Log error for debugging
  console.error('API Error:', {
    message: error.message,
    response: error.response,
    friendlyMessage: message
  });
  
  // Show snackbar if function is provided
  if (enqueueSnackbar) {
    enqueueSnackbar(message, { variant: 'error' });
  }
  
  return message;
};

/**
 * Tests backend connectivity
 * @returns {Promise<boolean>} True if the backend is reachable
 */
export const testBackendConnectivity = async (api) => {
  try {
    // Try to reach the auth/me endpoint as it's least likely to have auth issues
    await api.get('/api/auth/me');
    return true;
  } catch (error) {
    return !isNetworkError(error);
  }
}; 