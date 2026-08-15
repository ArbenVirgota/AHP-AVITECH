import type { Metadata } from "next";
import "./globals.css";
import VisitorTracker from "./visitortracker"; // 🟢 Arahkan langsung ke app/visitortracker.tsx

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
    <html lang="id">
      <body style={{ margin: 0, background: '#f8fafc', fontFamily: 'Segoe UI, sans-serif' }}>
        
        {/* 🟢 Pelacak Otomatis Rute Kunjungan Pengunjung */}
        <VisitorTracker />

        {/* Header Global dengan Posisi Sticky */}
        <header style={{ 
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'linear-gradient(to right, #ffffff, #ffffff, blue, #ffffff, #ffffff)', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '10px 40px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
        }}>
          {/* Tulisan di Sebelah Kiri */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
              ANALYTIC HIERARCHY PROCESS
            </span>
            <span style={{ fontSize: 20, color: '#64748b' }}>
              Sistem Pendukung Keputusan
            </span>
          </div>

          {/* Logo Tanpa Wadah */}
          <div>
            <img 
              src="/logo.png" 
              alt="Logo Aplikasi" 
              style={{ height: 80, objectFit: 'contain' }} 
            />
          </div>
        </header>

        {/* Konten Utama Halaman */}
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}