import { Box, Container, Typography, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';

export default function Support() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              mb: 1,
            }}
          >
            Support
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Acta AI merchant support and app review contact details.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Contact
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
            For support requests, onboarding help, and Shopify app review follow-ups, email:
            {' '}
            <strong>support@actaai.com</strong>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Response Window
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
            We typically respond within 1 business day for production merchant issues and review-team
            requests.
          </Typography>
        </Box>

        <Box sx={{ mt: 5, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 3 }}>
          <MuiLink component={Link} to="/privacy" underline="hover" sx={{ fontWeight: 600 }}>
            Privacy Policy
          </MuiLink>
          <MuiLink component={Link} to="/terms" underline="hover" sx={{ fontWeight: 600 }}>
            Terms of Service
          </MuiLink>
        </Box>
      </Container>
    </Box>
  );
}
