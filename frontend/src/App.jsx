import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, SvgIcon } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';

import theme from './theme/theme';

// Laurel wreath icon for success toasts
function LaurelIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24" sx={{ mr: 1, fontSize: 20, ...props.sx }}>
      <path
        d="M12 2C9.5 5 7 7.5 6 11c-1 3.5-.5 6.5.5 9 .5-2 1.5-4 3-5.5C8 17 7 19.5 7 22h2c0-2.5 1.5-5 3-6.5C13.5 17 15 19.5 15 22h2c0-2.5-1-5.1-2.5-7.5 1.5 1.5 2.5 3.5 3 5.5 1-2.5 1.5-5.5.5-9-1-3.5-3.5-6-6-9z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layouts/MainLayout';
import AuthLayout from './components/layouts/AuthLayout';

import Dashboard from './pages/dashboard/Dashboard';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SitesList from './pages/sites/SitesList';
import SiteForm from './pages/sites/SiteForm';
import PromptsList from './pages/prompts/PromptsList';
import PromptForm from './pages/prompts/PromptForm';
import SchedulesList from './pages/schedules/SchedulesList';
import ScheduleForm from './pages/schedules/ScheduleForm';
import PostsList from './pages/posts/PostsList';
import PostDetail from './pages/posts/PostDetail';
import PostEdit from './pages/posts/PostEdit';
import ReviewQueue from './pages/posts/ReviewQueue';
import UserGuide from './pages/guide/UserGuide';
import AboutActaAI from './pages/guide/AboutActaAI';
import Feedback from './pages/feedback/Feedback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider
          maxSnack={3}
          autoHideDuration={4000}
          iconVariant={{ success: <LaurelIcon /> }}
          Components={{}}
          sx={{
            '& .notistack-MuiContent-success': {
              backgroundColor: '#2D5E4A',
              fontFamily: '"Roboto", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.03em',
              borderLeft: '4px solid #B08D57',
            },
          }}
        >
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Auth routes */}
                <Route
                  element={
                    <PublicRoute>
                      <AuthLayout />
                    </PublicRoute>
                  }
                >
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                {/* App routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />

                  <Route path="/sites" element={<SitesList />} />
                  <Route path="/sites/new" element={<SiteForm />} />
                  <Route path="/sites/:id/edit" element={<SiteForm />} />

                  <Route path="/prompts" element={<PromptsList />} />
                  <Route path="/prompts/new" element={<PromptForm />} />
                  <Route path="/prompts/:id/edit" element={<PromptForm />} />

                  <Route path="/schedules" element={<SchedulesList />} />
                  <Route path="/schedules/new" element={<ScheduleForm />} />
                  <Route path="/schedules/:id/edit" element={<ScheduleForm />} />

                  <Route path="/posts" element={<PostsList />} />
                  <Route path="/posts/:id" element={<PostDetail />} />
                  <Route path="/posts/:id/edit" element={<PostEdit />} />
                  <Route path="/review" element={<ReviewQueue />} />

                  <Route path="/guide" element={<UserGuide />} />
                  <Route path="/about" element={<AboutActaAI />} />
                  <Route path="/feedback" element={<Feedback />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
