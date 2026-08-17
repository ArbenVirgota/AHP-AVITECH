// app/evaluasi/[token]/selesai/page.tsx

'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

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
}

const PENDIDIKAN_OPTIONS = ['D3 / Diploma', 'S1 / Sarjana', 'S2 / Magister', 'S3 / Doktor', 'Profesor / Guru Besar', 'Lainnya'];

function matchPendidikanValue(dbValue: string): string {
  const val = String(dbValue || '').trim().toLowerCase();
  if (!val) return 'S2 / Magister';

  const exactMatch = PENDIDIKAN_OPTIONS.find(opt => opt.toLowerCase() === val);
  if (exactMatch) return exactMatch;

  if (val.includes('s1') || val.includes('sarjana')) return 'S1 / Sarjana';
  if (val.includes('s2') || val.includes('magister')) return 'S2 / Magister';
  if (val.includes('s3') || val.includes('doktor')) return 'S3 / Doktor';
  if (val.includes('prof') || val.includes('guru besar')) return 'Profesor / Guru Besar';
  if (val.includes('d3') || val.includes('diploma')) return 'D3 / Diploma';

  return 'Lainnya';
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
    return { displayPhone: clean, waLinkPhone: clean, isValid: false, errorMsg: 'Nomor harus diawali 08, 628, atau 8' };
  }

  if (internationalFormat.length < 10 || internationalFormat.length > 15) {
    return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: false, errorMsg: 'Jumlah digit tidak valid.' };
  }

  return { displayPhone: localFormat, waLinkPhone: internationalFormat, isValid: true, errorMsg: '' };
}

function ExpertSelesaiContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [expert, setExpert] = useState<ExpertItem | null>(null);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [waError, setWaError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  
  const [sendingNotif, setSendingNotif] = useState(false);
  const [isNotifSent, setIsNotifSent] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [showCertModal, setShowCertModal] = useState(false);
  const [officialCertId, setOfficialCertId] = useState<string>(''); 

  // 🟢 State Aset Sistem dari Sheet system_assets / app_settings
  const [systemAssets, setSystemAssets] = useState<{
    platform_logo?: string;
    admin_signature?: string;
    co_admin_signature?: string;
    [key: string]: string | undefined;
  }>({});

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
    isPublic: true
  });

  // 🟢 EFFECT DOM REMOVER MUTLAK: Menyembunyikan sidebar, navbar, drawer dari layout induk
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const hiddenElements: HTMLElement[] = [];
      const selectors = 'aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"], [class*="navigation"]';
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

  useEffect(() => {
    if (isLocked || isNotifSent) {
      window.history.pushState(null, '', window.location.href);

      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
        alert('🔒 Evaluasi proyek ini telah dikunci. Anda tidak dapat kembali ke lembar kuesioner.');
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isLocked, isNotifSent]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      if (!token) {
        throw new Error('Token expert tidak ditemukan di URL.');
      }

      const ts = Date.now();
      
      // Ambil data expert & aset sistem secara paralel
      const [tokenRes, assetsRes] = await Promise.all([
        fetch(GOOGLESCRIPTURL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          cache: 'no-store',
          body: JSON.stringify({ action: 'getexpertbytoken', token: token })
        }),
        fetch(`${GOOGLESCRIPTURL}?action=get_system_assets&_t=${ts}`, { cache: 'no-store' }).catch(() => null)
      ]);

      const json = await tokenRes.json();

      if (!json?.success || !json?.data?.expert || !json?.data?.project) {
        throw new Error(json?.message || 'Data expert tidak ditemukan.');
      }

      if (assetsRes) {
        const assetsJson = await assetsRes.json().catch(() => ({}));
        if (assetsJson?.success && assetsJson.data) {
          setSystemAssets(assetsJson.data);
        }
      }

      const rawExp = json.data.expert;
      const rawProj = json.data.project;

      const expId = String(rawExp.id || rawExp.expertid || rawExp.expert_id || '').trim();
      const gD = String(rawExp.gelar_depan || rawExp.gelardepan || '').trim();
      const expName = String(rawExp.expert_name || rawExp.expertname || rawExp.nama || '');
      const gB = String(rawExp.gelar_belakang || rawExp.gelarbelakang || '').trim();
      const projId = String(rawProj.id || rawProj.projectid || rawProj.project_id || '').trim();
      const isExpPublic = rawExp.is_public === 'PUBLIK' || rawExp.is_public === true || rawExp.is_public === 'YA';
      const expKtp = String(rawExp.ktp_url || rawExp.ktpUrl || rawExp.foto_ktp || rawExp.fotoktp || rawExp.ktp || '').trim();

      const respStatus = String(rawExp.responsestatus || rawExp.response_status || rawExp.status || '').toUpperCase();
      if (respStatus === 'SELESAI' || respStatus === 'DIKIRIM' || respStatus === 'TERKONFIRMASI') {
        setIsNotifSent(true);
        setIsLocked(true);
      }

      const durasiPengalamanParsed = Number(rawExp.durasi_pengalaman || rawExp.pengalaman_tahun || rawExp.pengalaman || rawExp.durasipengalaman || 0);

      const rawPendidikan = String(rawExp.pendidikanterakhir || rawExp.pendidikan_terakhir || rawExp.pendidikan || '');
      const finalPendidikan = matchPendidikanValue(rawPendidikan);

      const exp: ExpertItem = {
        id: expId,
        gelardepan: gD,
        expertname: expName,
        gelarbelakang: gB,
        expertemail: String(rawExp.expertemail || rawExp.expert_email || rawExp.email || ''),
        expertwhatsapp: String(rawExp.expertwhatsapp || rawExp.expert_whatsapp || rawExp.whatsapp || ''),
        asalinstansi: String(rawExp.asalinstansi || rawExp.asal_instansi || rawExp.instansi || ''),
        pendidikanterakhir: finalPendidikan,
        bidangkeahlian: String(rawExp.bidangkeahlian || rawExp.bidang_keahlian || ''),
        durasi_pengalaman: Number.isNaN(durasiPengalamanParsed) ? 0 : durasiPengalamanParsed,
        ktp_url: expKtp,
        ispublic: isExpPublic
      };

      const resolvedUserName = String(
        rawProj.fasilitatornama || rawProj.nama_user || rawProj.namaUser || rawProj.fasilitator_nama || rawProj.peneliti || rawProj.username || rawProj.nama || rawProj.user_name || 'Peneliti Utama'
      ).trim();

      const resolvedProjectName = String(
        rawProj.namaproyek || rawProj.nama_proyek || rawProj.judul_penelitian || rawProj.project_name || rawProj.title || 'Proyek Evaluasi AHP'
      ).trim();

      const resolvedUserInstansi = String(
        rawProj.fasilitatorlembaga || rawProj.lembaga || rawProj.instansi || rawProj.asalinstansi || 'Lembaga Riset / Universitas'
      ).trim();

      const resolvedSignature = String(
        rawProj.fasilitatorsignature || rawProj.signature_url || rawProj.tanda_tangan || rawProj.foto_ttd || rawProj.signature || ''
      ).trim();

      const proj: ProjectDetail = {
        id: projId,
        namaproyek: resolvedProjectName,
        deskripsi: String(rawProj.deskripsi || ''),
        fasilitatoremail: String(rawProj.fasilitatoremail || rawProj.fasilitator_email || rawProj.useremail || rawProj.email || ''),
        fasilitatorwhatsapp: String(rawProj.fasilitatorwhatsapp || rawProj.fasilitator_whatsapp || ''),
        fasilitatornama: resolvedUserName,
        fasilitatorlembaga: resolvedUserInstansi,
        fasilitatorsignature: resolvedSignature,
      };

      setProject(proj);
      setExpert(exp);

      if (json.data.responses && Array.isArray(json.data.responses)) {
        setResponses(json.data.responses);
      }

      if (!isRefresh) {
        setFormData({
          gelarDepan: exp.gelardepan || '',
          expertname: exp.expertname,
          gelarBelakang: exp.gelarbelakang || '',
          expertemail: exp.expertemail,
          expertwhatsapp: exp.expertwhatsapp,
          asalinstansi: exp.asalinstansi,
          pendidikanterakhir: exp.pendidikanterakhir,
          bidangkeahlian: exp.bidangkeahlian,
          durasi_pengalaman: exp.durasi_pengalaman || 0,
          ktpUrl: expKtp,
          isPublic: isExpPublic
        });
        setAgreedToTerms(isExpPublic);
      }

      try {
        const certCheckRes = await fetch(`${GOOGLESCRIPTURL}?action=get_expert_certificate&expertid=${encodeURIComponent(expId)}&t=${ts}`, { cache: 'no-store' });
        const certCheckJson = await certCheckRes.json();
        if (certCheckJson?.success && (certCheckJson?.data?.certificateid || certCheckJson?.data?.certificateId)) {
          setOfficialCertId(certCheckJson.data.certificateid || certCheckJson.data.certificateId);
        }
      } catch (cErr) {
        console.warn('Sertifikat belum terdaftar di awal:', cErr);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memuat data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 🟢 Resolusi Tanda Tangan & Data Pengesah Sistem (Prioritas Sheet system_assets)
  const getSystemSignerInfo = () => {
    const activeType = typeof window !== 'undefined' ? localStorage.getItem('active_signer_type') : 'main';
    let name = 'Dr. Arben Virgota, S.Pi., M.Si';
    let title = 'Lead Developer & System Admin';
    let sigUrl = systemAssets.admin_signature || (typeof window !== 'undefined' ? localStorage.getItem('superadmin_signature_url') : '') || '';
    
    if (activeType === 'backup') {
      name = (typeof window !== 'undefined' && localStorage.getItem('backup_signer_name')) || name;
      title = (typeof window !== 'undefined' && localStorage.getItem('backup_signer_title')) || 'Wakil System Admin';
      sigUrl = systemAssets.co_admin_signature || (typeof window !== 'undefined' && localStorage.getItem('backup_signer_signature_url')) || sigUrl;
    }
    return { name, title, sigUrl };
  };

  // 🟢 Resolusi Logo Platform (Prioritas Sheet system_assets)
  const getAppLogoUrl = () => {
    return systemAssets.platform_logo || (typeof window !== 'undefined' ? localStorage.getItem('app_system_stamp_url') : '') || '/logo.png';
  };

  const getUserSignatureUrl = () => {
    if (project?.fasilitatorsignature) {
      return project.fasilitatorsignature;
    }
    if (typeof window === 'undefined') return '';
    const userSession = localStorage.getItem('user_session') || localStorage.getItem('ahp_user_data');
    if (userSession) {
      try {
        const parsed = JSON.parse(userSession);
        return parsed.signature_url || parsed.tanda_tangan || parsed.foto_ttd || '';
      } catch {}
    }
    return '';
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: name === 'durasi_pengalaman' ? (value === '' ? 0 : Number(value)) : value }));
    }
  };

  const handleWaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericOnly = e.target.value.replace(/[^\d]/g, '');
    setFormData((prev) => ({ ...prev, expertwhatsapp: numericOnly }));
    if (numericOnly) {
      const check = processPhoneNumber(numericOnly);
      setWaError(check.isValid ? '' : check.errorMsg);
    } else {
      setWaError('');
    }
  };

  const handleKtpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Harap pilih file gambar KTP (JPG/PNG).');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement('img');
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
        
        const compressed = canvas.toDataURL('image/jpeg', 0.5);
        setFormData((prev) => ({ ...prev, ktpUrl: compressed }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile || !expert || !project) return;
    
    if (!formData.expertname.trim() || !formData.expertemail.trim() || !formData.expertwhatsapp.trim()) {
      alert('Nama Utama, Email, dan WhatsApp wajib diisi.'); 
      return;
    }
    
    const phoneCheck = processPhoneNumber(formData.expertwhatsapp);
    if (!phoneCheck.isValid) { 
      alert(`Format WhatsApp Salah: ${phoneCheck.errorMsg}`); 
      return; 
    }

    const confirmMessage = "Apakah Anda yakin data profil yang diisi sudah benar?\n\nMohon periksa kembali penulisan Nama Utama dan Gelar Anda, karena data ini akan dicetak secara permanen pada E-Sertifikat dan tidak dapat diubah lagi setelah disimpan.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setSavingProfile(true);
      const cleanEmail = formData.expertemail.trim().toLowerCase();
      const fullFormattedName = `${formData.gelarDepan.trim() ? formData.gelarDepan.trim() + ' ' : ''}${formData.expertname.trim()}${formData.gelarBelakang.trim() ? ', ' + formData.gelarBelakang.trim() : ''}`;
      
      const cleanKtpData = formData.ktpUrl ? formData.ktpUrl.trim() : '';

      const updateRes = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update_expert_profile',
          token: token,
          expert_id: expert.id,
          expertid: expert.id,
          gelar_depan: formData.gelarDepan.trim(),
          expert_name: formData.expertname.trim(),
          gelar_belakang: formData.gelarBelakang.trim(),
          expert_email: cleanEmail,
          expert_whatsapp: phoneCheck.waLinkPhone,
          asal_instansi: formData.asalinstansi.trim(),
          pendidikan_terakhir: formData.pendidikanterakhir,
          bidang_keahlian: formData.bidangkeahlian.trim(),
          durasi_pengalaman: formData.durasi_pengalaman,
          
          ktp_url: cleanKtpData,
          ktpUrl: cleanKtpData,
          foto_ktp: cleanKtpData,
          fotoktp: cleanKtpData,
          ktp: cleanKtpData,
          
          is_public: agreedToTerms ? 'PUBLIK' : 'PRIVAT',
        }),
      });

      const updateJson = await updateRes.json().catch(() => ({}));
      if (updateJson && updateJson.success === false) {
        alert('⚠️ Peringatan Server: ' + (updateJson.message || 'Gagal memperbarui profil.'));
        setSavingProfile(false);
        return;
      }

      const signerInfo = getSystemSignerInfo();
      const platformLogo = getAppLogoUrl();

      const resCert = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'save_project_certificate_direct',
          expertid: expert.id,
          projectid: project.id,
          expertname: fullFormattedName,
          expertemail: cleanEmail,
          project_name: project.namaproyek,
          fasilitator_email: project.fasilitatoremail,
          fasilitator_nama: project.fasilitatornama,
          fasilitatornama: project.fasilitatornama,
          issuedat: new Date().toISOString().split('T')[0],
          admin_signature: signerInfo.sigUrl,
          admin_logo: platformLogo
        })
      });
      const jsonCert = await resCert.json().catch(() => ({}));
      
      if (jsonCert?.certificateid || jsonCert?.certificateId) {
        setOfficialCertId(jsonCert.certificateid || jsonCert.certificateId);
      }

      setIsProfileSaved(true);
      alert('✅ Profil dan foto KTP berhasil disimpan!');

    } catch (err) {
      alert('Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setSavingProfile(false); 
    }
  };

  const handleConfirmToUser = async () => {
    if (sendingNotif || !expert || !project) return;
    try {
      setSendingNotif(true);
      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'send_facilitator_notification',
          fasilitator_email: project.fasilitatoremail,
          fasilitator_nama: project.fasilitatornama,
          expert_name: formData.expertname,
          expert_email: formData.expertemail,
          instansi: formData.asalinstansi,
          project_name: project.namaproyek,
          expert_id: expert.id,
          certificateid: officialCertId || 'AHP-EXP-001-2026',
          token: token,
          project_id: project.id
        })
      });
      const json = await res.json();
      if (json?.success) {
        setIsNotifSent(true);
        setIsLocked(true);
        
        window.history.pushState(null, '', window.location.href);

        alert('✅ Konfirmasi sukses dikirimkan ke Peneliti Utama! Halaman ini sekarang telah ditutup dan dikunci.');
      } else {
        throw new Error(json?.message || 'Gagal mengirim konfirmasi.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setSendingNotif(false);
    }
  };

  const activeCertNo = (officialCertId || 'AHP-EXP-001-2026').replace(/\//g, '-');

  const getFullFormattedExpertName = () => {
    const gD = formData.gelarDepan.trim() ? `${formData.gelarDepan.trim()} ` : '';
    const nameCore = formData.expertname.trim() || expert?.expertname || 'Pakar';
    const gB = formData.gelarBelakang.trim() ? `, ${formData.gelarBelakang.trim()}` : '';
    return `${gD}${nameCore}${gB}`;
  };

  const systemSigner = getSystemSignerInfo();
  const userSigUrl = getUserSignatureUrl();
  const appLogoUrl = getAppLogoUrl();

  const GLOBAL_HIDE_CSS = `
    aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"], [class*="navigation"] {
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
    @media print {
      @page { 
        size: 297mm 185mm !important; 
        margin: 0 !important; 
      }
      html, body {
        width: 297mm !important;
        height: 185mm !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      body * { 
        visibility: hidden !important; 
      }
      .certificate-print-area, .certificate-print-area * { 
        visibility: visible !important; 
      }
      .certificate-print-area {
        position: fixed !important; 
        left: 0 !important; 
        top: 0 !important;
        width: 297mm !important; 
        height: 185mm !important; 
        margin: 0 !important;
        padding: 12mm 15mm !important;
        box-shadow: none !important; 
        background: #ffffff !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { 
        display: none !important; 
      }
    }
  `;

  if (loading) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>
      <style jsx global>{GLOBAL_HIDE_CSS}</style>
      <div>Memuat halaman rekapitulasi selesai...</div>
    </div>
  );

  if (error || !project || !expert) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red', fontFamily: 'Segoe UI, sans-serif' }}>
      <style jsx global>{GLOBAL_HIDE_CSS}</style>
      <div>{error}</div>
    </div>
  );

  if (isLocked) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, background: 'url("/bg-expert.png") center/cover no-repeat fixed, #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Segoe UI, sans-serif' }}>
        <style jsx global>{GLOBAL_HIDE_CSS}</style>
        <div style={{ background: 'white', padding: '36px 28px', borderRadius: 16, border: '1px solid #cbd5e1', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a', fontWeight: 800 }}>Evaluasi Telah Selesai &amp; Dikunci</h2>
          <p style={{ color: '#475569', fontSize: 13.5, lineHeight: 1.5, margin: '0 0 20px' }}>
            Anda telah berhasil mengirimkan konfirmasi penyelesaian evaluasi kepada Peneliti Utama. Tautan kuesioner ini tidak dapat diakses atau diubah kembali demi menjaga validitas data riset.
          </p>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
            Terima kasih atas partisipasi dan kepakaran yang telah Anda berikan untuk proyek <strong>{project.namaproyek}</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'url("/bg-expert.png") center/cover no-repeat fixed, #f8fafc', zIndex: 2147483647, overflowY: 'auto', padding: '16px 12px', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box' }}>
      <style jsx global>{GLOBAL_HIDE_CSS}</style>

      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }} className="no-print">
        
        <div style={{ background: 'white', padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <h1 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>Terima Kasih! Evaluasi Selesai</h1>
          <p style={{ color: '#475569', margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.4 }}>
            Penilaian matriks untuk proyek: <strong>{project.namaproyek}</strong> telah selesai. Silakan periksa dan lengkapi profil Anda di bawah ini.
          </p>
        </div>

        <div style={{ background: 'white', padding: '16px 18px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a', fontWeight: 700 }}>Langkah 1: Lengkapi &amp; Simpan Profil Pakar</h2>
          
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Gelar Depan</label>
                <input type="text" name="gelarDepan" placeholder="Dr. / Prof." value={formData.gelarDepan} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Nama Utama *</label>
                <input type="text" name="expertname" placeholder="Budi Santoso" value={formData.expertname} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Gelar Belakang</label>
                <input type="text" name="gelarBelakang" placeholder="M.Sc. / S.T." value={formData.gelarBelakang} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Email</label>
                <input type="email" name="expertemail" value={formData.expertemail} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>WhatsApp *</label>
                <input type="text" name="expertwhatsapp" placeholder="081234..." value={formData.expertwhatsapp} onChange={handleWaChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} required />
                {waError && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 2, display: 'block' }}>{waError}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Asal Instansi</label>
                <input type="text" name="asalinstansi" value={formData.asalinstansi} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Pendidikan Terakhir</label>
                <select name="pendidikanterakhir" value={formData.pendidikanterakhir} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, boxSizing: 'border-box' }}>
                  {PENDIDIKAN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Bidang Keahlian</label>
                <input type="text" name="bidangkeahlian" value={formData.bidangkeahlian} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Pengalaman (Tahun)</label>
                <input type="number" min={0} name="durasi_pengalaman" value={formData.durasi_pengalaman} onChange={handleProfileChange} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} required />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 2, color: '#334155' }}>Unggah Foto KTP (Verifikasi Identitas Pakar)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleKtpFileChange} 
                style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }} 
              />
              <div style={{
                marginTop: 2,
                marginBottom: 4,
                fontSize: 11,
                color: '#b45309',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: 6,
                padding: '6px 8px',
                lineHeight: 1.4,
              }}>
                ⚠️ <strong>Catatan Batas Ukuran:</strong> Pastikan ukuran file gambar KTP di bawah <strong>500 KB</strong>.
              </div>

              <div style={{ height: 90, border: '1px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 4 }}>
                {formData.ktpUrl ? (
                  <img src={formData.ktpUrl} alt="Pratinjau KTP" style={{ maxHeight: 85, maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada foto KTP yang diunggah</span>
                )}
              </div>
            </div>

            <div style={{
              marginTop: 10,
              marginBottom: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '10px 12px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12,
                color: '#334155',
                cursor: 'pointer',
                lineHeight: 1.4
              }}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#0f172a', cursor: 'pointer' }}
                />
                <span>
                  Saya menyetujui data profil dan kepakaran saya digunakan untuk keperluan validasi ilmiah riset ini serta dapat ditampilkan secara publik pada direktori pakar AHP Avitech.{' '}
                  <a 
                    href="/terms-expert" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Baca Syarat &amp; Ketentuan Kolaborasi
                  </a>
                </span>
              </label>
            </div>

            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                type="submit" 
                disabled={savingProfile || (formData.isPublic && !agreedToTerms) || Boolean(waError)} 
                style={{ 
                  padding: '12px 16px', 
                  background: isProfileSaved ? '#f1f5f9' : '#0f172a', 
                  color: isProfileSaved ? '#475569' : '#fff', 
                  border: isProfileSaved ? '1px solid #cbd5e1' : 'none', 
                  borderRadius: 6, 
                  fontWeight: 700, 
                  fontSize: 13, 
                  cursor: (savingProfile || (formData.isPublic && !agreedToTerms) || waError) ? 'not-allowed' : 'pointer',
                  opacity: (savingProfile || (formData.isPublic && !agreedToTerms) || waError) ? 0.6 : 1
                }}
              >
                {savingProfile ? 'Menyimpan...' : isProfileSaved ? '✔️ Profil Tersimpan' : '💾 Simpan Profil'}
              </button>
            </div>
          </form>
        </div>

        {isProfileSaved && (
          <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: 12, border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, color: '#0f172a', fontWeight: 700 }}>Langkah 2: Penyelesaian</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.4 }}>
              Profil telah disimpan. Anda dapat mengunduh E-Sertifikat langsung dari perangkat Anda dan menginformasikan kepada peneliti bahwa evaluasi telah selesai.
            </p>
            
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <button
                onClick={() => setShowCertModal(true)}
                style={{
                  padding: '12px 18px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
              >
                📄 Buka &amp; Unduh Sertifikat (PDF)
              </button>

              <button
                onClick={handleConfirmToUser}
                disabled={sendingNotif || isNotifSent}
                style={{
                  padding: '12px 18px',
                  background: isNotifSent ? '#dcfce7' : '#16a34a',
                  color: isNotifSent ? '#166534' : '#fff',
                  border: isNotifSent ? '1px solid #bbf7d0' : 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: (sendingNotif || isNotifSent) ? 'not-allowed' : 'pointer'
                }}
              >
                {sendingNotif ? 'Mengirim Konfirmasi...' : isNotifSent ? '✔️ Konfirmasi Selesai Terkirim' : '📩 Konfirmasi Selesai ke Peneliti'}
              </button>
            </div>
          </div>
        )}

      </div>

      {showCertModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 1000, width: '100%', maxHeight: '95vh', overflowY: 'auto' }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>E-Sertifikat Apresiasi Pakar</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Sertifikat siap dicetak/disimpan sebagai file PDF A4 Landscape</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.print()} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🖨️ Cetak / Simpan ke PDF
                </button>
                <button onClick={() => setShowCertModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Tutup
                </button>
              </div>
            </div>

            <div className="certificate-print-area" style={{ border: '8px solid #1e3a8a', padding: '28px 30px 20px 30px', borderRadius: 10, background: '#ffffff', color: '#1e293b', textAlign: 'center', fontFamily: "'Georgia', serif", boxSizing: 'border-box', position: 'relative', isolation: 'isolate' }}>
              
              {appLogoUrl && (
                <div style={{ 
                  position: 'absolute', 
                  top: 22, 
                  right: 25, 
                  zIndex: 10, 
                  backgroundColor: '#ffffff', 
                  WebkitPrintColorAdjust: 'exact', 
                  printColorAdjust: 'exact',
                  padding: '4px', 
                  borderRadius: '5px',
                  display: 'inline-flex'
                }}>
                  <img src={appLogoUrl} alt="Logo Aplikasi" style={{ maxHeight: 100, maxWidth: 100, objectFit: 'contain' }} />
                </div>
              )}

              <div style={{ fontSize: 11, fontFamily: 'Arial, sans-serif', color: '#0284c7', letterSpacing: '2.5px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 20 }}>PLATFORM ANALISIS DATA DIGITAL • AHP AVITECH</div>
              
              <h1 style={{ fontSize: 33, fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 20px 0', letterSpacing: '4px' }}>
                SERTIFIKAT APRESIASI
              </h1>

              <div style={{ fontSize: 15.5, fontStyle: 'italic', color: '#475569', marginBottom: 18, letterSpacing: '2px' }}>
                Certificate of Expert Contribution
              </div>
              
              <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '30px' }}>
                Diberikan dengan hormat kepada / Presented to:
              </div>

              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', margin: '4px 0 30px 0', textDecoration: 'underline', textUnderlineOffset: 4 }}>{getFullFormattedExpertName()}</div>
              
              <div style={{ fontSize: 13, lineHeight: 1.5, color: '#334155', marginTop: 4, marginBottom: 0, marginLeft: 'auto', marginRight: 'auto', maxWidth: '92%' }}>
                Atas kontribusi, dedikasi, dan kepakarannya sebagai <strong>Evaluator Pakar (Expert)</strong> melalui peninjauan matriks komparasi berpasangan berbasis <em>Analytic Hierarchy Process (AHP)</em> pada platform digital untuk proyek penelitian ilmiah berjudul:
                <br />
                <strong style={{ fontSize: 14.5, color: '#1e3a8a', display: 'block', marginTop: 6 }}>"{project.namaproyek}"</strong>
                Sertifikat ini diterbitkan sebagai bukti otentik pengakuan atas dukungan akademis dan validasi ilmiah Anda dalam riset ini.
              </div>
              
              <div style={{ display: 'table', width: '100%', marginTop: 12, tableLayout: 'fixed' }}>
                <div style={{ display: 'table-cell', width: '30%', verticalAlign: 'bottom', textAlign: 'left', padding: '0 6px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#64748b', fontWeight: 'bold', marginBottom: 2, letterSpacing: 1 }}>NOMOR SERTIFIKAT</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 }}>{activeCertNo}</div>
                  
                  <div style={{ marginBottom: 4 }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`https://ahp.avitech.cloud/verify-certificate?id=${activeCertNo}`)}`} 
                      alt="QR Verifikasi Sertifikat" 
                      style={{ width: 50, height: 50, border: '1px solid #cbd5e1', padding: 2, background: '#fff', objectFit: 'contain' }} 
                    />
                  </div>

                  <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#64748b', fontWeight: 'bold', marginBottom: 1, letterSpacing: 1 }}>VERIFIKASI SISTEM</div>
                  <div style={{ fontSize: 9.5, color: '#2563eb', wordBreak: 'break-all', fontFamily: 'Arial, sans-serif' }}>
                    https://ahp.avitech.cloud/verify-certificate?id={activeCertNo}
                  </div>
                </div>
                
                {/* Kolom 2: Peneliti Utama dengan Latar Belakang Putih Transparan pada TTD */}
                <div style={{ display: 'table-cell', width: '35%', verticalAlign: 'bottom', textAlign: 'center', padding: '0 6px' }}>
                  <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#64748b', fontWeight: 'bold', marginBottom: 2, letterSpacing: 1 }}>DITERBITKAN DI</div>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 }}>Mataram, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div style={{ height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                    {userSigUrl ? (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0)',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                        padding: '2px 4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px'
                      }}>
                        <img 
                          src={userSigUrl} 
                          alt="Tanda Tangan Peneliti" 
                          style={{ 
                            maxHeight: 50, 
                            maxWidth: 140, 
                            objectFit: 'contain',
                            mixBlendMode: 'multiply',
			    opacity: 0.99
                          }} 
                        />
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: 10 }}>(Tanda Tangan Digital)</span>
                    )}
                  </div>
                  <div style={{ borderTop: '1.5px solid #0f172a', width: '85%', margin: '2px auto' }}></div>
                  <div style={{ fontWeight: 'bold', fontSize: 12.5, color: '#0f172a' }}>{project.fasilitatornama}</div>
                  <div style={{ fontSize: 10.5, color: '#1e3a8a', fontWeight: 600, marginTop: 1 }}>Peneliti Utama / Principal Investigator</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{project.fasilitatorlembaga}</div>
                </div>

                {/* Kolom 3: Pengesah System (Admin/Superadmin) */}
                <div style={{ display: 'table-cell', width: '35%', verticalAlign: 'bottom', textAlign: 'center', padding: '0 6px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    
                    <div style={{ 
                      position: 'relative', 
                      bottom: -90, 
                      left: -30, 
                      width: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      zIndex: 0, 
                      pointerEvents: 'none' 
                    }}>
                      {systemSigner.sigUrl ? (
                        <div style={{ 
                          backgroundColor: '#ffffff', 
                          WebkitPrintColorAdjust: 'exact', 
                          printColorAdjust: 'exact',
                          padding: '2px',
                          display: 'inline-flex',
                          borderRadius: '6px'
                        }}>
                          <img 
                            src={systemSigner.sigUrl} 
                            alt="Validasi Sistem" 
                            style={{ 
                              maxHeight: 90, 
                              maxWidth: 200, 
                              objectFit: 'contain' 
                            }} 
                          />
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: 10 }}>(Sign)</span>
                      )}
                    </div>

                    <div style={{ position: 'relative', zIndex: 10 }}>
                      <div style={{ fontSize: 10, fontFamily: 'Arial, sans-serif', color: '#64748b', fontWeight: 'bold', marginBottom: 2, letterSpacing: 1 }}>VALIDASI KOMPUTASI</div>
                      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 }}>AHP Avitech System</div>
                      
                      <div style={{ height: 45, marginBottom: 2 }}></div>

                      <div style={{ borderTop: '1.5px solid #0f172a', width: '85%', margin: '2px auto' }}></div>
                      <div style={{ fontWeight: 'bold', fontSize: 12.5, color: '#0f172a' }}>{systemSigner.name}</div>
                      <div style={{ fontSize: 10.5, color: '#1e3a8a', fontWeight: 600, marginTop: 1 }}>{systemSigner.title}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>AHP Avitech Platform</div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function ExpertSelesaiPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', fontSize: 13, fontFamily: 'Segoe UI, sans-serif' }}>Memuat halaman rekapitulasi selesai...</div>}>
      <ExpertSelesaiContent />
    </Suspense>
  );
}