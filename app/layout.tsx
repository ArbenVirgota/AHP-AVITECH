// app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import VisitorTracker from "./visitortracker";

export const metadata: Metadata = {
  title: "Aplikasi AHP - Decision Support System",
  description: "Sistem Pendukung Keputusan Metode Analytic Hierarchy Process (AHP)",
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
        style={{ 
          margin: 0, 
          padding: 0,
          background: '#f8fafc', 
          fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
          color: '#0f172a',
          boxSizing: 'border-box'
        }}
      >
        <VisitorTracker />
        {children}
      </body>
    </html>
  );
}