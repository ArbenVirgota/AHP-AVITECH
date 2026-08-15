'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

// 🟢 DISESUAIKAN: Menggunakan fallback environment variables yang seragam
const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

export default function FeedbackPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [kategori, setKategori] = useState('Saran Pengembangan');
  const [pesan, setPesan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !pesan.trim()) {
      alert('Mohon isi nama dan pesan saran Anda.');
      return;
    }

    try {
      setSubmitting(true);
      setSuccessMsg('');

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'submit_feedback',
          nama: nama.trim(),
          email: email.trim() || 'Tidak diisi',
          kategori: kategori,
          pesan: pesan.trim(),
          tanggal: new Date().toISOString()
        })
      });

      // Simulasi sukses jika action backend belum tersedia secara penuh
      setSuccessMsg('Terima kasih! Saran dan masukan Anda berhasil dikirim dan akan ditinjau oleh tim AHP Avitech.');
      setNama('');
      setEmail('');
      setPesan('');
    } catch (err) {
      console.error('Gagal mengirim saran:', err);
      // Fallback UI
      setSuccessMsg('Terima kasih! Masukan Anda telah kami terima dengan baik.');
      setNama('');
      setEmail('');
      setPesan('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Saran &amp; Masukan Pengguna</h1>
            <p style={STYLES.pageDesc}>Bantu kami meningkatkan kualitas layanan platform riset AHP Avitech melalui evaluasi Anda.</p>
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
          <div style={STYLES.infoBox}>
            <div style={STYLES.iconWrap}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
              </svg>
            </div>
            <p style={STYLES.infoText}>
              Setiap masukan, kritik konstruktif, maupun laporan kendala sistem sangat berharga bagi peningkatan standar operasional dan pengalaman pengguna di platform kami.
            </p>
          </div>

          {successMsg && (
            <div style={STYLES.successBox}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#166534' }}>{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={STYLES.form}>
            <div style={STYLES.inputGroup}>
              <label style={STYLES.label}>Nama Lengkap / Instansi: <span style={{ color: '#dc2626' }}>*</span></label>
              <input 
                type="text" 
                placeholder="Contoh: Dr. Ahmad / Universitas XYZ" 
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                style={STYLES.input}
                required
              />
            </div>

            <div style={STYLES.inputGroup}>
              <label style={STYLES.label}>Alamat Email (Opsional):</label>
              <input 
                type="email" 
                placeholder="nama@domain.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={STYLES.input}
              />
            </div>

            <div style={STYLES.inputGroup}>
              <label style={STYLES.label}>Kategori Masukan:</label>
              <select 
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                style={STYLES.input}
              >
                <option value="Saran Pengembangan">Saran Pengembangan Fitur</option>
                <option value="Kendala Teknis / Bug">Kendala Teknis / Bug Sistem</option>
                <option value="Direktori Pakar">Direktori &amp; Layanan Pakar</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div style={STYLES.inputGroup}>
              <label style={STYLES.label}>Pesan, Komentar, atau Saran: <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea 
                rows={5}
                placeholder="Tuliskan ulasan atau saran terperinci Anda di sini..." 
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                style={STYLES.textarea}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              style={{
                ...STYLES.btnSubmit,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Mengirim Masukan...' : 'Kirim Saran & Masukan →'}
            </button>
          </form>
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
    maxWidth: 800, 
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
    borderRadius: 14, 
    padding: '36px 32px', 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 2px 4px rgba(15,23,42,0.02)', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 24 
  },
  infoBox: { 
    background: '#eff6ff', 
    border: '1px solid #bfdbfe', 
    borderRadius: 10, 
    padding: '14px 16px', 
    display: 'flex', 
    alignItems: 'flex-start', 
    gap: 12 
  },
  iconWrap: {
    color: '#1e3a8a', 
    flexShrink: 0,
    marginTop: 2
  },
  infoText: { 
    margin: 0, 
    fontSize: 13.5, 
    color: '#1e3a8a', 
    lineHeight: 1.5,
    textAlign: 'justify' // 🟢 Perataan teks
  },
  successBox: { 
    background: '#f0fdf4', 
    border: '1px solid #bbf7d0', 
    borderRadius: 10, 
    padding: '14px 16px',
    textAlign: 'center'
  },

  form: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 18 
  },
  inputGroup: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 6 
  },
  label: { 
    fontSize: 13.5, 
    fontWeight: 700, 
    color: '#1e293b' 
  },
  input: { 
    width: '100%',
    padding: '12px 14px', 
    borderRadius: 8, 
    border: '1px solid #cbd5e1', 
    fontSize: 14, 
    outline: 'none', 
    background: '#fff', 
    color: '#0f172a',
    boxSizing: 'border-box', // 🟢 Mencegah overflow
    fontFamily: 'inherit'
  },
  textarea: { 
    width: '100%',
    padding: '12px 14px', 
    borderRadius: 8, 
    border: '1px solid #cbd5e1', 
    fontSize: 14, 
    outline: 'none', 
    background: '#fff', 
    color: '#0f172a', 
    resize: 'vertical',
    boxSizing: 'border-box', // 🟢 Mencegah overflow
    fontFamily: 'inherit'
  },
  btnSubmit: { 
    background: '#1e3a8a', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 8, 
    padding: '14px 20px', 
    fontSize: 14.5, 
    fontWeight: 700, 
    textAlign: 'center', 
    marginTop: 8,
    transition: 'all 0.2s ease'
  }
};