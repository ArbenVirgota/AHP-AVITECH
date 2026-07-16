export type PlanType = 'free' | 'pro' | 'premium'

export interface Subscription {
  id?: string
  user_id?: string
  user_email?: string
  plan: PlanType
  status: string
  max_projects: number
  max_experts: number
  started_at?: string
  expires_at?: string
  created_at?: string
  updated_at?: string
  notes?: string
}

export interface QuotaInfo {
  subscription: Subscription
  projectCount: number
  remainingProjects: number
  isProjectUnlimited: boolean
  isExpertUnlimited: boolean
  canCreateProject: boolean
  maxProjectsLabel: string
  maxExpertsLabel: string
  remainingProjectsLabel: string
}

interface PlanConfigItem {
  name: string
  label: string
  price: string
  maxProjects: number
  maxExperts: number
  color: string
  bg: string
  border: string
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
  max_projects?: number | string
  max_experts?: number | string
  started_at?: string
  expires_at?: string
  start_date?: string
  end_date?: string
  created_at?: string
  updated_at?: string
  created_date?: string
  updated_date?: string
  notes?: string
  [key: string]: unknown
}

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

export const PLAN_CONFIG: Record<PlanType, PlanConfigItem> = {
  free: {
    name: 'Free',
    label: '🆓 Free',
    price: 'Gratis',
    maxProjects: 1,
    maxExperts: 5,
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
  },
  pro: {
    name: 'Pro',
    label: '⚡ Pro',
    price: 'Rp 49.000/bln',
    maxProjects: 10,
    maxExperts: 20,
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  premium: {
    name: 'Premium',
    label: '👑 Premium',
    price: 'Rp 99.000/bln',
    maxProjects: Number.POSITIVE_INFINITY,
    maxExperts: Number.POSITIVE_INFINITY,
    color: '#92400e',
    bg: '#fffbeb',
    border: '#fcd34d',
  },
}

function normalizePlan(plan: unknown): PlanType {
  const value = String(plan || '').trim().toLowerCase()
  if (value === 'pro') return 'pro'
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

function defaultSubscription(): Subscription {
  const cfg = PLAN_CONFIG.free

  return {
    id: '',
    user_id: '',
    user_email: '',
    plan: 'free',
    status: 'active',
    max_projects: cfg.maxProjects,
    max_experts: cfg.maxExperts,
    started_at: '',
    expires_at: '',
    created_at: '',
    updated_at: '',
    notes: '',
  }
}

function mapSubscriptionPayload(data: SubscriptionApiPayload | null | undefined): Subscription {
  if (!data) return defaultSubscription()

  const plan = normalizePlan(data.plan)
  const cfg = PLAN_CONFIG[plan]

  return {
    id: safeString(data.id || data.subscription_id),
    user_id: safeString(data.user_id),
    user_email: safeString(data.user_email),
    plan,
    status: safeString(data.status || 'active'),
    max_projects: safeNumber(data.max_projects, cfg.maxProjects),
    max_experts: safeNumber(data.max_experts, cfg.maxExperts),
    started_at: safeString(data.started_at || data.start_date),
    expires_at: safeString(data.expires_at || data.end_date),
    created_at: safeString(data.created_at || data.created_date),
    updated_at: safeString(data.updated_at || data.updated_date),
    notes: safeString(data.notes),
  }
}

export function isSubscriptionActive(subscription?: Subscription | null): boolean {
  if (!subscription) return false
  return String(subscription.status || '').trim().toLowerCase() === 'active'
}

export function getPlanView(plan: PlanType): PlanConfigItem {
  return PLAN_CONFIG[normalizePlan(plan)]
}

export async function getSubscription(userId: string): Promise<Subscription> {
  try {
    if (!userId) return defaultSubscription()

    const res = await fetch(
      `${GOOGLE_SCRIPT_URL}?action=get_subscription&user_id=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    )

    const result = (await res.json()) as ApiResponse<SubscriptionApiPayload>

    if (!result?.success) {
      return defaultSubscription()
    }

    return mapSubscriptionPayload(result.data)
  } catch (error) {
    console.error('getSubscription error:', error)
    return defaultSubscription()
  }
}

export async function countUserProjects(userEmail: string): Promise<number> {
  try {
    if (!userEmail) return 0

    const res = await fetch(
      `${GOOGLE_SCRIPT_URL}?action=get_projects&user_email=${encodeURIComponent(userEmail)}`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    )

    const result = (await res.json()) as ApiResponse<unknown>

    if (!result?.success) {
      return 0
    }

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
  const subscription = await getSubscription(userId)
  const projectCount = await countUserProjects(userEmail)

  const maxProjects = subscription.max_projects
  const maxExperts = subscription.max_experts

  const isProjectUnlimited = !Number.isFinite(maxProjects)
  const isExpertUnlimited = !Number.isFinite(maxExperts)

  const remainingProjects = isProjectUnlimited
    ? Number.POSITIVE_INFINITY
    : Math.max(0, maxProjects - projectCount)

  return {
    subscription,
    projectCount,
    remainingProjects,
    isProjectUnlimited,
    isExpertUnlimited,
    canCreateProject:
      isSubscriptionActive(subscription) &&
      (isProjectUnlimited || remainingProjects > 0),
    maxProjectsLabel: formatLimit(maxProjects),
    maxExpertsLabel: formatLimit(maxExperts),
    remainingProjectsLabel: formatLimit(remainingProjects),
  }
}