import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const EmptyState = ({
  title = 'No items found',
  description = 'Get started by creating your first item.',
  actionText = 'Create New',
  actionLink = null,
  actionIcon = <AddIcon />,
  actionOnClick = null,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
        textAlign: 'center',
        backgroundColor: 'background.paper',
        borderRadius: 1,
      }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3, maxWidth: 500 }}>
        {description}
      </Typography>
      
      {(actionLink || actionOnClick) && (
        <Button
          variant="contained"
          color="primary"
          startIcon={actionIcon}
          component={actionLink ? RouterLink : undefined}
          to={actionLink}
          onClick={actionOnClick}
        >
          {actionText}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState; 