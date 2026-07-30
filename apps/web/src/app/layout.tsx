import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GTM Agent Platform',
  description: 'Turn your technical product into an AI-powered salesperson',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="gradient-mesh min-h-screen antialiased">{children}</body>
    </html>
  );
}
