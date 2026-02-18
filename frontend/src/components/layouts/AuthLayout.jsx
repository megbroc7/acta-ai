import { Outlet, Link } from 'react-router-dom';
import { Box, Container, Paper, Typography, Link as MuiLink } from '@mui/material';

export default function AuthLayout() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography
            variant="h4"
            sx={{
              mb: 4,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
            }}
          >
            Acta AI
          </Typography>
          <Outlet />
        </Paper>
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          <MuiLink
            component={Link}
            to="/terms"
            variant="caption"
            underline="hover"
            sx={{ color: 'text.secondary' }}
          >
            Terms of Service
          </MuiLink>
          <MuiLink
            component={Link}
            to="/privacy"
            variant="caption"
            underline="hover"
            sx={{ color: 'text.secondary' }}
          >
            Privacy Policy
          </MuiLink>
        </Box>
      </Container>
    </Box>
  );
}
