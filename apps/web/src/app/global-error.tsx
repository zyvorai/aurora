'use client';

import { useEffect } from 'react';

// Catches errors in the root layout itself, so it replaces <html>/<body>
// entirely and can't rely on globals.css/ThemeProvider/shared components --
// those may be exactly what's broken. Inline styles only, kept minimal.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
          background: '#ffffff',
          color: '#1d1d1f',
        }}
      >
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '0 24px' }}>
          <p style={{ color: '#0071e3', fontWeight: 600, fontSize: 22, marginBottom: 4 }}>Aurora</p>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6e6e73', marginBottom: 32, lineHeight: 1.47 }}>
            An unexpected error occurred loading the app. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#0071e3',
              color: '#ffffff',
              border: 'none',
              borderRadius: 980,
              padding: '10px 24px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
