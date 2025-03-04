import { createTheme } from '@mui/material/styles';

const plantGreen = {
  light: '#4CAF50',
  main: '#2E7D32',
  dark: '#1B5E20',
  contrastText: '#FFFFFF',
};

const theme = createTheme({
  palette: {
    primary: plantGreen,
    secondary: {
      main: '#000000',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F5F5F5',
    },
    text: {
      primary: '#000000',
      secondary: '#424242',
    },
  },
  typography: {
    fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
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
          borderRadius: 0,
          padding: '10px 24px',
          fontWeight: 600,
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: plantGreen.dark,
          },
        },
        containedSecondary: {
          '&:hover': {
            backgroundColor: '#333333',
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
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
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
          borderRadius: 4,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #E0E0E0',
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
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#F5F5F5',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#E0E0E0',
        },
      },
    },
  },
});

export default theme; 