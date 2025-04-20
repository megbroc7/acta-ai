import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import { setBackendStatus } from './services/api';

// Layouts
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Dashboard Pages
import Dashboard from './pages/dashboard/Dashboard';

// WordPress Site Pages
import SitesList from './pages/sites/SitesList';
import SiteForm from './pages/sites/SiteForm';
import SiteDetail from './pages/sites/SiteDetail';

// Prompt Template Pages
import PromptsList from './pages/prompts/PromptsList';
import PromptForm from './pages/prompts/PromptForm';
import PromptDetail from './pages/prompts/PromptDetail';

// Schedule Pages
import SchedulesList from './pages/schedules/SchedulesList';
import ScheduleForm from './pages/schedules/ScheduleForm';
import ScheduleDetail from './pages/schedules/ScheduleDetail';

// Blog Post Pages
import PostsList from './pages/posts/PostsList';
import PostDetail from './pages/posts/PostDetail';
import PostEdit from './pages/posts/PostEdit';

// Updates Page
import UpdatesList from './pages/updates/UpdatesList';

// Help Pages
import FAQs from './pages/help/FAQs';

// Other Pages
import NotFound from './pages/NotFound';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</Box>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  const [apiTest, setApiTest] = useState({
    loading: true,
    success: false,
    error: null,
    data: null
  });

  // Run API test on app start
  useEffect(() => {
    const runApiTest = async () => {
      console.log('Testing API connection...');
      try {
        // Use our api service to check backend connection
        const response = await fetch('http://127.0.0.1:8000/api/health', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        const success = response.ok;
        const data = await response.json().catch(() => ({}));
        
        // Update our global backend status
        setBackendStatus(success);
        
        console.log('API connection status:', success ? 'connected' : 'disconnected');
        setApiTest({
          loading: false,
          success: success,
          error: success ? null : 'Could not connect to API',
          data: data
        });
      } catch (error) {
        console.error('API test error:', error);
        // Update global backend status to disconnected
        setBackendStatus(false);
        
        setApiTest({
          loading: false,
          success: false,
          error: error.message || 'Failed to connect to API',
          data: null
        });
      }
    };
    
    runApiTest();
  }, []);

  // Show API test results
  const renderApiTest = () => {
    if (apiTest.loading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography>Testing API connection...</Typography>
        </Box>
      );
    }
    
    if (apiTest.success) {
      return (
        <Alert severity="success" sx={{ mb: 2 }}>
          API connection successful!
        </Alert>
      );
    }
    
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        API connection failed: {typeof apiTest.error === 'object' ? JSON.stringify(apiTest.error) : apiTest.error || 'Unknown error'}
      </Alert>
    );
  };

  return (
    <>
      {renderApiTest()}
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<Navigate to="/register" />} />
        </Route>

        {/* Protected Routes */}
        <Route element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />
          
          {/* WordPress Sites */}
          <Route path="/sites" element={<SitesList />} />
          <Route path="/sites/new" element={<SiteForm />} />
          <Route path="/sites/:id" element={<SiteDetail />} />
          <Route path="/sites/:id/edit" element={<SiteForm />} />
          
          {/* Prompt Templates */}
          <Route path="/prompts" element={<PromptsList />} />
          <Route path="/prompts/new" element={<PromptForm />} />
          <Route path="/prompts/:id" element={<PromptDetail />} />
          <Route path="/prompts/:id/edit" element={<PromptForm />} />
          
          {/* Schedules */}
          <Route path="/schedules" element={<SchedulesList />} />
          <Route path="/schedules/new" element={<ScheduleForm />} />
          <Route path="/schedules/:id" element={<ScheduleDetail />} />
          <Route path="/schedules/:id/edit" element={<ScheduleForm />} />
          
          {/* Blog Posts */}
          <Route path="/posts" element={<PostsList />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/posts/:id/edit" element={<PostEdit />} />
          
          {/* Updates */}
          <Route path="/updates" element={<UpdatesList />} />
          
          {/* Help Pages */}
          <Route path="/help/faqs" element={<FAQs />} />
        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App; 