// app/expert/consultation-reply/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ConsultationReplyContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticket_id') || '';

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);
  const [jawaban, setJawaban] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!ticketId) {
      setErrorMsg('Parameter ID Tiket (?ticket_id=...) tidak ditemukan pada tautan ini.');
      setLoading(false);
      return;
    }

    fetch(`/api/expert/consultation-reply?ticket_id=${encodeURIComponent(ticketId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setTicket(json.data);
          if (json.data.jawaban_expert) {
            setJawaban(json.data.jawaban_expert);
          }
        } else {
          setErrorMsg(json.message || 'Tiket konsultasi tidak ditemukan.');
        }
      })
      .catch((err) => setErrorMsg(`Gagal memuat tiket: ${err.message}`))
      .finally(() => setLoading(false));
  }, [ticketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jawaban.trim()) {
      alert('Mohon ketikkan jawaban/tanggapan Anda.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const res = await fetch('/api/expert/consultation-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          jawaban_expert: jawaban.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg('✅ Tanggapan Anda telah berhasil disimpan dan langsung diteruskan kepada pemohon riset.');
      } else {
        setErrorMsg(json.message || 'Gagal menyimpan tanggapan.');
      }
    } catch (err: any) {
      setErrorMsg(`Terjadi kendala jaringan: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #bfdbfe', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Memuat formulir konsultasi...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', padding: 24, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Pemberitahuan Sistem</h3>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{errorMsg}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc', padding: '30px 16px', boxSizing: 'border-box' }}>
      
      {/* 🟢 CSS OVERRIDE: Menghilangkan Tombol Menu, Toggle Sidebar, dan Memusatkan Halaman */}
      <style jsx global>{`
        /* Sembunyikan sidebar, drawer, tombol menu toggle, dan tombol navigasi dashboard */
        aside,
        nav,
        button:has(svg),
        button[class*="menu"],
        button[class*="toggle"],
        button[class*="drawer"],
        div[class*="sidebar"],
        div[class*="toggle"],
        .sidebar,
        [data-sidebar="true"] {
          display: none !important;
        }

        /* Target spesifik tombol ☰ Menu dan tombol bulat */
        header button,
        body > div > div > button,
        button[aria-label*="menu" i],
        button[aria-label*="sidebar" i] {
          display: none !important;
        }

        /* Netralkan margin dan padding wrapper dashboard bawaan */
        main,
        div[class*="mainContent"],
        div[class*="layoutWrapper"],
        div[class*="container"] {
          margin: 0 auto !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          transform: none !important;
        }

        body {
          background: #f8fafc !important;
          overflow-x: hidden !important;
        }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto', background: '#ffffff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        
        {/* Header Resmi Portal Pakar */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', padding: '24px 28px', color: '#ffffff' }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: 4, marginBottom: 8, letterSpacing: '0.04em' }}>
            PORTAL EVALUATOR PAKAR
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Ruang Tanggapan &amp; Konsultasi Ilmiah</h1>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, opacity: 0.85 }}>
            Analytic Hierarchy Process (AHP) Decision Support System
          </p>
        </div>

        <div style={{ padding: 28 }}>
          {/* Detail Pemohon (Email Disembunyikan) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                ID Tiket: <strong style={{ color: '#1e3a8a', fontSize: 13 }}>#{ticket?.ticket_id}</strong>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: ticket?.status === 'Selesai' ? '#dcfce7' : '#fef9c3', color: ticket?.status === 'Selesai' ? '#15803d' : '#854d0e' }}>
                Status: {ticket?.status || 'Menunggu'}
              </span>
            </div>

            <div style={{ fontSize: 13.5, color: '#0f172a', fontWeight: 600 }}>
              Nama Pemohon: <strong>{ticket?.user_name}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
              Asal Instansi: <strong>{ticket?.asal_institusi || '-'}</strong>
            </div>
          </div>

          {/* Pertanyaan Riset */}
          <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '14px 18px', borderRadius: '0 8px 8px 0', marginBottom: 24 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.03em' }}>
              💬 Pertanyaan / Topik Riset Pemohon:
            </div>
            <div style={{ fontSize: 13.5, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {ticket?.pertanyaan}
            </div>

            {ticket?.lampiran && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #bfdbfe' }}>
                <a href={ticket.lampiran} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  📎 Lihat Berkas Lampiran Riset →
                </a>
              </div>
            )}
          </div>

          {successMsg ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 18, color: '#166534', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
              <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>Tanggapan Berhasil Dikirim!</strong>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Tanggapan / Jawaban Ilmiah Anda: *
                </label>
                <textarea
                  rows={7}
                  required
                  value={jawaban}
                  onChange={(e) => setJawaban(e.target.value)}
                  placeholder="Ketikkan tanggapan, pandangan ilmiah, atau arahan metodologi AHP Anda untuk pemohon di sini..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', lineHeight: 1.55, fontFamily: 'inherit' }}
                />
              </div>

              {errorMsg && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 12.5 }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                }}
              >
                {submitting ? 'Menyimpan Tanggapan...' : 'Kirim Tanggapan ke Pemohon →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConsultationReplyPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: 13 }}>
        Memuat formulir tanggapan...
      </div>
    }>
      <ConsultationReplyContent />
    </Suspense>
  );
}