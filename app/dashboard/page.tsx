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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    paddingBottom: 40,
  },
  loadingPage: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    flexDirection: 'column',
    gap: 12,
    color: '#64748b',
    background: '#f8fafc',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid rgba(37,99,235,0.15)',
    borderTop: '3px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  container: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '24px 16px',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  topbarActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#64748b',
  },
  heroCard: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: 20,
    background: 'linear-gradient(135deg,#ffffff 0%,#eff6ff 100%)',
    border: '1px solid #dbeafe',
    borderRadius: 18,
    padding: 24,
    boxShadow: '0 12px 30px rgba(37,99,235,0.08)',
    marginBottom: 20,
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  heroRight: {
    background: 'rgba(255,255,255,0.8)',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    justifyContent: 'center',
  },
  userBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 'fit-content',
    fontSize: 12,
    fontWeight: 700,
    color: '#1d4ed8',
    background: '#dbeafe',
    borderRadius: 999,
    padding: '6px 10px',
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.25,
    color: '#0f172a',
    fontWeight: 800,
  },
  heroDesc: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    color: '#475569',
    maxWidth: 680,
  },
  planPill: {
    width: 'fit-content',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: 999,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  planMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.1,
  },
  statNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#94a3b8',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  sectionDesc: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },
  projectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  projectCard: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  projectCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  projectTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  projectTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  projectId: {
    fontSize: 11,
    color: '#94a3b8',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 999,
    padding: '4px 8px',
  },
  projectMetaRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  metaChip: {
    fontSize: 12,
    color: '#334155',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: 999,
    padding: '6px 10px',
  },
  actionGroup: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  projectDesc: {
    margin: '14px 0 0',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#475569',
  },
  projectStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    marginTop: 16,
  },
  projectStatBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '12px 14px',
  },
  projectStatLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  projectStatValue: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
  },
  projectStatValueSmall: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginTop: 16,
  },
  previewBox: {
    background: '#fcfdff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 10,
  },
  previewList: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewChip: {
    fontSize: 12,
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: 999,
    padding: '5px 10px',
    border: '1px solid #bfdbfe',
  },
  previewChipAlt: {
    fontSize: 12,
    background: '#f0fdf4',
    color: '#166534',
    borderRadius: 999,
    padding: '5px 10px',
    border: '1px solid #bbf7d0',
  },
  previewMuted: {
    fontSize: 12,
    color: '#94a3b8',
  },
  projectFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  footerMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: 18,
    padding: '48px 24px',
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  emptyDesc: {
    maxWidth: 560,
    margin: '0 auto',
    fontSize: 14,
    lineHeight: 1.7,
    color: '#64748b',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1.5px solid #fecaca',
    borderRadius: 12,
    padding: '12px 16px',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
  },
  btnPrimary: {
    padding: '12px 18px',
    background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 6px 16px rgba(37,99,235,0.28)',
  },
  btnPrimarySmall: {
    padding: '10px 14px',
    background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
  },
  btnSecondary: {
    padding: '10px 14px',
    background: 'white',
    color: '#1d4ed8',
    border: '1.5px solid #bfdbfe',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
  },
  btnGhost: {
    padding: '10px 14px',
    background: 'white',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
  },
  btnDanger: {
    padding: '10px 14px',
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
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
  planGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
    gap: 12,
    marginBottom: 16,
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
  planName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2563eb',
    marginBottom: 6,
  },
  planDesc: {
    fontSize: 12,
    color: '#64748b',
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