// app/user/projects/page.tsx

'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

// 🟢 Helper pembaca jumlah item kriteria & alternatif
const parseItemCount = (raw: any): number => {
  if (raw === undefined || raw === null) return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  
  const text = String(raw).trim()
  if (!text || text === '-' || text === '[]' || text === '{}' || text === '0') return 0

  if (!isNaN(Number(text))) return Number(text)

  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.reduce((acc, curr) => {
          if (typeof curr === 'object' && curr !== null) {
            const subs = curr.subs || curr.subkriteria || curr.subcriteria || curr.items
            if (Array.isArray(subs)) return acc + subs.length
            if (Array.isArray(curr)) return acc + curr.length
          }
          return acc + 1
        }, 0)
      }
      if (typeof parsed === 'object') {
        let total = 0
        for (const k in parsed) {
          if (Array.isArray(parsed[k])) {
            total += parsed[k].length
          } else {
            total += 1
          }
        }
        return total > 0 ? total : Object.keys(parsed).length
      }
    } catch {
      // Delimiter fallback
    }
  }

  let items: string[] = []
  if (text.includes('\n')) {
    items = text.split('\n')
  } else if (text.includes(';')) {
    items = text.split(';')
  } else if (text.includes('|')) {
    items = text.split('|')
  } else if (text.includes(',')) {
    items = text.split(',')
  } else {
    return 1
  }

  return items.map(s => s.trim()).filter(Boolean).length
}

// 🟢 TOP HEADER RESMI AHP
function AppTopBar() {
  return (
    <div style={STYLES.topBarContainer} className="no-print">
      <div style={STYLES.topBarBrand}>
        <img src="/logo.png" alt="Logo AHP" style={STYLES.topBarLogo} />
        <div>
          <h2 style={STYLES.topBarTitle}>ANALYTIC HIERARCHY PROCESS</h2>
          <p style={STYLES.topBarSubtitle}>Sistem Pendukung Keputusan Multi-Kriteria Terintegrasi</p>
        </div>
      </div>
    </div>
  )
}

