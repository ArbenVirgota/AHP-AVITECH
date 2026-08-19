// app/user/consultations/page.tsx

'use client'

import { useCallback, useEffect, useState, useMemo, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearSession, getSession } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

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

interface RawConsultation {
  idTiket?: string
  id_tiket?: string
  ticket_id?: string
  id?: string
  projectId?: string
  project_id?: string
  id_proyek?: string
  namaUser?: string
  nama_user?: string
  user_name?: string
  userEmail?: string
  user_email?: string
  kontakUser?: string
  kontak_user?: string
  user_contact?: string
  expertTujuan?: string
  expert_tujuan?: string
  expert_name?: string
  topikPesan?: string
  topik_pesan?: string
  topik_penelitian?: string
  topic?: string
  pertanyaan?: string
  pesan?: string
  status?: string
  created_at?: string
  tanggalDibuat?: string
  timestamp?: string
  jawabanExpert?: string
  jawaban_expert?: string
  expertResponse?: string
  balasanExpert?: string
  fileUrl?: string
  file_url?: string
  lampiran?: string
}

async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } catch {
    return null
  }
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

// 🟢 MODAL PROFIL & PENGESAHAN
function ProfileModal({
  user,
  profile,
  onClose,
  onSaveSuccess,
}: {
  user: any
  profile: UserProfileData
  onClose: () => void
  onSaveSuccess: (updated: UserProfileData) => void
}) {
  const [formData, setFormData] = useState<UserProfileData>({
    nama: profile.nama || user?.nama || '',
    institusi: profile.institusi || '',
    city: profile.city || '',
    digital_signature: profile.digital_signature || '',
    foto_profil: profile.foto_profil || '',
  })
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [previewSig, setPreviewSig] = useState(profile.digital_signature || '')
  const [previewFoto, setPreviewFoto] = useState(profile.foto_profil || '')

  const handleFotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar (JPG/PNG).')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setPreviewFoto(base64)
        setFormData((prev) => ({ ...prev, foto_profil: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar tanda tangan (PNG/JPG).')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setPreviewSig(base64)
        setFormData((prev) => ({ ...prev, digital_signature: base64 }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')

    try {
      const payload = {
        action: 'updateuserprofile',
        email: user.email,
        user_id: user.id || '',
        nama: formData.nama,
        institusi: formData.institusi,
        city: formData.city,
        digital_signature: formData.digital_signature || '',
        foto_profil: formData.foto_profil || '',
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      })

      const result = await response.json()

      if (result.success) {
        onSaveSuccess({ 
          ...formData, 
          digital_signature: formData.digital_signature || '',
          foto_profil: formData.foto_profil || '' 
        })
        alert('✅ ' + result.message)
        onClose()
      } else {
        alert('❌ Gagal dari Server: ' + result.message)
        setErrorMsg(result.message)
      }
    } catch (err: any) {
      setErrorMsg('Gagal menyambung ke server: ' + err.toString())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div 
        style={{ 
          ...modalStyles.modal, 
          maxWidth: 520, 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          padding: '24px 28px'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', margin: 0 }}>⚙️ Pengaturan Profil &amp; Pengesahan</h2>
          <button onClick={onClose} style={modalStyles.closeBtn} type="button">✕</button>
        </div>

        <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
          Lengkapi identitas, foto profil, dan tanda tangan digital untuk pengesahan kuesioner &amp; sertifikat.
        </p>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
            {errorMsg}
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 11, 
            overflowY: 'auto', 
            paddingRight: 4,
            flexGrow: 1,
            marginBottom: 12
          }}
        >
          <div>
            <label style={modalStyles.label}>Nama Lengkap &amp; Gelar *</label>
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Dr. Arben Virgota, S.Pi., M.Si"
              style={modalStyles.input}
            />
          </div>

          <div>
            <label style={modalStyles.label}>Nama Institusi / Afiliasi *</label>
            <input
              type="text"
              required
              value={formData.institusi}
              onChange={(e) => setFormData({ ...formData, institusi: e.target.value })}
              placeholder="Contoh: Universitas Mataram"
              style={modalStyles.input}
            />
          </div>

          <div>
            <label style={modalStyles.label}>Kota *</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Contoh: Mataram"
              style={modalStyles.input}
            />
          </div>

          <div>
            <label style={modalStyles.label}>Foto Profil (Upload File Gambar)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={modalStyles.previewBox}>
              {previewFoto ? (
                <img 
                  src={previewFoto} 
                  alt="Foto Profil" 
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada foto</span>
              )}
            </div>
          </div>

          <div>
            <label style={modalStyles.label}>Tanda Tangan Digital (.png Transparan)</label>
            <input
              type="file"
              accept="image/*"
              required={!previewSig}
              onChange={handleSigFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={modalStyles.previewBox}>
              {previewSig ? (
                <img 
                  src={previewSig} 
                  alt="Tanda Tangan" 
                  style={{ maxHeight: 40, objectFit: 'contain' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>Belum ada tanda tangan</span>
              )}
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onClose} style={modalStyles.btnCancel} type="button">Batal</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={modalStyles.btnSave}
          >
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 🟢 TOP HEADER RESMI AHP (PERSIS DASHBOARD UTAMA)[cite: 5]
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
  const pathname = usePathname()

  const [consultations, setConsultations] = useState<ConsultationTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)

  // State Profil & Status Plan[cite: 5]
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    nama: '',
    institusi: '',
    city: '',
    digital_signature: '',
    foto_profil: '',
  })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [userPlan, setUserPlan] = useState('free')
  const [avatarError, setAvatarError] = useState(false)

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

  const isProfileComplete = useMemo(() => {
    return Boolean(
      userProfile.nama?.trim() &&
      userProfile.institusi?.trim() &&
      userProfile.city?.trim() &&
      userProfile.digital_signature?.trim()
    )
  }, [userProfile])

  const loadUserData = useCallback(async (session: any, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setErrorMsg('')

    try {
      const cleanEmail = String(session.email || '').trim().toLowerCase()
      setSessionData(session)

      const [consultJson, profileJson, subJson] = await Promise.all([
        safeFetchJson(`${API_URL}?action=getconsultationrequests&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getuserprofile&email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(session.id || '')}&_t=${Date.now()}`),
        safeFetchJson(`${API_URL}?action=getusersubscription&email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(session.id || '')}&_t=${Date.now()}`)
      ])

      // 1. Tiket Konsultasi
      if (consultJson && consultJson.success && Array.isArray(consultJson.data)) {
        const myTickets: ConsultationTicket[] = (consultJson.data as RawConsultation[])
          .filter((item: RawConsultation) => {
            const itemEmail = String(
              item.user_email || 
              item.userEmail || 
              item.kontakUser || 
              item.kontak_user || 
              item.user_contact || 
              ''
            ).toLowerCase().trim()

            if (cleanEmail.includes('admin') || cleanEmail === 'admin@ahp.avitech.cloud') {
              return true
            }
            return itemEmail === cleanEmail || (itemEmail && cleanEmail.includes(itemEmail))
          })
          .map((item: RawConsultation) => ({
            idTiket: String(item.idTiket || item.id_tiket || item.ticket_id || item.id || '-'),
            projectId: String(item.projectId || item.project_id || item.id_proyek || 'Umum'),
            namaUser: String(item.namaUser || item.nama_user || item.user_name || 'User'),
            kontakUser: String(item.kontakUser || item.user_email || item.userEmail || item.kontak_user || session.email),
            expertTujuan: String(item.expertTujuan || item.expert_tujuan || item.expert_name || 'Expert'),
            topikPesan: String(item.topikPesan || item.topik_penelitian || item.topik_pesan || item.topic || '-'),
            pertanyaan: String(item.pertanyaan || item.pesan || ''),
            status: String(item.status || 'Menunggu'),
            created_at: String(item.created_at || item.tanggalDibuat || item.timestamp || ''),
            jawabanExpert: String(item.jawabanExpert || item.jawaban_expert || item.expertResponse || item.balasanExpert || ''),
            fileUrl: String(item.fileUrl || item.file_url || item.lampiran || '')
          }))

        setConsultations(myTickets)
      } else {
        setConsultations([])
      }

      // 2. Profil
      if (profileJson && profileJson.data) {
        setUserProfile({
          nama: profileJson.data.nama || session.nama || '',
          institusi: profileJson.data.institusi || '',
          city: profileJson.data.city || profileJson.data.kota || '',
          digital_signature: profileJson.data.digital_signature || profileJson.data.tandatangan || '',
          foto_profil: profileJson.data.foto_profil || profileJson.data.fotoprofil || '',
        })
      } else {
        setUserProfile(prev => ({ ...prev, nama: session.nama || '' }))
      }

      // 3. Plan
      if (subJson) {
        const rawPlan = subJson.data?.plan || subJson.plan || (Array.isArray(subJson.data) ? subJson.data[0]?.plan : '')
        if (rawPlan) setUserPlan(String(rawPlan).toLowerCase().trim())
      }

    } catch (err: any) {
      console.error('Gagal mengambil data konsultasi & profil:', err)
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
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 450

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

        if (compressed.length > 50000) {
          alert('⚠️ Gambar masih terlalu besar. Harap gunakan gambar yang lebih kecil/di-crop.')
          e.target.value = ''
          return
        }

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
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'submitpaymentreceipt',
          ticket_id: paymentTicket.idTiket,
          file_url: paymentReceiptUrl
        }),
        redirect: 'follow'
      })
      const json = await res.json()
      if (json.success) {
        alert('✅ Bukti pembayaran berhasil diunggah! Tim Admin akan segera memverifikasi transaksi Anda.')
        setShowPaymentModal(false)
        setPaymentReceiptUrl('')
        const s = getSession()
        if (s) loadUserData(s, true)
      } else {
        alert('Gagal mengunggah bukti: ' + (json.message || 'Terjadi kesalahan.'))
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
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'submitconsultationreply',
          ticket_id: replyTicket.idTiket,
          reply_message: replyMessage.trim(),
          user_email: s?.email || sessionData?.email,
          user_name: s?.nama || userProfile.nama || 'User'
        }),
        redirect: 'follow'
      })
      const json = await res.json().catch(() => ({ success: true }))
      if (json.success !== false) {
        alert('✅ Pesan balasan berhasil dikirim ke Admin!')
        setShowReplyModal(false)
        setReplyMessage('')
        if (s) loadUserData(s, true)
      } else {
        alert('Gagal mengirim balasan: ' + (json.message || 'Terjadi kesalahan.'))
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      clearSession()
      router.replace('/login')
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
        (t.pertanyaan && t.pertanyaan.toLowerCase().includes(q))

      const matchStatus = statusFilter === 'ALL' || t.status.toLowerCase() === statusFilter.toLowerCase()

      return matchSearch && matchStatus
    })
  }, [consultations, searchTerm, statusFilter])

  const planBadgeColor = 
    userPlan === 'premium' ? '#9333ea' : 
    userPlan === 'plus' ? '#2563eb' : 
    userPlan === 'pro' ? '#16a34a' : '#64748b'

  const navItems = [
    {
      label: `Plan: ${userPlan.toUpperCase()}`,
      icon: '⭐',
      badgeColor: planBadgeColor,
      isPlan: true,
      onClick: () => router.push('/dashboard')
    },
    { label: 'Dashboard Utama', icon: '📊', path: '/dashboard', onClick: () => router.push('/dashboard') },
    { label: 'Proyek AHP Saya', icon: '📁', path: '/user/projects', onClick: () => router.push('/user/projects') },
    { label: 'Pusat Konsultasi', icon: '💬', path: '/user/consultations', badge: consultations.length > 0 ? String(consultations.length) : undefined, onClick: () => router.push('/user/consultations') },
    { label: 'Direktori Pakar', icon: '👥', path: '/expert-directory', onClick: () => router.push('/expert-directory') },
    { 
      label: 'Profil & Pengesahan', 
      icon: '⚙️', 
      badge: !isProfileComplete ? '!' : undefined,
      badgeColor: '#ef4444',
      onClick: () => setShowProfileModal(true) 
    },
    { label: 'Panduan Sistem', icon: '📖', path: '/panduan', onClick: () => router.push('/panduan') },
  ]

  const userPhoto = userProfile.foto_profil || ''

  return (
    <div style={STYLES.wrapper}>
      
      {/* 🟢 MODAL PROFIL */}
      {showProfileModal && sessionData && (
        <ProfileModal
          user={sessionData}
          profile={userProfile}
          onClose={() => setShowProfileModal(false)}
          onSaveSuccess={(updated) => setUserProfile(updated)}
        />
      )}

      {/* 🟢 SIDEBAR PENGGUNA LENGKAP */}
      <aside style={{
        ...STYLES.sidebar,
        width: isCollapsed ? 74 : 250,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Brand */}
        <div style={STYLES.sideBrand}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div style={STYLES.sideLogo}>AHP</div>
              <div>
                <div style={STYLES.sideTitle}>AHP Avitech</div>
                <div style={STYLES.sideSubtitle}>DSS Platform</div>
              </div>
            </div>
          )}
          <button 
            type="button" 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            style={STYLES.collapseBtn}
            title={isCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
          >
            <svg 
              width="15" 
              height="15" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>

        {/* User Card with Live Photo Display */}
        <div style={{ ...STYLES.sideUserCard, justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '8px 4px' : '10px 12px' }}>
          <div style={STYLES.sideAvatarBox}>
            {userPhoto && !avatarError ? (
              <img
                src={userPhoto}
                alt="Foto Profil"
                style={STYLES.sideAvatarImg}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div style={STYLES.sideAvatarInitial}>
                {(userProfile.nama || sessionData?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={STYLES.sideUserName} title={userProfile.nama || 'Pengguna'}>{userProfile.nama || 'Pengguna AHP'}</div>
              <div style={STYLES.sideUserEmail} title={sessionData?.email || ''}>{sessionData?.email || ''}</div>
            </div>
          )}
        </div>

        {/* Nav Menu */}
        <nav style={STYLES.sideNav}>
          {navItems.map((item, idx) => {
            const isActive = pathname === item.path
            return (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                title={isCollapsed ? item.label : undefined}
                style={{
                  ...STYLES.sideNavBtn,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  padding: isCollapsed ? '10px 0' : '9px 12px',
                  ...(isActive ? STYLES.sideNavBtnActive : {}),
                  ...(item.isPlan ? { background: '#1e293b', border: '1px solid #334155', fontWeight: 700, color: '#f8fafc' } : {})
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {!isCollapsed && <span style={STYLES.sideNavLabel}>{item.label}</span>}
                {item.badge && (
                  <span style={{
                    ...STYLES.sideBadge,
                    background: item.badgeColor || '#1d4ed8',
                    position: isCollapsed ? 'absolute' : 'relative',
                    top: isCollapsed ? 4 : 'auto',
                    right: isCollapsed ? 8 : 'auto'
                  }}>
                    {item.badge}
                  </span>
                )}
                {item.isPlan && !isCollapsed && (
                  <span style={{ fontSize: 9, background: planBadgeColor, color: '#fff', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                    {userPlan.toUpperCase()}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Logout Footer */}
        <div style={{ ...STYLES.sideFooter, padding: isCollapsed ? '10px 4px' : '12px' }}>
          <button type="button" onClick={handleLogout} style={STYLES.sideBtnLogout} title={isCollapsed ? "Logout" : undefined}>
            {isCollapsed ? '🚪' : '🚪 Logout Akun'}
          </button>
        </div>
      </aside>

      {/* 🟢 MAIN WORKSPACE */}
      <main style={STYLES.main}>
        <div style={STYLES.container}>
          
          {/* TOP BAR RESMI (LOGO 80PX + GRADASI HIJAU)[cite: 5] */}
          <AppTopBar />

          {/* PAGE HEADER ROW */}
          <div style={STYLES.pageHeader}>
            <div>
              <div style={STYLES.academicPill}>Pusat Komunikasi</div>
              <h1 style={STYLES.pageTitle}>💬 Pusat Tiket &amp; Konsultasi Saya</h1>
              <p style={STYLES.pageSubtitle}>Riwayat diskusi riset bersama evaluator pakar serta tiket koordinasi billing administrator.</p>
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

          {/* COMPACT FILTER & COUNTER */}
          <div style={STYLES.filterRow}>
            <input
              type="text"
              placeholder="🔍 Cari tiket ID, nama pakar, status, atau topik..."
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

          {/* TICKET LIST */}
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
                {searchTerm ? 'Coba gunakan kata kunci pencarian yang lain.' : 'Kunjungi Direktori Pakar untuk mengirimkan pertanyaan riset resmi.'}
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
                  jawabanLower.includes('bayar') ||
                  jawabanLower.includes('nominal')

                const isSelesai = statusLower.includes('selesai')
                const isVerifying = statusLower.includes('verifikasi')

                return (
                  <div key={idx} style={STYLES.card}>
                    
                    {/* Card Header */}
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
                        {ticket.status}
                      </span>
                    </div>

                    {/* Metadata Row */}
                    <div style={STYLES.metaRow}>
                      <span><strong>Tujuan:</strong> {isBillingOrAdmin ? 'Tim Layanan & Billing Administrator' : ticket.expertTujuan}</span>
                      <span>•</span>
                      <span><strong>ID Proyek:</strong> {ticket.projectId || 'Umum'}</span>
                    </div>

                    {/* Pertanyaan Box */}
                    <div style={STYLES.questionBox}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', marginBottom: 2 }}>
                        Topik &amp; Pertanyaan:
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

                    {/* Tanggapan Box */}
                    {ticket.jawabanExpert ? (
                      <div style={STYLES.responseBox}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 2 }}>
                          💬 Tanggapan dari {isBillingOrAdmin ? 'Administrator' : ticket.expertTujuan}:
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#14532d', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                          {ticket.jawabanExpert}
                        </p>

                        {ticket.fileUrl && (
                          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #bbf7d0' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#15803d', display: 'block', marginBottom: 4 }}>
                              📎 Bukti Transfer Terlampir:
                            </span>
                            <a href={ticket.fileUrl} target="_blank" rel="noreferrer">
                              <img src={ticket.fileUrl} alt="Lampiran Bukti" style={{ maxHeight: 90, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>
                        ⏳ Menunggu tanggapan dari {isBillingOrAdmin ? 'Admin' : 'Pakar'}...
                      </div>
                    )}

                    {/* Footer Actions */}
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

// 🟢 MODAL & SHARED STYLES
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
    height: 60,
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
  
  // SIDEBAR
  sidebar: {
    background: '#0f172a',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    borderRight: '1px solid #1e293b',
    flexShrink: 0,
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    height: '100vh',
    zIndex: 10,
  },
  sideBrand: { padding: '16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', minHeight: 62, boxSizing: 'border-box' },
  sideLogo: { width: 32, height: 32, background: 'linear-gradient(135deg, #2563eb, #38bdf8)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: 'white', flexShrink: 0 },
  sideTitle: { fontSize: 13.5, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' },
  sideSubtitle: { fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap' },
  collapseBtn: { background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  
  sideUserCard: { margin: '10px 8px', background: '#1e293b', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #334155', overflow: 'hidden' },
  sideAvatarBox: { width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#2563eb', border: '1.5px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sideAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  sideAvatarInitial: { color: 'white', fontWeight: 700, fontSize: 12 },
  sideUserName: { fontSize: 11.5, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sideUserEmail: { fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  
  sideNav: { display: 'flex', flexDirection: 'column', gap: 3, padding: '0 6px', flexGrow: 1, overflowY: 'auto' },
  sideNavBtn: { display: 'flex', alignItems: 'center', gap: 9, background: 'transparent', color: '#cbd5e1', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box', position: 'relative' },
  sideNavBtnActive: { background: '#2563eb', color: '#ffffff', fontWeight: 700, boxShadow: '0 3px 8px rgba(37,99,235,0.3)' },
  sideNavLabel: { flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sideBadge: { color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999, minWidth: 16, textAlign: 'center' },
  sideFooter: { borderTop: '1px solid #1e293b' },
  sideBtnLogout: { width: '100%', padding: '7px 8px', background: '#1e293b', color: '#f87171', border: '1px solid #334155', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textAlign: 'center' },

  // MAIN
  main: { flex: 1, minHeight: '100vh', overflowX: 'hidden', padding: '18px 24px', boxSizing: 'border-box' },
  container: { maxWidth: 1020, margin: '0 auto' },

  // TOP BAR RESMI (LOGO 80PX + GRADASI HIJAU PERSIS DASHBOARD)[cite: 5]
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
  topBarBrand: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 14 
  },
  topBarLogo: { 
    height: 80, 
    width: 'auto', 
    objectFit: 'contain', 
    opacity: 0.85, 
    mixBlendMode: 'multiply' 
  },
  topBarTitle: { 
    margin: 0, 
    fontSize: 16, 
    fontWeight: 800, 
    color: '#064e3b', 
    letterSpacing: '0.04em' 
  },
  topBarSubtitle: { 
    margin: '2px 0 0', 
    fontSize: 11, 
    color: '#065f46', 
    fontWeight: 600 
  },

  // PAGE HEADER
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  academicPill: { display: 'inline-block', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: 4, marginBottom: 2 },
  pageTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' },
  pageSubtitle: { margin: '2px 0 0', fontSize: 12.5, color: '#64748b' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
  btnNewConsult: { background: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 5px rgba(37,99,235,0.2)' },
  btnRefresh: { background: '#fff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 7, color: '#b91c1c', fontSize: 12, fontWeight: 600, marginBottom: 12 },

  // FILTER ROW
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 240, padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12.5, outline: 'none', background: '#fff' },
  selectFilter: { padding: '7px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, outline: 'none', background: '#fff' },
  counterBadge: { background: '#e2e8f0', color: '#334155', padding: '6px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 500 },

  // STATE BOX
  stateBox: { background: '#fff', padding: '36px 20px', borderRadius: 10, textAlign: 'center', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 28, height: 28, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 8 },

  // CARD ITEMS
  ticketGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  idTag: { background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 5, fontSize: 11, fontWeight: 800, border: '1px solid #bfdbfe' },
  categoryAdminBadge: { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  categoryExpertBadge: { background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  statusBadge: { padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 700 },
  metaRow: { display: 'flex', gap: 8, fontSize: 11.5, color: '#475569', flexWrap: 'wrap' },

  questionBox: { background: '#f8fafc', padding: '8px 10px', borderRadius: 8, border: '1px solid #f1f5f9' },
  responseBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px' },

  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 },
  btnReplyAdmin: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(2,132,199,0.2)' },
  btnPaymentConfirm: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' }
}