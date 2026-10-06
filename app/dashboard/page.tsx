// app/dashboard/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { clearSession, getSession } from '@/lib/auth'
import type { UserSession } from '@/lib/auth'
import { PLAN_CONFIG } from '@/lib/subscription'
import type { Subscription, PlanType } from '@/lib/subscription'
import SafeJoyride from '@/components/SafeJoyride'

interface Project {
  id: string
  user_id: string
  user_email: string
  nama_proyek: string
  nama_expert?: string
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

interface UserProfileData {
  nama: string
  institusi: string
  city: string
  digital_signature: string
  foto_profil?: string
  status_user?: string
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
  allow_subcriteria: boolean | number | string
  allow_alternative_method: boolean | number | string
  allow_ai_features: boolean | number | string
  max_criteria?: number
  max_subcriteria?: number
  max_alternatives?: number
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
    feature: 'Konsultasi per Pakar',
    desc: 'Batas kuota sesi tanya jawab/konsultasi ilmiah terstruktur per evaluator pakar.'
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
    desc: 'Kecerdasan buatan untuk membantu perumusan kriteria dan sintesis struktur riset otomatis.'
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

function isFeatureAllowed(val: unknown): boolean {
  if (val === true || val === 1 || val === '1') return true
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true
  return false
}

function isStudentSimulationProject(raw: RawProject): boolean {
  const expName = String(raw?.nama_expert ?? raw?.namaExpert ?? '').toLowerCase()
  const fasilitatorNama = String(raw?.fasilitator_nama ?? raw?.fasilitatorNama ?? '').toLowerCase()
  const projId = String(raw?.project_id ?? raw?.id ?? '').toUpperCase()
  
  return (
    expName.includes('simulasi') ||
    expName.includes('praktikum') ||
    expName.includes('linglungan') ||
    expName.includes('raos') ||
    fasilitatorNama.includes('simulasi') ||
    projId.includes('SIM') ||
    Boolean(raw?.is_student_project) ||
    Boolean(raw?.is_student)
  )
}

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
      <div style={{ ...S.modal, maxWidth: 920, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
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
                  const val = dynamicPlans[k]?.max_experts_manual ?? (k === 'free' ? 4 : k === 'pro' ? 8 : k === 'plus' ? 15 : 999999)
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
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Konsultasi per Pakar</td>
                {planKeys.map(k => {
                  const val = dynamicPlans[k]?.max_consultation_per_expert ?? (k === 'free' ? 0 : k === 'pro' ? 3 : k === 'plus' ? 5 : 15)
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{val === 0 ? '❌ Tidak Ada' : `${val} Sesi`}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Subkriteria Multi-Level</td>
                {planKeys.map(k => {
                  const allowed = isFeatureAllowed(dynamicPlans[k]?.allow_subcriteria ?? (k !== 'free'))
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{allowed ? '✔ Ya' : '❌ Tidak'}</td>
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Matriks Bobot Alternatif</td>
                {planKeys.map(k => {
                  const allowed = isFeatureAllowed(dynamicPlans[k]?.allow_alternative_method ?? (k !== 'free'))
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{allowed ? '✔ Bobot Alternatif' : '❌ Bobot Alternatif'}</td>
                })}
              </tr>
              <tr>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>Modul AI Analisis Riset</td>
                {planKeys.map(k => {
                  const allowed = isFeatureAllowed(dynamicPlans[k]?.allow_ai_features ?? (k === 'plus' || k === 'premium'))
                  return <td key={k} style={{ padding: '10px 14px', textAlign: 'center' }}>{allowed ? '🤖 Ya' : '❌ AI Analisis'}</td>
                })}
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
  isStudent,
  userEmail,
  userId,
  userProfile,
  initialDynamicPlans,
  onSuccessSwitch,
  onClose,
}: {
  currentPlan: PlanType
  isStudent?: boolean
  userEmail?: string
  userId?: string
  userProfile?: UserProfileData
  initialDynamicPlans?: Record<string, DynamicPlanSetting>
  onSuccessSwitch: () => void
  onClose: () => void
}) {
  const plans: PlanType[] = ['free', 'pro', 'plus', 'premium']
  const S = modalStyles

  const [dynamicPlans, setDynamicPlans] = useState<Record<string, DynamicPlanSetting>>(initialDynamicPlans || {})
  const [fetchingPlans, setFetchingPlans] = useState(!initialDynamicPlans || Object.keys(initialDynamicPlans).length === 0)
  const [showComparisonTable, setShowComparisonTable] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlanSettings() {
      try {
        const res = await fetch(`/api/dashboard/summary?_t=${Date.now()}`)
        const json = await res.json()
        if (json?.success && Array.isArray(json.data?.plans)) {
          const map: Record<string, DynamicPlanSetting> = {}
          json.data.plans.forEach((p: DynamicPlanSetting) => {
            if (p.plan_key) {
              map[String(p.plan_key).toLowerCase().trim()] = p
            }
          })
          setDynamicPlans(map)
        }
      } catch (err) {
        console.warn('Gagal memuat pengaturan plan dinamis:', err)
      } finally {
        setFetchingPlans(false)
      }
    }
    void loadPlanSettings()
  }, [])

  // 🟢 Pengajuan tiket koordinasi aktivasi lisensi ke tabel AHP - ConsultationRequests
  // Menggunakan rute folder: /api/subscriptions/request-upgrade
  const handleRequestUpgrade = async (selectedPlanKey: string, planLabel: string) => {
    const konfirmasi = window.confirm(
      `Hubungi Administrator untuk Aktivasi Paket ${planLabel}?\n\nTiket permohonan aktivasi lisensi akan otomatis dikirimkan ke meja operasional Admin. Lanjutkan?`
    )

    if (!konfirmasi) return

    try {
      setRequestingPlan(selectedPlanKey)
      const res = await fetch('/api/subscriptions/request-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlanKey,
          user_email: userEmail,
          user_name: userProfile?.nama || userEmail,
          institusi: userProfile?.institusi || '',
        }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Endpoint /api/subscriptions/request-upgrade belum ditemukan atau mengembalikan respons non-JSON.')
      }

      const json = await res.json()
      if (json.success) {
        alert(
          `✅ Permohonan Terkirim!\n\n${json.message}\n\nID Tiket: ${json.ticket_id}\nAnda dapat memantau balasannya melalui menu Pusat Konsultasi.`
        )
        onClose()
      } else {
        alert(`❌ Gagal: ${json.message}`)
      }
    } catch (err: any) {
      alert(`Terjadi kendala jaringan: ${err.message}`)
    } finally {
      setRequestingPlan(null)
    }
  }

  const handleSwitchToGeneral = async () => {
    const konfirmasi = window.confirm(
      'Beralih ke General Edition (Paket FREE)?\n\n' +
      '• Akun praktikum Anda akan beralih menjadi akun Peneliti / Fasilitator Mandiri.\n' +
      '• Proyek simulasi praktikum sebelumnya akan dibersihkan dari sistem agar ruang kerja bersih.\n' +
      '• Kuota proyek riset mandiri Anda akan dimulai dari 0 / 1.\n' +
      '• Mode 2 pakar simulasi otomatis dinonaktifkan.\n' +
      '• Batasan kuota proyek, pakar, dan hierarki akan mengikuti aturan aktif SuperAdmin.\n\n' +
      'Lanjutkan proses ini?'
    )

    if (!konfirmasi) return

    try {
      setSwitching(true)
      const res = await fetch('/api/user/switch-to-general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, user_id: userId }),
      })
      const json = await res.json()

      if (json.success) {
        // SINKRONKAN SELURUH PENYIMPANAN SESI LOKAL
        const sessionKeys = ['ahp_user_session', 'user_session']
        sessionKeys.forEach((key) => {
          const raw = localStorage.getItem(key)
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              parsed.status_user = 'general'
              parsed.plan = 'FREE'
              parsed.role = 'user'
              localStorage.setItem(key, JSON.stringify(parsed))
            } catch {}
          }
        })

        alert('✅ Akun Anda telah resmi beralih ke General Edition (FREE). Ruang kerja telah direset ke 0 / 1 proyek.')
        onSuccessSwitch()
        onClose()
        window.location.reload()
      } else {
        alert('❌ Gagal beralih akun: ' + (json.message || 'Terjadi kesalahan sistem.'))
      }
    } catch {
      alert('Gagal menghubungi server.')
    } finally {
      setSwitching(false)
    }
  }

  if (isStudent) {
    const freeCfg = dynamicPlans['free']
    const freePriceText = freeCfg ? formatRupiah(Number(freeCfg.price || 0)) : 'Gratis'
    const freeMaxProj = freeCfg?.max_projects !== undefined
      ? (freeCfg.max_projects >= 999999 ? 'Unlimited' : `${freeCfg.max_projects}`)
      : '1'
    const freeMaxExpManual = freeCfg?.max_experts_manual !== undefined
      ? (freeCfg.max_experts_manual >= 999999 ? 'Unlimited' : `${freeCfg.max_experts_manual}`)
      : '4'
    const freeMaxExpDir = Number(freeCfg?.max_experts_directory || 0)
    const freeMaxConsult = Number(freeCfg?.max_consultation_per_expert || 0)

    const allowSub = isFeatureAllowed(freeCfg?.allow_subcriteria)
    const allowAlt = isFeatureAllowed(freeCfg?.allow_alternative_method)
    const allowAi = isFeatureAllowed(freeCfg?.allow_ai_features)

    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={{ ...S.modal, maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
          <div style={S.header}>
            <div>
              <h2 style={S.title}>🎓 Beralih ke General Edition</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Tingkatkan akun praktikum Anda menjadi akun Peneliti / Fasilitator Mandiri.
              </p>
            </div>
            <button onClick={onClose} style={S.closeBtn} type="button">✕</button>
          </div>

          {fetchingPlans && Object.keys(dynamicPlans).length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
              ⏳ Memuat konfigurasi batasan paket dari SuperAdmin...
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 12,
              padding: '18px 20px',
              marginTop: 14,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: 999 }}>
                    PAKET RISET UMUM
                  </span>
                  <h3 style={{ margin: '6px 0 0', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                    {freeCfg?.label || 'General Edition (FREE)'}
                  </h3>
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#16a34a' }}>
                  {freePriceText}
                </div>
              </div>

              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, margin: '0 0 12px' }}>
                Akun keluar dari pembatasan simulasi otomatis praktikum. Proyek latihan sebelumnya akan dibersihkan agar kuota riset mandiri dimulai bersih dari 0.
              </p>

              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                Fasilitas &amp; Batasan Aktif (Kebijakan SuperAdmin):
              </div>

              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.4 }}>
                <li>
                  <strong>Maksimal Proyek:</strong> {freeMaxProj} proyek riset aktif.
                </li>
                <li>
                  <strong>Pakar / Responden:</strong> Hingga {freeMaxExpManual} pakar manual (diundang mandiri via tautan/email).
                </li>
                <li>
                  <strong>Direktori Pakar Platform:</strong> {freeMaxExpDir > 0 ? `Hingga ${freeMaxExpDir} pakar direktori` : 'Terkunci (0 Pakar)'}.
                </li>
                <li>
                  <strong>Konsultasi Pakar:</strong> {freeMaxConsult > 0 ? `Maksimal ${freeMaxConsult} sesi / pakar` : 'Tidak tersedia (0 Sesi)'}.
                </li>
                <li>
                  <strong>Struktur Subkriteria:</strong> {allowSub ? '✔️️ Diizinkan (Hirarki bertingkat)' : '❌ Dinonaktifkan (Hanya kriteria utama)'}.
                </li>
                <li>
                  <strong>Metode Bobot Alternatif:</strong> {allowAlt ? '✔️️ Diizinkan (Kombinasi perankingan alternatif)' : '❌ Dinonaktifkan (Bobot Saja)'}.
                </li>
                <li>
                  <strong>Bantuan AI Analisis:</strong> {allowAi ? '🤖 Diizinkan (Saat pembuatan proyek & laporan)' : '❌ Dinonaktifkan oleh SuperAdmin'}.
                </li>
              </ul>

              <button
                type="button"
                onClick={handleSwitchToGeneral}
                disabled={switching}
                style={{
                  width: '100%',
                  marginTop: 18,
                  padding: '11px 0',
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: switching ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                }}
              >
                {switching ? 'Memproses Peralihan...' : '⚡ Beralih ke General Edition Sekarang'}
              </button>
            </div>
          )}

