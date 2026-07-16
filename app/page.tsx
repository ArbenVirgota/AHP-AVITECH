'use client';

import Link from 'next/link';

const features = [
  {
    title: 'Pengambilan data eksternal',
    desc: 'Aplikasi dapat terhubung ke backend eksternal seperti Google Apps Script, Google Sheets, atau Supabase melalui fetch ke URL publik.',
  },
  {
    title: 'Alur kerja lebih ringan',
    desc: 'Halaman awal difokuskan untuk pengenalan aplikasi, registrasi, dan login agar lebih sederhana dan mudah dideploy.',
  },
  {
    title: 'Siap untuk hosting statis',
    desc: 'Struktur halaman dibuat client-side friendly sehingga lebih cocok untuk deployment yang stabil di Hostinger.',
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Aplikasi AHP</span>
          <h1>Sistem pendukung keputusan yang lebih mudah diakses dan lebih siap dideploy.</h1>
          <p>
            Halaman ini menjadi pintu masuk aplikasi Anda: memperkenalkan fungsi utama,
            mengarahkan pengguna untuk membuat akun, lalu masuk ke sistem dengan alur yang
            sederhana.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary">Register</Link>
            <Link href="/login" className="btn btn-secondary">Sign In</Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="stat-box">
            <span className="stat-label">Tujuan</span>
            <strong>Deployment yang lebih stabil</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Arsitektur</span>
            <strong>Frontend statis + backend eksternal</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Halaman awal</span>
            <strong>Introduction, Register, Login</strong>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <span className="eyebrow">Ringkasan</span>
          <h2>Apa yang dilakukan aplikasi ini?</h2>
          <p>
            Aplikasi membantu proses analisis keputusan berbasis AHP dengan pengalaman awal yang
            lebih jelas untuk pengguna baru maupun pengguna yang sudah memiliki akun.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}