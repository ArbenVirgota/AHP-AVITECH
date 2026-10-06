// app/buat-proyek/baru/page.tsx

'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import type { UserSession } from '@/lib/auth'
import { PLAN_CONFIG } from '@/lib/subscription'
import SafeJoyride from '@/components/SafeJoyride'

interface ExpertDirectoryItem {
  expert_id: string
  gelar_depan?: string
  expert_name: string
  gelar_belakang?: string
  expert_email?: string
  expert_whatsapp?: string
  asal_instansi?: string
  is_public?: boolean | string
  source?: string
}

interface ExpertFormItem {
  expertId?: string
  gelarDepan: string
  name: string
  gelarBelakang: string
  email: string
  whatsapp: string
  fieldError?: string
}

interface DynamicPlanSetting {
  plan_key: string
  label: string
  price: number
  duration_months: number
  max_projects: number
  max_experts_manual: number
  max_experts_directory: number
  max_consultation_per_expert: number
  allow_subcriteria: boolean | number | string
  allow_alternative_method: boolean | number | string
  allow_ai_features: boolean | number | string
}

type RawProject = Record<string, unknown>

function parseMultiLines(text: string): string[] {
  if (!text) return []
  return text
    .split(/[\r\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '-' && item !== 'null')
}

function cleanPlanType(raw: string): 'free' | 'pro' | 'plus' | 'premium' {
  const str = String(raw || '').toUpperCase().trim()
  if (str.includes('PREMIUM')) return 'premium'
  if (str.includes('PLUS')) return 'plus'
  if (str.includes('PRO')) return 'pro'
  return 'free'
}

function isFeatureAllowed(val: unknown): boolean {
  if (val === true || val === 1 || val === '1') return true
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true
  return false
}

function isStudentSimulationProject(raw: RawProject): boolean {
  const expName = String(raw?.nama_expert ?? raw?.namaExpert ?? '').toLowerCase()
  const fasilitatorNama = String(raw?.fasilitator_nama ?? raw?.fasilitatorNama ?? '').toLowerCase()
  const projId = String(raw?.project_id ?? raw?.id ?? '').toUpperCase()
  
  return (
    expName.includes('simulasi') ||
    expName.includes('praktikum') ||
    expName.includes('linglungan') ||
    expName.includes('raos') ||
    fasilitatorNama.includes('simulasi') ||
    projId.includes('SIM') ||
    Boolean(raw?.is_student_project) ||
    Boolean(raw?.is_student)
  )
}

function AppTopBar() {
  return (
    <div style={topBarStyles.container} className="no-print">
      <div style={topBarStyles.brandGroup}>
        <img src="/logo.png" alt="Logo AHP" style={topBarStyles.logo} />
        <div>
          <h2 style={topBarStyles.title}>ANALYTIC HIERARCHY PROCESS</h2>
          <p style={topBarStyles.subtitle}>Sistem Pendukung Keputusan Multi-Kriteria Terintegrasi</p>
        </div>
      </div>
    </div>
  )
}

function BuatProyekContent() {
  const router = useRouter()

  const [session, setSession] = useState<UserSession | null>(null)
  const [userPlan, setUserPlan] = useState<string>('free')

  // Identifikasi peran Student Edition
  const [isStudentRole, setIsStudentRole] = useState(false)
  const isStudent = useMemo(() => isStudentRole, [isStudentRole])

  const [hasSubcriteriaAccess, setHasSubcriteriaAccess] = useState(false)
  const [hasAlternativesAccess, setHasAlternativesAccess] = useState(false)
  const [hasAiAccess, setHasAiAccess] = useState(false)
  const [resolvedMaxProjects, setResolvedMaxProjects] = useState<number>(1)
  const [resolvedMaxExpertsManual, setResolvedMaxExpertsManual] = useState<number>(4)
  const [resolvedMaxExpertsDirectory, setResolvedMaxExpertsDirectory] = useState<number>(0)

  const [projectCount, setProjectCount] = useState(0)
  const [initLoading, setInitLoading] = useState(true)

  const [namaProyek, setNamaProyek] = useState('')
  const [deskripsi, setDeskripsi] = useState('')

  const [metode, setMetode] = useState<'Bobot saja' | 'Bobot alternatif'>('Bobot saja')
  const [gunakanSubkriteria, setGunakanSubkriteria] = useState(false)

  const [kriteriaText, setKriteriaText] = useState('')
  const [subkriteriaTextMap, setSubkriteriaTextMap] = useState<Record<string, string>>({})
  const [alternatifText, setAlternatifText] = useState('')

  const [jumlahExpert, setJumlahExpert] = useState(1)
  const [experts, setExperts] = useState<ExpertFormItem[]>([
    { expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' },
  ])

  // Kontak Fasilitator
  const [fasilitatorNama, setFasilitatorNama] = useState('')
  const [fasilitatorEmail, setFasilitatorEmail] = useState('')
  const [fasilitatorWhatsapp, setFasilitatorWhatsapp] = useState('')

  const [directoryExperts, setDirectoryExperts] = useState<ExpertDirectoryItem[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [loadingAi, setLoadingAi] = useState(false)
  const [loadingSubAi, setLoadingSubAi] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const kriteriaArray = useMemo(() => parseMultiLines(kriteriaText), [kriteriaText])
  const alternatifArray = useMemo(() => parseMultiLines(alternatifText), [alternatifText])

  const loadInitialData = useCallback(async () => {
    const s = getSession()
    if (!s || !s.email) {
      router.replace('/login')
      return
    }

    setSession(s)
    const cleanEmail = String(s.email || '').trim().toLowerCase()
    const cleanUserId = String((s as any)?.user_id || s.id || '').trim()
    const sessionNama = String((s as any)?.nama || (s as any)?.name || '').trim()

    setFasilitatorEmail(cleanEmail)
    if (sessionNama) setFasilitatorNama(sessionNama)

    try {
      setInitLoading(true)

      const [dashRes, expertDirRes] = await Promise.all([
        fetch(`/api/dashboard/summary?email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(cleanUserId)}&_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/expert-directory?_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
      ])

      let isStudentUser = (s as any)?.status_user?.toLowerCase() === 'student'
      let dynPlans: DynamicPlanSetting[] = []
      let subData: any = null
      let projList: any[] = []

      if (dashRes) {
        const dashJson = await dashRes.json().catch(() => ({}))
        if (dashJson && dashJson.success && dashJson.data) {
          isStudentUser = Boolean(dashJson.data.isStudent || String(dashJson.data.user?.status_user || '').toLowerCase() === 'student')
          dynPlans = dashJson.data.plans || []
          subData = dashJson.data.subscription || null
          projList = Array.isArray(dashJson.data.projects) ? dashJson.data.projects : []

          const dbName = String(dashJson.data.user?.nama || dashJson.data.user?.name || '').trim()
          if (dbName) setFasilitatorNama(dbName)
          const dbWa = String(dashJson.data.user?.whatsapp || dashJson.data.user?.no_wa || '').trim()
          if (dbWa) setFasilitatorWhatsapp(dbWa)
        }
      }

      setIsStudentRole(isStudentUser)

      const validProjects = isStudentUser
        ? projList
        : projList.filter((p: any) => !isStudentSimulationProject(p))
      setProjectCount(validProjects.length)

      if (expertDirRes) {
        const dirJson = await expertDirRes.json().catch(() => ({}))
        let list: any[] = []
        if (Array.isArray(dirJson)) list = dirJson
        else if (dirJson && Array.isArray(dirJson.data)) list = dirJson.data
        else if (dirJson && Array.isArray(dirJson.experts)) list = dirJson.experts

        // 🟢 Saring ketat di client: buang pakar privat dan pakar simulasi
        const sanitizedList = list.filter((item: any) => {
          const isPub = item.is_public === true || item.is_public === 1 || String(item.is_public).toUpperCase() === 'PUBLIK'
          const pEmail = String(item.expert_email || item.expertemail || '').trim().toLowerCase()
          const pName = String(item.expert_name || item.nama || '').trim().toLowerCase()
          const pSource = String(item.source || '').trim().toUpperCase()

          if (!isPub) return false
          if (pSource === 'SIMULASI') return false
          if (pEmail === 'pakar1@gmail.com' || pEmail === 'pakar2@gmail.com') return false
          if (pName.includes('linglungan') || pName.includes('raos')) return false

          return true
        })

        setDirectoryExperts(sanitizedList)
      }

      if (isStudentUser) {
        setUserPlan('free')
        setResolvedMaxProjects(2)
        setResolvedMaxExpertsManual(2)
        setResolvedMaxExpertsDirectory(0)
        setHasAiAccess(false)
        setHasSubcriteriaAccess(true)
        setHasAlternativesAccess(true)
        setJumlahExpert(2)
        setExperts([
          {
            expertId: 'EXP-SIM-01',
            gelarDepan: 'Prof.',
            name: 'Linglungan',
            gelarBelakang: '',
            email: 'pakar1@gmail.com',
            whatsapp: '081234567891',
            fieldError: '',
          },
          {
            expertId: 'EXP-SIM-02',
            gelarDepan: 'DR.',
            name: 'Raos',
            gelarBelakang: '',
            email: 'pakar2@gmail.com',
            whatsapp: '081234567892',
            fieldError: '',
          },
        ])
      } else {
        const currentPlanKey = String(subData?.plan || 'free').toLowerCase()
        const currentPlanClean = cleanPlanType(currentPlanKey)
        setUserPlan(currentPlanClean)

        const matchedPlanSetting = dynPlans.find(
          (p) => String(p.plan_key).toUpperCase() === currentPlanClean.toUpperCase()
        )

        const maxProjectsAllowed =
          subData?.max_projects !== undefined && subData?.max_projects !== null && subData?.max_projects !== ''
            ? Number(subData.max_projects)
            : matchedPlanSetting?.max_projects !== undefined
            ? Number(matchedPlanSetting.max_projects)
            : PLAN_CONFIG[currentPlanClean]?.maxProjects || 1

        const maxExpManualAllowed =
          subData?.max_experts_manual !== undefined && subData?.max_experts_manual !== null && subData?.max_experts_manual !== ''
            ? Number(subData.max_experts_manual)
            : matchedPlanSetting?.max_experts_manual !== undefined
            ? Number(matchedPlanSetting.max_experts_manual)
            : 4

        const maxExpDirAllowed =
          subData?.max_experts_directory !== undefined && subData?.max_experts_directory !== null && subData?.max_experts_directory !== ''
            ? Number(subData.max_experts_directory)
            : matchedPlanSetting?.max_experts_directory !== undefined
            ? Number(matchedPlanSetting.max_experts_directory)
            : 0

        setResolvedMaxProjects(maxProjectsAllowed >= 999999 ? Number.POSITIVE_INFINITY : maxProjectsAllowed)
        setResolvedMaxExpertsManual(maxExpManualAllowed >= 999999 ? 99999 : maxExpManualAllowed)
        setResolvedMaxExpertsDirectory(maxExpDirAllowed >= 999999 ? 99999 : maxExpDirAllowed)

        const allowSub = isFeatureAllowed(subData?.allow_subcriteria ?? matchedPlanSetting?.allow_subcriteria)
        const allowAlt = isFeatureAllowed(subData?.allow_alternative_method ?? matchedPlanSetting?.allow_alternative_method)
        const allowAi = isFeatureAllowed(subData?.allow_ai_features ?? matchedPlanSetting?.allow_ai_features)

        setHasSubcriteriaAccess(allowSub)
        setHasAlternativesAccess(allowAlt)
        setHasAiAccess(allowAi)

        setJumlahExpert(1)
        setExperts([
          { expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' },
        ])
      }
    } catch (err) {
      console.error('BuatProyek init error:', err)
    } finally {
      setInitLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  const isQuotaFull = resolvedMaxProjects !== Number.POSITIVE_INFINITY && projectCount >= resolvedMaxProjects
  const canUseSubcriteria = hasSubcriteriaAccess
  const canUseAlternatives = hasAlternativesAccess
  const isAiAllowed = !isStudent && hasAiAccess

  const handleJumlahExpert = (n: number) => {
    if (isStudent) return
    const maxLimit = resolvedMaxExpertsManual >= 99999 ? 20 : Math.max(1, resolvedMaxExpertsManual)
    const val = Math.max(1, Math.min(maxLimit, n))
    setJumlahExpert(val)
    setExperts((prev) => {
      const arr = [...prev]
      while (arr.length < val) {
        arr.push({ expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' })
      }
      return arr.slice(0, val)
    })
  }

  const updateExpertField = (index: number, field: keyof ExpertFormItem, value: string) => {
    if (isStudent) return
    setExperts((prev) => {
      const newExperts = [...prev]
      const current = { ...newExperts[index], [field]: String(value), fieldError: '' }

      if (field === 'email') {
        const cleanEmail = String(value || '').trim().toLowerCase()

        const isDuplicate = newExperts.some(
          (e, idx) => idx !== index && String(e.email || '').trim().toLowerCase() === cleanEmail && cleanEmail !== ''
        )
        if (isDuplicate) {
          current.fieldError = `Email pakar "${cleanEmail}" sudah digunakan pada baris responden lain.`
        }

        const matched = directoryExperts.find(
          (d) => String(d.expert_email || '').trim().toLowerCase() === cleanEmail
        )

        if (matched) {
          current.expertId = matched.expert_id
          current.gelarDepan = matched.gelar_depan || ''
          current.name = matched.expert_name || ''
          current.gelarBelakang = matched.gelar_belakang || ''
          if (matched.expert_whatsapp) {
            current.whatsapp = matched.expert_whatsapp
          }
        } else if (current.expertId) {
          current.expertId = ''
        }
      }

      newExperts[index] = current
      return newExperts
    })
  }

  const handleSelectExpertFromDirectory = (index: number, selected: ExpertDirectoryItem) => {
    if (isStudent || resolvedMaxExpertsDirectory === 0) return
    const rawFullName = String(selected.expert_name || '')
    const gDepan = String(selected.gelar_depan || '')
    const gBelakang = String(selected.gelar_belakang || '')
    const email = String(selected.expert_email || '')
    const wa = String(selected.expert_whatsapp || '')
    const expId = String(selected.expert_id || '')

    const isAlreadyAdded = experts.some(
      (e, i) => i !== index && (String(e.expertId) === expId || String(e.email).toLowerCase() === email.toLowerCase()) && (expId !== '' || email !== '')
    )
    if (isAlreadyAdded) {
      setExperts((prev) => {
        const updated = [...prev]
        updated[index].fieldError = `Pakar "${rawFullName}" (${email}) sudah Anda pilih pada baris lain.`
        return updated
      })
      return
    }

    setExperts((prev) => {
      const updated = [...prev]
      updated[index] = {
        expertId: expId,
        gelarDepan: gDepan,
        name: rawFullName,
        gelarBelakang: gBelakang,
        email: email,
        whatsapp: wa,
        fieldError: '',
      }
      return updated
    })
    setActiveSuggestionIndex(null)
  }

  const handleGenerateAiCriteria = async () => {
    if (isStudent || !isAiAllowed) {
      alert(`Fitur Analisis AI dinonaktifkan pada paket Anda sesuai ketetapan SuperAdmin.`)
      return
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' terlebih dahulu agar AI memahami konteks riset.")
      return
    }

    setLoadingAi(true)
    try {
      const payload = {
        topic: namaProyek.trim(),
        description: deskripsi.trim(),
        wantsSubcriteria: canUseSubcriteria && gunakanSubkriteria,
      }

      const res = await fetch('/api/ai/generate-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (json.success && json.data) {
        const aiCriteria = json.data.criteria
        const crNames = aiCriteria.map((c: any) => String(c.name))
        setKriteriaText(crNames.join('\n'))

        if (canUseSubcriteria && gunakanSubkriteria) {
          const newSubMap: Record<string, string> = {}
          aiCriteria.forEach((c: any) => {
            if (c.subcriteria && c.subcriteria.length > 0) {
              newSubMap[c.name] = c.subcriteria.join('\n')
            }
          })
          setSubkriteriaTextMap(newSubMap)
        }
      } else {
        alert('Gagal menyusun kriteria otomatis: ' + (json.message || 'Respons kosong.'))
      }
    } catch {
      alert('Koneksi sistem AI gagal. Silakan coba kembali.')
    } finally {
      setLoadingAi(false)
    }
  }

  const handleGenerateSingleSubcriteria = async (critName: string) => {
    if (isStudent || !isAiAllowed) {
      alert(`Fitur AI dinonaktifkan pada paket Anda.`)
      return
    }

    if (!namaProyek.trim()) {
      alert("Harap isikan 'Nama Proyek' terlebih dahulu.")
      return
    }

    setLoadingSubAi((prev) => ({ ...prev, [critName]: true }))
    try {
      const res = await fetch('/api/ai/generate-subcriteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: namaProyek.trim(),
          description: deskripsi.trim(),
          criterionName: critName,
        }),
      })

      const json = await res.json()
      if (json.success && json.data?.subcriteria) {
        const subs: string[] = json.data.subcriteria
        setSubkriteriaTextMap((prev) => ({
          ...prev,
          [critName]: subs.join('\n'),
        }))
      } else {
        alert('Gagal menyusun subkriteria otomatis: ' + (json.message || 'Terjadi kesalahan.'))
      }
    } catch {
      alert('Koneksi ke sistem AI gagal.')
    } finally {
      setLoadingSubAi((prev) => ({ ...prev, [critName]: false }))
    }
  }

  const handleSimpan = async () => {
    setError('')
    if (!namaProyek.trim()) return setError('Nama proyek wajib diisi.')

    if (isStudent) {
      if (kriteriaArray.length < 3) {
        return setError('Student Edition: Minimal 3 kriteria utama harus diisi agar rasio konsistensi (CR) dapat dihitung.')
      }
      if (kriteriaArray.length > 3) {
        return setError('Student Edition: Dibatasi maksimal 3 kriteria utama untuk mode praktikum.')
      }
    } else {
      if (kriteriaArray.length < 2) {
        return setError('Minimal 2 kriteria harus diisi untuk analisis perbandingan berpasangan AHP.')
      }
    }

    const formattedSubkriteriaMap: Record<string, string[]> = {}
    if (gunakanSubkriteria && canUseSubcriteria) {
      for (const critName of kriteriaArray) {
        const rawSubs = subkriteriaTextMap[critName] || ''
        const subs = parseMultiLines(rawSubs)

        if (isStudent) {
          if (subs.length < 3) {
            return setError(`Student Edition: Kriteria "${critName}" wajib memiliki minimal 3 subkriteria.`)
          }
          if (subs.length > 3) {
            return setError(`Student Edition: Kriteria "${critName}" dibatasi maksimal 3 subkriteria.`)
          }
        } else {
          if (subs.length < 2) {
            return setError(`Kriteria "${critName}" wajib memiliki minimal 2 subkriteria.`)
          }
        }

        formattedSubkriteriaMap[critName] = subs
      }
    }

    if (metode === 'Bobot alternatif') {
      if (!canUseAlternatives) return setError('Fitur pembobotan alternatif belum diaktifkan pada paket Anda sesuai kebijakan SuperAdmin.')
      if (alternatifArray.length < 2) return setError('Minimal 2 alternatif harus diisi jika memilih metode Kombinasi Alternatif.')
      
      if (isStudent && alternatifArray.length > 3) {
        return setError('Akun Student Edition dibatasi maksimal 3 alternatif pilihan.')
      }
    }

    const emailFas = String(fasilitatorEmail || '').trim()
    const waFas = String(fasilitatorWhatsapp || '').trim()

    if (!emailFas || !waFas) return setError('Kontak fasilitator wajib diisi.')
    if (isQuotaFull) {
      return setError(
        isStudent
          ? 'Batas kuota proyek Student Edition tercapai (maksimal 2 proyek).'
          : `Batas kuota proyek Anda telah tercapai (${resolvedMaxProjects} proyek). Silakan tingkatkan paket Anda.`
      )
    }

    const s = getSession()
    if (!s || !s.email) {
      setError('Sesi habis. Silakan login ulang.')
      router.replace('/login')
      return
    }

    if (!window.confirm('Data Kriteria, Subkriteria, dan Pakar TIDAK DAPAT DIEDIT KEMBALI setelah disimpan. Lanjutkan pembuatan proyek?')) return

    const sessionObj = s as Record<string, any>
    const emailToSave = String(s.email || '').trim().toLowerCase()
    const finalUserId = String(sessionObj.user_id || sessionObj.userId || sessionObj.id || '').trim()
    const waFormatted = waFas.replace(/\D/g, '').replace(/^0/, '62')
    const finalFasilitatorNama = String(fasilitatorNama || sessionObj.nama || sessionObj.name || 'Fasilitator Utama').trim()

    let normalizedExperts: any[] = []
    if (isStudent) {
      normalizedExperts = [
        {
          expert_id: 'EXP-SIM-01',
          gelar_depan: 'Prof.',
          expert_name: 'Linglungan',
          gelar_belakang: '',
          fullName: 'Prof. Linglungan',
          expert_email: 'pakar1@gmail.com',
          expert_whatsapp: '6281234567891',
          is_public: 'PRIVAT',
          status: 'Aktif',
        },
        {
          expert_id: 'EXP-SIM-02',
          gelar_depan: 'DR.',
          expert_name: 'Raos',
          gelar_belakang: '',
          fullName: 'DR. Raos',
          expert_email: 'pakar2@gmail.com',
          expert_whatsapp: '6281234567892',
          is_public: 'PRIVAT',
          status: 'Aktif',
        },
      ]
    } else {
      const validExperts = experts.filter((e) => String(e.name || '').trim() !== '' || String(e.email || '').trim() !== '')
      if (validExperts.length < 1) return setError('Minimal 1 pakar/responden harus diisi.')

      let hasValidationError = false
      const updatedExpertsState = [...experts]

      updatedExpertsState.forEach((exp) => {
        const expEmailStr = String(exp.email || '').trim()
        const expWaStr = String(exp.whatsapp || '').trim()
        const expNameStr = String(exp.name || '').trim()

        if (expEmailStr !== '' || expNameStr !== '') {
          if (!exp.expertId && (expEmailStr === '' || expWaStr === '')) {
            exp.fieldError = 'Email dan No. WhatsApp wajib diisi untuk input manual.'
            hasValidationError = true
          }
        }
      })

      if (hasValidationError) {
        setExperts(updatedExpertsState)
        return setError('Terdapat kesalahan pada formulir pakar. Periksa tanda merah.')
      }

      normalizedExperts = validExperts.map((exp) => {
        const expEmailClean = String(exp.email || '').trim().toLowerCase()

        // 🟢 Validasi: Hanya cocokkan jika pakar terdaftar sebagai PUBLIK murni
        const matchedDir = directoryExperts.find(
          (item) => String(item.expert_email || '').trim().toLowerCase() === expEmailClean
        )

        if (matchedDir) {
          const gDepan = String(matchedDir.gelar_depan || '').trim()
          const nameCore = String(matchedDir.expert_name || '').trim()
          const gBelakang = String(matchedDir.gelar_belakang || '').trim()
          const wa = String(matchedDir.expert_whatsapp || exp.whatsapp || '').trim()

          return {
            expert_id: matchedDir.expert_id,
            gelar_depan: gDepan,
            expert_name: nameCore,
            gelar_belakang: gBelakang,
            fullName: `${gDepan ? gDepan + ' ' : ''}${nameCore}${gBelakang ? ', ' + gBelakang : ''}`,
            expert_email: expEmailClean,
            expert_whatsapp: wa ? wa.replace(/\D/g, '').replace(/^0/, '62') : '',
            is_public: 'PUBLIK',
            status: 'Aktif',
          }
        }

        const expNameStr = String(exp.name || '').trim()
        const expGelarDepanStr = String(exp.gelarDepan || '').trim()
        const expGelarBelakangStr = String(exp.gelarBelakang || '').trim()
        const expWaStr = String(exp.whatsapp || '').trim()

        return {
          expert_id: exp.expertId || 'EXP-' + Date.now() + Math.floor(Math.random() * 1000),
          gelar_depan: expGelarDepanStr,
          expert_name: expNameStr,
          gelar_belakang: expGelarBelakangStr,
          fullName: `${expGelarDepanStr ? expGelarDepanStr + ' ' : ''}${expNameStr}${expGelarBelakangStr ? ', ' + expGelarBelakangStr : ''}`,
          expert_email: expEmailClean,
          expert_whatsapp: expWaStr ? expWaStr.replace(/\D/g, '').replace(/^0/, '62') : '',
          is_public: 'PRIVAT',
          status: 'Aktif',
        }
      })
    }

    const generateId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    const formattedCriteriaArray = kriteriaArray.map((nama, idx) => ({ 
      id: generateId('crit'), 
      nama: String(nama).trim(), 
      urutan: idx + 1 
    }))

    const formattedSubcriteriaArray: any[] = []
    if (gunakanSubkriteria && canUseSubcriteria) {
      formattedCriteriaArray.forEach((crit) => {
        const subs = formattedSubkriteriaMap[crit.nama] || []
        subs.forEach((subName, sIdx) => {
          formattedSubcriteriaArray.push({ 
            id: generateId('sub'), 
            criteria_id: crit.id, 
            nama: String(subName).trim(), 
            urutan: sIdx + 1 
          })
        })
      })
    }

    const formattedAlternatifArray =
      metode === 'Bobot alternatif' && canUseAlternatives
        ? alternatifArray.map((nama, idx) => ({ 
            id: generateId('alt'), 
            nama: String(nama).trim(), 
            urutan: idx + 1 
          }))
        : []

    setLoading(true)
    try {
      const payload = {
        user_id: finalUserId,
        email: emailToSave,
        nama_proyek: String(namaProyek || '').trim(),
        deskripsi: String(deskripsi || '').trim(),
        metode: metode === 'Bobot alternatif' && canUseAlternatives ? 'Bobot alternatif' : 'Bobot saja',
        criteria_list: kriteriaArray.join(' | '),
        alternatif_list: metode === 'Bobot alternatif' && canUseAlternatives ? alternatifArray.join(' | ') : '',
        jumlah_expert: normalizedExperts.length,
        kriteria: formattedCriteriaArray,
        punya_subkriteria: Boolean(gunakanSubkriteria && canUseSubcriteria),
        subkriteria: formattedSubcriteriaArray,
        alternatif: formattedAlternatifArray,
        experts_data: normalizedExperts,
        fasilitator_email: emailToSave,
        fasilitator_whatsapp: waFormatted,
        fasilitator_nama: finalFasilitatorNama,
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (result && result.success) {
        const resolvedProjectId = String(result?.data?.project_id || result?.project_id || '').trim()
        setSuccess(true)
        setTimeout(() => router.push(`/proyek/kelola?id=${encodeURIComponent(resolvedProjectId)}`), 1200)
        return
      }
      setError(result?.message || 'Gagal menyimpan proyek ke database.')
    } catch {
      setError('Gagal terhubung ke database. Periksa koneksi backend Anda.')
    } finally {
      setLoading(false)
    }
  }

  const handleStartBuatProyekTour = () => {
    window.dispatchEvent(new Event('start-tour-ahp_tour_buat_proyek'))
  }

  const buatProyekSteps = useMemo(
    () => [
      {
        target: 'body',
        content: isStudent
          ? 'Selamat datang di Ruang Kerja AHP Student Edition. Ikuti petunjuk singkat berikut.'
          : 'Mari kita mulai membuat ruang kerja proyek riset AHP pertama Anda. Ikuti petunjuk singkat ini.',
        title: isStudent ? '🎓 Proyek Student Edition Baru' : '📁 Buat Proyek Baru',
        placement: 'center' as const,
        disableBeacon: true,
      },
      {
        target: '.tour-info-proyek',
        content: 'Pertama, isi nama proyek Anda dan pilih metode evaluasi.',
        title: '1. Informasi Proyek',
        placement: 'bottom' as const,
      },
      {
        target: '.tour-kriteria',
        content: isStudent
          ? 'Ketik tepat 3 kriteria utama Anda di sini (Student Edition diatur 3 kriteria agar rasio konsistensi CR dapat dihitung).'
          : 'Ketik daftar kriteria utama Anda di sini (pisahkan dengan tombol Enter atau Koma).',
        title: '2. Kriteria Utama',
        placement: 'top' as const,
      },
      {
        target: '.tour-pakar',
        content: isStudent
          ? 'Pada Student Edition, 2 Pakar Simulasi standar langsung dipasangkan otomatis untuk pengisian kuesioner.'
          : 'Tentukan jumlah pakar responden dan cari nama pakar langsung dari direktori platform.',
        title: '3. Tim Pakar',
        placement: 'top' as const,
      },
      {
        target: '.tour-simpan',
        content: 'Klik tombol ini untuk menyimpan model hierarki ke database.',
        title: '💾 Simpan Proyek',
        placement: 'top' as const,
      },
    ],
    [isStudent]
  )

  const S = styles
  if (initLoading) return <div style={S.loadingPage}><div style={S.spinner} /><div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Memuat konfigurasi batasan paket...</div></div>
  if (success) return <div style={S.loadingPage}><div style={{ fontSize: 44 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: '#166534', margin: 0 }}>Proyek Berhasil Disimpan!</h2><p style={{ fontSize: 13, color: '#475569', margin: 0 }}>Mengalihkan ke ruang kerja...</p></div>

  return (
    <div style={S.layoutWrapper}>
      <SafeJoyride steps={buatProyekSteps} storageKey="ahp_tour_buat_proyek" />

      <main style={S.mainContent}>
        <div style={S.container}>
          <AppTopBar />

          <div style={S.pageHeader}>
            <button onClick={() => router.back()} style={S.backBtn} type="button">← Kembali</button>
            <div style={{ flex: 1 }}>
              <span style={isStudent ? S.studentTag : S.academicTag}>
                {isStudent ? '🎓 AHP Student Edition' : `AHP Project Wizard (${userPlan.toUpperCase()})`}
              </span>
              <h1 style={S.pageTitle}>Buat Proyek AHP Baru</h1>
              <p style={S.pageSubtitle}>
                {isStudent
                  ? 'Ruang analisis AHP Student Edition (Tepat 3 Kriteria, 3 Subkriteria, Maks. 3 Alternatif, 2 Pakar Simulasi).'
                  : 'Tentukan parameter hierarki, kriteria, subkriteria, dan alternatif sesuai paket Anda.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handleStartBuatProyekTour}
                style={{
                  padding: '7px 12px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Buka panduan interaktif"
              >
                💡 Panduan Interaktif
              </button>

              <div style={S.quotaBadge}>
                <span style={{ fontSize: 11, color: '#475569' }}>Proyek</span>
                <strong style={{ color: isQuotaFull ? '#dc2626' : '#1d4ed8', marginLeft: 6 }}>
                  {projectCount}/{resolvedMaxProjects === Number.POSITIVE_INFINITY ? '∞' : resolvedMaxProjects}
                </strong>
              </div>
            </div>
          </div>

          {error && <div style={S.errorBox}>{error}</div>}

          {/* 1. INFORMASI PROYEK */}
          <div style={S.card} className="tour-info-proyek">
            <h3 style={S.cardTitle}>1. Informasi Proyek &amp; Struktur Metode</h3>
            <div style={S.grid2}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Nama Proyek / Topik <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={S.input} type="text" value={namaProyek} onChange={(e) => setNamaProyek(e.target.value)} placeholder="Contoh: Strategi Pemilihan Teknologi Ramah Lingkungan" />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Cakupan Evaluasi</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { val: 'Bobot saja' as const, label: 'Hanya Bobot (Kriteria/Subkriteria)', desc: 'Tanpa alternatif. Fokus pada prioritas kriteria.', disabled: false },
                    { val: 'Bobot alternatif' as const, label: 'Kombinasi dengan Alternatif', desc: canUseAlternatives ? (isStudent ? 'Evaluasi alternatif (2 hingga 3 alternatif).' : 'Evaluasi lengkap hingga perankingan alternatif.') : '🔒 Belum Diaktifkan di Subscription SuperAdmin', disabled: !canUseAlternatives },
                  ].map(({ val, label, desc, disabled }) => (
                    <button key={val} type="button" onClick={() => !disabled && setMetode(val)} style={disabled ? { ...S.radioBtn, opacity: 0.6, cursor: 'not-allowed', background: '#f1f5f9' } : metode === val ? { ...S.radioBtn, ...S.radioBtnActive } : S.radioBtn}>
                      <strong style={{ fontSize: 12.5 }}>{label} {disabled && '🔒'}</strong>
                      <span style={{ fontSize: 11, color: metode === val && !disabled ? '#1d4ed8' : '#64748b' }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}>
                <label style={S.label}>Deskripsi Proyek (Konteks Masalah)</label>
                <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical' }} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Jelaskan latar belakang, tujuan, atau konteks analisis pengambilan keputusan..." />
              </div>
            </div>
          </div>

          {/* 2. DAFTAR KRITERIA */}
          <div style={S.card} className="tour-kriteria">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
              <h3 style={{ ...S.cardTitle, margin: 0 }}>
                2. Daftar Kriteria Utama{' '}
                <span style={isStudent && (kriteriaArray.length < 3 || kriteriaArray.length > 3) ? { ...S.badge, background: '#fef2f2', color: '#dc2626' } : S.badge}>
                  {isStudent ? `${kriteriaArray.length} / 3 kriteria` : `${kriteriaArray.length} aktif`}
                </span>
              </h3>
              
              {!isStudent && (
                <button
                  type="button"
                  onClick={handleGenerateAiCriteria}
                  disabled={loadingAi || !isAiAllowed}
                  style={{
                    background: isAiAllowed ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : '#f1f5f9',
                    color: isAiAllowed ? 'white' : '#94a3b8',
                    border: isAiAllowed ? 'none' : '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: !isAiAllowed ? 'not-allowed' : loadingAi ? 'wait' : 'pointer',
                    boxShadow: isAiAllowed ? '0 2px 8px rgba(37,99,235,0.2)' : 'none',
                  }}
                  title={!isAiAllowed ? 'Fitur AI dinonaktifkan oleh SuperAdmin pada paket ini' : 'Susun hierarki kriteria otomatis'}
                >
                  {loadingAi ? 'Menyusun Struktur...' : isAiAllowed ? '🪄 Susun Kriteria Otomatis' : '🔒 Analisis AI (Terkunci)'}
                </button>
              )}
            </div>

            <p style={S.cardDesc}>
              {isStudent
                ? 'Ketik tepat 3 nama kriteria utama ke bawah (Student Edition diatur 3 kriteria agar rasio konsistensi CR dapat dihitung).'
                : 'Ketik nama kriteria ke bawah (pisahkan dengan Enter atau Koma).'}
            </p>

            <div style={S.fieldGroup}>
              <textarea
                style={{ ...S.input, minHeight: 120, resize: 'vertical', lineHeight: 1.5, background: loadingAi ? '#f8fafc' : '#fff' }}
                value={loadingAi ? 'Menganalisis topik...\nMembangun hierarki kriteria...' : kriteriaText}
                disabled={loadingAi}
                onChange={(e) => setKriteriaText(e.target.value)}
                placeholder={isStudent ? 'Kriteria 1 (Contoh: Aspek Lingkungan)\nKriteria 2 (Contoh: Aspek Ekonomi)\nKriteria 3 (Contoh: Aspek Sosial)' : 'Aspek Lingkungan\nAspek Sosial\nAspek Ekonomi'}
              />
            </div>

            <div style={{ marginTop: 16, background: canUseSubcriteria ? '#eff6ff' : '#f8fafc', padding: 12, borderRadius: 10, border: canUseSubcriteria ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
              <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 8, cursor: canUseSubcriteria ? 'pointer' : 'not-allowed', fontSize: 12.5, color: canUseSubcriteria ? '#1e3a8a' : '#64748b' }}>
                <input
                  type="checkbox"
                  checked={canUseSubcriteria && gunakanSubkriteria}
                  disabled={!canUseSubcriteria}
                  onChange={(e) => { if (canUseSubcriteria) setGunakanSubkriteria(e.target.checked) }}
                  style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: canUseSubcriteria ? 'pointer' : 'not-allowed' }}
                />
                <span>
                  Aktifkan Subkriteria {isStudent ? '(Tepat 3 subkriteria per kriteria)' : '(Pecah kriteria menjadi sub-elemen)'}
                  {!canUseSubcriteria && ' 🔒 [Belum Diaktifkan di Subscription SuperAdmin]'}
                </span>
              </label>
            </div>

            {canUseSubcriteria && gunakanSubkriteria && kriteriaArray.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 12 }}>
                  Rincian Subkriteria {isStudent && <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>(Tepat 3 per kriteria)</span>}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {kriteriaArray.map((crit) => {
                    const isCritLoading = Boolean(loadingSubAi[crit])
                    const currentSubs = parseMultiLines(subkriteriaTextMap[crit] || '')
                    return (
                      <div key={crit} style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: isStudent && (currentSubs.length < 3 || currentSubs.length > 3) ? '1.5px solid #dc2626' : '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <label style={{ ...S.label, margin: 0, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong>{crit}</strong> {isStudent && <span style={{ fontSize: 11, color: currentSubs.length !== 3 ? '#dc2626' : '#2563eb' }}>({currentSubs.length}/3)</span>}
                          </label>
                          {!isStudent && (
                            <button
                              type="button"
                              onClick={() => handleGenerateSingleSubcriteria(crit)}
                              disabled={isCritLoading || !isAiAllowed}
                              style={{
                                background: isAiAllowed ? '#eff6ff' : '#f1f5f9',
                                color: isAiAllowed ? '#1d4ed8' : '#94a3b8',
                                border: isAiAllowed ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: !isAiAllowed ? 'not-allowed' : isCritLoading ? 'wait' : 'pointer',
                              }}
                            >
                              {isCritLoading ? '⏳ Menyusun...' : isAiAllowed ? '🪄 Susun Sub' : '🔒 Terkunci'}
                            </button>
                          )}
                        </div>
                        <textarea
                          style={{ ...S.input, minHeight: 85, resize: 'vertical', fontSize: 12.5 }}
                          value={isCritLoading ? 'Sistem sedang merumuskan subkriteria...' : subkriteriaTextMap[crit] || ''}
                          disabled={isCritLoading}
                          onChange={(e) => setSubkriteriaTextMap((prev) => ({ ...prev, [crit]: e.target.value }))}
                          placeholder={isStudent ? 'Subkriteria 1\nSubkriteria 2\nSubkriteria 3' : 'Subkriteria 1\nSubkriteria 2'}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. DAFTAR ALTERNATIF */}
          {metode === 'Bobot alternatif' && canUseAlternatives && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>
                3. Daftar Alternatif Pilihan{' '}
                <span style={isStudent && (alternatifArray.length < 2 || alternatifArray.length > 3) ? { ...S.badge, background: '#fef2f2', color: '#dc2626' } : S.badge}>
                  {isStudent ? `${alternatifArray.length} / 3 alternatif (Min. 2)` : `${alternatifArray.length} aktif`}
                </span>
              </h3>
              <p style={S.cardDesc}>
                {isStudent
                  ? 'Ketik 2 hingga 3 alternatif pilihan ke bawah (Student Edition dibatasi maksimal 3 alternatif).'
                  : 'Ketik nama alternatif ke bawah (pisahkan dengan Enter atau Koma).'}
              </p>
              <div style={S.fieldGroup}>
                <textarea
                  style={{ ...S.input, minHeight: 100, resize: 'vertical', lineHeight: 1.5 }}
                  value={alternatifText}
                  onChange={(e) => setAlternatifText(e.target.value)}
                  placeholder={isStudent ? 'Alternatif A\nAlternatif B\nAlternatif C' : 'Vendor A\nVendor B\nVendor C'}
                />
              </div>
            </div>
          )}

          {/* 4. TIM PAKAR */}
          <div 
            style={{
              ...S.card,
              position: 'relative',
              zIndex: activeSuggestionIndex !== null ? 50 : 2,
            }} 
            className="tour-pakar"
          >
            <h3 style={S.cardTitle}>
              <span>4. Tim Pakar (Expert Responden)</span>
              {isStudent ? (
                <span style={{ ...S.badgeGlobal, background: '#fef3c7', color: '#92400e' }}>
                  🎓 Student Edition: 2 Pakar Simulasi
                </span>
              ) : (
                <span style={S.badgeGlobal}>
                  {resolvedMaxExpertsDirectory === 0
                    ? `📝 Input Manual (Maks. ${resolvedMaxExpertsManual} Pakar)`
                    : `🔍 Kuota Direktori: ${resolvedMaxExpertsDirectory >= 99999 ? 'Unlimited' : resolvedMaxExpertsDirectory}`}
                </span>
              )}
            </h3>

            {isStudent ? (
              <div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', color: '#1e40af', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  💡 <strong>AHP Student Edition:</strong> Proyek ini menggunakan <strong>2 Pakar Simulasi Standar</strong> yang telah disediakan secara otomatis oleh sistem. Matriks perbandingan berpasangan dinilai oleh kedua pakar simulasi ini tanpa perlu input pakar manual[cite: 24].
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: 12, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Pakar Evaluator 1 (Simulasi)
                      </span>
                      <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ✓ Terpasang
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                      Prof. Linglungan
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                      📧 pakar1@gmail.com
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                      🏢 Laboratorium Simulasi AHP
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: 12, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Pakar Evaluator 2 (Simulasi)
                      </span>
                      <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ✓ Terpasang
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                      DR. Raos
                    </div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                      📧 pakar2@gmail.com
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                      🏢 Laboratorium Simulasi AHP
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {resolvedMaxExpertsDirectory > 0 ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#166534', fontSize: 12.5, marginBottom: 14 }}>
                    💡 <strong>Akses Direktori Aktif:</strong> Ketik nama pakar di kolom <em>Nama Inti / Utama</em> untuk memilih langsung dari <strong>Direktori Pakar</strong>, atau masukkan data secara manual (Maks. {resolvedMaxExpertsManual} pakar)[cite: 24].
                  </div>
                ) : (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', color: '#92400e', fontSize: 12.5, lineHeight: 1.5, marginBottom: 16 }}>
                    💡 <strong>Mode Paket {userPlan.toUpperCase()}:</strong> Anda dapat mengundang hingga <strong>{resolvedMaxExpertsManual} Pakar Manual</strong> secara mandiri via email/tautan kuesioner. Akses Direktori Pakar platform terkunci (0 pakar)[cite: 24].
                  </div>
                )}

                <div style={S.fieldGroup}>
                  <label style={S.label}>
                    Jumlah Pakar Responden (Maksimal: {resolvedMaxExpertsManual >= 99999 ? 'Unlimited' : resolvedMaxExpertsManual})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="button" onClick={() => handleJumlahExpert(jumlahExpert - 1)} style={S.counterBtn}>–</button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{jumlahExpert}</span>
                    <button type="button" onClick={() => handleJumlahExpert(jumlahExpert + 1)} style={S.counterBtn}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                  {experts.map((exp, i) => {
                    const expSearch = String(exp.name || '').toLowerCase().trim()

                    // 🟢 Hanya pakar publik yang disaring untuk dropdown saran (privat & simulasi otomatis tersaring)
                    const filteredSuggestions =
                      resolvedMaxExpertsDirectory > 0
                        ? directoryExperts.filter((item) => {
                            const isPub = item.is_public === true || item.is_public === 1 || String(item.is_public).toUpperCase() === 'PUBLIK'
                            const pEmail = String(item.expert_email || '').toLowerCase().trim()
                            const pName = String(item.expert_name || '').toLowerCase().trim()
                            const pSource = String(item.source || '').toUpperCase().trim()

                            // Tolak pakar privat dan simulasi
                            if (!isPub || pSource === 'SIMULASI' || pEmail === 'pakar1@gmail.com' || pEmail === 'pakar2@gmail.com' || pName.includes('linglungan') || pName.includes('raos')) {
                              return false
                            }

                            if (!expSearch) return true
                            const pInst = String(item.asal_instansi || '').toLowerCase()
                            return pName.includes(expSearch) || pInst.includes(expSearch) || pEmail.includes(expSearch)
                          })
                        : []

                    const isFromDirectory = Boolean(
                      (exp.expertId && String(exp.expertId).trim() !== '') ||
                      directoryExperts.some(
                        (d) => String(d.expert_email || '').trim().toLowerCase() === String(exp.email || '').trim().toLowerCase() && String(exp.email || '').trim() !== ''
                      )
                    )

                    return (
                      <div 
                        key={i} 
                        style={{ 
                          background: '#f8fafc', 
                          border: exp.fieldError ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0', 
                          borderRadius: 10, 
                          padding: 16, 
                          position: 'relative',
                          zIndex: activeSuggestionIndex === i ? 60 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                            Pakar Responden {i + 1}{' '}
                            {isFromDirectory && (
                              <span style={{ color: '#166534', fontSize: 11, background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>
                                ✓ Terdaftar di Direktori Pakar
                              </span>
                            )}
                          </div>
                          {isFromDirectory && (
                            <button
                              type="button"
                              onClick={() => {
                                setExperts((prev) => {
                                  const updated = [...prev]
                                  updated[i] = { expertId: '', gelarDepan: '', name: '', gelarBelakang: '', email: '', whatsapp: '', fieldError: '' }
                                  return updated
                                })
                              }}
                              style={{ fontSize: 11.5, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                            >
                              🔄 Ganti / Reset ke Manual
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 12 }}>
                          <div style={S.fieldGroup}>
                            <label style={S.label}>Gelar Depan</label>
                            <input
                              style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }}
                              type="text"
                              value={exp.gelarDepan}
                              readOnly={isFromDirectory}
                              onChange={(e) => updateExpertField(i, 'gelarDepan', e.target.value)}
                              placeholder="Dr. / Ir."
                            />
                          </div>

                          <div style={{ ...S.fieldGroup, position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={S.label}>Nama Inti / Utama <span style={{ color: '#dc2626' }}>*</span></label>
                              {resolvedMaxExpertsDirectory > 0 && !isFromDirectory && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSuggestionIndex(activeSuggestionIndex === i ? null : i)}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                >
                                  {activeSuggestionIndex === i ? 'Tutup Daftar ✕' : '🔍 Lihat Direktori'}
                                </button>
                              )}
                            </div>

                            <input
                              style={{
                                ...S.input,
                                background: isFromDirectory ? '#f1f5f9' : 'white',
                                borderColor: activeSuggestionIndex === i ? '#2563eb' : '#cbd5e1',
                              }}
                              type="text"
                              value={exp.name}
                              readOnly={isFromDirectory}
                              onFocus={() => {
                                if (resolvedMaxExpertsDirectory > 0 && !isFromDirectory) {
                                  setActiveSuggestionIndex(i)
                                }
                              }}
                              onChange={(e) => {
                                const val = e.target.value
                                setExperts((prev) => {
                                  const updated = [...prev]
                                  updated[i] = { ...updated[i], name: val, expertId: '', fieldError: '' }
                                  return updated
                                })
                                if (resolvedMaxExpertsDirectory > 0) setActiveSuggestionIndex(i)
                              }}
                              placeholder={isFromDirectory ? exp.name : resolvedMaxExpertsDirectory > 0 ? 'Ketik nama untuk mencari di direktori...' : 'Nama lengkap pakar...'}
                              required
                            />

                            {resolvedMaxExpertsDirectory > 0 && !isFromDirectory && activeSuggestionIndex === i && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  zIndex: 1000,
                                  background: '#ffffff',
                                  border: '1.5px solid #2563eb',
                                  borderRadius: 8,
                                  boxShadow: '0 12px 28px rgba(15,23,42,0.22)',
                                  marginTop: 4,
                                  maxHeight: 220,
                                  overflowY: 'auto',
                                }}
                              >
                                <div
                                  style={{
                                    padding: '8px 12px',
                                    background: '#eff6ff',
                                    borderBottom: '1px solid #bfdbfe',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#1e40af',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 1,
                                  }}
                                >
                                  <span>Pilih Pakar ({filteredSuggestions.length} tersedia):</span>
                                  <span onClick={() => setActiveSuggestionIndex(null)} style={{ cursor: 'pointer', color: '#64748b' }}>✕</span>
                                </div>

                                {filteredSuggestions.length === 0 ? (
                                  <div style={{ padding: 12, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                                    Tidak ada pakar publik yang sesuai. Anda tetap dapat mengisinya secara manual[cite: 24].
                                  </div>
                                ) : (
                                  filteredSuggestions.map((item, idx) => (
                                    <div
                                      key={idx}
                                      onClick={() => handleSelectExpertFromDirectory(i, item)}
                                      style={{
                                        padding: '9px 12px',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                                    >
                                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                        {item.expert_name}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        🏢 {item.asal_instansi || '-'}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          <div style={S.fieldGroup}>
                            <label style={S.label}>Gelar Belakang</label>
                            <input
                              style={{ ...S.input, background: isFromDirectory ? '#f1f5f9' : 'white' }}
                              type="text"
                              value={exp.gelarBelakang}
                              readOnly={isFromDirectory}
                              onChange={(e) => updateExpertField(i, 'gelarBelakang', e.target.value)}
                              placeholder="M.Sc. / Ph.D."
                            />
                          </div>
                        </div>

                        {exp.fieldError && <div style={S.fieldErrorBox}>⚠️ {exp.fieldError}</div>}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                          <div style={S.fieldGroup}>
                            <label style={S.label}>Email Pakar <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                              style={{ ...S.input, background: isFromDirectory ? '#f8fafc' : 'white' }}
                              type="email"
                              value={exp.email}
                              onChange={(e) => updateExpertField(i, 'email', e.target.value)}
                              placeholder="email@pakar.com"
                              required
                            />
                          </div>
                          <div style={S.fieldGroup}>
                            <label style={S.label}>WhatsApp Pakar <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                              style={{ ...S.input, background: isFromDirectory ? '#f8fafc' : 'white' }}
                              type="text"
                              value={exp.whatsapp}
                              readOnly={isFromDirectory && Boolean(exp.expertId)}
                              onChange={(e) => updateExpertField(i, 'whatsapp', e.target.value)}
                              placeholder="6281234..."
                              required
                            />
                          </div>
                        </div>

                        {isFromDirectory && (
                          <div style={{ marginTop: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af', lineHeight: 1.4 }}>
                            🔒 <strong>Pakar Terdaftar di Direktori:</strong> Email cocok dengan data master direktori. Profil dan nama resmi (<strong>{exp.name}</strong>) akan dipasangkan secara otomatis ke proyek dan tidak akan tertimpa oleh ketikan manual[cite: 24].
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. IDENTITAS & KONTAK FASILITATOR */}
          <div style={{ ...S.card, position: 'relative', zIndex: 1 }}>
            <h3 style={S.cardTitle}>5. Identitas &amp; Kontak Fasilitator <span style={{ ...S.optBadge, background: '#fef2f2', color: '#dc2626' }}>Wajib</span></h3>
            <p style={S.cardDesc}>Data fasilitator utama otomatis terikat pada akun Anda untuk dicantumkan pada lembar pengesahan laporan[cite: 24].</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Nama Fasilitator / Peneliti <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={S.input} type="text" value={fasilitatorNama} onChange={(e) => setFasilitatorNama(e.target.value)} placeholder="Nama Fasilitator" required />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Email Fasilitator (Akun Login) <span style={{ color: '#dc2626' }}>*</span></label>
                <input 
                  style={{ ...S.input, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} 
                  type="email" 
                  value={fasilitatorEmail} 
                  readOnly 
                  title="Terkunci otomatis sesuai email akun login Anda agar tidak tertukar" 
                  required 
                />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>WhatsApp Fasilitator <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={S.input} type="text" value={fasilitatorWhatsapp} onChange={(e) => setFasilitatorWhatsapp(e.target.value)} placeholder="08123456789" required />
              </div>
            </div>
          </div>

          <div style={S.footer}>
            <button type="button" onClick={() => router.back()} style={S.btnCancel}>Batal</button>
            <button type="button" className="tour-simpan" onClick={handleSimpan} disabled={loading || isQuotaFull} style={loading || isQuotaFull ? { ...S.btnSimpan, ...S.btnDisabled } : S.btnSimpan}>
              {loading ? 'Menyimpan ke Database...' : isQuotaFull ? 'Kuota Penuh' : 'Simpan & Buat Proyek'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function BuatProyekPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat formulir proyek baru...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <BuatProyekContent />
    </Suspense>
  )
}

const topBarStyles: Record<string, CSSProperties> = {
  container: {
    background: 'linear-gradient(270deg, #15803d 0%, rgba(255, 255, 255, 0.9) 100%)',
    border: '1px solid #86efac',
    borderRadius: 10,
    padding: '14px 20px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    height: 80,
    width: 'auto',
    objectFit: 'contain',
    opacity: 0.85,
    mixBlendMode: 'multiply',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#064e3b',
    letterSpacing: '0.04em',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#065f46',
    fontWeight: 600,
  },
}

const styles: Record<string, CSSProperties> = {
  layoutWrapper: { display: 'flex', minHeight: '100vh', width: '100%' },
  mainContent: {
    flex: 1,
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.55)), url("/bg-academic.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    fontFamily: 'Segoe UI, system-ui, sans-serif',
    paddingBottom: 160,
    overflowX: 'hidden',
  },
  loadingPage: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: '#334155', background: '#f8fafc' },
  spinner: { width: 36, height: 36, border: '3px solid rgba(37,99,235,0.15)', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  container: { maxWidth: 880, margin: '0 auto', padding: '24px 20px 80px 20px' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  backBtn: { padding: '8px 12px', background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: '#334155', fontWeight: 700, flexShrink: 0 },
  academicTag: { display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#93c5fd', background: 'rgba(30, 58, 138, 0.6)', padding: '3px 8px', borderRadius: 4, marginBottom: 4, border: '1px solid rgba(147, 197, 253, 0.3)' },
  studentTag: { display: 'inline-block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fef08a', background: 'rgba(161, 98, 7, 0.7)', padding: '3px 8px', borderRadius: 4, marginBottom: 4, border: '1px solid rgba(254, 240, 138, 0.4)' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#ffffff', margin: '0 0 2px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' },
  pageSubtitle: { fontSize: 12.5, color: '#e2e8f0', margin: 0 },
  quotaBadge: { background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  card: { background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.5)', borderRadius: 16, padding: '18px 22px', marginBottom: 14, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)' },
  cardTitle: { fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badgeGlobal: { background: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  cardDesc: { fontSize: 12, color: '#64748b', margin: '0 0 12px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12.5, fontWeight: 700, color: '#1e293b' },
  input: { width: '100%', padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13.5, color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  fieldErrorBox: { marginTop: 6, marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', color: '#dc2626', fontSize: 12, fontWeight: 600 },
  radioBtn: { padding: '9px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' },
  radioBtnActive: { border: '1.5px solid #2563eb', background: '#eff6ff', color: '#1d4ed8' },
  badge: { fontSize: 11, background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '2px 8px', fontWeight: 600 },
  optBadge: { fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px', fontWeight: 500 },
  counterBtn: { width: 30, height: 30, background: '#eff6ff', color: '#1d4ed8', border: '1.5px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 12.5, fontWeight: 600, marginBottom: 14 },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
  btnCancel: { padding: '10px 20px', background: 'white', border: '1.5px solid #cbd5e1', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569' },
  btnSimpan: { padding: '10px 24px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
  btnDisabled: { background: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' },
}