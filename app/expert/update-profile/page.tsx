// app/expert/update/page.tsx (atau sesuaikan dengan lokasi file Anda)

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

function UpdateExpertProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expertId = searchParams.get('id') || searchParams.get('expert_id') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State merujuk pada header tab experts
  const [formData, setFormData] = useState({
    expert_id: expertId,
    gelar_depan: '',
    expert_name: '',
    gelar_belakang: '',
    expert_email: '',
    expert_whatsapp: '',
    asal_instansi: '',
    pendidikan_terakhir: '',
    bidang_keahlian: '',
    durasi_pengalaman: '',
    foto_url: '',
    portofolio_url: '',
    ktp_url: ''
  });

  useEffect(() => {
    if (!expertId) {
      setErrorMsg('ID Pakar tidak ditemukan pada tautan ini.');
      setLoading(false);
      return;
    }

    fetchExpertData();
  }, [expertId]);

  const fetchExpertData = async () => {
    if (!GOOGLE_SCRIPT_URL) {
      setErrorMsg('URL Google Apps Script belum dikonfigurasi.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getexpertdirectory`, { cache: 'no-store' });
      const json = await res.json();

      if (json && json.success && Array.isArray(json.data)) {
        const found = json.data.find((exp: any) => {
          const eId = exp.expert_id || exp.expertId || exp.id;
          return String(eId).trim() === String(expertId).trim();
        });

        if (found) {
          setFormData({
            expert_id: expertId,
            gelar_depan: String(found.gelar_depan || found.gelardepan || ''),
            expert_name: String(found.expert_name || found.expertname || found.nama || ''),
            gelar_belakang: String(found.gelar_belakang || found.gelarbelakang || ''),
            expert_email: String(found.expert_email || found.expertemail || found.email || ''),
            expert_whatsapp: String(found.expert_whatsapp || found.expertwhatsapp || found.whatsapp || ''),
            asal_instansi: String(found.asal_instansi || found.asalinstansi || found.instansi || ''),
            pendidikan_terakhir: String(found.pendidikan_terakhir || found.pendidikanterakhir || found.pendidikan || ''),
            bidang_keahlian: String(found.bidang_keahlian || found.bidangkeahlian || found.keahlian || ''),
            durasi_pengalaman: String(found.durasi_pengalaman || found.durasipengalaman || found.pengalaman || ''),
            foto_url: String(found.foto_url || found.fotoUrl || found.foto || ''),
            portofolio_url: String(found.portofolio_url || found.portofolioUrl || found.portofolio || ''),
            ktp_url: String(found.ktp_url || found.ktpUrl || found.ktp || '')
          });
        } else {
          setErrorMsg(`Data pakar dengan ID #${expertId} tidak ditemukan di sistem.`);
        }
      } else {
        setErrorMsg('Gagal memuat data direktori pakar.');
      }
    } catch (err: any) {
      setErrorMsg(`Kesalahan jaringan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'foto_url' | 'portofolio_url' | 'ktp_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('⚠️ Ukuran berkas terlalu besar (Maksimal 500 KB).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, [fieldName]: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.expert_name.trim() || !formData.bidang_keahlian.trim()) {
      alert('Nama Lengkap dan Bidang Keahlian wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        action: 'saveexpert',
        source: 'expert_update_page',
        ...formData
      };

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const json = JSON.parse(await res.text());
      if (json && json.success) {
        setSuccessMsg('✅ Profil Anda berhasil diperbarui dan tersimpan di sistem!');
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setErrorMsg(json.message || 'Gagal menyimpan pembaruan profil.');
      }
    } catch (err: any) {
      setErrorMsg(`Kesalahan koneksi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={STYLES.page}>
      {/* 🟢 CSS GLOBAL: Menyembunyikan sidebar dan merentangkan halaman secara full-screen */}
      <style jsx global>{`
        aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        body, html, main, div[class*="layout"], div[class*="wrapper"] {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
      `}</style>

      <div style={STYLES.card}>
        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: 22, fontWeight: 800 }}>
          📝 Perbarui Profil Pakar
        </h2>
        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 13.5 }}>
          ID Pakar: <strong style={{ color: '#2563eb' }}>#{expertId}</strong>
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontWeight: 600 }}>Memuat data profil pakar...</div>
        ) : errorMsg && !formData.expert_name ? (
          <div style={STYLES.errorBox}>
            <p style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>{errorMsg}</p>
            <button onClick={() => router.push('/')} style={STYLES.btnBack}>← Kembali ke Beranda</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {successMsg && <div style={STYLES.successBox}>{successMsg}</div>}
            {errorMsg && <div style={STYLES.errorBox}>{errorMsg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
              <div>
                <label style={STYLES.label}>Gelar Depan</label>
                <input
                  type="text"
                  placeholder="Dr. / Prof."
                  value={formData.gelar_depan}
                  onChange={e => setFormData({ ...formData, gelar_depan: e.target.value })}
                  style={STYLES.input}
                />
              </div>
              <div>
                <label style={STYLES.label}>Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama tanpa gelar"
                  value={formData.expert_name}
                  onChange={e => setFormData({ ...formData, expert_name: e.target.value })}
                  style={STYLES.input}
                />
              </div>
              <div>
                <label style={STYLES.label}>Gelar Belakang</label>
                <input
                  type="text"
                  placeholder="M.Si. / Ph.D."
                  value={formData.gelar_belakang}
                  onChange={e => setFormData({ ...formData, gelar_belakang: e.target.value })}
                  style={STYLES.input}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={STYLES.label}>Email Aktif</label>
                <input
                  type="email"
                  placeholder="pakar@email.com"
                  value={formData.expert_email}
                  onChange={e => setFormData({ ...formData, expert_email: e.target.value })}
                  style={STYLES.input}
                />
              </div>
              <div>
                <label style={STYLES.label}>Nomor WhatsApp</label>
                <input
                  type="text"
                  placeholder="081234..."
                  value={formData.expert_whatsapp}
                  onChange={e => setFormData({ ...formData, expert_whatsapp: e.target.value })}
                  style={STYLES.input}
                />
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Asal Instansi / Universitas</label>
              <input
                type="text"
                placeholder="Nama Universitas / Lembaga"
                value={formData.asal_instansi}
                onChange={e => setFormData({ ...formData, asal_instansi: e.target.value })}
                style={STYLES.input}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={STYLES.label}>Pendidikan Terakhir</label>
                <input
                  type="text"
                  placeholder="S3 (Doktoral)"
                  value={formData.pendidikan_terakhir}
                  onChange={e => setFormData({ ...formData, pendidikan_terakhir: e.target.value })}
                  style={STYLES.input}
                />
              </div>
              <div>
                <label style={STYLES.label}>Bidang Keahlian Utama *</label>
                <input
                  type="text"
                  required
                  placeholder="Manajemen Lingkungan, AHP, dll"
                  value={formData.bidang_keahlian}
                  onChange={e => setFormData({ ...formData, bidang_keahlian: e.target.value })}
                  style={STYLES.input}
                />
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Durasi Pengalaman (Tahun)</label>
              <input
                type="text"
                placeholder="Contoh: 10 Tahun"
                value={formData.durasi_pengalaman}
                onChange={e => setFormData({ ...formData, durasi_pengalaman: e.target.value })}
                style={STYLES.input}
              />
            </div>

            <div>
              <label style={STYLES.label}>Foto Profil (Maks. 500 KB / URL atau Upload)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Link URL foto..."
                  value={formData.foto_url.length > 40 ? formData.foto_url.substring(0, 40) + '...' : formData.foto_url}
                  onChange={e => setFormData({ ...formData, foto_url: e.target.value })}
                  style={{ ...STYLES.input, flex: 1 }}
                />
                <label style={STYLES.btnUpload}>
                  Upload
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'foto_url')} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Portofolio / CV Dokumen (URL atau Upload)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Link URL CV/Portofolio..."
                  value={formData.portofolio_url.length > 40 ? formData.portofolio_url.substring(0, 40) + '...' : formData.portofolio_url}
                  onChange={e => setFormData({ ...formData, portofolio_url: e.target.value })}
                  style={{ ...STYLES.input, flex: 1 }}
                />
                <label style={STYLES.btnUpload}>
                  Upload
                  <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => handleFileUpload(e, 'portofolio_url')} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Foto KTP (Verifikasi Identitas)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Link URL KTP..."
                  value={formData.ktp_url.length > 40 ? formData.ktp_url.substring(0, 40) + '...' : formData.ktp_url}
                  onChange={e => setFormData({ ...formData, ktp_url: e.target.value })}
                  style={{ ...STYLES.input, flex: 1 }}
                />
                <label style={{ ...STYLES.btnUpload, background: '#f59e0b' }}>
                  Upload KTP
                  <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'ktp_url')} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={() => router.push('/')} style={STYLES.btnCancel}>Batal</button>
              <button type="submit" disabled={submitting} style={STYLES.btnSubmit}>
                {submitting ? 'Menyimpan Perubahan...' : 'Simpan Pembaruan Profil →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function UpdateExpertProfilePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Memuat halaman pembaruan profil...</div>}>
      <UpdateExpertProfileContent />
    </Suspense>
  );
}

const STYLES: Record<string, any> = {
  page: { 
    minHeight: '100vh', 
    background: '#f1f5f9', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
    fontFamily: 'sans-serif',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    overflowY: 'auto'
  },
  card: { background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 640, padding: 32, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, textAlign: 'center', marginBottom: 14 },
  successBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, color: '#166534', fontWeight: 600, fontSize: 13.5, textAlign: 'center', marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', background: '#fff' },
  btnUpload: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnBack: { marginTop: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnCancel: { background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSubmit: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }
};