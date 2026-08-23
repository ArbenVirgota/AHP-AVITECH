// app/expert-directory/page.tsx

'use client';

import React, { useEffect, useState, useCallback, useMemo, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

// 🟢 1. IMPORT REACT-JOYRIDE
import { CallBackProps, STATUS, Step } from 'react-joyride';
import dynamic from 'next/dynamic';

// Menggunakan dynamic import untuk mem-bypass error ESM & mencegah error SSR Next.js
const Joyride = dynamic(
  () => import('react-joyride').then((mod: any) => mod.default || mod),
  { ssr: false }
) as any;

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

// 🟢 BATAS KUOTA PAKAR SESUAI ATURAN PLAN USER (KAPITAL)
const PLAN_LIMITS: Record<string, number> = {
  PUBLIC: 3,       // Pengunjung belum login (GUEST)
  FREE: 5,         // User terdaftar paket Gratis/Free
  BASIC: 10,       // User paket Basic
  PRO: 25,         // User paket Pro
  PLUS: 40,        // User paket Plus
  PREMIUM: 999,    // User paket Premium / Unlimited
  ENTERPRISE: 999, // User paket Enterprise / Unlimited
  SUPERADMIN: 999
};

interface ExpertDirectoryItem {
  id?: string;
  expert_id?: string;
  expertId?: string;
  projectid?: string;
  project_id?: string;
  project_title?: string;
  projecttitle?: string;
  namaproyek?: string;
  gelar_depan?: string;
  gelardepan?: string;
  expertname?: string;
  expert_name?: string;
  expertName?: string;
  nama?: string;
  gelar_belakang?: string;
  gelarbelakang?: string;
  expertemail?: string;
  expert_email?: string;
  email?: string;
  expertwhatsapp?: string;
  expert_whatsapp?: string;
  whatsapp?: string;
  asalinstansi?: string;
  asal_instansi?: string;
  instansi?: string;
  pendidikanterakhir?: string;
  pendidikan_terakhir?: string;
  pendidikan?: string;
  bidangkeahlian?: string;
  bidang_keahlian?: string;
  bidang?: string;
  pengalaman?: number | string;
  durasi_pengalaman?: number | string;
  pengalaman_tahun?: number | string;
  durasipengalaman?: number | string;
  durasiPengalaman?: number | string;
  foto_url?: string;
  fotoUrl?: string;
  portofolio_url?: string;
  portofolioUrl?: string;
  status?: string;
  average_rating?: number;
  total_reviews?: number;
  is_public?: string | boolean;
  ispublic?: string | boolean;
  [key: string]: any;
}

function formatDriveDirectLink(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmedUrl = url.trim();

  const driveFileRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const matchFile = trimmedUrl.match(driveFileRegex);
  if (matchFile && matchFile[1]) {
    return `https://lh3.googleusercontent.com/d/${matchFile[1]}`;
  }

  const driveIdRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
  const matchId = trimmedUrl.match(driveIdRegex);
  if (matchId && matchId[1]) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  }

  return trimmedUrl;
}

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
    return { displayPhone: clean, waLinkPhone: clean, isValid: false, errorMsg: 'Nomor HP harus diawali 08..., 628..., atau 8...' };
  }

  if (internationalFormat.length < 10 || internationalFormat.length > 15) {
    return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: false, errorMsg: 'Jumlah digit nomor HP tidak valid.' };
  }

  return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: true, errorMsg: '' };
}

function getVal(item: ExpertDirectoryItem, keys: (keyof ExpertDirectoryItem)[]): string {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
      return String(item[k]).trim();
    }
  }
  return '';
}

function getDurasiPengalaman(item: ExpertDirectoryItem): string {
  const specificKeys = ['pengalaman', 'durasi_pengalaman', 'durasiPengalaman', 'durasipengalaman', 'pengalaman_tahun'];
  for (const k of specificKeys) {
    const val = item[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const strVal = String(val).trim();
      
      if (strVal.toLowerCase().includes('tahun')) {
        return strVal;
      }
      
      const num = Number(strVal);
      if (!isNaN(num) && num > 0) {
        return `${num} Tahun`;
      }
      
      return `${strVal} Tahun`;
    }
  }
  return 'Tidak disetel';
}

function renderStarRating(rating?: number, totalReviews?: number) {
  const safeRating = Number.isFinite(rating) ? Number(rating) : 0;
  const safeReviews = Number.isFinite(totalReviews) ? Number(totalReviews) : 0;
  const fullStars = Math.floor(safeRating);
  let stars = '';
  for (let i = 0; i < fullStars; i++) stars += '★';
  for (let i = fullStars; i < 5; i++) stars += '☆';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <span style={{ color: '#f59e0b', fontSize: 15, letterSpacing: 1 }}>{stars}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
        {safeRating > 0 ? `${safeRating.toFixed(1)} / 5.0` : 'Belum ada rating'} 
        {safeReviews > 0 && <span style={{ color: '#64748b', fontWeight: 400 }}> ({safeReviews} ulasan)</span>}
      </span>
    </div>
  );
}

