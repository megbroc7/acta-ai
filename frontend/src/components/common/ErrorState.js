import React from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

const ErrorState = ({
  message = 'An error occurred.',
  details = null,
  onRetry = null,
}) => {
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
      <WarningIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
      
      <Typography variant="h6" color="error" gutterBottom>
        {message}
      </Typography>
      
      {details && (
        <Alert severity="error" sx={{ mt: 2, width: '100%', maxWidth: 500 }}>
          {details}
        </Alert>
      )}
      
      {onRetry && (
        <Button
          variant="contained"
          color="primary"
          onClick={onRetry}
          sx={{ mt: 3 }}
        >
          Try Again
        </Button>
      )}
    </Box>
  );
};

export default ErrorState; 