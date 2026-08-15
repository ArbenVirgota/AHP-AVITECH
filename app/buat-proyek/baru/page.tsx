// app/buat-proyek/page.tsx
'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { countUserProjects, PLAN_CONFIG } from '@/lib/subscription'
import type { Subscription, PlanType } from '@/lib/subscription'

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

interface ExpertDirectoryItem {
  id?: string; expert_id?: string; expertid?: string;
  nama?: string; expertname?: string; expert_name?: string;
  gelardepan?: string; gelar_depan?: string; gelarbelakang?: string; gelar_belakang?: string;
  email?: string; expertemail?: string; expert_email?: string;
  whatsapp?: string; expertwhatsapp?: string; expert_whatsapp?: string;
  asalinstansi?: string; instansi?: string;
  is_public?: string | boolean; ispublic?: string | boolean;
}

interface ExpertFormItem {
  expertId?: string; gelarDepan: string; name: string; gelarBelakang: string; email: string; whatsapp: string; fieldError?: string; 
}

interface DynamicPlanSetting {
  plan_key: string
  label: string
  price: number
  duration_months: number
  max_projects: number
  max_experts_manual: number
  max_experts_directory: number
  max_consultation_per_expert: number
  allow_subcriteria: boolean | string
  allow_alternative_method: boolean | string
  allow_ai_features: boolean | string
}

function UpgradeModal({ currentPlan, onClose }: { currentPlan: PlanType; onClose: () => void }) {
  const plans: PlanType[] = ['free', 'pro', 'plus', 'premium']
  const S = modalStyles

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>Upgrade Paket AHP</h2>
          <button onClick={onClose} style={S.closeBtn} type="button">✕</button>
        </div>
        <p style={S.desc}>Tingkatkan paket untuk mengaktifkan fitur AI, subkriteria, direktori pakar, dan kapasitas proyek lebih besar.</p>
        <div style={S.planGrid}>
          {plans.map((plan) => {
            const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG['free']
            const isActive = plan === currentPlan
            return (
              <div key={plan} style={isActive ? { ...S.planCard, ...S.planCardActive } : S.planCard}>
                <div style={S.planName}>{cfg.label}</div>
                <div style={S.planDesc}>{cfg.maxProjects === Number.POSITIVE_INFINITY ? 'Unlimited' : cfg.maxProjects} proyek</div>
                {isActive && <div style={S.planBadge}>Paket Anda</div>}
              </div>
            )
          })}
        </div>
        <div style={S.infoBox}>Sistem pembayaran otomatis sedang dalam persiapan. Silakan hubungi admin untuk aktivasi manual.</div>
        <button onClick={onClose} style={S.btnClose} type="button">Tutup</button>
      </div>
    </div>
  )
}

