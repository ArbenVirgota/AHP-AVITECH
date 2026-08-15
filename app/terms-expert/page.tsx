// app/terms-expert/page.tsx

'use client';

import React from 'react';

export default function TermsExpertPage() {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '40px 20px', fontFamily: '"Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        
        {/* HEADER */}
        <h1 style={{ color: '#0f172a', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          Syarat &amp; Ketentuan Kolaborasi Pakar
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          Platform Digital Analisis Data AHP Avitech • Terakhir diperbarui: Agustus 2026
        </p>

        {/* KONTEN UTAMA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: '#334155', fontSize: 14, lineHeight: 1.6 }}>
          
          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              1. Pendahuluan
            </h2>
            <p>
              Selamat datang di program Kolaborasi Pakar Platform AHP Avitech. Dokumen ini mengatur landasan partisipasi, hak, serta komitmen profesional bagi para akademisi, peneliti, maupun praktisi yang berkontribusi sebagai Evaluator Pakar (*Expert*) dalam penilaian kuesioner komparasi AHP.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              2. Hak Pakar &amp; E-Sertifikat Penghargaan
            </h2>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <strong>Sertifikat Penghargaan:</strong> Sebagai bentuk apresiasi akademis, Pakar berhak menerima <strong>E-Sertifikat Penghargaan</strong> atas partisipasi dan kontribusi ilmiahnya dalam proyek penelitian yang dievaluasi.
              </li>
              <li>
                <strong>Tanpa Masa Berlaku:</strong> E-Sertifikat Penghargaan yang diterbitkan bersifat permanen (seumur hidup) dan tidak memiliki batas masa berlaku (*no expiration date*).
              </li>
              <li>
                <strong>Publikasi Kredensial &amp; Privilege Account:</strong> Dengan persetujuan Pakar, profil dan rekam jejak kepakaran dapat ditampilkan secara publik pada Direktori Pakar AHP Avitech. Selain itu, Pakar yang berpartisipasi berhak mendapatkan apresiasi akun Plan Pro pada platform.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              3. Ketentuan Finansial &amp; Prospek Pengembangan
            </h2>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <strong>Skema Kolaborasi Saat Ini:</strong> Pada tahap rintisan dan pengembangan platform, partisipasi Pakar bersifat kontribusi akademis non-komersial untuk mendukung validitas riset ilmiah.
              </li>
              <li>
                <strong>Realisasi Finansial Masa Depan:</strong> Kompensasi atau skema komersial/finansial secara khusus akan direalisasikan apabila sistem aplikasi telah dinyatakan komersial, layak secara bisnis, serta memiliki prospek ekosistem yang positif di kemudian hari.
              </li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              4. Perubahan Kesepakatan &amp; Komunikasi Tim Pengembang
            </h2>
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>
                <strong>Penyesuaian Ketentuan:</strong> Syarat dan kesepakatan kerjasama ini bersifat dinamis dan dapat disesuaikan atau diperbarui di masa depan seiring perkembangan kebutuhan riset, regulasi, dan fitur platform.
              </li>
              <li>
                <strong>Saran &amp; Revisi Data:</strong> Apabila terdapat kesalahan penulisan gelar/nama, data yang perlu direvisi, atau hal-hal yang belum tertampung dalam dokumen ini, Pakar dapat langsung menghubungi tim pengembang melalui email resmi:
                <div style={{ marginTop: 6 }}>
                  <a 
                    href="mailto:admin@avitech.cloud" 
                    style={{ 
                      color: '#2563eb', 
                      fontWeight: 700, 
                      textDecoration: 'underline',
                      background: '#eff6ff',
                      padding: '4px 8px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}
                  >
                    ✉️ admin@avitech.cloud
                  </a>
                </div>
              </li>
            </ul>
          </section>

        </div>

        {/* FOOTER ACTION */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <button 
            onClick={() => window.close()} 
            style={{ 
              background: '#0f172a', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 24px', 
              borderRadius: 8, 
              fontWeight: 600, 
              fontSize: 13, 
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            Tutup Halaman Ini
          </button>
        </div>

      </div>
    </div>
  );
}