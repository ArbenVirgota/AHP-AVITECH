// app/expert/update-profile/page.tsx

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function UpdateExpertProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expertId = searchParams.get('id') || searchParams.get('expert_id') || '';
  // 🟢 Opsi A: Menangkap ticket_id dari URL (misal: ?id=EXP-...&ticket_id=ADM-...)
  const ticketId = searchParams.get('ticket_id') || searchParams.get('ticket') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
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
      setErrorMsg('ID Pakar (?id=...) tidak ditemukan pada tautan ini.');
      setLoading(false);
      return;
    }

    fetchExpertData();
  }, [expertId]);

  // 🟢 1. Ambil data profil langsung dari /api/expert/profile
  const fetchExpertData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`/api/expert/profile?id=${encodeURIComponent(expertId)}&_t=${Date.now()}`, { 
        cache: 'no-store' 
      });

      const rawText = await res.text().catch(() => '');
      let json: any = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(`Server merespons status ${res.status}. Pastikan handler GET pada /api/expert/profile telah terpasang.`);
      }

      if (json && json.success && json.data) {
        const found = json.data;
        setFormData({
          expert_id: expertId,
          gelar_depan: String(found.gelar_depan || ''),
          expert_name: String(found.expert_name || found.nama || ''),
          gelar_belakang: String(found.gelar_belakang || ''),
          expert_email: String(found.expert_email || found.email || ''),
          expert_whatsapp: String(found.expert_whatsapp || found.whatsapp || ''),
          asal_instansi: String(found.asal_instansi || found.instansi || ''),
          pendidikan_terakhir: String(found.pendidikan_terakhir || found.pendidikan || ''),
          bidang_keahlian: String(found.bidang_keahlian || found.keahlian || ''),
          durasi_pengalaman: String(found.durasi_pengalaman || found.pengalaman || ''),
          foto_url: String(found.foto_url || found.foto || ''),
          portofolio_url: String(found.portofolio_url || found.portofolio || ''),
          ktp_url: String(found.ktp_url || found.ktp || '')
        });
      } else {
        setErrorMsg(json?.message || `Data pakar dengan ID #${expertId} tidak ditemukan di database.`);
      }
    } catch (err: any) {
      console.error('Fetch expert profile error:', err);
      setErrorMsg(err.message || 'Gagal memuat profil pakar dari sistem.');
    } finally {
      setLoading(false);
    }
  };

  // 🟢 2. Helper Kompresi Gambar Client-Side untuk KTP & Pas Foto (Maks 1200px, Kualitas 0.8)
  const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // 🟢 3. Handler Unggah Berkas Tanpa Hambatan
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    fieldName: 'foto_url' | 'portofolio_url' | 'ktp_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingField(fieldName);

      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file, 1000, 1000, 0.82);
        setFormData(prev => ({ ...prev, [fieldName]: compressedBase64 }));
      } else {
        if (file.size > 1.5 * 1024 * 1024) {
          alert('⚠️ Ukuran dokumen PDF maksimal 1.5 MB.');
          e.target.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, [fieldName]: String(reader.result) }));
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      alert(`Gagal memproses berkas: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  };

  // 🟢 4. Kirim Data langsung ke /api/expert/profile (dengan menyertakan ticket_id)
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

      const res = await fetch('/api/expert/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expert_id: expertId,
          ticket_id: ticketId, // 🟢 Menyertakan ticket_id ke backend jika ada
          ...formData
        }),
      });

      const rawText = await res.text().catch(() => '');
      let json: any = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(`Server status ${res.status}: Gagal menyimpan perubahan.`);
      }

      if (json && json.success) {
        setSuccessMsg('✅ Berkas & profil Anda berhasil disimpan ke sistem database AHP!');
        alert('✅ Terima kasih! Profil dan berkas Anda telah berhasil diperbarui.');
        setTimeout(() => {
          router.push('/');
        }, 1800);
      } else {
        setErrorMsg(json?.message || 'Gagal menyimpan pembaruan profil.');
        alert(`Gagal menyimpan: ${json?.message || 'Terjadi kesalahan sistem.'}`);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setErrorMsg(`Kesalahan pengiriman: ${err.message}`);
      alert(`Terjadi kesalahan pengiriman data: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={STYLES.page}>
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
        }
      `}</style>

      <div style={STYLES.card}>
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 21, fontWeight: 800 }}>
            📝 Perbarui Profil &amp; Berkas Pakar
          </h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              ID Pakar: <strong style={{ color: '#2563eb' }}>#{expertId}</strong>
            </p>
            {ticketId && (
              <span style={{ fontSize: 11.5, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
                Tiket Konsultasi: #{ticketId.replace('#', '')}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontWeight: 600 }}>
            Memuat formulir profil pakar dari sistem...
          </div>
        ) : errorMsg && !formData.expert_name ? (
          <div style={STYLES.errorBox}>
            <p style={{ margin: 0, color: '#dc2626', fontWeight: 600 }}>{errorMsg}</p>
            <button onClick={() => router.push('/')} style={STYLES.btnBack}>← Kembali ke Beranda</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {successMsg && <div style={STYLES.successBox}>{successMsg}</div>}
            {errorMsg && <div style={STYLES.errorBox}>{errorMsg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr 1fr', gap: 10 }}>
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
                <label style={STYLES.label}>Email Terdaftar</label>
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
                  placeholder="08123456789"
                  value={formData.expert_whatsapp}
                  onChange={e => setFormData({ ...formData, expert_whatsapp: e.target.value })}
                  style={STYLES.input}
                />
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Asal Instansi / Perguruan Tinggi</label>
              <input
                type="text"
                placeholder="Nama Universitas / Instansi"
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
                  placeholder="S2 / S3"
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
                  placeholder="Keahlian spesifik"
                  value={formData.bidang_keahlian}
                  onChange={e => setFormData({ ...formData, bidang_keahlian: e.target.value })}
                  style={STYLES.input}
                />
              </div>
            </div>

            <div>
              <label style={STYLES.label}>Durasi Pengalaman Riset</label>
              <input
                type="text"
                placeholder="Contoh: 5 - 10 Tahun"
                value={formData.durasi_pengalaman}
                onChange={e => setFormData({ ...formData, durasi_pengalaman: e.target.value })}
                style={STYLES.input}
              />
            </div>

            {/* AREA UNGGAH DOKUMEN & FOTO DENGAN PRATINJAU VISUAL */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                📎 Kelengkapan Berkas &amp; Foto Verifikasi:
              </div>

              {/* FOTO PROFIL */}
              <div>
                <label style={STYLES.label}>1. Pas Foto Resmi (Format Gambar)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {formData.foto_url && (
                    <img 
                      src={formData.foto_url} 
                      alt="Pratinjau Foto" 
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }} 
                    />
                  )}
                  <input
                    type="text"
                    placeholder="URL Foto atau Unggah langsung..."
                    value={formData.foto_url ? 'Foto profil terunggah ✓' : ''}
                    readOnly
                    style={{ ...STYLES.input, flex: 1, background: '#f1f5f9', cursor: 'default' }}
                  />
                  <label style={STYLES.btnUpload}>
                    {uploadingField === 'foto_url' ? 'Memproses...' : 'Pilih Foto'}
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'foto_url')} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* PORTOFOLIO / CV */}
              <div>
                <label style={STYLES.label}>2. Berkas Portofolio / CV (PDF / URL Link)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Tautan Google Drive atau Pilih Dokumen..."
                    value={formData.portofolio_url.startsWith('data:') ? 'Dokumen Portofolio terunggah ✓' : formData.portofolio_url}
                    onChange={e => setFormData({ ...formData, portofolio_url: e.target.value })}
                    style={{ ...STYLES.input, flex: 1 }}
                  />
                  <label style={{ ...STYLES.btnUpload, background: '#475569' }}>
                    {uploadingField === 'portofolio_url' ? 'Memproses...' : 'Pilih File'}
                    <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => handleFileUpload(e, 'portofolio_url')} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* FOTO KTP */}
              <div>
                <label style={STYLES.label}>3. Berkas KTP (Untuk Keperluan Verifikasi Validasi Ahli)</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {formData.ktp_url && (
                    <img 
                      src={formData.ktp_url} 
                      alt="Pratinjau KTP" 
                      style={{ width: 56, height: 38, borderRadius: 4, objectFit: 'cover', border: '1px solid #cbd5e1' }} 
                    />
                  )}
                  <input
                    type="text"
                    placeholder="KTP terunggah secara privat & aman..."
                    value={formData.ktp_url ? 'Foto KTP terunggah ✓' : ''}
                    readOnly
                    style={{ ...STYLES.input, flex: 1, background: '#f1f5f9', cursor: 'default' }}
                  />
                  <label style={{ ...STYLES.btnUpload, background: '#d97706' }}>
                    {uploadingField === 'ktp_url' ? 'Memproses...' : 'Upload KTP'}
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'ktp_url')} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" onClick={() => router.push('/')} style={STYLES.btnCancel}>Batal</button>
              <button type="submit" disabled={submitting || Boolean(uploadingField)} style={STYLES.btnSubmit}>
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
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Memuat formulir pakar...</div>}>
      <UpdateExpertProfileContent />
    </Suspense>
  );
}

const STYLES: Record<string, any> = {
  page: { 
    minHeight: '100vh', 
    background: '#f8fafc', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '24px 16px', 
    fontFamily: '"Inter", -apple-system, sans-serif'
  },
  card: { background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 640, padding: '24px 28px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, textAlign: 'center', marginBottom: 14 },
  successBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14, color: '#166534', fontWeight: 600, fontSize: 13.5, textAlign: 'center', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' },
  btnUpload: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnBack: { marginTop: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  btnCancel: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSubmit: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
};