// lib/subscription.ts

import { getSession } from './auth'

export type PlanType = 'free' | 'pro' | 'plus' | 'premium'

export interface PlanConfigItem {
  name: string
  label: string
  price: string
  duration: string
  maxProjects: number
  maxExpertsManual: number
  maxExpertsDirectory: number
  maxConsultationPerExpert: number
  allowSubcriteria: boolean
  allowAlternativeMethod: boolean
  allowAiFeatures: boolean
  color: string
  bg: string
  border: string
  features: string[]
}

export interface Subscription {
  id?: string
  user_id?: string
  user_email?: string
  plan: PlanType
  status: string
  status_user?: string
  is_custom_privilege?: boolean
  max_projects: number
  max_experts_manual: number
  max_experts_directory: number
  max_consultation_per_expert: number
  allow_subcriteria: boolean
  allow_alternative_method: boolean
  allow_ai_features: boolean
  started_at?: string
  expires_at?: string
  created_at?: string
  updated_at?: string
  notes?: string
  custom_features?: string
}

export interface QuotaInfo {
  subscription: Subscription
  projectCount: number
  remainingProjects: number
  isProjectUnlimited: boolean
  isExpertManualUnlimited: boolean
  isExpertDirectoryUnlimited: boolean
  canCreateProject: boolean
  maxProjectsLabel: string
  maxExpertsManualLabel: string
  maxExpertsDirectoryLabel: string
  remainingProjectsLabel: string
}

export const PLAN_CONFIG: Record<PlanType, PlanConfigItem> = {
  free: {
    name: 'Free',
    label: '🆓 Free',
    price: 'Gratis',
    duration: 'Selamanya',
    maxProjects: 1,
    maxExpertsManual: 4,
    maxExpertsDirectory: 0,
    maxConsultationPerExpert: 0,
    allowSubcriteria: false,
    allowAlternativeMethod: false,
    allowAiFeatures: true,
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
    features: [
      'Batas maksimal 1 Proyek Aktif',
      'Maksimal 4 Pakar Umum (Manual)',
      'Akses Direktori Pakar (Terkunci)',
      'Tanpa Fasilitas Konsultasi Pakar',
      'Metode: Bobot Saja (Tanpa Alternatif)',
      'Fitur Bantuan AI Riset'
    ]
  },
  pro: {
    name: 'Pro',
    label: '⚡ Semester Pass Pro',
    price: 'Rp 150.000',
    duration: '6 Bulan (1 Semester)',
    maxProjects: 3,
    maxExpertsManual: 8,
    maxExpertsDirectory: 5,
    maxConsultationPerExpert: 3,
    allowSubcriteria: true,
    allowAlternativeMethod: true,
    allowAiFeatures: false,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    features: [
      'Batas maksimal 3 Proyek Aktif',
      'Maksimal 8 Pakar Umum (Manual)',
      'Akses Direktori Pakar (Maks 5 Pakar)',
      'Maksimal 3 Konsultasi / Pakar',
      'Seluruh Metode AHP & Hirarki Lengkap',
      'Fitur Bantuan AI (Terkunci)'
    ]
  },
  plus: {
    name: 'Plus',
    label: '🚀 Semester Pass Plus',
    price: 'Rp 350.000',
    duration: '6 Bulan (1 Semester)',
    maxProjects: 10,
    maxExpertsManual: 15,
    maxExpertsDirectory: 10,
    maxConsultationPerExpert: 5,
    allowSubcriteria: true,
    allowAlternativeMethod: true,
    allowAiFeatures: true,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    features: [
      'Batas maksimal 10 Proyek Aktif',
      'Maksimal 15 Pakar Umum (Manual)',
      'Akses Direktori Pakar (Maks 10 Pakar)',
      'Maksimal 5 Konsultasi / Pakar',
      'Seluruh Metode AHP & Hirarki Lengkap',
      'Fitur Bantuan AI (Menengah)'
    ]
  },
  premium: {
    name: 'Premium',
    label: '👑 Semester Pass Premium',
    price: 'Rp 750.000',
    duration: '6 Bulan (1 Semester)',
    maxProjects: Number.POSITIVE_INFINITY,
    maxExpertsManual: Number.POSITIVE_INFINITY,
    maxExpertsDirectory: Number.POSITIVE_INFINITY,
    maxConsultationPerExpert: 15,
    allowSubcriteria: true,
    allowAlternativeMethod: true,
    allowAiFeatures: true,
    color: '#92400e',
    bg: '#fffbeb',
    border: '#fcd34d',
    features: [
      'Unlimited Proyek Aktif',
      'Unlimited Pakar Umum (Manual)',
      'Unlimited Akses Direktori Pakar',
      'Maksimal 15 Konsultasi per Pakar',
      'Seluruh Metode AHP & Hirarki Lengkap',
      'Akses Prioritas AI & Dukungan VIP Admin'
    ]
  },
}

