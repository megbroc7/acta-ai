import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  ErrorOutline,
  Warning,
  LinkOff,
  Timer,
  BrokenImage,
  Settings,
  HelpOutline,
} from '@mui/icons-material';
import api from '../../services/api';

const CATEGORY_ICONS = {
  api_rate_limit: <Timer sx={{ fontSize: 20, color: '#B08D57' }} />,
  api_auth: <ErrorOutline sx={{ fontSize: 20, color: '#A0522D' }} />,
  api_quota: <ErrorOutline sx={{ fontSize: 20, color: '#A0522D' }} />,
  api_timeout: <Timer sx={{ fontSize: 20, color: '#B08D57' }} />,
  publish_auth: <LinkOff sx={{ fontSize: 20, color: '#A0522D' }} />,
  publish_connection: <LinkOff sx={{ fontSize: 20, color: '#B08D57' }} />,
  publish_timeout: <Timer sx={{ fontSize: 20, color: '#B08D57' }} />,
  content_error: <Warning sx={{ fontSize: 20, color: '#B08D57' }} />,
  image_error: <BrokenImage sx={{ fontSize: 20, color: '#B08D57' }} />,
  config_error: <Settings sx={{ fontSize: 20, color: '#A0522D' }} />,
  unknown: <HelpOutline sx={{ fontSize: 20, color: '#B08D57' }} />,
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = Math.abs(now - date);
  const minutes = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);

  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const { data: unreadData } = useQuery({
    queryKey: ['notificationsUnreadCount'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.count || 0;

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/?limit=20').then(r => r.data),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount'] });
    },
  });

  const handleClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.action_url) {
      setAnchorEl(null);
      navigate(notification.action_url);
    }
  };

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: 'text.secondary', mr: 1 }}
      >
        <Badge
          badgeContent={unreadCount}
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
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: { xs: '92vw', sm: 380 },
            maxHeight: 480,
            borderRadius: 0,
            border: '1px solid #E0DCD5',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1.5,
            borderBottom: '1px solid #E0DCD5',
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontSize: '0.8rem',
            }}
          >
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={() => markAllReadMutation.mutate()}
              sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'primary.main' }}
            >
              Mark all read
            </Button>
          )}
        </Box>

        {/* List */}
        {notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              No notifications
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {notifications.map((notif, i) => (
              <Box key={notif.id}>
                <ListItem
                  onClick={() => handleClick(notif)}
                  sx={{
                    cursor: notif.action_url ? 'pointer' : 'default',
                    py: 1.5,
                    px: 2,
                    bgcolor: notif.is_read ? 'transparent' : 'rgba(176, 141, 87, 0.06)',
                    '&:hover': { bgcolor: 'rgba(74, 124, 111, 0.06)' },
                    alignItems: 'flex-start',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ mt: 0.5, flexShrink: 0 }}>
                    {CATEGORY_ICONS[notif.category] || CATEGORY_ICONS.unknown}
                  </Box>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: notif.is_read ? 400 : 700, fontSize: '0.85rem' }}
                      >
                        {notif.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                          }}
                        >
                          {notif.message?.split('\n')[0]}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                            {formatRelativeTime(notif.created_at)}
                          </Typography>
                          {notif.action_url && notif.action_label && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'primary.main',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                              }}
                            >
                              {notif.action_label}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {i < notifications.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
