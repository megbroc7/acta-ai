import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const response = await api.post('/api/auth/token', new URLSearchParams({
        username: email,
        password: password,
      }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
      
      const { access_token } = response.data;
      setToken(access_token);
      setAuthToken(access_token);
      
      // Get user data
      await loadUser();
      
      return true;
    } catch (error) {
      setError(error.response?.data?.detail || 'Login failed');
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
        full_name: name,
      });
      
      // Login after registration
      return await login(email, password);
    } catch (error) {
      setError(error.response?.data?.detail || 'Registration failed');
      return false;
    }
  };

  // Load user data
  const loadUser = useCallback(async () => {
    if (!token) {
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