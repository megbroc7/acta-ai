import React from 'react';
import { Box, Typography, Button, Breadcrumbs, Link, Divider } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Add as AddIcon } from '@mui/icons-material';

const PageHeader = ({
  title,
  breadcrumbs = [],
  actionButton = null,
  actionButtonText = 'Add New',
  actionButtonLink = null,
  actionButtonIcon = <AddIcon />,
  actionButtonOnClick = null,
}) => {
  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography 
          variant="h2" 
          component="h1" 
          sx={{ 
            textTransform: 'uppercase', 
            fontWeight: 900,
            letterSpacing: '-0.01em',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -8,
              left: 0,
              width: 60,
              height: 4,
              backgroundColor: 'primary.main',
            }
          }}
        >
          {title}
        </Typography>
        
        {actionButton !== null && (
          <Button
            variant="contained"
            color="primary"
            startIcon={actionButtonIcon}
            component={actionButtonLink ? RouterLink : undefined}
            to={actionButtonLink}
            onClick={actionButtonOnClick}
            sx={{
              fontWeight: 600,
              px: 3,
              py: 1.2,
            }}
          >
            {actionButtonText}
          </Button>
        )}
      </Box>
      
      {breadcrumbs.length > 0 && (
        <Breadcrumbs 
          aria-label="breadcrumb"
          sx={{ 
            mt: 3,
            '& .MuiBreadcrumbs-separator': {
              mx: 1.5,
            }
          }}
        >
          <Link 
            component={RouterLink} 
            to="/" 
            color="inherit"
            sx={{ 
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': {
                color: 'primary.main',
              }
            }}
          >
            Dashboard
          </Link>
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            return isLast ? (
              <Typography 
                key={index} 
                color="textPrimary"
                sx={{ fontWeight: 600 }}
              >
                {crumb.text}
              </Typography>
            ) : (
              <Link
                key={index}
                component={RouterLink}
                to={crumb.link}
                color="inherit"
                sx={{ 
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': {
                    color: 'primary.main',
                  }
                }}
              >
                {crumb.text}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      <Divider sx={{ mt: 2, mb: 3 }} />
    </Box>
  );
};

export default PageHeader; 