import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingState = ({ message = 'Loading...' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <CircularProgress size={40} sx={{ mb: 2 }} />
      <Typography variant="body1" color="textSecondary">
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingState; 