'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxAjj0RuDMuXwMof8aXTchGcdwafykfLAGv_IgSfypkp8LrP4j66_J5w9juyH/exec';

interface CertificateData {
  certificateid: string;
  expertname: string;       // Nama lengkap beserta gelar
  projectname: string;      // Judul penelitian / Nama proyek riset
  bidangkeahlian?: string;  // Bidang keahlian pakar
  peranan?: string;         // Peranan
  foto_url?: string;        // Foto profil pakar (opsional)
  fotoUrl?: string;
  issuedat: string;
  type: string;
  [key: string]: any;
}

const pageBgStyle: React.CSSProperties = {
  backgroundImage: 'url("/bg-verifikasi.png")',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: 'fixed',
  minHeight: '100vh',
};

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const certId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [certData, setCertData] = useState<CertificateData | null>(null);

  useEffect(() => {
    const verifyCert = async () => {
      if (!certId) {
        setError('ID Sertifikat tidak ditemukan pada tautan.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const res = await fetch(`${GOOGLESCRIPTURL}?action=verify_certificate&id=${encodeURIComponent(certId)}`, {
          cache: 'no-store'
        });
        const json = await res.json();

        if (json.success && json.data) {
          setCertData(json.data);
        } else {
          setError(json.message || 'Sertifikat tidak valid atau tidak terdaftar di dalam sistem.');
        }
      } catch (err) {
        setError('Gagal menghubungi server verifikasi. Silakan coba beberapa saat lagi.');
      } finally {
        setLoading(false);
      }
    };

    verifyCert();
  }, [certId]);

  if (loading) {
    return (
      <div style={{ ...pageBgStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b', fontSize: 14 }}>
        Memverifikasi keaslian sertifikat proyek...
      </div>
    );
  }

  if (error || !certData) {
    return (
      <div style={{ ...pageBgStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 20, textAlign: 'center', maxWidth: 460, width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>❌</div>
          <h2 style={{ color: '#991b1b', margin: '0 0 6px', fontSize: 17 }}>Verifikasi Gagal</h2>
          <p style={{ color: '#7f1d1d', fontSize: 12.5, lineHeight: 1.4, margin: '0 0 14px' }}>{error}</p>
          <button onClick={() => router.push('/')} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // Toleransi pemformatan tanggal
  const rawDateStr = certData.issuedat || certData.issued_at || '';
  const issuedDate = rawDateStr ? new Date(rawDateStr) : new Date();
  const formattedDate = !isNaN(issuedDate.getTime()) 
    ? issuedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : rawDateStr || '-';

  // Fallback nilai nama & properti
  const expertNameFull = certData.expertname || certData.expert_name || certData.nama || 'Pakar Evaluasi';
  const projectNameFull = certData.projectname || certData.project_name || certData.namaproyek || certData.judul_penelitian || 'Proyek Riset AHP';
  const bidangKeahlianFull = certData.bidangkeahlian || certData.bidang_keahlian || 'Pakar Evaluasi & Pengambilan Keputusan';
  const perananFull = certData.peranan || 'Pakar / Expert Responden AHP';
  const fotoExpert = certData.foto_url || certData.fotoUrl || certData.foto || '';

  return (
    <div style={{ ...pageBgStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', maxWidth: 520, width: '100%', boxShadow: '0 10px 30px rgba(15,23,42,0.08)', border: '2px solid #38bdf8', textAlign: 'center' }}>
        
        {/* Logo Instansi */}
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
          <img 
            src="/logo.png" 
            alt="Logo Instansi" 
            style={{ maxWidth: 64, height: 'auto', objectFit: 'contain' }} 
          />
        </div>

        {/* Badge Resmi Terverifikasi */}
        <div style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, marginBottom: 8 }}>
          ✓ SERTIFIKAT PROYEK RESMI &amp; PERMANEN
        </div>
        
        <h2 style={{ color: '#0f172a', fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Certificate of Appreciation</h2>
        <p style={{ color: '#64748b', fontSize: 11.5, margin: '0 0 14px' }}>ID Dokumen: <strong>{certData.certificateid}</strong></p>

        {/* Konten Detail Blok Verifikasi */}
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', textAlign: 'left', border: '1px solid #e2e8f0', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          
          {/* Section Nama & Foto Expert */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 8, borderBottom: '1px dashed #cbd5e1' }}>
            <img 
              src={fotoExpert || `https://ui-avatars.com/api/?name=${encodeURIComponent(expertNameFull)}&background=0284c7&color=fff`} 
              alt={expertNameFull}
              onError={(e: any) => { 
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(expertNameFull)}&background=0284c7&color=fff`; 
              }}
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8', flexShrink: 0 }}
            />
            <div>
              <span style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontWeight: 600 }}>Diberikan Kepada:</span>
              <strong style={{ fontSize: 15.5, color: '#0f172a', lineHeight: 1.3 }}>{expertNameFull}</strong>
            </div>
          </div>

          {/* Peranan */}
          <div>
            <span style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontWeight: 600 }}>Peranan:</span>
            <span style={{ fontSize: 12.5, color: '#2563eb', fontWeight: 700 }}>
              {perananFull}
            </span>
          </div>

          {/* Bidang Keahlian */}
          <div>
            <span style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontWeight: 600 }}>Bidang Keahlian:</span>
            <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 600 }}>
              {bidangKeahlianFull}
            </span>
          </div>

          {/* Nama Proyek */}
          <div>
            <span style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontWeight: 600 }}>Proyek Penelitian / Evaluasi:</span>
            <span style={{ fontSize: 12.5, color: '#334155', fontWeight: 600 }}>{projectNameFull}</span>
          </div>

          {/* Tanggal Terbit & Status */}
          <div style={{ marginTop: 2, paddingTop: 8, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 600 }}>Tanggal Terbit:</span>
              <span style={{ fontSize: 12, color: '#334155' }}>
                {formattedDate}
              </span>
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#64748b', display: 'block', fontWeight: 600 }}>Status Dokumen:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Aktif / Berlaku Selamanya</span>
            </div>
          </div>

        </div>

        <button onClick={() => router.push('/')} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
          Tutup / Kembali
        </button>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  return (
    <Suspense fallback={<div style={{ ...pageBgStyle, textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Memuat...</div>}>
      <VerifyContent />
    </Suspense>
  );
}