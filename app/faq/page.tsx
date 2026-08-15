'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: "Bagaimana prosedur akses terhadap direktori pakar secara penuh?",
    answer: "Pengunjung publik dapat meninjau pratinjau awal direktori pakar. Untuk membuka akses penuh beserta informasi kontak kredibel (Email dan WhatsApp), pengguna diwajibkan melakukan autentikasi masuk ke dalam sistem terlebih dahulu."
  },
  {
    question: "Apakah menu Produk & Tools memerlukan registrasi akun?",
    answer: "Tidak. Menu Produk & Tools terbuka secara luas bagi publik untuk mendukung eksplorasi perangkat riset. Fitur daftar tunggu (waitlist) juga disediakan secara terbuka bagi produk yang masih dalam tahap pengembangan."
  },
  {
    question: "Bagaimana tata cara pendaftaran akun bagi peneliti baru?",
    answer: "Calon pengguna dapat mengakses tombol pendaftaran (Daftar Akun) yang tersedia pada sudut kanan atas halaman, kemudian melengkapi informasi kredensial yang diperlukan sesuai standar operasional sistem kami."
  },
  {
    question: "Ke mana saya dapat menyampaikan kendala operasional sistem atau berkonsultasi?",
    answer: "Kendala teknis maupun pertanyaan administratif dapat dikonsultasikan melalui pusat bantuan institusi, menu Saran & Masukan, atau Anda dapat mengajukan tiket konsultasi langsung kepada pakar terkait melalui Direktori Pakar."
  }
];

export default function FaqPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Pertanyaan Umum (FAQ)</h1>
            <p style={STYLES.pageDesc}>Pusat informasi dan panduan prosedural penggunaan layanan platform riset AHP Avitech.</p>
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
              <div style={{ width: 120, height: 36 }} /> // Placeholder saat loading client-side
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FAQ_DATA.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} style={STYLES.faqCard}>
                <div onClick={() => toggleAccordion(idx)} style={STYLES.faqQuestionRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Ikon Tanda Tanya Bulat Formal (SVG) */}
                    <div style={STYLES.iconWrap}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                      </svg>
                    </div>
                    <h3 style={STYLES.faqQuestionText}>{faq.question}</h3>
                  </div>

                  {/* Ikon Chevron Formal */}
                  <svg 
                    width="18" 
                    height="18" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    viewBox="0 0 24 24" 
                    style={{ 
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      color: isOpen ? '#1e3a8a' : '#94a3b8',
                      flexShrink: 0
                    }}
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                
                <div 
                  style={{
                    ...STYLES.faqAnswerWrapper,
                    maxHeight: isOpen ? '500px' : '0px',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div style={STYLES.faqAnswerBox}>
                    <p style={STYLES.faqAnswerText}>{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
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
  
  faqCard: { 
    background: '#fff', 
    borderRadius: 12, 
    border: '1px solid #e2e8f0', 
    overflow: 'hidden', 
    boxShadow: '0 2px 4px rgba(15,23,42,0.02)' 
  },
  faqQuestionRow: { 
    padding: '20px 24px', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    cursor: 'pointer', 
    background: '#ffffff', 
    gap: 16 
  },
  iconWrap: {
    background: '#eff6ff', 
    color: '#1d4ed8', 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    flexShrink: 0
  },
  faqQuestionText: { 
    margin: 0, 
    fontSize: 15.5, 
    fontWeight: 700, 
    color: '#0f172a',
    lineHeight: 1.4
  },
  faqAnswerWrapper: {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden'
  },
  faqAnswerBox: { 
    padding: '0 24px 24px 70px', 
    background: '#ffffff' 
  },
  faqAnswerText: { 
    margin: 0, 
    fontSize: 14, 
    color: '#334155', 
    lineHeight: 1.65,
    textAlign: 'justify' // 🟢 Teks rata kiri-kanan
  }
};