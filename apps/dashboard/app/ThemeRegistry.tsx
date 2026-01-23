'use client';

import { ThemeProvider, createTheme, CssBaseline, GlobalStyles } from '@mui/material';
import { ReactNode, useMemo } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
          primary: {
            main: '#6366f1',
          },
          secondary: {
            main: '#ec4899',
          },
          background: {
            default: 'transparent',
            paper: prefersDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          },
        },
        typography: {
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          h4: {
            fontWeight: 700,
          },
          h6: {
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                backgroundColor: prefersDarkMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.75)',
                border: prefersDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                boxShadow: prefersDarkMode
                  ? '0 8px 32px rgba(0,0,0,0.3)'
                  : '0 8px 32px rgba(0,0,0,0.1)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                backgroundColor: prefersDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                borderBottom: prefersDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                boxShadow: 'none',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                backgroundColor: prefersDarkMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.75)',
              },
            },
          },
          MuiAccordion: {
            styleOverrides: {
              root: {
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                backgroundColor: prefersDarkMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.75)',
                border: prefersDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                '&:before': {
                  display: 'none',
                },
              },
            },
          },
        },
      }),
    [prefersDarkMode]
  );

  // Handle basePath for GitHub Pages deployment
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const globalStyles = (
    <GlobalStyles
      styles={{
        body: {
          backgroundImage: `
            linear-gradient(
              to bottom,
              ${prefersDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(248, 250, 252, 0.8)'},
              ${prefersDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(248, 250, 252, 0.9)'}
            ),
            url('${basePath}/background.jpg')
          `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
      }}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {globalStyles}
      {children}
    </ThemeProvider>
  );
}
