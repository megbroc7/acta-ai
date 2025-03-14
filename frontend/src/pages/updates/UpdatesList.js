import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import { Update as UpdateIcon } from '@mui/icons-material';
import PageHeader from '../../components/common/PageHeader';

const UpdatesList = () => {
  // Define the updates - newest first
  const updates = [
    {
      id: 1,
      date: 'March 13, 2024',
      title: 'Enhanced Prompt Templates',
      description: 'We\'ve significantly improved the prompt templates feature with a more comprehensive example template that includes detailed instructions for content generation.',
      category: 'Feature Enhancement',
    },
    {
      id: 2,
      date: 'March 12, 2024',
      title: 'Expanded Tone Options',
      description: 'Added more tone options to the Default Tone dropdown, giving you 20 different options for fine-tuning your content.',
      category: 'New Feature',
    },
    {
      id: 3,
      date: 'March 10, 2024',
      title: 'Writing Style vs. Tone Explanation',
      description: 'Added a new section explaining the difference between writing style and tone for better content customization.',
      category: 'Documentation',
    },
    {
      id: 4,
      date: 'March 8, 2024',
      title: 'Improved Error Handling',
      description: 'Implemented a robust error boundary component to catch and display errors gracefully.',
      category: 'Bug Fix',
    },
    {
      id: 5,
      date: 'March 5, 2024',
      title: 'SEO Title Guidelines',
      description: 'Added new guidance for creating SEO-optimized headlines with formulas and best practices.',
      category: 'New Feature',
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Latest Updates"
        breadcrumbs={[{ text: 'Latest Updates' }]}
        subtitle="Stay informed about new features, improvements, and fixes."
        icon={<UpdateIcon fontSize="large" />}
      />

      <Grid container spacing={3}>
        {updates.map((update) => (
          <Grid item xs={12} key={update.id}>
            <Card 
              sx={{ 
                mb: 2, 
                border: '1px solid rgba(111, 207, 117, 0.3)',
                boxShadow: '0 0 15px rgba(111, 207, 117, 0.2)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                    {update.title}
                  </Typography>
                  <Chip 
                    label={update.category} 
                    color={
                      update.category === 'New Feature' ? 'primary' : 
                      update.category === 'Feature Enhancement' ? 'success' :
                      update.category === 'Bug Fix' ? 'warning' : 
                      'info'
                    }
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
                
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                  {update.date}
                </Typography>
                
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="body1">
                  {update.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default UpdatesList; 