function normalizePlan(plan: unknown, statusUser?: unknown, userId?: unknown): PlanType {
  const value = String(plan || '').trim().toLowerCase()
  const statusStr = String(statusUser || '').trim().toUpperCase()
  const idStr = String(userId || '').trim().toUpperCase()

  if (statusStr === 'EXPERT_REWARD' || idStr.startsWith('EXP-') || statusStr.includes('PAKAR')) {
    return 'pro'
  }

  if (value === 'pro') return 'pro'
  if (value === 'plus') return 'plus'
  if (value === 'premium') return 'premium'
  return 'free'
}

function isUnlimitedValue(value: unknown): boolean {
  return (
    value === Infinity ||
    value === Number.POSITIVE_INFINITY ||
    Number(value) >= 999999 ||
    String(value).trim().toLowerCase() === 'infinity' ||
    String(value).trim().toLowerCase() === 'unlimited'
  )
}

function safeNumber(value: unknown, fallback: number): number {
  if (isUnlimitedValue(value)) return Number.POSITIVE_INFINITY
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'Unlimited'
}

function defaultSubscription(fallbackPlan: PlanType = 'free'): Subscription {
  const cfg = PLAN_CONFIG[fallbackPlan]
  return {
    id: '',
    user_id: '',
    user_email: '',
    plan: fallbackPlan,
    status: 'active',
    status_user: fallbackPlan === 'pro' ? 'EXPERT_REWARD' : 'REGULAR',
    is_custom_privilege: false,
    max_projects: cfg.maxProjects,
    max_experts_manual: cfg.maxExpertsManual,
    max_experts_directory: cfg.maxExpertsDirectory,
    max_consultation_per_expert: cfg.maxConsultationPerExpert,
    allow_subcriteria: cfg.allowSubcriteria,
    allow_alternative_method: cfg.allowAlternativeMethod,
    allow_ai_features: cfg.allowAiFeatures,
    started_at: '',
    expires_at: '',
    created_at: '',
    updated_at: '',
    notes: '',
    custom_features: '',
  }
}

export function isSubscriptionActive(subscription?: Subscription | null): boolean {
  if (!subscription) return false
  return String(subscription.status || '').trim().toLowerCase() === 'active'
}

export function getPlanView(plan: PlanType): PlanConfigItem {
  return PLAN_CONFIG[normalizePlan(plan)]
}

/**
 * 🟢 Mengambil data paket langganan aktif:
 * - Prioritas 1: Kuota kustom di `AHP - subscriptions`
 * - Prioritas 2 (Fallback): Batasan default di `PLAN_CONFIG` / `AHP - plan_settings`
 */