export default function BuatProyekPage() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [dynamicPlans, setDynamicPlans] = useState<Record<string, DynamicPlanSetting>>({})
  const [projectCount, setProjectCount] = useState(0)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [initLoading, setInitLoading] = useState(true)

  const [namaProyek, setNamaProyek] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  
  const [metode, setMetode] = useState<'Bobot saja' | 'Bobot alternatif'>('Bobot saja')
  const [gunakanSubkriteria, setGunakanSubkriteria] = useState(false)

  const [kriteriaText, setKriteriaText] = useState('')
  const [subkriteriaTextMap, setSubkriteriaTextMap] = useState<Record<string, string>>({})
  const [alternatifText, setAlternatifText] = useState('')
  
  const [jumlahExpert, setJumlahExpert] = useState(1)
  const [experts, setExperts] = useState<ExpertFormItem[]>([{ expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' }])
  
  const [fasilitatorEmail, setFasilitatorEmail] = useState('')
  const [fasilitatorWhatsapp, setFasilitatorWhatsapp] = useState('')

  const [directoryExperts, setDirectoryExperts] = useState<ExpertDirectoryItem[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [loadingSubAi, setLoadingSubAi] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 🟢 SINKRONISASI PLAN LENGKAP: SUBSCRIPTIONS -> USERS (FALLBACK) -> PLAN SETTINGS
  const loadInitialData = useCallback(async () => {
    const s = getSession()
    if (!s || !s.email) {
      router.replace('/login')
      return
    }

    const sessionObj = s as Record<string, any>;
    const cleanEmail = String(s.email || '').trim().toLowerCase()
    const cleanId = String(sessionObj.user_id || sessionObj.userId || sessionObj.id || '').trim()

    setUserEmail(cleanEmail)
    setUserId(cleanId)
    setFasilitatorEmail(cleanEmail)

    try {
      setInitLoading(true)

      const [subRes, userRes, planRes, count, dirRes] = await Promise.all([
        fetch(`${GOOGLE_SCRIPT_URL}?action=getsubscription&user_email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanId)}&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getuserprofile&email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanId)}&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getplansettings&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        countUserProjects(cleanEmail),
        fetch(`${GOOGLE_SCRIPT_URL}?action=get_expert_directory&_t=${Date.now()}`).catch(() => null)
      ])

      setProjectCount(count)

      let currentSub: any = null
      let fallbackPlanFromUser: PlanType = 'free'

      if (userRes) {
        const uJson = await userRes.json().catch(() => ({}))
        if (uJson && uJson.data) {
          const userRawPlan = String(uJson.data.plan || uJson.data.role || uJson.data.status_user || '').toLowerCase().trim()
          if (['free', 'pro', 'plus', 'premium'].includes(userRawPlan)) {
            fallbackPlanFromUser = userRawPlan as PlanType
          }
        }
      }

      if (subRes && typeof subRes.json === 'function') {
        const subJson = await subRes.json().catch(() => ({}))
        if (subJson.success && subJson.data) {
          const subData = subJson.data
          const subPlan = String(subData.plan || '').toLowerCase().trim()

          if (['pro', 'plus', 'premium'].includes(subPlan)) {
            currentSub = subData
          } else if (fallbackPlanFromUser !== 'free') {
            currentSub = {
              ...subData,
              plan: fallbackPlanFromUser,
              status: 'active'
            }
          } else {
            currentSub = subData
          }
        }
      }

      if (!currentSub && fallbackPlanFromUser !== 'free') {
        currentSub = {
          plan: fallbackPlanFromUser,
          status: 'active',
          user_email: cleanEmail,
          user_id: cleanId
        }
      }

      setSubscription(currentSub)

      if (planRes) {
        const pJson = await planRes.json().catch(() => ({}))
        if (pJson && pJson.success && Array.isArray(pJson.data)) {
          const map: Record<string, DynamicPlanSetting> = {}
          pJson.data.forEach((p: DynamicPlanSetting) => {
            if (p.plan_key) {
              map[String(p.plan_key).toLowerCase().trim()] = p
            }
          })
          setDynamicPlans(map)
        }
      }

      if (dirRes) {
        const json = await dirRes.json().catch(() => ({}))
        if (json?.success && Array.isArray(json.data)) {
          const publicExpertsOnly = json.data.filter((item: any) => {
            const pubStatus = String(item.is_public || item.ispublic || 'PUBLIK').toUpperCase();
            return pubStatus !== 'FALSE' && pubStatus !== 'PRIVAT';
          });
          setDirectoryExperts(publicExpertsOnly)
        }
      }

    } catch (err) {
      console.error('BuatProyek init error', err)
    } finally {
      setInitLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  const currentPlan: PlanType = subscription?.plan ?? 'free'
  const planConfig = PLAN_CONFIG[currentPlan] || PLAN_CONFIG['free']
  const globalDynamicPlan = dynamicPlans[currentPlan]

  const maxProjects = globalDynamicPlan?.max_projects ?? planConfig.maxProjects ?? 3
  const isQuotaFull = maxProjects !== Number.POSITIVE_INFINITY && projectCount >= maxProjects

  const maxExpertsDirectory = globalDynamicPlan
    ? (globalDynamicPlan.max_experts_directory >= 999999 ? 99999 : globalDynamicPlan.max_experts_directory)
    : (currentPlan === 'pro' ? 5 : currentPlan === 'plus' ? 10 : currentPlan === 'premium' ? 99999 : 0);

  const canUseSubcriteria = globalDynamicPlan 
    ? (String(globalDynamicPlan.allow_subcriteria).toUpperCase() === 'TRUE' || globalDynamicPlan.allow_subcriteria === true)
    : (currentPlan !== 'free');

  const canUseAlternatives = globalDynamicPlan 
    ? (String(globalDynamicPlan.allow_alternative_method).toUpperCase() === 'TRUE' || globalDynamicPlan.allow_alternative_method === true)
    : (currentPlan !== 'free');

  // 🟢 HAK AKSES FITUR AI SINKRON DENGAN DYNAMIC PLAN & TIER PAKET
  const isAiAllowed = useMemo(() => {
    if (globalDynamicPlan && globalDynamicPlan.allow_ai_features !== undefined) {
      const val = globalDynamicPlan.allow_ai_features
      return String(val).toUpperCase() === 'TRUE' || val === true
    }
    return currentPlan === 'plus' || currentPlan === 'premium'
  }, [globalDynamicPlan, currentPlan])

  const kriteriaArray = kriteriaText.split('\n').map(k => k.trim()).filter(Boolean)
  const alternatifArray = alternatifText.split('\n').map(a => a.trim()).filter(Boolean)

  const handleJumlahExpert = (n: number) => {
    const val = Math.max(1, Math.min(20, n))
    setJumlahExpert(val)
    setExperts((prev) => {
      const arr = [...prev]
      while (arr.length < val) { arr.push({ expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' }) }
      return arr.slice(0, val)
    })
  }

  const updateExpertField = (index: number, field: keyof ExpertFormItem, value: string) => {
    setExperts((prev) => {
      const newExperts = [...prev]
      newExperts[index] = { ...newExperts[index], [field]: value, fieldError: '' }
      return newExperts
    })
  }

  const handleSelectExpertFromDirectory = (index: number, selected: ExpertDirectoryItem) => {
    const rawFullName = selected.expert_name || selected.expertname || selected.nama || ''
    const gDepan = selected.gelar_depan || selected.gelardepan || ''
    const gBelakang = selected.gelar_belakang || selected.gelarbelakang || ''
    const email = selected.expert_email || selected.expertemail || selected.email || ''
    const wa = selected.expert_whatsapp || selected.expertwhatsapp || selected.whatsapp || ''
    const expId = selected.expert_id || selected.expertid || selected.id || '' 

    const isAlreadyAdded = experts.some((e, i) => i !== index && e.expertId === expId && expId !== '')
    if (isAlreadyAdded) {
      setExperts(prev => {
        const updated = [...prev]
        updated[index].fieldError = `Pakar "${rawFullName}" sudah Anda pilih pada baris lain.`
        return updated
      })
      return;
    }

    setExperts((prev) => {
      const updated = [...prev]
      updated[index] = { expertId: expId, gelarDepan: gDepan, name: rawFullName, gelarBelakang: gBelakang, email: email, whatsapp: wa, fieldError: '' }
      return updated
    })
    setActiveSuggestionIndex(null)
  }

  // 🟢 FUNGSI GENERATE SEMUA KRITERIA & SUBKRITERIA SECARA GLOBAL
  const handleGenerateAiCriteria = async () => {
    if (!isAiAllowed) {
      alert(
        `Fitur AI Analisis & Rekomendasi Struktur hanya tersedia untuk paket PLUS dan PREMIUM.\n\nPaket Anda saat ini: ${currentPlan.toUpperCase()}.\nSilakan lakukan upgrade paket untuk membuka akses fitur ini.`
      );
      setShowUpgrade(true);
      return;
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' (Topik/Tujuan) terlebih dahulu agar AI memahami konteksnya.");
      return;
    }
    
    setLoadingAi(true);
    try {
      const payload = {
        topic: namaProyek.trim(),
        description: deskripsi.trim(),
        wantsSubcriteria: canUseSubcriteria && gunakanSubkriteria
      };

      const res = await fetch('/api/ai/generate-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const json = await res.json();
      if (json.success && json.data) {
        const aiCriteria = json.data.criteria;
        
        const crNames = aiCriteria.map((c: any) => c.name);
        setKriteriaText(crNames.join('\n'));

        if (canUseSubcriteria && gunakanSubkriteria) {
          const newSubMap: Record<string, string> = {};
          aiCriteria.forEach((c: any) => {
            if (c.subcriteria && c.subcriteria.length > 0) {
              newSubMap[c.name] = c.subcriteria.join('\n');
            }
          });
          setSubkriteriaTextMap(newSubMap);
        }
      } else {
        alert('Gagal menyusun kriteria dengan AI: ' + json.message);
      }
    } catch (err) {
      alert('Koneksi ke AI gagal. Pastikan API Route tersedia.');
    } finally {
      setLoadingAi(false);
    }
  };

  // 🟢 FUNGSI GENERATE SUBKRITERIA SECARA INDIVIDUAL UNTUK 1 KRITERIA
  const handleGenerateSingleSubcriteria = async (critName: string) => {
    if (!isAiAllowed) {
      alert(
        `Fitur AI Subkriteria hanya tersedia untuk paket PLUS dan PREMIUM.\n\nPaket Anda saat ini: ${currentPlan.toUpperCase()}.\nSilakan lakukan upgrade paket untuk membuka akses fitur ini.`
      );
      setShowUpgrade(true);
      return;
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' terlebih dahulu agar AI memahami konteksnya.");
      return;
    }

    setLoadingSubAi((prev) => ({ ...prev, [critName]: true }));
    try {
      const res = await fetch('/api/ai/generate-subcriteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: namaProyek.trim(),
          description: deskripsi.trim(),
          criterionName: critName,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.subcriteria) {
        const subs: string[] = json.data.subcriteria;
        setSubkriteriaTextMap((prev) => ({
          ...prev,
          [critName]: subs.join('\n'),
        }));
      } else {
        alert('Gagal menyusun subkriteria: ' + (json.message || 'Terjadi kesalahan.'));
      }
    } catch (err) {
      alert('Koneksi ke AI gagal. Pastikan API route /api/ai/generate-subcriteria tersedia.');
    } finally {
      setLoadingSubAi((prev) => ({ ...prev, [critName]: false }));
    }
  };

  const handleSimpan = async () => {
    setError('')
    if (!namaProyek.trim()) return setError('Nama proyek wajib diisi.')
    if (kriteriaArray.length < 2) return setError('Minimal 2 kriteria harus diisi.')
    if (gunakanSubkriteria && !canUseSubcriteria) return setError('Paket Free Anda tidak diizinkan menggunakan subkriteria.')

    const formattedSubkriteriaMap: Record<string, string[]> = {}
    if (gunakanSubkriteria) {
      for (const critName of kriteriaArray) {
        const subs = (subkriteriaTextMap[critName] || '').split('\n').map(s => s.trim()).filter(Boolean)
        if (subs.length < 2) return setError(`Kriteria "${critName}" wajib memiliki minimal 2 subkriteria.`)
        formattedSubkriteriaMap[critName] = subs
      }
    }

    if (metode === 'Bobot alternatif') {
      if (!canUseAlternatives) return setError('Paket Free Anda tidak diizinkan menggunakan alternatif.')
      if (alternatifArray.length < 2) return setError('Minimal 2 alternatif harus diisi.')
    }

    const validExperts = experts.filter((e) => e.name.trim() !== '')
    if (validExperts.length < 1) return setError('Minimal 1 nama expert harus diisi.')

    let hasValidationError = false;
    const updatedExpertsState = [...experts];

    updatedExpertsState.forEach((exp) => {
      if (exp.name.trim() !== '') {
        if (!exp.expertId && (exp.email.trim() === '' || exp.whatsapp.trim() === '')) {
          exp.fieldError = 'Email dan No. WhatsApp wajib diisi untuk input manual.';
          hasValidationError = true;
        }
        if (!exp.expertId) {
          const cleanInputCoreName = exp.name.trim().toLowerCase(); 
          const cleanInputEmail = exp.email.trim().toLowerCase();
          const cleanInputWa = exp.whatsapp.replace(/[^0-9]/g, '');

          for (const dirExp of directoryExperts) {
            const dirNama = dirExp.expert_name || dirExp.expertname || dirExp.nama || '';
            const existingCoreName = dirNama.trim().toLowerCase();
            const existingEmail = String(dirExp.expert_email || dirExp.expertemail || dirExp.email || '').trim().toLowerCase();
            const existingWa = String(dirExp.expert_whatsapp || dirExp.expertwhatsapp || dirExp.whatsapp || '').replace(/[^0-9]/g, '');

            if (cleanInputCoreName === existingCoreName && cleanInputCoreName !== "") {
              if (cleanInputEmail === existingEmail || cleanInputWa === existingWa) {
                exp.fieldError = `Pakar "${dirExp.expert_name || dirNama}" sudah ada di direktori. Silakan pilih dari dropdown.`;
                hasValidationError = true; break;
              } else {
                exp.fieldError = `Nama inti "${dirExp.expert_name || dirNama}" sudah terdaftar dengan kontak berbeda.`;
                hasValidationError = true; break;
              }
            }
          }
        }
      }
    });

    if (hasValidationError) {
      setExperts(updatedExpertsState);
      return setError('Terdapat kesalahan pada form pakar. Periksa tanda merah.');
    }

    if (!fasilitatorEmail.trim() || !fasilitatorWhatsapp.trim()) return setError('Kontak fasilitator wajib diisi.')
    if (isQuotaFull) return setShowUpgrade(true)

    const s = getSession()
    if (!s || !s.email) {
      setError('Sesi habis. Silakan login ulang.')
      router.replace('/login')
      return
    }

    if (!window.confirm("Data Kriteria, Subkriteria, dan Pakar TIDAK DAPAT DIEDIT KEMBALI setelah disimpan. Lanjutkan?")) return;

    const sessionObj = s as Record<string, any>;
    const emailToSave = String(s.email || '').trim().toLowerCase()
    const finalUserId = String(sessionObj.user_id || sessionObj.userId || sessionObj.id || '').trim()

    const waFormatted = fasilitatorWhatsapp.replace(/\D/g, '').replace(/^0/, '62')

    const normalizedExperts = validExperts.map(exp => ({
      expert_id: exp.expertId || ('EXP-' + Date.now() + Math.floor(Math.random() * 1000)), 
      gelar_depan: exp.gelarDepan.trim(),
      expert_name: exp.name.trim(),
      gelar_belakang: exp.gelarBelakang.trim(),
      fullName: `${exp.gelarDepan.trim() ? exp.gelarDepan.trim()+' ' : ''}${exp.name.trim()}${exp.gelarBelakang.trim() ? ', '+exp.gelarBelakang.trim() : ''}`,
      expert_email: exp.email ? exp.email.trim() : '',
      expert_whatsapp: exp.whatsapp ? exp.whatsapp.replace(/\D/g, '').replace(/^0/, '62') : '',
      is_public: 'PRIVAT',
      source: 'facilitator_update',
      status: 'Aktif'
    }))

    const generateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    
    const formattedCriteriaArray = kriteriaArray.map((nama, idx) => ({ id: generateId('crit'), nama, urutan: idx + 1 }));
    const formattedSubcriteriaArray: any[] = [];
    
    if (gunakanSubkriteria && canUseSubcriteria) {
      formattedCriteriaArray.forEach((crit) => {
        const subs = formattedSubkriteriaMap[crit.nama] || [];
        subs.forEach((subName, sIdx) => {
          formattedSubcriteriaArray.push({ id: generateId('sub'), criteria_id: crit.id, nama: subName, urutan: sIdx + 1 });
        });
      });
    }

    const formattedAlternatifArray = (metode === 'Bobot alternatif' && canUseAlternatives)
      ? alternatifArray.map((nama, idx) => ({ id: generateId('alt'), nama, urutan: idx + 1 }))
      : [];

    setLoading(true)
    try {
      const payload = {
        action: 'createproject', user_id: finalUserId, email: emailToSave,
        nama_proyek: namaProyek.trim(), deskripsi: deskripsi.trim(),
        metode: canUseAlternatives ? metode : 'Bobot saja',
        jumlah_expert: validExperts.length,
        kriteria: formattedCriteriaArray,
        punya_subkriteria: gunakanSubkriteria && canUseSubcriteria,
        subkriteria: formattedSubcriteriaArray,
        alternatif: formattedAlternatifArray,
        experts_data: normalizedExperts, 
        fasilitator_email: fasilitatorEmail.trim() || emailToSave,
        fasilitator_whatsapp: waFormatted,
        fasilitator_nama: String(sessionObj.nama || 'Fasilitator').trim(),
      }

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })

      const rawText = await res.text()
      let result = JSON.parse(rawText)

      if (result?.success || result?.data?.success) {
        const resolvedProjectId = String(result?.data?.id || result?.data?.projectid || result?.id || result?.project_id || '').trim()
        if (!resolvedProjectId) return setError('Proyek berhasil dibuat, tetapi project_id tidak ditemukan.')

        setSuccess(true)
        setTimeout(() => router.push(`/proyek/kelola?id=${encodeURIComponent(resolvedProjectId)}`), 1200)
        return
      }
      setError(result?.message || result?.data?.message || 'Gagal menyimpan proyek.')
    } catch (err) {
      setError('Gagal terhubung ke server. Periksa koneksi Anda.')
    } finally { setLoading(false) }
  }

  const S = styles
  if (initLoading) return <div style={S.loadingPage}><div style={S.spinner} /><div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Memuat halaman...</div></div>
  if (success) return <div style={S.loadingPage}><div style={{ fontSize: 44 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: '#166534', margin: 0 }}>Proyek Berhasil Dibuat!</h2><p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Mengalihkan ke halaman kelola...</p></div>

  return (
    <div style={S.page}>
      {showUpgrade && <UpgradeModal currentPlan={currentPlan} onClose={() => setShowUpgrade(false)} />}
      <div style={S.container}>
        <div style={S.pageHeader}>
          <button onClick={() => router.back()} style={S.backBtn} type="button">← Kembali</button>
          <div style={{ flex: 1 }}>
            <span style={S.academicTag}>AHP Project Wizard</span>
            <h1 style={S.pageTitle}>Buat Proyek AHP Baru</h1>
            <p style={S.pageSubtitle}>Tentukan parameter hierarki, kriteria, subkriteria, dan alternatif.</p>
          </div>
          <div style={S.quotaBadge}>
            <span style={{ fontSize: 11, color: '#475569' }}>Proyek</span>
            <strong style={{ color: isQuotaFull ? '#dc2626' : '#1d4ed8', marginLeft: 6 }}>
              {projectCount}/{maxProjects === Number.POSITIVE_INFINITY ? '∞' : maxProjects}
            </strong>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={S.card}>
          <h3 style={S.cardTitle}>1. Informasi Proyek &amp; Struktur Metode</h3>
          <div style={S.grid2}>
            <div style={S.fieldGroup}>
              <label style={S.label}>Nama Proyek / Topik <span style={{ color: '#dc2626' }}>*</span></label>
              <input style={S.input} type="text" value={namaProyek} onChange={(e) => setNamaProyek(e.target.value)} placeholder="Contoh: Strategi Pengelolaan Sampah Terpadu" />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>Cakupan Evaluasi</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { val: 'Bobot saja' as const, label: 'Hanya Bobot (Kriteria/Subkriteria)', desc: 'Tanpa alternatif. Fokus pada prioritas kriteria.', disabled: false },
                  { val: 'Bobot alternatif' as const, label: 'Kombinasi dengan Alternatif', desc: canUseAlternatives ? 'Evaluasi lengkap hingga perankingan alternatif.' : '🔒 Dikunci untuk Plan Free', disabled: !canUseAlternatives },
                ].map(({ val, label, desc, disabled }) => (
                  <button key={val} type="button" onClick={() => disabled ? setShowUpgrade(true) : setMetode(val)} style={disabled ? { ...S.radioBtn, opacity: 0.6, cursor: 'not-allowed', background: '#f1f5f9' } : metode === val ? { ...S.radioBtn, ...S.radioBtnActive } : S.radioBtn}>
                    <strong style={{ fontSize: 12.5 }}>{label} {disabled && '🔒'}</strong>
                    <span style={{ fontSize: 11, color: metode === val && !disabled ? '#1d4ed8' : '#64748b' }}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}>
              <label style={S.label}>Deskripsi Proyek (Konteks untuk AI)</label>
              <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Jelaskan latar belakang, tujuan, atau konteks analisis untuk membantu AI memahami proyek..." />
            </div>
          </div>
        </div>

        {/* 2. DAFTAR KRITERIA UTAMA */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <h3 style={{...S.cardTitle, margin: 0}}>
              2. Daftar Kriteria Utama <span style={S.badge}>{kriteriaArray.length} aktif</span>
            </h3>
            {/* 🟢 TOMBOL GENERATE AI GLOBAL DENGAN DETEKSI PLAN */}
            <button 
              type="button" 
              onClick={handleGenerateAiCriteria}
              disabled={loadingAi}
              style={{
                background: isAiAllowed ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : '#f1f5f9',
                color: isAiAllowed ? 'white' : '#94a3b8', 
                border: isAiAllowed ? 'none' : '1px solid #cbd5e1', 
                borderRadius: 8, 
                padding: '6px 12px', 
                fontSize: 12, 
                fontWeight: 700, 
                cursor: loadingAi ? 'wait' : 'pointer',
                boxShadow: isAiAllowed ? '0 2px 8px rgba(37,99,235,0.2)' : 'none'
              }}
            >
              {loadingAi ? '🤖 Menyusun Struktur...' : isAiAllowed ? '🪄 Susun Kriteria & Subkriteria dengan AI' : '🔒 AI Analisis (Perlu Plus/Premium)'}
            </button>
          </div>
          
          <p style={S.cardDesc}>
            {loadingAi 
              ? <span style={{ color: '#2563eb', fontWeight: 600 }}>Gemini AI sedang membaca konteks penelitian dan merumuskan kriteria MECE...</span> 
              : 'Ketik nama kriteria ke bawah (pisahkan dengan Enter). AI akan menimpa isian ini jika digunakan.'}
          </p>

          <div style={S.fieldGroup}>
            <textarea
              style={{ ...S.input, minHeight: 140, resize: 'vertical', lineHeight: 1.5, background: loadingAi ? '#f8fafc' : '#fff', color: loadingAi ? '#94a3b8' : '#111827' }}
              value={loadingAi ? 'Menganalisis topik...\nMembangun hierarki kriteria...' : kriteriaText}
              disabled={loadingAi}
              onChange={(e) => setKriteriaText(e.target.value)}
              placeholder={"Aspek Lingkungan\nAspek Sosial\nAspek Ekonomi"}
            />
          </div>

          <div style={{ marginTop: 16, background: canUseSubcriteria ? '#eff6ff' : '#f8fafc', padding: 12, borderRadius: 10, border: canUseSubcriteria ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
            <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 8, cursor: canUseSubcriteria ? 'pointer' : 'not-allowed', fontSize: 12.5, color: canUseSubcriteria ? '#1e3a8a' : '#64748b' }}>
              <input
                type="checkbox"
                checked={canUseSubcriteria && gunakanSubkriteria}
                disabled={!canUseSubcriteria}
                onChange={(e) => { if (!canUseSubcriteria) { setShowUpgrade(true); return; } setGunakanSubkriteria(e.target.checked); }}
                style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: canUseSubcriteria ? 'pointer' : 'not-allowed' }}
              />
              <span>Aktifkan Subkriteria (Pecah kriteria menjadi sub-elemen) {!canUseSubcriteria && '🔒 [Dikunci untuk Plan Free]'}</span>
            </label>
          </div>

          {/* 🟢 AREA SUBKRITERIA DILENGKAPI TOMBOL GENERATE AI INDIVIDUAL */}
          {canUseSubcriteria && gunakanSubkriteria && kriteriaArray.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 12 }}>
                Rincian Subkriteria (Dapat dibuat per kriteria dengan AI)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {kriteriaArray.map((crit) => {
                  const isCritLoading = Boolean(loadingSubAi[crit]);
                  return (
                    <div key={crit} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                        <label style={{ ...S.label, margin: 0, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{crit}</strong>
                        </label>
                        
                        {/* 🟢 TOMBOL AI SPESIFIK SUBKRITERIA */}
                        <button
                          type="button"
                          onClick={() => handleGenerateSingleSubcriteria(crit)}
                          disabled={isCritLoading}
                          style={{
                            background: isAiAllowed ? '#eff6ff' : '#f1f5f9',
                            color: isAiAllowed ? '#1d4ed8' : '#94a3b8',
                            border: isAiAllowed ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: isCritLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            flexShrink: 0
                          }}
                        >
                          {isCritLoading ? '⏳ Menyusun...' : isAiAllowed ? '🪄 AI Sub' : '🔒 AI Sub'}
                        </button>
                      </div>

                      <textarea
                        style={{
                          ...S.input,
                          minHeight: 85,
                          resize: 'vertical',
                          fontSize: 12.5,
                          background: isCritLoading ? '#f1f5f9' : '#fff',
                          color: isCritLoading ? '#94a3b8' : '#111827',
                        }}
                        value={isCritLoading ? 'AI sedang merumuskan subkriteria...' : (subkriteriaTextMap[crit] || '')}
                        disabled={isCritLoading}
                        onChange={(e) => setSubkriteriaTextMap((prev) => ({ ...prev, [crit]: e.target.value }))}
                        placeholder={"Subkriteria 1\nSubkriteria 2\nSubkriteria 3"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. DAFTAR ALTERNATIF */}
        {metode === 'Bobot alternatif' && canUseAlternatives && (
          <div style={S.card}>
            <h3 style={S.cardTitle}>3. Daftar Alternatif Pilihan <span style={S.badge}>{alternatifArray.length} aktif</span></h3>
            <p style={S.cardDesc}>Ketik nama alternatif ke bawah (pisahkan dengan Enter).</p>
            <div style={S.fieldGroup}>
              <textarea style={{ ...S.input, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }} value={alternatifText} onChange={(e) => setAlternatifText(e.target.value)} placeholder={"Vendor A\nVendor B\nVendor C"} />
            </div>
          </div>
        )}

        {/* 4. EXPERT (INPUT MANUAL DIIZINKAN UNTUK SEMUA PLAN) */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>
            <span>4. Tim Pakar (Expert Responden)</span>
            <span style={S.badgeGlobal}>{maxExpertsDirectory === 0 ? '📝 Input Manual Mandiri' : `🔍 Kuota Direktori: ${maxExpertsDirectory === 99999 ? 'Unlimited' : maxExpertsDirectory}`}</span>
          </h3>

          {maxExpertsDirectory === 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', color: '#92400e', fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
              💡 <strong>Informasi Paket Free:</strong> Anda dapat menginput data pakar/responden secara manual. Fitur pencarian dari <em>Direktori Pakar</em> akan terbuka jika Anda <button type="button" onClick={() => setShowUpgrade(true)} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Upgrade Paket</button>.
            </div>
          )}

          <div style={S.fieldGroup}>
            <label style={S.label}>Jumlah Pakar / Expert</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" onClick={() => handleJumlahExpert(jumlahExpert - 1)} style={S.counterBtn}>–</button>
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{jumlahExpert}</span>
              <button type="button" onClick={() => handleJumlahExpert(jumlahExpert + 1)} style={S.counterBtn}>+</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {experts.map((exp, i) => {
              const filteredSuggestions = maxExpertsDirectory > 0 && exp.name.trim().length > 1
                ? directoryExperts.filter(item => {
                    const search = exp.name.toLowerCase().trim()
                    const pName = (item.expert_name || item.expertname || item.nama || '').toLowerCase()
                    const pEmail = (item.expert_email || item.expertemail || item.email || '').toLowerCase()
                    return pName.includes(search) || pEmail.includes(search)
                  })
                : []
              const isFromDirectory = Boolean(exp.expertId && exp.expertId.trim() !== '')

              return (
                <div key={i} style={{ background: '#f8fafc', border: exp.fieldError ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                      Pakar Responden {i + 1} {isFromDirectory && <span style={{ color: '#2563eb', fontSize: 11, background: '#eff6ff', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>✓ Dari Direktori</span>}
                    </div>
                    {isFromDirectory && <button type="button" onClick={() => setExperts(prev => { const updated = [...prev]; updated[i] = { expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' }; return updated; })} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>🔄 Reset ke Manual</button>}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={S.fieldGroup}><label style={S.label}>Gelar Depan</label><input style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }} type="text" value={exp.gelarDepan} readOnly={isFromDirectory} onChange={(e) => updateExpertField(i, 'gelarDepan', e.target.value)} placeholder="Dr. / Ir." /></div>
                    <div style={S.fieldGroup}><label style={S.label}>Nama Inti / Utama <span style={{ color: '#dc2626' }}>*</span></label><input style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }} type="text" value={exp.name} readOnly={isFromDirectory} onFocus={() => maxExpertsDirectory > 0 && !isFromDirectory && setActiveSuggestionIndex(i)} onChange={(e) => { setExperts(prev => { const updated = [...prev]; updated[i] = { ...updated[i], name: e.target.value, expertId: '', fieldError: '' }; return updated; }); if (maxExpertsDirectory > 0) setActiveSuggestionIndex(i) }} placeholder="Ketik nama inti..." required /></div>
                    <div style={S.fieldGroup}><label style={S.label}>Gelar Belakang</label><input style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }} type="text" value={exp.gelarBelakang} readOnly={isFromDirectory} onChange={(e) => updateExpertField(i, 'gelarBelakang', e.target.value)} placeholder="M.Sc. / Ph.D." /></div>
                  </div>

                  {exp.fieldError && <div style={S.fieldErrorBox}>⚠️ {exp.fieldError}</div>}

                  {maxExpertsDirectory > 0 && !isFromDirectory && activeSuggestionIndex === i && filteredSuggestions.length > 0 && (
                    <div style={S.suggestionInlineBox}>
                      <div style={S.suggestionHeader}>💡 Saran Pakar (Klik untuk Pilih):</div>
                      <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                        {filteredSuggestions.map((item, idx) => (
                          <div key={idx} style={S.suggestionItem} onClick={() => handleSelectExpertFromDirectory(i, item)}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{item.expert_name || item.expertname || item.nama || 'Pakar'}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>🏢 Instansi: {item.asal_instansi || item.instansi || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isFromDirectory ? (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>🔒 <strong>Kontak disembunyikan</strong> (Direktori).</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                      <div style={S.fieldGroup}><label style={S.label}>Email Pakar <span style={{ color: '#dc2626' }}>*</span></label><input style={S.input} type="email" value={exp.email} onChange={(e) => updateExpertField(i, 'email', e.target.value)} placeholder="email@pakar.com" required /></div>
                      <div style={S.fieldGroup}><label style={S.label}>WhatsApp Pakar <span style={{ color: '#dc2626' }}>*</span></label><input style={S.input} type="text" value={exp.whatsapp} onChange={(e) => updateExpertField(i, 'whatsapp', e.target.value)} placeholder="6281234..." required /></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 5. KONTAK FASILITATOR */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>5. Kontak Fasilitator <span style={{ ...S.optBadge, background: '#fef2f2', color: '#dc2626' }}>Wajib</span></h3>
          <div style={S.grid2}>
            <div style={S.fieldGroup}><label style={S.label}>Email Fasilitator <span style={{ color: '#dc2626' }}>*</span></label><input style={S.input} type="email" value={fasilitatorEmail} onChange={(e) => setFasilitatorEmail(e.target.value)} placeholder="fasilitator@email.com" required /></div>
            <div style={S.fieldGroup}><label style={S.label}>WhatsApp Fasilitator <span style={{ color: '#dc2626' }}>*</span></label><input style={S.input} type="text" value={fasilitatorWhatsapp} onChange={(e) => setFasilitatorWhatsapp(e.target.value)} placeholder="08123456789" required /></div>
          </div>
        </div>

        <div style={S.footer}>
          <button type="button" onClick={() => router.back()} style={S.btnCancel}>Batal</button>
          <button type="button" onClick={handleSimpan} disabled={loading || isQuotaFull} style={loading || isQuotaFull ? { ...S.btnSimpan, ...S.btnDisabled } : S.btnSimpan}>
            {loading ? 'Menyimpan...' : isQuotaFull ? 'Kuota Penuh' : 'Simpan & Buat Proyek'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.55)), url("/bg-academic.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', fontFamily: 'Segoe UI, system-ui, sans-serif', paddingBottom: 40 },
  loadingPage: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' },
  spinner: { width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  container: { maxWidth: 820, margin: '0 auto', padding: '24px 16px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  backBtn: { padding: '8px 12px', background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: '#334155', fontWeight: 700, flexShrink: 0 },
  academicTag: { display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', background: 'rgba(30, 58, 138, 0.6)', padding: '3px 8px', borderRadius: 4, marginBottom: 4, border: '1px solid rgba(147, 197, 253, 0.3)' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#ffffff', margin: '0 0 2px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
  pageSubtitle: { fontSize: 12.5, color: '#e2e8f0', margin: 0 },
  quotaBadge: { marginLeft: 'auto', background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  card: { background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.5)', borderRadius: 16, padding: '18px 22px', marginBottom: 14, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)' },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badgeGlobal: { background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  cardDesc: { fontSize: 12, color: '#64748b', margin: '0 0 12px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12.5, fontWeight: 700, color: '#1e293b' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13.5, color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  suggestionInlineBox: { background: '#fff', border: '1.5px solid #2563eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(37,99,235,0.1)', marginBottom: 12, overflow: 'hidden' },
  suggestionHeader: { padding: '6px 12px', background: '#eff6ff', fontSize: 11, fontWeight: 700, color: '#1e40af', borderBottom: '1px solid #bfdbfe' },
  suggestionItem: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' },
  fieldErrorBox: { marginTop: 6, marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', color: '#dc2626', fontSize: 12, fontWeight: 600 },
  radioBtn: { padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' },
  radioBtnActive: { border: '1.5px solid #2563eb', background: '#eff6ff', color: '#1d4ed8' },
  badge: { fontSize: 11, background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '2px 8px', fontWeight: 600 },
  optBadge: { fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px', fontWeight: 500 },
  counterBtn: { width: 30, height: 30, background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 12.5, fontWeight: 600, marginBottom: 14 },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
  btnCancel: { padding: '10px 20px', background: 'white', border: '1.5px solid #cbd5e1', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569' },
  btnSimpan: { padding: '10px 24px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
  btnDisabled: { background: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' },
}

const modalStyles: Record<string, CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 },
  modal: { background: 'white', borderRadius: 16, padding: '28px 32px', maxWidth: 480, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8', padding: 0 },
  desc: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  planGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  planCard: { border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', textAlign: 'center' },
  planCardActive: { border: '1.5px solid #2563eb', background: '#eff6ff' },
  planName: { fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  planDesc: { fontSize: 11, color: '#64748b' },
  planBadge: { marginTop: 6, fontSize: 9.5, background: '#1d4ed8', color: 'white', borderRadius: 999, padding: '2px 6px', display: 'inline-block' },
  infoBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16 },
  btnClose: { width: '100%', padding: 11, background: '#f1f5f9', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600, color: '#374151', fontSize: 14 },
}