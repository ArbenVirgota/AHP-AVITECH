'use client';

import Link from 'next/link';

const features = [
  {
    title: 'Analisis lebih terarah',
    desc: 'Membantu pengguna memahami alur awal aplikasi AHP dengan tampilan yang rapi, ringan, dan mudah diakses.',
  },
  {
    title: 'Siap terhubung backend',
    desc: 'Struktur frontend tetap sederhana, tetapi siap dihubungkan ke Google Apps Script, Supabase, atau layanan API lain.',
  },
  {
    title: 'Cocok untuk hosting statis',
    desc: 'Halaman dibangun agar tetap nyaman digunakan pada deployment statis seperti Hostinger.',
  },
];

const highlights = [
  { label: 'Mode aplikasi', value: 'Frontend statis modern' },
  { label: 'Akses awal', value: 'Landing, login, register' },
  { label: 'Tujuan', value: 'Alur lebih sederhana' },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Aplikasi AHP</span>
          <h1>Sistem pendukung keputusan dengan tampilan yang lebih modern dan bersih.</h1>
          <p>
            Halaman ini menjadi pintu masuk aplikasi untuk memperkenalkan fungsi utama,
            mengarahkan pengguna membuat akun, lalu masuk ke sistem dengan pengalaman
            yang lebih nyaman dan profesional.
          </p>

          <div className="hero-actions">
            <Link href="/register" className="btn btn-primary">
              Daftar Sekarang
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Masuk
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          {highlights.map((item) => (
            <div className="stat-box" key={item.label}>
              <span className="stat-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <span className="eyebrow">Ringkasan</span>
          <h2>Apa yang dilakukan aplikasi ini?</h2>
          <p>
            Aplikasi membantu proses analisis keputusan berbasis AHP dengan tampilan awal
            yang lebih jelas untuk pengguna baru maupun pengguna yang sudah memiliki akun.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}