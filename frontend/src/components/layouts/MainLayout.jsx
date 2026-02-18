import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Collapse,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Language as SitesIcon,
  Description as TemplatesIcon,
  Schedule as SchedulesIcon,
  Article as PostsIcon,
  Menu as MenuIcon,
  AccountCircle,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MenuBook as GuideIcon,
  Info as AboutIcon,
  RateReview as FeedbackIcon,
  AssignmentTurnedIn as ReviewIcon,
  CalendarMonth as CalendarIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  WorkspacePremium as BillingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  EventNote as OversightIcon,
  ErrorOutline as ErrorsIcon,
  People as UsersIcon,
  AttachMoney as CostsIcon,
  Forum as AdminFeedbackIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import NotificationCenter from '../common/NotificationCenter';

const DRAWER_WIDTH = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

const ADMIN_CHILDREN = [
  { label: 'Overview', icon: <DashboardIcon fontSize="small" />, path: '/admin' },
  { label: 'Schedules', icon: <OversightIcon fontSize="small" />, path: '/admin/schedules' },
  { label: 'Error Log', icon: <ErrorsIcon fontSize="small" />, path: '/admin/errors' },
  { label: 'Users', icon: <UsersIcon fontSize="small" />, path: '/admin/users' },
  { label: 'Costs', icon: <CostsIcon fontSize="small" />, path: '/admin/costs' },
  { label: 'Feedback', icon: <AdminFeedbackIcon fontSize="small" />, path: '/admin/feedback' },
];

