import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Language as LanguageIcon,
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
  Article as ArticleIcon,
  AccountCircle,
  Help as HelpIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ConnectionStatus from '../common/ConnectionStatus';
import { setBackendStatus } from '../../services/api';

const drawerWidth = 260;

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const handleConnectionChange = (connected) => {
    setBackendStatus(connected);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'WordPress Sites', icon: <LanguageIcon />, path: '/sites' },
    { text: 'Prompt Templates', icon: <DescriptionIcon />, path: '/prompts' },
    { text: 'Schedules', icon: <ScheduleIcon />, path: '/schedules' },
    { text: 'Blog Posts', icon: <ArticleIcon />, path: '/posts' },
    { text: 'Latest Updates', icon: <UpdateIcon />, path: '/updates' },
    { text: 'Help & FAQs', icon: <HelpIcon />, path: '/help/faqs' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ height: 80, backgroundColor: '#000000' }}>
        <Typography 
          variant="h5" 
          component="div"
          sx={{ 
            fontWeight: 900, 
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#FFFFFF'
          }}
        >
          Acta AI
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.12)' }} />
      <List sx={{ mt: 2, backgroundColor: '#000000' }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                py: 1.5,
                pl: 3,
                color: '#FFFFFF',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRight: '4px solid',
                  borderColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: location.pathname === item.path ? 'primary.light' : '#FFFFFF',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{ 
                  fontWeight: location.pathname === item.path ? 700 : 500,
                  fontSize: '0.95rem',
                  color: '#FFFFFF'
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: '#000000',
          color: '#FFFFFF',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <Toolbar sx={{ height: 80 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '1rem',
              color: '#FFFFFF'
            }}
          >
            {menuItems.find((item) => item.path === location.pathname)?.text || 'Acta AI'}
          </Typography>
          <Box sx={{ mr: 3 }}>
            <ConnectionStatus onConnectionChange={handleConnectionChange} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography 
              variant="body1" 
              sx={{ 
                mr: 2,
                fontWeight: 500,
                display: { xs: 'none', md: 'block' },
                color: '#FFFFFF'
              }}
            >
              {user?.email}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              sx={{ 
                color: 'primary.main',
                border: '2px solid',
                borderColor: 'primary.main',
                p: 1,
              }}
            >
              {user?.avatar ? (
                <Avatar 
                  src={user.avatar} 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                />
              ) : (
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || <AccountCircle />}
                </Avatar>
              )}
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              PaperProps={{
                sx: {
                  mt: 1,
                  border: '1px solid #E0E0E0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }
              }}
            >
              <MenuItem 
                onClick={handleLogout}
                sx={{ 
                  fontWeight: 600,
                  py: 1.5,
                  px: 2,
                }}
              >
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: '#000000',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: '#000000',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 4, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: '#222222',
          color: '#EEEEEE',
        }}
      >
        <Toolbar sx={{ height: 80 }} />
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout; 