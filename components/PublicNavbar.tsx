'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PublicNavbar() {
  const router = useRouter();

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        {/* Logo / Brand */}
        <div style={styles.logoArea} onClick={() => router.push('/')}>
          <span style={styles.logoIcon}>🛡️</span>
          <span style={styles.logoText}>RisetPakar Platform</span>
        </div>

        {/* Menu Navigasi Utama */}
        <nav style={styles.navLinks}>
          <Link href="/" style={styles.navItem}>Beranda</Link>
          <Link href="/expert-directory" style={styles.navItem}>Direktori Pakar</Link>
          <Link href="/products" style={styles.navItem}>Produk & Tools</Link>
          <Link href="/about" style={styles.navItem}>Tentang</Link>
          <Link href="/faq" style={styles.navItem}>FAQ</Link>
        </nav>

        {/* Tombol Auth */}
        <div style={styles.authButtons}>
          <button onClick={() => router.push('/login')} style={styles.btnLogin}>
            Masuk
          </button>
          <button onClick={() => router.push('/register')} style={styles.btnRegister}>
            Daftar
          </button>
        </div>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    padding: '12px 24px',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  logoIcon: {
    fontSize: 20,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  navLinks: {
    display: 'flex',
    gap: 24,
    alignItems: 'center',
  },
  navItem: {
    textDecoration: 'none',
    color: '#475569',
    fontSize: 14,
    fontWeight: 600,
    transition: 'color 0.2s',
  },
  authButtons: {
    display: 'flex',
    gap: 12,
  },
  btnLogin: {
    background: 'transparent',
    color: '#2563eb',
    border: '1px solid #2563eb',
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnRegister: {
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
};