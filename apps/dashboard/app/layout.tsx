import React from 'react';
import ThemeRegistry from './ThemeRegistry';

export const metadata = {
  title: 'Price Bot Dashboard',
  description: 'Monitor your price alerts and run history',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
