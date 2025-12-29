import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Steam Vault Escape',
  description: 'Free your Steam library by playing your unplayed games',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-vault-dark text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
