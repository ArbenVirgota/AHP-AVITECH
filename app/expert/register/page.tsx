'use client';

import React, { useState } from 'react';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

// Helper Validasi Format WhatsApp
function processPhoneNumber(phoneInput?: any): { displayPhone: string; waLinkPhone: string; isValid: boolean; errorMsg: string } {
  if (phoneInput === undefined || phoneInput === null) {
    return { displayPhone: '', waLinkPhone: '', isValid: false, errorMsg: 'Nomor HP wajib diisi.' };
  }
  
  let clean = String(phoneInput).trim().replace(/[^\d]/g, '');
  if (!clean) {
    return { displayPhone: '', waLinkPhone: '', isValid: false, errorMsg: 'Nomor HP harus berupa angka.' };
  }

  let localFormat = clean;
  let internationalFormat = clean;

  if (clean.startsWith('8')) {
    localFormat = '0' + clean;
    internationalFormat = '62' + clean;
  } else if (clean.startsWith('08')) {
    localFormat = clean;
    internationalFormat = '62' + clean.slice(1);
  } else if (clean.startsWith('628')) {
    localFormat = '0' + clean.slice(2);
    internationalFormat = clean;
  } else {
    return { displayPhone: clean, waLinkPhone: clean, isValid: false, errorMsg: 'Nomor harus diawali 08, 628, atau 8' };
  }

  if (internationalFormat.length < 10 || internationalFormat.length > 15) {
    return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: false, errorMsg: 'Jumlah digit tidak valid.' };
  }

  return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: true, errorMsg: '' };
}

