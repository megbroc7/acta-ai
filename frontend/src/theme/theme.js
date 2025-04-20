import { createTheme } from '@mui/material/styles';

const plantGreen = {
  main: '#4CAF50',
  light: '#6FCF75',
  dark: '#3B8A3E',
  contrastText: '#FFFFFF',
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: plantGreen,
    secondary: {
      main: '#FFFFFF',
      contrastText: '#222222',
    },
    background: {
      default: '#222222',
      paper: '#333333',
    },
    text: {
      primary: '#EEEEEE',
      secondary: '#B0B0B0',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    action: {
      hover: 'rgba(76, 175, 80, 0.08)',
      selected: 'rgba(76, 175, 80, 0.16)',
    },
  },
  typography: {
    fontFamily: '"Roboto Condensed", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 900,
      fontSize: '4rem',
      letterSpacing: '-0.01562em',
      textTransform: 'uppercase',
    },
    h2: {
      fontWeight: 800,
      fontSize: '3rem',
      letterSpacing: '-0.00833em',
      textTransform: 'uppercase',
    },
    h3: {
      fontWeight: 700,
      fontSize: '2.5rem',
      letterSpacing: '0em',
      textTransform: 'uppercase',
    },
    h4: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '0.00735em',
    },
    h5: {
      fontWeight: 700,
      fontSize: '1.5rem',
      letterSpacing: '0em',
    },
    h6: {
      fontWeight: 700,
      fontSize: '1.25rem',
      letterSpacing: '0.0075em',
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
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontWeight: 600,
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: plantGreen.dark,
            boxShadow: '0 0 8px rgba(111, 207, 117, 0.5)',
          },
        },
        containedSecondary: {
          '&:hover': {
            backgroundColor: '#F5F5F5',
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
            boxShadow: '0 0 8px rgba(111, 207, 117, 0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(111, 207, 117, 0.1)',
          backgroundColor: '#333333',
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
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 0,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#2A2A2A',
        },
        body: {
          borderColor: 'rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#333333',
          backgroundImage: 'linear-gradient(rgba(111, 207, 117, 0.03), rgba(111, 207, 117, 0))',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(111, 207, 117, 0.16)',
            '&:hover': {
              backgroundColor: 'rgba(111, 207, 117, 0.24)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
  },
});

export default theme; 