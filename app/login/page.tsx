'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hashPassword, saveSession } from '@/lib/auth';

const API_URL = 'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

export default function LoginPage() {
  const router = useRouter();

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
      const passwordHash = await hashPassword(password);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'login_user',
          email,
          passwordHash,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Login gagal.');
      }

      saveSession({
        id: String(data?.user_id || data?.id || ''),
        nama: String(data?.nama || ''),
        email: String(data?.email || email),
        status_user: String(data?.status_user || ''),
        institusi: String(data?.institusi || ''),
      });

      setMessage('Login berhasil.');
      router.push('/dashboard');
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
          <p>Gunakan email dan password yang sudah terdaftar.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
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