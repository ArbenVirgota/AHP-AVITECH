// app/expert/layout.tsx
import React from 'react'

export const metadata = {
  title: 'Ruang Tanggapan Pakar - AHP Platform',
  description: 'Portal Evaluator Pakar AHP Decision Support System',
}

export default function ExpertLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc' }}>
      {children}
    </div>
  )
}