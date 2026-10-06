// app/buat-proyek/page.tsx

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/buat-proyek/baru')
  }, [router])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 12,
      color: '#334155',
      background: '#f8fafc',
      fontFamily: 'Segoe UI, system-ui, sans-serif'
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: '3px solid rgba(37,99,235,0.15)',
        borderTop: '3px solid #2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>Mengalihkan ke formulir proyek baru...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}