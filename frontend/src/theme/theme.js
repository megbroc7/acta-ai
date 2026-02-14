import { createTheme } from '@mui/material/styles';

// Patina — the blue-green oxidation on ancient bronze
const patina = {
  light: '#6B9E8A',
  main: '#4A7C6F',
  dark: '#2D5E4A',
  contrastText: '#FFFFFF',
};

// Bronze — the warm metal underneath
const bronze = {
  light: '#D4A574',
  main: '#B08D57',
  dark: '#8B6914',
  contrastText: '#FFFFFF',
};

const theme = createTheme({
  palette: {
    primary: patina,
    secondary: {
      main: '#2A2A2A',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F0EFEC',  // forum stone — cool travertine
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2A2A2A',
      secondary: '#5C5C5C',
    },
    bronze: bronze,
    success: {
      main: '#4A7C6F',
      light: '#6B9E8A',
      dark: '#2D5E4A',
    },
    warning: {
      main: '#B08D57',
      light: '#D4A574',
      dark: '#8B6914',
    },
    error: {
      main: '#A0522D',  // sienna — earthy red, not neon
      light: '#CD853F',
      dark: '#6B3410',
    },
    divider: '#E0DCD5',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 900,
      fontSize: '4rem',
      letterSpacing: '-0.01em',
      textTransform: 'uppercase',
    },
    h2: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 800,
      fontSize: '3rem',
      letterSpacing: '-0.005em',
      textTransform: 'uppercase',
    },
    h3: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '2.5rem',
      textTransform: 'uppercase',
    },
    h4: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '0.007em',
    },
    h5: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '1.5rem',
    },
    h6: {
      fontFamily: '"Roboto Condensed", "Roboto", sans-serif',
      fontWeight: 700,
      fontSize: '1.25rem',
      letterSpacing: '0.007em',
    },
    subtitle1: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle2: {
      fontWeight: 600,
      fontSize: '0.875rem',
    },
    body1: {
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
    button: {
      fontWeight: 600,
      fontSize: '0.875rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    caption: {
      fontWeight: 500,
      fontSize: '0.75rem',
    },
  },
  shape: {
    borderRadius: 0,  // sharp corners — stone and bronze
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '10px 24px',
          fontWeight: 600,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: `linear-gradient(90deg, transparent, rgba(176, 141, 87, 0.15), transparent)`,
            transition: 'left 0.4s ease',
          },
          '&:hover::after': {
            left: '100%',
          },
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: patina.dark,
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: 'none',
          border: '1px solid #E0DCD5',
          borderTop: `3px solid ${bronze.main}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #E0DCD5',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#E9E8E5',
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          border: 'none',
          height: 1,
          background: `linear-gradient(90deg, ${patina.dark}, ${patina.light}, transparent)`,
          opacity: 0.3,
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: {
          fontWeight: 700,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: '1px solid #E0DCD5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
  },
});

export default theme;
