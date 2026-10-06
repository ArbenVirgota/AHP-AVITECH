// app/user/consultations/page.tsx

'use client'

import { useCallback, useEffect, useState, useMemo, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'

interface UserProfileData {
  nama: string
  institusi: string
  city: string
  digital_signature: string
  foto_profil?: string
}

interface ConsultationTicket {
  idTiket: string
  projectId?: string
  namaUser: string
  kontakUser: string
  expertTujuan: string
  topikPesan: string
  pertanyaan?: string
  status: string
  created_at?: string
  jawabanExpert?: string
  fileUrl?: string
}

function formatDate(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

function cleanTextValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).trim()
  if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return ''
  return s
}

// TOP HEADER RESMI AHP
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

function ConsultationsContent() {
  const router = useRouter()

  const [consultations, setConsultations] = useState<ConsultationTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sessionData, setSessionData] = useState<any>(null)

  // State Modal Konfirmasi Pembayaran
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentTicket, setPaymentTicket] = useState<ConsultationTicket | null>(null)
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // State Modal Balas Pesan Admin
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [replyTicket, setReplyTicket] = useState<ConsultationTicket | null>(null)
  const [replyMessage, setReplyMessage] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  const loadUserData = useCallback(async (session: any, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setErrorMsg('')

    try {
      const cleanEmail = String(session.email || '').trim().toLowerCase()
      setSessionData(session)

      const res = await fetch(`/api/consultations?email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`, { 
        cache: 'no-store' 
      })
      const consultJson = await res.json()

      if (consultJson?.success && Array.isArray(consultJson.data)) {
        const myTickets: ConsultationTicket[] = consultJson.data.map((item: any) => {
          const answer = cleanTextValue(
            item.jawaban_expert ?? 
            item.jawabanExpert ?? 
            item.jawaban ?? 
            item.balasan ?? 
            item.reply ?? 
            item.Isi_Email ?? 
            item.isi_email
          )

          return {
            idTiket: cleanTextValue(item.ticket_id || item.idTiket || item.id || item.ticketId || '-'),
            projectId: cleanTextValue(item.project_id || item.projectId || 'Umum'),
            namaUser: cleanTextValue(item.user_name || item.namaUser || session.nama || 'User'),
            kontakUser: cleanTextValue(item.user_email || item.kontakUser || session.email),
            expertTujuan: cleanTextValue(item.expert_tujuan || item.expertTujuan || item.expert_email || item.expert_id || 'Tim Administrator & Billing'),
            topikPesan: cleanTextValue(item.topik_pesan || item.topikPesan || item.asal_institusi || 'Koordinasi Aktivasi Paket'),
            pertanyaan: cleanTextValue(item.pertanyaan || item.topik_pesan || item.isi_email),
            status: cleanTextValue(item.status || 'open'),
            created_at: cleanTextValue(item.created_at || item.tanggal_dibuat),
            jawabanExpert: answer,
            fileUrl: cleanTextValue(item.lampiran || item.fileUrl || item.bukti_bayar)
          }
        })
        setConsultations(myTickets)

        // Tandai tiket yang memiliki jawaban menjadi sudah dibaca agar lencana merah sidebar bersih
        try {
          await fetch('/api/user/mark-consultations-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail }),
          })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('consultation-read-updated'))
          }
        } catch {}

      } else {
        setConsultations([])
      }
    } catch (err: any) {
      console.error('Gagal mengambil data konsultasi:', err)
      setErrorMsg(`Gagal memuat data konsultasi: ${err.message || err.toString()}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('⚠️ Harap unggah file gambar (JPG/PNG).')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 500

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        const compressed = canvas.toDataURL('image/jpeg', 0.5)
        setPaymentReceiptUrl(compressed)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentTicket || !paymentReceiptUrl) {
      alert('Harap pilih/unggah gambar bukti transfer terlebih dahulu.')
      return
    }

    try {
      setSubmittingPayment(true)

      const payload = {
        ticket_id: paymentTicket.idTiket,
        lampiran: paymentReceiptUrl,
        user_email: sessionData?.email,
        user_name: sessionData?.nama || 'User',
      }

      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const rawText = await res.text().catch(() => '')
      let json: any = {}
      try {
        json = rawText ? JSON.parse(rawText) : {}
      } catch {
        json = { success: res.ok }
      }

      if (res.ok && (json.success || json.success === undefined)) {
        alert('✅ Bukti pembayaran berhasil diunggah! Status tiket kini beralih ke "Sedang Diverifikasi".')
        setShowPaymentModal(false)
        setPaymentReceiptUrl('')
        const s = getSession()
        if (s) loadUserData(s, true)
      } else {
        alert('Gagal mengunggah bukti: ' + (json?.message || `Server merespons status ${res.status}`))
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyTicket || !replyMessage.trim()) {
      alert('Harap tuliskan pesan balasan Anda.')
      return
    }
    try {
      setSubmittingReply(true)
      const s = getSession()
      const payload = {
        expert_id: 'ADMIN-PRICING',
        expert_email: 'admin@avitech.cloud',
        ticket_id: replyTicket.idTiket,
        user_email: s?.email || sessionData?.email,
        user_name: s?.nama || 'User',
        pertanyaan: `[Tanggapan Tiket #${replyTicket.idTiket}] ${replyMessage.trim()}`,
      }

      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const rawText = await res.text().catch(() => '')
      let json: any = {}
      try {
        json = rawText ? JSON.parse(rawText) : {}
      } catch {
        json = { success: res.ok }
      }

      if (json.success !== false) {
        alert('✅ Pesan balasan berhasil dikirim ke Admin!')
        setShowReplyModal(false)
        setReplyMessage('')
        if (s) loadUserData(s, true)
      } else {
        alert('Gagal mengirim balasan: ' + (json?.message || 'Terjadi kesalahan.'))
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
    } finally {
      setSubmittingReply(false)
    }
  }

  const filteredTickets = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    return consultations.filter((t) => {
      const matchSearch =
        !q ||
        t.idTiket.toLowerCase().includes(q) ||
        t.expertTujuan.toLowerCase().includes(q) ||
        t.topikPesan.toLowerCase().includes(q) ||
        (t.pertanyaan && t.pertanyaan.toLowerCase().includes(q)) ||
        (t.jawabanExpert && t.jawabanExpert.toLowerCase().includes(q))

      const matchStatus =
        statusFilter === 'ALL' ||
        t.status.toLowerCase() === statusFilter.toLowerCase() ||
        (statusFilter === 'Menunggu' && (t.status.toLowerCase() === 'open' || t.status.toLowerCase() === 'menunggu'))

      return matchSearch && matchStatus
    })
  }, [consultations, searchTerm, statusFilter])

  return (
    <div style={STYLES.wrapper}>
      {/* MAIN WORKSPACE */}
      <main style={STYLES.main}>
        <div style={STYLES.container}>
          
          <AppTopBar />

          <div style={STYLES.pageHeader}>
            <div>
              <div style={STYLES.academicPill}>Pusat Komunikasi</div>
              <h1 style={STYLES.pageTitle}>💬 Pusat Tiket &amp; Konsultasi Saya</h1>
              <p style={STYLES.pageSubtitle}>Riwayat diskusi riset bersama evaluator pakar serta tiket koordinasi aktivasi lisensi administrator.</p>
            </div>

            <div style={STYLES.headerActions}>
              <button onClick={() => router.push('/expert-directory')} style={STYLES.btnNewConsult}>
                + Ajukan Konsultasi Baru
              </button>
              <button onClick={() => { const s = getSession(); if (s) loadUserData(s, true); }} style={STYLES.btnRefresh}>
                {refreshing ? 'Memuat...' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          {errorMsg && <div style={STYLES.errorBox}>{errorMsg}</div>}

          <div style={STYLES.filterRow}>
            <input
              type="text"
              placeholder="🔍 Cari tiket ID, jawaban admin, status, atau topik..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={STYLES.searchInput}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={STYLES.selectFilter}
            >
              <option value="ALL">Semua Status</option>
              <option value="Menunggu">⏳ Menunggu</option>
              <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
              <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
              <option value="Selesai">✅ Selesai</option>
              <option value="Ditolak">❌ Ditolak</option>
            </select>

            <div style={STYLES.counterBadge}>
              Total: <strong>{filteredTickets.length} Tiket</strong>
            </div>
          </div>

          {loading ? (
            <div style={STYLES.stateBox}>
              <div style={STYLES.spinner} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Memuat daftar tiket konsultasi...</div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={STYLES.stateBox}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>💬</div>
              <h3 style={{ color: '#0f172a', margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
                {searchTerm ? 'Tiket Tidak Ditemukan' : 'Belum Ada Pengajuan Konsultasi'}
              </h3>
              <p style={{ color: '#64748b', fontSize: 12.5, margin: '0 0 14px' }}>
                {searchTerm ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Kunjungi Direktori Pakar untuk mengirimkan pertanyaan riset resmi atau klik upgrade paket untuk menghubungi admin.'}
              </p>
              {!searchTerm && (
                <button onClick={() => router.push('/expert-directory')} style={STYLES.btnNewConsult}>
                  Cari Pakar di Direktori →
                </button>
              )}
            </div>
          ) : (
            <div style={STYLES.ticketGrid}>
              {filteredTickets.map((ticket, idx) => {
                const statusLower = (ticket.status || '').toLowerCase()
                const tujuanLower = (ticket.expertTujuan || '').toLowerCase()
                const topikLower = (ticket.topikPesan || '').toLowerCase()
                const idLower = (ticket.idTiket || '').toLowerCase()
                const jawabanLower = (ticket.jawabanExpert || '').toLowerCase()

                const isBillingOrAdmin = 
                  tujuanLower.includes('layanan') || 
                  tujuanLower.includes('admin') || 
                  topikLower.includes('plan') || 
                  idLower.includes('pricing-sup')

                const hasPaymentInstruction = 
                  jawabanLower.includes('transfer') || 
                  jawabanLower.includes('pembayaran') || 
                  jawabanLower.includes('rekening') || 
                  jawabanLower.includes('bank') ||
                  jawabanLower.includes('mandiri') ||
                  jawabanLower.includes('bca') ||
                  jawabanLower.includes('nominal')

                const isSelesai = statusLower.includes('selesai')
                const isVerifying = statusLower.includes('verifikasi')

                return (
                  <div key={idx} style={STYLES.card}>
                    
                    <div style={STYLES.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={STYLES.idTag}>#{ticket.idTiket}</span>
                        <span style={isBillingOrAdmin ? STYLES.categoryAdminBadge : STYLES.categoryExpertBadge}>
                          {isBillingOrAdmin ? '🛡️ Admin Support' : '🎓 Evaluator Pakar'}
                        </span>
                        <span style={{ fontSize: 11.5, color: '#64748b' }}>📅 {formatDate(ticket.created_at)}</span>
                      </div>

                      <span style={{
                        ...STYLES.statusBadge,
                        background: isSelesai ? '#dcfce7' : isVerifying ? '#e0e7ff' : '#fef9c3',
                        color: isSelesai ? '#15803d' : isVerifying ? '#3730a3' : '#854d0e',
                      }}>
                        {ticket.status === 'open' ? 'Menunggu' : ticket.status}
                      </span>
                    </div>

                    <div style={STYLES.metaRow}>
                      <span><strong>Tujuan:</strong> {isBillingOrAdmin ? 'Tim Layanan & Billing Administrator' : ticket.expertTujuan}</span>
                      <span>•</span>
                      <span><strong>ID Proyek:</strong> {ticket.projectId || 'Umum'}</span>
                    </div>

                    <div style={STYLES.questionBox}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', marginBottom: 2 }}>
                        Topik &amp; Pesan Anda:
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                        &quot;{ticket.topikPesan}&quot;
                      </div>
                      {ticket.pertanyaan && (
                        <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                          {ticket.pertanyaan}
                        </p>
                      )}
                    </div>

                    {/* TAMPILAN RESMI JAWABAN ADMINISTRATOR / PAKAR */}
                    {ticket.jawabanExpert ? (
                      <div style={STYLES.responseBox}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          💬 Tanggapan / Balasan dari {isBillingOrAdmin ? 'Administrator' : ticket.expertTujuan}:
                        </div>
                        <div style={{ margin: 0, fontSize: 13, color: '#14532d', lineHeight: 1.55, whiteSpace: 'pre-line', fontFamily: 'inherit' }}>
                          {ticket.jawabanExpert}
                        </div>

                        {ticket.fileUrl && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #bbf7d0' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', display: 'block', marginBottom: 6 }}>
                              📎 Bukti Transfer Terlampir:
                            </span>
                            <a href={ticket.fileUrl} target="_blank" rel="noreferrer">
                              <img src={ticket.fileUrl} alt="Lampiran Bukti" style={{ maxHeight: 110, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                        ⏳ Belum ada tanggapan dari {isBillingOrAdmin ? 'Administrator' : 'Pakar'}. Silakan cek kembali secara berkala.
                      </div>
                    )}

                    <div style={STYLES.cardFooter}>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        Pengirim: <strong>{ticket.namaUser}</strong> ({ticket.kontakUser})
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {isBillingOrAdmin && (
                          <>
                            {hasPaymentInstruction ? (
                              <button
                                onClick={() => {
                                  setPaymentTicket(ticket)
                                  setPaymentReceiptUrl(ticket.fileUrl || '')
                                  setShowPaymentModal(true)
                                }}
                                style={STYLES.btnPaymentConfirm}
                              >
                                💸 {ticket.fileUrl ? 'Perbarui Bukti Bayar' : 'Konfirmasi Telah Bayar (Upload Bukti)'}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setReplyTicket(ticket)
                                  setReplyMessage('')
                                  setShowReplyModal(true)
                                }}
                                style={STYLES.btnReplyAdmin}
                              >
                                💬 Balas Pesan Admin
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          )}

        </div>

        {/* MODAL BALAS PESAN ADMIN */}
        {showReplyModal && replyTicket && (
          <div style={modalStyles.overlay} onClick={() => setShowReplyModal(false)}>
            <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  💬 Balas Pesan Admin: #{replyTicket.idTiket}
                </h3>
                <button onClick={() => setShowReplyModal(false)} style={modalStyles.closeBtn}>✕</button>
              </div>

              <div style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.4 }}>
                  Kirimkan pesan lanjutan kepada <strong>Tim Layanan &amp; Billing Administrator</strong> terkait tiket &quot;{replyTicket.topikPesan}&quot;.
                </p>

                <form onSubmit={handleSubmitReply} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={modalStyles.label}>Pesan Balasan Anda *</label>
                    <textarea
                      rows={4}
                      placeholder="Tuliskan tanggapan atau pertanyaan Anda kepada admin di sini..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    <button type="button" onClick={() => setShowReplyModal(false)} style={modalStyles.btnCancel}>
                      Batal
                    </button>
                    <button type="submit" disabled={submittingReply} style={modalStyles.btnSave}>
                      {submittingReply ? 'Mengirim...' : 'Kirim Balasan →'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL UPLOAD BUKTI TRANSFER */}
        {showPaymentModal && paymentTicket && (
          <div style={modalStyles.overlay} onClick={() => setShowPaymentModal(false)}>
            <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  💸 Konfirmasi Pembayaran &amp; Upload Bukti
                </h3>
                <button onClick={() => setShowPaymentModal(false)} style={modalStyles.closeBtn}>✕</button>
              </div>

              <div style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.4 }}>
                  Unggah foto struk/bukti transfer bank Anda untuk tiket <strong>#{paymentTicket.idTiket}</strong>. Tim admin akan memverifikasi transaksi Anda.
                </p>

                <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={modalStyles.label}>Pilih File Bukti Transfer (JPG/PNG) *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      style={{ fontSize: 11.5, marginBottom: 6, cursor: 'pointer' }}
                      required={!paymentReceiptUrl}
                    />

                    <div style={modalStyles.previewBox}>
                      {paymentReceiptUrl ? (
                        <img src={paymentReceiptUrl} alt="Pratinjau Struk" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                          Belum ada gambar bukti transfer yang dipilih
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    <button type="button" onClick={() => setShowPaymentModal(false)} style={modalStyles.btnCancel}>
                      Batal
                    </button>
                    <button type="submit" disabled={submittingPayment} style={modalStyles.btnSave}>
                      {submittingPayment ? 'Mengunggah...' : 'Kirim Bukti Pembayaran →'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function UserConsultationsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 10, color: '#475569', background: '#f8fafc' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat tiket konsultasi...</div>
      </div>
    }>
      <ConsultationsContent />
    </Suspense>
  )
}

// MODAL & SHARED STYLES
const modalStyles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
    backdropFilter: 'blur(2px)'
  },
  modal: {
    background: '#ffffff',
    borderRadius: 14,
    maxWidth: 520,
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#64748b',
    padding: 0,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 12.5,
    borderRadius: 7,
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
  },
  previewBox: {
    height: 70,
    border: '1px dashed #cbd5e1',
    borderRadius: 7,
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnCancel: {
    flex: 1,
    padding: '8px 12px',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 600,
    color: '#475569',
    fontSize: 12.5,
  },
  btnSave: {
    flex: 1,
    padding: '8px 12px',
    background: '#2563eb',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
    color: '#ffffff',
    fontSize: 12.5,
  },
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
  btnNewConsult: { background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(37,99,235,0.2)' },
  btnRefresh: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 7, color: '#b91c1c', fontSize: 12, fontWeight: 600, marginBottom: 12 },

  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 240, padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', background: '#fff' },
  selectFilter: { padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, outline: 'none', background: '#fff' },
  counterBadge: { background: '#e2e8f0', color: '#334155', padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 500 },

  stateBox: { background: '#fff', padding: '36px 20px', borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 28, height: 28, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 8 },

  ticketGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  idTag: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 800, border: '1px solid #bfdbfe' },
  categoryAdminBadge: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  categoryExpertBadge: { background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  statusBadge: { padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  metaRow: { display: 'flex', gap: 8, fontSize: 11.5, color: '#475569', flexWrap: 'wrap' },

  questionBox: { background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #f1f5f9' },
  responseBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' },

  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 },
  btnReplyAdmin: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(2,132,199,0.2)' },
  btnPaymentConfirm: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' }
};