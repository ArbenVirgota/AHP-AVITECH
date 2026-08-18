// app/buat-proyek/page.tsx
'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSession, clearSession } from '@/lib/auth'
import type { UserSession } from '@/lib/auth'
import { countUserProjects, PLAN_CONFIG } from '@/lib/subscription'
import type { Subscription, PlanType } from '@/lib/subscription'

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

interface Project {
  id: string
  namaproyek?: string
  nama_proyek?: string
  [key: string]: any
}

interface UserProfileData {
  nama: string
  institusi: string
  city: string
  digital_signature: string
  foto_profil?: string
}

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

function cleanPlanType(raw: string): 'free' | 'pro' | 'plus' | 'premium' {
  const str = String(raw || '').toUpperCase().trim();
  if (str.includes('PREMIUM')) return 'premium';
  if (str.includes('PLUS')) return 'plus';
  if (str.includes('PRO')) return 'pro';
  return 'free';
}

function extractRowData(res: any, targetEmail: string): any {
  if (!res) return null;
  let dataTarget = res.data || res.result || res.payload;
  if (!dataTarget) dataTarget = res;
  if (Array.isArray(dataTarget)) {
    const found = dataTarget.find((item: any) => {
      const em = String(item.user_email || item.email || item.useremail || item.username || '').trim().toLowerCase();
      return em === targetEmail;
    });
    return found || dataTarget[0] || null;
  }
  if (dataTarget !== null && typeof dataTarget === 'object') {
    return dataTarget;
  }
  return null;
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
  onSelectSection
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
  onSelectSection: (sec: 'dashboard' | 'consultation') => void
}) {
  const router = useRouter()
  const pathname = usePathname()

  const planLabelFormatted = `Plan: ${userPlan.toUpperCase()}`
  const planBadgeColor = 
    userPlan === 'premium' ? '#9333ea' : 
    userPlan === 'plus' ? '#2563eb' : 
    userPlan === 'pro' ? '#16a34a' : '#64748b';

  const navItems = [
    {
      label: planLabelFormatted,
      icon: '⭐',
      badgeColor: planBadgeColor,
      onClick: onOpenUpgrade
    },
    {
      label: 'Dashboard Analisis',
      icon: '📊',
      active: pathname === '/dashboard',
      onClick: () => {
        router.push('/dashboard')
        onSelectSection('dashboard')
      }
    },
    {
      label: 'Tiket Konsultasi',
      icon: '💬',
      badge: consultationCount > 0 ? String(consultationCount) : undefined,
      badgeColor: '#10b981',
      onClick: () => onSelectSection('consultation')
    },
    {
      label: 'Direktori Pakar',
      icon: '👥',
      active: pathname === '/expert-directory',
      onClick: () => router.push('/expert-directory')
    },
    {
      label: 'Profil & Pengesahan',
      icon: '⚙️',
      badge: !isProfileComplete ? '!' : undefined,
      badgeColor: '#ef4444',
      onClick: onOpenProfile
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

        {!isCollapsed && projects.length > 0 && (
          <div style={{ marginTop: 12, paddingBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 14px 6px' }}>
              📁 Proyek Anda ({projects.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/proyek/kelola?id=${encodeURIComponent(p.id)}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'transparent',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 11.5,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={p.namaproyek || p.nama_proyek}
                >
                  <span style={{ fontSize: 10 }}>🔹</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.namaproyek || p.nama_proyek}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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

function BuatProyekContent() {
  const router = useRouter();

  const [session, setSession] = useState<UserSession | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfileData>({ nama: '', institusi: '', city: '', digital_signature: '', foto_profil: '' })
  const [userPlan, setUserPlan] = useState<string>('free')
  
  // State hak akses
  const [hasSubcriteriaAccess, setHasSubcriteriaAccess] = useState(false)
  const [hasAlternativesAccess, setHasAlternativesAccess] = useState(false)
  const [hasAiAccess, setHasAiAccess] = useState(false)
  const [resolvedMaxProjects, setResolvedMaxProjects] = useState<number>(3)
  const [resolvedMaxExpertsDirectory, setResolvedMaxExpertsDirectory] = useState<number>(0)

  const [allUserProjects, setAllUserProjects] = useState<Project[]>([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const [subscription, setSubscription] = useState<Subscription | null>(null)
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

  // 🟢 PENGATURAN SINGLE SOURCE OF TRUTH (PRIORITAS SUBSCRIPTIONS -> FALLBACK USERS) DENGAN OVERRIDE MUTLAK
  const loadInitialData = useCallback(async () => {
    const s = getSession()
    if (!s || !s.email) {
      router.replace('/login')
      return
    }

    setSession(s)
    const sessionObj = s as Record<string, any>;
    const cleanEmail = String(s.email || '').trim().toLowerCase()
    const cleanId = String(sessionObj.user_id || sessionObj.userId || sessionObj.id || '').trim()

    setFasilitatorEmail(cleanEmail)
    setUserProfile({ 
      nama: String(s.nama || s.email || 'Pengguna'), 
      institusi: '', 
      city: '', 
      digital_signature: '', 
      foto_profil: String(s.foto_profil || s.fotoprofil || '') 
    })

    try {
      setInitLoading(true)

      const [subRes, userRes, planRes, count, dirRes, projRes] = await Promise.all([
        fetch(`${GOOGLE_SCRIPT_URL}?action=getusersubscription&user_id=${encodeURIComponent(cleanId)}&email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getuserprofile&email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanId)}&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getplansettings&_t=${Date.now()}`, { method: 'GET', cache: 'no-store' }).catch(() => null),
        countUserProjects(cleanEmail),
        fetch(`${GOOGLE_SCRIPT_URL}?action=get_expert_directory&_t=${Date.now()}`).catch(() => null),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getprojects&email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanId)}&_t=${Date.now()}`).catch(() => null)
      ])

      setProjectCount(count)

      let dynMap: Record<string, DynamicPlanSetting> = {}
      if (planRes) {
        const pJson = await planRes.json().catch(() => ({}))
        if (pJson && pJson.success && Array.isArray(pJson.data)) {
          pJson.data.forEach((p: DynamicPlanSetting) => {
            if (p.plan_key) {
              dynMap[String(p.plan_key).toLowerCase().trim()] = p
            }
          })
        }
      }

      let isSubscriptionRowFound = false
      let finalSourcePlan = 'free'
      let finalSourceCustomFeatures = ''
      let finalSourceMaxProj: number | null = null
      let finalSourceMaxExpDir: number | null = null

      let fallbackPlanFromUser: PlanType = 'free'
      let fallbackCustomFeaturesUser = ''
      
      if (userRes) {
        const uJson = await userRes.json().catch(() => ({}))
        const uData = extractRowData(uJson, cleanEmail)
        if (uData) {
          setUserProfile({
            nama: String(uData.nama || s.nama || 'Pengguna'),
            institusi: String(uData.institusi || ''),
            city: String(uData.city || uData.kota || ''),
            digital_signature: String(uData.digital_signature || uData.tandatangan || ''),
            foto_profil: String(uData.foto_profil || uData.fotoprofil || uData.foto || s.foto_profil || s.fotoprofil || '')
          })

          const userRawPlan = String(uData.plan || uData.role || uData.status_user || uData.status_plan || '').toLowerCase().trim()
          if (['free', 'pro', 'plus', 'premium'].includes(userRawPlan)) {
            fallbackPlanFromUser = userRawPlan as PlanType
          }

          for (const key of Object.keys(uData)) {
            const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (['customfeatures', 'customfeature', 'features', 'privileges', 'akses'].includes(lowerKey)) {
              fallbackCustomFeaturesUser = String(uData[key] || '');
              break;
            }
          }
        }
      }

      if (subRes && typeof subRes.json === 'function') {
        const subJson = await subRes.json().catch(() => ({}))
        const parsed = normalizeSubscriptionData(subJson, cleanEmail)
        if (parsed) {
          isSubscriptionRowFound = true
          setSubscription(parsed)
          finalSourcePlan = parsed.plan
          finalSourceCustomFeatures = String(parsed.custom_features || '')
          finalSourceMaxProj = parsed.max_projects !== undefined && parsed.max_projects !== null ? parsed.max_projects : null
          finalSourceMaxExpDir = parsed.max_experts_directory !== undefined && parsed.max_experts_directory !== null ? parsed.max_experts_directory : null
        }
      }

      if (!isSubscriptionRowFound) {
        finalSourcePlan = fallbackPlanFromUser
        finalSourceCustomFeatures = fallbackCustomFeaturesUser
        setSubscription({
          plan: fallbackPlanFromUser,
          status: 'active',
          user_email: cleanEmail,
          user_id: cleanId
        })
      }

      const finalCleanPlan = cleanPlanType(finalSourcePlan)
      setUserPlan(finalCleanPlan)

      let finalAllowAi = false
      let finalAllowSub = false
      let finalAllowAlt = false
      let finalMaxProjects = 3
      let finalMaxExpertsDir = 0

      const activeDynPlan = dynMap[finalCleanPlan]
      const activeCfg = PLAN_CONFIG[finalCleanPlan] || PLAN_CONFIG['free']

      const planDefaultAllowSub = activeDynPlan ? (String(activeDynPlan.allow_subcriteria).toUpperCase() === 'TRUE' || activeDynPlan.allow_subcriteria === true) : (finalCleanPlan !== 'free')
      const planDefaultAllowAlt = activeDynPlan ? (String(activeDynPlan.allow_alternative_method).toUpperCase() === 'TRUE' || activeDynPlan.allow_alternative_method === true) : (finalCleanPlan !== 'free')
      const planDefaultAllowAi = activeDynPlan ? (String(activeDynPlan.allow_ai_features).toUpperCase() === 'TRUE' || activeDynPlan.allow_ai_features === true) : (finalCleanPlan === 'plus' || finalCleanPlan === 'premium')
      
      const planDefaultMaxProj = activeDynPlan?.max_projects ?? activeCfg.maxProjects ?? 3
      const planDefaultMaxExpDir = activeDynPlan?.max_experts_directory ?? (finalCleanPlan === 'pro' ? 5 : finalCleanPlan === 'plus' ? 10 : finalCleanPlan === 'premium' ? 99999 : 0)

      if (isSubscriptionRowFound) {
        const rawFeatureText = finalSourceCustomFeatures.toLowerCase();
        const customList = rawFeatureText.split(',').map(f => f.trim().replace(/[^a-z0-9_]/g, ''));

        const hasCustomSub = customList.some(k => ['subcriteria', 'subkriteria', 'sub'].includes(k));
        const hasCustomAlt = customList.some(k => ['alternative', 'alternatif', 'alternatives', 'alt'].includes(k));
        const hasCustomAi = customList.some(k => ['ai', 'gemini', 'ai_analysis', 'analisis_ai'].includes(k));

        if (finalSourceCustomFeatures.trim() !== '') {
          // 🟢 OVERRIDE MUTLAK: Jika diisi, hak bawaan plan DIABAIKAN.
          finalAllowSub = hasCustomSub;
          finalAllowAlt = hasCustomAlt;
          finalAllowAi = hasCustomAi;
        } else {
          // Jika kosong, gunakan bawaan
          finalAllowSub = planDefaultAllowSub;
          finalAllowAlt = planDefaultAllowAlt;
          finalAllowAi = planDefaultAllowAi;
        }

        finalMaxProjects = finalSourceMaxProj !== null ? finalSourceMaxProj : planDefaultMaxProj;
        finalMaxExpertsDir = finalSourceMaxExpDir !== null ? finalSourceMaxExpDir : planDefaultMaxExpDir;

      } else {
        const rawUserFeatureText = finalSourceCustomFeatures.toLowerCase();
        const customUserList = rawUserFeatureText.split(',').map(f => f.trim().replace(/[^a-z0-9_]/g, ''));
        
        const hasUserCustomSub = customUserList.some(k => ['subcriteria', 'subkriteria', 'sub'].includes(k));
        const hasUserCustomAlt = customUserList.some(k => ['alternative', 'alternatif', 'alternatives', 'alt'].includes(k));
        const hasUserCustomAi = customUserList.some(k => ['ai', 'gemini', 'ai_analysis', 'analisis_ai'].includes(k));

        if (finalSourceCustomFeatures.trim() !== '') {
          finalAllowSub = hasUserCustomSub;
          finalAllowAlt = hasUserCustomAlt;
          finalAllowAi = hasUserCustomAi;
        } else {
          finalAllowSub = planDefaultAllowSub;
          finalAllowAlt = planDefaultAllowAlt;
          finalAllowAi = planDefaultAllowAi;
        }
        
        finalMaxProjects = planDefaultMaxProj;
        finalMaxExpertsDir = planDefaultMaxExpDir;
      }

      setHasAiAccess(finalAllowAi)
      setHasSubcriteriaAccess(finalAllowSub)
      setHasAlternativesAccess(finalAllowAlt)
      setResolvedMaxProjects(finalMaxProjects)
      setResolvedMaxExpertsDirectory(finalMaxExpertsDir >= 999999 ? 99999 : finalMaxExpertsDir)

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

      if (projRes) {
        const pListJson = await projRes.json().catch(() => ({}))
        if (pListJson?.success && Array.isArray(pListJson.data)) {
          setAllUserProjects(pListJson.data)
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
  const isQuotaFull = resolvedMaxProjects !== Number.POSITIVE_INFINITY && projectCount >= resolvedMaxProjects

  const canUseSubcriteria = hasSubcriteriaAccess
  const canUseAlternatives = hasAlternativesAccess
  const isAiAllowed = hasAiAccess

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
      newExperts[index] = { ...newExperts[index], [field]: String(value), fieldError: '' }
      return newExperts
    })
  }

  const handleSelectExpertFromDirectory = (index: number, selected: ExpertDirectoryItem) => {
    const rawFullName = String(selected.expert_name || selected.expertname || selected.nama || '')
    const gDepan = String(selected.gelar_depan || selected.gelardepan || '')
    const gBelakang = String(selected.gelar_belakang || selected.gelarbelakang || '')
    const email = String(selected.expert_email || selected.expertemail || selected.email || '')
    const wa = String(selected.expert_whatsapp || selected.expertwhatsapp || selected.whatsapp || '')
    const expId = String(selected.expert_id || selected.expertid || selected.id || '') 

    const isAlreadyAdded = experts.some((e, i) => i !== index && String(e.expertId) === expId && expId !== '')
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

  const handleGenerateAiCriteria = async () => {
    if (!isAiAllowed) {
      alert(`Fitur Analisis Otomatis belum diaktifkan pada akun Anda.\n\nSilakan hubungi admin untuk mengaktifkan akses.`);
      setShowUpgrade(true);
      return;
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' (Topik/Tujuan) terlebih dahulu agar sistem memahami konteksnya.");
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
        const crNames = aiCriteria.map((c: any) => String(c.name));
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
        alert('Gagal menyusun kriteria otomatis: ' + (json.message || 'Respons kosong.'));
      }
    } catch (err) {
      alert('Koneksi sistem otomatis gagal. Pastikan API Route tersedia.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleGenerateSingleSubcriteria = async (critName: string) => {
    if (!isAiAllowed) {
      alert(`Fitur Subkriteria Otomatis belum diaktifkan pada akun Anda.\n\nSilakan hubungi admin untuk mengaktifkan akses.`);
      setShowUpgrade(true);
      return;
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' terlebih dahulu agar sistem memahami konteksnya.");
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
        alert('Gagal menyusun subkriteria otomatis: ' + (json.message || 'Terjadi kesalahan.'));
      }
    } catch (err) {
      alert('Koneksi ke sistem otomatis gagal. Pastikan API route tersedia.');
    } finally {
      setLoadingSubAi((prev) => ({ ...prev, [critName]: false }));
    }
  };

  const handleSimpan = async () => {
    setError('')
    if (!namaProyek.trim()) return setError('Nama proyek wajib diisi.')
    if (kriteriaArray.length < 2) return setError('Minimal 2 kriteria harus diisi.')

    const formattedSubkriteriaMap: Record<string, string[]> = {}
    if (gunakanSubkriteria && canUseSubcriteria) {
      for (const critName of kriteriaArray) {
        const subs = (subkriteriaTextMap[critName] || '').split('\n').map(s => s.trim()).filter(Boolean)
        if (subs.length < 2) return setError(`Kriteria "${critName}" wajib memiliki minimal 2 subkriteria.`)
        formattedSubkriteriaMap[critName] = subs
      }
    }

    if (metode === 'Bobot alternatif') {
      if (!canUseAlternatives) return setError('Fitur pembobotan alternatif belum diaktifkan pada paket Anda.')
      if (alternatifArray.length < 2) return setError('Minimal 2 alternatif harus diisi jika memilih metode Kombinasi Alternatif.')
    }

    const validExperts = experts.filter((e) => String(e.name || '').trim() !== '')
    if (validExperts.length < 1) return setError('Minimal 1 nama pakar/responden harus diisi.')

    let hasValidationError = false;
    const updatedExpertsState = [...experts];

    updatedExpertsState.forEach((exp) => {
      const expNameStr = String(exp.name || '');
      const expEmailStr = String(exp.email || '');
      const expWaStr = String(exp.whatsapp || '');

      if (expNameStr.trim() !== '') {
        if (!exp.expertId && (expEmailStr.trim() === '' || expWaStr.trim() === '')) {
          exp.fieldError = 'Email dan No. WhatsApp wajib diisi untuk input manual.';
          hasValidationError = true;
        }
      }
    });

    if (hasValidationError) {
      setExperts(updatedExpertsState);
      return setError('Terdapat kesalahan pada formulir pakar. Periksa tanda merah.');
    }

    const emailFas = String(fasilitatorEmail || '').trim()
    const waFas = String(fasilitatorWhatsapp || '').trim()

    if (!emailFas || !waFas) return setError('Kontak fasilitator wajib diisi.')
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

    const waFormatted = waFas.replace(/\D/g, '').replace(/^0/, '62')

    const normalizedExperts = validExperts.map(exp => {
      const expNameStr = String(exp.name || '');
      const expGelarDepanStr = String(exp.gelarDepan || '');
      const expGelarBelakangStr = String(exp.gelarBelakang || '');
      const expEmailStr = String(exp.email || '');
      const expWaStr = String(exp.whatsapp || '');

      return {
        expert_id: exp.expertId || ('EXP-' + Date.now() + Math.floor(Math.random() * 1000)), 
        gelar_depan: expGelarDepanStr.trim(),
        expert_name: expNameStr.trim(),
        gelar_belakang: expGelarBelakangStr.trim(),
        fullName: `${expGelarDepanStr.trim() ? expGelarDepanStr.trim()+' ' : ''}${expNameStr.trim()}${expGelarBelakangStr.trim() ? ', '+expGelarBelakangStr.trim() : ''}`,
        expert_email: expEmailStr ? expEmailStr.trim() : '',
        expert_whatsapp: expWaStr ? expWaStr.replace(/\D/g, '').replace(/^0/, '62') : '',
        is_public: 'PRIVAT',
        source: 'facilitator_update',
        status: 'Aktif'
      }
    })

    const generateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    
    const formattedCriteriaArray = kriteriaArray.map((nama, idx) => ({ id: generateId('crit'), nama: String(nama), urutan: idx + 1 }));
    const formattedSubcriteriaArray: any[] = [];
    
    if (gunakanSubkriteria && canUseSubcriteria) {
      formattedCriteriaArray.forEach((crit) => {
        const subs = formattedSubkriteriaMap[crit.nama] || [];
        subs.forEach((subName, sIdx) => {
          formattedSubcriteriaArray.push({ id: generateId('sub'), criteria_id: crit.id, nama: String(subName), urutan: sIdx + 1 });
        });
      });
    }

    const formattedAlternatifArray = (metode === 'Bobot alternatif' && canUseAlternatives)
      ? alternatifArray.map((nama, idx) => ({ id: generateId('alt'), nama: String(nama), urutan: idx + 1 }))
      : [];

    setLoading(true)
    try {
      const payload = {
        action: 'createproject', 
        user_id: finalUserId, 
        email: emailToSave,
        nama_proyek: String(namaProyek || '').trim(), 
        deskripsi: String(deskripsi || '').trim(),
        metode: (metode === 'Bobot alternatif' && canUseAlternatives) ? 'Bobot alternatif' : 'Bobot saja',
        jumlah_expert: validExperts.length,
        kriteria: formattedCriteriaArray,
        punya_subkriteria: Boolean(gunakanSubkriteria && canUseSubcriteria),
        subkriteria: formattedSubcriteriaArray,
        alternatif: formattedAlternatifArray,
        experts_data: normalizedExperts, 
        fasilitator_email: emailFas || emailToSave,
        fasilitator_whatsapp: waFormatted,
        fasilitator_nama: String(sessionObj.nama || 'Fasilitator').trim(),
      }

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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

  const handleLogout = () => {
    clearSession()
    router.replace('/login')
  }

  const handleScrollToSection = (sec: 'dashboard' | 'consultation') => {
    if (sec === 'dashboard') {
      router.push('/dashboard')
    } else {
      router.push('/dashboard#consultation-section')
    }
  }

  const S = styles
  if (initLoading) return <div style={S.loadingPage}><div style={S.spinner} /><div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Memuat halaman...</div></div>
  if (success) return <div style={S.loadingPage}><div style={{ fontSize: 44 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: '#166534', margin: 0 }}>Proyek Berhasil Dibuat!</h2><p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Mengalihkan ke halaman kelola...</p></div>

  return (
    <div style={S.layoutWrapper}>
      <DashboardSidebar
        user={session}
        userProfile={userProfile}
        userPlan={userPlan}
        projects={allUserProjects}
        isProfileComplete={true}
        isCollapsed={isSidebarCollapsed}
        consultationCount={0}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenProfile={() => router.push('/dashboard?action=profile')}
        onOpenUpgrade={() => setShowUpgrade(true)}
        onLogout={handleLogout}
        onSelectSection={handleScrollToSection}
      />

      <main style={S.mainContent}>
        {showUpgrade && <UpgradeModal currentPlan={currentPlan} onClose={() => setShowUpgrade(false)} />}
        
        <div style={S.container}>
          <AppTopBar />

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
                {projectCount}/{resolvedMaxProjects === Number.POSITIVE_INFINITY ? '∞' : resolvedMaxProjects}
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
                    { val: 'Bobot alternatif' as const, label: 'Kombinasi dengan Alternatif', desc: canUseAlternatives ? 'Evaluasi lengkap hingga perankingan alternatif.' : '🔒 Belum Diaktifkan di Subscription', disabled: !canUseAlternatives },
                  ].map(({ val, label, desc, disabled }) => (
                    <button key={val} type="button" onClick={() => disabled ? setShowUpgrade(true) : setMetode(val)} style={disabled ? { ...S.radioBtn, opacity: 0.6, cursor: 'not-allowed', background: '#f1f5f9' } : metode === val ? { ...S.radioBtn, ...S.radioBtnActive } : S.radioBtn}>
                      <strong style={{ fontSize: 12.5 }}>{label} {disabled && '🔒'}</strong>
                      <span style={{ fontSize: 11, color: metode === val && !disabled ? '#1d4ed8' : '#64748b' }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}>
                <label style={S.label}>Deskripsi Proyek (Konteks untuk Analisis Otomatis)</label>
                <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Jelaskan latar belakang, tujuan, atau konteks analisis untuk membantu sistem menyusun struktur secara otomatis..." />
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <h3 style={{...S.cardTitle, margin: 0}}>
                2. Daftar Kriteria Utama <span style={S.badge}>{kriteriaArray.length} aktif</span>
              </h3>
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
                {loadingAi ? 'Menyusun Struktur...' : isAiAllowed ? '🪄 Susun Kriteria Otomatis' : '🔒 Analisis Otomatis (Perlu Izin custom_features)'}
              </button>
            </div>
            
            <p style={S.cardDesc}>
              {loadingAi 
                ? <span style={{ color: '#2563eb', fontWeight: 600 }}>Sistem sedang membaca konteks penelitian dan merumuskan kriteria MECE...</span> 
                : 'Ketik nama kriteria ke bawah (pisahkan dengan Enter). Generator otomatis akan menimpa isian ini jika digunakan.'}
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
                <span>Aktifkan Subkriteria (Pecah kriteria menjadi sub-elemen) {!canUseSubcriteria && '🔒 [Belum Diaktifkan di Subscription]'}</span>
              </label>
            </div>

            {canUseSubcriteria && gunakanSubkriteria && kriteriaArray.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 12 }}>
                  Rincian Subkriteria
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
                            {isCritLoading ? '⏳ Menyusun...' : isAiAllowed ? '🪄 Susun Sub' : '🔒 Susun Sub'}
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
                          value={isCritLoading ? 'Sistem sedang merumuskan subkriteria...' : (subkriteriaTextMap[crit] || '')}
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

          {metode === 'Bobot alternatif' && canUseAlternatives && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>3. Daftar Alternatif Pilihan <span style={S.badge}>{alternatifArray.length} aktif</span></h3>
              <p style={S.cardDesc}>Ketik nama alternatif ke bawah (pisahkan dengan Enter).</p>
              <div style={S.fieldGroup}>
                <textarea style={{ ...S.input, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }} value={alternatifText} onChange={(e) => setAlternatifText(e.target.value)} placeholder={"Vendor A\nVendor B\nVendor C"} />
              </div>
            </div>
          )}

          <div style={S.card}>
            <h3 style={S.cardTitle}>
              <span>4. Tim Pakar (Expert Responden)</span>
              <span style={S.badgeGlobal}>{resolvedMaxExpertsDirectory === 0 ? '📝 Input Manual Mandiri' : `🔍 Kuota Direktori: ${resolvedMaxExpertsDirectory === 99999 ? 'Unlimited' : resolvedMaxExpertsDirectory}`}</span>
            </h3>

            {resolvedMaxExpertsDirectory === 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', color: '#92400e', fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
                💡 <strong>Informasi Paket:</strong> Anda dapat menginput data pakar/responden secara manual. Fitur pencarian dari <em>Direktori Pakar</em> akan terbuka jika kuota direktori diaktifkan di akun Anda.
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
                const expNameStr = String(exp.name || '').toLowerCase().trim();
                const filteredSuggestions = resolvedMaxExpertsDirectory > 0 && expNameStr.length > 1
                  ? directoryExperts.filter(item => {
                      const pName = String(item.expert_name || item.expertname || item.nama || '').toLowerCase()
                      const pEmail = String(item.expert_email || item.expertemail || item.email || '').toLowerCase()
                      return pName.includes(expNameStr) || pEmail.includes(expNameStr)
                    })
                  : []
                const isFromDirectory = Boolean(exp.expertId && String(exp.expertId).trim() !== '')

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
                      <div style={S.fieldGroup}><label style={S.label}>Nama Inti / Utama <span style={{ color: '#dc2626' }}>*</span></label><input style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }} type="text" value={exp.name} readOnly={isFromDirectory} onFocus={() => resolvedMaxExpertsDirectory > 0 && !isFromDirectory && setActiveSuggestionIndex(i)} onChange={(e) => { setExperts(prev => { const updated = [...prev]; updated[i] = { ...updated[i], name: e.target.value, expertId: '', fieldError: '' }; return updated; }); if (resolvedMaxExpertsDirectory > 0) setActiveSuggestionIndex(i) }} placeholder="Ketik nama inti..." required /></div>
                      <div style={S.fieldGroup}><label style={S.label}>Gelar Belakang</label><input style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }} type="text" value={exp.gelarBelakang} readOnly={isFromDirectory} onChange={(e) => updateExpertField(i, 'gelarBelakang', e.target.value)} placeholder="M.Sc. / Ph.D." /></div>
                    </div>

                    {exp.fieldError && <div style={S.fieldErrorBox}>⚠️ {exp.fieldError}</div>}

                    {resolvedMaxExpertsDirectory > 0 && !isFromDirectory && activeSuggestionIndex === i && filteredSuggestions.length > 0 && (
                      <div style={S.suggestionInlineBox}>
                        <div style={S.suggestionHeader}>💡 Saran Pakar (Klik untuk Pilih):</div>
                        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                          {filteredSuggestions.map((item, idx) => (
                            <div key={idx} style={S.suggestionItem} onClick={() => handleSelectExpertFromDirectory(i, item)}>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{String(item.expert_name || item.expertname || item.nama || 'Pakar')}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>🏢 Instansi: {String(item.asal_instansi || item.instansi || '-')}</div>
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
      </main>
    </div>
  )
}

export default function BuatProyekPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat formulir proyek baru...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <BuatProyekPageContent />
    </Suspense>
  )
}

// Komponen penengah yang mengatasi export error Suspense
function BuatProyekPageContent() {
  return <BuatProyekContent />
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
  loadingPage: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' },
  spinner: { width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  container: { maxWidth: 880, margin: '0 auto', padding: '24px 20px' },
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