// ============================================================================
// 🟢 2. KOMPONEN ONBOARDING TOUR KHUSUS DIREKTORI PAKAR
// ============================================================================
function ExpertDirectoryOnboardingTour() {
  const [run, setRun] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const hasSeenTutorial = localStorage.getItem('ahp_tour_expert_directory');
    
    if (!hasSeenTutorial) {
      setTimeout(() => setRun(true), 1200); 
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      localStorage.setItem('ahp_tour_expert_directory', 'true');
      setRun(false);
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Selamat datang di Direktori Pakar! Di sini Anda dapat menemukan dan terhubung dengan berbagai pakar terverifikasi.',
      title: '👥 Direktori Pakar',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-gabung',
      content: 'Jika Anda memiliki kepakaran khusus, Anda juga dapat bergabung ke direktori ini untuk membantu peneliti lain dan mendapatkan benefit khusus.',
      title: '🌟 Gabung Sebagai Pakar',
      placement: 'bottom',
    },
    {
      target: '.tour-search',
      content: 'Gunakan kolom pencarian ini untuk menemukan pakar berdasarkan nama, bidang keahlian, atau asal institusi mereka.',
      title: '🔍 Cari Pakar',
      placement: 'bottom',
    },
    {
      target: '.tour-konsultasi',
      content: 'Klik tombol ini untuk mengirimkan pertanyaan atau tiket konsultasi langsung kepada pakar yang bersangkutan. (Membutuhkan Login)',
      title: '💬 Ajukan Konsultasi',
      placement: 'top',
    }
  ];

  if (!isMounted) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb', // Warna biru 
          textColor: '#334155',
          zIndex: 100000,
        },
        buttonClose: {
          display: 'none',
        },
        tooltipContainer: {
          textAlign: 'left'
        }
      }}
      locale={{
        back: 'Kembali',
        close: 'Tutup',
        last: 'Paham!',
        next: 'Lanjut',
        skip: 'Lewati Tur',
      }}
    />
  );
}
// ============================================================================

