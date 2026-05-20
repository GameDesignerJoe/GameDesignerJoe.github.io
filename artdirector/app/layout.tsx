import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Art Style Compass',
  description: 'AI-driven interactive style discovery for game pitch decks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
