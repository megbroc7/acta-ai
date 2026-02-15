import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, IconButton, Chip, Popover, Stack, Button, CircularProgress,
} from '@mui/material';
import { BlockOutlined, Restore as RestoreIcon } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import {
  ChevronLeft, ChevronRight, CalendarMonth, Today as TodayIcon,
  Schedule as ScheduleIcon, Article as PostIcon,
} from '@mui/icons-material';
import api from '../../services/api';

// --- Animations ---
const countUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const ELASTIC = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// --- Date helpers ---
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d) {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

function endOfWeek(d) {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - day));
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --- Event chip styling ---
function getChipStyle(event) {
  if (event.event_type === 'scheduled' && event.is_skipped) {
    return {
      bgcolor: 'transparent',
      color: '#A0A0A0',
      border: '1.5px dashed #C0C0C0',
      borderLeft: '2px dashed #C0C0C0',
      opacity: 0.55,
      textDecoration: 'line-through',
    };
  }
  if (event.event_type === 'scheduled') {
    return {
      bgcolor: '#4A7C6F',
      color: '#fff',
      borderLeft: '2px solid #2D5E4A',
    };
  }
  switch (event.status) {
    case 'published':
      return {
        bgcolor: 'linear-gradient(135deg, #B08D57, #D4A574)',
        background: 'linear-gradient(135deg, #B08D57, #C9A06A)',
        color: '#fff',
        borderLeft: '2px solid #8A6D3B',
      };
    case 'pending_review':
      return {
        bgcolor: 'rgba(176, 141, 87, 0.08)',
        color: '#B08D57',
        border: '1px solid #B08D57',
        borderLeft: '2px solid #B08D57',
      };
    case 'rejected':
      return {
        bgcolor: 'rgba(160, 82, 45, 0.06)',
        color: '#A0522D',
        border: '1px solid rgba(160, 82, 45, 0.4)',
        borderLeft: '2px solid #A0522D',
      };
    default: // draft
      return {
        bgcolor: '#F0EDE8',
        color: '#6B6560',
        borderLeft: '2px solid #D0CCC5',
      };
  }
}

function getChipLabel(event) {
  if (event.event_type === 'scheduled') {
    return event.predicted_topic || 'Scheduled';
  }
  return event.title || 'Untitled';
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Small decorative laurel SVG for the header
function LaurelDivider() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 1 }}>
      <Box sx={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #B08D57)' }} />
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
        <path d="M10 2C7.5 4 5.5 6 5 8.5c-.3 1.5 0 2.8.5 4 .3-1 .8-2 1.5-2.8C6.2 11 5.8 12.2 5.8 13.5h1.5c0-1.2.7-2.5 1.5-3.2.8.7 1.5 2 1.5 3.2h1.5c0-1.3-.5-2.5-1.2-3.8.7.8 1.2 1.8 1.5 2.8.5-1.2.8-2.5.5-4C12.5 6 10.5 4 10 2z" fill="#B08D57"/>
      </svg>
      <Box sx={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #B08D57, transparent)' }} />
    </Box>
  );
}

