'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default function AboutPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Menandai bahwa komponen sudah di-render di client (mencegah hydration mismatch)
    setIsMounted(true);

    // Memeriksa validitas data sesi user
    const session = getSession();
    const hasValidUser = Boolean(
      session && 
      typeof session === 'object' && 
      (session.email || session.id || session.user_id || session.userid)
    );

    setIsLoggedIn(hasValidUser);
  }, []);

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Tentang AHP Avitech</h1>
            <p style={STYLES.pageDesc}>Mengenal lebih dekat visi, misi, dan komitmen institusional platform dalam ekosistem akademik.</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => router.push('/')} style={STYLES.btnSecondary}>
              ← Beranda Utama
            </button>
            
            {/* Hanya render tombol aksi jika komponen sudah di-mount */}
            {isMounted ? (
              isLoggedIn ? (
                <button type="button" onClick={() => router.push('/dashboard')} style={STYLES.btnPrimaryAction}>
                  🚀 Dashboard Kerja
                </button>
              ) : (
                <button type="button" onClick={() => router.push('/login')} style={STYLES.btnPrimaryAction}>
                  Masuk ke Akun
                </button>
              )
            ) : (
              <div style={{ width: 120, height: 36 }} /> // Placeholder saat loading
            )}
          </div>
        </div>

        <div style={STYLES.cardContent}>
          {/* Blok Visi: Ikon Dokumen/Prinsip Formal */}
          <div style={STYLES.sectionBlock}>
            <div style={STYLES.iconBox}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <h3 style={STYLES.sectionTitle}>Visi Institusional</h3>
              <p style={STYLES.text}>
                Menjadi ekosistem kolaborasi riset dan direktori pakar terdepan yang mempertemukan akademisi, peneliti, dan praktisi guna menghasilkan inovasi sistem pendukung keputusan (SPK) serta validasi ilmiah yang kredibel dan akuntabel.
              </p>
            </div>
          </div>

          {/* Blok Misi: Ikon Lencana/Pilar Formal */}
          <div style={STYLES.sectionBlock}>
            <div style={STYLES.iconBox}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
              </svg>
            </div>
            <div>
              <h3 style={STYLES.sectionTitle}>Misi Utama</h3>
              <ul style={STYLES.list}>
                <li style={{ marginBottom: 6 }}>Menyediakan direktori pakar profesional yang transparan dan terverifikasi untuk kebutuhan validasi penelitian ilmiah lintas disiplin.</li>
                <li style={{ marginBottom: 6 }}>Memfasilitasi tata kelola proyek riset metode <em>Analytical Hierarchy Process</em> (AHP) secara terstruktur, mulai dari pengujian instrumen hingga evaluasi metrik konsistensi.</li>
                <li style={{ marginBottom: 6 }}>Mengkurasi perangkat, piranti lunak, dan instrumen penunjang produktivitas akademik yang relevan bagi kemajuan sivitas akademika.</li>
              </ul>
            </div>
          </div>

          {/* Blok Kenapa Memilih Kami: Ikon Timbangan/Kredibilitas */}
          <div style={STYLES.sectionBlock}>
            <div style={STYLES.iconBox}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006 0M6 7l3 9M6 7l6-2m6 2l3-1m0 0l-3 9a5.002 5.002 0 01-6 0m6-9l3 9m0 0l-6-2m-6 2l3-1m-3 1l3-1m-3 1l3-1"/>
              </svg>
            </div>
            <div>
              <h3 style={STYLES.sectionTitle}>Standar Layanan &amp; Komitmen</h3>
              <p style={STYLES.text}>
                Platform AHP Avitech dikembangkan dengan menjunjung tinggi kepatuhan terhadap kaidah ilmiah, perlindungan privasi responden, keamanan data terenkripsi, serta tata kelola antarmuka profesional. Kami berkomitmen penuh untuk memelihara integritas penelitian dan mempercepat proses sintesis keputusan yang kompleks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { 
    background: '#f8fafc', 
    minHeight: '100vh', 
    padding: '40px 20px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  container: { 
    maxWidth: 900, 
    margin: '0 auto', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 28 
  },
  headerRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    flexWrap: 'wrap', 
    gap: 16 
  },
  pageTitle: { 
    margin: 0, 
    fontSize: 28, 
    fontWeight: 800, 
    color: '#0f172a',
    letterSpacing: '-0.5px'
  },
  pageDesc: { 
    margin: '6px 0 0', 
    color: '#475569', 
    fontSize: 14.5 
  },
  btnSecondary: { 
    background: '#fff', 
    color: '#0f172a', 
    border: '1px solid #cbd5e1', 
    borderRadius: 8, 
    padding: '10px 18px', 
    cursor: 'pointer', 
    fontWeight: 600, 
    fontSize: 13.5,
    transition: 'all 0.2s ease'
  },
  btnPrimaryAction: { 
    background: '#1e3a8a', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 8, 
    padding: '10px 18px', 
    cursor: 'pointer', 
    fontWeight: 600, 
    fontSize: 13.5,
    transition: 'all 0.2s ease'
  },
  
  cardContent: { 
    background: '#fff', 
    borderRadius: 16, 
    padding: '36px 32px', 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 4px 15px rgba(15,23,42,0.03)', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 32 
  },
  sectionBlock: { 
    display: 'flex', 
    gap: 20, 
    alignItems: 'flex-start' 
  },
  iconBox: { 
    background: '#eff6ff', 
    color: '#1d4ed8', 
    padding: 14, 
    borderRadius: 10, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexShrink: 0 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 700, 
    color: '#0f172a', 
    margin: '0 0 10px 0' 
  },
  text: { 
    margin: 0, 
    fontSize: 14.5, 
    color: '#334155', 
    lineHeight: 1.65,
    textAlign: 'justify' // 🟢 Perataan teks rata kiri-kanan
  },
  list: { 
    margin: 0, 
    paddingLeft: 22, 
    fontSize: 14.5, 
    color: '#334155', 
    lineHeight: 1.65, 
    display: 'flex', 
    flexDirection: 'column', 
    textAlign: 'justify' // 🟢 Perataan teks daftar (list) rata kiri-kanan
  }
};