          <div style={{ ...S.infoBox, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', fontSize: 11.5, margin: 0 }}>
            💡 <strong>Ketentuan Sistem:</strong> Seluruh batasan fasilitas di atas disinkronkan otomatis dari konfigurasi SuperAdmin. Pilihan paket komersial (Pro/Plus/Premium) dapat diakses setelah akun beralih ke General Edition.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      {showComparisonTable && (
        <FeatureComparisonModal dynamicPlans={dynamicPlans} onClose={() => setShowComparisonTable(false)} />
      )}

      <div style={{ ...S.modal, maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>🚀 Pilihan Paket Komersial</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
              Pilih paket Semester Pass (6 Bulan) sesuai skala kebutuhan riset atau instansi Anda.
            </p>
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

        {fetchingPlans && Object.keys(dynamicPlans).length === 0 ? (
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
                } else {
                  featuresList.push('❌ Expert Direktori')
                }

                const consultCount = Number(dynamicCfg.max_consultation_per_expert || 0)
                if (consultCount > 0) {
                  featuresList.push(`Maks. ${consultCount} Konsultasi / Pakar`)
                }

                featuresList.push(
                  isFeatureAllowed(dynamicCfg.allow_subcriteria)
                    ? '✔ Subkriteria' 
                    : '❌ Subkriteria'
                )
                featuresList.push(
                  isFeatureAllowed(dynamicCfg.allow_alternative_method)
                    ? '✔ Bobot Alternatif' 
                    : '❌ Bobot Alternatif'
                )
                featuresList.push(
                  isFeatureAllowed(dynamicCfg.allow_ai_features)
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

                  <div style={{ marginTop: 14 }}>
                    {isActive ? (
                      <div style={{ ...S.planBadge, padding: '6px 10px', fontSize: 11.5, width: '100%', textAlign: 'center', boxSizing: 'border-box', margin: 0 }}>✔ Paket Saat Ini</div>
                    ) : (
                      <button 
                        onClick={() => handleRequestUpgrade(plan, label)}
                        disabled={plan === 'free' || requestingPlan === plan}
                        style={{
                          width: '100%',
                          padding: '9px 0',
                          background: plan === 'free' ? '#f1f5f9' : '#2563eb',
                          color: plan === 'free' ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: plan === 'free' || requestingPlan === plan ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {requestingPlan === plan ? 'Mengirim Tiket...' : (plan === 'free' ? 'Paket Aktif' : `Pilih ${plan.toUpperCase()}`)}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ ...S.infoBox, background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
          💡 <strong>Informasi Sistem:</strong> Pengaktifan paket komersial dilayani melalui koordinasi Administrator platform.
        </div>
      </div>
    </div>
  )
}

function ProfileModal({
  user,
  profile,
  isStudent,
  onClose,
  onSaveSuccess,
}: {
  user: UserSession
  profile: UserProfileData
  isStudent?: boolean
  onClose: () => void
  onSaveSuccess: (updated: UserProfileData) => void
}) {
  const [formData, setFormData] = useState<UserProfileData>({
    nama: profile.nama || user.nama || '',
    institusi: profile.institusi || (isStudent ? 'Universitas / Akademik' : ''),
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
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          user_id: user.id,
          nama: formData.nama,
          institusi: formData.institusi || (isStudent ? 'Universitas / Akademik' : ''),
          city: formData.city,
          digital_signature: formData.digital_signature || '',
          foto_profil: formData.foto_profil || '',
        }),
      })

      const result = await response.json()

      if (result.success) {
        onSaveSuccess({ 
          ...formData, 
          digital_signature: formData.digital_signature || '',
          foto_profil: formData.foto_profil || '' 
        })
        alert('✅ Profil berhasil diperbarui')
        onClose()
      } else {
        alert('❌ Gagal: ' + result.message)
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
          <h2 style={S.title}>⚙ Pengaturan Profil &amp; Pengesahan</h2>
          <button onClick={onClose} style={S.closeBtn} type="button">✕</button>
        </div>

        <p style={{ ...S.desc, flexShrink: 0, marginBottom: 12 }}>
          {isStudent
            ? 'Untuk akun Student Edition, cukup lengkapi nama dan kota domisili Anda.'
            : 'Lengkapi identitas Anda, unggah foto profil, dan unggah file tanda tangan digital Anda.'}
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
            <label style={formStyles.label}>Nama Lengkap *</label>
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Andi Pratama"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Kota Domisili *</label>
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
            <label style={formStyles.label}>
              Nama Institusi / Universitas {isStudent ? '(Opsional)' : '*'}
            </label>
            <input
              type="text"
              required={!isStudent}
              value={formData.institusi}
              onChange={(e) => setFormData({ ...formData, institusi: e.target.value })}
              placeholder="Contoh: Universitas Mataram"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Foto Profil (Opsional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={{ ...formStyles.previewBox, height: 50, marginTop: 4 }}>
              {previewFoto ? (
                <img 
                  src={previewFoto} 
                  alt="Pratinjau Foto Profil" 
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada foto yang dipilih</span>
              )}
            </div>
          </div>

          <div>
            <label style={formStyles.label}>
              Tanda Tangan Digital {isStudent ? '(Opsional untuk Student Edition)' : '(.png Transparan) *'}
            </label>
            <input
              type="file"
              accept="image/*"
              required={!isStudent && !previewSig}
              onChange={handleSigFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={formStyles.previewBox}>
              {previewSig ? (
                <img 
                  src={previewSig} 
                  alt="Pratinjau Tanda Tangan" 
                  style={{ maxHeight: 45, objectFit: 'contain' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada tanda tangan yang dipilih</span>
              )}
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <button onClick={onClose} style={S.btnClose} type="button">Batal</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{ ...S.btnClose, background: '#2563eb', color: 'white', fontWeight: 700 }}
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

function normalizeProject(raw: RawProject): Project {
  const criteriaList = splitCsv(raw?.criteria ?? raw?.kriteria ?? '')
  const alternatifList = splitCsv(raw?.alternatif ?? raw?.alternatives ?? '')

  let calculatedCritCount = criteriaList.length
  let calculatedAltCount = alternatifList.length
  const expertCount = Number(raw?.jumlahExpert ?? raw?.jumlah_expert ?? 0)

  return {
    id: String(raw?.project_id ?? raw?.id ?? '').trim(),
    user_id: String(raw?.userId ?? raw?.user_id ?? '').trim(),
    user_email: String(raw?.user_email ?? '').trim(),
    nama_proyek: String(raw?.namaProyek ?? raw?.nama_proyek ?? '').trim(),
    nama_expert: String(raw?.nama_expert ?? raw?.namaExpert ?? '').trim(),
    deskripsi: String(raw?.deskripsi ?? '').trim(),
    metode: String(raw?.metode ?? '').trim(),
    jumlah_expert: expertCount,
    jumlah_expert_responden: expertCount, 
    punya_subkriteria: Boolean(raw?.punyaSubkriteria ?? raw?.punya_subkriteria),
    fasilitator_email: String(raw?.fasilitatorEmail ?? raw?.fasilitator_email ?? '').trim(),
    fasilitator_whatsapp: String(raw?.fasilitatorWhatsapp ?? raw?.fasilitator_whatsapp ?? '').trim(),
    criteria_count: calculatedCritCount,
    subcriteria_count: Number(raw?.subcriteria_count ?? 0),
    alternatif_count: calculatedAltCount,
    criteria_preview: criteriaList.slice(0, 4),
    alternatif_preview: alternatifList.slice(0, 4),
    created_at: String(raw?.createdAt ?? raw?.created_at ?? '').trim(),
    updated_at: String(raw?.updatedAt ?? raw?.updated_at ?? '').trim(),
  }
}

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

export default function DashboardPage() {
  const router = useRouter()

  const [session, setSession] = useState<UserSession | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [dynamicPlans, setDynamicPlans] = useState<Record<string, DynamicPlanSetting>>({})

  const [projects, setProjects] = useState<Project[]>([])
  const [visitorStats, setVisitorStats] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)

  const [userProfile, setUserProfile] = useState<UserProfileData>({
    nama: '',
    institusi: '',
    city: '',
    digital_signature: '',
    foto_profil: '',
    status_user: '',
  })
  const [showProfileModal, setShowProfileModal] = useState(false)

  const isStudent = useMemo(() => {
    const sRole = (session as any)?.status_user || userProfile.status_user || ''
    return String(sRole).toLowerCase().trim() === 'student'
  }, [session, userProfile.status_user])

  // Penanganan query action dan event pemanggil modal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('action') === 'profile') {
        setShowProfileModal(true)
      }
      if (params.get('action') === 'upgrade') {
        setShowUpgrade(true)
      }

      const handleOpenUpgradeEvent = () => {
        setShowUpgrade(true)
      }
      window.addEventListener('open-upgrade-modal', handleOpenUpgradeEvent)

      return () => {
        window.removeEventListener('open-upgrade-modal', handleOpenUpgradeEvent)
      }
    }
  }, [])

  const isProfileComplete = useMemo(() => {
    if (isStudent) {
      return Boolean(
        (userProfile.nama?.trim() || session?.nama?.trim()) &&
        userProfile.city?.trim()
      )
    }
    return Boolean(
      userProfile.nama?.trim() &&
      userProfile.institusi?.trim() &&
      userProfile.city?.trim() &&
      userProfile.digital_signature?.trim()
    )
  }, [isStudent, userProfile, session])

  const loadDashboard = useCallback(async (user: UserSession, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const cleanUserEmail = String(user.email || '').trim().toLowerCase()
      const cleanUserId = String((user as any)?.user_id || user.id || '').trim()

      const res = await fetch(`/api/dashboard/summary?email=${encodeURIComponent(cleanUserEmail)}&user_id=${encodeURIComponent(cleanUserId)}&_t=${Date.now()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memuat data dashboard')
      }

      const { user: userData, subscription: subData, projects: projData, plans: planData, visitorStats: visits, isStudent: apiIsStudent } = json.data

      const effectiveStatusUser = userData?.status_user || (apiIsStudent ? 'student' : 'general')

      if (userData) {
        setUserProfile({
          nama: userData.nama || user.nama || '',
          institusi: userData.institusi || '',
          city: userData.city || '',
          digital_signature: userData.digital_signature || '',
          foto_profil: userData.foto_profil || '',
          status_user: effectiveStatusUser,
        })

        // SINKRONISASI KEMBALI KE PENYIMPANAN SESI LOKAL
        const sessionKeys = ['ahp_user_session', 'user_session']
        sessionKeys.forEach((key) => {
          const raw = localStorage.getItem(key)
          if (raw) {
            try {
              const parsed = JSON.parse(raw)
              parsed.status_user = effectiveStatusUser
              parsed.plan = subData?.plan || parsed.plan || (effectiveStatusUser === 'student' ? 'student' : 'free')
              localStorage.setItem(key, JSON.stringify(parsed))
            } catch {}
          }
        })
      }

      setSubscription(subData || {
        plan: effectiveStatusUser === 'student' ? 'student' : 'free',
        status: 'active',
        user_email: cleanUserEmail,
        user_id: user.id
      })

      if (Array.isArray(planData)) {
        const map: Record<string, DynamicPlanSetting> = {}
        planData.forEach((p: DynamicPlanSetting) => {
          if (p.plan_key) {
            map[String(p.plan_key).toLowerCase().trim()] = p
          }
        })
        setDynamicPlans(map)
      }

      setVisitorStats(visits || 0)

      if (Array.isArray(projData)) {
        const isCurrentlyGeneral = !apiIsStudent && String(effectiveStatusUser).toLowerCase() !== 'student'

        if (isCurrentlyGeneral) {
          const hasSimulationProject = projData.some(isStudentSimulationProject)
          if (hasSimulationProject) {
            fetch('/api/user/switch-to-general', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: cleanUserEmail, user_id: user.id }),
            }).catch(() => {})
          }
        }

        const filteredProjects = isCurrentlyGeneral
          ? projData.filter((p: any) => !isStudentSimulationProject(p))
          : projData

        setProjects(filteredProjects.map(normalizeProject))
      } else {
        setProjects([])
      }

    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Gagal memuat data dashboard dari database.')
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

  const currentPlan: PlanType = subscription?.plan ? (String(subscription.plan).toLowerCase().trim() as PlanType) : 'free'
  const planConfig = PLAN_CONFIG[currentPlan] || PLAN_CONFIG['free']
  const subscriptionLike = subscription as SubscriptionLike | null
  const globalDynamicPlan = dynamicPlans[currentPlan]

  const maxProjects = useMemo(() => {
    if (isStudent) return 2

    const dynamicLimit = globalDynamicPlan ? toFiniteLimit(globalDynamicPlan.max_projects) : null
    if (currentPlan === 'free') {
      return dynamicLimit !== null ? dynamicLimit : 1
    }

    if (subscriptionLike && (subscriptionLike.max_projects !== undefined && subscriptionLike.max_projects !== null)) {
      const explicitLimit = toFiniteLimit(subscriptionLike.max_projects)
      if (explicitLimit !== null) return explicitLimit
    }
    return (
      dynamicLimit ??
      planConfig.maxProjects
    )
  }, [isStudent, currentPlan, subscriptionLike, globalDynamicPlan, planConfig])

  const totalProjects = projects.length

  const projectUsageText = isStudent
    ? `${totalProjects} / 2`
    : maxProjects === Number.POSITIVE_INFINITY
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

  const canCreateProject = isStudent
    ? totalProjects < 2
    : maxProjects === Number.POSITIVE_INFINITY || totalProjects < maxProjects

  const handleRefresh = () => {
    if (!session) return
    void loadDashboard(session, true)
  }

  const handleStartDashboardTour = () => {
    window.dispatchEvent(new Event('start-tour-ahp_tour_dashboard'))
  }

  const handleCreateProject = () => {
    if (!isProfileComplete) {
      alert(
        isStudent
          ? '⚠ Mohon lengkapi Kota Domisili Anda terlebih dahulu sebelum membuat proyek Student Edition.'
          : '⚠ Mohon lengkapi Profil (Institusi, Kota, & Tanda Tangan Digital) terlebih dahulu sebelum membuat proyek baru.'
      )
      setShowProfileModal(true)
      return
    }

    if (!canCreateProject) {
      if (isStudent) {
        alert('Batas kuota akun Student Edition telah tercapai (maksimal 2 proyek). Anda dapat menghapus salah satu proyek lama atau melakukan upgrade ke General Edition.')
        setShowUpgrade(true)
      } else {
        alert(`Batas kuota akun Anda telah tercapai (${maxProjects} proyek). Silakan tingkatkan paket untuk menambah ruang kerja.`)
        setShowUpgrade(true)
      }
      return
    }
    router.push('/buat-proyek/baru')
  }

  const dashboardSteps = useMemo(() => [
    {
      target: 'body', 
      content: isStudent
        ? 'Selamat datang di Ruang Kerja AHP Student Edition! Ikuti tur singkat untuk mengenal fitur-fitur praktikum ini.'
        : 'Selamat datang di Platform AHP Avitech! Mari ikuti tur singkat untuk mengenal fitur-fitur utama sistem ini.',
      title: isStudent ? '🎓 AHP Student Edition' : '👋 Selamat Datang!',
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '.tour-step-profile',
      content: isStudent
        ? 'Lengkapi asal kota domisili Anda untuk memulai pembuatan proyek Student Edition.'
        : 'Sebelum memulai riset, pastikan Anda melengkapi profil dan mengunggah tanda tangan digital agar e-sertifikat riset Anda sah secara administratif.',
      title: '⚙ Lengkapi Profil Anda',
    },
    {
      target: '.tour-step-project',
      content: 'Di sinilah ruang kerja Anda berada. Buka menu ini untuk melihat daftar proyek riset AHP Anda atau membuat proyek baru.',
      title: '📁 Proyek AHP Saya',
    },
    {
      target: '.tour-step-create-project',
      content: 'Klik tombol ini untuk mulai membuat proyek latihan dan menyusun model matriks keputusan berpasangan!',
      title: '🚀 Mulai Analisis Sekarang',
    }
  ], [isStudent])

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
      <SafeJoyride steps={dashboardSteps} storageKey="ahp_tour_dashboard" />

      <main style={S.mainContent}>
        {showUpgrade && (
          <UpgradeModal
            currentPlan={currentPlan}
            isStudent={isStudent}
            userEmail={session?.email}
            userId={(session as any)?.user_id || session?.id}
            userProfile={userProfile}
            initialDynamicPlans={dynamicPlans}
            onSuccessSwitch={() => {
              if (session) void loadDashboard(session, true)
            }}
            onClose={() => setShowUpgrade(false)}
          />
        )}

        {showProfileModal && session && (
          <ProfileModal
            user={session}
            profile={userProfile}
            isStudent={isStudent}
            onClose={() => setShowProfileModal(false)}
            onSaveSuccess={(updated) => setUserProfile(updated)}
          />
        )}

        <div style={S.container}>
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
                <span style={isStudent ? { ...S.academicTag, background: 'rgba(161, 98, 7, 0.7)', color: '#fef08a', borderColor: 'rgba(254, 240, 138, 0.4)' } : S.academicTag}>
                  {isStudent ? '🎓 AHP Student Edition' : 'AHP Decision Support System'}
                </span>
                <h1 style={S.pageTitle}>Dashboard Analisis</h1>
              </div>
            </div>

            <div style={S.topbarActions}>
              <button
                onClick={() => router.push('/user/projects')}
                className="tour-step-project"
                style={S.btnPrimarySmall}
                type="button"
              >
                📁 Proyek Saya
              </button>
              
              {!isStudent && (
                <button
                  onClick={() => router.push('/expert-directory')}
                  className="tour-step-expert"
                  style={S.btnSecondary}
                  type="button"
                >
                  👥 Direktori Pakar
                </button>
              )}

              <button
                onClick={() => setShowProfileModal(true)}
                className="tour-step-profile"
                style={S.btnProfile}
                type="button"
              >
                ⚙ Profil {!isProfileComplete && <span style={S.badgeWarn}>!</span>}
              </button>
              
              <button
                onClick={handleStartDashboardTour}
                style={S.btnSecondary}
                type="button"
                title="Buka panduan interaktif dashboard"
              >
                💡 Panduan Interaktif
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
                    {isStudent
                      ? 'Harap lengkapi kota domisili Anda untuk mengaktifkan pembuatan proyek Student Edition.'
                      : 'Harap lengkapi nama institusi, kota, dan tanda tangan digital untuk pengesahan sertifikat.'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={S.userBadge}>Halo, {userProfile.nama || session?.nama || session?.email}</div>
                {isStudent && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '4px 10px',
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    🎓 Student Edition
                  </span>
                )}
              </div>

              <h2 style={S.heroTitle}>
                {isStudent
                  ? 'Ruang Kerja AHP Student Edition'
                  : 'Siap Melakukan Sintesis Keputusan Hari Ini'}
              </h2>
              <p style={S.heroDesc}>
                {isStudent
                  ? 'Edisi praktikum & pembelajaran AHP: susun hierarki kriteria, evaluasi perbandingan berpasangan dengan 2 pakar simulasi standar, dan lakukan sintesis bobot prioritas.'
                  : 'Kelola hirarki kriteria, distribusikan kuesioner token pakar, dan evaluasi hasil agregat geometric mean dalam satu platform terintegrasi.'}
              </p>
            </div>

            <div style={S.heroRight}>
              <div style={S.planSummaryCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      ...S.planPill,
                      color: isStudent ? '#92400e' : planConfig.color,
                      background: isStudent ? '#fef3c7' : planConfig.bg,
                      border: `1px solid ${isStudent ? '#fde68a' : planConfig.border}`,
                    }}
                  >
                    {isStudent ? 'Student Edition' : planConfig.label}
                  </span>
                  <span style={S.planPrice}>{isStudent ? 'Gratis / Academic' : planConfig.price}</span>
                </div>
                <div style={S.planMeta}>Proyek: <strong>{projectUsageText}</strong></div>
                <button onClick={handleCreateProject} className="tour-step-create-project" style={S.btnPrimary} type="button">
                  {canCreateProject ? '+ Buat Proyek' : (isStudent ? 'Batas Kuota (2 Proyek)' : 'Upgrade Paket')}
                </button>
                
                <button 
                  onClick={() => setShowUpgrade(true)} 
                  style={{ 
                    ...S.btnSecondary, 
                    marginTop: 4, 
                    width: '100%', 
                    textAlign: 'center',
                    background: isStudent ? '#fef3c7' : '#eff6ff',
                    borderColor: isStudent ? '#fde68a' : '#bfdbfe',
                    color: isStudent ? '#92400e' : '#1d4ed8',
                    fontWeight: 800
                  }} 
                  type="button"
                >
                  {isStudent ? '🚀 Upgrade ke General / Peneliti' : '🚀 Menu Upgrade Paket'}
                </button>
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
              <div style={S.statValue}>
                {isStudent && totalProjects === 0 ? '2 (Simulasi)' : totalExperts}
              </div>
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
                Klik <strong>Buat Proyek</strong> untuk mulai menyusun model analisis hierarki AHP.
              </p>
            </div>
          ) : (
            <div style={S.projectList}>
              {projects.slice(0, 2).map((project) => {
                return (
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
                        Dibuat: {formatDate(project.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
  badgeWarn: {
    background: '#ef4444',
    color: 'white',
    borderRadius: '50%',
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 800,
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
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
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
    color: '#1e3a8a',
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