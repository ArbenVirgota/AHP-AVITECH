// app/login/page.tsx

'use client';

import Link from 'next/link';
import React, { FormEvent, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveSession } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parameter dari redirect verifikasi & registrasi
  const verified = searchParams.get('verified');
  const queryError = searchParams.get('error');
  const registered = searchParams.get('registered');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const cleanPass = password.trim();

      // Memanggil API Route lokal Next.js yang terhubung ke Prisma/MySQL Hostinger
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPass,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Login gagal. Periksa kembali email dan kata sandi Anda.');
      }

      // 1. Bersihkan sesi sebelumnya
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ahp_user_data');
        localStorage.removeItem('user_session');
        localStorage.removeItem('user_token');
        localStorage.removeItem('ahp_session');
        sessionStorage.clear();
      }

      // 2. Simpan identitas user dari database MySQL
      const sessionData = {
        id: String(json.user_id || `USR-${Date.now()}`),
        nama: String(json.name || cleanEmail.split('@')[0]),
        email: cleanEmail,
        status_user: String(json.status_user || 'USER'),
        institusi: String(json.institusi || ''),
        city: String(json.city || ''),
        digital_signature: String(json.digital_signature || '')
      };

      saveSession(sessionData);

      setMessage('Login berhasil! Mengarahkan ke dashboard...');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan saat login.');
      setLoading(false);
    }
  }

  return (
    <section style={STYLES.card}>
      <div style={STYLES.header}>
        <span style={STYLES.eyebrow}>Portal Peneliti &amp; Fasilitator</span>
        <h1 style={STYLES.title}>Masuk ke Ruang Kerja</h1>
        <p style={STYLES.subtitle}>Gunakan email dan kata sandi terdaftar untuk mengelola proyek AHP Anda.</p>
      </div>

      {/* Banner Konfirmasi Verifikasi Email */}
      {verified === 'true' && (
        <div style={STYLES.noticeSuccess}>
          ✅ <strong>Akun Berhasil Diverifikasi!</strong> Email Anda telah aktif. Silakan masuk dengan kata sandi Anda.
        </div>
      )}

      {registered === 'true' && (
        <div style={STYLES.noticeInfo}>
          📧 <strong>Pendaftaran Berhasil!</strong> Tautan verifikasi telah dikirim ke email aktif Anda. Silakan cek kotak masuk/spam sebelum masuk.
        </div>
      )}

      {queryError === 'token_expired' && (
        <div style={STYLES.noticeWarning}>
          ⚠️ <strong>Tautan Kedaluwarsa:</strong> Masa berlaku token verifikasi telah berakhir (24 jam). Silakan hubungi admin atau daftar ulang.
        </div>
      )}

      {(queryError === 'invalid_token' || queryError === 'token_not_found') && (
        <div style={STYLES.noticeWarning}>
          ⚠️ <strong>Token Tidak Valid:</strong> Tautan verifikasi salah atau sudah pernah digunakan sebelumnya.
        </div>
      )}

      {queryError === 'server_error' && (
        <div style={STYLES.noticeWarning}>
          ⚠️ Terjadi kendala saat memverifikasi akun. Silakan coba lagi beberapa saat lagi.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={STYLES.label}>Alamat Email</label>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ ...STYLES.label, marginBottom: 0 }}>Kata Sandi (Password)</label>
            <Link href="/forgot-password" style={STYLES.forgotLink}>
              Lupa kata sandi?
            </Link>
          </div>
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

        <button 
          type="submit" 
          disabled={loading} 
          style={{
            ...STYLES.btnSubmit,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Memverifikasi...' : '🚀 Masuk ke Dashboard'}
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
          Belum memiliki akun ruang kerja?{' '}
          <Link href="/register" style={STYLES.link}>
            Daftar di sini
          </Link>
        </div>
      </form>
    </section>
  );
}

export default function UserLoginPage() {
  return (
    <main style={STYLES.main}>
      <Suspense fallback={<div style={{ color: '#64748b', fontSize: 14 }}>Memuat halaman...</div>}>
        <LoginForm />
      </Suspense>
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
    padding: 20,
    fontFamily: '"Inter", "Segoe UI", sans-serif'
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
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
  forgotLink: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none'
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
  noticeSuccess: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: '#166534',
    marginBottom: 16,
    lineHeight: 1.4
  },
  noticeInfo: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 16,
    lineHeight: 1.4
  },
  noticeWarning: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: '#991b1b',
    marginBottom: 16,
    lineHeight: 1.4
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
    marginTop: 4
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