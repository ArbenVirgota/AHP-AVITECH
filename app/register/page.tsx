'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';

// 🟢 Menggunakan variabel lingkungan terbaru
const API_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export default function RegisterPage() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🟢 State Toggle Tampilkan/Sembunyikan Password
  const [institusi, setInstitusi] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      // 🟢 VALIDASI EKSPLISIT: Pastikan URL Apps Script sudah terkonfigurasi
      if (!API_URL) {
        throw new Error('URL Web App Google Apps Script belum dikonfigurasi di .env.local');
      }

      // 🟢 Menghilangkan pemanggilan sha256, langsung kirim password plain text ke backend
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'registeruser',
          nama: nama.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(), // Mengirim password plain text
          institusi: institusi.trim(),
          status_user: 'fasilitator', 
          tier: 'free',
        }),
      });

      const textRes = await res.text();
      let data;
      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error(`Respons server tidak valid: ${textRes}`);
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Registrasi gagal. Email mungkin sudah terdaftar.');
      }

      // 🟢 KIRIM EMAIL SELAMAT DATANG
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email.trim().toLowerCase(),
            subject: 'Selamat Datang di Platform AHP Avitech',
            textBody: `Halo ${nama}, akun fasilitator Anda berhasil didaftarkan dengan status Free.`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6;">
                <h2 style="color: #1e3a8a;">Halo, ${nama} 👋</h2>
                <p>Terima kasih telah mendaftar di <strong>Platform Riset AHP Avitech</strong>.</p>
                <p>Akun Anda telah aktif dengan status <strong>Free (Fasilitator)</strong> dan berafiliasi dengan institusi <strong>${institusi || '-'}</strong>.</p>
                <p>Silakan masuk melalui halaman login untuk mulai menyusun model dan mengelola proyek riset Anda.</p>
                <br/>
                <p>Salam hormat,<br/><strong>Tim Admin AHP Avitech</strong></p>
              </div>
            `
          })
        });
      } catch (emailErr) {
        console.error('Gagal mengirim email sambutan:', emailErr);
      }

      setMessage('Registrasi berhasil. Akun Anda telah aktif. Silakan lanjut ke halaman login.');
      setNama('');
      setEmail('');
      setPassword('');
      setInstitusi('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat melakukan registrasi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={STYLES.main}>
      <section style={STYLES.card}>
        <div style={STYLES.header}>
          <span style={STYLES.eyebrow}>Pendaftaran Fasilitator</span>
          <h1 style={STYLES.title}>Buat Akun Baru</h1>
          <p style={STYLES.subtitle}>Daftarkan diri Anda untuk mulai mengelola proyek riset AHP secara gratis.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={STYLES.label}>Nama Lengkap *</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama lengkap Anda"
              style={STYLES.input}
              required
            />
          </div>

          <div>
            <label style={STYLES.label}>Alamat Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@domain.com"
              style={STYLES.input}
              required
            />
          </div>

          <div>
            <label style={STYLES.label}>Kata Sandi (Password) *</label>
            {/* 🟢 INPUT KATA SANDI DENGAN TOMBOL TOGGLE SHOW/HIDE */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...STYLES.input, paddingRight: 42 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={STYLES.btnTogglePassword}
                title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label style={STYLES.label}>Asal Institusi / Universitas (Opsional)</label>
            <input
              type="text"
              value={institusi}
              onChange={(e) => setInstitusi(e.target.value)}
              placeholder="Contoh: Universitas XYZ"
              style={STYLES.input}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{
              ...STYLES.btnSubmit,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Memproses Data...' : '🚀 Daftar Sekarang'}
          </button>

          {message && (
            <div style={STYLES.successBox}>
              ✅ {message}
            </div>
          )}
          
          {error && (
            <div style={STYLES.errorBox}>
              ⚠️ {error}
            </div>
          )}

          <div style={STYLES.footerText}>
            Sudah memiliki akun?{' '}
            <Link href="/login" style={STYLES.link}>
              Masuk di sini
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  main: {
    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: '"Inter", "Segoe UI", sans-serif'
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 440,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
  },
  header: {
    textAlign: 'center',
    marginBottom: 28
  },
  eyebrow: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#1e40af',
    background: '#dbeafe',
    padding: '4px 10px',
    borderRadius: 999,
    marginBottom: 12
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: 24,
    fontWeight: 800,
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    fontSize: 13.5,
    color: '#64748b',
    lineHeight: 1.5
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 6
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#f8fafc',
    color: '#0f172a'
  },
  btnTogglePassword: {
    position: 'absolute',
    right: 10,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#64748b',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSubmit: {
    width: '100%',
    padding: '12px 20px',
    background: '#1e3a8a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14.5,
    fontWeight: 700,
    marginTop: 8,
    transition: 'all 0.2s'
  },
  successBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    padding: '10px 14px',
    borderRadius: 8,
    color: '#166534',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 1.4
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    padding: '10px 14px',
    borderRadius: 8,
    color: '#991b1b',
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
    lineHeight: 1.4
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#475569',
    marginTop: 12
  },
  link: {
    color: '#2563eb',
    fontWeight: 700,
    textDecoration: 'none'
  }
};