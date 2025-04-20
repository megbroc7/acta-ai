import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
  Article as ArticleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '../../services/api';
import PageHeader from '../../components/common/PageHeader';

const Dashboard = () => {
  const [stats, setStats] = useState({
    sites: { count: 0, loading: true, error: null },
    prompts: { count: 0, loading: true, error: null },
    schedules: { count: 0, loading: true, error: null },
    posts: { count: 0, loading: true, error: null },
  });
  const [recentPosts, setRecentPosts] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch WordPress sites count
        const sitesResponse = await api.get('/api/sites');
        setStats(prev => ({
          ...prev,
          sites: { count: sitesResponse.data.length, loading: false, error: null },
        }));

        // Fetch prompt templates count
        const promptsResponse = await api.get('/api/templates');
        setStats(prev => ({
          ...prev,
          prompts: { count: promptsResponse.data.length, loading: false, error: null },
        }));

        // Fetch schedules count
        const schedulesResponse = await api.get('/api/schedules');
        setStats(prev => ({
          ...prev,
          schedules: { count: schedulesResponse.data.length, loading: false, error: null },
        }));

        // Fetch posts count
        const postsResponse = await api.get('/api/posts');
        setStats(prev => ({
          ...prev,
          posts: { count: postsResponse.data.length, loading: false, error: null },
        }));

        // Fetch recent posts
        const recentPostsResponse = await api.get('/api/posts?limit=5');
        setRecentPosts({
          data: recentPostsResponse.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setStats(prev => ({
          ...prev,
          sites: { ...prev.sites, loading: false, error: 'Failed to load sites' },
          prompts: { ...prev.prompts, loading: false, error: 'Failed to load prompts' },
          schedules: { ...prev.schedules, loading: false, error: 'Failed to load schedules' },
          posts: { ...prev.posts, loading: false, error: 'Failed to load posts' },
        }));
        setRecentPosts({
          data: [],
          loading: false,
          error: 'Failed to load recent posts',
        });
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'WordPress Sites',
      count: stats.sites.count,
      loading: stats.sites.loading,
      error: stats.sites.error,
      icon: <LanguageIcon fontSize="large" color="primary" />,
      link: '/sites',
      addLink: '/sites/new',
    },
    {
      title: 'Prompt Templates',
      count: stats.prompts.count,
      loading: stats.prompts.loading,
      error: stats.prompts.error,
      icon: <DescriptionIcon fontSize="large" color="primary" />,
      link: '/prompts',
      addLink: '/prompts/new',
    },
    {
      title: 'Schedules',
      count: stats.schedules.count,
      loading: stats.schedules.loading,
      error: stats.schedules.error,
      icon: <ScheduleIcon fontSize="large" color="primary" />,
      link: '/schedules',
      addLink: '/schedules/new',
    },
    {
      title: 'Blog Posts',
      count: stats.posts.count,
      loading: stats.posts.loading,
      error: stats.posts.error,
      icon: <ArticleIcon fontSize="large" color="primary" />,
      link: '/posts',
      addLink: null, // Posts are created through schedules
    },
  ];

  return (
    <Box>
      <PageHeader title="Dashboard" />
      
      <Box sx={{ mb: 6 }}>
        <Typography 
          variant="h5" 
          sx={{ 
            mb: 3, 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          CONTENT OVERVIEW
        </Typography>
        <Grid container spacing={3}>
          {/* Stat Cards */}
          {statCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.title}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  height: '100%', 
                  border: '1px solid rgba(111, 207, 117, 0.2)',
                  backgroundColor: '#333333',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 4px 20px rgba(111, 207, 117, 0.2)',
                    borderColor: '#6FCF75',
                    transform: 'translateY(-4px)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ 
                      backgroundColor: 'primary.dark', 
                      p: 1.5, 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      boxShadow: '0 0 10px rgba(111, 207, 117, 0.3)',
                    }}>
                      {React.cloneElement(card.icon, { style: { color: '#fff' } })}
                    </Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: '0.9rem',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {card.title}
                    </Typography>
                  </Box>
                  
                  {card.loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : card.error ? (
                    <Typography color="error" variant="body2">
                      {card.error}
                    </Typography>
                  ) : (
                    <Typography 
                      variant="h3" 
                      align="center" 
                      sx={{ 
                        my: 2, 
                        fontWeight: 800,
                        color: 'secondary.main'
                      }}
                    >
                      {card.count}
                    </Typography>
                  )}
                  
                  <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      component={RouterLink}
                      to={card.link}
                      variant="outlined"
                      size="small"
                      sx={{ 
                        borderWidth: '2px', 
                        fontWeight: 600,
                        '&:hover': {
                          borderWidth: '2px',
                        }
                      }}
                    >
                      View All
                    </Button>
                    
                    {card.addLink && (
                      <Button
                        component={RouterLink}
                        to={card.addLink}
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ fontWeight: 600 }}
                      >
                        Add New
                      </Button>
                    )}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
      
      {/* Recent Posts */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h5" 
          sx={{ 
            mb: 3, 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          RECENT CONTENT
        </Typography>
        <Card 
          elevation={0} 
          sx={{ 
            border: '1px solid rgba(111, 207, 117, 0.2)',
            borderRadius: 0,
            backgroundImage: 'linear-gradient(rgba(111, 207, 117, 0.05), rgba(111, 207, 117, 0))',
          }}
        >
          <CardContent>
            <Typography 
              variant="h6" 
              gutterBottom
              sx={{ 
                fontWeight: 700,
                position: 'relative',
                display: 'inline-block',
                pb: 1,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 2,
                  backgroundColor: 'primary.main',
                }
              }}
            >
              Recent Blog Posts
            </Typography>
            
            {recentPosts.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress />
              </Box>
            ) : recentPosts.error ? (
              <Typography color="error" variant="body2">
                {recentPosts.error}
              </Typography>
            ) : recentPosts.data.length === 0 ? (
              <Typography 
                variant="body1" 
                sx={{ 
                  py: 4, 
                  textAlign: 'center',
                  color: 'text.secondary',
                  fontStyle: 'italic'
                }}
              >
                No blog posts yet. Create a schedule to start generating content.
              </Typography>
            ) : (
              <List sx={{ mt: 2 }}>
                {recentPosts.data.map((post) => (
                  <React.Fragment key={post.id}>
                    <ListItem
                      button
                      component={RouterLink}
                      to={`/posts/${post.id}`}
                      sx={{ 
                        py: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: 'rgba(111, 207, 117, 0.1)',
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {post.title}
                          </Typography>
                        }
                        secondary={`Status: ${post.status} | Created: ${new Date(post.created_at).toLocaleDateString()}`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2 }}>
            <Button
              component={RouterLink}
              to="/posts"
              variant="outlined"
              color="primary"
              size="small"
              sx={{ 
                borderWidth: '2px', 
                fontWeight: 600,
                mr: 1,
                '&:hover': {
                  borderWidth: '2px',
                }
              }}
            >
              View All Posts
            </Button>
            <Button
              component={RouterLink}
              to="/schedules/new"
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              sx={{ fontWeight: 600 }}
            >
              Create Schedule
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard; 