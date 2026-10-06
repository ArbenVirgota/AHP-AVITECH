// app/expert-directory/page.tsx

'use client';

import React, { useEffect, useState, useMemo, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SafeJoyride from '@/components/SafeJoyride';

const PUBLIC_LIMIT = 3;

interface ExpertDirectoryItem {
  id?: string;
  expert_id?: string;
  gelar_depan?: string;
  expert_name?: string;
  gelar_belakang?: string;
  expert_email?: string;
  expert_whatsapp?: string;
  asal_instansi?: string;
  pendidikan_terakhir?: string;
  bidang_keahlian?: string;
  durasi_pengalaman?: number | string;
  foto_url?: string;
  portofolio_url?: string;
  status?: string;
  average_rating?: number;
  total_reviews?: number;
  is_public?: string | boolean;
  [key: string]: any;
}

function formatDriveDirectLink(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmedUrl = url.trim();
  const driveFileRegex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const matchFile = trimmedUrl.match(driveFileRegex);
  if (matchFile && matchFile[1]) return `https://lh3.googleusercontent.com/d/${matchFile[1]}`;
  const driveIdRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
  const matchId = trimmedUrl.match(driveIdRegex);
  if (matchId && matchId[1]) return `https://lh3.googleusercontent.com/d/${matchId[1]}`;
  return trimmedUrl;
}

function processPhoneNumber(phoneInput?: any): { displayPhone: string; waLinkPhone: string; isValid: boolean; errorMsg: string } {
  if (phoneInput === undefined || phoneInput === null) return { displayPhone: '', waLinkPhone: '', isValid: false, errorMsg: 'Nomor HP wajib diisi.' };
  let clean = String(phoneInput).trim().replace(/[^\d]/g, '');
  if (!clean) return { displayPhone: '', waLinkPhone: '', isValid: false, errorMsg: 'Nomor HP harus berupa angka.' };

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
  const specificKeys = ['durasi_pengalaman', 'pengalaman', 'pengalaman_tahun'];
  for (const k of specificKeys) {
    const val = item[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const strVal = String(val).trim();
      if (strVal.toLowerCase().includes('tahun')) return strVal;
      const num = Number(strVal);
      if (!isNaN(num) && num > 0) return `${num} Tahun`;
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

  const [maxDirectoryLimit, setMaxDirectoryLimit] = useState<number | null>(null);
  const [maxConsultationLimit, setMaxConsultationLimit] = useState<number>(0);

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
  
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpBase64, setKtpBase64] = useState<string>('');
  const [ktpError, setKtpError] = useState<string>('');

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string>('');
  const [fotoError, setFotoError] = useState<string>('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittingApply, setSubmittingApply] = useState(false);

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
      let detectedPlan = 'FREE';
      if (rawPlan.includes('SUPER')) detectedPlan = 'SUPERADMIN';
      else if (rawPlan.includes('PREMIUM')) detectedPlan = 'PREMIUM';
      else if (rawPlan.includes('PLUS')) detectedPlan = 'PLUS';
      else if (rawPlan.includes('PRO')) detectedPlan = 'PRO';
      else detectedPlan = 'FREE';

      setUserPlan(detectedPlan);

      fetch(`/api/dashboard/summary?email=${encodeURIComponent(activeEmail)}&user_id=${encodeURIComponent(session?.id || session?.user_id || '')}&_t=${Date.now()}`)
        .then(res => res.json())
        .then(json => {
          if (json?.success && json.data) {
            const sub = json.data.subscription;
            const currentPlanKey = String(sub?.plan || detectedPlan).toUpperCase().trim();
            setUserPlan(currentPlanKey);

            const matchedPlan = (json.data.plans || []).find(
              (p: any) => String(p.plan_key).toUpperCase().trim() === currentPlanKey
            );

            const dirLimit = sub?.max_experts_directory !== undefined && sub?.max_experts_directory !== null && sub?.max_experts_directory !== ''
              ? Number(sub.max_experts_directory)
              : (matchedPlan?.max_experts_directory !== undefined ? Number(matchedPlan.max_experts_directory) : 0);

            const consultLimit = sub?.max_consultation_per_expert !== undefined && sub?.max_consultation_per_expert !== null && sub?.max_consultation_per_expert !== ''
              ? Number(sub.max_consultation_per_expert)
              : (matchedPlan?.max_consultation_per_expert !== undefined ? Number(matchedPlan.max_consultation_per_expert) : 0);

            setMaxDirectoryLimit(Number(dirLimit ?? 0));
            setMaxConsultationLimit(Number(consultLimit ?? 0));
          }
        })
        .catch(err => console.warn('Gagal sinkronisasi batasan plan:', err));
    } else {
      setUserPlan('PUBLIC');
      setMaxDirectoryLimit(PUBLIC_LIMIT);
      setMaxConsultationLimit(0);
    }

    fetchDirectory();
  }, []);

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/expert-directory?_t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      
      if (json && json.success && Array.isArray(json.data)) {
        setExperts(json.data);
      } else {
        setExperts([]);
      }
    } catch (err) {
      console.error('Gagal memuat direktori pakar:', err);
      setExperts([]);
    } finally {
      setLoading(false);
    }
  };

  const processedExperts = useMemo(() => {
    let list = experts.filter(exp => {
      const rawPub = exp.is_public;
      const isPublicTrue = rawPub === true || rawPub === 1 || String(rawPub).toUpperCase() === 'PUBLIK' || String(rawPub).toUpperCase() === 'YA' || String(rawPub).toUpperCase() === 'TRUE';
      const statusValue = String(exp.status || 'Aktif').trim().toLowerCase();
      const isValidStatus = statusValue !== 'privat' && statusValue !== 'draft';
      return isPublicTrue && isValidStatus;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(exp => {
        const name = String(exp.expert_name || exp.expertname || exp.nama || '').toLowerCase();
        const keahlian = String(exp.bidang_keahlian || '').toLowerCase();
        const instansi = String(exp.asal_instansi || exp.asalinstansi || '').toLowerCase();
        return name.includes(q) || keahlian.includes(q) || instansi.includes(q);
      });
    }

    list.sort((a, b) => {
      const ratingA = Number(a.average_rating || 0);
      const ratingB = Number(b.average_rating || 0);
      return ratingB - ratingA;
    });

    const limit = isLoggedIn ? (maxDirectoryLimit !== null ? maxDirectoryLimit : 0) : PUBLIC_LIMIT;
    const limitedList = limit >= 999999 ? list : list.slice(0, limit);

    return {
      displayed: limitedList,
      totalAvailable: list.length,
      limitApplied: limit,
      hasMore: limit < 999999 && list.length > limit
    };
  }, [experts, searchQuery, isLoggedIn, maxDirectoryLimit]);

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
      setKtpFile(null); setKtpBase64(''); return;
    }
    if (!file.type.startsWith('image/')) {
      setKtpError('Format tidak valid. KTP harus berupa gambar (JPG/PNG).');
      e.target.value = ''; return;
    }
    setKtpFile(file);
    const img = document.createElement('img');
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        const maxDim = 500;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setKtpBase64(canvas.toDataURL('image/jpeg', 0.5));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFotoError('');
    if (!file) {
      setFotoFile(null); setFotoBase64(''); return;
    }
    if (!file.type.startsWith('image/')) {
      setFotoError('Format tidak valid. Foto profil harus berupa gambar (JPG/PNG).');
      e.target.value = ''; return;
    }
    setFotoFile(file);
    const img = document.createElement('img');
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        const maxDim = 400;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setFotoBase64(canvas.toDataURL('image/jpeg', 0.4));
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
    setKtpFile(null); setKtpBase64(''); setKtpError('');
    setFotoFile(null); setFotoBase64(''); setFotoError('');
    setAgreedToTerms(false);
  };

  const handleApplyExpertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !applicantKeahlian || !applicantEmail || !applicantWa) {
      alert('Nama Utama, Email, No. WhatsApp, dan Bidang Keahlian wajib diisi.'); return;
    }
    if (!ktpBase64) { alert('Upload foto KTP wajib diisi untuk verifikasi identitas.'); return; }
    if (ktpError) { alert('Terdapat kesalahan pada file KTP yang diunggah. Mohon perbaiki.'); return; }
    if (fotoError) { alert('Terdapat kesalahan pada file Foto Profil yang diunggah.'); return; }
    if (!agreedToTerms) { alert('Anda harus mencentang persetujuan Syarat & Ketentuan.'); return; }

    const phoneCheck = processPhoneNumber(applicantWa);
    if (!phoneCheck.isValid) { alert(`Format Nomor WhatsApp Salah: ${phoneCheck.errorMsg}`); return; }

    if (!window.confirm("Apakah Anda yakin data profil yang diisi sudah benar?")) return;

    try {
      setSubmittingApply(true);
      const payload = {
        gelar_depan: applicantGelarDepan.trim(),
        expert_name: applicantName.trim(),
        gelar_belakang: applicantGelarBelakang.trim(),
        expert_email: applicantEmail.trim().toLowerCase(),
        expert_whatsapp: phoneCheck.waLinkPhone,
        asal_instansi: applicantInstansi.trim(),
        pendidikan_terakhir: applicantPendidikan,
        bidang_keahlian: applicantKeahlian.trim(),
        durasi_pengalaman: applicantPengalaman.trim(),
        status: 'Aktif',
        verification_method: 'Manual Admin',
        portofolio_url: applicantPortoUrl,
        ktp_url: ktpBase64,
        foto_url: fotoBase64,
      };

      // 🟢 JALUR YANG DIPERBAIKI (MENGARAH KE FOLDER YANG BENAR: /api/expert)
      const res = await fetch('/api/expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json && json.success) {
        alert('✅ Pendaftaran berhasil dicatat! Profil Anda kini telah tersimpan di direktori pakar.');
        resetFormState();
        fetchDirectory();
      } else {
        alert(json.message || 'Gagal mengirim pendaftaran.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
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
    if (maxConsultationLimit === 0) {
      alert(`Fitur konsultasi dinonaktifkan pada ${userPlan} PLAN sesuai aturan SuperAdmin (Batas: 0 sesi). Silakan upgrade paket.`);
      return;
    }
    const expId = exp.expert_id || exp.id || 'EXP-UNKNOWN';
    const expEmail = getVal(exp, ['expert_email', 'email']);

    setConsultTargetExpert(formattedName);
    setConsultTargetExpertId(expId);
    setConsultTargetExpertEmail(expEmail.trim().toLowerCase());
    setConsultUserContact(userEmail);
    
    try {
      const res = await fetch(`/api/dashboard/summary?email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`);
      const json = await res.json();
      if (json?.success && json.data?.user) {
        setConsultUserName(json.data.user.nama || userName || 'User');
        setConsultInstitusi(json.data.user.institusi || '-');
      } else {
        const session = getSession();
        setConsultUserName(session?.nama || userName || 'User');
        setConsultInstitusi(session?.institusi || '-');
      }
    } catch {
      const session = getSession();
      setConsultUserName(session?.nama || userName || 'User');
      setConsultInstitusi(session?.institusi || '-');
    }
    setShowConsultModal(true);
  };

  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultUserName || !consultUserContact || !consultInstitusi || !consultQuestion) {
      alert('Nama, Kontak Balasan, Asal Institusi, dan Pesan Pertanyaan wajib diisi.'); return;
    }
    try {
      setSubmittingConsult(true);
      const payload = {
        expert_id: consultTargetExpertId,
        expert_email: consultTargetExpertEmail,
        expert_name: consultTargetExpert,
        user_name: consultUserName.trim(),
        user_email: consultUserContact.trim().toLowerCase(),
        asal_institusi: consultInstitusi.trim(),
        pertanyaan: consultQuestion.trim(),
        client_plan: userPlan || 'PRO',
      };
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json && json.success) {
        alert(`Tiket konsultasi berhasil dikirimkan ke Yth. Bapak/Ibu ${consultTargetExpert}. Anda dapat memantaunya di menu Pusat Konsultasi.`);
        setShowConsultModal(false);
        setConsultQuestion('');
      } else {
        alert(json.message || 'Gagal mengirim permintaan konsultasi.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Terjadi kesalahan koneksi: ${err.message}`);
    } finally {
      setSubmittingConsult(false);
    }
  };

  const directorySteps = useMemo(() => [
    { target: 'body', content: 'Selamat datang di Direktori Pakar!', title: '👥 Direktori Pakar', placement: 'center' as const, disableBeacon: true },
    { target: '.tour-gabung', content: 'Jika Anda memiliki kepakaran khusus, Anda dapat bergabung ke direktori ini.', title: '🌟 Gabung Sebagai Pakar', placement: 'bottom' as const },
    { target: '.tour-search', content: 'Gunakan kolom pencarian ini untuk menemukan pakar.', title: '🔍 Cari Pakar', placement: 'bottom' as const },
    { target: '.tour-konsultasi', content: 'Klik tombol ini untuk mengirimkan pertanyaan langsung kepada pakar.', title: '💬 Ajukan Konsultasi', placement: 'top' as const }
  ], []);

  const handleStartDirectoryTour = () => {
    window.dispatchEvent(new Event('start-tour-ahp_tour_expert_directory'));
  };

  return (
    <div style={STYLES.page}>
      <SafeJoyride steps={directorySteps} storageKey="ahp_tour_expert_directory" />
      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Direktori Pakar (Expert Directory)</h1>
            <p style={STYLES.pageDesc}>
              {isLoggedIn ? 'Kumpulan profil lengkap pakar terverifikasi. Gunakan tombol konsultasi untuk terhubung dengan pakar pilihan Anda.' : 'Menampilkan sampel profil pakar akademik. Silakan lakukan registrasi atau masuk untuk membuka direktori lengkap.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={handleStartDirectoryTour} style={{ padding: '8px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }} title="Buka panduan penggunaan direktori pakar">💡 Panduan Direktori</button>
            <button type="button" onClick={() => setShowApplyModal(true)} className="tour-gabung" style={STYLES.btnApplyExpert}>🌟 Gabung Sebagai Pakar</button>
            <button type="button" onClick={() => router.push('/')} style={STYLES.btnSecondary}>← Beranda Utama</button>
            {isMounted && (isLoggedIn ? (
              <button type="button" onClick={() => router.push('/dashboard')} style={STYLES.btnPrimaryAction}>🚀 Dashboard Kerja</button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => router.push('/login')} style={STYLES.btnSecondary}>🔑 Masuk</button>
                <button type="button" onClick={() => router.push('/register')} style={STYLES.btnPrimaryAction}>✨ Registrasi</button>
              </div>
            ))}
          </div>
        </div>

        {!isLoggedIn ? (
          <div style={STYLES.guestNoticeBox}>
            <div style={{ fontSize: 24 }}>💡</div>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#1e3a8a', fontSize: 14 }}>Ingin Lebih Banyak Pakar &amp; Melakukan Konsultasi?</strong>
              <p style={{ margin: '3px 0 8px 0', fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.4 }}>Anda saat ini berada dalam mode pratinjau publik (*Public Preview*). Publik/umum tidak dapat melakukan konsultasi sebelum memiliki akun terdaftar. Silakan lakukan <strong>Registrasi Akun</strong> secara gratis.</p>
              <button onClick={() => router.push('/register')} style={STYLES.btnRegisterBanner}>Daftar Akun Sekarang →</button>
            </div>
          </div>
        ) : (
          <div style={STYLES.planBadgeBox}>
            <span style={{ fontSize: 13, color: '#0f172a' }}>Status Paket Anda: <strong style={{ color: '#2563eb', textTransform: 'uppercase' }}>{userPlan} PLAN</strong></span>
            <span style={{ fontSize: 12, color: '#475569' }}>| Menampilkan <strong>{processedExperts.displayed.length}</strong> dari {processedExperts.totalAvailable} pakar (Batas Paket: {processedExperts.limitApplied >= 999999 ? 'Unlimited' : `${processedExperts.limitApplied} Pakar`}) | Kuota Konsultasi: <strong>{maxConsultationLimit > 0 ? `${maxConsultationLimit} Sesi/Pakar` : 'Terkunci (0 Sesi)'}</strong></span>
            {processedExperts.hasMore && (
              <button onClick={() => router.push('/dashboard')} style={STYLES.btnUpgradePlan}>⚡ Upgrade Paket untuk Akses Lebih Banyak Pakar</button>
            )}
          </div>
        )}

        <div className="tour-search" style={STYLES.searchBarWrap}>
          <input type="text" placeholder="Cari berdasarkan nama, bidang keahlian, atau instansi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={STYLES.searchInput} />
        </div>

        {loading ? (
          <div style={STYLES.loader}>Memuat Data Direktori Pakar...</div>
        ) : processedExperts.displayed.length === 0 ? (
          processedExperts.limitApplied === 0 ? (
            <div style={{ ...STYLES.emptyBox, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', padding: '36px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 800, color: '#991b1b' }}>Akses Direktori Pakar Dibatasi pada Paket {userPlan}</h3>
              <p style={{ margin: '0 auto 16px auto', maxWidth: 520, fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>Berdasarkan kebijakan SuperAdmin, paket <strong>{userPlan}</strong> memiliki kuota <strong>0 Pakar Direktori</strong>. Anda dapat mengundang pakar manual sendiri secara mandiri via email/tautan kuesioner, atau melakukan upgrade paket untuk membuka akses direktori platform.</p>
              <button onClick={() => router.push('/dashboard')} style={{ ...STYLES.btnPrimaryAction, background: '#dc2626' }}>🚀 Buka Menu Upgrade di Dashboard</button>
            </div>
          ) : (
            <div style={STYLES.emptyBox}>Belum ada data pakar yang aktif atau sesuai dengan pencarian Anda.</div>
          )
        ) : (
          <>
            <div style={STYLES.grid}>
              {processedExperts.displayed.map((exp, idx) => {
                const gDepan = getVal(exp, ['gelar_depan']);
                const nameCore = getVal(exp, ['expert_name', 'expertname', 'nama']) || 'Pakar Tanpa Nama';
                const gBelakang = getVal(exp, ['gelar_belakang']);
                const formattedName = `${gDepan ? gDepan + ' ' : ''}${nameCore}${gBelakang ? ', ' + gBelakang : ''}`;
                const bidang = getVal(exp, ['bidang_keahlian']) || 'Umum';
                const instansi = getVal(exp, ['asal_instansi', 'asalinstansi']) || '-';
                const pendidikan = getVal(exp, ['pendidikan_terakhir']) || '-';
                const rawFoto = getVal(exp, ['foto_url', 'fotourl']) || '';
                const foto = formatDriveDirectLink(rawFoto);
                const teksPengalaman = getDurasiPengalaman(exp);

                return (
                  <div key={idx} style={STYLES.card}>
                    <div style={STYLES.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {foto ? <img src={foto} alt={formattedName} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>}
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
                        <button onClick={() => handleOpenConsultModal(exp, formattedName)} disabled={maxConsultationLimit === 0} className={idx === 0 ? "tour-konsultasi" : ""} style={{ ...STYLES.btnConsultAction, background: maxConsultationLimit === 0 ? '#f1f5f9' : '#2563eb', color: maxConsultationLimit === 0 ? '#94a3b8' : '#ffffff', cursor: maxConsultationLimit === 0 ? 'not-allowed' : 'pointer', border: maxConsultationLimit === 0 ? '1px solid #cbd5e1' : 'none' }} title={maxConsultationLimit === 0 ? `Fitur konsultasi dinonaktifkan pada ${userPlan} PLAN` : 'Ajukan konsultasi'}>
                          {maxConsultationLimit === 0 ? '🔒 Konsultasi Terkunci (Batas: 0)' : '💬 Ajukan Konsultasi'}
                        </button>
                      ) : (
                        <button onClick={() => handleOpenConsultModal(exp, formattedName)} className={idx === 0 ? "tour-konsultasi" : ""} style={{ ...STYLES.btnConsultAction, background: '#475569' }}>🔒 Login untuk Konsultasi</button>
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
                {!isLoggedIn ? (<span> Silakan <a href="/register" style={{ color: '#2563eb', fontWeight: 700 }}>Registrasi Akun</a> untuk membuka akses pakar lebih banyak.</span>) : (<span> Tingkatkan <a href="/dashboard" style={{ color: '#2563eb', fontWeight: 700 }}>Paket Langganan</a> Anda untuk melihat seluruh direktori.</span>)}
              </div>
            )}
          </>
        )}

        {showApplyModal && (
          <div style={STYLES.modalOverlay} onClick={() => setShowApplyModal(false)}>
            <div style={STYLES.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>🌟 Gabung Sebagai Pakar (Expert)</h3>
                <button onClick={() => setShowApplyModal(false)} style={STYLES.btnCloseModal}>✕</button>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.5, flexShrink: 0 }}>
                Bantu peneliti dan mahasiswa menyempurnakan riset mereka. Sebagai apresiasi, Anda akan mendapatkan <strong>E-Sertifikat Kolaborasi Riset</strong>, <strong>Eksposur Profil Akademik</strong>, dan <strong>Akses Gratis Akun Pro</strong>.
              </div>
              <form onSubmit={handleApplyExpertSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4, flexGrow: 1, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
                  <div><label style={STYLES.fieldLabel}>Gelar Depan</label><input type="text" placeholder="Dr. / Prof." value={applicantGelarDepan} onChange={(e) => setApplicantGelarDepan(e.target.value)} style={STYLES.inputModal} /></div>
                  <div><label style={STYLES.fieldLabel}>Nama Utama *</label><input type="text" placeholder="Nama tanpa gelar" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} style={STYLES.inputModal} required /></div>
                  <div><label style={STYLES.fieldLabel}>Gelar Belakang</label><input type="text" placeholder="S.Kom., M.T." value={applicantGelarBelakang} onChange={(e) => setApplicantGelarBelakang(e.target.value)} style={STYLES.inputModal} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={STYLES.fieldLabel}>Email Aktif *</label><input type="email" value={applicantEmail} onChange={(e) => setApplicantEmail(e.target.value)} style={STYLES.inputModal} required /></div>
                  <div><label style={STYLES.fieldLabel}>Nomor WhatsApp *</label><input type="text" placeholder="081234..." value={applicantWa} onChange={handleWaChange} style={STYLES.inputModal} required />{waError && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{waError}</span>}</div>
                </div>
                <div><label style={STYLES.fieldLabel}>Asal Instansi / Universitas</label><input type="text" placeholder="Universitas XYZ" value={applicantInstansi} onChange={(e) => setApplicantInstansi(e.target.value)} style={STYLES.inputModal} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={STYLES.fieldLabel}>Bidang Keahlian Utama *</label><input type="text" placeholder="SPK, AHP, Kebijakan Publik" value={applicantKeahlian} onChange={(e) => setApplicantKeahlian(e.target.value)} style={STYLES.inputModal} required /></div>
                  <div><label style={STYLES.fieldLabel}>Lama Pengalaman (Tahun)</label><input type="number" min="0" placeholder="Contoh: 5" value={applicantPengalaman} onChange={(e) => setApplicantPengalaman(e.target.value)} style={STYLES.inputModal} /></div>
                </div>
                <div><label style={STYLES.fieldLabel}>URL Portofolio (Google Scholar/SINTA)</label><input type="url" placeholder="https://scholar.google..." value={applicantPortoUrl} onChange={(e) => setApplicantPortoUrl(e.target.value)} style={STYLES.inputModal} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.fieldLabel}>Upload KTP (Wajib) *</label>
                    <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleKtpUpload} style={{ ...STYLES.inputModal, padding: '7px 12px', border: ktpError ? '1.5px solid #dc2626' : '1px solid #cbd5e1' }} required />
                    {ktpError && (<span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>⚠ {ktpError}</span>)}
                    {!ktpError && (<span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>Format: JPG/PNG. 🔒 KTP disembunyikan dari publik.</span>)}
                    {ktpBase64 && !ktpError && (<div style={{ marginTop: 10 }}><img src={ktpBase64} alt="Preview KTP" style={{ height: 60, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }} /></div>)}
                  </div>
                  <div>
                    <label style={STYLES.fieldLabel}>Upload Foto Profil (Opsional)</label>
                    <input type="file" accept="image/png, image/jpeg, image/jpg" onChange={handleFotoUpload} style={{ ...STYLES.inputModal, padding: '7px 12px', border: fotoError ? '1.5px solid #dc2626' : '1px solid #cbd5e1' }} />
                    {fotoError && (<span style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600, marginTop: 4, display: 'block' }}>⚠️ {fotoError}</span>)}
                    {!fotoError && (<span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>Format: JPG/PNG.</span>)}
                    {fotoBase64 && !fotoError && (<div style={{ marginTop: 10 }}><img src={fotoBase64} alt="Preview Foto" style={{ height: 60, width: 60, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} /></div>)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ marginTop: 3 }} />
                    <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>Saya telah membaca, memahami, dan menyetujui <a href="/terms-expert" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>Syarat & Ketentuan Kolaborasi Pakar</a>.</span>
                  </label>
                </div>
              </form>
              <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowApplyModal(false)} style={STYLES.btnCancelModal}>Batal</button>
                <button type="button" onClick={handleApplyExpertSubmit} disabled={submittingApply || !agreedToTerms} style={{ ...STYLES.btnSubmitModal, opacity: (!agreedToTerms || submittingApply) ? 0.6 : 1, cursor: (!agreedToTerms || submittingApply) ? 'not-allowed' : 'pointer' }}>
                  {submittingApply ? 'Mengirim Data...' : 'Kirim Pendaftaran'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showConsultModal && (
          <div style={STYLES.modalOverlay} onClick={() => setShowConsultModal(false)}>
            <div style={STYLES.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>💬 Ajukan Tiket Konsultasi</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748b' }}>Pakar Tujuan: <strong>Yth. Bapak/Ibu {consultTargetExpert}</strong></p>
                </div>
                <button onClick={() => setShowConsultModal(false)} style={STYLES.btnCloseModal}>✕</button>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: '#334155', lineHeight: 1.5, flexShrink: 0 }}>
                💡 <strong>Informasi Profil:</strong> Nama dan Asal Institusi ditarik otomatis dari akun terdaftar.
              </div>
              <form onSubmit={handleConsultSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4, flexGrow: 1, marginBottom: 12 }}>
                <div><label style={STYLES.fieldLabel}>Nama Lengkap Anda *</label><input type="text" disabled value={consultUserName} style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} required /></div>
                <div><label style={STYLES.fieldLabel}>Email / Kontak Anda *</label><input type="email" disabled value={consultUserContact} style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} required /></div>
                <div><label style={STYLES.fieldLabel}>Asal Institusi / Universitas *</label><input type="text" disabled value={consultInstitusi} style={{ ...STYLES.inputModal, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} required /></div>
                <div><label style={STYLES.fieldLabel}>Pertanyaan atau Permasalahan Riset secara Rinci *</label><textarea rows={4} placeholder="Uraikan latar belakang singkat, kendala metode, atau pertanyaan spesifik yang ingin dikonsultasikan..." value={consultQuestion} onChange={(e) => setConsultQuestion(e.target.value)} style={{ ...STYLES.inputModal, resize: 'vertical' }} required /></div>
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
  page: { backgroundImage: 'url("/bg-pakar.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed', minHeight: '100vh', padding: '32px 20px', fontFamily: '"Inter", "Segoe UI", sans-serif' },
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
  emptyBox: { background: 'rgba(255, 255, 256, 0.95)', padding: '30px', borderRadius: 12, textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  card: { background: 'rgba(255, 255, 256, 0.96)', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15,23,42,0.05)', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  expertName: { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' },
  badge: { background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  cardBody: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  cardText: { margin: 0, fontSize: 13, color: '#475569' },
  moreHiddenNotice: { background: 'rgba(254, 243, 199, 0.95)', border: '1px solid #fef08a', padding: '12px', borderRadius: 8, textAlign: 'center', fontSize: 12.5, color: '#92400e', marginTop: 12 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modalContent: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, padding: '24px 28px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  btnCloseModal: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', padding: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 },
  inputModal: { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', background: '#fff', boxSizing: 'border-box' },
  btnCancelModal: { background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSubmitModal: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }
};