export async function getSubscription(userIdOrEmail?: string, userEmail?: string): Promise<Subscription> {
  let sessionPlan: PlanType = 'free'
  let localEmail = ''

  if (typeof window !== 'undefined') {
    const session = getSession()
    localEmail = session?.email || ''

    const rawData = localStorage.getItem('ahp_user_data') || localStorage.getItem('user_session')
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData)
        sessionPlan = normalizePlan(parsed.plan, parsed.status_user, parsed.id || parsed.user_id)
      } catch {
        // Abaikan parse error
      }
    }
  }

  const resolvedEmail = userEmail || (userIdOrEmail && userIdOrEmail.includes('@') ? userIdOrEmail : localEmail)

  if (!resolvedEmail) {
    return defaultSubscription(sessionPlan)
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/subscriptions?email=${encodeURIComponent(resolvedEmail)}&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    })

    const json = await res.json()

    if (!json?.success || !json.data) {
      return defaultSubscription(sessionPlan)
    }

    const { subscription: subData, planSetting: dbPlanSetting } = json.data
    const plan = normalizePlan(subData?.plan || sessionPlan)
    const cfg = PLAN_CONFIG[plan]

    // Default fallback dari tabel AHP - plan_settings jika ada, atau dari PLAN_CONFIG
    const fallbackProjects = dbPlanSetting?.max_projects !== undefined ? dbPlanSetting.max_projects : cfg.maxProjects
    const fallbackExpertsManual = dbPlanSetting?.max_experts_manual !== undefined ? dbPlanSetting.max_experts_manual : cfg.maxExpertsManual
    const fallbackExpertsDir = dbPlanSetting?.max_experts_directory !== undefined ? dbPlanSetting.max_experts_directory : cfg.maxExpertsDirectory
    const fallbackConsult = dbPlanSetting?.max_consultation_per_expert !== undefined ? dbPlanSetting.max_consultation_per_expert : cfg.maxConsultationPerExpert

    // Cek apakah ada batasan kustom spesifik di AHP - subscriptions
    const hasCustomProjects = subData?.max_projects !== null && subData?.max_projects !== undefined && subData?.max_projects !== ''
    const hasCustomExperts = subData?.max_experts !== null && subData?.max_experts !== undefined && subData?.max_experts !== ''
    const hasCustomDir = subData?.max_experts_directory !== null && subData?.max_experts_directory !== undefined && subData?.max_experts_directory !== ''
    const hasCustomConsult = subData?.max_consultation_per_expert !== null && subData?.max_consultation_per_expert !== undefined && subData?.max_consultation_per_expert !== ''

    const isCustomPrivilege = hasCustomProjects || hasCustomExperts || hasCustomDir || hasCustomConsult

    return {
      id: subData?.user_email || resolvedEmail,
      user_id: resolvedEmail,
      user_email: resolvedEmail,
      plan,
      status: String(subData?.status || 'ACTIVE').toLowerCase(),
      status_user: plan === 'pro' ? 'EXPERT_REWARD' : 'REGULAR',
      is_custom_privilege: isCustomPrivilege,
      // 🟢 PRIORITAS: Nilai kuota kustom AHP - subscriptions -> Fallback: Default paket
      max_projects: hasCustomProjects ? safeNumber(subData.max_projects, fallbackProjects) : safeNumber(fallbackProjects, cfg.maxProjects),
      max_experts_manual: hasCustomExperts ? safeNumber(subData.max_experts, fallbackExpertsManual) : safeNumber(fallbackExpertsManual, cfg.maxExpertsManual),
      max_experts_directory: hasCustomDir ? safeNumber(subData.max_experts_directory, fallbackExpertsDir) : safeNumber(fallbackExpertsDir, cfg.maxExpertsDirectory),
      max_consultation_per_expert: hasCustomConsult ? safeNumber(subData.max_consultation_per_expert, fallbackConsult) : safeNumber(fallbackConsult, cfg.maxConsultationPerExpert),
      allow_subcriteria: dbPlanSetting?.allow_subcriteria !== undefined ? Boolean(dbPlanSetting.allow_subcriteria) : cfg.allowSubcriteria,
      allow_alternative_method: dbPlanSetting?.allow_alternative_method !== undefined ? Boolean(dbPlanSetting.allow_alternative_method) : cfg.allowAlternativeMethod,
      allow_ai_features: dbPlanSetting?.allow_ai_features !== undefined ? Boolean(dbPlanSetting.allow_ai_features) : cfg.allowAiFeatures,
      started_at: '',
      expires_at: subData?.expired_date || '',
      created_at: '',
      updated_at: '',
      notes: subData?.notes || '',
      custom_features: subData?.custom_features || '',
    }
  } catch (error) {
    console.error('getSubscription error:', error)
    return defaultSubscription(sessionPlan)
  }
}

export async function countUserProjects(userEmail: string): Promise<number> {
  try {
    if (!userEmail) return 0
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/projects?email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    })
    const result = await res.json()
    if (result && Array.isArray(result.data)) {
      return result.data.length
    }
    return 0
  } catch (error) {
    console.error('countUserProjects error:', error)
    return 0
  }
}

export async function getUserQuotaInfo(
  userId: string,
  userEmail: string
): Promise<QuotaInfo> {
  const subscription = await getSubscription(userId, userEmail)
  const projectCount = await countUserProjects(userEmail)

  const maxProjects = subscription.max_projects
  const maxExpertsManual = subscription.max_experts_manual
  const maxExpertsDirectory = subscription.max_experts_directory

  const isProjectUnlimited = !Number.isFinite(maxProjects)
  const isExpertManualUnlimited = !Number.isFinite(maxExpertsManual)
  const isExpertDirectoryUnlimited = !Number.isFinite(maxExpertsDirectory)

  const remainingProjects = isProjectUnlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxProjects - projectCount)

  return {
    subscription,
    projectCount,
    remainingProjects,
    isProjectUnlimited,
    isExpertManualUnlimited,
    isExpertDirectoryUnlimited,
    canCreateProject:
      isSubscriptionActive(subscription) &&
      (isProjectUnlimited || remainingProjects > 0),
    maxProjectsLabel: formatLimit(maxProjects),
    maxExpertsManualLabel: formatLimit(maxExpertsManual),
    maxExpertsDirectoryLabel: formatLimit(maxExpertsDirectory),
    remainingProjectsLabel: formatLimit(remainingProjects),
  }
}