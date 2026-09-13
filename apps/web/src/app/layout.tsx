import type { Metadata } from 'next';
import './globals.css';
import DevHmrGuard from '@/components/DevHmrGuard';
import ToastContainer from '@/components/ToastContainer';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/context/ThemeContext';
import { DEV_HMR_GUARD_SCRIPT } from '@/lib/dev-hmr-guard-inline';

const SOCIAL_IMAGE = {
  url: '/social/aurora-share-card.png',
  width: 1200,
  height: 630,
  alt: 'Aurora — turn your technical product into an AI-powered salesperson',
};

export const metadata: Metadata = {
  title: 'Aurora',
  description: 'Turn your technical product into an AI-powered salesperson',
  openGraph: {
    title: 'Aurora',
    description: 'Turn your technical product into an AI-powered salesperson',
    images: [SOCIAL_IMAGE],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aurora',
    description: 'Turn your technical product into an AI-powered salesperson',
    images: [SOCIAL_IMAGE.url],
  },
};

const isDev = process.env.NODE_ENV === 'development';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="gtm-theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {isDev && (
          <script
            id="gtm-dev-hmr-guard"
            dangerouslySetInnerHTML={{ __html: DEV_HMR_GUARD_SCRIPT }}
          />
        )}
      </head>
      <body className="min-h-screen antialiased flex flex-col bg-background" suppressHydrationWarning>
        <ThemeProvider>
          <DevHmrGuard />
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
