'use client';

import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
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
            default: prefersDarkMode ? '#0f172a' : '#f8fafc',
            paper: prefersDarkMode ? '#1e293b' : '#ffffff',
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
                boxShadow: prefersDarkMode
                  ? '0 1px 3px rgba(0,0,0,0.4)'
                  : '0 1px 3px rgba(0,0,0,0.08)',
              },
            },
          },
        },
      }),
    [prefersDarkMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
