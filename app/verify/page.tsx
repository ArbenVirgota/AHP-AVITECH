// app/verify/page.tsx
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface VerificationData {
  id: string;
  project_id: string;
  project_name: string;
  method: string;
  facilitator_name: string;
  facilitator_email: string;
  facilitator_institution: string;
  total_experts: number;
  rankings: Array<{ name: string; score: number; rank: number }>;
  cr_summary_json?: string;
  crSummary?: Array<{ title: string; cr: number }>;
  verification_token: string;
  verified_url: string;
  created_at: string;
  updated_at: string;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('doc') || searchParams.get('id');
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!docId) {
      setError('Parameter ID Dokumen tidak ditemukan pada tautan.');
      setLoading(false);
      return;
    }

    const fetchVerification = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/reports/verify?doc=${encodeURIComponent(docId)}`, {
          cache: 'no-store',
        });

        // 🟢 Lindungi dari galat parsing jika respons kosong / berformat teks
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const rawText = await res.text();
          throw new Error(rawText || `Layanan mengembalikan status HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.message || 'Dokumen tidak terdaftar dalam basis data audit.');
        }

        // Validasi kesesuaian token keamanan
        if (token && json.data.verification_token && json.data.verification_token !== token) {
          throw new Error('Token keamanan dokumen tidak cocok atau telah kedaluwarsa.');
        }

        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Gagal memverifikasi keabsahan dokumen.');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [docId, token]);

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.card}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <h2 style={{ fontSize: 18, color: '#0f172a', margin: 0 }}>Memverifikasi Dokumen...</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
            Menghubungkan ke basis data audit Analytic Hierarchy Process.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.centerContainer}>
        <div style={{ ...styles.card, borderColor: '#fca5a5' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>❌</div>
          <h2 style={{ fontSize: 18, color: '#b91c1c', margin: 0 }}>Verifikasi Tidak Valid</h2>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 8 }}>
            {error || 'Data laporan tidak ditemukan dalam basis data resmi.'}
          </p>
          <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
            ID Dokumen: <code>{docId || '-'}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        
        {/* Banner Sertifikasi Resmi */}
        <div style={styles.badgeBanner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>🛡️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>
                DOKUMEN RESMI TERVERIFIKASI
              </div>
              <div style={{ fontSize: 11, color: '#15803d' }}>
                Integritas perhitungan dan snapshot metodologis tersimpan valid pada basis data.
              </div>
            </div>
          </div>
          <span style={styles.statusPill}>✓ Sah &amp; Valid</span>
        </div>

        {/* Kartu Informasi Proyek & Fasilitator */}
        <div style={styles.sectionCard}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 12 }}>
            <span style={styles.metaBadge}>{data.method || 'AHP'}</span>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '6px 0 2px' }}>
              {data.project_name}
            </h1>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              ID Dokumen: <code style={{ color: '#0f172a', fontWeight: 700 }}>#{data.id}</code>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <div style={styles.label}>Fasilitator Utama</div>
              <div style={styles.valueText}>{data.facilitator_name || '-'}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{data.facilitator_institution || '-'}</div>
              <div style={{ fontSize: 11, color: '#2563eb' }}>{data.facilitator_email || '-'}</div>
            </div>

            <div>
              <div style={styles.label}>Statistik Responden &amp; Waktu Audit</div>
              <div style={styles.valueText}>{data.total_experts} Responden Pakar</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {data.created_at ? new Date(data.created_at).toLocaleString('id-ID') : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Evaluasi Rasio Konsistensi (Jika Tersedia) */}
        {data.crSummary && data.crSummary.length > 0 && (
          <div style={styles.sectionCard}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Evaluasi Rasio Konsistensi (Consistency Ratio / CR)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.crSummary.map((crItem, idx) => (
                <div key={idx} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                  <span>{crItem.title}</span>
                  <strong style={{ color: crItem.cr <= 0.1 ? '#166534' : '#b45309' }}>
                    CR: {Number(crItem.cr).toFixed(3)} {crItem.cr <= 0.1 ? '✓ (Konsisten)' : '⚠️ (Perlu Evaluasi)'}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabel Hasil Peringkat Prioritas */}
        <div style={styles.sectionCard}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Hasil Sintesis Bobot Prioritas Akhir
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                <th style={{ ...styles.th, width: 60, textAlign: 'center' }}>Rank</th>
                <th style={styles.th}>Alternatif / Elemen Keputusan</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Bobot Skor Sintesis</th>
              </tr>
            </thead>
            <tbody>
              {data.rankings && data.rankings.length > 0 ? (
                data.rankings.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: item.rank === 1 ? '#1e3a8a' : '#f1f5f9',
                          color: item.rank === 1 ? '#fff' : '#334155',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      >
                        #{item.rank || idx + 1}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', fontWeight: 600, color: '#0f172a' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                      {Number(item.score).toFixed(4)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: 12, color: '#94a3b8' }}>
                    Data ranking tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Audit Resmi */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 12 }}>
          Layanan Verifikasi Publik • <strong>AHP Avitech Decision Support System</strong>
          <div>https://ahp.avitech.cloud</div>
        </div>

      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.centerContainer}>
          <div style={styles.card}>Memuat Data Verifikasi...</div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: '24px 16px',
    fontFamily: '"Inter", sans-serif',
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  centerContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: 16,
    fontFamily: '"Inter", sans-serif',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '28px 24px',
    textAlign: 'center',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
  },
  badgeBanner: {
    background: '#dcfce7',
    border: '1.5px solid #86efac',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    background: '#166534',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 700,
  },
  sectionCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
  },
  metaBadge: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  valueText: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#0f172a',
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    color: '#475569',
    fontWeight: 600,
    fontSize: 11,
  },
};