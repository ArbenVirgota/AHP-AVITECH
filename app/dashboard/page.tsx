'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { clearSession, getSession } from '@/lib/auth'
import type { UserSession } from '@/lib/auth'
import { getSubscription, PLAN_CONFIG } from '@/lib/subscription'
import type { Subscription, PlanType } from '@/lib/subscription'

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

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

type RawProject = Record<string, unknown>

type SubscriptionLike = Subscription & {
  maxProjects?: number | string
  maxprojects?: number | string
  maxExperts?: number | string
  maxexperts?: number | string
}

function toFiniteLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const num = Number(value)
  if (!Number.isFinite(num)) return null
  if (num >= 999999) return Number.POSITIVE_INFINITY
  return num
}

function UpgradeModal({
  currentPlan,
  currentMaxProjects,
  currentMaxExperts,
  onClose,
}: {
  currentPlan: PlanType
  currentMaxProjects: number
  currentMaxExperts: number
  onClose: () => void
}) {
  const plans: PlanType[] = ['free', 'pro', 'premium']
  const S = modalStyles

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <h2 style={S.title}>Upgrade Paket</h2>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        <p style={S.desc}>Tingkatkan paket untuk mengelola lebih banyak proyek AHP</p>

        <div style={S.planGrid}>
          {plans.map((plan) => {
            const cfg = PLAN_CONFIG[plan]
            const isActive = plan === currentPlan

            const displayMaxProjects = isActive ? currentMaxProjects : cfg.maxProjects
            const displayMaxExperts = isActive ? currentMaxExperts : cfg.maxExperts

            return (
              <div
                key={plan}
                style={isActive ? { ...S.planCard, ...S.planCardActive } : S.planCard}
              >
                <div style={S.planName}>{cfg.label}</div>
                <div style={S.planPrice}>{cfg.price}</div>
                <div style={S.planDesc}>
                  {displayMaxProjects === Number.POSITIVE_INFINITY ? 'Unlimited' : displayMaxProjects} proyek
                </div>
                <div style={S.planDesc}>
                  {displayMaxExperts === Number.POSITIVE_INFINITY ? 'Unlimited' : displayMaxExperts} expert
                </div>
                {isActive && <div style={S.planBadge}>Paket Anda</div>}
              </div>
            )
          })}
        </div>

        <div style={S.infoBox}>
          Sistem pembayaran sedang dalam pengembangan. Hubungi admin untuk upgrade manual.
        </div>

        <button onClick={onClose} style={S.btnClose}>Tutup</button>
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
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function countSubcriteriaFromMap(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0

  return Object.values(value as Record<string, unknown>).reduce<number>(
    (sum, item) => {
      if (!Array.isArray(item)) return sum
      return sum + item.length
    },
    0
  )
}

function normalizeExpert(raw: RawExpert): Expert {
  return {
    id: String(raw?.id ?? raw?.expertid ?? raw?.expert_id ?? '').trim(),
    project_id: String(raw?.project_id ?? raw?.projectid ?? '').trim(),
    expert_index: Number(raw?.expert_index ?? raw?.expertindex ?? 0),
    name: String(raw?.expert_name ?? raw?.expertname ?? '').trim(),
    email: String(raw?.expert_email ?? raw?.expertemail ?? '').trim(),
    whatsapp: String(raw?.expert_whatsapp ?? raw?.expertwhatsapp ?? '').trim(),
    role: String(raw?.role ?? '').trim().toLowerCase(),
    status: String(raw?.status ?? '').trim().toLowerCase(),
    response_status: String(raw?.response_status ?? raw?.responsestatus ?? '').trim().toLowerCase(),
  }
}

function normalizeProject(raw: RawProject): Project {
  const criteriaList = splitCsv(raw?.kriteria ?? raw?.criteria ?? raw?.criteria_csv)
  const alternatifList = splitCsv(raw?.alternatif ?? raw?.alternatives ?? raw?.alternatif_csv)

  const subMap =
    raw?.subkriteria_map && typeof raw.subkriteria_map === 'object'
      ? raw.subkriteria_map
      : {}

  const subcriteriaCount =
    Number(raw?.subcriteria_count ?? 0) || countSubcriteriaFromMap(subMap)

  return {
    id: String(raw?.id ?? raw?.project_id ?? '').trim(),
    user_id: String(raw?.user_id ?? raw?.userid ?? '').trim(),
    user_email: String(raw?.user_email ?? raw?.email ?? '').trim(),
    nama_proyek: String(raw?.nama_proyek ?? raw?.namaproyek ?? '').trim(),
    deskripsi: String(raw?.deskripsi ?? '').trim(),
    metode: String(raw?.metode ?? '').trim(),
    jumlah_expert: Number(raw?.jumlah_expert ?? raw?.jumlahexpert ?? 0),
    jumlah_expert_responden: 0,
    punya_subkriteria: Boolean(raw?.punya_subkriteria),
    fasilitator_email: String(raw?.fasilitator_email ?? raw?.fasilitatoremail ?? '').trim(),
    fasilitator_whatsapp: String(raw?.fasilitator_whatsapp ?? raw?.fasilitatorwhatsapp ?? '').trim(),
    criteria_count: criteriaList.length,
    subcriteria_count: subcriteriaCount,
    alternatif_count: alternatifList.length,
    criteria_preview: criteriaList.slice(0, 4),
    alternatif_preview: alternatifList.slice(0, 4),
    created_at: String(raw?.created_at ?? '').trim(),
    updated_at: String(raw?.updated_at ?? raw?.created_at ?? '').trim(),
  }
}

export default function DashboardPage() {
  const router = useRouter()

  const [session, setSession] = useState<UserSession | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)

  const loadDashboard = useCallback(async (user: UserSession, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const [subRes, projRes] = await Promise.all([
        getSubscription(user.id),
        fetch(
          `${GOOGLE_SCRIPT_URL}?action=get_projects&user_email=${encodeURIComponent(user.email)}&user_id=${encodeURIComponent(user.id)}`,
          { method: 'GET', cache: 'no-store' }
        ),
      ])

      const projJson = await projRes.json()
      const baseProjects: Project[] = Array.isArray(projJson?.data)
        ? projJson.data.map(normalizeProject)
        : []

      const normalizedProjects = await Promise.all(
        baseProjects.map(async (project) => {
          try {
            const expertRes = await fetch(
              `${GOOGLE_SCRIPT_URL}?action=get_project_experts&project_id=${encodeURIComponent(project.id)}`,
              { method: 'GET', cache: 'no-store' }
            )
            const expertJson = await expertRes.json()

            const experts: Expert[] = Array.isArray(expertJson?.data)
              ? expertJson.data.map(normalizeExpert)
              : []

            const expertRespondenCount = experts.filter((expert) => {
              return expert.project_id === project.id && expert.role === 'expert'
            }).length

            return {
              ...project,
              jumlah_expert_responden: expertRespondenCount,
            }
          } catch (err) {
            console.error('Gagal memuat expert project:', project.id, err)
            return {
              ...project,
              jumlah_expert_responden: 0,
            }
          }
        })
      )

      setSubscription(subRes)
      setProjects(normalizedProjects)
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Gagal memuat dashboard. Silakan coba lagi.')
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

  const currentPlan: PlanType = subscription?.plan ?? 'free'
  const planConfig = PLAN_CONFIG[currentPlan]
  const subscriptionLike = subscription as SubscriptionLike

  const maxProjects =
    toFiniteLimit(subscriptionLike?.max_projects) ??
    toFiniteLimit(subscriptionLike?.maxProjects) ??
    toFiniteLimit(subscriptionLike?.maxprojects) ??
    planConfig.maxProjects

  const maxExperts =
    toFiniteLimit(subscriptionLike?.max_experts) ??
    toFiniteLimit(subscriptionLike?.maxExperts) ??
    toFiniteLimit(subscriptionLike?.maxexperts) ??
    planConfig.maxExperts

  const totalProjects = projects.length
  const projectUsageText =
    maxProjects === Number.POSITIVE_INFINITY ? `${totalProjects} / ∞` : `${totalProjects} / ${maxProjects}`

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
    if (!canCreateProject) {
      setShowUpgrade(true)
      return
    }
    router.push('/buat-proyek')
  }

  const S = styles

  if (loading) {
    return (
      <div style={S.loadingPage}>
        <div style={S.spinner} />
        <div style={{ fontSize: 14, color: '#64748b' }}>Memuat dashboard...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {showUpgrade && (
        <UpgradeModal
          currentPlan={currentPlan}
          currentMaxProjects={maxProjects}
          currentMaxExperts={maxExperts}
          onClose={() => setShowUpgrade(false)}
        />
      )}

      <div style={S.container}>
        <div style={S.topbar}>
          <div>
            <h1 style={S.pageTitle}>Dashboard AHP</h1>
            <p style={S.pageSubtitle}>
              Kelola seluruh proyek analisis multikriteria Anda
            </p>
          </div>

          <div style={S.topbarActions}>
            <button onClick={handleRefresh} style={S.btnGhost}>
              {refreshing ? 'Memuat...' : 'Refresh'}
            </button>
            <button onClick={handleLogout} style={S.btnDanger}>
              Logout
            </button>
          </div>
        </div>

        <div style={S.heroCard}>
          <div style={S.heroLeft}>
            <div style={S.userBadge}>Halo, {session?.nama || session?.email}</div>
            <h2 style={S.heroTitle}>Pantau proyek AHP dan kuota paket Anda dalam satu tempat</h2>
            <p style={S.heroDesc}>
              Dashboard ini menampilkan ringkasan proyek, struktur hirarki, dan batas penggunaan paket aktif Anda.
            </p>
          </div>

          <div style={S.heroRight}>
            <div
              style={{
                ...S.planPill,
                color: planConfig.color,
                background: planConfig.bg,
                border: `1px solid ${planConfig.border}`,
              }}
            >
              {planConfig.label}
            </div>
            <div style={S.planPrice}>{planConfig.price}</div>
            <div style={S.planMeta}>Kuota proyek: {projectUsageText}</div>
            <div style={S.planMeta}>
              Maks expert / proyek: {maxExperts === Number.POSITIVE_INFINITY ? '∞' : maxExperts}
            </div>
            <button onClick={handleCreateProject} style={S.btnPrimary}>
              {canCreateProject ? 'Buat Proyek Baru' : 'Upgrade untuk Tambah Proyek'}
            </button>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <div style={S.statsGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>Total Proyek</div>
            <div style={S.statValue}>{totalProjects}</div>
            <div style={S.statNote}>Terdaftar pada akun Anda</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Total Expert</div>
            <div style={S.statValue}>{totalExperts}</div>
            <div style={S.statNote}>Akumulasi seluruh proyek</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Total Kriteria</div>
            <div style={S.statValue}>{totalCriteria}</div>
            <div style={S.statNote}>Terhitung dari semua proyek</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Total Alternatif</div>
            <div style={S.statValue}>{totalAlternatif}</div>
            <div style={S.statNote}>Aktif pada metode alternatif</div>
          </div>
        </div>

        <div style={S.sectionHeader}>
          <div>
            <h3 style={S.sectionTitle}>Daftar Proyek</h3>
            <p style={S.sectionDesc}>
              Ringkasan proyek terbaru yang terhubung dengan akun Anda.
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>📂</div>
            <h3 style={S.emptyTitle}>Belum ada proyek</h3>
            <p style={S.emptyDesc}>
              Gunakan tombol <strong>Buat Proyek Baru</strong> pada panel ringkasan di atas untuk mulai menyusun kriteria, subkriteria, dan alternatif.
            </p>
          </div>
        ) : (
          <div style={S.projectList}>
            {projects.map((project) => (
              <div key={project.id} style={S.projectCard}>
                <div style={S.projectCardTop}>
                  <div>
                    <div style={S.projectTitleRow}>
                      <h4 style={S.projectTitle}>{project.nama_proyek}</h4>
                      <span style={S.projectId}>#{project.id}</span>
                    </div>

                    <div style={S.projectMetaRow}>
                      <span style={S.metaChip}>{methodLabel(project.metode)}</span>
                      <span style={S.metaChip}>
                        {project.punya_subkriteria ? 'Dengan Subkriteria' : 'Tanpa Subkriteria'}
                      </span>
                      <span style={S.metaChip}>{project.jumlah_expert_responden} expert</span>
                    </div>
                  </div>

                  <div style={S.actionGroup}>
                    <button
                      style={S.btnSecondary}
                      onClick={() => router.push(`/proyek/${project.id}`)}
                    >
                      Detail
                    </button>
                    <button
                      style={S.btnPrimarySmall}
                      onClick={() => router.push(`/proyek/${project.id}/matriks`)}
                    >
                      Matriks
                    </button>
                  </div>
                </div>

                <p style={S.projectDesc}>
                  {project.deskripsi?.trim() ? project.deskripsi : 'Tidak ada deskripsi proyek.'}
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
                  <div style={S.projectStatBox}>
                    <div style={S.projectStatLabel}>Diperbarui</div>
                    <div style={S.projectStatValueSmall}>{formatDate(project.updated_at)}</div>
                  </div>
                </div>

                <div style={S.previewGrid}>
                  <div style={S.previewBox}>
                    <div style={S.previewTitle}>Preview Kriteria</div>
                    <div style={S.previewList}>
                      {project.criteria_preview?.length ? (
                        project.criteria_preview.map((item, idx) => (
                          <span key={idx} style={S.previewChip}>{item}</span>
                        ))
                      ) : (
                        <span style={S.previewMuted}>Belum ada data</span>
                      )}
                    </div>
                  </div>

                  <div style={S.previewBox}>
                    <div style={S.previewTitle}>Preview Alternatif</div>
                    <div style={S.previewList}>
                      {project.alternatif_preview?.length ? (
                        project.alternatif_preview.map((item, idx) => (
                          <span key={idx} style={S.previewChipAlt}>{item}</span>
                        ))
                      ) : (
                        <span style={S.previewMuted}>Tidak digunakan / belum ada</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={S.projectFooter}>
                  <span style={S.footerMeta}>Fasilitator: {project.fasilitator_email || '-'}</span>
                  <span style={S.footerMeta}>Dibuat: {formatDate(project.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}