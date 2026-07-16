'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const API_URL = 'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function RegisterPage() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const passwordHash = await sha256(password);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'registeruser',
          nama,
          email,
          passwordHash,
          institusi,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Registrasi gagal.');
      }

      setMessage('Registrasi berhasil. Silakan lanjut ke halaman login.');
      setNama('');
      setEmail('');
      setPassword('');
      setInstitusi('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat registrasi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-intro">
          <span className="eyebrow">Register</span>
          <h1>Buat akun baru</h1>
          <p>Daftarkan pengguna baru untuk mengakses aplikasi.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Nama lengkap</span>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Institusi</span>
            <input
              value={institusi}
              onChange={(e) => setInstitusi(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Memproses...' : 'Daftar'}
          </button>

          {message ? <p className="feedback success">{message}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <p className="auth-footnote">
            Sudah punya akun? <Link href="/login">Masuk di sini</Link>
          </p>
        </form>
      </section>
    </main>
  );
}