export default function ExpertRegistrationPage() {
  const [form, setForm] = useState({
    gelar_depan: '',
    expert_name: '',
    gelar_belakang: '',
    bidang_keahlian: '',
    asal_instansi: '',
    pendidikan_terakhir: 'S2 / Magister',
    pengalaman_tahun: '',
    expert_email: '',
    expert_whatsapp: '',
    foto_url: '',
    portofolio_url: '',
    publish_consent: 'YA'
  });

  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [waError, setWaError] = useState('');

  // Helper Kompresi Gambar sebelum dikirim
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'foto_url' | 'portofolio_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.src = ev.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 350;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setForm(prev => ({ ...prev, [fieldName]: canvas.toDataURL('image/jpeg', 0.5) }));
        };
      };
      reader.readAsDataURL(file);
    } else {
      if (file.size > 500 * 1024) {
        alert('⚠️ Berkas dokumen PDF terlalu besar (>500 KB). Disarankan menggunakan Link Google Drive.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, [fieldName]: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleWaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const numericOnly = rawVal.replace(/[^\d]/g, '');
    setForm({ ...form, expert_whatsapp: numericOnly });
    if (numericOnly) {
      const check = processPhoneNumber(numericOnly);
      setWaError(check.isValid ? '' : check.errorMsg);
    } else {
      setWaError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expert_name || !form.bidang_keahlian || !form.expert_email || !form.expert_whatsapp) {
      alert('Nama, Bidang Keahlian, Email, dan No. WhatsApp wajib diisi.');
      return;
    }

    if (!agreedToTerms) {
      alert('Anda harus menyetujui Syarat & Ketentuan Kolaborasi Pakar sebelum mengirim pengajuan.');
      return;
    }

    const phoneCheck = processPhoneNumber(form.expert_whatsapp);
    if (!phoneCheck.isValid) {
      alert(`Format Nomor WhatsApp Salah: ${phoneCheck.errorMsg}`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveexpert',
          gelar_depan: form.gelar_depan.trim(),
          expert_name: form.expert_name.trim(),
          gelar_belakang: form.gelar_belakang.trim(),
          keahlian: form.bidang_keahlian.trim(),
          instansi: form.asal_instansi.trim(),
          pendidikan: form.pendidikan_terakhir,
          pengalaman: form.pengalaman_tahun.trim(),
          email: form.expert_email.trim().toLowerCase(),
          whatsapp: phoneCheck.waLinkPhone,
          fotoUrl: form.foto_url,
          portofolioUrl: form.portofolio_url,
          status: 'Pending Verifikasi',
          is_public: 'PUBLIK'
        })
      });

      const text = await res.text();
      const json = JSON.parse(text);

      if (json.success) {
        setIsSuccess(true);
      } else {
        alert(`Gagal mengirim pengajuan: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan jaringan saat mengirim data: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 740, margin: '40px auto', padding: 32, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: '"Inter", "Segoe UI", sans-serif', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: 24, fontWeight: 800 }}>Pendaftaran Pakar Riset AHP</h2>
        <p style={{ color: '#64748b', fontSize: 14.5, margin: 0, lineHeight: 1.5 }}>
          Bantu peneliti menyempurnakan riset mereka. Sebagai apresiasi, Anda akan mendapatkan <strong>E-Sertifikat Kolaborasi Riset</strong>, <strong>Eksposur Profil Akademik</strong>, dan <strong>Akses Gratis Akun Pro</strong>.
        </p>
      </div>

      {isSuccess ? (
        <div style={{ padding: 24, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <h3 style={{ color: '#15803d', margin: '0 0 12px 0', fontSize: 18 }}>Pengajuan Berhasil Terkirim!</h3>
          <p style={{ color: '#166534', fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
            Terima kasih atas partisipasi Anda. Berkas pengajuan Anda telah masuk ke sistem dan saat ini berstatus <strong>Pending Verifikasi</strong>.<br /><br />
            Tim Admin kami akan meninjau profil Anda dan memberikan notifikasi melalui email dalam waktu 1x24 jam kerja.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12 }}>
            <div>
              <label style={STYLES.label}>Gelar Depan</label>
              <input type="text" placeholder="Dr. / Prof." value={form.gelar_depan} onChange={e => setForm({ ...form, gelar_depan: e.target.value })} style={STYLES.input} />
            </div>
            <div>
              <label style={STYLES.label}>Nama Utama *</label>
              <input type="text" required placeholder="Nama tanpa gelar" value={form.expert_name} onChange={e => setForm({ ...form, expert_name: e.target.value })} style={STYLES.input} />
            </div>
            <div>
              <label style={STYLES.label}>Gelar Belakang</label>
              <input type="text" placeholder="M.Si. / Ph.D." value={form.gelar_belakang} onChange={e => setForm({ ...form, gelar_belakang: e.target.value })} style={STYLES.input} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={STYLES.label}>Alamat Email Aktif *</label>
              <input type="email" required placeholder="pakar@instansi.ac.id" value={form.expert_email} onChange={e => setForm({ ...form, expert_email: e.target.value })} style={STYLES.input} />
            </div>
            <div>
              <label style={STYLES.label}>Nomor WhatsApp *</label>
              <input type="text" required placeholder="081234..." value={form.expert_whatsapp} onChange={handleWaChange} style={STYLES.input} />
              {waError && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>{waError}</span>}
            </div>
          </div>

          <div>
            <label style={STYLES.label}>Asal Instansi / Perguruan Tinggi</label>
            <input type="text" placeholder="Universitas / Lembaga Riset" value={form.asal_instansi} onChange={e => setForm({ ...form, asal_instansi: e.target.value })} style={STYLES.input} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={STYLES.label}>Bidang Keahlian Utama *</label>
              <input type="text" required placeholder="Sistem Pakar, AHP, dll" value={form.bidang_keahlian} onChange={e => setForm({ ...form, bidang_keahlian: e.target.value })} style={STYLES.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={STYLES.label}>Pendidikan</label>
                <select value={form.pendidikan_terakhir} onChange={e => setForm({ ...form, pendidikan_terakhir: e.target.value })} style={STYLES.input}>
                  <option value="S1 / Sarjana">S1 / Sarjana</option>
                  <option value="S2 / Magister">S2 / Magister</option>
                  <option value="S3 / Doktor">S3 / Doktor</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label style={STYLES.label}>Pengalaman</label>
                <input type="number" min="0" placeholder="Thn (Misal: 5)" value={form.pengalaman_tahun} onChange={e => setForm({ ...form, pengalaman_tahun: e.target.value })} style={STYLES.input} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={STYLES.label}>Foto Profil Resmi (Maks. 500 KB)</label>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'foto_url')} style={{ marginTop: 4, fontSize: 13 }} />
            </div>
            <div>
              <label style={STYLES.label}>Tautan Profil / CV (Google Scholar / SINTA)</label>
              <input type="url" placeholder="https://scholar.google..." value={form.portofolio_url} onChange={e => setForm({ ...form, portofolio_url: e.target.value })} style={STYLES.input} />
            </div>
          </div>

          {/* CHECKBOX SYARAT DAN KETENTUAN */}
          <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={agreedToTerms} 
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                Saya telah membaca, memahami, dan menyetujui <strong>Syarat & Ketentuan Kolaborasi Pakar</strong>, termasuk komitmen merespons tiket dalam 2-3 hari kerja, menjaga kerahasiaan data riset pengguna, serta pemahaman bahwa keikutsertaan awal ini bersifat kolaborasi non-finansial.
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={submitting || !agreedToTerms} 
            style={{ 
              ...STYLES.btnSubmit, 
              opacity: (!agreedToTerms || submitting) ? 0.5 : 1, 
              cursor: (!agreedToTerms || submitting) ? 'not-allowed' : 'pointer' 
            }}
          >
            {submitting ? 'Mengirim Data Pendaftaran...' : '🚀 Kirim Pengajuan Pakar'}
          </button>
        </form>
      )}
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  label: { fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', background: '#fff' },
  btnSubmit: { marginTop: 12, padding: '14px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14.5, transition: 'all 0.2s' }
};