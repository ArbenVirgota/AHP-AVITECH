// app/expert/selesai/page.tsx

'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SafeJoyride from '@/components/SafeJoyride';

interface ProjectDetail {
  id: string;
  namaproyek: string;
  deskripsi: string;
  fasilitatoremail: string;
  fasilitatorwhatsapp: string;
  fasilitatornama: string;
  fasilitatorlembaga?: string;
  fasilitatorsignature?: string;
}

interface ExpertItem {
  id: string;
  gelardepan?: string;
  expertname: string;
  gelarbelakang?: string;
  expertemail: string;
  expertwhatsapp: string;
  asalinstansi: string;
  pendidikanterakhir: string;
  bidangkeahlian: string;
  durasi_pengalaman?: number;
  ktp_url?: string;
  ktpUrl?: string;
  foto_url?: string;
  fotoUrl?: string;
  ispublic?: boolean;
}

interface SavedResponse {
  matrixtype: string;
  parentname: string;
  itemnames: string[];
  cr: number;
  isconfirmed?: boolean;
  updatedat: string;
  submittedat: string;
  [key: string]: any;
}

const PENDIDIKAN_OPTIONS = [
  'D3 / Diploma',
  'S1 / Sarjana',
  'S2 / Magister',
  'S3 / Doktor',
  'Profesor / Guru Besar',
  'Lainnya',
];

function matchPendidikanValue(dbValue: string): string {
  const val = String(dbValue || '').trim().toLowerCase();
  if (!val || val === '-') return 'S2 / Magister';

  const exactMatch = PENDIDIKAN_OPTIONS.find((opt) => opt.toLowerCase() === val);
  if (exactMatch) return exactMatch;

  if (val.includes('s1') || val.includes('sarjana')) return 'S1 / Sarjana';
  if (val.includes('s2') || val.includes('magister')) return 'S2 / Magister';
  if (val.includes('s3') || val.includes('doktor')) return 'S3 / Doktor';
  if (val.includes('prof') || val.includes('guru besar')) return 'Profesor / Guru Besar';
  if (val.includes('d3') || val.includes('diploma')) return 'D3 / Diploma';

  return 'Lainnya';
}

function processPhoneNumber(phoneInput?: any): {
  displayPhone: string;
  waLinkPhone: string;
  isValid: boolean;
  errorMsg: string;
} {
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

function sanitizeSignatureUrl(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str === 'null' || str === 'undefined') return '';
  if (str.startsWith('data:image/')) return str;
  if (str.includes('drive.google.com')) {
    const fileIdMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
    }
  }
  return str;
}

function ExpertSelesaiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [expert, setExpert] = useState<ExpertItem | null>(null);
  const [waError, setWaError] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const [showCertModal, setShowCertModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [officialCertId, setOfficialCertId] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Aset Resmi Platform dari tabel AHP - system_assets
  const [systemAssets, setSystemAssets] = useState<{
    platform_logo?: string;
    admin_signature?: string;
    co_admin_signature?: string;
    stamp_url?: string;
    admin_name?: string;
    admin_title?: string;
    [key: string]: string | undefined;
  }>({
    platform_logo: '/logo.png',
    admin_name: 'Dr. Arben Virgota, S.Pi., M.Si',
    admin_title: 'Avitech Platform Founder',
  });

  const [formData, setFormData] = useState({
    gelarDepan: '',
    expertname: '',
    gelarBelakang: '',
    expertemail: '',
    expertwhatsapp: '',
    asalinstansi: '',
    pendidikanterakhir: 'S2 / Magister',
    bidangkeahlian: '',
    durasi_pengalaman: 0,
    ktpUrl: '',
    fotoUrl: '',
    isPublic: true,
  });

  const isStudent = useMemo(() => {
    const t = String(token || '').toUpperCase();
    const expId = String(expert?.id || '').toUpperCase();
    const instansi = String(expert?.asalinstansi || '').toLowerCase();
    const expName = String(expert?.expertname || '').toLowerCase();

    return (
      t.includes('TOK-SIM') ||
      expId.includes('SIM') ||
      instansi.includes('simulasi') ||
      expName.includes('linglungan') ||
      expName.includes('raos') ||
      (expert as any)?.role === 'student' ||
      (project as any)?.isStudent === true
    );
  }, [token, expert, project]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const hiddenElements: HTMLElement[] = [];
      const selectors =
        'aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"], [class*="navigation"]';
      const els = document.querySelectorAll<HTMLElement>(selectors);

      els.forEach((el) => {
        if (el.style.display !== 'none') {
          hiddenElements.push(el);
          el.style.display = 'none';
        }
      });

      return () => {
        hiddenElements.forEach((el) => {
          el.style.display = '';
        });
      };
    }
  }, []);

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setLoading(true);
        setError('');

        if (!token) {
          throw new Error('Token expert tidak ditemukan di URL.');
        }

        const ts = Date.now();

        // Ambil data token expert & data master dari AHP - system_assets
        const [tokenRes, assetsRes] = await Promise.all([
          fetch(`/api/expert?token=${encodeURIComponent(token)}&_t=${ts}`, { cache: 'no-store' }),
          fetch(`/api/system-assets?_t=${ts}`, { cache: 'no-store' }).catch(() => null),
        ]);

        const tokenRawText = await tokenRes.text();
        let json: any = {};
        try {
          json = tokenRawText ? JSON.parse(tokenRawText) : {};
        } catch {
          throw new Error(`Data tidak valid dari server (Status ${tokenRes.status}).`);
        }

        if (!json?.success || !json?.data?.expert || !json?.data?.project) {
          throw new Error(json?.message || 'Data expert tidak ditemukan atau token tidak valid.');
        }

        // Pemetaan presisi dari tabel AHP - system_assets
        if (assetsRes && assetsRes.ok) {
          const assetsRawText = await assetsRes.text();
          try {
            const assetsJson = assetsRawText ? JSON.parse(assetsRawText) : {};
            if (assetsJson?.success && assetsJson.data) {
              const d = assetsJson.data;
              const logo = d.platform_logo || '/logo.png';
              const rawStamp = sanitizeSignatureUrl(d.app_system_stamp_url || d.stamp_url);
              const adminSig = sanitizeSignatureUrl(
                d.admin_signature || d.superadmin_signature_url || d.backup_signer_signature_url
              );
              const adminName = d.backup_signer_name || d.admin_name || 'Dr. Arben Virgota, S.Pi., M.Si';
              const adminTitle = d.backup_signer_title || d.admin_title || 'Avitech Platform Founder';

              const isStampDuplicateOfLogo = Boolean(
                rawStamp && (
                  rawStamp === logo || 
                  rawStamp.slice(0, 100) === logo.slice(0, 100) ||
                  rawStamp.includes('AAAJcA')
                )
              );

              setSystemAssets({
                platform_logo: logo,
                stamp_url: isStampDuplicateOfLogo ? '' : rawStamp,
                admin_signature: adminSig,
                admin_name: adminName,
                admin_title: adminTitle,
              });
            }
          } catch (e) {
            console.warn('Gagal membaca JSON system assets:', e);
          }
        }

        const rawExp = json.data.expert;
        const rawProj = json.data.project;

        const expId = String(rawExp.id || rawExp.expertid || rawExp.expert_id || '').trim();
        const gD = String(rawExp.gelar_depan || rawExp.gelardepan || '').trim();
        const gB = String(rawExp.gelar_belakang || rawExp.gelarbelakang || '').trim();

        const expName = String(
          rawExp.nama_utama || rawExp.namautama || rawExp.expert_name || rawExp.expertname || rawExp.nama || ''
        ).trim();

        const projId = String(rawProj.id || rawProj.projectid || rawProj.project_id || '').trim();
        const isExpPublic =
          rawExp.is_public === 'PUBLIK' || rawExp.is_public === true || rawExp.is_public === 'YA' || rawExp.ispublic;

        const exp: ExpertItem = {
          id: expId,
          gelardepan: gD,
          expertname: expName,
          gelarbelakang: gB,
          expertemail: String(rawExp.expertemail || rawExp.expert_email || rawExp.email || '').trim(),
          expertwhatsapp: String(rawExp.expertwhatsapp || rawExp.expert_whatsapp || rawExp.whatsapp || '').trim(),
          asalinstansi: String(rawExp.asalinstansi || rawExp.asal_instansi || rawExp.instansi || '').trim(),
          pendidikanterakhir: matchPendidikanValue(rawExp.pendidikanterakhir || rawExp.pendidikan_terakhir || ''),
          bidangkeahlian: String(rawExp.bidangkeahlian || rawExp.bidang_keahlian || '').trim(),
          durasi_pengalaman: Number(rawExp.durasi_pengalaman || 3),
          ktp_url: String(rawExp.ktp_url || rawExp.ktpUrl || '').trim(),
          foto_url: String(rawExp.foto_url || rawExp.fotoUrl || '').trim(),
          ispublic: isExpPublic,
        };

        // 1. Cek tanda tangan fasilitator dari proyek
        let fasilitatorSig = sanitizeSignatureUrl(
          rawProj.fasilitatorsignature ||
          rawProj.fasilitator_signature ||
          rawProj.signature ||
          rawProj.digital_signature ||
          rawProj.tanda_tangan ||
          rawProj.foto_ttd ||
          rawProj.signature_url ||
          rawProj.ttd_url ||
          ''
        );

        const fasEmail = String(
          rawProj.fasilitator_email || rawProj.fasilitatoremail || rawProj.user_email || rawProj.useremail || ''
        ).trim().toLowerCase();

        // 2. Ambil tanda tangan langsung dari tabel AHP - users jika di proyek belum terbawa
        if (!fasilitatorSig && fasEmail) {
          try {
            const userCheckRes = await fetch(`/api/dashboard/summary?email=${encodeURIComponent(fasEmail)}&_t=${ts}`, { cache: 'no-store' });
            const userCheckJson = await userCheckRes.json();
            const u = userCheckJson?.data?.user || userCheckJson?.data?.profile;
            fasilitatorSig = sanitizeSignatureUrl(
              u?.foto_ttd || u?.tanda_tangan || u?.signature || u?.digital_signature
            );
          } catch (e) {
            console.warn('Gagal fetch tanda tangan fasilitator dari AHP - users:', e);
          }
        }

        const proj: ProjectDetail = {
          id: projId,
          namaproyek: String(rawProj.nama_proyek || rawProj.namaproyek || 'Proyek Riset AHP').trim(),
          deskripsi: String(rawProj.deskripsi || ''),
          fasilitatoremail: fasEmail,
          fasilitatorwhatsapp: String(rawProj.fasilitator_whatsapp || rawProj.fasilitatorwhatsapp || ''),
          fasilitatornama: String(
            rawProj.fasilitator_nama || 
            rawProj.fasilitatornama || 
            rawProj.peneliti || 
            rawProj.nama_user || 
            'Peneliti Utama'
          ).trim(),
          fasilitatorlembaga: String(
            rawProj.fasilitator_lembaga || 
            rawProj.fasilitatorlembaga || 
            rawProj.lembaga || 
            rawProj.instansi || 
            'Universitas Mataram'
          ).trim(),
          fasilitatorsignature: fasilitatorSig,
        };

        setProject(proj);
        setExpert(exp);

        const calculatedCertId = `CERT-AHP-${projId.replace(/[^a-zA-Z0-9]/g, '').slice(-6)}-${expId.replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`;
        setOfficialCertId(calculatedCertId);

        if (!isRefresh) {
          setFormData({
            gelarDepan: exp.gelardepan || '',
            expertname: exp.expertname || '',
            gelarBelakang: exp.gelarbelakang || '',
            expertemail: exp.expertemail || '',
            expertwhatsapp: exp.expertwhatsapp || '',
            asalinstansi: exp.asalinstansi || '',
            pendidikanterakhir: exp.pendidikanterakhir || 'S2 / Magister',
            bidangkeahlian: exp.bidangkeahlian || '',
            durasi_pengalaman: exp.durasi_pengalaman || 0,
            ktpUrl: exp.ktp_url || '',
            fotoUrl: exp.foto_url || '',
            isPublic: isExpPublic,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memuat data.');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Fungsi sinkronisasi audit penerbitan sertifikat ke tabel `AHP - certificates`
  const recordCertificateIssuance = useCallback(async () => {
    if (!officialCertId || !expert || !project) return;
    try {
      const fullExpName = [formData.gelarDepan, formData.expertname, formData.gelarBelakang].filter(Boolean).join(' ').trim() || expert.expertname;
      await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateid: officialCertId,
          expertid: expert.id,
          expertname: fullExpName,
          projectname: project.namaproyek,
          type: 'APRESIASI',
          fasilitator_nama: project.fasilitatornama || 'Peneliti Utama',
        }),
      });
    } catch (e) {
      console.warn('Gagal mencatat sertifikat ke basis data audit:', e);
    }
  }, [officialCertId, expert, project, formData]);

  const handleOpenCertificate = () => {
    setShowCertModal(true);
    void recordCertificateIssuance();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const phoneValidation = processPhoneNumber(formData.expertwhatsapp);
    if (!phoneValidation.isValid) {
      setWaError(phoneValidation.errorMsg);
      return;
    }
    setWaError('');

    try {
      setSavingProfile(true);
      setSaveSuccessMsg('');

      const payload = {
        token,
        gelar_depan: formData.gelarDepan.trim(),
        expert_name: formData.expertname.trim(),
        gelar_belakang: formData.gelarBelakang.trim(),
        expert_email: formData.expertemail.trim(),
        expert_whatsapp: phoneValidation.waLinkPhone,
        asal_instansi: formData.asalinstansi.trim(),
        pendidikan_terakhir: formData.pendidikanterakhir,
        bidang_keahlian: formData.bidangkeahlian.trim(),
        durasi_pengalaman: Number(formData.durasi_pengalaman || 0),
        foto_url: formData.fotoUrl.trim(),
        ktp_url: formData.ktpUrl.trim(),
        is_public: formData.isPublic ? 'PUBLIK' : 'PRIVAT',
      };

      const res = await fetch('/api/expert/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json().catch(() => ({}));
      if (res.ok && resJson.success !== false) {
        setIsProfileSaved(true);
        setSaveSuccessMsg('✓ Profil pakar berhasil diperbarui dan tersimpan ke basis data.');
      } else {
        alert(resJson.message || 'Gagal menyimpan profil.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan saat menyimpan profil: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    try {
      setIsGeneratingPdf(true);
      void recordCertificateIssuance();
      const element = document.getElementById('certificate-download-area');
      if (!element) return;
      const html2pdfModule = await import('html2pdf.js' as any);
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const opt = {
        margin: [5, 5, 5, 5],
        filename: `Sertifikat_Apresiasi_${officialCertId || 'AHP-EXP'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2.2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      };
      await html2pdf().set(opt).from(element).save();
    } catch {
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const GLOBAL_HIDE_CSS = `
    aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"], [class*="navigation"] {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>
        <style jsx global>{GLOBAL_HIDE_CSS}</style>
        <div>Memuat status evaluasi...</div>
      </div>
    );
  }

  if (error || !project || !expert) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red', fontFamily: 'Segoe UI, sans-serif' }}>
        <style jsx global>{GLOBAL_HIDE_CSS}</style>
        <div>{error}</div>
      </div>
    );
  }

  const formattedFullName = [formData.gelarDepan, formData.expertname, formData.gelarBelakang].filter(Boolean).join(' ').trim();
  const certQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(`https://ahp.avitech.cloud/verify-cert?id=${officialCertId}`)}`;

  // TAMPILAN KHUSUS STUDENT EDITION
  if (isStudent) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("/bg-expert.png") center/cover no-repeat fixed, #f8fafc',
          zIndex: 2147483647,
          overflowY: 'auto',
          padding: '24px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        <style jsx global>{GLOBAL_HIDE_CSS}</style>

        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '36px 32px',
            maxWidth: 560,
            width: '100%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                padding: '4px 12px',
                borderRadius: 999,
                display: 'inline-block',
              }}
            >
              🎓 AHP Student Edition
            </span>
            <div style={{ fontSize: 48, margin: '14px 0 8px' }}>🎉</div>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
              Evaluasi Pakar Simulasi Selesai!
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
              Penilaian matriks perbandingan berpasangan oleh{' '}
              <strong>{expert.gelardepan ? expert.gelardepan + ' ' : ''}{expert.expertname}</strong> untuk proyek{' '}
              <strong>"{project.namaproyek}"</strong> telah berhasil direkam ke database sistem.
            </p>
          </div>

          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '14px 16px',
              color: '#166534',
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 Mode Praktikum Aktif:</div>
            <div>
              Sebagai akun <strong>Student Edition</strong>, Anda menggunakan pakar simulasi standar untuk pembelajaran.
              Tahapan pengisian profil pakar, pasfoto resmi, dan verifikasi KTP <strong>dinonaktifkan</strong>. Data evaluasi telah
              tersinkronisasi langsung ke proyek Anda.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            {project.id && (
              <button
                type="button"
                onClick={() => router.push(`/proyek/kelola?id=${encodeURIComponent(project.id)}`)}
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  background: '#1d4ed8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 9,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                }}
              >
                📊 Buka Ruang Kerja &amp; Hasil Analisis Proyek
              </button>
            )}

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%',
                padding: '11px 18px',
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📁 Kembali ke Dashboard Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TAMPILAN AKUN UMUM
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("/bg-expert.png") center/cover no-repeat fixed, #f8fafc',
        zIndex: 2147483647,
        overflowY: 'auto',
        padding: '24px 16px',
        fontFamily: 'Segoe UI, sans-serif',
      }}
    >
      <style jsx global>{GLOBAL_HIDE_CSS}</style>

      <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Banner Terima Kasih */}
        <div style={{ background: 'white', padding: '18px 24px', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <h1 style={{ margin: 0, fontSize: 20, color: '#0f172a', fontWeight: 800 }}>Terima Kasih! Evaluasi Matriks Selesai</h1>
          <p style={{ color: '#475569', margin: '4px 0 0', fontSize: 13 }}>
            Seluruh penilaian matriks untuk proyek <strong>"{project.namaproyek}"</strong> telah berhasil tervalidasi[cite: 10].
          </p>
        </div>

        {/* Form Lengkap Data Profil Pakar */}
        <div style={{ background: 'white', padding: '24px 28px', borderRadius: 14, border: '1px solid #cbd5e1', boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 800 }}>Langkah 1: Lengkapi &amp; Perbarui Profil Pakar</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Data ini akan disematkan pada sertifikat apresiasi resmi dan tercatat dalam direktori kepakaran platform[cite: 10].
            </p>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Gelar & Nama */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Gelar Depan</label>
                <input
                  type="text"
                  placeholder="Prof. / Dr."
                  value={formData.gelarDepan}
                  onChange={(e) => setFormData({ ...formData, gelarDepan: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Nama Lengkap / Nama Inti <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap tanpa gelar"
                  value={formData.expertname}
                  onChange={(e) => setFormData({ ...formData, expertname: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Gelar Belakang</label>
                <input
                  type="text"
                  placeholder="M.Sc. / Ph.D."
                  value={formData.gelarBelakang}
                  onChange={(e) => setFormData({ ...formData, gelarBelakang: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Kontak Email & WhatsApp */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Alamat Email <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.expertemail}
                  onChange={(e) => setFormData({ ...formData, expertemail: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Nomor WhatsApp <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 08123456789"
                  value={formData.expertwhatsapp}
                  onChange={(e) => setFormData({ ...formData, expertwhatsapp: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: waError ? '1.5px solid #dc2626' : '1px solid #cbd5e1', fontSize: 13 }}
                />
                {waError && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{waError}</div>}
              </div>
            </div>

            {/* Instansi & Pendidikan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Asal Instansi / Institusi <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Universitas Mataram / Bappeda"
                  value={formData.asalinstansi}
                  onChange={(e) => setFormData({ ...formData, asalinstansi: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Pendidikan Terakhir <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={formData.pendidikanterakhir}
                  onChange={(e) => setFormData({ ...formData, pendidikanterakhir: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: 'white' }}
                >
                  {PENDIDIKAN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bidang Keahlian & Durasi Pengalaman */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Bidang Keahlian / Spesialisasi <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pengelolaan Sumberdaya Alam & Lingkungan"
                  value={formData.bidangkeahlian}
                  onChange={(e) => setFormData({ ...formData, bidangkeahlian: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Pengalaman (Tahun)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.durasi_pengalaman}
                  onChange={(e) => setFormData({ ...formData, durasi_pengalaman: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Foto & KTP */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  URL Pasfoto Resmi (Link Direct/Drive)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.fotoUrl}
                  onChange={(e) => setFormData({ ...formData, fotoUrl: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  URL Dokumen KTP (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.ktpUrl}
                  onChange={(e) => setFormData({ ...formData, ktpUrl: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            {/* 🟢 Narasi Persetujuan Gabung Pakar pada Direktori Pakar */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 10, border: '1px solid #e2e8f0', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', fontSize: 13, lineHeight: 1.5, color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <div>
                  <span>Tampilkan profil saya di <strong>Direktori Pakar Publik</strong> agar dapat diundang pada riset akademis lainnya[cite: 10]. </span>
                  <span style={{ display: 'inline', color: '#475569' }}>
                    Dengan mencentang opsi ini, Saya telah membaca, memahami, dan menyetujui{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#2563eb',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'inline',
                      }}
                    >
                      Syarat &amp; Ketentuan Kolaborasi Pakar
                    </button>
                    .
                  </span>
                </div>
              </label>
            </div>

            {saveSuccessMsg && (
              <div style={{ padding: '8px 12px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
                {saveSuccessMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  padding: '11px 24px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: savingProfile ? 'not-allowed' : 'pointer',
                  opacity: savingProfile ? 0.7 : 1,
                }}
              >
                {savingProfile ? '⏳ Menyimpan...' : '💾 Simpan & Perbarui Profil'}
              </button>
            </div>
          </form>
        </div>

        {/* Langkah 2: Sertifikat Apresiasi */}
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: 14, border: '1.5px solid #2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.08)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e3a8a' }}>Langkah 2: E-Sertifikat Apresiasi Resmi</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#475569' }}>
              Unduh sertifikat penghargaan atas kontribusi keahlian Anda dalam proyek riset ini[cite: 10].
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCertificate}
            style={{
              padding: '10px 18px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
            }}
          >
            📜 Buka Sertifikat
          </button>
        </div>
      </div>

      {/* Modal Syarat & Ketentuan Kolaborasi Pakar (Narasi Gabung Direktori Pakar) */}
      {showTermsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              maxWidth: 680,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📜</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  Syarat &amp; Ketentuan Kolaborasi Pakar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Isi Narasi Klausul Direktori Pakar */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', fontSize: 13, lineHeight: 1.65, color: '#334155' }}>
              <p style={{ margin: '0 0 12px' }}>
                Selamat bergabung dalam ekosistem riset <strong>Direktori Pakar Analytic Hierarchy Process (AHP)</strong>[cite: 10]. Dengan mengonfirmasi ketersediaan profil Anda sebagai pakar penilai, Anda memahami dan menyetujui prinsip kolaborasi berikut:
              </p>

              <ol style={{ paddingLeft: 20, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li>
                  <strong>Komitmen Objektivitas Ilmiah:</strong> Seluruh pertimbangan dan pembobotan perbandingan berpasangan (Pairwise Comparison) diberikan secara independen, profesional, dan mencerminkan keilmuan evaluator guna menjamin integritas rasio konsistensi riset keputusan.
                </li>
                <li>
                  <strong>Visibilitas Rekognisi Akademis:</strong> Identitas kepakaran umum (Nama Lengkap, Gelar Akademik, Asal Instansi, Bidang Spesialisasi, dan Pengalaman) dipublikasikan secara terbuka di Direktori Pakar sebagai bentuk rekam jejak kontribusi ilmiah serta rujukan jejaring riset multi-disiplin.
                </li>
                <li>
                  <strong>Kerahasiaan Kontak &amp; Data Pribadi:</strong> Informasi kontak privat (Nomor WhatsApp dan Alamat Email) serta dokumen verifikasi KTP diamankan sepenuhnya dalam basis data terlindungi, dan hanya digunakan oleh fasilitator/peneliti resmi untuk keperluan koordinasi studi.
                </li>
                <li>
                  <strong>Verifikasi Audit E-Sertifikat:</strong> Setiap partisipasi evaluasi matriks menghasilkan E-Sertifikat resmi yang tercatat permanen pada sistem audit platform dan dapat divalidasi keabsahannya melalui kode QR resmi.
                </li>
                <li>
                  <strong>Otonomi Profil:</strong> Pakar memiliki kendali penuh atas informasi yang ditampilkan dan dapat mengubah status ketersediaan profil dari publik ke privat kapan saja melalui tautan akses mandiri.
                </li>
              </ol>
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, isPublic: true }));
                  setShowTermsModal(false);
                }}
                style={{
                  padding: '9px 20px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                Saya Memahami &amp; Menyetujui
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal E-Sertifikat Elegan & Lengkap */}
      {showCertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 14, maxWidth: 980, width: '100%', maxHeight: '96vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>E-Sertifikat Kontribusi Pakar</h3>
              <button onClick={() => setShowCertModal(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* Area Cetak Sertifikat Berbingkai Ornamen Ganda */}
            <div
              id="certificate-download-area"
              style={{
                background: '#ffffff',
                border: '6px double #1e3a8a',
                padding: '36px 44px',
                position: 'relative',
                boxShadow: 'inset 0 0 0 2px #d97706',
                fontFamily: '"Times New Roman", Times, serif',
                color: '#0f172a',
                overflow: 'hidden',
              }}
            >
              {/* Header / Logo Platform Di Pojok Kiri Atas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: 14, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img
                    src={systemAssets.platform_logo || '/logo.png'}
                    alt="Logo AHP"
                    style={{ height: 65, width: 'auto', objectFit: 'contain' }}
                  />
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e3a8a', letterSpacing: '0.05em', fontFamily: 'Arial, sans-serif' }}>
                      ANALYTIC HIERARCHY PROCESS
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#065f46', fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>
                      Platform Komputasi Riset Keputusan Multi-Kriteria Terintegrasi
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: '#1e3a8a', background: '#eff6ff', padding: '3px 8px', borderRadius: 4, border: '1px solid #bfdbfe', display: 'inline-block' }}>
                    DOKUMEN RESMI TERVERIFIKASI
                  </div>
                  <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 4 }}>
                    No: <strong>{officialCertId}</strong>
                  </div>
                </div>
              </div>

              {/* Judul Sertifikat (Line-Height 1.2) */}
              <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 16 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 48,
                    fontWeight: 900,
                    color: '#1e3a8a',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    lineHeight: 1.2,
                  }}
                >
                  SERTIFIKAT APRESIASI
                </h1>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: 20,
                    color: '#b45309',
                    fontWeight: 700,
                    fontStyle: 'italic',
                    letterSpacing: '0.04em',
                    lineHeight: 1.2,
                  }}
                >
                  CERTIFICATE OF APPRECIATION
                </p>
                <div style={{ width: 160, height: 2, background: '#d97706', margin: '10px auto 0' }} />
              </div>

              {/* Penerima Sertifikat (Underline Dihapus) */}
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 21,
                    color: '#475569',
                    fontStyle: 'italic',
                    lineHeight: 1.2,
                  }}
                >
                  Diberikan dengan penuh penghargaan dan kehormatan kepada:
                </p>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    color: '#0f172a',
                    margin: '10px 0 4px',
                    textDecoration: 'none',
                    lineHeight: 1.2,
                  }}
                >
                  {formattedFullName || expert.expertname}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    color: '#334155',
                    fontWeight: 700,
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: 1.2,
                  }}
                >
                  {formData.asalinstansi || expert.asalinstansi || 'Pakar Penilai Independen'}
                </div>
              </div>

              {/* Narasi Apresiasi */}
              <div
                style={{
                  textAlign: 'center',
                  maxWidth: 720,
                  margin: '0 auto 22px',
                  lineHeight: 1.2,
                  fontSize: 20,
                  color: '#1f2937',
                }}
              >
                Atas dedikasi, kontribusi, dan integritas kepakaran sebagai <strong>Pakar Penilai (Expert Evaluator)</strong> dalam pengisian kuesioner matriks perbandingan berpasangan (Pairwise Comparison) pada riset analitis bertajuk:
                <div
                  style={{
                    fontSize: 22.5,
                    fontWeight: 800,
                    color: '#1e3a8a',
                    margin: '8px 0',
                    fontStyle: 'italic',
                    lineHeight: 1.2,
                  }}
                >
                  "{project.namaproyek}"
                </div>
                Hasil penilaian telah divalidasi dengan nilai rasio konsistensi ilmiah dan tersimpan permanen pada basis data audit sistem[cite: 10].
              </div>

              {/* Area Tanda Tangan & QR Code dengan Kesejajaran Presisi */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 1.2fr',
                  gap: 16,
                  alignItems: 'start',
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px dashed #cbd5e1',
                  fontFamily: 'Arial, sans-serif',
                  position: 'relative',
                }}
              >
                {/* 1. Blok Peneliti / Fasilitator Utama */}
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Peneliti / Fasilitator Utama,
                  </div>

                  <div
                    style={{
                      height: 60,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: -8,
                      marginBottom: -8,
                      position: 'relative',
                      zIndex: 5,
                    }}
                  >
                    {project.fasilitatorsignature ? (
                      <img
                        src={project.fasilitatorsignature}
                        alt="Tanda Tangan Fasilitator"
                        style={{
                          maxHeight: 60,
                          maxWidth: 160,
                          objectFit: 'contain',
                          mixBlendMode: 'multiply',
                          opacity: 0.88,
                          filter: 'contrast(1.15)',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 10, color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: 4, border: '1px solid #86efac', fontWeight: 800 }}>
                        ✓ Terverifikasi Digital
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', textDecoration: 'underline', minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                    {project.fasilitatornama || 'Peneliti Utama'}
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b', minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
                    {project.fasilitatorlembaga || 'Universitas Mataram'}
                  </div>
                </div>

                {/* 2. QR Code Verifikasi Tengah */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                  <div style={{ minHeight: 28 }} />
                  <img
                    src={certQrUrl}
                    alt="QR Sertifikat"
                    style={{ width: 72, height: 72, padding: 3, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' }}
                  />
                  <span style={{ fontSize: 8.5, color: '#64748b', marginTop: 4 }}>Pindai untuk Validasi</span>
                </div>

                {/* 3. Blok Administrator Platform */}
                <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
                    Administrator Platform,
                  </div>

                  <div
                    style={{
                      height: 90,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: -22,
                      marginBottom: -22,
                      position: 'relative',
                      zIndex: 5,
                      pointerEvents: 'none',
                      transform: 'translateX(-50px)',
                    }}
                  >
                    {systemAssets.admin_signature ? (
                      <img
                        src={systemAssets.admin_signature}
                        alt="Tanda Tangan & Stempel Resmi Admin"
                        style={{
                          maxHeight: 125,
                          maxWidth: 240,
                          objectFit: 'contain',
                          mixBlendMode: 'multiply',
                          opacity: 0.68,
                          filter: 'contrast(1.05)',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 10, color: '#1e40af', background: '#eff6ff', padding: '4px 10px', borderRadius: 4, border: '1px solid #bfdbfe', fontWeight: 800 }}>
                        ✓ Official Verified
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', textDecoration: 'underline', minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
                    {systemAssets.admin_name || 'Dr. Arben Virgota, S.Pi., M.Si'}
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b', minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
                    {systemAssets.admin_title || 'Avitech Platform Founder'}
                  </div>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowCertModal(false)}
                style={{ padding: '9px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#475569' }}
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                style={{
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isGeneratingPdf ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                }}
              >
                {isGeneratingPdf ? '⏳ Menyiapkan Dokumen...' : '⬇️ Unduh PDF Resmi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpertSelesaiPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center' }}>Memuat halaman...</div>}>
      <ExpertSelesaiContent />
    </Suspense>
  );
}