export default function ExpertDirectoryPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<ExpertDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPlan, setUserPlan] = useState('PUBLIC');

  // Modal Ajukan Pakar
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applicantGelarDepan, setApplicantGelarDepan] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantGelarBelakang, setApplicantGelarBelakang] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantWa, setApplicantWa] = useState('');
  const [waError, setWaError] = useState('');
  const [applicantInstansi, setApplicantInstansi] = useState('');
  const [applicantPendidikan, setApplicantPendidikan] = useState('S2 / Magister');
  const [applicantKeahlian, setApplicantKeahlian] = useState('');
  const [applicantPengalaman, setApplicantPengalaman] = useState('');
  const [applicantPortoUrl, setApplicantPortoUrl] = useState('');
  
  // State Upload KTP (Base64)
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpBase64, setKtpBase64] = useState<string>('');
  const [ktpError, setKtpError] = useState<string>('');

  // State Upload Foto Profil Opsional (Base64)
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string>('');
  const [fotoError, setFotoError] = useState<string>('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);

  // State Modal Form Tiket Konsultasi Publik
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultTargetExpert, setConsultTargetExpert] = useState('');
  const [consultTargetExpertId, setConsultTargetExpertId] = useState('');
  const [consultTargetExpertEmail, setConsultTargetExpertEmail] = useState('');
  const [consultUserName, setConsultUserName] = useState('');
  const [consultUserContact, setConsultUserContact] = useState('');
  const [consultInstitusi, setConsultInstitusi] = useState('');
  const [consultQuestion, setConsultQuestion] = useState('');
  const [submittingConsult, setSubmittingConsult] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const session = getSession();
    const hasValidUser = Boolean(session && typeof session === 'object' && (session.email || session.id || session.user_id));
    const activeEmail = session?.email || session?.user_email || '';
    const activeName = session?.nama || session?.name || session?.user_name || '';
    
    setIsLoggedIn(hasValidUser);
    setUserEmail(activeEmail);
    setUserName(activeName);

    if (hasValidUser && session) {
      const rawPlan = String(session.plan || session.subscription_plan || session.paket || session.role || 'FREE').toUpperCase().trim();
      if (rawPlan.includes('SUPER')) {
        setUserPlan('SUPERADMIN');
      } else if (rawPlan.includes('PREMIUM')) {
        setUserPlan('PREMIUM');
      } else if (rawPlan.includes('PLUS')) {
        setUserPlan('PLUS');
      } else if (rawPlan.includes('PRO')) {
        setUserPlan('PRO');
      } else if (rawPlan.includes('BASIC')) {
        setUserPlan('BASIC');
      } else {
        setUserPlan('FREE');
      }
    } else {
      setUserPlan('PUBLIC');
    }

    // 🟢 SINKRONISASI PLAN DINAMIS: Ambil status plan terbaru langsung dari database/subscriptions
    if (activeEmail && GOOGLESCRIPTURL) {
      fetch(`${GOOGLESCRIPTURL}?action=getsubscription&email=${encodeURIComponent(activeEmail)}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(json => {
          if (json && json.success && json.data && json.data.plan) {
            const fetchedPlan = String(json.data.plan).toUpperCase().trim();
            if (fetchedPlan) {
              setUserPlan(fetchedPlan);
            }
          }
        })
        .catch(err => {
          console.warn("Gagal menyinkronkan plan terbaru secara live:", err);
        });
    }

    fetchDirectory();
  }, []);

  const fetchDirectory = async () => {
    if (!GOOGLESCRIPTURL) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${GOOGLESCRIPTURL}?action=getpublicexperts`, { cache: 'no-store' });
      const json = await res.json();
      
      if (json && json.success && Array.isArray(json.data)) {
        setExperts(json.data);
      }
    } catch (err) {
      console.error('Gagal memuat direktori pakar:', err);
    } finally {
      setLoading(false);
    }
  };

  const processedExperts = useMemo(() => {
    let list = experts.filter(exp => {
      // 🟢 SINKRONISASI STATUS: Hanya ambil pakar yang berstatus AKTIF atau kosong (dianggap aktif)
      const statusValue = String(exp.status || 'Aktif').trim().toLowerCase();
      const isActive = statusValue === 'aktif' || statusValue === 'active' || statusValue === '';
      
      const isPub = String(exp.is_public || exp.ispublic || 'PUBLIK').toUpperCase();
      const isPublicVisible = isPub !== 'FALSE' && isPub !== 'PRIVAT';

      return isActive && isPublicVisible;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(exp => {
        const name = String(exp.expert_name || exp.expertname || exp.nama || '').toLowerCase();
        const keahlian = String(exp.bidang_keahlian || exp.keahlian || '').toLowerCase();
        const instansi = String(exp.asal_instansi || exp.instansi || '').toLowerCase();
        return name.includes(q) || keahlian.includes(q) || instansi.includes(q);
      });
    }

    list.sort((a, b) => {
      const ratingA = Number(a.average_rating || a.rating || 0);
      const ratingB = Number(b.average_rating || b.rating || 0);
      return ratingB - ratingA; // Urutkan dari rating tertinggi ke terendah
    });

    const limit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.PUBLIC;
    const limitedList = list.slice(0, limit);

    return {
      displayed: limitedList,
      totalAvailable: list.length,
      limitApplied: limit,
      hasMore: list.length > limit
    };
  }, [experts, searchQuery, userPlan]);

  const handleWaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const numericOnly = rawVal.replace(/[^\d]/g, '');
    setApplicantWa(numericOnly);
    if (numericOnly) {
      const check = processPhoneNumber(numericOnly);
      setWaError(check.isValid ? '' : check.errorMsg);
    } else {
      setWaError('');
    }
  };

  const handleKtpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setKtpError('');
    
    if (!file) {
      setKtpFile(null);
      setKtpBase64('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setKtpError('Format tidak valid. KTP harus berupa gambar (JPG/PNG).');
      e.target.value = '';
      return;
    }

    setKtpFile(file);

    const img = document.createElement('img');
    const reader = new FileReader();

    reader.onload = (ev) => {
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 500;

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
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
        setKtpBase64(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFotoError('');
    
    if (!file) {
      setFotoFile(null);
      setFotoBase64('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFotoError('Format tidak valid. Foto profil harus berupa gambar (JPG/PNG).');
      e.target.value = '';
      return;
    }

    setFotoFile(file);

    const img = document.createElement('img');
    const reader = new FileReader();

    reader.onload = (ev) => {
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 400;

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
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.4);
        setFotoBase64(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const resetFormState = () => {
    setShowApplyModal(false);
    setApplicantGelarDepan('');
    setApplicantName('');
    setApplicantGelarBelakang('');
    setApplicantEmail('');
    setApplicantWa('');
    setApplicantInstansi('');
    setApplicantKeahlian('');
    setApplicantPengalaman('');
    setApplicantPortoUrl('');
    setKtpFile(null);
    setKtpBase64('');
    setKtpError('');
    setFotoFile(null);
    setFotoBase64('');
    setFotoError('');
    setAgreedToTerms(false);
  };

  const handleApplyExpertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !applicantKeahlian || !applicantEmail || !applicantWa) {
      alert('Nama Utama, Email, No. WhatsApp, dan Bidang Keahlian wajib diisi.');
      return;
    }

    if (!ktpBase64) {
      alert('Upload foto KTP wajib diisi untuk verifikasi identitas.');
      return;
    }
    
    if (ktpError) {
      alert('Terdapat kesalahan pada file KTP yang diunggah. Mohon perbaiki.');
      return;
    }

    if (fotoError) {
      alert('Terdapat kesalahan pada file Foto Profil yang diunggah. Mohon perbaiki atau kosongkan jika tidak ingin memakai foto.');
      return;
    }

    if (!agreedToTerms) {
      alert('Anda harus mencentang persetujuan Syarat & Ketentuan Kolaborasi Pakar sebelum melanjutkan.');
      return;
    }

    const phoneCheck = processPhoneNumber(applicantWa);
    if (!phoneCheck.isValid) {
      alert(`Format Nomor WhatsApp Salah: ${phoneCheck.errorMsg}`);
      return;
    }

    const confirmMessage = "Apakah Anda yakin data profil yang diisi sudah benar?\n\nSetelah klik OK, data akan disimpan sesuai konfigurasi sistem verifikasi yang berlaku.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setSubmittingApply(true);
      const emailBersih = applicantEmail.trim().toLowerCase();
      
      let isDiditEnabled = true;
      try {
        const resSetting = await fetch(`${GOOGLESCRIPTURL}?action=getdiditsettings`, { cache: 'no-store' });
        const jsonSetting = await resSetting.json();
        if (jsonSetting && jsonSetting.diditme !== undefined) {
          isDiditEnabled = Boolean(jsonSetting.diditme);
        }
      } catch (e) {
        // Fallback default true
      }

      const payloadSource = isDiditEnabled ? 'public_dashboard' : 'admin_dashboard';

      const payload = {
        action: 'saveexpert',
        source: payloadSource, 
        gelar_depan: applicantGelarDepan.trim(),
        expert_name: applicantName.trim(),
        expertname: applicantName.trim(),
        nama: applicantName.trim(),
        gelar_belakang: applicantGelarBelakang.trim(),
        email: emailBersih,
        expert_email: emailBersih,
        whatsapp: phoneCheck.waLinkPhone,
        expert_whatsapp: phoneCheck.waLinkPhone,
        asal_instansi: applicantInstansi.trim(),
        pendidikan_terakhir: applicantPendidikan,
        bidang_keahlian: applicantKeahlian.trim(),
        durasi_pengalaman: applicantPengalaman.trim(),
        status: isDiditEnabled ? 'Pending Verifikasi' : 'Aktif',
        verification_method: isDiditEnabled ? 'Didit.me' : 'Manual Admin',
        didit_verified: !isDiditEnabled,
        is_public: 'PUBLIK',
        portofolio_url: applicantPortoUrl,
        portofolioUrl: applicantPortoUrl,
        
        ktp_base64: ktpBase64,
        ktp_url: ktpBase64,
        ktpUrl: ktpBase64,
        ktp_filename: ktpFile?.name,
        
        foto_base64: fotoBase64,
        foto_url: fotoBase64,
        fotoUrl: fotoBase64,
        foto_filename: fotoFile?.name
      };

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const textRes = await res.text();
      let json;
      try {
        json = JSON.parse(textRes);
      } catch {
        throw new Error('Respons server tidak valid.');
      }
      
      if (json && json.success) {
        const newExpertId = json.expert_id || json.data?.expert_id || '';

        if (!isDiditEnabled) {
          alert('✅ Pendaftaran berhasil dicatat! Verifikasi otomatis Didit.me sedang dinonaktifkan oleh administrator, data Anda langsung diproses secara manual.');
          resetFormState();
          fetchDirectory();
          return;
        }

        try {
          const resDidit = await fetch('/api/didit/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: emailBersih,
              expertId: newExpertId
            })
          });

          const jsonDidit = await resDidit.json();

          if (jsonDidit.success && jsonDidit.verification_url) {
            alert('Data profil berhasil diamankan! Anda sekarang akan dialihkan ke sistem Didit.me untuk pemindaian wajah dan identitas asli.');
            window.location.href = jsonDidit.verification_url; 
            
          } else {
            alert('Data tersimpan, tapi gagal membuat sesi verifikasi Didit: ' + (jsonDidit.message || 'Error tidak diketahui.'));
            resetFormState();
          }

        } catch (diditErr) {
          console.error("Error Didit:", diditErr);
          alert('Data tersimpan, tapi gagal menghubungi server verifikasi. Hubungi Admin.');
          resetFormState();
        }
      } else {
        alert(json.message || 'Gagal mengirim pendaftaran.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Terjadi kesalahan jaringan (Failed to fetch): ${err.message}`);
    } finally {
      setSubmittingApply(false);
    }
  };

  const handleOpenConsultModal = async (exp: ExpertDirectoryItem, formattedName: string) => {
    if (!isLoggedIn) {
      alert('Akses Terbatas: Silakan melakukan Login atau Registrasi Akun terlebih dahulu untuk dapat berkonsultasi dengan pakar.');
      router.push('/login');
      return;
    }

    const expId = exp.expert_id || exp.expertId || exp.id || 'EXP-UNKNOWN';
    const expEmail = getVal(exp, ['expert_email', 'expertemail', 'email', 'expertEmail', 'kontak_expert', 'kontakExpert']);

    setConsultTargetExpert(formattedName);
    setConsultTargetExpertId(expId);
    setConsultTargetExpertEmail(expEmail.trim().toLowerCase());
    setConsultUserContact(userEmail);
    
    setConsultUserName('Memuat dari tab users...');
    setConsultInstitusi('Memuat dari tab users...');
    setShowConsultModal(true);

    if (GOOGLESCRIPTURL && userEmail) {
      try {
        const res = await fetch(`${GOOGLESCRIPTURL}?action=getconsultationuserprofile&email=${encodeURIComponent(userEmail)}`, { cache: 'no-store' });
        const json = await res.json();
        
        if (json && json.success && json.data) {
          setConsultUserName(json.data.nama || userName || 'User');
          setConsultInstitusi(json.data.asal_instansi || '-');
        } else {
          const session = getSession();
          setConsultUserName(session?.nama || session?.name || session?.user_name || userName || 'User');
          setConsultInstitusi(session?.asal_instansi || session?.asalinstansi || session?.instansi || session?.institution || '-');
        }
      } catch (err) {
        console.warn('Gagal memuat profil dari tab users:', err);
        const session = getSession();
        setConsultUserName(session?.nama || session?.name || session?.user_name || userName || 'User');
        setConsultInstitusi(session?.asal_instansi || session?.asalinstansi || session?.instansi || session?.institution || '-');
      }
    }
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultUserName || !consultUserContact || !consultInstitusi || !consultQuestion) {
      alert('Nama, Kontak Balasan, Asal Institusi, dan Pesan Pertanyaan wajib diisi.');
      return;
    }

    try {
      setSubmittingConsult(true);
      const ticketId = `TCK-${Date.now()}`;

      const payload = {
        action: 'submitconsultation', 
        ticket_id: ticketId,
        ticketId: ticketId,
        expert_id: consultTargetExpertId,
        expertId: consultTargetExpertId,
        expert_email: consultTargetExpertEmail,
        expertEmail: consultTargetExpertEmail,
        expertemail: consultTargetExpertEmail,
        expert_name: consultTargetExpert, 
        expertName: consultTargetExpert,
        user_name: consultUserName.trim(),
        userName: consultUserName.trim(),
        user_email: consultUserContact.trim().toLowerCase(),
        userEmail: consultUserContact.trim().toLowerCase(),
        kontakUser: consultUserContact.trim().toLowerCase(),
        asal_instansi: consultInstitusi.trim(),
        asalInstitusi: consultInstitusi.trim(),
        pertanyaan: consultQuestion.trim(),
        userPlan: userPlan || 'FREE',
        target_type: 'expert', 
        status: 'Pending'
      };

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const json = JSON.parse(await res.text());
      if (json && json.success) {
        alert(`Tiket konsultasi (#${ticketId}) berhasil dikirimkan ke Yth. Bapak/Ibu ${consultTargetExpert}.`);
        setShowConsultModal(false);
        setConsultQuestion('');
      } else {
        alert(json.message || 'Gagal mengirim permintaan konsultasi.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Terjadi kesalahan koneksi (Failed to fetch): ${err.message}`);
    } finally {
      setSubmittingConsult(false);
    }
  };

  return (
    <div style={STYLES.page}>
      
      {/* 🟢 SISIPKAN KOMPONEN TOUR JOYRIDE DI SINI */}
      <ExpertDirectoryOnboardingTour />

      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Direktori Pakar (Expert Directory)</h1>
            <p style={STYLES.pageDesc}>
              {isLoggedIn 
                ? 'Kumpulan profil lengkap pakar terverifikasi. Gunakan tombol konsultasi untuk terhubung dengan pakar pilihan Anda.'
                : 'Menampilkan sampel profil pakar akademik. Silakan lakukan registrasi atau masuk untuk membuka direktori lengkap.'}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setShowApplyModal(true)} className="tour-gabung" style={STYLES.btnApplyExpert}>
              🌟 Gabung Sebagai Pakar
            </button>
            <button type="button" onClick={() => router.push('/')} style={STYLES.btnSecondary}>
              ← Beranda Utama
            </button>
            {isMounted && (
              isLoggedIn ? (
                <button type="button" onClick={() => router.push('/dashboard')} style={STYLES.btnPrimaryAction}>
                  🚀 Dashboard Kerja
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => router.push('/login')} style={STYLES.btnSecondary}>
                    🔑 Masuk
                  </button>
                  <button type="button" onClick={() => router.push('/register')} style={STYLES.btnPrimaryAction}>
                    ✨ Registrasi
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {!isLoggedIn ? (
          <div style={STYLES.guestNoticeBox}>
            <div style={{ fontSize: 24 }}>💡</div>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#1e3a8a', fontSize: 14 }}>
                Ingin Melihat Lebih Banyak Pakar &amp; Melakukan Konsultasi?
              </strong>
              <p style={{ margin: '3px 0 8px 0', fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.4 }}>
                Anda saat ini berada dalam mode pratinjau publik (*Public Preview*). Publik/umum tidak dapat melakukan konsultasi sebelum memiliki akun terdaftar. Silakan lakukan <strong>Registrasi Akun</strong> secara gratis.
              </p>
              <button onClick={() => router.push('/register')} style={STYLES.btnRegisterBanner}>
                Daftar Akun Sekarang →
              </button>
            </div>
          </div>
        ) : (
          <div style={STYLES.planBadgeBox}>
            <span style={{ fontSize: 13, color: '#0f172a' }}>
              Status Paket Anda: <strong style={{ color: '#2563eb', textTransform: 'uppercase' }}>{userPlan} PLAN</strong>
            </span>
            <span style={{ fontSize: 12, color: '#475569' }}>
              | Menampilkan <strong>{processedExperts.displayed.length}</strong> dari {processedExperts.totalAvailable} pakar (Batas Paket: {processedExperts.limitApplied} Pakar)
            </span>
            {processedExperts.hasMore && (
              <button onClick={() => router.push('/pricing')} style={STYLES.btnUpgradePlan}>
                ⚡ Upgrade Paket untuk Akses Lebih Banyak Pakar
              </button>
            )}
          </div>
        )}

        {isLoggedIn && (
          <div className="tour-search" style={STYLES.searchBarWrap}>
            <input
              type="text"
              placeholder="Cari berdasarkan nama, bidang keahlian, atau instansi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={STYLES.searchInput}
            />
          </div>
        )}

        {loading ? (
          <div style={STYLES.loader}>Memuat Data Direktori Pakar...</div>
        ) : processedExperts.displayed.length === 0 ? (
          <div style={STYLES.emptyBox}>Belum ada data pakar yang aktif atau tersedia saat ini.</div>
        ) : (
          <>
            <div style={STYLES.grid}>
              {processedExperts.displayed.map((exp, idx) => {
                const gDepan = getVal(exp, ['gelar_depan', 'gelardepan']);
                const nameCore = getVal(exp, ['expert_name', 'expertname', 'nama']) || 'Pakar Tanpa Nama';
                const gBelakang = getVal(exp, ['gelar_belakang', 'gelarbelakang']);
                
                const formattedName = `${gDepan ? gDepan + ' ' : ''}${nameCore}${gBelakang ? ', ' + gBelakang : ''}`;

                const bidang = getVal(exp, ['bidang_keahlian', 'bidang']) || 'Umum';
                const instansi = getVal(exp, ['asal_instansi', 'instansi']) || '-';
                const pendidikan = getVal(exp, ['pendidikan_terakhir', 'pendidikan']) || '-';
                const rawFoto = getVal(exp, ['foto_url', 'fotoUrl', 'foto']) || '';
                const foto = formatDriveDirectLink(rawFoto);
                const teksPengalaman = getDurasiPengalaman(exp);

                return (
                  <div key={idx} style={STYLES.card}>
                    <div style={STYLES.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {foto ? (
                          <img src={foto} alt={formattedName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                            👤
                          </div>
                        )}
                        <div>
                          <h3 style={STYLES.expertName}>{formattedName}</h3>
                          <span style={STYLES.badge}>{bidang}</span>
                        </div>
                      </div>
                    </div>

                    <div style={STYLES.cardBody}>
                      <p style={STYLES.cardText}><strong>Instansi:</strong> {instansi}</p>
                      <p style={STYLES.cardText}><strong>Pendidikan:</strong> {pendidikan}</p>
                      <p style={STYLES.cardText}><strong>Pengalaman:</strong> {teksPengalaman}</p>

                      {isLoggedIn ? (
                        <button 
                          onClick={() => handleOpenConsultModal(exp, formattedName)} 
                          className={idx === 0 ? "tour-konsultasi" : ""}
                          style={STYLES.btnConsultAction}
                        >
                          💬 Ajukan Konsultasi
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleOpenConsultModal(exp, formattedName)} 
                          style={{ ...STYLES.btnConsultAction, background: '#475569' }}
                        >
                          🔒 Login untuk Konsultasi
                        </button>
                      )}

                      <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        {renderStarRating(exp.average_rating, exp.total_reviews)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {processedExperts.hasMore && (
              <div style={STYLES.moreHiddenNotice}>
                🔒 Terdapat pakar lainnya yang tersembunyi berdasarkan batas kuota akun Anda. 
                {!isLoggedIn ? (
                  <span> Silakan <a href="/register" style={{ color: '#2563eb', fontWeight: 700 }}>Registrasi Akun</a> untuk membuka akses pakar lebih banyak.</span>
                ) : (
                  <span> Tingkatkan <a href="/pricing" style={{ color: '#2563eb', fontWeight: 700 }}>Paket Langganan</a> Anda untuk melihat seluruh direktori.</span>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal Apply Expert */}
        {showApplyModal && (
          <div style={STYLES.modalOverlay} onClick={() => setShowApplyModal(false)}>
            <div style={STYLES.modalContent} onClick={(e) => e.stopPropagation()}>
              
              {/* Header Modal (Sticky) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>🌟 Gabung Sebagai Pakar (Expert)</h3>
                <button onClick={() => setShowApplyModal(false)} style={STYLES.btnCloseModal}>✕</button>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.5, flexShrink: 0 }}>
                Bantu peneliti dan mahasiswa menyempurnakan riset mereka. Sebagai apresiasi, Anda akan mendapatkan <strong>E-Sertifikat Kolaborasi Riset</strong>, <strong>Eksposur Profil Akademik</strong>, dan <strong>Akses Gratis Akun Pro</strong>.
              </div>

              {/* Form Content (Scrollable Area) */}
              <form 
                onSubmit={handleApplyExpertSubmit} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12, 
                  overflowY: 'auto', 
                  paddingRight: 4, 
                  flexGrow: 1, 
                  marginBottom: 12 
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.fieldLabel}>Gelar Depan</label>
                    <input type="text" placeholder="Dr. / Prof." value={applicantGelarDepan} onChange={(e) => setApplicantGelarDepan(e.target.value)} style={STYLES.inputModal} />
                  </div>
                  <div>
                    <label style={STYLES.fieldLabel}>Nama Utama *</label>
                    <input type="text" placeholder="Nama tanpa gelar" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} style={STYLES.inputModal} required />
                  </div>
                  <div>
                    <label style={STYLES.fieldLabel}>Gelar Belakang</label>
                    <input type="text" placeholder="S.Kom., M.T." value={applicantGelarBelakang} onChange={(e) => setApplicantGelarBelakang(e.target.value)} style={STYLES.inputModal} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.fieldLabel}>Email Aktif *</label>
                    <input type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} style={STYLES.inputModal} required />
                  </div>
                  <div>
                    <label style={STYLES.fieldLabel}>Nomor WhatsApp *</label>
                    <input type="text" placeholder="081234..." value={applicantWa} onChange={handleWaChange} style={STYLES.inputModal} required />
                    {waError && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{waError}</span>}
                  </div>
                </div>

                <div>
                  <label style={STYLES.fieldLabel}>Asal Instansi / Universitas</label>
                  <input type="text" placeholder="Universitas XYZ" value={applicantInstansi} onChange={(e) => setApplicantInstansi(e.target.value)} style={STYLES.inputModal} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.fieldLabel}>Bidang Keahlian Utama *</label>
                    <input type="text" placeholder="SPK, AHP, Kebijakan Publik" value={applicantKeahlian} onChange={(e) => setApplicantKeahlian(e.target.value)} style={STYLES.inputModal} required />
                  </div>
                  <div>
                    <label style={STYLES.fieldLabel}>Lama Pengalaman (Tahun)</label>
                    <input type="number" min="0" placeholder="Contoh: 5" value={applicantPengalaman} onChange={(e) => setApplicantPengalaman(e.target.value)} style={STYLES.inputModal} />
                  </div>
                </div>

                <div>
                  <label style={STYLES.fieldLabel}>URL Portofolio (Google Scholar/SINTA)</label>
                  <input type="url" placeholder="https://scholar.google..." value={applicantPortoUrl} onChange={(e) => setApplicantPortoUrl(e.target.value)} style={STYLES.inputModal} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.fieldLabel}>Upload KTP (Wajib) *</label>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleKtpUpload} 
                      style={{
                        ...STYLES.inputModal,
                        padding: '7px 12px',
                        border: ktpError ? '1.5px solid #dc2626' : '1px solid #cbd5e1'
                      }} 
                      required 
                    />
                    {ktpError && (
                      <span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>
                        ⚠️ {ktpError}
                      </span>
                    )}
                    {!ktpError && (
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Format: JPG/PNG. 🔒 KTP disembunyikan dari publik.
                      </span>
                    )}
                    {ktpBase64 && !ktpError && (
                      <div style={{ marginTop: 10 }}>
                        <img 
                          src={ktpBase64} 
                          alt="Preview KTP" 
                          style={{ height: 60, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={STYLES.fieldLabel}>Upload Foto Profil (Opsional)</label>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleFotoUpload} 
                      style={{
                        ...STYLES.inputModal,
                        padding: '7px 12px',
                        border: fotoError ? '1.5px solid #dc2626' : '1px solid #cbd5e1'
                      }} 
                    />
                    {fotoError && (
                      <span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>
                        ⚠️ {fotoError}
                      </span>
                    )}
                    {!fotoError && (
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Format: JPG/PNG.
                      </span>
                    )}
                    {fotoBase64 && !fotoError && (
                      <div style={{ marginTop: 10 }}>
                        <img 
                          src={fotoBase64} 
                          alt="Preview Foto" 
                          style={{ height: 60, width: 60, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={agreedToTerms} 
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>
                      Saya telah membaca, memahami, dan menyetujui{' '}
                      <a 
                        href="/terms-expert" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Syarat & Ketentuan Kolaborasi Pakar
                      </a>{' '}
                      (termasuk komitmen layanan respons, masa berlaku sertifikat 1 tahun, serta pemahaman bahwa kolaborasi awal ini bersifat non-finansial).
                    </span>
                  </label>
                </div>
              </form>

              {/* Action Buttons (Sticky Footer) */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowApplyModal(false)} style={STYLES.btnCancelModal}>Batal</button>
                <button 
                  type="button" 
                  onClick={handleApplyExpertSubmit} 
                  disabled={submittingApply || !agreedToTerms} 
                  style={{ ...STYLES.btnSubmitModal, opacity: (!agreedToTerms || submittingApply) ? 0.6 : 1, cursor: (!agreedToTerms || submittingApply) ? 'not-allowed' : 'pointer' }}
                >
                  {submittingApply ? 'Mengirim Data...' : 'Kirim Pendaftaran'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal Form Konsultasi User */}
        {showConsultModal && (
          <div style={STYLES.modalOverlay} onClick={() => setShowConsultModal(false)}>
            <div style={STYLES.modalContent} onClick={(e) => e.stopPropagation()}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>💬 Ajukan Tiket Konsultasi</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>
                    Pakar Tujuan: <strong>Yth. Bapak/Ibu {consultTargetExpert}</strong>
                  </p>
                </div>
                <button onClick={() => setShowConsultModal(false)} style={STYLES.btnCloseModal}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#334155', lineHeight: 1.5, flexShrink: 0 }}>
                💡 <strong>Informasi Profil:</strong> Nama dan Asal Institusi Anda ditarik otomatis dari data akun yang terdaftar. Silakan lengkapi rincian pertanyaan riset Anda di bawah ini.
              </div>

              <form 
                onSubmit={handleConsultSubmit} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12, 
                  overflowY: 'auto', 
                  paddingRight: 4, 
                  flexGrow: 1, 
                  marginBottom: 12 
                }}
              >
                <div>
                  <label style={STYLES.fieldLabel}>Nama Lengkap Anda (Dari Tab users)*</label>
                  <input 
                    type="text" 
                    disabled 
                    value={consultUserName} 
                    style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} 
                    required 
                  />
                </div>

                <div>
                  <label style={STYLES.fieldLabel}>Email / Kontak Anda (Dari Tab users)*</label>
                  <input 
                    type="email" 
                    disabled 
                    value={consultUserContact} 
                    style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} 
                    required 
                  />
                </div>

                <div>
                  <label style={STYLES.fieldLabel}>Asal Institusi / Universitas (Dari Tab users)*</label>
                  <input 
                    type="text" 
                    disabled 
                    value={consultInstitusi} 
                    style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} 
                    required 
                  />
                </div>

                <div>
                  <label style={STYLES.fieldLabel}>Pertanyaan atau Permasalahan Riset secara Rinci *</label>
                  <textarea 
                    rows={4} 
                    placeholder="Uraikan latar belakang singkat, kendala metode, atau pertanyaan spesifik yang ingin dikonsultasikan..." 
                    value={consultQuestion} 
                    onChange={(e) => setConsultQuestion(e.target.value)} 
                    style={{ ...STYLES.inputModal, resize: 'vertical' }} 
                    required 
                  />
                </div>
              </form>

              <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowConsultModal(false)} style={STYLES.btnCancelModal}>Batal</button>
                <button type="button" onClick={handleConsultSubmit} disabled={submittingConsult} style={STYLES.btnSubmitModal}>
                  {submittingConsult ? 'Mengirim...' : 'Kirim Tiket Konsultasi →'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const STYLES: Record<string, CSSProperties> = {
  page: { 
    backgroundImage: 'url("/bg-pakar.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    minHeight: '100vh', 
    padding: '32px 20px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  container: { maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  pageTitle: { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' },
  pageDesc: { margin: '4px 0 0', color: '#334155', fontSize: 14, fontWeight: 600, textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' },
  btnApplyExpert: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSecondary: { background: 'rgba(255,255,255,0.92)', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnPrimaryAction: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnConsultAction: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', textAlign: 'center', marginTop: 8 },
  
  guestNoticeBox: { background: 'rgba(239, 246, 255, 0.95)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' },
  btnRegisterBanner: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },

  planBadgeBox: { background: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnUpgradePlan: { marginLeft: 'auto', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },

  searchBarWrap: { width: '100%' },
  searchInput: { width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', background: 'rgba(255, 255, 255, 0.95)' },
  loader: { textAlign: 'center', padding: '40px', color: '#1e293b', fontSize: 15, fontWeight: 700 },
  emptyBox: { background: 'rgba(255, 255, 255, 0.95)', padding: '30px', borderRadius: 12, textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  card: { background: 'rgba(255, 255, 256, 0.96)', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  expertName: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' },
  badge: { background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  cardText: { margin: 0, fontSize: 13, color: '#475569' },
  
  moreHiddenNotice: { background: 'rgba(254, 243, 199, 0.95)', border: '1px solid #fef08a', padding: '12px', borderRadius: 8, textAlign: 'center', fontSize: 12.5, color: '#92400e', marginTop: 12 },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modalContent: { 
    background: '#fff', 
    borderRadius: 14, 
    width: '100%', 
    maxWidth: 540, 
    padding: '24px 28px', 
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', 
    maxHeight: '90vh', 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden' 
  },
  btnCloseModal: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', padding: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 },
  inputModal: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' },
  btnCancelModal: { background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSubmitModal: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }
};