export default function ContentCalendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  const gridStart = startOfWeek(startOfMonth(currentMonth));
  const gridEnd = endOfWeek(endOfMonth(currentMonth));

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', formatDate(gridStart), formatDate(gridEnd)],
    queryFn: () =>
      api.get('/schedules/calendar', {
        params: { start: formatDate(gridStart), end: formatDate(gridEnd) },
      }).then(r => r.data),
  });

  const skipMutation = useMutation({
    mutationFn: ({ scheduleId, date }) =>
      api.post(`/schedules/${scheduleId}/skip`, { date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const unskipMutation = useMutation({
    mutationFn: ({ scheduleId, date }) =>
      api.delete(`/schedules/${scheduleId}/skip`, { data: { date } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const eventsByDay = useMemo(() => {
    const map = {};
    if (!data?.events) return map;
    for (const event of data.events) {
      const d = new Date(event.date);
      const key = toKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [data]);

  const gridDays = useMemo(() => {
    const days = [];
    let d = gridStart;
    while (d <= gridEnd) {
      days.push(new Date(d));
      d = addDays(d, 1);
    }
    // Pad to complete the last week (next multiple of 7)
    while (days.length % 7 !== 0) {
      days.push(addDays(days[days.length - 1], 1));
    }
    return days;
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const totalScheduled = data?.events?.filter(e => e.event_type === 'scheduled').length || 0;
  const totalPosts = data?.events?.filter(e => e.event_type === 'post').length || 0;

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  const handleDayClick = (event, dayKey) => {
    if (eventsByDay[dayKey]?.length) {
      setAnchorEl(event.currentTarget);
      setSelectedDayKey(dayKey);
    }
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setSelectedDayKey(null);
  };

  const selectedEvents = selectedDayKey ? (eventsByDay[selectedDayKey] || []) : [];

  return (
    <Box>
      {/* Page title */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 800,
          textTransform: 'uppercase',
          mb: 0.5,
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -4,
            left: 0,
            width: '100%',
            height: 3,
            bgcolor: 'primary.main',
          },
        }}
      >
        Content Calendar
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, mb: 2 }}>
        Your content timeline across all campaigns — past dispatches and future runs at a glance.
      </Typography>

      {/* Calendar container — shared border for nav + grid + legend */}
      <Box sx={{ border: '1px solid #E0DCD5', overflow: 'hidden' }}>

      {/* Month navigation bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          px: 2.5,
          background: 'linear-gradient(135deg, #2D5E4A 0%, #4A7C6F 50%, #3D6E5F 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            onClick={prevMonth}
            size="small"
            sx={{
              color: '#fff',
              transition: `transform 0.2s ${ELASTIC}`,
              '&:hover': { transform: 'scale(1.2)', bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ChevronLeft />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              minWidth: 240,
              textAlign: 'center',
              color: '#fff',
              fontSize: '1.1rem',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            {MONTH_NAMES[currentMonth.getMonth()]} &middot; {currentMonth.getFullYear()}
          </Typography>
          <IconButton
            onClick={nextMonth}
            size="small"
            sx={{
              color: '#fff',
              transition: `transform 0.2s ${ELASTIC}`,
              '&:hover': { transform: 'scale(1.2)', bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <ChevronRight />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Mini stats */}
          {!isLoading && (totalScheduled > 0 || totalPosts > 0) && (
            <Box sx={{ display: 'flex', gap: 2, mr: 1 }}>
              {totalScheduled > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ScheduleIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                    {totalScheduled} upcoming
                  </Typography>
                </Box>
              )}
              {totalPosts > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PostIcon sx={{ fontSize: 14, color: '#D4A574' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                    {totalPosts} post{totalPosts !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<TodayIcon sx={{ fontSize: 16 }} />}
            onClick={goToday}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.04em',
              py: 0.4,
              '&:hover': {
                borderColor: '#fff',
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            Today
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10, borderTop: '1px solid #E0DCD5' }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : (
        <>
          {/* Unified calendar grid (header + day cells) */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              animation: `${fadeIn} 0.3s ease-out`,
            }}
          >
            {/* Day-of-week header cells */}
            {DAY_NAMES.map((d, i) => (
              <Box
                key={d}
                sx={{
                  py: 1,
                  textAlign: 'center',
                  bgcolor: '#F5F2ED',
                  borderRight: i < 6 ? '1px solid #E0DCD5' : 'none',
                  borderBottom: '1px solid #E0DCD5',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontSize: '0.65rem',
                    color: '#8A857E',
                  }}
                >
                  {d}
                </Typography>
              </Box>
            ))}

            {/* Day cells */}
            {gridDays.map((day, idx) => {
              const key = toKey(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              // Outside-month cells: render empty filler to keep grid aligned
              if (!isCurrentMonth) {
                return (
                  <Box
                    key={key}
                    sx={{
                      minHeight: 110,
                      borderRight: (idx % 7) < 6 ? '1px solid #E0DCD5' : 'none',
                      borderBottom: idx < (gridDays.length - 7) ? '1px solid #E0DCD5' : 'none',
                      bgcolor: 'rgba(0,0,0,0.015)',
                    }}
                  />
                );
              }

              const dayEvents = eventsByDay[key] || [];
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const maxChips = 3;
              const overflow = dayEvents.length - maxChips;
              const hasEvents = dayEvents.length > 0;

              return (
                <Box
                  key={key}
                  onClick={(e) => handleDayClick(e, key)}
                  sx={{
                    minHeight: 110,
                    borderRight: (idx % 7) < 6 ? '1px solid #E0DCD5' : 'none',
                    borderBottom: idx < (gridDays.length - 7) ? '1px solid #E0DCD5' : 'none',
                    p: 0.75,
                    bgcolor: isToday
                      ? 'rgba(74, 124, 111, 0.04)'
                      : isWeekend
                        ? 'rgba(0,0,0,0.01)'
                        : 'transparent',
                    cursor: hasEvents ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    '&:hover': hasEvents ? {
                      bgcolor: 'rgba(74, 124, 111, 0.06)',
                      boxShadow: 'inset 0 0 0 1px rgba(74, 124, 111, 0.2)',
                    } : {},
                    // Today left accent
                    ...(isToday && {
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: 'linear-gradient(180deg, #4A7C6F, #6B9E8A)',
                      },
                    }),
                    animation: `${countUp} 0.3s ease-out`,
                    animationDelay: `${Math.floor(idx / 7) * 40 + (idx % 7) * 15}ms`,
                    animationFillMode: 'both',
                  }}
                >
                  {/* Day number */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: isToday ? 800 : 600,
                        fontSize: isToday ? '0.8rem' : '0.72rem',
                        width: 26,
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        bgcolor: isToday ? '#4A7C6F' : 'transparent',
                        color: isToday ? '#fff' : '#5A554E',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {day.getDate()}
                    </Typography>
                    {hasEvents && (
                      <Box sx={{ display: 'flex', gap: 0.3 }}>
                        {dayEvents.some(e => e.event_type === 'scheduled' && !e.is_skipped) && (
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4A7C6F' }} />
                        )}
                        {dayEvents.some(e => e.event_type === 'scheduled' && e.is_skipped) && (
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', border: '1px dashed #C0C0C0' }} />
                        )}
                        {dayEvents.some(e => e.event_type === 'post') && (
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#B08D57' }} />
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Event chips */}
                  <Stack spacing={0.4}>
                    {dayEvents.slice(0, maxChips).map((event, i) => {
                      const style = getChipStyle(event);
                      const isPost = event.event_type === 'post';
                      return (
                        <Box
                          key={i}
                          onClick={(e) => {
                            if (isPost && event.post_id) {
                              e.stopPropagation();
                              navigate(`/posts/${event.post_id}`);
                            }
                          }}
                          sx={{
                            px: 0.6,
                            py: 0.25,
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: isPost ? 'pointer' : 'default',
                            transition: `all 0.2s ${ELASTIC}`,
                            '&:hover': isPost ? {
                              transform: 'translateX(2px)',
                              filter: 'brightness(1.1)',
                            } : {},
                            ...style,
                          }}
                        >
                          {getChipLabel(event)}
                        </Box>
                      );
                    })}
                    {overflow > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.58rem',
                          color: '#4A7C6F',
                          fontWeight: 700,
                          pl: 0.5,
                          letterSpacing: '0.02em',
                        }}
                      >
                        +{overflow} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>

          {/* Legend bar */}
          <Box
            sx={{
              display: 'flex',
              gap: 2.5,
              flexWrap: 'wrap',
              p: 1.5,
              px: 2,
              bgcolor: '#F5F2ED',
              borderTop: '1px solid #E0DCD5',
            }}
          >
            {[
              { label: 'Scheduled', color: '#4A7C6F', filled: true },
              { label: 'Skipped', color: '#C0C0C0', filled: false, dashed: true },
              { label: 'Published', color: '#B08D57', filled: true },
              { label: 'Pending Review', color: '#B08D57', filled: false },
              { label: 'Draft', color: '#D0CCC5', filled: true },
              { label: 'Rejected', color: '#A0522D', filled: false },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '2px',
                    bgcolor: item.filled ? item.color : 'transparent',
                    border: !item.filled ? `1.5px ${item.dashed ? 'dashed' : 'solid'} ${item.color}` : 'none',
                    flexShrink: 0,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#8A857E',
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Empty state */}
          {data?.events?.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8, animation: `${fadeIn} 0.5s ease-out` }}>
              <CalendarMonth
                sx={{
                  fontSize: 72,
                  color: '#B08D57',
                  animation: `${float} 3s ease-in-out infinite`,
                  mb: 2,
                  filter: 'drop-shadow(0 4px 8px rgba(176, 141, 87, 0.3))',
                }}
              />
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4A7C6F' }}
              >
                No dispatches on the calendar
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                Activate a schedule to see future content runs appear here.
              </Typography>
              <LaurelDivider />
            </Box>
          )}
        </>
      )}

      </Box>{/* end calendar container */}

      {/* Day detail popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 0,
              border: '1px solid #D0CCC5',
              borderTop: '3px solid #4A7C6F',
              p: 0,
              minWidth: 300,
              maxWidth: 380,
              maxHeight: 420,
              overflow: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        {selectedDayKey && (
          <>
            {/* Popover header */}
            <Box
              sx={{
                p: 2,
                pb: 1.5,
                bgcolor: '#F5F2ED',
                borderBottom: '1px solid #E0DCD5',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#4A7C6F',
                  fontSize: '0.8rem',
                }}
              >
                {new Date(selectedDayKey + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Typography>
              <Typography variant="caption" sx={{ color: '#8A857E' }}>
                {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <Stack spacing={0} sx={{ p: 1 }}>
              {selectedEvents.map((event, i) => {
                const style = getChipStyle(event);
                const accentColor = style.bgcolor === 'transparent'
                  || style.bgcolor?.startsWith('rgba')
                  || style.bgcolor?.startsWith('linear')
                  ? (style.color || '#E0DCD5')
                  : style.bgcolor;
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      m: 0.5,
                      borderLeft: `3px solid ${accentColor}`,
                      bgcolor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'rgba(74, 124, 111, 0.04)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip
                        label={
                          event.event_type === 'scheduled' && event.is_skipped
                            ? 'SKIPPED'
                            : event.event_type === 'scheduled'
                              ? 'SCHEDULED'
                              : (event.status || 'draft').toUpperCase().replace('_', ' ')
                        }
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          borderRadius: 0,
                          letterSpacing: '0.03em',
                          ...(event.is_skipped
                            ? { bgcolor: 'rgba(160, 160, 160, 0.1)', color: '#A0A0A0', border: '1px dashed #C0C0C0' }
                            : style),
                        }}
                      />
                      <Typography variant="caption" sx={{ color: '#8A857E', fontWeight: 500 }}>
                        {formatTime(event.date)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        mb: 0.5,
                        color: event.is_skipped ? '#A0A0A0' : '#2A2A2A',
                        lineHeight: 1.4,
                        textDecoration: event.is_skipped ? 'line-through' : 'none',
                      }}
                    >
                      {event.event_type === 'scheduled' ? event.predicted_topic : event.title}
                    </Typography>
                    {event.schedule_name && (
                      <Typography variant="caption" sx={{ color: '#8A857E', display: 'block', fontSize: '0.68rem' }}>
                        via <span style={{ fontWeight: 600 }}>{event.schedule_name}</span>
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                      {event.site_name && (
                        <Chip
                          label={event.site_name}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.58rem',
                            fontWeight: 600,
                            borderRadius: 0,
                            bgcolor: 'rgba(74, 124, 111, 0.08)',
                            color: '#4A7C6F',
                            border: '1px solid rgba(74, 124, 111, 0.15)',
                          }}
                        />
                      )}
                      {event.site_platform && (
                        <Typography variant="caption" sx={{ color: '#B0A99F', textTransform: 'capitalize', fontSize: '0.62rem' }}>
                          {event.site_platform}
                        </Typography>
                      )}
                    </Box>
                    {event.event_type === 'post' && event.post_id && (
                      <Button
                        size="small"
                        onClick={() => {
                          handleClosePopover();
                          navigate(`/posts/${event.post_id}`);
                        }}
                        sx={{
                          mt: 1,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          letterSpacing: '0.04em',
                          p: 0,
                          minWidth: 0,
                          color: '#4A7C6F',
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        View Post
                      </Button>
                    )}
                    {/* Skip / Restore button for scheduled events */}
                    {event.event_type === 'scheduled' && !event.is_skipped && (
                      <Button
                        size="small"
                        startIcon={<BlockOutlined sx={{ fontSize: 14 }} />}
                        disabled={skipMutation.isPending || unskipMutation.isPending}
                        onClick={() => {
                          const dateStr = event.date.substring(0, 10);
                          skipMutation.mutate({ scheduleId: event.schedule_id, date: dateStr });
                        }}
                        sx={{
                          mt: 1,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          letterSpacing: '0.04em',
                          p: 0,
                          minWidth: 0,
                          color: '#A0522D',
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        Skip This Run
                      </Button>
                    )}
                    {event.event_type === 'scheduled' && event.is_skipped && (
                      <Button
                        size="small"
                        startIcon={<RestoreIcon sx={{ fontSize: 14 }} />}
                        disabled={skipMutation.isPending || unskipMutation.isPending}
                        onClick={() => {
                          const dateStr = event.date.substring(0, 10);
                          unskipMutation.mutate({ scheduleId: event.schedule_id, date: dateStr });
                        }}
                        sx={{
                          mt: 1,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          letterSpacing: '0.04em',
                          p: 0,
                          minWidth: 0,
                          color: '#4A7C6F',
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </>
        )}
      </Popover>
    </Box>
  );
}
