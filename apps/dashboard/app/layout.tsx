/**
 * @fileoverview Root layout component for the Next.js dashboard app.
 *
 * Sets up the HTML document structure and wraps children with the
 * ThemeRegistry for MUI theming support. This is a server component
 * that handles the base layout for all pages.
 *
 * @module dashboard/layout
 */

import React from 'react';
import ThemeRegistry from './ThemeRegistry';

/**
 * Page metadata for SEO and browser tabs.
 */
export const metadata = {
  title: 'Price Bot Dashboard',
  description: 'Monitor your price alerts and run history',
};

/**
 * Root layout component wrapping all pages.
 *
 * Provides the HTML structure and theme context for the entire application.
 * Uses suppressHydrationWarning to prevent React hydration warnings from
 * browser extensions that modify the DOM.
 *
 * @param props - Component props
 * @param props.children - Page content to render
 * @returns Rendered HTML document structure
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
