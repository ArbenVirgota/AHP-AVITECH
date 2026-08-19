// app/admin/archives/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || ''

export default function AdminArchivesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [archives, setArchives] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchArchives()
  }, [])

  const fetchArchives = async () => {
    if (!GOOGLE_SCRIPT_URL) return
    try {
      setLoading(true)
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getarchivedprojects`, { cache: 'no-store' })
      const json = await res.json()
      setArchives(json.data || [])
    } catch (err: any) {
      console.error('Gagal mengambil data arsip:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (projectId: string) => {
    if (!confirm(`Apakah Anda yakin ingin memulihkan proyek #${projectId} kembali ke daftar aktif?`)) return

    try {
      setActionLoading(projectId)
      setNotification(null)

      const payload = new URLSearchParams()
      payload.append('action', 'restoreproject')
      payload.append('project_id', projectId)

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString()
      })

      const json = await res.json()
      if (json.success) {
        setNotification({ type: 'success', message: json.message || 'Proyek berhasil dipulihkan!' })
        fetchArchives() // Refresh data arsip
      } else {
        setNotification({ type: 'error', message: json.message || 'Gagal memulihkan proyek.' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Error: ${err.message}` })
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = archives.filter(item => {
    const term = searchTerm.toLowerCase()
    const name = String(item.nama_proyek || item.namaproyek || '').toLowerCase()
    const email = String(item.user_email || item.email || '').toLowerCase()
    const id = String(item.project_id || item.id || '').toLowerCase()
    return name.includes(term) || email.includes(term) || id.includes(term)
  })

  return (
    <div style={ARCHIVE_STYLES.page}>
      <div style={ARCHIVE_STYLES.container}>
        
        {/* HEADER */}
        <div style={ARCHIVE_STYLES.headerRow}>
          <div>
            <h2 style={ARCHIVE_STYLES.title}>📦 Pusat Arsip &amp; Cadangan Proyek</h2>
            <p style={ARCHIVE_STYLES.subtitle}>Daftar seluruh proyek kedaluwarsa yang telah dicadangkan secara otomatis.</p>
          </div>
          <button onClick={() => router.push('/dashboard')} style={ARCHIVE_STYLES.btnBack}>
            ← Kembali ke Dashboard
          </button>
        </div>

        {/* NOTIFIKASI */}
        {notification && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 16,
            background: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: notification.type === 'success' ? '#15803d' : '#b91c1c',
            border: notification.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca'
          }}>
            {notification.message}
          </div>
        )}

        {/* FILTER BAR */}
        <div style={ARCHIVE_STYLES.filterRow}>
          <input 
            type="text" 
            placeholder="🔍 Cari arsip berdasarkan nama proyek, email pemilik, atau ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={ARCHIVE_STYLES.searchInput}
          />
          <div style={ARCHIVE_STYLES.countBadge}>
            Total: <strong>{filtered.length} Proyek Terarsip</strong>
          </div>
        </div>

        {/* TABEL DATA */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            Memuat data arsip...
          </div>
        ) : filtered.length === 0 ? (
          <div style={ARCHIVE_STYLES.emptyBox}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗄️</div>
            <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Arsip Kosong</h4>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              {searchTerm ? 'Tidak ada data arsip yang cocok dengan pencarian.' : 'Belum ada proyek yang masuk masa kedaluwarsa/arsip.'}
            </p>
          </div>
        ) : (
          <div style={ARCHIVE_STYLES.tableWrapper}>
            <table style={ARCHIVE_STYLES.table}>
              <thead>
                <tr style={ARCHIVE_STYLES.thRow}>
                  <th style={ARCHIVE_STYLES.th}>ID Proyek</th>
                  <th style={ARCHIVE_STYLES.th}>Nama Proyek</th>
                  <th style={ARCHIVE_STYLES.th}>Pemilik (User Email)</th>
                  <th style={ARCHIVE_STYLES.th}>Tanggal Arsip</th>
                  <th style={ARCHIVE_STYLES.thCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => {
                  const pId = item.project_id || item.id || `PRJ-${index + 1}`
                  const pName = item.nama_proyek || item.namaproyek || 'Tanpa Nama'
                  const pEmail = item.user_email || item.email || '-'
                  const archivedAt = item.archived_at ? new Date(item.archived_at).toLocaleString('id-ID') : '-'

                  return (
                    <tr key={index} style={ARCHIVE_STYLES.tr}>
                      <td style={ARCHIVE_STYLES.td}>
                        <span style={ARCHIVE_STYLES.idBadge}>#{pId}</span>
                      </td>
                      <td style={ARCHIVE_STYLES.td}>
                        <strong>{pName}</strong>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>Metode: {item.metode || 'AHP'}</div>
                      </td>
                      <td style={ARCHIVE_STYLES.td}>{pEmail}</td>
                      <td style={ARCHIVE_STYLES.td}>{archivedAt}</td>
                      <td style={ARCHIVE_STYLES.tdCenter}>
                        <button 
                          onClick={() => handleRestore(pId)} 
                          disabled={actionLoading === pId}
                          style={ARCHIVE_STYLES.btnRestore}
                        >
                          {actionLoading === pId ? 'Memulihkan...' : '🔄 Pulihkan Proyek'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}

const ARCHIVE_STYLES: Record<string, React.CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', padding: '30px 20px', fontFamily: '"Inter", "Segoe UI", sans-serif' },
  container: { maxWidth: 1000, margin: '0 auto' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { margin: 0, color: '#0f172a', fontSize: 22, fontWeight: 800 },
  subtitle: { margin: '4px 0 0 0', color: '#64748b', fontSize: 13.5 },
  btnBack: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#334155' },
  
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 260, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', background: '#fff' },
  countBadge: { background: '#e2e8f0', color: '#334155', padding: '8px 14px', borderRadius: 8, fontSize: 13 },

  emptyBox: { background: '#fff', padding: '50px 20px', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' },
  tableWrapper: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 },
  thRow: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: 12.5 },
  thCenter: { padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: 12.5, textAlign: 'center' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px 16px', color: '#1e293b' },
  tdCenter: { padding: '14px 16px', textAlign: 'center' },
  idBadge: { background: '#f1f5f9', color: '#475569', padding: '3px 7px', borderRadius: 5, fontSize: 12, fontWeight: 700 },
  btnRestore: { background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
}