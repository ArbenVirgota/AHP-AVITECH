// app/panduan/page.tsx

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PanduanAhpPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'alur' | 'teori' | 'kasus'>('alur');

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        
        {/* HEADER */}
        <div style={STYLES.headerRow}>
          <div>
            <span style={STYLES.eyebrow}>Pusat Pengetahuan</span>
            <h1 style={STYLES.pageTitle}>Panduan Penggunaan &amp; Teori AHP</h1>
            <p style={STYLES.pageDesc}>
              Pelajari alur sistem, dasar teori Analytic Hierarchy Process (AHP), dan berbagai contoh penerapannya di berbagai bidang keilmuan.
            </p>
          </div>
          <button onClick={() => router.push('/dashboard')} style={STYLES.btnBack}>
            ← Kembali ke Dashboard
          </button>
        </div>

        {/* TAB NAVIGASI */}
        <div style={STYLES.tabContainer}>
          <button 
            onClick={() => setActiveTab('alur')} 
            style={activeTab === 'alur' ? STYLES.tabActive : STYLES.tabInactive}
          >
            1. Alur Penggunaan Aplikasi
          </button>
          <button 
            onClick={() => setActiveTab('teori')} 
            style={activeTab === 'teori' ? STYLES.tabActive : STYLES.tabInactive}
          >
            2. Konsep &amp; Teori Dasar AHP
          </button>
          <button 
            onClick={() => setActiveTab('kasus')} 
            style={activeTab === 'kasus' ? STYLES.tabActive : STYLES.tabInactive}
          >
            3. Contoh Kasus Multi-Disiplin
          </button>
        </div>

        {/* KONTEN TAB 1: ALUR APLIKASI */}
        {activeTab === 'alur' && (
          <div style={STYLES.contentBox}>
            <h2 style={STYLES.sectionTitle}>Alur Kerja Sistem Berdasarkan Halaman</h2>
            <p style={STYLES.sectionSubtitle}>Langkah demi langkah menggunakan platform ini dari awal hingga penerbitan hasil.</p>

            <div style={STYLES.stepList}>
              <div style={STYLES.stepCard}>
                <div style={STYLES.stepNumber}>1</div>
                <div>
                  <h3 style={STYLES.stepTitle}>Halaman Dashboard &amp; Profil</h3>
                  <p style={STYLES.stepDesc}>
                    Sebelum memulai, Anda wajib melengkapi **Profil** (Institusi, Kota) dan mengunggah **Tanda Tangan Digital (.png transparan)**. Tanda tangan ini berfungsi sebagai stempel pengesahan pada saat sistem menerbitkan E-Sertifikat untuk pakar/responden Anda.
                  </p>
                </div>
              </div>

              <div style={STYLES.stepCard}>
                <div style={STYLES.stepNumber}>2</div>
                <div>
                  <h3 style={STYLES.stepTitle}>Halaman Buat Proyek Baru</h3>
                  <p style={STYLES.stepDesc}>
                    Buat ruang kerja (*workspace*) riset Anda. Tentukan: <br/>
                    • <strong>Tujuan (Goal)</strong>: Masalah yang ingin diselesaikan.<br/>
                    • <strong>Kriteria</strong>: Parameter penilaian (contoh: Biaya, Kualitas).<br/>
                    • <strong>Alternatif</strong>: Pilihan keputusan yang akan dirangking.
                  </p>
                </div>
              </div>

              <div style={STYLES.stepCard}>
                <div style={STYLES.stepNumber}>3</div>
                <div>
                  <h3 style={STYLES.stepTitle}>Halaman Direktori Pakar &amp; Distribusi</h3>
                  <p style={STYLES.stepDesc}>
                    Penilaian AHP harus dilakukan oleh ahli/responden. Anda bisa menyalin tautan (URL) kuesioner proyek Anda dan membagikannya secara mandiri (via WhatsApp), atau menggunakan menu **Direktori Pakar** untuk mencari ahli terverifikasi dan mengirimkan tiket permohonan konsultasi kepada mereka.
                  </p>
                </div>
              </div>

              <div style={STYLES.stepCard}>
                <div style={STYLES.stepNumber}>4</div>
                <div>
                  <h3 style={STYLES.stepTitle}>Halaman Pengisian Kuesioner (Pakar)</h3>
                  <p style={STYLES.stepDesc}>
                    Pakar yang menerima tautan Anda akan membandingkan elemen-elemen riset secara berpasangan (Pairwise Comparison) menggunakan skala 1 hingga 9 tanpa perlu mendaftar akun.
                  </p>
                </div>
              </div>

              <div style={STYLES.stepCard}>
                <div style={STYLES.stepNumber}>5</div>
                <div>
                  <h3 style={STYLES.stepTitle}>Halaman Kelola Proyek (Hasil &amp; Sertifikat)</h3>
                  <p style={STYLES.stepDesc}>
                    Pantau progres pakar. Sistem akan secara otomatis menghitung matriks, mengecek Konsistensi (CR), dan menggabungkan pendapat banyak pakar menggunakan metode **Geometric Mean**. Di sini, Anda dapat mengunduh hasil akhir dan menerbitkan **E-Sertifikat Apresiasi** untuk pakar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KONTEN TAB 2: TEORI AHP */}
        {activeTab === 'teori' && (
          <div style={STYLES.contentBox}>
            <h2 style={STYLES.sectionTitle}>Konsep &amp; Teori Dasar AHP</h2>
            <p style={STYLES.sectionSubtitle}>Memahami cara kerja matematis di balik layar Analytic Hierarchy Process oleh Thomas L. Saaty.</p>

            <div style={STYLES.gridTheory}>
              <div style={STYLES.theoryCard}>
                <div style={STYLES.theoryIcon}>📐</div>
                <h3 style={STYLES.theoryTitle}>1. Dekomposisi Hierarki</h3>
                <p style={STYLES.theoryDesc}>
                  AHP menyederhanakan masalah rumit menjadi struktur 3 level: <strong>Tujuan (Goal)</strong> di puncak, diikuti oleh <strong>Kriteria / Subkriteria</strong> di level menengah, dan <strong>Alternatif</strong> di level paling bawah.
                </p>
              </div>

              <div style={STYLES.theoryCard}>
                <div style={STYLES.theoryIcon}>⚖️</div>
                <h3 style={STYLES.theoryTitle}>2. Skala Saaty (1-9)</h3>
                <p style={STYLES.theoryDesc}>
                  Penilaian dilakukan secara berpasangan (*Pairwise*). Skala yang digunakan: <br/>
                  <strong>1</strong>: Sama penting.<br/>
                  <strong>3</strong>: Sedikit lebih penting.<br/>
                  <strong>5</strong>: Jelas lebih penting.<br/>
                  <strong>7</strong>: Sangat jelas lebih penting.<br/>
                  <strong>9</strong>: Mutlak lebih penting.
                </p>
              </div>

              <div style={STYLES.theoryCard}>
                <div style={STYLES.theoryIcon}>🎯</div>
                <h3 style={STYLES.theoryTitle}>3. Rasio Konsistensi (CR)</h3>
                <p style={STYLES.theoryDesc}>
                  Manusia bisa tidak konsisten. Jika A &gt; B, dan B &gt; C, maka A harus &gt; C. Sistem mengukur anomali ini melalui Consistency Ratio (CR). Data dianggap valid secara ilmiah jika nilai <strong>CR ≤ 0.10 (Maksimal 10%)</strong>.
                </p>
              </div>

              <div style={STYLES.theoryCard}>
                <div style={STYLES.theoryIcon}>🤝</div>
                <h3 style={STYLES.theoryTitle}>4. Agregasi Geometric Mean</h3>
                <p style={STYLES.theoryDesc}>
                  Dalam riset yang melibatkan banyak pakar, AHP menyatukan perbedaan pendapat mereka menggunakan rumus <strong>Rata-rata Geometrik (Geometric Mean)</strong>, menghasilkan satu matriks konsensus yang *robust* (tangguh).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KONTEN TAB 3: CONTOH KASUS */}
        {activeTab === 'kasus' && (
          <div style={STYLES.contentBox}>
            <h2 style={STYLES.sectionTitle}>Contoh Kasus AHP Lintas Disiplin Ilmu</h2>
            <p style={STYLES.sectionSubtitle}>Referensi penerapan AHP pada berbagai bidang penelitian.</p>

            <div style={STYLES.gridCases}>
              
              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🌱</span> Lingkungan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Penentuan Lokasi Tempat Pembuangan Akhir (TPA).<br/><br/>
                  <strong>Kriteria:</strong> Jarak dari pemukiman, Kondisi hidrogeologi, Aksesibilitas jalan.<br/><br/>
                  <strong>Alternatif:</strong> Lokasi A (Bukit), Lokasi B (Lembah), Lokasi C (Pinggiran).
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🤝</span> Sosial</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Prioritas Penentuan Penerima Bantuan Sosial.<br/><br/>
                  <strong>Kriteria:</strong> Tingkat pendapatan, Jumlah tanggungan anak, Kondisi fisik rumah.<br/><br/>
                  <strong>Alternatif:</strong> Keluarga X, Keluarga Y, Keluarga Z.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>📈</span> Ekonomi</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Pemilihan Strategi Pemasaran UMKM.<br/><br/>
                  <strong>Kriteria:</strong> Biaya operasional, Jangkauan pasar, Potensi konversi penjualan.<br/><br/>
                  <strong>Alternatif:</strong> Iklan Media Sosial, Iklan Cetak, Promosi Diskon Langsung.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🧬</span> Biologi / Kesehatan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Pemilihan Spesies Bio-Indikator Pencemaran Air.<br/><br/>
                  <strong>Kriteria:</strong> Sensitivitas terhadap racun, Kemudahan identifikasi, Kelimpahan populasi.<br/><br/>
                  <strong>Alternatif:</strong> Makrobentos A, Fitoplankton B, Ikan Spesies C.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🌲</span> Kehutanan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Strategi Rehabilitasi Lahan Hutan Kritis.<br/><br/>
                  <strong>Kriteria:</strong> Dampak ekologi (laju tutupan), Manfaat ekonomi lokal, Kemudahan teknis penanaman.<br/><br/>
                  <strong>Alternatif:</strong> Sistem Agroforestri, Reboisasi Murni, Pembangunan Hutan Tanaman.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🐟</span> Perikanan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Penentuan Lokasi Optimal Budidaya Tambak Udang.<br/><br/>
                  <strong>Kriteria:</strong> Kualitas salinitas air, Jarak ke pasar/pabrik, Potensi ancaman banjir/gelombang.<br/><br/>
                  <strong>Alternatif:</strong> Zona Teluk Utara, Zona Pesisir Selatan, Zona Muara Sungai.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🐄</span> Peternakan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Pemilihan Bibit Unggul Sapi Potong.<br/><br/>
                  <strong>Kriteria:</strong> Kecepatan pertambahan bobot, Resistensi terhadap iklim tropis, Harga beli bibit.<br/><br/>
                  <strong>Alternatif:</strong> Sapi Brahman, Sapi Limousin, Sapi Bali.
                </div>
              </div>

              <div style={STYLES.caseCard}>
                <div style={STYLES.caseHeader}><span style={{fontSize: 20}}>🎓</span> Keguruan / Pendidikan</div>
                <div style={STYLES.caseBody}>
                  <strong>Tujuan:</strong> Pemilihan Metode Pembelajaran Paling Efektif saat Pandemi/Daring.<br/><br/>
                  <strong>Kriteria:</strong> Tingkat pemahaman siswa, Ketersediaan infrastruktur/kuota, Alokasi waktu guru.<br/><br/>
                  <strong>Alternatif:</strong> Project-Based Learning, Diskusi Interaktif (Zoom), Ceramah Video Rekaman.
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { 
    background: '#f8fafc', 
    minHeight: '100vh', 
    paddingBottom: 40,
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  container: { 
    maxWidth: 1040, 
    margin: '0 auto', 
    padding: '32px 20px' 
  },
  headerRow: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32
  },
  eyebrow: { 
    display: 'inline-block', 
    background: '#dbeafe', 
    color: '#1e40af', 
    padding: '4px 12px', 
    borderRadius: 999, 
    fontSize: 11, 
    fontWeight: 800, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 10
  },
  pageTitle: { 
    margin: 0, 
    fontSize: 28, 
    fontWeight: 800, 
    color: '#0f172a' 
  },
  pageDesc: { 
    margin: '8px 0 0 0', 
    fontSize: 14, 
    color: '#475569', 
    maxWidth: 600, 
    lineHeight: 1.5 
  },
  btnBack: { 
    background: '#fff', 
    color: '#1e293b', 
    border: '1px solid #cbd5e1', 
    padding: '8px 16px', 
    borderRadius: 8, 
    fontSize: 13, 
    fontWeight: 600, 
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  tabContainer: {
    display: 'flex',
    gap: 8,
    borderBottom: '2px solid #e2e8f0',
    marginBottom: 24,
    overflowX: 'auto',
    whiteSpace: 'nowrap'
  },
  tabActive: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid #2563eb',
    color: '#2563eb',
    fontSize: 14.5,
    fontWeight: 700,
    padding: '12px 16px',
    cursor: 'pointer'
  },
  tabInactive: {
    background: 'none',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#64748b',
    fontSize: 14.5,
    fontWeight: 600,
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'color 0.2s'
  },
  contentBox: {
    background: '#fff',
    borderRadius: 16,
    padding: 32,
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  },
  sectionTitle: { margin: '0 0 4px 0', fontSize: 20, fontWeight: 800, color: '#0f172a' },
  sectionSubtitle: { margin: '0 0 24px 0', fontSize: 13.5, color: '#64748b' },
  
  stepList: { display: 'flex', flexDirection: 'column', gap: 16 },
  stepCard: { 
    display: 'flex', 
    gap: 16, 
    alignItems: 'flex-start', 
    background: '#f8fafc', 
    padding: 20, 
    borderRadius: 12, 
    border: '1px solid #e2e8f0' 
  },
  stepNumber: { 
    background: '#2563eb', 
    color: '#fff', 
    width: 36, 
    height: 36, 
    borderRadius: '50%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: 16, 
    fontWeight: 800, 
    flexShrink: 0 
  },
  stepTitle: { margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#1e293b' },
  stepDesc: { margin: 0, fontSize: 13.5, color: '#475569', lineHeight: 1.6 },

  gridTheory: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
  theoryCard: { padding: 20, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' },
  theoryIcon: { fontSize: 32, marginBottom: 12 },
  theoryTitle: { margin: '0 0 8px 0', fontSize: 15, fontWeight: 800, color: '#1e3a8a' },
  theoryDesc: { margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.6 },

  gridCases: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  caseCard: { border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  caseHeader: { background: '#f1f5f9', padding: '12px 16px', fontWeight: 800, color: '#334155', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 },
  caseBody: { padding: '16px', fontSize: 13, color: '#475569', background: '#fff' }
};