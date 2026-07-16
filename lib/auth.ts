export interface UserSession {
  id: string
  nama: string
  email: string
  status_user?: string
  institusi?: string
}

const SESSION_KEY = 'ahp_user_session'

export function saveSession(session: UserSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): UserSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.email) return null

    return {
      id: String(parsed.id || ''),
      nama: String(parsed.nama || ''),
      email: String(parsed.email || ''),
      status_user: parsed.status_user ? String(parsed.status_user) : '',
      institusi: parsed.institusi ? String(parsed.institusi) : '',
    }
  } catch (error) {
    console.error('getSession error:', error)
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

export function isLoggedIn(): boolean {
  return !!getSession()
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}