import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Stack,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../../contexts/useAuth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 400 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Create Account
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <TextField
            label="Full Name"
            fullWidth
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            inputProps={{ minLength: 8 }}
            helperText="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
          </Button>
        </Stack>
      </form>
      <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
          Sign In
        </Link>
      </Typography>
    </Box>
  );
}
