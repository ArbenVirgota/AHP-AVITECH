'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const API_URL = 'https://example.com/login';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Login gagal.');
      }

      setMessage(data?.message || 'Login berhasil. Anda bisa arahkan ke dashboard setelah ini.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-intro">
          <span className="eyebrow">Sign In</span>
          <h1>Masuk ke aplikasi</h1>
          <p>
            Gunakan akun Anda untuk masuk ke sistem. Setelah backend final tersedia,
            Anda hanya perlu mengganti endpoint login dan menyesuaikan responsnya.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          {message ? <p className="feedback success">{message}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <p className="auth-footnote">
            Belum punya akun? <Link href="/register">Daftar di sini</Link>
          </p>
        </form>
      </section>
    </main>
  );
}