function buildNavItems(isAdmin) {
  const items = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { label: 'Sites', icon: <SitesIcon />, path: '/sites' },
    { label: 'Prompt Templates', icon: <TemplatesIcon />, path: '/prompts' },
    { label: 'Schedules', icon: <SchedulesIcon />, path: '/schedules' },
    { label: 'Content Calendar', icon: <CalendarIcon />, path: '/calendar' },
    { label: 'Blog Posts', icon: <PostsIcon />, path: '/posts' },
    { label: 'Review Queue', icon: <ReviewIcon />, path: '/review', badge: true },
    { divider: true },
    { label: 'User Guide', icon: <GuideIcon />, path: '/guide' },
    { label: 'About Acta AI', icon: <AboutIcon />, path: '/about' },
    { label: 'Feedback', icon: <FeedbackIcon />, path: '/feedback' },
    { label: 'Subscription', icon: <BillingIcon />, path: '/billing' },
    { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];
  if (isAdmin) {
    items.push({ divider: true });
    items.push({ label: 'Admin', icon: <AdminIcon />, path: '/admin', children: ADMIN_CHILDREN });
  }
  return items;
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [adminOpen, setAdminOpen] = useState(() => location.pathname.startsWith('/admin'));

  const navItems = buildNavItems(user?.is_admin);

  const { data: postCounts } = useQuery({
    queryKey: ['postCounts'],
    queryFn: () => api.get('/posts/stats/counts').then(r => r.data),
    refetchInterval: 60000,
  });
  const pendingCount = postCounts?.pending_review || 0;

  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenanceStatus'],
    queryFn: () => api.get('/system/maintenance-status').then(r => r.data),
    refetchInterval: 60000,
  });
  const isMaintenanceMode = maintenanceData?.maintenance_mode || false;

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    // Exact match for admin child routes (e.g. /admin/costs)
    if (path.startsWith('/admin/')) return location.pathname === path;
    // Admin parent: highlight when any admin route is active
    if (path === '/admin') return location.pathname.startsWith('/admin');
    return location.pathname.startsWith(path);
  };
  const isExactActive = (path) => location.pathname === path;

  const renderNavIcon = (item) => {
    const icon = item.icon;
    if (item.badge && pendingCount > 0) {
      return (
        <Badge
          badgeContent={pendingCount}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: '#B08D57',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.65rem',
              minWidth: 18,
              height: 18,
            },
          }}
        >
          {icon}
        </Badge>
      );
    }
    return icon;
  };

  const mobileDrawer = (
    <Box>
      <Toolbar sx={{ height: 80 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
          }}
        >
          Acta AI
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ mt: 2 }}>
        {navItems.map((item, idx) =>
          item.divider ? (
            <Divider key={`div-${idx}`} sx={{ my: 1 }} />
          ) : item.children ? (
            <Box key={item.path}>
              <ListItem disablePadding>
                <ListItemButton
                  selected={isActive(item.path)}
                  onClick={() => setAdminOpen(!adminOpen)}
                  sx={{
                    py: 1.5,
                    pl: 3,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(74, 124, 111, 0.08)',
                      borderRight: '4px solid',
                      borderColor: 'primary.main',
                      '&:hover': { backgroundColor: 'rgba(74, 124, 111, 0.12)' },
                    },
                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                  }}
                >
                  <ListItemIcon sx={{ color: isActive(item.path) ? 'primary.main' : 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: isActive(item.path) ? 700 : 500, fontSize: '0.95rem' }} />
                  {adminOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </ListItemButton>
              </ListItem>
              <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                <List disablePadding>
                  {item.children.map((child) => (
                    <ListItem key={child.path} disablePadding>
                      <ListItemButton
                        selected={isExactActive(child.path)}
                        onClick={() => { navigate(child.path); setMobileOpen(false); }}
                        sx={{
                          py: 1,
                          pl: 5,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(74, 124, 111, 0.08)',
                            '&:hover': { backgroundColor: 'rgba(74, 124, 111, 0.12)' },
                          },
                          '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                        }}
                      >
                        <ListItemIcon sx={{ color: isExactActive(child.path) ? 'primary.main' : 'text.secondary', minWidth: 32 }}>
                          {child.icon}
                        </ListItemIcon>
                        <ListItemText primary={child.label} primaryTypographyProps={{ fontWeight: isExactActive(child.path) ? 700 : 400, fontSize: '0.85rem' }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          ) : (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isActive(item.path)}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  py: 1.5,
                  pl: 3,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(74, 124, 111, 0.08)',
                    borderRight: '4px solid',
                    borderColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'rgba(74, 124, 111, 0.12)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? 'primary.main' : 'inherit',
                    minWidth: 40,
                  }}
                >
                  {renderNavIcon(item)}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 700 : 500,
                    fontSize: '0.95rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        )}
      </List>
    </Box>
  );

  // Simple column/pillar SVG for collapsed state
  const ColumnIcon = () => (
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
      <rect x="2" y="0" width="20" height="3" rx="0" fill="#B08D57" />
      <rect x="4" y="3" width="3" height="22" fill="#4A7C6F" />
      <rect x="10.5" y="3" width="3" height="22" fill="#4A7C6F" />
      <rect x="17" y="3" width="3" height="22" fill="#4A7C6F" />
      <rect x="2" y="25" width="20" height="3" rx="0" fill="#B08D57" />
    </svg>
  );

  // Small laurel leaf indicator for active nav
  const LaurelIndicator = () => (
    <Box
      sx={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 6,
        height: 24,
        background: 'linear-gradient(180deg, #6B9E8A, #4A7C6F, #2D5E4A)',
        borderRadius: '3px 0 0 3px',
        boxShadow: '-2px 0 6px rgba(74, 124, 111, 0.3)',
      }}
    />
  );

  const desktopDrawer = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F7F5F0 60%, #EDE9E1 100%)',
      }}
    >
      <Toolbar sx={{ height: 80, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start' }}>
          {collapsed ? (
            <Box component="img" src="/favicon.png" alt="Acta AI" sx={{ width: 36, height: 36 }} />
          ) : (
            <>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                Acta AI
              </Typography>
              <Box
                sx={{
                  width: 40,
                  height: 2,
                  mt: 0.5,
                  background: 'linear-gradient(90deg, #B08D57, #D4A574, transparent)',
                }}
              />
            </>
          )}
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ mt: 2, flexGrow: 1 }}>
        {navItems.map((item, idx) =>
          item.divider ? (
            <Divider key={`div-${idx}`} sx={{ my: 1 }} />
          ) : item.children ? (
            <Box key={item.path}>
              <ListItem disablePadding sx={{ position: 'relative' }}>
                {isActive(item.path) && <LaurelIndicator />}
                <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                  <ListItemButton
                    selected={isActive(item.path)}
                    onClick={() => {
                      if (collapsed) {
                        navigate(item.path);
                      } else {
                        setAdminOpen(!adminOpen);
                      }
                    }}
                    sx={{
                      py: 1.5,
                      pl: collapsed ? 0 : 3,
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(74, 124, 111, 0.08)',
                        borderRight: 'none',
                        '&:hover': { backgroundColor: 'rgba(74, 124, 111, 0.12)' },
                      },
                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive(item.path) ? 'primary.main' : 'inherit',
                        minWidth: collapsed ? 0 : 40,
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{ fontWeight: isActive(item.path) ? 700 : 500, fontSize: '0.95rem' }}
                        />
                        {adminOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </>
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
              {!collapsed && (
                <Collapse in={adminOpen} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {item.children.map((child) => (
                      <ListItem key={child.path} disablePadding sx={{ position: 'relative' }}>
                        {isExactActive(child.path) && <LaurelIndicator />}
                        <ListItemButton
                          selected={isExactActive(child.path)}
                          onClick={() => navigate(child.path)}
                          sx={{
                            py: 0.75,
                            pl: 5,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(74, 124, 111, 0.08)',
                              borderRight: 'none',
                              '&:hover': { backgroundColor: 'rgba(74, 124, 111, 0.12)' },
                            },
                            '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                          }}
                        >
                          <ListItemIcon sx={{ color: isExactActive(child.path) ? 'primary.main' : 'text.secondary', minWidth: 32 }}>
                            {child.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={child.label}
                            primaryTypographyProps={{ fontWeight: isExactActive(child.path) ? 700 : 400, fontSize: '0.85rem' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          ) : (
            <ListItem key={item.path} disablePadding sx={{ position: 'relative' }}>
              {isActive(item.path) && <LaurelIndicator />}
              <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
                <ListItemButton
                  selected={isActive(item.path)}
                  onClick={() => navigate(item.path)}
                  sx={{
                    py: 1.5,
                    pl: collapsed ? 0 : 3,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(74, 124, 111, 0.08)',
                      borderRight: 'none',
                      '&:hover': {
                        backgroundColor: 'rgba(74, 124, 111, 0.12)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive(item.path) ? 'primary.main' : 'inherit',
                      minWidth: collapsed ? 0 : 40,
                      justifyContent: 'center',
                    }}
                  >
                    {renderNavIcon(item)}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: isActive(item.path) ? 700 : 500,
                        fontSize: '0.95rem',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          )
        )}
      </List>
      <Divider />
      <Box sx={{ p: 1, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <IconButton
          onClick={() => setCollapsed(!collapsed)}
          size="small"
          sx={{
            color: 'primary.main',
            border: '2px solid',
            borderColor: 'primary.main',
            backgroundColor: 'rgba(74, 124, 111, 0.08)',
            boxShadow: '0 0 8px rgba(74, 124, 111, 0.4)',
            '&:hover': {
              backgroundColor: 'rgba(74, 124, 111, 0.16)',
              boxShadow: '0 0 12px rgba(74, 124, 111, 0.6)',
            },
          }}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>
    </Box>
  );

  const transition = 'width 0.2s ease, margin 0.2s ease';

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: '#FFFFFF',
          color: '#2A2A2A',
          transition,
        }}
      >
        <Toolbar sx={{ height: 80 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '1rem',
            }}
          >
            {(() => {
              // Check admin children first for exact match
              const adminItem = navItems.find((i) => i.children);
              if (adminItem) {
                const child = adminItem.children.find((c) => isExactActive(c.path));
                if (child) return `Admin — ${child.label}`;
              }
              return navItems.find((item) => item.path && isActive(item.path))?.label || 'Acta AI';
            })()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <NotificationCenter />
            <Typography
              variant="body2"
              sx={{
                mr: 2,
                fontWeight: 500,
                display: { xs: 'none', md: 'block' },
              }}
            >
              {user?.email}
            </Typography>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                color: 'primary.main',
                border: '2px solid',
                borderColor: 'primary.main',
                p: 0.5,
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {user?.full_name?.[0]?.toUpperCase() || <AccountCircle />}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              PaperProps={{
                sx: { mt: 1 },
              }}
            >
              <MenuItem disabled>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {user?.full_name}
                </Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption">{user?.email}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  navigate('/settings');
                  setAnchorEl(null);
                }}
                sx={{ fontWeight: 500, py: 1.5, px: 2 }}
              >
                Settings
              </MenuItem>
              <MenuItem
                onClick={() => {
                  logout();
                  navigate('/login');
                  setAnchorEl(null);
                }}
                sx={{ fontWeight: 600, py: 1.5, px: 2 }}
              >
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { sm: drawerWidth },
          flexShrink: { sm: 0 },
          transition,
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {mobileDrawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
              transition,
              overflowX: 'hidden',
            },
          }}
          open
        >
          {desktopDrawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '80px',
          minHeight: 'calc(100vh - 80px)',
          bgcolor: 'background.default',
          transition,
        }}
      >
        {isMaintenanceMode && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: 0,
              border: '2px solid #A0522D',
              bgcolor: 'rgba(160, 82, 45, 0.06)',
              '& .MuiAlert-icon': { color: '#A0522D' },
              fontWeight: 600,
            }}
          >
            AI generation is temporarily paused for maintenance. Scheduled runs, content testing, and revisions are disabled.
          </Alert>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
