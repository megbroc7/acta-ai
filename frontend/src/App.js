import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from './contexts/AuthContext';

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

// Other Pages
import NotFound from './pages/NotFound';

// Help Pages
import FAQs from './pages/help/FAQs';
import WhyActaAI from './pages/help/WhyActaAI';

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
  return (
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
        
        {/* Help & Support */}
        <Route path="/help/faqs" element={<FAQs />} />
        <Route path="/help/why-acta-ai" element={<WhyActaAI />} />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App; 