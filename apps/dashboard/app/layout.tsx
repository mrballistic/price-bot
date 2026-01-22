import React from 'react';

export const metadata = {
  title: 'price-bot dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0, padding: 0 }}>
        <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>price-bot dashboard</h1>
          {children}
        </div>
      </body>
    </html>
  );
}
