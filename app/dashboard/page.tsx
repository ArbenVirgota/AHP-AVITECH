// app/dashboard/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { clearSession, getSession } from '@/lib/auth'
import type { UserSession } from '@/lib/auth'
import { PLAN_CONFIG } from '@/lib/subscription'
import type { Subscription, PlanType } from '@/lib/subscription'

// 🟢 1. IMPORT REACT-JOYRIDE
import { CallBackProps, STATUS, Step } from 'react-joyride';
import dynamic from 'next/dynamic';

// Menggunakan dynamic import untuk mem-bypass error ESM & mencegah error SSR Next.js
const Joyride = dynamic(
  () => import('react-joyride').then((mod: any) => mod.default || mod),
  { ssr: false }
) as any;

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

interface Project {
  id: string
  user_id: string
  user_email: string
  nama_proyek: string
  deskripsi: string
  metode: string
  jumlah_expert: number
  jumlah_expert_responden: number
  punya_subkriteria: boolean
  fasilitator_email: string
  fasilitator_whatsapp: string
  criteria_count: number
  subcriteria_count: number
  alternatif_count: number
  criteria_preview: string[]
  alternatif_preview: string[]
  created_at: string
  updated_at: string
}

interface RawExpert {
  id?: string
  expertid?: string
  expert_id?: string
  projectid?: string
  project_id?: string
  expertindex?: number
  expert_index?: number
  expertname?: string
  expert_name?: string
  expertemail?: string
  expert_email?: string
  expertwhatsapp?: string
  expert_whatsapp?: string
  role?: string
  status?: string
  responsestatus?: string
  response_status?: string
}

interface Expert {
  id: string
  project_id: string
  expert_index: number
  name: string
  email: string
  whatsapp: string
  role: string
  status: string
  response_status: string
}

interface ConsultationTicket {
  idTiket: string
  projectId?: string
  namaUser: string
  kontakUser: string
  expertTujuan: string
  topikPesan: string
  pertanyaan?: string
  status: string
  created_at?: string
  jawabanExpert?: string
  fileUrl?: string
}

interface UserProfileData {
  nama: string
  institusi: string
  city: string
  digital_signature: string
  foto_profil?: string
}

interface RawConsultation {
  idTiket?: string
  id_tiket?: string
  ticket_id?: string
  id?: string
  projectId?: string
  project_id?: string
  id_proyek?: string
  namaUser?: string
  nama_user?: string
  user_name?: string
  userEmail?: string
  user_email?: string
  kontakUser?: string
  kontak_user?: string
  user_contact?: string
  expertTujuan?: string
  expert_tujuan?: string
  expert_name?: string
  topikPesan?: string
  topik_pesan?: string
  topik_penelitian?: string
  topic?: string
  pertanyaan?: string
  pesan?: string
  status?: string
  created_at?: string
  tanggalDibuat?: string
  timestamp?: string
  jawabanExpert?: string
  jawaban_expert?: string
  expertResponse?: string
  balasanExpert?: string
  fileUrl?: string
  file_url?: string
  lampiran?: string
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

type RawProject = Record<string, unknown>

type SubscriptionLike = Subscription & {
  max_projects?: number | string
  max_experts?: number | string
  max_experts_directory?: number | string
  max_consultation_per_expert?: number | string
  custom_features?: string
}

const FEATURE_EXPLANATIONS = [
  {
    feature: 'Maksimal Proyek',
    desc: 'Jumlah ruang kerja proyek riset AHP independen yang dapat Anda buat dan kelola dalam 1 akun.'
  },
  {
    feature: 'Expert Manual',
    desc: 'Jumlah responden/pakar luar yang Anda undang mandiri via tautan kuesioner buatan sendiri.'
  },
  {
    feature: 'Expert Direktori',
    desc: 'Jumlah pakar terverifikasi di direktori platform yang bisa Anda undang langsung ke proyek Anda.'
  },
  {
    feature: 'Konsultasi / Pakar',
    desc: 'Batas kuota pengajuan pertanyaan/diskusi riset resmi yang dapat Anda kirimkan kepada pakar tujuan.'
  },
  {
    feature: 'Akses Subkriteria',
    desc: 'Fitur penyusunan struktur hirarki AHP bertingkat (Kriteria Utama -> Turunan Subkriteria).'
  },
  {
    feature: 'Bobot Alternatif',
    desc: 'Modul perhitungan perbandingan berpasangan hingga menghasilkan rangking dan bobot prioritas alternatif.'
  },
  {
    feature: 'Fitur AI Analisis',
    desc: 'Kecerdasan buatan untuk membantu sintesis data riset, analisis sentimen masukan, dan draf kesimpulan otomatis.'
  }
]

function toFiniteLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  if (num >= 999999) return Number.POSITIVE_INFINITY
  return num
}

function formatRupiah(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

// 🟢 SAFE FETCH HELPER (Mencegah Crash jika salah satu endpoint gagal)
async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

function normalizeSubscriptionData(raw: any, targetEmail: string): any {
  if (!raw) return null;
  let dataObj = raw.data || raw.result || raw.payload || raw;
  if (Array.isArray(dataObj)) {
    dataObj = dataObj.find((item: any) => {
      const em = String(item.user_email || item.email || '').trim().toLowerCase();
      return em === targetEmail.trim().toLowerCase();
    }) || dataObj[0] || null;
  }
  if (!dataObj || typeof dataObj !== 'object') return null;

  const getField = (keys: string[]) => {
    for (const k of keys) {
      for (const objKey of Object.keys(dataObj)) {
        const cleanObjKey = objKey.toLowerCase().replace(/[\s_]/g, '');
        const cleanTargetKey = k.toLowerCase().replace(/[\s_]/g, '');
        if (cleanObjKey === cleanTargetKey && dataObj[objKey] !== undefined && dataObj[objKey] !== '') {
          return dataObj[objKey];
        }
      }
    }
    return undefined;
  };

  const rawPlan = getField(['plan', 'plantype', 'status_plan']);
  const rawStatus = getField(['status', 'subscription_status']);
  const rawExpDate = getField(['expired_date', 'expireddate']);
  
  const rawMaxProjects = getField(['max_projects', 'maxprojects']);
  const rawMaxExperts = getField(['max_experts', 'maxexperts']);
  const rawMaxExpDir = getField(['max_experts_directory', 'maxexpertsdirectory']);
  const rawMaxConsult = getField(['max_consultation_per_expert', 'maxconsultationperexpert']);
  const rawCustomFeatures = getField(['custom_features', 'customfeatures']);

  return {
    user_email: String(getField(['user_email', 'email']) || targetEmail).trim().toLowerCase(),
    plan: rawPlan ? String(rawPlan).toLowerCase().trim() : 'free',
    status: rawStatus ? String(rawStatus).toLowerCase().trim() : 'active',
    expired_date: rawExpDate ? String(rawExpDate) : '',
    max_projects: rawMaxProjects !== undefined ? Number(rawMaxProjects) : null,
    max_experts: rawMaxExperts !== undefined ? Number(rawMaxExperts) : null,
    max_experts_directory: rawMaxExpDir !== undefined ? Number(rawMaxExpDir) : null,
    max_consultation_per_expert: rawMaxConsult !== undefined ? Number(rawMaxConsult) : null,
    custom_features: rawCustomFeatures !== undefined ? String(rawCustomFeatures) : '',
  };
}

// ============================================================================
// 🟢 2. KOMPONEN ONBOARDING TOUR MENGGUNAKAN JOYRIDE
// ============================================================================
function OnboardingTour() {
  const [run, setRun] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Cek di localStorage apakah user sudah pernah melihat tutorial ini
    const hasSeenTutorial = localStorage.getItem('ahp_has_seen_tutorial');
    
    // Jika belum pernah melihat, jalankan tour setelah 1.5 detik agar halaman ter-render sempurna
    if (!hasSeenTutorial) {
      setTimeout(() => setRun(true), 1500); 
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Jika user klik "Lewati Tur" atau sudah selesai sampai akhir, catat di memori
      localStorage.setItem('ahp_has_seen_tutorial', 'true');
      setRun(false);
    }
  };

  // Definisikan langkah-langkah dan elemen mana yang akan disorot menggunakan CSS Class
  const steps: Step[] = [
    {
      target: 'body', 
      content: 'Selamat datang di Platform AHP Avitech! Mari ikuti tur singkat untuk mengenal fitur-fitur utama sistem ini.',
      title: '👋 Selamat Datang!',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-step-profile',
      content: 'Sebelum memulai riset, pastikan Anda melengkapi profil dan mengunggah tanda tangan digital agar e-sertifikat riset Anda sah secara administratif.',
      title: '⚙️ Lengkapi Profil Anda',
    },
    {
      target: '.tour-step-project',
      content: 'Di sinilah ruang kerja Anda berada. Buka menu ini untuk melihat daftar proyek riset AHP Anda atau membuat proyek baru.',
      title: '📁 Proyek AHP Saya',
    },
    {
      target: '.tour-step-expert',
      content: 'Butuh responden berkualitas? Cari dan temukan pakar yang relevan dengan riset Anda di menu Direktori Pakar.',
      title: '👥 Direktori Pakar',
    },
    {
      target: '.tour-step-consultation',
      content: 'Jika Anda memiliki kendala atau butuh masukan dari pakar, gunakan fitur Pusat Konsultasi untuk mengirim tiket pertanyaan.',
      title: '💬 Pusat Konsultasi',
    },
    {
      target: '.tour-step-create-project',
      content: 'Setelah profil lengkap, klik tombol ini untuk mulai membangun struktur hirarki dan membuat proyek riset AHP pertama Anda!',
      title: '🚀 Mulai Riset Sekarang',
    }
  ];

  if (!isMounted) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true} // Melanjutkan otomatis saat klik lanjut
      showSkipButton={true} // Tombol untuk melewati tutorial
      showProgress={true} // Menampilkan "1 dari 6"
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb', // Warna biru 
          textColor: '#334155',
          zIndex: 100000,
        },
        buttonClose: {
          display: 'none', // Sembunyikan tombol (X) kecil agar user fokus ke tombol "Lewati Tur"
        },
        tooltipContainer: {
          textAlign: 'left'
        }
      }}
      locale={{
        back: 'Kembali',
        close: 'Tutup',
        last: 'Selesai',
        next: 'Lanjut',
        skip: 'Lewati Tur',
      }}
    />
  );
}
// ============================================================================

