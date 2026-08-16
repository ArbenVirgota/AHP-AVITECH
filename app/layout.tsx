// app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import VisitorTracker from "./visitortracker";

export const metadata: Metadata = {
  title: "Aplikasi AHP",
  description: "Sistem Pendukung Keputusan AHP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body 
        suppressHydrationWarning 
        style={{ margin: 0, background: '#f8fafc', fontFamily: 'Segoe UI, sans-serif' }}
      >
        <VisitorTracker />
        {children}
      </body>
    </html>
  );
}