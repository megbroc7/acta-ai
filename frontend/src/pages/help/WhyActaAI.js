import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Card,
  CardContent,
  Divider,
  Grid,
} from '@mui/material';
import PageHeader from '../../components/common/PageHeader';

const WhyActaAI = () => {
  return (
    <Box>
      <PageHeader 
        title="Why Acta AI" 
        breadcrumbs={[
          { text: 'Dashboard', link: '/' },
          { text: 'Why Acta AI' },
        ]}
      />

      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Paper elevation={2} sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
            Our Story & Mission
          </Typography>
          
          <Box sx={{ mb: 5 }}>
            <Card elevation={3} sx={{ 
              mb: 4, 
              p: 1, 
              borderLeft: '5px solid', 
              borderColor: 'primary.main',
              backgroundColor: 'rgba(46, 125, 50, 0.03)'
            }}>
              <CardContent>
                <Typography variant="body1" paragraph sx={{ fontStyle: 'italic', fontSize: '1.1rem' }}>
                  "In ancient Rome, the Acta Diurna was the world's first recorded newspaper—a daily journal carved onto stone or metal and displayed in public spaces for all to see. It chronicled everything from political events to military victories, legal proceedings, and even social gossip. It was how Rome kept its citizens informed, a testament to the power of recorded words shaping history.
                </Typography>
                <Typography variant="body1" paragraph sx={{ fontStyle: 'italic', fontSize: '1.1rem' }}>
                  Acta AI carries that tradition into the digital age. Just as the Acta Diurna transformed communication in the ancient world, Acta AI automates and refines content creation, ensuring your words are recorded, published, and impactful. Whether generating blog posts, transcribing ideas, or streamlining information, Acta AI is your modern-day scribe—efficient, intelligent, and tireless.
                </Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic', fontSize: '1.1rem' }}>
                  From the stone tablets of Rome to the digital pages of today, the act of writing has always driven progress. Let Acta AI take your words further."
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Typography variant="h5" gutterBottom>
            Why Choose Acta AI?
          </Typography>
          
          <Grid container spacing={4} sx={{ mb: 5 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                    Efficiency Redefined
                  </Typography>
                  <Typography variant="body1">
                    Save hours of writing time with AI-powered content generation that delivers quality results in minutes. Our platform automates the tedious parts of content creation while preserving your unique voice and expertise.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                    Consistency Guaranteed
                  </Typography>
                  <Typography variant="body1">
                    Maintain a regular publishing schedule without burnout. Acta AI ensures your audience receives consistent, high-quality content that strengthens your brand, builds authority, and improves engagement rates.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                    Seamless Integration
                  </Typography>
                  <Typography variant="body1">
                    From content creation to WordPress publishing, Acta AI handles the entire workflow. No more switching between tools or manual uploads – create your templates, set your schedule, and let our platform do the rest.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="h5" gutterBottom>
            What Sets Us Apart
          </Typography>

          <Box sx={{ mb: 5 }}>
            <Card elevation={0} sx={{ mb: 3, backgroundColor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Customizable Templates
                </Typography>
                <Typography variant="body1" paragraph>
                  Unlike generic AI tools, Acta AI's template system allows you to create frameworks that preserve your brand voice, incorporate your expertise, and maintain your unique perspective. Your content remains distinctively yours, enhanced by AI efficiency.
                </Typography>
              </CardContent>
            </Card>
            
            <Card elevation={0} sx={{ mb: 3, backgroundColor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Complete Automation
                </Typography>
                <Typography variant="body1" paragraph>
                  Beyond just generating text, Acta AI handles the entire content lifecycle. From topic generation to final publication on your WordPress site, our platform manages the workflow so you can focus on your business and strategy.
                </Typography>
              </CardContent>
            </Card>
            
            <Card elevation={0} sx={{ mb: 3, backgroundColor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  User-Friendly Design
                </Typography>
                <Typography variant="body1" paragraph>
                  Built for content creators of all technical skill levels, Acta AI features an intuitive interface that makes advanced AI technology accessible to everyone. No coding knowledge required – just clear instructions and simple workflows.
                </Typography>
              </CardContent>
            </Card>
            
            <Card elevation={0} sx={{ backgroundColor: 'background.paper' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Continuous Improvement
                </Typography>
                <Typography variant="body1" paragraph>
                  Acta AI evolves with your needs. Our platform learns from your feedback, adapts to your preferences, and continuously improves its outputs. The more you use it, the better it understands your style and requirements.
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Divider sx={{ mb: 5 }} />

          <Typography variant="h5" gutterBottom>
            Join the Content Revolution
          </Typography>
          <Typography variant="body1" paragraph>
            Just as the Acta Diurna transformed how information spread in ancient Rome, Acta AI is changing how modern businesses create and distribute content. We're building a future where quality content creation is accessible to all – efficient, consistent, and impactful.
          </Typography>
          <Typography variant="body1">
            Experience the power of Acta AI for yourself and discover why content creators, marketers, and business owners are making it an essential part of their content strategy.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default WhyActaAI; 