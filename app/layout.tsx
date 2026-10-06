// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisitorTracker from "@/components/VisitorTracker";
import ConditionalSidebar from "@/components/ConditionalSidebar";

export const metadata: Metadata = {
  title: "Aplikasi AHP - Decision Support System",
  description: "Sistem Pendukung Keputusan Metode Analytic Hierarchy Process (AHP)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Melacak pengunjung di seluruh rute */}
        <VisitorTracker />

        {/* Sidebar hanya dirender di halaman user, ditiadakan pada seluruh rute /expert dan /admin */}
        <ConditionalSidebar />

        {children}
      </body>
    </html>
  );
}