import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'U&I Vihana Volunteer attendance',
  description: 'U&I Vihana Centre Single-Centre Volunteer Attendance System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
