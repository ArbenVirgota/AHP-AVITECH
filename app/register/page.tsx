// app/register/page.tsx

'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [institusi, setInstitusi] = useState('');
  const [statusUser, setStatusUser] = useState<'student' | 'fasilitator'>('student');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanNama = nama.trim();
      const cleanPass = password.trim();
      const cleanInstitusi = institusi.trim();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nama: cleanNama,
          email: cleanEmail,
          password: cleanPass,
          institusi: cleanInstitusi || (statusUser === 'student' ? 'Universitas / Akademik' : 'Umum'),
          status_user: statusUser,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Registrasi gagal. Email mungkin sudah terdaftar.');
      }

      setMessage(
        data?.message ||
        'Registrasi berhasil! Tautan konfirmasi telah dikirim ke email aktif Anda. Silakan periksa kotak masuk atau spam.'
      );

      setNama('');
      setEmail('');
      setPassword('');
      setInstitusi('');

      setTimeout(() => {
        router.push('/login?registered=true');
      }, 3000);

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
          <span style={STYLES.eyebrow}>
            {statusUser === 'student' ? '🎓 Pendaftaran Student Edition' : '🔬 Pendaftaran General Edition (Riset)'}
          </span>
          <h1 style={STYLES.title}>Buat Akun Baru</h1>
          <p style={STYLES.subtitle}>
            Daftarkan diri Anda untuk mulai mengelola dan menganalisis keputusan AHP.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pilihan Edisi Akun */}
          <div>
            <label style={STYLES.label}>Pilihan Edisi Akun / Penggunaan *</label>
            <select
              value={statusUser}
              onChange={(e) => setStatusUser(e.target.value as 'student' | 'fasilitator')}
              style={STYLES.input}
              required
            >
              <option value="student">🎓 Student Edition (Praktikum &amp; Latihan Akademik)</option>
              <option value="fasilitator">🔬 General Edition / Peneliti (Riset Mandiri)</option>
            </select>
            <span style={{ fontSize: 12, color: '#64748b', marginTop: 5, display: 'block', lineHeight: 1.4 }}>
              {statusUser === 'student'
                ? 'ℹ️ Student Edition: Menggunakan 2 pakar simulasi otomatis untuk latihan AHP tanpa input pakar manual (Retensi data 6 bulan).'
                : 'ℹ️ General Edition: Ditujukan untuk peneliti/fasilitator mandiri dengan izin input pakar responden secara penuh.'}
            </span>
          </div>

          <div>
            <label style={STYLES.label}>Nama Lengkap *</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Andi Pratama"
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
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                style={{ ...STYLES.input, paddingRight: 42 }}
                required
                minLength={6}
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
            <label style={STYLES.label}>
              Asal Universitas / Institusi {statusUser === 'student' ? '(Opsional)' : ''}
            </label>
            <input
              type="text"
              value={institusi}
              onChange={(e) => setInstitusi(e.target.value)}
              placeholder="Contoh: Universitas Mataram"
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
            {loading ? 'Memproses Pendaftaran...' : '🚀 Daftar Sekarang'}
          </button>

          {message && (
            <div style={STYLES.successBox}>
              ✅ {message}
            </div>
          )}
          
          {error && (
            <div style={STYLES.errorBox}>
              ⚠ {error}
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
    marginBottom: 24
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
    padding: '12px 14px',
    borderRadius: 8,
    color: '#166534',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 1.5
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