function FeatureComparisonModal({
  dynamicPlans,
  onClose,
}: {
  dynamicPlans: Record<string, DynamicPlanSetting>
  onClose: () => void
}) {
  const S = modalStyles
  const planKeys = ['free', 'pro', 'plus', 'premium']

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>📊 Tabel Perbandingan &amp; Penjelasan Detail Fitur</h2>
          <button onClick={onClose} style={S.closeBtn} type="button">✕</button>
        </div>

        <p style={{ ...S.desc, marginBottom: 16 }}>
          Pahami detail fasilitas dan spesifikasi istilah untuk menentukan paket yang paling sesuai dengan riset Anda.
        </p>

        <div style={{ overflowX: 'auto', marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 14px', color: '#334155' }}>Fitur / Fasilitas</th>
                <th style={{ padding: '10px 14px', color: '#16a34a', textAlign: 'center' }}>FREE</th>
                <th style={{ padding: '10px 14px', color: '#2563eb', textAlign: 'center' }}>PRO</th>
                <th style={{ padding: '10px 14px', color: '#9333ea', textAlign: 'center' }}>PLUS</th>
                <th style={{ padding: '10px 14px', color: '#d97706', textAlign: 'center' }}>PREMIUM</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Maksimal Proyek</td>
                {planKeys.map(k => {
                  const val = dynamicPlans[k]?.max_projects ?? (k === 'free' ? 1 : k === 'pro' ? 3 : k === 'plus' ? 10 : 999999)
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{val >= 999999 ? '∞ Unlimited' : `${val} Proyek`}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Pakar Manual (Undang Mandiri)</td>
                {planKeys.map(k => {
                  const val = dynamicPlans[k]?.max_experts_manual ?? (k === 'free' ? 5 : k === 'pro' ? 8 : k === 'plus' ? 15 : 999999)
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{val >= 999999 ? '∞ Unlimited' : `${val} Pakar`}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Pakar Direktori Platform</td>
                {planKeys.map(k => {
                  const val = dynamicPlans[k]?.max_experts_directory ?? (k === 'free' ? 0 : k === 'pro' ? 5 : k === 'plus' ? 10 : 999999)
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{val === 0 ? '❌ Tidak Ada' : val >= 999999 ? '∞ Unlimited' : `${val} Pakar`}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Konsultasi/Pakar (Kuota Tiket)</td>
                {planKeys.map(k => {
                  const val = dynamicPlans[k]?.max_consultation_per_expert ?? (k === 'free' ? 0 : k === 'pro' ? 3 : k === 'plus' ? 5 : 15)
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{val === 0 ? '❌ Nonaktif' : `${val} Tiket`}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Subkriteria Multi-Level</td>
                {planKeys.map(k => <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>✔️ Ya</td>)}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Matriks Bobot Alternatif</td>
                {planKeys.map(k => <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{k === 'free' ? '❌ Bobot Saja' : '✔️ Ya'}</td>)}
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Modul AI Analisis Riset</td>
                {planKeys.map(k => <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{k === 'free' || k === 'pro' ? '❌ Tidak' : '🤖 Ya'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>📖 Kamus Istilah Fitur &amp; Parameter</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 20 }}>
          {FEATURE_EXPLANATIONS.map((item, idx) => (
            <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 2 }}>{item.feature}</div>
              <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={S.btnClose} type="button">Tutup Perbandingan</button>
      </div>
    </div>
  )
}

function UpgradeModal({
  currentPlan,
  onClose,
}: {
  currentPlan: PlanType
  onClose: () => void
}) {
  const plans: PlanType[] = ['free', 'pro', 'plus', 'premium']
  const S = modalStyles

  const [dynamicPlans, setDynamicPlans] = useState<Record<string, DynamicPlanSetting>>({})
  const [fetchingPlans, setFetchingPlans] = useState(true)
  const [showComparisonTable, setShowComparisonTable] = useState(false)
  const [isXenditActive, setIsXenditActive] = useState(false)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)

  const [userLocation, setUserLocation] = useState('Indonesia (Default)')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [selectedPlanTarget, setSelectedPlanTarget] = useState('Custom / Upgrade Plan')
  const [adminMessage, setAdminMessage] = useState('')
  const [submittingAdmin, setSubmittingAdmin] = useState(false)

  useEffect(() => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const language = navigator.language || 'id-ID'
      
      let detectedRegion = 'Indonesia'
      if (timezone) {
        const parts = timezone.split('/')
        if (parts.length > 1) {
          detectedRegion = `${parts[1].replace('_', ' ')} (${parts[0]})`
        } else {
          detectedRegion = timezone
        }
      }
      setUserLocation(`${detectedRegion} [${language}]`)
    } catch (e) {
      setUserLocation('Indonesia (Default)')
    }

    async function loadPlanSettings() {
      try {
        setFetchingPlans(true)
        const [jsonPlans, jsonPayment] = await Promise.all([
          safeFetchJson(`${API_URL}?action=getplansettings&_t=${Date.now()}`),
          safeFetchJson(`${API_URL}?action=getpaymentsettings&_t=${Date.now()}`)
        ])

        if (jsonPlans && jsonPlans.success && Array.isArray(jsonPlans.data)) {
          const map: Record<string, DynamicPlanSetting> = {}
          jsonPlans.data.forEach((p: DynamicPlanSetting) => {
            if (p.plan_key) {
              map[String(p.plan_key).toLowerCase().trim()] = p
            }
          })
          setDynamicPlans(map)
        }

        if (jsonPayment && jsonPayment.success && jsonPayment.data) {
          setIsXenditActive(String(jsonPayment.data.is_xendit_active).toUpperCase() === 'TRUE')
        }

      } catch (err) {
        console.warn('Gagal memuat pengaturan plan dinamis:', err)
      } finally {
        setFetchingPlans(false)
      }
    }
    void loadPlanSettings()
  }, [])

  const handleSelectPlan = async (planKey: string, price: number | string) => {
    if (planKey === 'free') {
      alert('Anda sudah berada di paket Free.')
      return
    }

    if (!isXenditActive) {
      alert(
        `Sistem pembayaran otomatis Xendit sedang dalam tahap persiapan infrastruktur badan usaha.\n\nSilakan gunakan tombol "Hubungi Admin" di dalam card paket untuk pengaktifan paket ${planKey.toUpperCase()} secara manual.`
      )
      return
    }

    const confirmCheckout = window.confirm(`Anda akan memilih paket ${planKey.toUpperCase()}. Lanjutkan ke halaman pembayaran Xendit?`)
    if (!confirmCheckout) return

    setProcessingPlan(planKey)

    try {
      const session = getSession()
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createxenditinvoice',
          user_id: session?.id || '',
          user_email: session?.email || '',
          plan: planKey
        }),
        redirect: 'follow',
      })

      const result = await response.json()

      if (result.success && result.invoice_url) {
        window.location.href = result.invoice_url
      } else {
        alert('❌ Gagal membuat tagihan: ' + (result.message || 'Terjadi kesalahan pada server.'))
        setProcessingPlan(null)
      }
    } catch (err) {
      console.error('Error proses pembayaran:', err)
      alert('Gagal menyambung ke server pembayaran. Silakan coba beberapa saat lagi.')
      setProcessingPlan(null)
    }
  }

  const handleOpenAdminModal = (planName: string) => {
    setSelectedPlanTarget(planName)
    setShowAdminModal(true)
  }

  const handleAdminMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminMessage.trim()) {
      alert('Mohon tuliskan pesan atau pertanyaan Anda.')
      return
    }

    try {
      setSubmittingAdmin(true)
      const session = getSession()
      const ticketId = `PRICING-SUP-${Date.now()}`
      
      const payload = {
        action: 'submitconsultation',
        ticket_id: ticketId,
        expert_id: 'ADMIN-PRICING',
        expert_email: 'admin@avitech.cloud',
        expert_name: 'Tim Layanan Pelanggan & Billing',
        user_name: session?.nama || session?.email || 'Pengguna Dashboard',
        user_email: session?.email ? session.email.trim().toLowerCase() : 'tamu@pricing.com',
        asal_instansi: `Lokasi User: ${userLocation}`,
        pertanyaan: `[Peminatan Plan: ${selectedPlanTarget}] ${adminMessage.trim()}`,
        userPlan: currentPlan,
        status: 'Pending Admin'
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      })

      const result = JSON.parse(await res.text())
      if (result && result.success) {
        alert(`✅ Pesan Anda berhasil dikirim ke Admin (#${ticketId}). Tim kami akan segera menanggapi melalui email.`);
        setShowAdminModal(false)
        setAdminMessage('')
      } else {
        alert('Gagal mengirim pesan: ' + (result.message || 'Terjadi kesalahan.'))
      }
    } catch (err: any) {
      alert(`Kesalahan jaringan: ${err.message}`)
    } finally {
      setSubmittingAdmin(false)
    }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      {showComparisonTable && (
        <FeatureComparisonModal dynamicPlans={dynamicPlans} onClose={() => setShowComparisonTable(false)} />
      )}

      {showAdminModal && (
        <div style={S.overlay} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.modal, maxWidth: 460 }}>
            <div style={S.header}>
              <h3 style={S.title}>✉️ Hubungi Admin ({selectedPlanTarget})</h3>
              <button onClick={() => setShowAdminModal(false)} style={S.closeBtn} type="button">✕</button>
            </div>

            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
              Sampaikan kendala atau pertanyaan Anda mengenai paket ini, admin akan membalas langsung melalui email akun Anda.
            </p>

            <form onSubmit={handleAdminMessageSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Pesan / Kebutuhan Paket *</label>
                <textarea 
                  rows={4} 
                  placeholder="Tuliskan pertanyaan atau kendala langganan Anda di sini..." 
                  value={adminMessage} 
                  onChange={(e) => setAdminMessage(e.target.value)} 
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box', resize: 'vertical' }}
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button type="button" onClick={() => setShowAdminModal(false)} style={S.btnClose}>
                  Batal
                </button>
                <button type="submit" disabled={submittingAdmin} style={{ ...S.btnClose, background: '#2563eb', color: 'white', fontWeight: 700 }}>
                  {submittingAdmin ? 'Mengirim...' : 'Kirim Pesan ke Admin →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ ...S.modal, maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>🚀 Upgrade Semester Pass</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Pilih paket Semester Pass (6 Bulan) sesuai skala kebutuhan riset atau instansi Anda.</p>
          </div>
          
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button 
              onClick={() => setShowComparisonTable(true)}
              style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              type="button"
            >
              📊 Lihat Perbandingan Detail Fitur
            </button>
            <button onClick={onClose} style={S.closeBtn} type="button">✕</button>
          </div>
        </div>

        {fetchingPlans ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13 }}>
            ⏳ Memuat daftar paket terbaru...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 16, marginBottom: 20 }}>
            {plans.map((plan) => {
              const staticCfg = PLAN_CONFIG[plan]
              const dynamicCfg = dynamicPlans[plan]
              const isActive = plan === currentPlan

              const label = dynamicCfg?.label || staticCfg.label
              const priceText = dynamicCfg ? formatRupiah(Number(dynamicCfg.price || 0)) : staticCfg.price
              
              let featuresList: string[] = []

              if (dynamicCfg) {
                featuresList.push(`Maksimal ${dynamicCfg.max_projects >= 999999 ? 'Unlimited' : dynamicCfg.max_projects} Proyek`)
                featuresList.push(`Hingga ${dynamicCfg.max_experts_manual >= 999999 ? 'Unlimited' : dynamicCfg.max_experts_manual} Expert Manual`)

                const expDirCount = Number(dynamicCfg.max_experts_directory || 0)
                if (expDirCount > 0) {
                  featuresList.push(`Hingga ${expDirCount >= 999999 ? 'Unlimited' : expDirCount} Expert Direktori`)
                }

                const consultCount = Number(dynamicCfg.max_consultation_per_expert || 0)
                if (consultCount > 0) {
                  featuresList.push(`Max ${consultCount >= 999999 ? 'Unlimited' : consultCount} Konsultasi/Pakar`)
                }

                featuresList.push(
                  String(dynamicCfg.allow_subcriteria).toUpperCase() === 'TRUE' || dynamicCfg.allow_subcriteria === true 
                    ? '✔️ Subkriteria' 
                    : '❌ Subkriteria'
                )
                featuresList.push(
                  String(dynamicCfg.allow_alternative_method).toUpperCase() === 'TRUE' || dynamicCfg.allow_alternative_method === true 
                    ? '✔️ Bobot Alternatif' 
                    : '❌ Bobot Alternatif'
                )
                featuresList.push(
                  String(dynamicCfg.allow_ai_features).toUpperCase() === 'TRUE' || dynamicCfg.allow_ai_features === true 
                    ? '🤖 Fitur AI Analisis' 
                    : '❌ AI Analisis'
                )
              } else {
                featuresList = staticCfg.features || []
              }

              return (
                <div
                  key={plan}
                  style={isActive ? { ...S.planCard, ...S.planCardActive } : S.planCard}
                >
                  <div style={{ fontSize: 15, fontWeight: 800, color: staticCfg.color, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{priceText}</div>
                  
                  <div style={{ textAlign: 'left', marginTop: 10, minHeight: 180 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Fasilitas:</div>
                    <ul style={{ paddingLeft: 14, margin: 0, fontSize: 11.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.35 }}>
                      {featuresList.map((feature: string, idx: number) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {isActive ? (
                      <div style={{ ...S.planBadge, padding: '6px 10px', fontSize: 11.5, width: '100%', textAlign: 'center', boxSizing: 'border-box', margin: 0 }}>✔️ Paket Saat Ini</div>
                    ) : (
                      <button 
                        onClick={() => handleSelectPlan(plan, dynamicCfg?.price ?? 0)}
                        style={{
                          width: '100%',
                          padding: '9px 0',
                          background: plan === 'free' ? '#f1f5f9' : '#2563eb',
                          color: plan === 'free' ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: plan === 'free' ? 'not-allowed' : 'pointer',
                          boxShadow: plan === 'free' ? 'none' : '0 2px 8px rgba(37,99,235,0.2)'
                        }}
                        disabled={plan === 'free' || processingPlan === plan}
                      >
                        {processingPlan === plan ? 'Memproses...' : plan === 'free' ? 'Tidak Tersedia' : 'Pilih Paket'}
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenAdminModal(label)}
                      style={{
                        width: '100%',
                        padding: '6px 0',
                        background: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      type="button"
                    >
                      ✉️ Hubungi Admin
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ ...S.infoBox, background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
          💡 <strong>Informasi Sistem:</strong> Pengaktifan paket saat ini dilayani secara langsung melalui koordinasi administrator sambil mempersiapkan integrasi kanal pembayaran resmi.
        </div>
      </div>
    </div>
  )
}

function ProfileModal({
  user,
  profile,
  onClose,
  onSaveSuccess,
}: {
  user: UserSession
  profile: UserProfileData
  onClose: () => void
  onSaveSuccess: (updated: UserProfileData) => void
}) {
  const [formData, setFormData] = useState<UserProfileData>({
    nama: profile.nama || user.nama || '',
    institusi: profile.institusi || '',
    city: profile.city || '',
    digital_signature: profile.digital_signature || '',
    foto_profil: profile.foto_profil || '',
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [previewSig, setPreviewSig] = useState(profile.digital_signature || '')
  const [previewFoto, setPreviewFoto] = useState(profile.foto_profil || '')

  const handleFotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar (JPG/PNG).')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setPreviewFoto(base64)
        setFormData((prev) => ({ ...prev, foto_profil: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar tanda tangan (PNG/JPG).')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setPreviewSig(base64)
        setFormData((prev) => ({ ...prev, digital_signature: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    try {
      const payload = {
        action: 'updateuserprofile',
        email: user.email,
        user_id: user.id,
        nama: formData.nama,
        institusi: formData.institusi,
        city: formData.city,
        digital_signature: formData.digital_signature || '',
        foto_profil: formData.foto_profil || '',
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      })

      const result = await response.json()

      if (result.success) {
        onSaveSuccess({ 
          ...formData, 
          digital_signature: formData.digital_signature || '',
          foto_profil: formData.foto_profil || '' 
        })
        alert('✅ ' + result.message)
        onClose()
      } else {
        alert('❌ Gagal dari Server: ' + result.message)
        setErrorMsg(result.message)
      }

    } catch (err: any) {
      console.error("Error Simpan Profil:", err)
      setErrorMsg('Gagal menyambung ke server: ' + err.toString())
    } finally {
      setSaving(false)
    }
  }

  const S = modalStyles

  return (
    <div style={S.overlay} onClick={onClose}>
      <div 
        style={{ 
          ...S.modal, 
          maxWidth: 540, 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          padding: '24px 28px'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...S.header, marginBottom: 12, flexShrink: 0 }}>
          <h2 style={S.title}>⚙️ Pengaturan Profil &amp; Pengesahan</h2>
          <button onClick={onClose} style={S.closeBtn} type="button">
            ✕
          </button>
        </div>

        <p style={{ ...S.desc, flexShrink: 0, marginBottom: 12 }}>
          Lengkapi identitas Anda, unggah foto profil, dan unggah file tanda tangan digital Anda.
        </p>

        {errorMsg && (
          <div style={{ ...S.infoBox, background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', flexShrink: 0 }}>
            {errorMsg}
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
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
            <label style={formStyles.label}>Nama Lengkap &amp; Gelar</label>
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Dr. Arben Virgota, S.Pi., M.Si"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Nama Institusi / Afiliasi</label>
            <input
              type="text"
              required
              value={formData.institusi}
              onChange={(e) => setFormData({ ...formData, institusi: e.target.value })}
              placeholder="Contoh: Universitas Mataram"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Kota</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Contoh: Mataram"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Foto Profil (Upload File Gambar)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoFileChange}
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
              ⚠️ <strong>Catatan Batas Ukuran:</strong> Pastikan ukuran file foto di bawah <strong>35 KB</strong>.
            </div>

            <div style={{ ...formStyles.previewBox, height: 50, marginTop: 4 }}>
              {previewFoto ? (
                <img 
                  src={previewFoto} 
                  alt="Pratinjau Foto Profil" 
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                  Belum ada foto yang dipilih
                </span>
              )}
            </div>
          </div>

          <div>
            <label style={formStyles.label}>Tanda Tangan Digital (.png Transparan)</label>
            <input
              type="file"
              accept="image/*"
              required={!previewSig}
              onChange={handleSigFileChange}
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
              ⚠️ <strong>Catatan Batas Ukuran:</strong> Pastikan ukuran file tanda tangan di bawah <strong>35 KB</strong>.
            </div>

            <div style={formStyles.previewBox}>
              {previewSig ? (
                <img 
                  src={previewSig} 
                  alt="Pratinjau Tanda Tangan" 
                  style={{ maxHeight: 45, objectFit: 'contain' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                  Belum ada tanda tangan yang dipilih
                </span>
              )}
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <button onClick={onClose} style={S.btnClose} type="button">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              ...S.btnClose,
              background: '#2563eb',
              color: 'white',
              fontWeight: 700,
            }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function methodLabel(value: string) {
  const v = String(value || '').toLowerCase()
  return v === 'bobotalternatif' || v === 'bobot_alternatif'
    ? 'Bobot Alternatif'
    : 'Bobot Saja'
}

function splitCsv(value: unknown): string[] {
  if (!value) return []
  return String(value)
    .split(/[,|]+/)
    .map((item) => item.trim())
    .filter((item) => 
      item.length > 0 && 
      item !== 'null' && 
      item !== 'undefined' && 
      item !== '""' && 
      item !== "''" &&
      item !== ',' &&
      item !== '|'
    )
}

function countSubcriteriaFromMap(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0

  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => {
    if (!Array.isArray(item)) return sum
    return sum + item.length
  }, 0)
}

function normalizeProject(raw: RawProject): Project {
  const criteriaList = splitCsv(raw?.kriteria ?? raw?.criteria ?? raw?.criteria_csv ?? (raw as any)?.['criteria'])
  const alternatifList = splitCsv(raw?.alternatif ?? raw?.alternatives ?? raw?.alternatif_csv)

  const subMap =
    raw?.subkriteria_map && typeof raw.subkriteria_map === 'object'
      ? raw.subkriteria_map
      : {}

  const subcriteriaCount =
    Number(raw?.subcriteria_count ?? 0) || countSubcriteriaFromMap(subMap)

  let calculatedAltCount = 0;
  if (raw?.alternatif_count !== undefined && raw?.alternatif_count !== null && raw?.alternatif_count !== '') {
    calculatedAltCount = Number(raw.alternatif_count);
  } else {
    calculatedAltCount = alternatifList.length;
  }
  if (alternatifList.length === 0) {
    calculatedAltCount = 0;
  }

  let calculatedCritCount = 0;
  if (raw?.criteria_count !== undefined && raw?.criteria_count !== null && raw?.criteria_count !== '') {
    calculatedCritCount = Number(raw.criteria_count);
  } else {
    calculatedCritCount = criteriaList.length;
  }
  
  if (calculatedCritCount === 0 && criteriaList.length > 0) {
    calculatedCritCount = criteriaList.length;
  }

  const expertCount = Number(raw?.jumlah_expert ?? raw?.jumlahexpert ?? 0)

  return {
    id: String(raw?.id ?? raw?.project_id ?? raw?.projectid ?? '').trim(),
    user_id: String(raw?.user_id ?? raw?.userid ?? '').trim(),
    user_email: String(raw?.user_email ?? raw?.email ?? '').trim(),
    nama_proyek: String(raw?.nama_proyek ?? raw?.namaproyek ?? raw?.judul ?? raw?.title ?? '').trim(),
    deskripsi: String(raw?.deskripsi ?? '').trim(),
    metode: String(raw?.metode ?? '').trim(),
    jumlah_expert: expertCount,
    jumlah_expert_responden: expertCount, 
    punya_subkriteria: Boolean(raw?.punya_subkriteria),
    fasilitator_email: String(raw?.fasilitator_email ?? raw?.fasilitatoremail ?? '').trim(),
    fasilitator_whatsapp: String(
      raw?.fasilitator_whatsapp ?? raw?.fasilitatorwhatsapp ?? ''
    ).trim(),
    
    criteria_count: Number.isNaN(calculatedCritCount) ? 0 : calculatedCritCount,
    subcriteria_count: Number.isNaN(subcriteriaCount) ? 0 : subcriteriaCount,
    alternatif_count: Number.isNaN(calculatedAltCount) ? 0 : calculatedAltCount,
    
    criteria_preview: criteriaList.slice(0, 4),
    alternatif_preview: alternatifList.slice(0, 4),
    created_at: String(raw?.created_at ?? '').trim(),
    updated_at: String(raw?.updated_at ?? raw?.created_at ?? '').trim(),
  }
}

// 🟢 KOMPONEN TOP BAR UTAMA
function AppTopBar() {
  return (
    <div style={topBarStyles.container} className="no-print">
      <div style={topBarStyles.brandGroup}>
        <img src="/logo.png" alt="Logo AHP" style={topBarStyles.logo} />
        <div>
          <h2 style={topBarStyles.title}>ANALYTIC HIERARCHY PROCESS</h2>
          <p style={topBarStyles.subtitle}>Sistem Pendukung Keputusan Multi-Kriteria Terintegrasi</p>
        </div>
      </div>
    </div>
  )
}

// 🟢 KOMPONEN SIDEBAR BERSIH
function DashboardSidebar({
  user,
  userProfile,
  userPlan,
  projects,
  isProfileComplete,
  isCollapsed,
  consultationCount,
  onToggleCollapse,
  onOpenProfile,
  onOpenUpgrade,
  onLogout,
}: {
  user: UserSession | null
  userProfile: UserProfileData
  userPlan: string
  projects: Project[]
  isProfileComplete: boolean
  isCollapsed: boolean
  consultationCount: number
  onToggleCollapse: () => void
  onOpenProfile: () => void
  onOpenUpgrade: () => void
  onLogout: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()

  const planLabelFormatted = `Plan: ${userPlan.toUpperCase()}`
  const planBadgeColor = 
    userPlan === 'premium' ? '#9333ea' : 
    userPlan === 'plus' ? '#2563eb' : 
    userPlan === 'pro' ? '#16a34a' : '#64748b'

  const navItems = [
    {
      label: planLabelFormatted,
      icon: '⭐',
      badgeColor: planBadgeColor,
      onClick: onOpenUpgrade
    },
    {
      label: 'Dashboard Utama',
      icon: '📊',
      active: pathname === '/dashboard',
      onClick: () => router.push('/dashboard')
    },
    {
      label: 'Proyek AHP Saya',
      icon: '📁',
      badge: projects.length > 0 ? String(projects.length) : undefined,
      badgeColor: '#2563eb',
      active: pathname === '/user/projects',
      onClick: () => router.push('/user/projects'),
      tourClass: 'tour-step-project' // 🟢 Tambahan untuk Joyride
    },
    {
      label: 'Pusat Konsultasi',
      icon: '💬',
      badge: consultationCount > 0 ? String(consultationCount) : undefined,
      badgeColor: '#10b981',
      active: pathname === '/user/consultations',
      onClick: () => router.push('/user/consultations'),
      tourClass: 'tour-step-consultation' // 🟢 Tambahan untuk Joyride
    },
    {
      label: 'Direktori Pakar',
      icon: '👥',
      active: pathname === '/expert-directory' || pathname === '/expert/directory',
      onClick: () => router.push('/expert-directory'),
      tourClass: 'tour-step-expert' // 🟢 Tambahan untuk Joyride
    },
    {
      label: 'Profil & Pengesahan',
      icon: '⚙️',
      badge: !isProfileComplete ? '!' : undefined,
      badgeColor: '#ef4444',
      onClick: onOpenProfile,
      tourClass: 'tour-step-profile' // 🟢 Tambahan untuk Joyride
    },
    {
      label: 'Panduan Sistem',
      icon: '📖',
      active: pathname === '/panduan',
      onClick: () => router.push('/panduan')
    }
  ]

  return (
    <aside style={{
      ...sidebarStyles.aside,
      width: isCollapsed ? 76 : 260,
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={sidebarStyles.brandContainer}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={sidebarStyles.brandLogo}>AHP</div>
            <div>
              <div style={sidebarStyles.brandTitle}>AHP Avitech</div>
              <div style={sidebarStyles.brandSubtitle}>DSS Platform</div>
            </div>
          </div>
        )}
        <button 
          type="button" 
          onClick={onToggleCollapse} 
          style={sidebarStyles.collapseBtn}
          title={isCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease'
            }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{
        ...sidebarStyles.userCard,
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        padding: isCollapsed ? '10px 4px' : '12px'
      }}>
        <div style={{
          ...sidebarStyles.userAvatar,
          background: userProfile.foto_profil ? 'transparent' : '#2563eb'
        }}>
          {userProfile.foto_profil ? (
            <img 
              src={userProfile.foto_profil} 
              alt="Avatar" 
              style={sidebarStyles.userAvatarImg} 
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{(userProfile.nama || user?.nama || user?.email || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>

        {!isCollapsed && (
          <div style={sidebarStyles.userInfo}>
            <div style={sidebarStyles.userName}>{userProfile.nama || user?.nama || 'Pengguna'}</div>
            <div style={sidebarStyles.userEmail}>{user?.email}</div>
          </div>
        )}
      </div>

      <nav style={sidebarStyles.nav}>
        {navItems.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={item.onClick}
            title={isCollapsed ? item.label : undefined}
            className={item.tourClass} // 🟢 Menyisipkan Class untuk Joyride
            style={{
              ...sidebarStyles.navButton,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '12px 0' : '10px 14px',
              ...(item.active ? sidebarStyles.navButtonActive : {}),
              ...(idx === 0 ? { background: '#1e293b', border: '1px solid #334155', fontWeight: 700, color: '#f8fafc' } : {})
            }}
          >
            <span style={sidebarStyles.navIcon}>{item.icon}</span>
            {!isCollapsed && <span style={sidebarStyles.navLabel}>{item.label}</span>}
            {item.badge && (
              <span style={{
                ...sidebarStyles.badgeWarn,
                background: item.badgeColor || '#ef4444',
                position: isCollapsed ? 'absolute' : 'relative',
                top: isCollapsed ? 4 : 'auto',
                right: isCollapsed ? 12 : 'auto'
              }}>
                {item.badge}
              </span>
            )}
            {idx === 0 && !isCollapsed && (
              <span style={{ fontSize: 9.5, background: planBadgeColor, color: '#fff', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                Upgrade
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{
        ...sidebarStyles.footer,
        padding: isCollapsed ? '12px 6px' : '16px'
      }}>
        <button 
          type="button" 
          onClick={onLogout} 
          style={sidebarStyles.btnLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          {isCollapsed ? '🚪' : '🚪 Logout Akun'}
        </button>
      </div>
    </aside>
  )
}

// 🟢 Komponen isi utama dashboard
function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [session, setSession] = useState<UserSession | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [dynamicPlans, setDynamicPlans] = useState<Record<string, DynamicPlanSetting>>({})

  const [projects, setProjects] = useState<Project[]>([])
  const [consultations, setConsultations] = useState<ConsultationTicket[]>([])
  const [visitorStats, setVisitorStats] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // State Konfirmasi Pembayaran
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentTicket, setPaymentTicket] = useState<any>(null)
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const [userProfile, setUserProfile] = useState<UserProfileData>({
    nama: '',
    institusi: '',
    city: '',
    digital_signature: '',
    foto_profil: '',
  })
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    if (searchParams.get('action') === 'profile') {
      setShowProfileModal(true)
    }
  }, [searchParams])

  const isProfileComplete = useMemo(() => {
    return Boolean(
      userProfile.nama?.trim() &&
      userProfile.institusi?.trim() &&
      userProfile.city?.trim() &&
      userProfile.digital_signature?.trim()
    )
  }, [userProfile])

  // 🟢 LOAD DASHBOARD SUPER CEPAT & RESILIEN (TANPA N+1 QUERY)
  const loadDashboard = useCallback(async (user: UserSession, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const cleanUserEmail = String(user.email || '').trim().toLowerCase()

      // Fetch semua endpoint esensial secara paralel dengan safe fetch
      const [subJson, projJson, consultJson, userJson, statsJson, planJson] = await Promise.all([
        safeFetchJson(`${API_URL}?action=getusersubscription&user_id=${encodeURIComponent(user.id)}&email=${encodeURIComponent(cleanUserEmail)}&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getprojects&email=${encodeURIComponent(cleanUserEmail)}&user_id=${encodeURIComponent(user.id)}&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getconsultationrequests&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getuserprofile&email=${encodeURIComponent(cleanUserEmail)}&user_id=${encodeURIComponent(user.id)}&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getvisitorstats&email=${encodeURIComponent(cleanUserEmail)}&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getplansettings&_t=${Date.now()}`)
      ])

      let currentSub: any = null
      let fallbackPlanFromUser: PlanType = 'free'

      // 1. Profil Pengguna
      if (userJson && userJson.data) {
        setUserProfile({
          nama: userJson.data.nama || user.nama || '',
          institusi: userJson.data.institusi || '',
          city: userJson.data.city || userJson.data.kota || '',
          digital_signature: userJson.data.digital_signature || userJson.data.tandatangan || '',
          foto_profil: userJson.data.foto_profil || userJson.data.fotoprofil || '',
        })

        const userRawPlan = String(userJson.data.plan || userJson.data.role || userJson.data.status_user || '').toLowerCase().trim()
        if (['free', 'pro', 'plus', 'premium'].includes(userRawPlan)) {
          fallbackPlanFromUser = userRawPlan as PlanType
        }
      }

      // 2. Subscription Data
      if (subJson) {
        const parsed = normalizeSubscriptionData(subJson, cleanUserEmail)
        if (parsed) currentSub = parsed
      }

      if (!currentSub) {
        currentSub = {
          plan: fallbackPlanFromUser,
          status: 'active',
          user_email: cleanUserEmail,
          user_id: user.id
        }
      }
      setSubscription(currentSub)

      // 3. Plan Config
      if (planJson && planJson.success && Array.isArray(planJson.data)) {
        const map: Record<string, DynamicPlanSetting> = {}
        planJson.data.forEach((p: DynamicPlanSetting) => {
          if (p.plan_key) {
            map[String(p.plan_key).toLowerCase().trim()] = p
          }
        })
        setDynamicPlans(map)
      }

      // 4. Visitor Stats
      if (statsJson && statsJson.success) {
        const totalVisits = typeof statsJson.data === 'object' && statsJson.data !== null 
          ? (statsJson.data.total_visits || statsJson.data.total_public_visits || 0)
          : (statsJson.total_visits || statsJson.total_public_visits || 0)
        setVisitorStats(totalVisits)
      }

      // 5. Proyek Data (Instan, Tanpa N+1 query per project)
      const rawProjectList = projJson?.data || (Array.isArray(projJson) ? projJson : [])
      if (Array.isArray(rawProjectList)) {
        setProjects(rawProjectList.map(normalizeProject))
      } else {
        setProjects([])
      }

      // 6. Konsultasi Data
      if (consultJson && consultJson.success && Array.isArray(consultJson.data)) {
        const myTickets: ConsultationTicket[] = (consultJson.data as RawConsultation[])
          .filter((item: RawConsultation) => {
            const itemEmail = String(
              item.user_email || 
              item.userEmail || 
              item.kontakUser || 
              item.kontak_user || 
              item.user_contact || 
              ''
            ).toLowerCase().trim()

            if (cleanUserEmail.includes('admin') || cleanUserEmail === 'admin@ahp.avitech.cloud') {
              return true
            }
            return itemEmail === cleanUserEmail || (itemEmail && cleanUserEmail.includes(itemEmail))
          })
          .map((item: RawConsultation) => ({
            idTiket: String(item.idTiket || item.id_tiket || item.ticket_id || item.id || '-'),
            projectId: String(item.projectId || item.project_id || item.id_proyek || 'Umum'),
            namaUser: String(item.namaUser || item.nama_user || item.user_name || 'User'),
            kontakUser: String(item.kontakUser || item.user_email || item.userEmail || item.kontak_user || user.email),
            expertTujuan: String(item.expertTujuan || item.expert_tujuan || item.expert_name || 'Expert'),
            topikPesan: String(item.topikPesan || item.topik_penelitian || item.topik_pesan || item.topic || '-'),
            pertanyaan: String(item.pertanyaan || item.pesan || ''),
            status: String(item.status || 'Menunggu'),
            created_at: String(item.created_at || item.tanggalDibuat || item.timestamp || ''),
            jawabanExpert: String(item.jawabanExpert || item.jawaban_expert || item.expertResponse || item.balasanExpert || ''),
            fileUrl: String(item.fileUrl || item.file_url || item.lampiran || '')
          }))

        setConsultations(myTickets)
      } else {
        setConsultations([])
      }

    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Gagal memuat beberapa data dashboard. Silakan coba klik refresh.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const s = getSession()

    if (!s) {
      router.replace('/login')
      return
    }

    setSession(s)
    void loadDashboard(s)
  }, [router, loadDashboard])

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('⚠️ Harap unggah file gambar (JPG/PNG).')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 400

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        const compressed = canvas.toDataURL('image/jpeg', 0.5)
        
        if (compressed.length > 50000) {
          alert('⚠️ Gambar struk masih terlalu besar/kompleks. Harap crop gambar Anda menjadi lebih kecil.')
          e.target.value = ''
          return
        }

        setPaymentReceiptUrl(compressed)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentReceiptUrl) {
      alert('Harap pilih/unggah gambar bukti transfer terlebih dahulu.')
      return
    }
    try {
      setSubmittingPayment(true)
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'submitpaymentreceipt',
          ticket_id: paymentTicket.idTiket,
          file_url: paymentReceiptUrl
        }),
        redirect: 'follow'
      })
      const json = await res.json()
      if (json.success) {
        alert('✅ Bukti pembayaran berhasil diunggah. Tim admin akan segera memverifikasi transaksi Anda.')
        setShowPaymentModal(false)
        setPaymentReceiptUrl('')
        if (session) void loadDashboard(session, true)
      } else {
        alert('Gagal mengunggah bukti: ' + (json.message || 'Terjadi kesalahan.'))
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  const currentPlan: PlanType = subscription?.plan ?? 'free'
  const planConfig = PLAN_CONFIG[currentPlan] || PLAN_CONFIG['free']
  const subscriptionLike = subscription as SubscriptionLike | null
  const globalDynamicPlan = dynamicPlans[currentPlan]

  const maxProjects = useMemo(() => {
    if (subscriptionLike && (subscriptionLike.max_projects !== undefined && subscriptionLike.max_projects !== null)) {
      const explicitLimit = toFiniteLimit(subscriptionLike.max_projects)
      return explicitLimit !== null ? explicitLimit : 0
    }
    return (
      (globalDynamicPlan ? toFiniteLimit(globalDynamicPlan.max_projects) : null) ??
      planConfig.maxProjects
    )
  }, [subscriptionLike, globalDynamicPlan, planConfig])

  const totalProjects = projects.length
  const projectUsageText =
    maxProjects === Number.POSITIVE_INFINITY
      ? `${totalProjects} / ∞`
      : `${totalProjects} / ${maxProjects}`

  const totalExperts = useMemo(
    () => projects.reduce((sum, p) => sum + Number(p.jumlah_expert_responden || 0), 0),
    [projects]
  )

  const totalCriteria = useMemo(
    () => projects.reduce((sum, p) => sum + Number(p.criteria_count || 0), 0),
    [projects]
  )

  const totalAlternatif = useMemo(
    () => projects.reduce((sum, p) => sum + Number(p.alternatif_count || 0), 0),
    [projects]
  )

  const canCreateProject =
    maxProjects === Number.POSITIVE_INFINITY || totalProjects < maxProjects

  const handleLogout = () => {
    clearSession()
    router.replace('/login')
  }

  const handleRefresh = () => {
    if (!session) return
    void loadDashboard(session, true)
  }

  const handleCreateProject = () => {
    if (!isProfileComplete) {
      alert('⚠️ Mohon lengkapi Profil (Institusi, Kota, & Tanda Tangan Digital) terlebih dahulu sebelum membuat proyek baru.')
      setShowProfileModal(true)
      return
    }

    if (!canCreateProject) {
      setShowUpgrade(true)
      return
    }
    router.push('/buat-proyek/baru')
  }

  const S = styles

  if (loading) {
    return (
      <div style={S.loadingPage}>
        <div style={S.spinner} />
        <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Memuat dashboard...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={S.layoutWrapper}>
      
      {/* 🟢 SISIPKAN KOMPONEN ONBOARDING TOUR JOYRIDE */}
      <OnboardingTour />

      {/* 🟢 SIDEBAR BERSIH */}
      <DashboardSidebar
        user={session}
        userProfile={userProfile}
        userPlan={currentPlan}
        projects={projects}
        isProfileComplete={isProfileComplete}
        isCollapsed={isSidebarCollapsed}
        consultationCount={consultations.length}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenUpgrade={() => setShowUpgrade(true)}
        onLogout={handleLogout}
      />

      {/* 🟢 KONTEN UTAMA */}
      <main style={S.mainContent}>
        {showUpgrade && (
          <UpgradeModal
            currentPlan={currentPlan}
            onClose={() => setShowUpgrade(false)}
          />
        )}

        {showProfileModal && session && (
          <ProfileModal
            user={session}
            profile={userProfile}
            onClose={() => setShowProfileModal(false)}
            onSaveSuccess={(updated) => setUserProfile(updated)}
          />
        )}

        <div style={S.container}>
          
          {/* TOP BAR */}
          <AppTopBar />

          <div style={S.topbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={S.avatarContainer}>
                {userProfile.foto_profil ? (
                  <img 
                    src={userProfile.foto_profil} 
                    alt="Foto Profil" 
                    style={S.avatarImg} 
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={S.avatarPlaceholder}>
                    {(userProfile.nama || session?.nama || session?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <span style={S.academicTag}>AHP Decision Support System</span>
                <h1 style={S.pageTitle}>Dashboard Analisis</h1>
              </div>
            </div>

            <div style={S.topbarActions}>
              <button
                onClick={() => router.push('/user/projects')}
                style={S.btnPrimarySmall}
                type="button"
              >
                📁 Proyek Saya
              </button>
              <button
                onClick={() => router.push('/expert-directory')}
                style={S.btnSecondary}
                type="button"
              >
                👥 Direktori Pakar
              </button>
              <button
                onClick={() => setShowProfileModal(true)}
                style={S.btnProfile}
                type="button"
              >
                ⚙️ Profil {!isProfileComplete && <span style={S.badgeWarn}>!</span>}
              </button>
              <button onClick={handleRefresh} style={S.btnGhost} type="button">
                {refreshing ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          {!isProfileComplete && (
            <div style={S.profileWarningBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <strong style={{ fontSize: 13, color: '#92400e' }}>Profil Belum Lengkap:</strong>
                  <span style={{ fontSize: 12.5, color: '#b45309', marginLeft: 6 }}>
                    Harap lengkapi nama institusi, kota, dan tanda tangan digital untuk pengesahan sertifikat.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                style={S.btnWarningFix}
                type="button"
              >
                Lengkapi Sekarang
              </button>
            </div>
          )}

          <div style={S.heroCard}>
            <div style={S.heroLeft}>
              <div style={S.userBadge}>Halo, {userProfile.nama || session?.nama || session?.email}</div>
              <h2 style={S.heroTitle}>
                Siap Melakukan Sintesis Keputusan Hari Ini
              </h2>
              <p style={S.heroDesc}>
                Kelola hirarki kriteria, distribusikan kuesioner token pakar, dan evaluasi hasil agregat geometric mean dalam satu platform terintegrasi.
              </p>
            </div>

            <div style={S.heroRight}>
              <div style={S.planSummaryCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      ...S.planPill,
                      color: planConfig.color,
                      background: planConfig.bg,
                      border: `1px solid ${planConfig.border}`,
                    }}
                  >
                    {planConfig.label}
                  </span>
                  <span style={S.planPrice}>{planConfig.price}</span>
                </div>
                <div style={S.planMeta}>Proyek: <strong>{projectUsageText}</strong></div>
                <button onClick={handleCreateProject} className="tour-step-create-project" style={S.btnPrimary} type="button">
                  {canCreateProject ? '+ Buat Proyek' : 'Upgrade Paket'}
                </button>
                {currentPlan === 'free' && (
                  <button onClick={() => setShowUpgrade(true)} style={{ ...S.btnSecondary, marginTop: 4, width: '100%', textAlign: 'center' }} type="button">
                    🚀 Menu Upgrade Paket
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && <div style={S.errorBox}>{error}</div>}

          <div style={{ ...S.statsGrid, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
            <div style={S.statCard}>
              <div style={S.statLabel}>Proyek</div>
              <div style={S.statValue}>{totalProjects}</div>
            </div>

            <div style={S.statCard}>
              <div style={S.statLabel}>Expert</div>
              <div style={S.statValue}>{totalExperts}</div>
            </div>

            <div style={S.statCard}>
              <div style={S.statLabel}>Kriteria</div>
              <div style={S.statValue}>{totalCriteria}</div>
            </div>

            <div style={S.statCard}>
              <div style={S.statLabel}>Alternatif</div>
              <div style={S.statValue}>{totalAlternatif}</div>
            </div>

            <div style={S.statCard}>
              <div style={S.statLabel}>Total Kunjungan</div>
              <div style={S.statValue}>{visitorStats}</div>
            </div>
          </div>

          <div style={S.sectionHeader}>
            <h3 style={S.sectionTitle}>Ringkasan Proyek Terakhir</h3>
          </div>

          {projects.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>📂</div>
              <h3 style={S.emptyTitle}>Belum ada proyek</h3>
              <p style={S.emptyDesc}>
                Klik <strong>Buat Proyek</strong> untuk mulai menyusun model analisis.
              </p>
            </div>
          ) : (
            <div style={S.projectList}>
              {projects.slice(0, 2).map((project) => (
                <div key={project.id} style={S.projectCard}>
                  <div style={S.projectCardTop}>
                    <div>
                      <div style={S.projectTitleRow}>
                        <h4 style={S.projectTitle}>{project.nama_proyek}</h4>
                        <span style={S.projectId}>ID: {project.id}</span>
                      </div>

                      <div style={S.projectMetaRow}>
                        <span style={S.metaChip}>{methodLabel(project.metode)}</span>
                        <span style={S.metaChip}>
                          {project.punya_subkriteria ? 'Subkriteria' : 'Tanpa Subkriteria'}
                        </span>
                        <span style={S.metaChip}>
                          {project.jumlah_expert_responden} expert
                        </span>
                      </div>
                    </div>

                    <div style={S.actionGroup}>
                      <button
                        style={S.btnPrimarySmall}
                        type="button"
                        onClick={() =>
                          router.push(`/proyek/kelola?id=${encodeURIComponent(project.id)}`)
                        }
                      >
                        Buka Ruang Kerja
                      </button>
                    </div>
                  </div>

                  <p style={S.projectDesc}>
                    {project.deskripsi?.trim()
                      ? project.deskripsi
                      : 'Tidak ada deskripsi.'}
                  </p>

                  <div style={S.projectStats}>
                    <div style={S.projectStatBox}>
                      <div style={S.projectStatLabel}>Kriteria</div>
                      <div style={S.projectStatValue}>{project.criteria_count}</div>
                    </div>
                    <div style={S.projectStatBox}>
                      <div style={S.projectStatLabel}>Subkriteria</div>
                      <div style={S.projectStatValue}>{project.subcriteria_count}</div>
                    </div>
                    <div style={S.projectStatBox}>
                      <div style={S.projectStatLabel}>Alternatif</div>
                      <div style={S.projectStatValue}>{project.alternatif_count}</div>
                    </div>
                  </div>

                  <div style={S.projectFooter}>
                    <span style={S.footerMeta}>
                      Fasilitator: {project.fasilitator_email || '-'}
                    </span>
                    <span style={S.footerMeta}>
                      Diperbarui: {formatDate(project.updated_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {showPaymentModal && paymentTicket && (
          <div style={modalStyles.overlay} onClick={() => setShowPaymentModal(false)}>
            <div style={{ ...modalStyles.modal, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <div style={modalStyles.header}>
                <h3 style={modalStyles.title}>💸 Konfirmasi Pembayaran</h3>
                <button onClick={() => setShowPaymentModal(false)} style={modalStyles.closeBtn} type="button">✕</button>
              </div>
              
              <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 14, lineHeight: 1.4 }}>
                Unggah foto/struk bukti transfer Anda untuk tiket <strong>#{paymentTicket.idTiket}</strong>. Admin akan memverifikasi dan mengaktifkan paket Anda.
              </p>

              <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={formStyles.label}>Unggah Bukti Transfer (Maks 500 KB) *</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleReceiptUpload} 
                    style={{ fontSize: 12, marginBottom: 8, cursor: 'pointer' }} 
                    required={!paymentReceiptUrl} 
                  />
                  
                  <div style={{ height: 150, border: '1px dashed #cbd5e1', borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {paymentReceiptUrl ? (
                      <img src={paymentReceiptUrl} alt="Pratinjau Bukti" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada foto yang dipilih</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowPaymentModal(false)} style={modalStyles.btnClose}>
                    Batal
                  </button>
                  <button type="submit" disabled={submittingPayment} style={{ ...modalStyles.btnClose, background: '#16a34a', color: 'white', fontWeight: 700 }}>
                    {submittingPayment ? 'Mengunggah...' : 'Kirim Bukti Pembayaran →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat halaman dashboard...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

const topBarStyles: Record<string, CSSProperties> = {
  container: {
    background: 'linear-gradient(270deg, #15803d 0%, rgba(255, 255, 255, 0.9) 100%)',
    border: '1px solid #86efac',
    borderRadius: 10,
    padding: '14px 20px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    height: 80,
    width: 'auto',
    objectFit: 'contain',
    opacity: 0.85,
    mixBlendMode: 'multiply',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#064e3b',
    letterSpacing: '0.04em',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#065f46',
    fontWeight: 600,
  },
}

const sidebarStyles: Record<string, CSSProperties> = {
  aside: {
    background: '#0f172a',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    borderRight: '1px solid #1e293b',
    flexShrink: 0,
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  brandContainer: {
    padding: '20px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1e293b',
    minHeight: 70,
    boxSizing: 'border-box',
  },
  brandLogo: {
    width: 36,
    height: 36,
    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 13,
    color: 'white',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  userCard: {
    margin: '12px 10px',
    background: '#1e293b',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13,
    overflow: 'hidden',
    flexShrink: 0,
  },
  userAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userInfo: {
    overflow: 'hidden',
  },
  userName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: 10,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '0 8px',
    flexGrow: 1,
    overflowY: 'auto',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    width: '100%',
    boxSizing: 'border-box',
    position: 'relative',
  },
  navButtonActive: {
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  navIcon: {
    fontSize: 15,
    flexShrink: 0,
  },
  navLabel: {
    flexGrow: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeWarn: {
    color: 'white',
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    boxSizing: 'border-box',
  },
  footer: {
    borderTop: '1px solid #1e293b',
  },
  btnLogout: {
    width: '100%',
    padding: '8px 10px',
    background: '#1e293b',
    color: '#f87171',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
}

const formStyles: Record<string, CSSProperties> = {
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
  },
  previewBox: {
    height: 60,
    border: '1px dashed #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
}

const styles: Record<string, CSSProperties> = {
  layoutWrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
  },
  mainContent: {
    flex: 1,
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.55)), url("/bg-academic.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    paddingBottom: 40,
    overflowX: 'hidden',
  },
  loadingPage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    flexDirection: 'column',
    gap: 12,
    color: '#334155',
    background: '#f8fafc',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid rgba(37,99,235,0.15)',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  container: {
    maxWidth: 1060,
    margin: '0 auto',
    padding: '24px 20px',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    overflow: 'hidden',
    border: '2px solid rgba(255, 255, 255, 0.8)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    flexShrink: 0,
    background: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    color: 'white',
    fontSize: 20,
    fontWeight: 800,
  },
  topbarActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  academicTag: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#93c5fd',
    background: 'rgba(30, 58, 138, 0.6)',
    padding: '3px 8px',
    borderRadius: 4,
    marginBottom: 4,
    border: '1px solid rgba(147, 197, 253, 0.3)',
  },
  pageTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: '#ffffff',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  profileWarningBanner: {
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  btnWarningFix: {
    background: '#d97706',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnProfile: {
    padding: '8px 12px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  heroCard: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: 20,
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 22,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    marginBottom: 20,
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  userBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#1e40af',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 999,
    padding: '4px 10px',
  },
  heroTitle: {
    margin: 0,
    fontSize: 19,
    lineHeight: 1.3,
    color: '#0f172a',
    fontWeight: 800,
  },
  heroDesc: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: '#334155',
  },
  planSummaryCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #cbd5e1',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  planPill: {
    fontSize: 10.5,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 999,
  },
  planPrice: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
  },
  planMeta: {
    fontSize: 11.5,
    color: '#475569',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    borderRadius: 14,
    padding: 14,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.1,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#ffffff',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  projectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  projectCard: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
  },
  projectCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  projectTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  projectTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  projectId: {
    fontSize: 10.5,
    color: '#475569',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: 999,
    padding: '2px 6px',
  },
  projectMetaRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  metaChip: {
    fontSize: 11,
    color: '#334155',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 999,
    padding: '3px 8px',
  },
  actionGroup: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  projectDesc: {
    margin: '10px 0 0',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#334155',
  },
  projectStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    marginTop: 12,
  },
  projectStatBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '8px 10px',
  },
  projectStatLabel: {
    fontSize: 10.5,
    color: '#475569',
    marginBottom: 2,
  },
  projectStatValue: {
    fontSize: 15,
    fontWeight: 800,
    color: '#0f172a',
  },
  projectFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerMeta: {
    fontSize: 11,
    color: '#475569',
  },
  emptyState: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(6px)',
    border: '1px solid #cbd5e1',
    borderRadius: 16,
    padding: '36px 20px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 4px',
  },
  emptyDesc: {
    maxWidth: 400,
    margin: '0 auto',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#475569',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1.5px solid #fecaca',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#dc2626',
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 14,
  },
  btnPrimary: {
    padding: '10px 14px',
    background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
    color: 'white',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
    width: '100%',
  },
  btnPrimarySmall: {
    padding: '8px 14px',
    background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
    color: 'white',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
    boxShadow: '0 3px 8px rgba(37,99,235,0.2)',
  },
  btnSecondary: {
    padding: '8px 12px',
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
  },
  btnGhost: {
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#1e293b',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
  },
}

const modalStyles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 16,
  },
  modal: {
    background: 'white',
    borderRadius: 16,
    padding: '28px 32px',
    maxWidth: 560,
    width: '100%',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#94a3b8',
    padding: 0,
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  planCard: {
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px 12px',
    textAlign: 'center',
  },
  planCardActive: {
    border: '1.5px solid #2563eb',
    background: '#eff6ff',
  },
  planBadge: {
    marginTop: 8,
    fontSize: 10,
    background: '#1d4ed8',
    color: 'white',
    borderRadius: 999,
    padding: '2px 8px',
    display: 'inline-block',
  },
  infoBox: {
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12,
    color: '#92400e',
    marginBottom: 16,
  },
  btnClose: {
    width: '100%',
    padding: 11,
    background: '#f1f5f9',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 600,
    color: '#374151',
    fontSize: 14,
  },
}