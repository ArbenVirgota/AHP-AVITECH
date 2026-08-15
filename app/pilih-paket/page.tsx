'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PLAN_CONFIG } from '@/lib/subscription'

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec'

function formatRupiah(amount: number) {
  if (amount === 0) return 'Gratis'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function PilihPaketPage() {
  const router = useRouter()
  const [dynamicPlans, setDynamicPlans] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [isXenditActive, setIsXenditActive] = useState(false)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)

  // Modal Hubungi Admin
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [selectedPlanTarget, setSelectedPlanTarget] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [submittingAdmin, setSubmittingAdmin] = useState(false)

  const plans = ['free', 'pro', 'plus', 'premium']

  useEffect(() => {
    async function loadData() {
      try {
        const [resPlans, resPayment] = await Promise.all([
          fetch(`${API_URL}?action=getplansettings&_t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`${API_URL}?action=getpaymentsettings&_t=${Date.now()}`, { cache: 'no-store' })
        ])

        const jsonPlans = await resPlans.json()
        if (jsonPlans.success && Array.isArray(jsonPlans.data)) {
          const map: Record<string, any> = {}
          jsonPlans.data.forEach((p: any) => {
            if (p.plan_key) map[String(p.plan_key).toLowerCase().trim()] = p
          })
          setDynamicPlans(map)
        }

        const jsonPay = await resPayment.json().catch(() => ({}))
        if (jsonPay.success && jsonPay.data) {
          setIsXenditActive(String(jsonPay.data.is_xendit_active).toUpperCase() === 'TRUE')
        }
      } catch (err) {
        console.warn('Gagal memuat data paket:', err)
      } finally {
        setLoading(false)
      }
    }
    void loadData()
  }, [])

  const handleSelectPlan = async (planKey: string) => {
    if (planKey === 'free') {
      router.push('/dashboard')
      return
    }

    if (!isXenditActive) {
      handleOpenAdminModal(planKey.toUpperCase())
      return
    }

    setProcessingPlan(planKey)
    try {
      const session = getSession()
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createxenditinvoice',
          user_id: session?.id || '',
          user_email: session?.email || '',
          plan: planKey
        }),
        redirect: 'follow'
      })
      const result = await res.json()
      if (result.success && result.invoice_url) {
        window.location.href = result.invoice_url
      } else {
        alert('Gagal membuat tagihan: ' + (result.message || 'Kesalahan server'))
        setProcessingPlan(null)
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
      setProcessingPlan(null)
    }
  }

  const handleOpenAdminModal = (planName: string) => {
    const session = getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setSelectedPlanTarget(planName)
    setShowAdminModal(true)
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminMessage.trim()) return

    try {
      setSubmittingAdmin(true)
      const session = getSession()
      const ticketId = `PRICING-SUP-${Date.now()}`
      
      const payload = {
        action: 'submitconsultation',
        ticket_id: ticketId,
        expert_id: 'ADMIN-PRICING',
        expert_email: 'admin@avitech.cloud',
        expert_name: 'Tim Layanan Pelanggan & Billing',
        user_name: session?.nama || session?.email || 'Pengguna',
        user_email: session?.email ? session.email.toLowerCase().trim() : 'tamu@pricing.com',
        asal_instansi: 'Halaman Pilih Paket',
        pertanyaan: `[Peminatan Plan: ${selectedPlanTarget}] ${adminMessage.trim()}`,
        status: 'Pending Admin'
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      })

      const json = JSON.parse(await res.text())
      if (json && json.success) {
        alert(`✅ Pesan berhasil dikirim ke Admin (#${ticketId}). Tim kami akan segera menanggapi lewat sistem dashboard Anda.`)
        setShowAdminModal(false)
        setAdminMessage('')
        router.push('/dashboard')
      } else {
        alert('Gagal mengirim: ' + (json.message || 'Terjadi kesalahan'))
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message)
    } finally {
      setSubmittingAdmin(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px', fontFamily: 'sans-serif' }}>⏳ Memuat pilihan paket...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Segoe UI, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Pilih Paket Semester Pass (6 Bulan)</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Tingkatkan kapasitas riset AHP Anda sesuai dengan skala kebutuhan akademik maupun instansi.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {plans.map((plan) => {
            const staticCfg = PLAN_CONFIG[plan as PlanType]
            const dynamicCfg = dynamicPlans[plan]
            const label = dynamicCfg?.label || staticCfg.label
            const priceText = dynamicCfg ? formatRupiah(Number(dynamicCfg.price || 0)) : staticCfg.price

            return (
              <div key={plan} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: staticCfg.color, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>{priceText}</div>
                  <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.4 }}>
                    {staticCfg.features.map((f, idx) => <li key={idx}>{f}</li>)}
                  </ul>
                </div>

                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button 
                    onClick={() => handleSelectPlan(plan)}
                    style={{ width: '100%', padding: '10px 0', background: plan === 'free' ? '#f1f5f9' : '#2563eb', color: plan === 'free' ? '#64748b' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    disabled={processingPlan === plan}
                  >
                    {processingPlan === plan ? 'Memproses...' : plan === 'free' ? 'Mulai Gratis' : 'Pilih Paket'}
                  </button>

                  <button 
                    onClick={() => handleOpenAdminModal(label)}
                    style={{ width: '100%', padding: '6px 0', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                    type="button"
                  >
                    ✉️ Hubungi Admin
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal Hubungi Admin dari Halaman Pilih Paket */}
      {showAdminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>✉️ Hubungi Admin ({selectedPlanTarget})</h3>
              <button onClick={() => setShowAdminModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12, lineHeight: 1.4 }}>
              Kirimkan pertanyaan atau konfirmasi pengaktifan manual untuk paket ini. Pesan akan masuk ke sistem tiket Anda.
            </p>
            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea 
                rows={4} 
                value={adminMessage} 
                onChange={(e) => setAdminMessage(e.target.value)} 
                placeholder="Tuliskan kendala atau instruksi pemesanan Anda di sini..." 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                required 
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAdminModal(false)} style={{ padding: '8px 14px', background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Batal</button>
                <button type="submit" disabled={submittingAdmin} style={{ padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  {submittingAdmin ? 'Mengirim...' : 'Kirim Tiket →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}