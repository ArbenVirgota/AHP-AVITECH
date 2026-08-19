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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchArchives()
  }, [])

  const fetchArchives = async () => {
    if (!GOOGLE_SCRIPT_URL) return
    try {
      setLoading(true)
      setSelectedIds([])
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getarchivedprojects&_t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setArchives(json.data || [])
    } catch (err: any) {
      console.error('Gagal mengambil data arsip:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = archives.filter(item => {
    const term = searchTerm.toLowerCase()
    const name = String(item.nama_proyek || item.namaproyek || '').toLowerCase()
    const email = String(item.user_email || item.email || item.fasilitator_email || item.fasilitatoremail || '').toLowerCase()
    const id = String(item.project_id || item.projectid || item.id || '').toLowerCase()
    return name.includes(term) || email.includes(term) || id.includes(term)
  })

  // --- LOGIKA MULTI-SELECT ---
  const isAllSelected = filtered.length > 0 && selectedIds.length === filtered.length

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      const allIds = filtered.map(item => String(item.project_id || item.projectid || item.id))
      setSelectedIds(allIds)
    }
  }

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // --- AKSI RESTORE (SINGLE & BULK) ---
  const executeRestore = async (ids: string[]) => {
    if (ids.length === 0) return
    const msg = ids.length === 1 
      ? `Pulihkan proyek #${ids[0]} kembali ke daftar aktif?` 
      : `Pulihkan ${ids.length} proyek terpilih kembali ke daftar aktif?`
    if (!confirm(msg)) return

    try {
      setActionLoading('bulk_restore')
      setNotification(null)

      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=restoreproject`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'restoreproject',
          project_ids: ids
        })
      })

      const json = await res.json()
      if (json.success !== false) {
        setNotification({ type: 'success', message: json.message || 'Proyek berhasil dipulihkan!' })
        fetchArchives()
      } else {
        setNotification({ type: 'error', message: json.message || 'Gagal memulihkan proyek.' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Error: ${err.message}` })
    } finally {
      setActionLoading(null)
    }
  }

  // --- AKSI HARD DELETE (SINGLE & BULK) ---
  const executeHardDelete = async (ids: string[]) => {
    if (ids.length === 0) return
    const warningMsg = ids.length === 1
      ? `⚠️ PERINGATAN KERAS: Data proyek #${ids[0]} akan DIMUSNAHKAN TOTAL dari arsip.\n\nKetik "HAPUS" untuk konfirmasi:`
      : `⚠️ PERINGATAN KERAS: ${ids.length} data proyek terpilih akan DIMUSNAHKAN TOTAL dari arsip.\n\nKetik "HAPUS" untuk konfirmasi:`

    const confirmation = prompt(warningMsg)
    if (confirmation !== 'HAPUS') {
      if (confirmation !== null) alert('Konfirmasi dibatalkan (kata kunci tidak cocok).')
      return
    }

    try {
      setActionLoading('bulk_delete')
      setNotification(null)

      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deletearchivedprojectpermanently`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deletearchivedprojectpermanently',
          project_ids: ids
        })
      })

      const json = await res.json()
      if (json.success !== false) {
        setNotification({ type: 'success', message: json.message || 'Proyek berhasil dimusnahkan secara permanen.' })
        fetchArchives()
      } else {
        setNotification({ type: 'error', message: json.message || 'Gagal memusnahkan proyek.' })
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Error: ${err.message}` })
    } finally {
      setActionLoading(null)
    }
  }

  // --- FUNGSI UNDUH (CSV / JSON) ---
  const handleDownloadCSV = (selectedOnly: boolean = false) => {
    const dataToExport = selectedOnly 
      ? filtered.filter(item => selectedIds.includes(String(item.project_id || item.projectid || item.id)))
      : filtered

    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diunduh.')
      return
    }

    const headers = ['ID Proyek', 'Nama Proyek', 'Metode', 'Email Fasilitator', 'Tanggal Arsip', 'Status']
    const rows = dataToExport.map(item => [
      `"${item.project_id || item.projectid || item.id || ''}"`,
      `"${(item.nama_proyek || item.namaproyek || '').replace(/"/g, '""')}"`,
      `"${item.metode || 'AHP'}"`,
      `"${item.fasilitator_email || item.fasilitatoremail || item.user_email || item.email || ''}"`,
      `"${item.archived_at || ''}"`,
      `"TERARSIP"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Arsip_Proyek_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadJSON = (singleItem?: any) => {
    let dataToExport = singleItem
      ? [singleItem]
      : (selectedIds.length > 0 
          ? filtered.filter(item => selectedIds.includes(String(item.project_id || item.projectid || item.id)))
          : filtered)

    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk diunduh.')
      return
    }

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`
    const link = document.createElement('a')
    link.setAttribute('href', jsonString)
    link.setAttribute('download', singleItem 
      ? `Backup_Proyek_${singleItem.project_id || singleItem.id}_${new Date().toISOString().slice(0,10)}.json`
      : `Backup_Arsip_Semua_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={ARCHIVE_STYLES.page}>
      <div style={ARCHIVE_STYLES.container}>
        
        {/* HEADER */}
        <div style={ARCHIVE_STYLES.headerRow}>
          <div>
            <h2 style={ARCHIVE_STYLES.title}>📦 Repositori Proyek Terarsip</h2>
            <p style={ARCHIVE_STYLES.subtitle}>Kelola pemulihan massal, pemusnahan total, dan ekspor arsip cadangan.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/admin/super-control')} style={ARCHIVE_STYLES.btnBack}>
              ⚙️ Kebijakan Retensi
            </button>
            <button onClick={() => router.push('/admin/dashboard')} style={ARCHIVE_STYLES.btnBack}>
              ← Dashboard Operasional
            </button>
          </div>
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

        {/* TOOLBAR ATAS: PENCARIAN & EXPORT GLOBAL */}
        <div style={ARCHIVE_STYLES.filterRow}>
          <input 
            type="text" 
            placeholder="🔍 Cari nama proyek, email, atau ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={ARCHIVE_STYLES.searchInput}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => handleDownloadCSV(false)} style={ARCHIVE_STYLES.btnExport}>
              📥 Unduh CSV
            </button>
            <button onClick={() => handleDownloadJSON()} style={ARCHIVE_STYLES.btnExport}>
              📥 Unduh JSON
            </button>
            <button onClick={fetchArchives} style={ARCHIVE_STYLES.btnRefresh}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* FLOATING ACTION BAR SAAT ITEM DIPILIH */}
        {selectedIds.length > 0 && (
          <div style={ARCHIVE_STYLES.bulkActionBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={ARCHIVE_STYLES.bulkCountBadge}>
                {selectedIds.length} Terpilih
              </span>
              <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                Aksi Massal:
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button 
                onClick={() => executeRestore(selectedIds)}
                disabled={actionLoading === 'bulk_restore'}
                style={ARCHIVE_STYLES.btnBulkRestore}
              >
                {actionLoading === 'bulk_restore' ? 'Memproses...' : `♻️ Pulihkan Terpilih (${selectedIds.length})`}
              </button>
              <button 
                onClick={() => executeHardDelete(selectedIds)}
                disabled={actionLoading === 'bulk_delete'}
                style={ARCHIVE_STYLES.btnBulkDelete}
              >
                {actionLoading === 'bulk_delete' ? 'Memproses...' : `🗑️ Hapus Permanen (${selectedIds.length})`}
              </button>
              <button 
                onClick={() => handleDownloadCSV(true)}
                style={ARCHIVE_STYLES.btnBulkExport}
              >
                📥 Unduh Terpilih (CSV)
              </button>
            </div>
          </div>
        )}

        {/* TABEL DATA ARSIP */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            Memuat data arsip...
          </div>
        ) : filtered.length === 0 ? (
          <div style={ARCHIVE_STYLES.emptyBox}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗄️</div>
            <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Arsip Kosong</h4>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              {searchTerm ? 'Tidak ada data arsip yang cocok dengan kata kunci pencarian.' : 'Belum ada proyek yang kedaluwarsa.'}
            </p>
          </div>
        ) : (
          <div style={ARCHIVE_STYLES.tableWrapper}>
            <table style={ARCHIVE_STYLES.table}>
              <thead>
                <tr style={ARCHIVE_STYLES.thRow}>
                  <th style={{ ...ARCHIVE_STYLES.th, width: 40, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={isAllSelected} 
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                      title="Pilih Semua"
                    />
                  </th>
                  <th style={ARCHIVE_STYLES.th}>ID Proyek</th>
                  <th style={ARCHIVE_STYLES.th}>Nama Proyek</th>
                  <th style={ARCHIVE_STYLES.th}>Fasilitator / Pemilik</th>
                  <th style={ARCHIVE_STYLES.th}>Tanggal Arsip</th>
                  <th style={ARCHIVE_STYLES.thCenter}>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => {
                  const pId = String(item.project_id || item.projectid || item.id || `PRJ-${index + 1}`)
                  const pName = item.nama_proyek || item.namaproyek || 'Tanpa Nama'
                  const pEmail = item.fasilitator_email || item.fasilitatoremail || item.user_email || item.email || '-'
                  const archivedAt = item.archived_at ? new Date(item.archived_at).toLocaleString('id-ID') : '-'
                  const isSelected = selectedIds.includes(pId)
                  const isBusy = actionLoading === pId

                  return (
                    <tr key={index} style={{ ...ARCHIVE_STYLES.tr, background: isSelected ? '#f0fdf4' : '#fff' }}>
                      <td style={{ ...ARCHIVE_STYLES.td, textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleToggleSelectRow(pId)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
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
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button 
                            onClick={() => executeRestore([pId])} 
                            disabled={isBusy}
                            style={ARCHIVE_STYLES.btnRestore}
                            title="Pulihkan proyek ini ke daftar aktif"
                          >
                            {isBusy ? '...' : '♻️ Restore'}
                          </button>
                          <button 
                            onClick={() => executeHardDelete([pId])} 
                            disabled={isBusy}
                            style={ARCHIVE_STYLES.btnDelete}
                            title="Musnahkan total data proyek ini"
                          >
                            {isBusy ? '...' : '🗑️ Hapus'}
                          </button>
                          <button 
                            onClick={() => handleDownloadJSON(item)} 
                            style={ARCHIVE_STYLES.btnDownloadRow}
                            title="Unduh data cadangan JSON proyek ini"
                          >
                            📥
                          </button>
                        </div>
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
  page: { background: '#f8fafc', minHeight: '100vh', padding: '24px 20px', fontFamily: '"Inter", "Segoe UI", sans-serif' },
  container: { maxWidth: 1060, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 12 },
  title: { margin: 0, color: '#0f172a', fontSize: 22, fontWeight: 800 },
  subtitle: { margin: '3px 0 0 0', color: '#64748b', fontSize: 13 },
  btnBack: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12.5, color: '#334155' },
  
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 260, padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', background: '#fff' },
  btnExport: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#0f172a' },
  btnRefresh: { background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#334155' },

  bulkActionBar: { background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, boxShadow: '0 2px 6px rgba(37,99,235,0.08)' },
  bulkCountBadge: { background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 },
  btnBulkRestore: { background: '#10b981', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  btnBulkDelete: { background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' },
  btnBulkExport: { background: '#fff', color: '#1e3a8a', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },

  emptyBox: { background: '#fff', padding: '50px 20px', borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' },
  tableWrapper: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 },
  thRow: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 12 },
  thCenter: { padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 12, textAlign: 'center' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' },
  td: { padding: '12px 14px', color: '#1e293b', verticalAlign: 'middle' },
  tdCenter: { padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' },
  idBadge: { background: '#eff6ff', color: '#1d4ed8', padding: '3px 7px', borderRadius: 5, fontSize: 11.5, fontWeight: 700, border: '1px solid #bfdbfe' },
  btnRestore: { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '5px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },
  btnDelete: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '5px 10px', borderRadius: 5, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' },
  btnDownloadRow: { background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '5px 8px', borderRadius: 5, fontSize: 11.5, cursor: 'pointer' }
}