function UserProjectsContent() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const loadUserData = useCallback(async (session: any) => {
    try {
      setLoading(true)
      const cleanEmail = String(session.email || '').trim().toLowerCase()

      // Mengambil data proyek pengguna langsung dari endpoint Prisma MySQL internal
      const projRes = await fetch(`/api/projects?email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(session.id || '')}&_t=${Date.now()}`)
      const projJson = await projRes.json()

      if (projJson?.success && Array.isArray(projJson.data)) {
        setProjects(projJson.data)
      } else {
        setProjects([])
      }
    } catch (err: any) {
      setErrorMsg(`Gagal memuat data proyek: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = getSession()
    if (!session || !session.email) {
      router.replace('/login')
      return
    }
    loadUserData(session)
  }, [router, loadUserData])

  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    return projects.filter(p => {
      const name = String(p.namaProyek || p.nama_proyek || p.namaproyek || p.judul || '').toLowerCase()
      const desc = String(p.deskripsi || '').toLowerCase()
      const id = String(p.project_id || p.id || '').toLowerCase()
      return !q || name.includes(q) || desc.includes(q) || id.includes(q)
    })
  }, [projects, searchTerm])

  return (
    <div style={STYLES.wrapper}>
      {/* 🟢 MAIN WORKSPACE */}
      <main style={STYLES.main}>
        <div style={STYLES.container}>
          
          {/* TOP BAR RESMI */}
          <AppTopBar />

          {/* PAGE HEADER ROW & ACTIONS */}
          <div style={STYLES.pageHeader}>
            <div>
              <div style={STYLES.academicPill}>Workspace Proyek</div>
              <h1 style={STYLES.pageTitle}>📁 Manajemen Proyek AHP</h1>
              <p style={STYLES.pageSubtitle}>Daftar seluruh ruang kerja pemodelan hierarki, matriks perbandingan, dan kuesioner pakar.</p>
            </div>

            <div style={STYLES.headerActions}>
              <button onClick={() => router.push('/buat-proyek/baru')} style={STYLES.btnNewProject}>
                + Buat Proyek Baru
              </button>
              <button onClick={() => { const s = getSession(); if (s) loadUserData(s); }} style={STYLES.btnRefresh}>
                🔄 Refresh
              </button>
            </div>
          </div>

          {errorMsg && <div style={STYLES.errorBox}>{errorMsg}</div>}

          {/* COMPACT FILTER & COUNTER */}
          <div style={STYLES.filterRow}>
            <input 
              type="text" 
              placeholder="🔍 Cari nama proyek, deskripsi, atau ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={STYLES.searchInput}
            />
            <div style={STYLES.counterBadge}>
              Menampilkan: <strong>{filteredProjects.length} dari {projects.length} Proyek</strong>
            </div>
          </div>

          {/* PROJECT LIST */}
          {loading ? (
            <div style={STYLES.stateBox}>
              <div style={STYLES.spinner} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Memuat daftar proyek...</div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={STYLES.stateBox}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📂</div>
              <h3 style={{ color: '#0f172a', margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
                {searchTerm ? 'Proyek Tidak Ditemukan' : 'Belum Ada Proyek AHP'}
              </h3>
              <p style={{ color: '#64748b', fontSize: 12.5, margin: '0 0 14px' }}>
                {searchTerm ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Mulai buat struktur hierarki keputusan baru sekarang.'}
              </p>
              {!searchTerm && (
                <button onClick={() => router.push('/buat-proyek/baru')} style={STYLES.btnNewProject}>
                  + Buat Proyek Pertama
                </button>
              )}
            </div>
          ) : (
            <div style={STYLES.projectGrid}>
              {filteredProjects.map((project, index) => {
                const projectId = project.project_id || project.id || `PRJ-${index + 1}`
                const projectName = project.namaProyek || project.nama_proyek || project.namaproyek || project.judul || 'Proyek Tanpa Nama'
                const description = project.deskripsi?.trim() || 'Tidak ada deskripsi proyek.'
                const status = String(project.status || 'Aktif')
                const metode = String(project.metode || 'AHP')
                const jumlahExpert = Number(project.jumlahExpert || project.jumlah_expert || 0)
                
                const countCriteria = parseItemCount(project.criteria || project.kriteria)
                const countAlternatif = parseItemCount(project.alternatif || project.alternatives)
                const countSubcriteria = parseItemCount(project.subcriteria_count || project.subkriteria_json || project.subkriteria || project.subcriteria)
                
                const hasSubkriteria = project.punyaSubkriteria === true || 
                                       project.punya_subkriteria === true || 
                                       countSubcriteria > 0
                
                const rawDate = project.createdAt || project.created_at || project.updatedAt || project.updated_at
                const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
                const isCompleted = status.toLowerCase() === 'selesai' || status.toLowerCase() === 'completed'

                return (
                  <div key={index} style={STYLES.card}>
                    
                    {/* Header Card */}
                    <div style={STYLES.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={STYLES.idTag}>#{projectId}</span>
                        <span style={STYLES.metodeBadge}>{metode.toUpperCase()}</span>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>📅 {formattedDate}</span>
                      </div>
                      <span style={isCompleted ? STYLES.statusCompleted : STYLES.statusActive}>
                        {status.toUpperCase()}
                      </span>
                    </div>

                    {/* Judul & Deskripsi */}
                    <h3 style={STYLES.cardTitle}>{projectName}</h3>
                    <p style={STYLES.cardDesc}>{description}</p>

                    {/* Metric Chips */}
                    <div style={STYLES.metricsRow}>
                      <div style={STYLES.metricChip}>
                        <span style={STYLES.metricLabel}>🎯 Kriteria</span>
                        <strong style={STYLES.metricVal}>{countCriteria}</strong>
                      </div>
                      <div style={STYLES.metricChip}>
                        <span style={STYLES.metricLabel}>🔀 Subkriteria</span>
                        <strong style={STYLES.metricVal}>
                          {hasSubkriteria && countSubcriteria > 0 ? countSubcriteria : '0'}
                        </strong>
                      </div>
                      <div style={STYLES.metricChip}>
                        <span style={STYLES.metricLabel}>📦 Alternatif</span>
                        <strong style={STYLES.metricVal}>{countAlternatif}</strong>
                      </div>
                      <div style={STYLES.metricChip}>
                        <span style={STYLES.metricLabel}>👥 Target Pakar</span>
                        <strong style={STYLES.metricVal}>{jumlahExpert}</strong>
                      </div>
                    </div>

                    {/* Footer Card */}
                    <div style={STYLES.cardFooter}>
                      <div style={{ fontSize: 11.5, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                        {(project.fasilitatorEmail || project.fasilitator_email) ? `✉️ ${project.fasilitatorEmail || project.fasilitator_email}` : '-'}
                      </div>
                      
                      <button 
                        onClick={() => router.push(`/proyek/kelola?id=${encodeURIComponent(projectId)}`)} 
                        style={STYLES.btnOpenProject}
                      >
                        📊 Kelola Analisis &amp; Matriks →
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function UserProjectsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 10, color: '#475569', background: '#f8fafc' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat halaman proyek...</div>
      </div>
    }>
      <UserProjectsContent />
    </Suspense>
  )
}

const STYLES: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', minHeight: '100vh', width: '100%', fontFamily: '"Inter", "Segoe UI", sans-serif', background: '#f8fafc' },
  main: { flex: 1, minHeight: '100vh', overflowX: 'hidden', padding: '18px 24px', boxSizing: 'border-box' },
  container: { maxWidth: 1020, margin: '0 auto' },

  topBarContainer: { 
    background: 'linear-gradient(270deg, #15803d 0%, rgba(255, 255, 255, 0.9) 100%)', 
    border: '1px solid #86efac', 
    borderRadius: 10, 
    padding: '14px 20px', 
    marginBottom: 16, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)' 
  },
  topBarBrand: { display: 'flex', alignItems: 'center', gap: 14 },
  topBarLogo: { height: 80, width: 'auto', objectFit: 'contain', opacity: 0.85, mixBlendMode: 'multiply' },
  topBarTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#064e3b', letterSpacing: '0.04em' },
  topBarSubtitle: { margin: '2px 0 0', fontSize: 11, color: '#065f46', fontWeight: 600 },

  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  academicPill: { display: 'inline-block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: 4, marginBottom: 2 },
  pageTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' },
  pageSubtitle: { margin: '2px 0 0', fontSize: 12.5, color: '#64748b' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  btnNewProject: { background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(37,99,235,0.2)' },
  btnRefresh: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 7, color: '#b91c1c', fontSize: 12, fontWeight: 600, marginBottom: 12 },

  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 240, padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', background: '#fff' },
  counterBadge: { background: '#e2e8f0', color: '#334155', padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 500 },

  stateBox: { background: '#fff', padding: '36px 20px', borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 28, height: 28, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 8 },

  projectGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  idTag: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 800, border: '1px solid #bfdbfe' },
  metodeBadge: { background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700, border: '1px solid #e2e8f0' },
  statusActive: { background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  statusCompleted: { background: '#e0e7ff', color: '#4338ca', padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  cardTitle: { margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 800 },
  cardDesc: { margin: 0, color: '#64748b', fontSize: 12.5, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },

  metricsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #f1f5f9' },
  metricChip: { display: 'flex', flexDirection: 'column', gap: 1 },
  metricLabel: { fontSize: 10.5, color: '#64748b', fontWeight: 600 },
  metricVal: { fontSize: 12.5, color: '#0f172a', fontWeight: 800 },

  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 },
  btnOpenProject: { background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }
}