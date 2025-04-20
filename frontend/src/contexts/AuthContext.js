import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';
// Import jwt-decode for token validation
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Token validation function
  const isTokenValid = (token) => {
    if (!token) return false;
    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp > currentTime;
    } catch (err) {
      console.error('Token validation error:', err);
      return false;
    }
  };

  // Set auth token in axios headers
  const setAuthToken = (token) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
    setToken(token);
  };

  // Login user
  const login = async (email, password) => {
    try {
      setError(null);
      console.log(`Attempting login for: ${email}`);
      
      // Using URLSearchParams to format data as form-urlencoded (what the backend expects)
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await api.post('/api/auth/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      console.log('Login response:', response);
      
      const { access_token } = response.data;
      setToken(access_token);
      setAuthToken(access_token);
      
      // Get user data
      await loadUser();
      
      return true;
    } catch (error) {
      console.error('Login error details:', error);
      
      // Handle different error types
      if (error.code === 'ECONNABORTED') {
        setError('Login request timed out. The server may be overloaded. Please try again.');
      } else {
        const errorMessage = error.response?.data?.detail || 
                            error.message || 
                            'Login failed. Please check your credentials.';
        setError(errorMessage);
      }
      
      return false;
    }
  };

  // Register user
  const register = async (email, password, name) => {
    try {
      setError(null);
      await api.post('/api/auth/register', {
        email,
        password,
        name,
      });
      
      // Login after registration
      return await login(email, password);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Registration failed. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', error);
      return false;
    }
  };

  // Load user data
  const loadUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    // Check if token is valid before making the API call
    if (!isTokenValid(token)) {
      setToken(null);
      setAuthToken(null);
      setUser(null);
      setLoading(false);
      return;
    }
    
    try {
      setAuthToken(token);
      const response = await api.get('/api/auth/me');
      setUser(response.data);
      setError(null);
    } catch (err) {
      console.error('Error loading user:', err);
      setToken(null);
      setAuthToken(null);
      setUser(null);
      setError('Authentication failed. Please login again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Logout user
  const logout = () => {
    setToken(null);
    setAuthToken(null);
    setUser(null);
  };

  // Auto load user on startup if token exists
  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token, loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 