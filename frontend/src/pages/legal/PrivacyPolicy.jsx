import { Box, Container, Typography, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';

const EFFECTIVE_DATE = 'February 18, 2026';

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect the following types of information:

Account Information: When you register, we collect your name, email address, and password (stored in hashed form). You may also set a timezone preference.

Connected Site Credentials: When you connect a publishing platform (e.g., WordPress), we store the API credentials you provide (such as usernames, application passwords, or API keys) to enable content publishing on your behalf.

Content Data: We store prompt templates, experience interviews, schedule configurations, topic lists, and generated blog posts that you create through the Service.

Usage Data: We track AI generation execution history, including token usage, success/failure status, and estimated costs associated with your account.

Feedback: If you submit feedback through the Service, we store the content and category of your submission.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to:

• Provide, operate, and maintain the Service
• Generate and publish AI-powered blog content on your behalf
• Authenticate your identity and secure your account
• Connect to your third-party publishing platforms
• Track usage and costs associated with AI generation
• Respond to your feedback and support inquiries
• Send critical service notifications (e.g., failed scheduled runs)
• Improve the Service based on aggregate usage patterns`,
  },
  {
    title: '3. Third-Party Services',
    content: `The Service integrates with and transmits data to the following third-party services:

OpenAI: Your content templates, topic information, and experience notes are sent to OpenAI's API to generate blog content. OpenAI's data usage policies apply to this processing.

Unsplash: If you enable Unsplash featured images, search queries derived from your content titles are sent to the Unsplash API.

Publishing Platforms: Generated content, including text and images, is transmitted to your connected platforms (WordPress, Shopify, etc.) for publication.

We do not sell, rent, or trade your personal information to third parties for marketing purposes.`,
  },
  {
    title: '4. Data Storage and Security',
    content: `Your data is stored in a PostgreSQL database. We implement industry-standard security measures including:

• Password hashing using bcrypt
• JWT-based authentication with token expiration
• HTTPS encryption for data in transit
• Role-based access controls

While we take reasonable measures to protect your data, no method of electronic storage or transmission is 100% secure. You are responsible for maintaining the confidentiality of your account credentials.`,
  },
  {
    title: '5. Data Retention',
    content: `We retain your data for as long as your account is active. When you delete your account:

• All personal information, templates, schedules, posts, execution history, notifications, and feedback are permanently deleted
• Deletion cascades across all associated records
• This process is irreversible

Content that has already been published to your connected third-party platforms (e.g., WordPress) is not removed by us upon account deletion. You are responsible for managing content on those platforms directly.`,
  },
  {
    title: '6. Your Rights',
    content: `Depending on your jurisdiction, you may have the following rights regarding your personal data:

Right to Access: You can export a complete copy of all your data at any time from your account Settings page.

Right to Rectification: You can update your profile information (name, email, timezone) at any time through Settings.

Right to Deletion: You can permanently delete your account and all associated data from Settings. This action is irreversible.

Right to Data Portability: The data export feature provides your information in a standard JSON format that can be read by other systems.

Right to Object: You can stop AI processing by deactivating your schedules or deleting your account.

To exercise any of these rights, use the features in your account Settings or contact us at support@actaai.com.`,
  },
  {
    title: '7. Cookies and Tracking',
    content: `The Service uses local storage (not cookies) to maintain your authentication session. We store:

• An access token for API authentication
• A refresh token for session renewal

We do not use third-party tracking cookies, analytics services, or advertising pixels. We do not track your activity outside of the Acta AI platform.`,
  },
  {
    title: '8. Children\'s Privacy',
    content: `The Service is not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child under 18, we will take steps to delete that information promptly.`,
  },
  {
    title: '9. International Data Transfers',
    content: `Your data may be processed in countries other than your own, including the United States (where OpenAI's services operate). By using the Service, you consent to the transfer of your information to these countries, which may have different data protection laws than your jurisdiction.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Service with a new effective date. Your continued use of the Service after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact',
    content: `If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at support@actaai.com.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 5 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              mb: 1,
              position: 'relative',
              display: 'inline-block',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -8,
                left: 0,
                width: '100%',
                height: 4,
                background: 'linear-gradient(90deg, #4A7C6F, #6B9E8A, transparent)',
              },
            }}
          >
            Privacy Policy
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
            Effective date: {EFFECTIVE_DATE}
          </Typography>
        </Box>

        {/* Intro */}
        <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8 }}>
          Acta AI ("Service", "we", "us", or "our") is committed to protecting your privacy. This
          Privacy Policy explains what information we collect, how we use it, and your rights
          regarding your data.
        </Typography>

        {/* Sections */}
        {sections.map((section) => (
          <Box key={section.title} sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                mb: 1.5,
                fontSize: '1rem',
              }}
            >
              {section.title}
            </Typography>
            <Typography
              variant="body1"
              sx={{ lineHeight: 1.8, whiteSpace: 'pre-line', color: 'text.secondary' }}
            >
              {section.content}
            </Typography>
          </Box>
        ))}

        {/* Footer links */}
        <Box
          sx={{
            mt: 6,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 3,
            flexWrap: 'wrap',
          }}
        >
          <MuiLink component={Link} to="/terms" underline="hover" sx={{ fontWeight: 600 }}>
            Terms of Service
          </MuiLink>
          <MuiLink component={Link} to="/" underline="hover" sx={{ fontWeight: 600 }}>
            Back to Acta AI
          </MuiLink>
        </Box>
      </Container>
    </Box>
  );
}
