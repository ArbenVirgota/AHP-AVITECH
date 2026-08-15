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

interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  error_code?: string
  data?: T
  [key: string]: unknown
}

interface SubscriptionApiPayload {
  id?: string
  subscription_id?: string
  user_id?: string
  user_email?: string
  plan?: string
  status?: string
  status_user?: string
  max_projects?: number | string
  max_experts_manual?: number | string
  max_experts?: number | string
  max_experts_directory?: number | string
  max_consultation_per_expert?: number | string
  allow_subcriteria?: boolean | string
  allow_alternative_method?: boolean | string
  allow_ai_features?: boolean | string
  started_at?: string
  expires_at?: string
  start_date?: string
  end_date?: string
  expired_date?: string
  created_at?: string
  updated_at?: string
  created_date?: string
  updated_date?: string
  notes?: string
  custom_features?: string
  [key: string]: unknown
}

const GOOGLE_SCRIPT_URL = 
  process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || 
  process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbwpYV3wr6PfdCOymXi5qtUXEXChFivecf1AMIn0M1TSrlbtsOiec3e901pSr2FvewDo/exec'

export const PLAN_CONFIG: Record<PlanType, PlanConfigItem> = {
  free: {
    name: 'Free',
    label: '🆓 Free',
    price: 'Gratis',
    duration: 'Selamanya',
    maxProjects: 1,
    maxExpertsManual: 5,
    maxExpertsDirectory: 0,
    maxConsultationPerExpert: 0,
    allowSubcriteria: true,
    allowAlternativeMethod: false,
    allowAiFeatures: false,
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
    features: [
      'Batas maksimal 1 Proyek Aktif',
      'Maksimal 5 Pakar Umum (Manual)',
      'Akses Direktori Pakar (Terkunci)',
      'Tanpa Fasilitas Konsultasi Pakar',
      'Metode: Bobot Saja (Tanpa Alternatif)',
      'Bantuan AI (Tidak Tersedia)'
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
    allowAiFeatures: false, // 🔒 Dibuat false
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    features: [
      'Batas maksimal 3 Proyek Aktif',
      'Maksimal 8 Pakar Umum (Manual)',
      'Akses Direktori Pakar (Maks 5 Pakar)',
      'Maksimal 3 Konsultasi / Pakar',
      'Seluruh Metode AHP & Hirarki Lengkap',
      'Fitur Bantuan AI (Terkunci)' // 🟢 Teks diperbarui agar selaras
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

  // 🟢 Deteksi khusus Pakar: Otomatis tetapkan paket PRO
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

function safeString(value: unknown): string {
  return value == null ? '' : String(value)
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

function mapSubscriptionPayload(data: SubscriptionApiPayload | null | undefined): Subscription {
  if (!data) return defaultSubscription()

  const plan = normalizePlan(data.plan, data.status_user, data.user_id || data.id)
  const cfg = PLAN_CONFIG[plan]

  const allowSub = data.allow_subcriteria !== undefined
    ? String(data.allow_subcriteria).toLowerCase() === 'true'
    : cfg.allowSubcriteria

  const allowAlt = data.allow_alternative_method !== undefined
    ? String(data.allow_alternative_method).toLowerCase() === 'true'
    : cfg.allowAlternativeMethod

  const allowAi = data.allow_ai_features !== undefined
    ? String(data.allow_ai_features).toLowerCase() === 'true'
    : cfg.allowAiFeatures

  return {
    id: safeString(data.id || data.subscription_id),
    user_id: safeString(data.user_id),
    user_email: safeString(data.user_email),
    plan,
    status: safeString(data.status || 'active'),
    status_user: safeString(data.status_user || (plan === 'pro' ? 'EXPERT_REWARD' : 'REGULAR')),
    max_projects: safeNumber(data.max_projects, cfg.maxProjects),
    max_experts_manual: safeNumber(data.max_experts_manual || data.max_experts, cfg.maxExpertsManual),
    max_experts_directory: safeNumber(data.max_experts_directory, cfg.maxExpertsDirectory),
    max_consultation_per_expert: safeNumber(data.max_consultation_per_expert, cfg.maxConsultationPerExpert),
    allow_subcriteria: allowSub,
    allow_alternative_method: allowAlt,
    allow_ai_features: allowAi,
    started_at: safeString(data.started_at || data.start_date),
    expires_at: safeString(data.expires_at || data.end_date || data.expired_date),
    created_at: safeString(data.created_at || data.created_date),
    updated_at: safeString(data.updated_at || data.updated_date),
    notes: safeString(data.notes),
    custom_features: safeString(data.custom_features),
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
 * 🟢 Mengambil data paket langganan aktif (Toleran sesi lokal & pakar)
 */
export async function getSubscription(userIdOrEmail?: string, userEmail?: string): Promise<Subscription> {
  // 1. Periksa sesi lokal sebagai acuan awal
  let sessionPlan: PlanType = 'free'
  let localUserId = ''
  let localEmail = ''

  if (typeof window !== 'undefined') {
    const session = getSession()
    localUserId = session?.id || ''
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

  const resolvedId = userIdOrEmail || localUserId
  const resolvedEmail = userEmail || (userIdOrEmail && userIdOrEmail.includes('@') ? userIdOrEmail : localEmail)

  if (!resolvedId && !resolvedEmail) {
    return defaultSubscription(sessionPlan)
  }

  try {
    const queryParams = new URLSearchParams({ action: 'getsubscription' })
    if (resolvedId) queryParams.append('user_id', resolvedId)
    if (resolvedEmail) queryParams.append('user_email', resolvedEmail)
    queryParams.append('_t', String(Date.now()))

    const res = await fetch(`${GOOGLE_SCRIPT_URL}?${queryParams.toString()}`, {
      method: 'GET',
      cache: 'no-store',
    })

    const result = (await res.json()) as ApiResponse<SubscriptionApiPayload>

    if (!result?.success || !result.data) {
      return defaultSubscription(sessionPlan)
    }

    return mapSubscriptionPayload(result.data)
  } catch (error) {
    console.error('getSubscription error:', error)
    return defaultSubscription(sessionPlan)
  }
}

export async function countUserProjects(userEmail: string): Promise<number> {
  try {
    if (!userEmail) return 0

    const res = await fetch(
      `${GOOGLE_SCRIPT_URL}?action=get_projects&user_email=${encodeURIComponent(userEmail)}&_t=${Date.now()}`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    )

    const result = (await res.json()) as ApiResponse<unknown>

    if (!result?.success) return 0

    if (Array.isArray(result.data)) {
      return result.data.length
    }

    if (Array.isArray((result as { projects?: unknown }).projects)) {
      return ((result as { projects?: unknown[] }).projects || []).length
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