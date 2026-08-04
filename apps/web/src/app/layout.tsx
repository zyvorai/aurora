import type { Metadata } from 'next';
import './globals.css';
import DevHmrGuard from '@/components/DevHmrGuard';
import { DEV_HMR_GUARD_SCRIPT } from '@/lib/dev-hmr-guard-inline';

export const metadata: Metadata = {
  title: 'GTM Agent Platform',
  description: 'Turn your technical product into an AI-powered salesperson',
};

const isDev = process.env.NODE_ENV === 'development';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {isDev && (
          <script
            id="gtm-dev-hmr-guard"
            dangerouslySetInnerHTML={{ __html: DEV_HMR_GUARD_SCRIPT }}
          />
        )}
      </head>
      <body className="gradient-mesh min-h-screen antialiased flex flex-col">
        <DevHmrGuard />
        {children}
      </body>
    </html>
  );
}
