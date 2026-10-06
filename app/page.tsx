// app/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // State untuk Modal Formulir Saran & Masukan (Feedback)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    nama: '',
    email: '',
    kategori: 'Umum',
    pesan: '',
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    setIsMounted(true);
    const session = getSession();
    const hasValidUser = Boolean(
      session && 
      typeof session === 'object' && 
      (session.email || session.id || session.user_id || session.userid)
    );
    setIsLoggedIn(hasValidUser);

    // Ambil default email atau nama jika pengunjung sudah login
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('user_email') || localStorage.getItem('admin_email') || '';
      const storedName = localStorage.getItem('user_name') || localStorage.getItem('admin_name') || '';
      if (storedEmail || storedName) {
        setFeedbackForm(prev => ({
          ...prev,
          nama: storedName || prev.nama,
          email: storedEmail || prev.email,
        }));
      }
    }
  }, []);

  const handleOpenFeedbackModal = () => {
    setFeedbackSuccess('');
    setFeedbackError('');
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setFeedbackSuccess('');
    setFeedbackError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      });

      const json = await res.json();

      if (json.success) {
        setFeedbackSuccess('✅ ' + (json.message || 'Terima kasih, masukan Anda berhasil kami terima!'));
        setFeedbackForm({
          nama: '',
          email: '',
          kategori: 'Umum',
          pesan: '',
        });
        setTimeout(() => {
          setIsFeedbackModalOpen(false);
          setFeedbackSuccess('');
        }, 2200);
      } else {
        setFeedbackError('⚠️ ' + (json.message || 'Gagal mengirim masukan.'));
      }
    } catch (err: any) {
      setFeedbackError('⚠️ Gagal terhubung ke server: ' + err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        {/* Header / Navigasi Utama */}
        <header style={STYLES.headerRow}>
          <div style={STYLES.brandBox}>
            <span style={STYLES.brandTitle}>AHP Avitech</span>
          </div>

          <div style={STYLES.navButtons}>
            {isMounted ? (
              isLoggedIn ? (
                <button 
                  type="button"
                  onClick={() => router.push('/dashboard')} 
                  style={STYLES.btnPrimary}
                >
                  🚀 Dashboard Kerja
                </button>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => router.push('/login')} 
                    style={STYLES.btnSecondary}
                  >
                    Masuk
                  </button>
                  <button 
                    type="button"
                    onClick={() => router.push('/register')} 
                    style={STYLES.btnPrimary}
                  >
                    Daftar Akun
                  </button>
                </>
              )
            ) : (
              <div style={{ height: 36, width: 120 }} />
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section style={STYLES.heroSection}>
          <h1 style={STYLES.heroTitle}>Platform Riset AHP &amp; Direktori Pakar Kredibel</h1>
          <p style={STYLES.heroDesc}>
            Fasilitas terpadu untuk pengelolaan instrumen riset metode AHP, validasi pakar profesional, serta kurasi perangkat penunjang akademik secara transparan.
          </p>
          <div style={STYLES.heroActions}>
            <button type="button" onClick={() => router.push('/expert-directory')} style={STYLES.btnHeroAction}>
              Jelajahi Direktori Pakar →
            </button>
            <button type="button" onClick={() => router.push('/products')} style={STYLES.btnHeroAlt}>
              Produk &amp; Tools Riset
            </button>
          </div>
        </section>

        {/* Menu Navigasi Modul Publik Utama */}
        <section style={STYLES.featuresGrid}>
          <div 
            onClick={() => router.push('/expert-directory')} 
            style={STYLES.featureCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={STYLES.iconWrap}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 style={STYLES.cardTitle}>Direktori Pakar</h3>
            <p style={STYLES.cardDesc}>Tinjau daftar rekam jejak pakar dan ajukan tiket konsultasi penelitian Anda secara langsung.</p>
          </div>

          <div 
            onClick={() => router.push('/products')} 
            style={STYLES.featureCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={STYLES.iconWrap}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h3 style={STYLES.cardTitle}>Produk &amp; Tools</h3>
            <p style={STYLES.cardDesc}>Eksplorasi perangkat analitik riset pilihan dan daftar tunggu inovasi akademik terbaru.</p>
          </div>

          <div 
            onClick={() => router.push('/about')} 
            style={STYLES.featureCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={STYLES.iconWrap}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            </div>
            <h3 style={STYLES.cardTitle}>Tentang Kami</h3>
            <p style={STYLES.cardDesc}>Mengenal visi, misi, dan komitmen AHP Avitech dalam ekosistem riset digital.</p>
          </div>

          <div 
            onClick={() => router.push('/faq')} 
            style={STYLES.featureCard}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={STYLES.iconWrap}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </div>
            <h3 style={STYLES.cardTitle}>FAQ (Bantuan)</h3>
            <p style={STYLES.cardDesc}>Temukan jawaban atas prosedur operasional, limit kuota, dan panduan sistem.</p>
          </div>
        </section>

        {/* Footer */}
        <footer style={STYLES.footer}>
          <div style={STYLES.footerLinks}>
            <span onClick={() => router.push('/about')} style={STYLES.footerLink}>Tentang</span>
            <span onClick={() => router.push('/faq')} style={STYLES.footerLink}>FAQ</span>
            <span onClick={() => router.push('/expert-directory')} style={STYLES.footerLink}>Direktori Pakar</span>
            <span onClick={() => router.push('/products')} style={STYLES.footerLink}>Produk &amp; Tools</span>
            {/* Tombol pemicu Modal Formulir Masukan */}
            <span onClick={handleOpenFeedbackModal} style={STYLES.footerLinkActive}>Saran &amp; Masukan</span>
            <span onClick={() => router.push('/admin/login')} style={STYLES.footerAdminLink}>🔒 Portal Admin</span>
          </div>
          <p style={STYLES.footerCopy}>&copy; 2026 AHP Avitech &amp; Direktori Pakar Akademik. Seluruh hak cipta dilindungi.</p>
        </footer>
      </div>

      {/* Modal Formulir Masukan / Feedback Pengunjung */}
      {isFeedbackModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>💬 Saran &amp; Masukan Pengguna</h3>
              <button 
                type="button" 
                onClick={() => setIsFeedbackModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 0, marginBottom: 16 }}>
              Bantu kami menyempurnakan platform analisis AHP. Kritik, saran, atau laporan kendala Anda sangat berharga bagi kami.
            </p>

            {feedbackSuccess && (
              <div style={STYLES.successAlert}>
                {feedbackSuccess}
              </div>
            )}

            {feedbackError && (
              <div style={STYLES.errorAlert}>
                {feedbackError}
              </div>
            )}

            <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Nama Anda</label>
                  <input
                    type="text"
                    placeholder="Nama lengkap (opsional)"
                    value={feedbackForm.nama}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, nama: e.target.value })}
                    style={STYLES.input}
                  />
                </div>
                <div>
                  <label style={STYLES.label}>Email</label>
                  <input
                    type="email"
                    placeholder="nama@email.com (opsional)"
                    value={feedbackForm.email}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                    style={STYLES.input}
                  />
                </div>
              </div>

              <div>
                <label style={STYLES.label}>Kategori Masukan</label>
                <select
                  value={feedbackForm.kategori}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, kategori: e.target.value })}
                  style={STYLES.input}
                >
                  <option value="Fitur">Fitur &amp; Algoritma AHP</option>
                  <option value="Tampilan">Tampilan / UI / UX</option>
                  <option value="Bug / Kendala">Bug / Kendala Teknis</option>
                  <option value="Umum">Umum &amp; Kerjasama</option>
                </select>
              </div>

              <div>
                <label style={STYLES.label}>Pesan / Evaluasi *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tuliskan saran, kritik membangun, atau kendala yang Anda temui..."
                  value={feedbackForm.pesan}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, pesan: e.target.value })}
                  style={{ ...STYLES.input, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  style={STYLES.btnCancel}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  style={STYLES.btnSubmitFeedback}
                >
                  {submittingFeedback ? 'Mengirimkan...' : 'Kirim Masukan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { 
    backgroundImage: 'url("/bg-landingpage.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    minHeight: '100vh', 
    padding: '24px 16px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  container: { maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 },
  headerRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    background: 'rgba(255, 255, 255, 0.9)', 
    padding: '10px 18px', 
    borderRadius: 10, 
    backdropFilter: 'blur(6px)', 
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
  },
  brandBox: { display: 'flex', alignItems: 'center' },
  brandTitle: { fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' },
  navButtons: { display: 'flex', gap: 8, alignItems: 'center' },
  btnSecondary: { background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s' },
  btnPrimary: { background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s' },

  heroSection: { 
    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(29, 78, 216, 0.95) 100%)', 
    borderRadius: 14, 
    padding: '36px 24px', 
    color: '#fff', 
    textAlign: 'center', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: 12, 
    boxShadow: '0 8px 20px -4px rgba(0, 0,0, 0.15)',
    backdropFilter: 'blur(4px)'
  },
  heroTitle: { margin: 0, fontSize: 28, fontWeight: 800, maxWidth: 750, lineHeight: 1.2, letterSpacing: '-0.5px' },
  heroDesc: { margin: 0, fontSize: 14, maxWidth: 620, color: '#f1f5f9', lineHeight: 1.5 },
  heroActions: { display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  btnHeroAction: { background: '#fff', color: '#1e3a8a', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  btnHeroAlt: { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 6, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },

  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  featureCard: { 
    background: 'rgba(255, 255, 255, 0.95)', 
    border: '1px solid #cbd5e1', 
    borderRadius: 10, 
    padding: '16px 18px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 8, 
    cursor: 'pointer', 
    transition: 'all 0.2s ease', 
    boxShadow: '0 4px 10px rgba(15,23,42,0.06)',
    backdropFilter: 'blur(4px)'
  },
  iconWrap: { background: '#eff6ff', color: '#1d4ed8', width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' },
  cardDesc: { margin: 0, fontSize: 12.5, color: '#334155', lineHeight: 1.45 },

  footer: { 
    background: 'rgba(255, 255, 255, 0.9)', 
    border: '1px solid #cbd5e1', 
    borderRadius: 10, 
    padding: '16px 20px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: 10, 
    textAlign: 'center',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
  },
  footerLinks: { display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' },
  footerLink: { fontSize: 13, color: '#334155', cursor: 'pointer', fontWeight: 600, transition: 'color 0.2s' },
  footerLinkActive: { fontSize: 13, color: '#1e3a8a', cursor: 'pointer', fontWeight: 700 },
  footerAdminLink: { fontSize: 13, color: '#dc2626', cursor: 'pointer', fontWeight: 600 },
  footerCopy: { margin: 0, fontSize: 12, color: '#64748b' },

  // Gaya Tambahan untuk Modal Feedback
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
    backdropFilter: 'blur(3px)'
  },
  modalBox: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
    boxSizing: 'border-box'
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 4,
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  btnCancel: {
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnSubmitFeedback: {
    background: '#1e3a8a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer'
  },
  successAlert: {
    background: '#dcfce7',
    color: '#15803d',
    padding: '8px 12px',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 12.5,
    fontWeight: 600
  },
  errorAlert: {
    background: '#fee2e2',
    color: '#b91c1c',
    padding: '8px 12px',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 12.5,
    fontWeight: 600
  }
};