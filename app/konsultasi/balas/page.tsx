'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

function ReplyFormContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticket_id') || searchParams.get('ticketId') || '';
  const userEmailQuery = searchParams.get('email') || searchParams.get('user_email') || '';

  const [jawabanText, setJawabanText] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [userEmail, setUserEmail] = useState(userEmailQuery);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId) {
      alert('ID Tiket tidak ditemukan.');
      return;
    }
    if (!jawabanText.trim()) {
      alert('Mohon isi tanggapan Anda terlebih dahulu.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      // 🟢 Payload diselaraskan dengan rute backend & nama kolom di tab ConsultationRequests
      const payload = {
        action: 'replyconsultation', // Menggunakan aksi rute utama
        ticket_id: ticketId,
        ticketId: ticketId,
        idTiket: ticketId,
        status: 'Selesai',
        jawaban_expert: jawabanText.trim(), // Kunci utama untuk kolom jawaban_expert
        jawabanExpert: jawabanText.trim(),  // Duplikasi kunci pengaman
        fileUrl: fileUrl.trim(),
        file_url: fileUrl.trim()
      };

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow' // 🟢 Mengatasi kendala CORS redirect Google Apps Script
      });

      const json = JSON.parse(await res.text());

      if (json && json.success) {
        const targetEmail = userEmail || json.userEmail || json.email || json.kontakUser;
        if (targetEmail && targetEmail.includes('@')) {
          try {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'admin@avitech.cloud',
                to: targetEmail.trim(),
                subject: `💬 Tanggapan Konsultasi Pakar - Tiket #${ticketId}`,
                textBody: `Halo, pakar telah memberikan tanggapan untuk tiket konsultasi #${ticketId}:\n\n${jawabanText.trim()}\n\n${fileUrl ? 'Lampiran File: ' + fileUrl : ''}`,
                htmlBody: `
                  <div style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #1e3a8a; margin-top: 0;">💬 Tanggapan Konsultasi Pakar</h2>
                    <p>Tiket ID: <strong>#${ticketId}</strong></p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; color: #0f172a;">
                      <p style="white-space: pre-wrap; margin: 0; font-style: italic;">${jawabanText.trim().replace(/\n/g, '<br/>')}</p>
                      ${fileUrl ? `
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                          <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="background: #eff6ff; color: #1d4ed8; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
                            📎 Unduh Berkas Lampiran Pakar
                          </a>
                        </div>
                      ` : ''}
                    </div>
                    <br/>
                    <p style="font-size: 12px; color: #64748b;">*Email ini di-generate secara otomatis oleh sistem. Mohon tidak membalas langsung ke alamat email admin ini.</p>
                    <p>Salam hangat,<br/><strong>Tim Admin AHP Avitech</strong></p>
                  </div>
                `
              })
            });
          } catch (emailErr) {
            console.error('Gagal mengirim email tanggapan via Hostinger:', emailErr);
          }
        }

        setSubmitted(true);
      } else {
        setErrorMsg(json.message || 'Gagal menyimpan tanggapan ke sistem.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan koneksi saat mengirim tanggapan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={STYLES.card}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ color: '#16a34a', margin: '0 0 8px 0', fontSize: 22 }}>Tanggapan Berhasil Terkirim!</h2>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
            Terima kasih atas waktu dan dedikasi Anda. Jawaban telah tersimpan langsung di tabel <strong>ConsultationRequests</strong> dan diteruskan secara otomatis ke pengguna melalui <strong>admin@avitech.cloud</strong> demi menjaga privasi Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={STYLES.card}>
      <h2 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: 22, fontWeight: 800 }}>💬 Balasan Konsultasi</h2>
      <p style={{ color: '#64748b', fontSize: 13.5, margin: '0 0 16px 0' }}>
        Tiket Konsultasi ID: <strong style={{ color: '#2563eb' }}>#{ticketId || 'Tidak Ada Tiket'}</strong>
      </p>

      {/* INFO BOX PRIVASI */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.5 }}>
        🔒 <strong>Privasi Terjaga:</strong> Identitas dan email pribadi Anda tidak akan diekspos kepada pengguna. Balasan ini akan dikirim melalui sistem *email relay* AHP Avitech.
      </div>

      {!ticketId ? (
        <div style={STYLES.errorBox}>
          ⚠️ Parameter ID Tiket tidak ditemukan pada tautan ini.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errorMsg && <div style={STYLES.errorBox}>{errorMsg}</div>}

          {!userEmail && (
            <div>
              <label style={STYLES.label}>Email Pengguna (Penerima) *</label>
              <input
                type="email"
                placeholder="emailpengguna@domain.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                style={STYLES.input}
                required
              />
            </div>
          )}

          <div>
            <label style={STYLES.label}>Jawaban / Tanggapan Resmi Pakar *</label>
            <textarea
              rows={7}
              placeholder="Tuliskan saran, jawaban, arahan metode, atau tanggapan Anda untuk pengguna di sini..."
              value={jawabanText}
              onChange={(e) => setJawabanText(e.target.value)}
              style={STYLES.textarea}
              required
            />
          </div>

          <div>
            <label style={STYLES.label}>Tautan File Lampiran / Google Drive (Opsional)</label>
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              style={STYLES.input}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...STYLES.btnSubmit,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {submitting ? 'Mengirim Tanggapan...' : '🚀 Kirim Jawaban ke Pengguna'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function BalasKonsultasiPage() {
  return (
    <div style={STYLES.page}>
      <Suspense fallback={<div style={{ color: '#0f172a', textAlign: 'center', padding: 40, fontFamily: 'sans-serif' }}>Memuat halaman balasan...</div>}>
        <ReplyFormContent />
      </Suspense>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: {
    background: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: '"Inter", "Segoe UI", sans-serif'
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    padding: 32,
    width: '100%',
    maxWidth: 600,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
  },
  label: {
    display: 'block', 
    fontWeight: 700, 
    fontSize: 13, 
    color: '#334155', 
    marginBottom: 6
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13.5,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#fff'
  },
  textarea: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    outline: 'none',
    lineHeight: 1.5,
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#fff'
  },
  btnSubmit: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 20px',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    padding: 12,
    borderRadius: 8,
    color: '#991b1b',
    fontSize: 13,
    fontWeight: 600
  }
};