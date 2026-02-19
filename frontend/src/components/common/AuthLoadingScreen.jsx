import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

const breathe = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(0.97); }
  50% { opacity: 1; transform: scale(1); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

export default function AuthLoadingScreen() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F0EFEC',
        zIndex: 9999,
      }}
    >
      <Box
        component="img"
        src="/favicon.png"
        alt="Acta AI"
        sx={{ width: 56, height: 56, animation: `${breathe} 2.4s ease-in-out infinite` }}
      />

      {/* Logotype */}
      <Typography
        sx={{
          mt: 2.5,
          fontFamily: '"Roboto Condensed", sans-serif',
          fontWeight: 900,
          fontSize: '1.4rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#2A2A2A',
        }}
      >
        Acta AI
      </Typography>

      {/* Shimmer bar */}
      <Box
        sx={{
          mt: 2,
          width: 120,
          height: 2,
          background: 'linear-gradient(90deg, transparent, #B08D57, #D4A574, #B08D57, transparent)',
          backgroundSize: '200% 100%',
          animation: `${shimmer} 2s linear infinite`,
        }}
      />
    </Box>
  );
}
