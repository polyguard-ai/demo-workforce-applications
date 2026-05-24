import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Apply — Polyguard demo',
  description:
    'Job application page that confirms the candidate’s identity with Polyguard before the form is submitted.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
