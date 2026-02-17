// Shared color constants for admin charts — matches Acta AI design system
export const CHART_COLORS = {
  patina: '#4A7C6F',
  patinaLight: '#6B9E8A',
  patinaDark: '#2D5E4A',
  bronze: '#B08D57',
  bronzeLight: '#D4A574',
  sienna: '#A0522D',
  stone: '#E0DCD5',
  stoneLight: '#FAF8F5',
  text: '#2A2A2A',
  textSecondary: '#6B6B6B',
};

export const CHART_FONT = {
  fontFamily: '"Inter", sans-serif',
  fontSize: 12,
};

export const STATUS_COLORS = {
  draft: CHART_COLORS.stone,
  pending_review: CHART_COLORS.bronze,
  published: CHART_COLORS.patina,
  rejected: CHART_COLORS.sienna,
};
