'use client';

import Link from 'next/link';
import React, { FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (!API_URL) {
        throw new Error('URL Web App Google Apps Script belum dikonfigurasi.');
      }

      const cleanEmail = email.trim().toLowerCase();

      // Meminta backend Apps Script untuk memproses pencarian dan pengiriman email
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'forgotpassword',
          email: cleanEmail
        }),
      });

      const textRes = await res.text();
      let json;
      try {
        json = JSON.parse(textRes);
      } catch {
        throw new Error(`Respons server tidak valid: ${textRes}`);
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Gagal memproses permintaan.');
      }

      setMessage('Instruksi pemulihan kata sandi telah dikirimkan ke email Anda. Silakan periksa kotak masuk atau folder spam.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={STYLES.main}>
      <section style={STYLES.card}>
        <div style={STYLES.header}>
          <span style={STYLES.eyebrow}>Pemulihan Akun</span>
          <h1 style={STYLES.title}>Lupa Kata Sandi?</h1>
          <p style={STYLES.subtitle}>Masukkan email terdaftar Anda, kami akan mengirimkan detail akses akun Anda.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={STYLES.label}>Alamat Email Terdaftar</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@domain.com"
              style={STYLES.input}
              required
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
            {loading ? 'Memproses...' : '📨 Kirim Pemulihan Sandi'}
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
            Sudah ingat kata sandi Anda?{' '}
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
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
  },
  header: { textAlign: 'center', marginBottom: 28 },
  eyebrow: {
    display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#1e40af', background: '#dbeafe', padding: '4px 10px',
    borderRadius: 999, marginBottom: 12
  },
  title: { margin: '0 0 8px 0', fontSize: 24, fontWeight: 800, color: '#0f172a' },
  subtitle: { margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#f8fafc', color: '#0f172a'
  },
  btnSubmit: {
    width: '100%', padding: '12px 20px', background: '#1e3a8a', color: '#ffffff',
    border: 'none', borderRadius: 8, fontSize: 14.5, fontWeight: 700, marginTop: 8
  },
  successBox: {
    background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px',
    borderRadius: 8, color: '#166534', fontSize: 13, fontWeight: 600, textAlign: 'center'
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px',
    borderRadius: 8, color: '#991b1b', fontSize: 13, fontWeight: 600
  },
  footerText: { textAlign: 'center', fontSize: 13, color: '#475569', marginTop: 12 },
  link: { color: '#2563eb', fontWeight: 700, textDecoration: 'none' }
};