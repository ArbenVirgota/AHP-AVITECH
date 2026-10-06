// app/admin/super-control/page.tsx

'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const PRINT_STYLES = `
  @media print {
    header, .no-print, button { display: none !important; }
    body, .content-card { background: #fff !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
    .print-header { display: block !important; text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
  }
  .print-header { display: none; }
`

interface AdminItem {
  id?: string | number;
  email?: string;
  name?: string;
  nama?: string;
  role?: string;
  status?: string;
  wewenang_modul?: string;
  [key: string]: any;
}

interface PlanSetting {
  plan_key: string
  label: string
  price: number
  duration_months: number
  max_projects: number
  max_experts_manual: number
  max_experts_directory: number
  max_consultation_per_expert: number
  allow_subcriteria: boolean
  allow_alternative_method: boolean
  allow_ai_features: boolean
}

interface UserSubscriptionItem {
  id?: string
  user_id?: string
  user_email?: string
  email?: string
  user_name?: string
  nama?: string
  plan?: string
  status?: string
  status_user?: string
  expired_date?: string
  custom_max_projects?: number | string
  custom_max_experts?: number | string
  custom_max_experts_directory?: number | string
  custom_max_consultation_per_expert?: number | string
  custom_features?: string
  notes?: string
  [key: string]: any
}

interface ArchivedProjectItem {
  project_id: string
  nama_proyek: string
  pemilik: string
  created_at: string
  updated_at: string
}

function parseBooleanVal(val: unknown): boolean {
  if (val === true || val === 1 || val === '1') return true
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true
  return false
}

export default function SuperAdminControlPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const [activeTab, setActiveTab] = useState<'admin_performance' | 'admins_management' | 'subscriptions' | 'plans_config' | 'signature_stamp' | 'project_retention'>('admin_performance');

  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [adminLogsList, setAdminLogsList] = useState<any[]>([]);

  const [userSubs, setUserSubscriptions] = useState<UserSubscriptionItem[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  
  const [plans, setPlans] = useState<PlanSetting[]>([
    { plan_key: 'FREE', label: 'Free Pass', price: 0, duration_months: 6, max_projects: 1, max_experts_manual: 4, max_experts_directory: 0, max_consultation_per_expert: 0, allow_subcriteria: false, allow_alternative_method: false, allow_ai_features: false },
    { plan_key: 'PRO', label: 'PRO', price: 150000, duration_months: 6, max_projects: 3, max_experts_manual: 8, max_experts_directory: 5, max_consultation_per_expert: 3, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: false },
    { plan_key: 'PLUS', label: 'PLUS', price: 350000, duration_months: 6, max_projects: 10, max_experts_manual: 15, max_experts_directory: 10, max_consultation_per_expert: 5, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true },
    { plan_key: 'PREMIUM', label: 'PREMIUM', price: 750000, duration_months: 6, max_projects: 999999, max_experts_manual: 999999, max_experts_directory: 999999, max_consultation_per_expert: 15, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true }
  ]);

  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    user_email: '',
    plan: 'FREE',
    status: 'ACTIVE',
    status_user: 'general',
    expired_date: '',
    custom_max_projects: '',
    custom_max_experts: '',
    custom_max_experts_directory: '',
    custom_max_consultation_per_expert: '',
    custom_features: '',
    custom_allow_subcriteria: false,
    custom_allow_alternative: false,
    custom_allow_ai: false,
    notes: ''
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminItem | null>(null);
  const [adminForm, setAdminForm] = useState({
    id: undefined as string | number | undefined,
    email: '',
    password: '',
    name: '',
    role: 'Admin Pembantu',
    status: 'Aktif',
    allowed_access: ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'] as string[]
  });
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  const activeSignerTypeState = useState<'main' | 'backup'>('main');
  const activeSignerType = activeSignerTypeState[0];
  const setActiveSignerType = activeSignerTypeState[1];
  const [superAdminSignatureUrl, setSuperAdminSignatureUrl] = useState('');
  const [backupSignerName, setBackupSignerName] = useState('');
  const [backupSignerTitle, setBackupSignerTitle] = useState('Wakil System Admin / Perwakilan SuperAdmin');
  const [backupSignerSignatureUrl, setBackupSignerSignatureUrl] = useState('');
  const [appSystemStampUrl, setAppSystemStampUrl] = useState('');
  
  const [xenditActive, setXenditActive] = useState(true);
  const [xenditMode, setXenditMode] = useState('sandbox');
  const [xenditPublicKey, setXenditPublicKey] = useState('');
  const [xenditSecretKey, setXenditSecretKey] = useState('');
  const [diditMeActive, setDiditMeActive] = useState(true);
  const [diditApiKey, setDiditApiKey] = useState('');

  const [expirationMonths, setExpirationMonths] = useState<number>(6);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState<boolean>(true);
  const [savingRetention, setSavingRetention] = useState<boolean>(false);
  const [runningArchive, setRunningArchive] = useState<boolean>(false);

  // Retensi Mahasiswa (Student Edition)
  const [studentRetentionDays, setStudentRetentionDays] = useState<number>(30);
  const [savingStudentRetention, setSavingStudentRetention] = useState<boolean>(false);
  const [studentStats, setStudentStats] = useState({
    totalStudents: 0,
    totalStudentProjects: 0,
    expiredProjectsCount: 0,
    expiredProjectsList: [] as any[],
  });
  const [loadingStudentCleanup, setLoadingStudentCleanup] = useState<boolean>(false);
  const [studentCleanupMsg, setStudentCleanupMsg] = useState('');
  const [studentCleanupErr, setStudentCleanupErr] = useState('');

  const [archivedList, setArchivedList] = useState<ArchivedProjectItem[]>([]);
  const [loadingArchiveList, setLoadingArchiveList] = useState<boolean>(false);

  const fetchSuperData = useCallback(async () => {
    try {
      setLoading(true);
      setApiError('');

      const res = await fetch(`/api/admin/super-control?_t=${Date.now()}`, {
        cache: 'no-store'
      });
      const json = await res.json();

      if (json && json.success && json.data) {
        setAdminLogsList(json.data.adminLogs || []);
        setAdmins(json.data.admins || []);
        setUserSubscriptions(json.data.subscriptions || []);

        if (Array.isArray(json.data.planConfigs) && json.data.planConfigs.length > 0) {
          const orderMap: Record<string, number> = { FREE: 1, PRO: 2, PLUS: 3, PREMIUM: 4 };

          const mappedPlans: PlanSetting[] = json.data.planConfigs.map((p: any) => ({
            plan_key: String(p.plan_key || p.plan || '').toUpperCase().trim(),
            label: String(p.label || p.plan_key || ''),
            price: Number(p.price ?? 0),
            duration_months: Number(p.duration_months ?? 6),
            max_projects: Number(p.max_projects ?? 0),
            max_experts_manual: Number(p.max_experts_manual ?? 0),
            max_experts_directory: Number(p.max_experts_directory ?? 0),
            max_consultation_per_expert: Number(p.max_consultation_per_expert ?? 0),
            allow_subcriteria: parseBooleanVal(p.allow_subcriteria),
            allow_alternative_method: parseBooleanVal(p.allow_alternative_method),
            allow_ai_features: parseBooleanVal(p.allow_ai_features),
          }));

          mappedPlans.sort((a, b) => (orderMap[a.plan_key] || 99) - (orderMap[b.plan_key] || 99));
          setPlans(mappedPlans);
        }

        if (json.data.systemAssets) {
          const sa = json.data.systemAssets;
          setActiveSignerType((sa.active_signer_type as 'main' | 'backup') || 'main');
          setSuperAdminSignatureUrl(sa.superadmin_signature_url || '');
          setBackupSignerName(sa.backup_signer_name || '');
          setBackupSignerTitle(sa.backup_signer_title || 'Wakil System Admin / Perwakilan SuperAdmin');
          setBackupSignerSignatureUrl(sa.backup_signer_signature_url || '');
          setAppSystemStampUrl(sa.app_system_stamp_url || '');

          if (sa.project_retention_months) {
            setExpirationMonths(Number(sa.project_retention_months));
          }
          if (sa.project_auto_archive_enabled !== undefined) {
            setAutoDeleteEnabled(sa.project_auto_archive_enabled === '1' || sa.project_auto_archive_enabled === 'true');
          }
          if (sa.student_retention_days) {
            setStudentRetentionDays(Number(sa.student_retention_days));
          }
        }

        if (json.data.paymentSettings) {
          const ps = json.data.paymentSettings;
          setXenditActive(ps.xendit_active === '1' || ps.xendit_active === 'true');
          setXenditMode(ps.xendit_mode || 'sandbox');
          setXenditPublicKey(ps.xendit_public_key || '');
          setXenditSecretKey(ps.xendit_secret_key || '');
        }

        if (json.data.diditSettings) {
          const ds = json.data.diditSettings;
          setDiditMeActive(ds.didit_me_active === '1' || ds.didit_me_active === 'true');
          setDiditApiKey(ds.didit_api_key || '');
        }

      } else {
        setApiError(json?.message || 'Gagal memuat data kontrol SuperAdmin.');
      }
    } catch (err: any) {
      setApiError(`Gagal mengambil data kontrol: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArchivedProjects = useCallback(async () => {
    try {
      setLoadingArchiveList(true);
      const res = await fetch(`/api/admin/archive-actions?_t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json && json.success) setArchivedList(json.data || []);
    } catch (err: any) {
      console.error('Gagal mengambil daftar arsip:', err);
    } finally {
      setLoadingArchiveList(false);
    }
  }, []);

  const fetchStudentRetentionStats = useCallback(async (retentionDaysParam?: number) => {
    try {
      setLoadingStudentCleanup(true);
      setStudentCleanupErr('');
      const days = retentionDaysParam ?? studentRetentionDays;
      const res = await fetch(`/api/admin/cleanup-student-projects?days=${days}&_t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (json && json.success) {
        setStudentStats(json.data);
      }
    } catch (err: any) {
      console.error('Gagal memuat status retensi mahasiswa:', err);
    } finally {
      setLoadingStudentCleanup(false);
    }
  }, [studentRetentionDays]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role') || '';
    const name = localStorage.getItem('admin_name') || 'SuperAdmin';
    const email = localStorage.getItem('admin_email') || '';

    const isSuper = role.toLowerCase().includes('superadmin') || role.toLowerCase().includes('super admin');

    if (!token || !isSuper) {
      alert('⛔ Akses Ditolak: Halaman ini khusus untuk SuperAdmin.');
      router.replace('/admin/dashboard');
      return;
    }

    setAdminName(name);
    setAdminEmail(email);
    setAdminRole(role);

    fetchSuperData();
  }, [router, fetchSuperData]);

  useEffect(() => {
    if (activeTab === 'project_retention') {
      fetchArchivedProjects();
      fetchStudentRetentionStats();
    }
  }, [activeTab, fetchArchivedProjects, fetchStudentRetentionStats]);

  const adminPerformanceStats = useMemo(() => {
    const statsByAdmin: Record<string, { name: string; role: string; email: string; totalActions: number; lastActive: string }> = {};

    adminLogsList.forEach((log) => {
      const email = String(log.email_admin || log.adminEmail || 'unknown@admin.com').toLowerCase().trim();
      const name = String(log.nama_admin || log.adminName || email).trim();
      const role = String(log.role || log.adminRole || 'Admin').trim();
      const timestamp = String(log.timestamp || '-').trim();

      if (!statsByAdmin[email]) {
        statsByAdmin[email] = { name, role, email, totalActions: 0, lastActive: timestamp };
      }

      statsByAdmin[email].totalActions += 1;
      statsByAdmin[email].lastActive = timestamp;
    });

    return Object.values(statsByAdmin);
  }, [adminLogsList]);

  const filteredUserSubs = useMemo(() => {
    const q = subSearchQuery.toLowerCase().trim();
    return userSubs.filter((item) => {
      if (!q) return true;
      const email = String(item.user_email || item.email || '').toLowerCase();
      const name = String(item.user_name || item.nama || '').toLowerCase();
      const plan = String(item.plan || '').toLowerCase();
      return email.includes(q) || name.includes(q) || plan.includes(q);
    });
  }, [userSubs, subSearchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      alert('⚠️ Ukuran gambar maksimal 250 KB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({ 
      id: undefined,
      email: '', 
      password: '', 
      name: '', 
      role: 'Admin Pembantu', 
      status: 'Aktif', 
      allowed_access: ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'] 
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEditAdmin = (adm: AdminItem) => {
    setEditingAdmin(adm);
    let accessList: string[] = ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'];
    if (adm.wewenang_modul) {
      try {
        const temp = typeof adm.wewenang_modul === 'string' ? JSON.parse(adm.wewenang_modul) : adm.wewenang_modul;
        accessList = Array.isArray(temp) ? temp : String(temp).split(',');
      } catch {
        accessList = String(adm.wewenang_modul).split(',');
      }
    }
    setAdminForm({
      id: adm.id,
      email: String(adm.email || ''),
      password: '',
      name: String(adm.nama || adm.name || ''),
      role: String(adm.role || 'Admin Pembantu'),
      status: String(adm.status || 'Aktif'),
      allowed_access: accessList.map(a => String(a).replace(/[\[\]"']/g, '').trim())
    });
    setIsAdminModalOpen(true);
  };

  const toggleAccessCheck = (key: string) => {
    setAdminForm(prev => {
      const current = [...prev.allowed_access];
      return { ...prev, allowed_access: current.includes(key) ? current.filter(k => k !== key) : [...current, key] };
    });
  };

  const handleSaveAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAdmin && (!adminForm.password || adminForm.password.trim().length < 6)) {
      alert('⚠️️ Kata sandi admin baru wajib diisi minimal 6 karakter.');
      return;
    }

    try {
      setSubmittingAdmin(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_admin',
          id: adminForm.id,
          nama: adminForm.name,
          email: adminForm.email,
          password: adminForm.password,
          role: adminForm.role,
          status: adminForm.status,
          allowed_access: adminForm.allowed_access,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setIsAdminModalOpen(false);
        fetchSuperData();
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adm: AdminItem) => {
    const email = String(adm.email || '').trim();
    const name = String(adm.nama || adm.name || 'Admin');
    if (!window.confirm(`⚠️ PERINGATAN: Yakin ingin menghapus akun admin "${name}" (${email})?`)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_admin',
          email: email,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchSuperData();
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditSub = (item: UserSubscriptionItem) => {
    const currentPlanKey = String(item.plan || 'FREE').toUpperCase();
    const matchedPlan = plans.find(p => p.plan_key.toUpperCase() === currentPlanKey);

    const isStudentUser = String(item.status_user || '').toLowerCase() === 'student';

    const initialProjects = item.custom_max_projects !== undefined && item.custom_max_projects !== null && item.custom_max_projects !== ''
      ? String(item.custom_max_projects)
      : (isStudentUser ? '2' : (matchedPlan ? String(matchedPlan.max_projects) : ''));

    const initialExperts = item.custom_max_experts !== undefined && item.custom_max_experts !== null && item.custom_max_experts !== ''
      ? String(item.custom_max_experts)
      : (isStudentUser ? '2' : (matchedPlan ? String(matchedPlan.max_experts_manual) : ''));

    const initialDir = item.custom_max_experts_directory !== undefined && item.custom_max_experts_directory !== null && item.custom_max_experts_directory !== ''
      ? String(item.custom_max_experts_directory)
      : (isStudentUser ? '0' : (matchedPlan ? String(matchedPlan.max_experts_directory) : ''));

    const initialConsult = item.custom_max_consultation_per_expert !== undefined && item.custom_max_consultation_per_expert !== null && item.custom_max_consultation_per_expert !== ''
      ? String(item.custom_max_consultation_per_expert)
      : (isStudentUser ? '0' : (matchedPlan ? String(matchedPlan.max_consultation_per_expert) : ''));

    const rawCustom = String(item.custom_features || '').toLowerCase();
    const customList = rawCustom.split(',').map(s => s.trim()).filter(Boolean);
    const hasCustomDefined = customList.length > 0;

    const initialSub = hasCustomDefined 
      ? (customList.includes('subcriteria') || customList.includes('subkriteria'))
      : (isStudentUser ? true : Boolean(matchedPlan?.allow_subcriteria));

    const initialAlt = hasCustomDefined
      ? (customList.includes('alternative') || customList.includes('alternatif'))
      : (isStudentUser ? true : Boolean(matchedPlan?.allow_alternative_method));

    const initialAi = hasCustomDefined
      ? (customList.includes('ai') || customList.includes('gemini') || customList.includes('ai_analysis'))
      : (isStudentUser ? false : Boolean(matchedPlan?.allow_ai_features));

    setSubForm({
      user_email: String(item.user_email || item.email || ''),
      plan: currentPlanKey,
      status: String(item.status || 'ACTIVE').toUpperCase(),
      status_user: isStudentUser ? 'student' : 'general',
      expired_date: String(item.expired_date || '').slice(0, 10),
      custom_max_projects: initialProjects,
      custom_max_experts: initialExperts,
      custom_max_experts_directory: initialDir,
      custom_max_consultation_per_expert: initialConsult,
      custom_features: String(item.custom_features || ''),
      custom_allow_subcriteria: initialSub,
      custom_allow_alternative: initialAlt,
      custom_allow_ai: initialAi,
      notes: String(item.notes || '')
    });
    setIsEditSubModalOpen(true);
  };

  const handlePlanSelectChange = (newPlanKey: string) => {
    const planKeyUpper = newPlanKey.toUpperCase();
    const matchedPlan = plans.find(p => p.plan_key.toUpperCase() === planKeyUpper);

    if (matchedPlan) {
      setSubForm(prev => ({
        ...prev,
        plan: planKeyUpper,
        custom_max_projects: String(matchedPlan.max_projects),
        custom_max_experts: String(matchedPlan.max_experts_manual),
        custom_max_experts_directory: String(matchedPlan.max_experts_directory),
        custom_max_consultation_per_expert: String(matchedPlan.max_consultation_per_expert),
        custom_allow_subcriteria: Boolean(matchedPlan.allow_subcriteria),
        custom_allow_alternative: Boolean(matchedPlan.allow_alternative_method),
        custom_allow_ai: Boolean(matchedPlan.allow_ai_features),
      }));
    } else {
      setSubForm(prev => ({
        ...prev,
        plan: planKeyUpper
      }));
    }
  };

  const handleSaveUserSub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);

      const features: string[] = [];
      if (subForm.custom_allow_subcriteria) features.push('subcriteria');
      if (subForm.custom_allow_alternative) features.push('alternative');
      if (subForm.custom_allow_ai) features.push('ai');
      const compiledFeatures = features.join(',');

      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_subscription',
          user_email: subForm.user_email,
          plan: subForm.plan.toUpperCase(),
          status: subForm.status.toUpperCase(),
          status_user: subForm.status_user,
          expired_date: subForm.expired_date,
          max_projects: subForm.custom_max_projects,
          max_experts: subForm.status_user === 'student' ? 2 : subForm.custom_max_experts,
          max_experts_directory: subForm.status_user === 'student' ? 0 : subForm.custom_max_experts_directory,
          max_consultation_per_expert: subForm.status_user === 'student' ? 0 : subForm.custom_max_consultation_per_expert,
          custom_features: compiledFeatures,
          notes: subForm.notes,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        setIsEditSubModalOpen(false);
        fetchSuperData();
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = (index: number, field: keyof PlanSetting, value: any) => {
    const updated = [...plans];
    updated[index] = { ...updated[index], [field]: value };
    setPlans(updated);
  };

  const handleSavePlans = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_plans',
          plans: plans,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Konfigurasi batasan paket berhasil diperbarui di database!');
        fetchSuperData();
      } else {
        alert(`Gagal menyimpan konfigurasi paket: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignatureSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_payment_signature',
          active_signer_type: activeSignerType,
          superadmin_signature_url: superAdminSignatureUrl,
          backup_signer_name: backupSignerName,
          backup_signer_title: backupSignerTitle,
          backup_signer_signature_url: backupSignerSignatureUrl,
          app_system_stamp_url: appSystemStampUrl,
          xendit_active: xenditActive,
          xendit_mode: xenditMode,
          xendit_public_key: xenditPublicKey,
          xendit_secret_key: xenditSecretKey,
          didit_me_active: diditMeActive,
          didit_api_key: diditApiKey,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        localStorage.setItem('active_signer_type', activeSignerType);
        localStorage.setItem('superadmin_signature_url', superAdminSignatureUrl);
        localStorage.setItem('backup_signer_name', backupSignerName);
        localStorage.setItem('backup_signer_title', backupSignerTitle);
        localStorage.setItem('backup_signer_signature_url', backupSignerSignatureUrl);
        localStorage.setItem('app_system_stamp_url', appSystemStampUrl);
        fetchSuperData();
      } else {
        alert(`Gagal menyimpan pengaturan: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProjectRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingRetention(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_project_retention',
          expiration_months: expirationMonths,
          auto_delete_enabled: autoDeleteEnabled,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchSuperData();
      } else {
        alert(`Gagal menyimpan kebijakan retensi: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi: ${err.message}`);
    } finally {
      setSavingRetention(false);
    }
  };

  // Simpan batas hari retensi akun/proyek mahasiswa
  const handleSaveStudentRetentionDays = async () => {
    try {
      setSavingStudentRetention(true);
      setStudentCleanupMsg('');
      setStudentCleanupErr('');

      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_student_retention',
          student_retention_days: studentRetentionDays,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setStudentCleanupMsg(`✓ Masa retensi data mahasiswa berhasil disimpan (${studentRetentionDays} hari).`);
        fetchStudentRetentionStats(studentRetentionDays);
      } else {
        setStudentCleanupErr(json.message || 'Gagal menyimpan masa retensi mahasiswa.');
      }
    } catch (err: any) {
      setStudentCleanupErr(`Error koneksi: ${err.message}`);
    } finally {
      setSavingStudentRetention(false);
    }
  };

  const handleExecuteStudentCleanup = async () => {
    if (studentStats.expiredProjectsCount === 0) {
      alert(`Tidak ada akun/proyek mahasiswa yang melewati batas retensi ${studentRetentionDays} hari.`);
      return;
    }

    const confirmRun = window.confirm(
      `⚠️ PERINGATAN HAPUS DATA KADALUARSA MAHASISWA\n\nSebanyak ${studentStats.expiredProjectsCount} proyek latihan praktikum mahasiswa yang berusia lebih dari ${studentRetentionDays} hari akan DIHAPUS PERMANEN beserta kriteria dan responnya.\n\nLanjutkan pembersihan?`
    );

    if (!confirmRun) return;

    try {
      setLoadingStudentCleanup(true);
      setStudentCleanupMsg('');
      setStudentCleanupErr('');

      const res = await fetch('/api/admin/cleanup-student-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          admin_email: adminEmail,
          retention_days: studentRetentionDays 
        }),
      });

      const json = await res.json();
      if (json.success) {
        setStudentCleanupMsg(json.message);
        fetchStudentRetentionStats();
      } else {
        setStudentCleanupErr(json.message || 'Gagal mengeksekusi pembersihan proyek mahasiswa.');
      }
    } catch (err: any) {
      setStudentCleanupErr(`Terjadi kendala jaringan: ${err.message}`);
    } finally {
      setLoadingStudentCleanup(false);
    }
  };

  const handleRunArchiveSimulation = async () => {
    if (!window.confirm(`⚠️ PERINGATAN: Apakah Anda yakin ingin menjalankan simulasi pengarsipan sekarang?\n\nSemua proyek yang berusia lebih dari ${expirationMonths} bulan akan dipindahkan ke tabel arsip.`)) {
      return;
    }

    try {
      setRunningArchive(true);
      const res = await fetch('/api/admin/archive-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (json.success) {
        alert(`✅ ${json.message}`);
        fetchSuperData();
        fetchArchivedProjects();
      } else {
        alert(`⚠️ ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error koneksi runner arsip: ${err.message}`);
    } finally {
      setRunningArchive(false);
    }
  };

  const handleDownloadArchive = async (projectId: string, projectName: string) => {
    try {
      const res = await fetch('/api/admin/archive-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download_archive',
          project_id: projectId,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        alert(`Gagal mengunduh berkas arsip: ${json.message}`);
        return;
      }

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `AHP_Archive_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${projectId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert(`Gagal koneksi saat unduh berkas: ${err.message}`);
    }
  };

  const handleRestoreArchive = async (projectId: string) => {
    if (!window.confirm(`Pulihkan proyek ID "${projectId}" dan seluruh kriteria serta responnya ke proyek aktif operasional?`)) return;

    try {
      const res = await fetch('/api/admin/archive-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_project',
          project_id: projectId,
          admin_operator: adminName,
        }),
      });
      const json = await res.json();
      alert(json.message);
      if (json.success) {
        fetchArchivedProjects();
        fetchSuperData();
      }
    } catch (err: any) {
      alert(`Gagal memulihkan proyek: ${err.message}`);
    }
  };

  const handleDeletePermanent = async (projectId: string, projectName: string) => {
    if (!window.confirm(`⚠️ PERINGATAN KERAS: Hapus proyek "${projectName}" (${projectId}) secara PERMANEN dari database arsip?\n\nData kriteria, subkriteria, dan respons yang terkait akan dihapus total dan TIDAK DAPAT dipulihkan kembali!`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/archive-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_permanent',
          project_id: projectId,
          admin_operator: adminName,
        }),
      });

      const json = await res.json();
      alert(json.message);
      if (json.success) {
        fetchArchivedProjects();
      }
    } catch (err: any) {
      alert(`Gagal menghapus permanen: ${err.message}`);
    }
  };

  const handleDeleteAdminLogs = async () => {
    if (!window.confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin membersihkan SELURUH riwayat aktivitas audit admin di MySQL?')) return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/super-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_admin_logs' }),
      });

      const json = await res.json();
      if (json.success) {
        alert('Seluruh audit trail aktivitas admin berhasil dibersihkan.');
        fetchSuperData();
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Gagal menghapus log: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <header style={STYLES.header}>
        <div>
          <h2 style={STYLES.headerTitle}>🛡️ Panel Kontrol Utama SuperAdmin</h2>
          <p style={STYLES.headerSubtitle}>
            Pengelola Sistem: <strong>{adminName}</strong> ({adminEmail})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{ ...STYLES.btnAdd, background: '#0284c7' }} className="no-print">
            ← Kembali ke Dashboard Operasional
          </button>
        </div>
      </header>

      <div style={STYLES.container}>
        <div style={STYLES.tabsRow} className="no-print">
          <button onClick={() => setActiveTab('admin_performance')} style={activeTab === 'admin_performance' ? STYLES.tabActive : STYLES.tabInactive}>
            📊 Kinerja &amp; Audit Aktivitas Admin ({adminLogsList.length})
          </button>
          <button onClick={() => setActiveTab('admins_management')} style={activeTab === 'admins_management' ? STYLES.tabActive : STYLES.tabInactive}>
            👥 Pengaturan Akun Admin &amp; Wewenang Modul ({admins.length})
          </button>
          <button onClick={() => setActiveTab('subscriptions')} style={activeTab === 'subscriptions' ? STYLES.tabActive : STYLES.tabInactive}>
            📜 Subscriptions Komersial ({filteredUserSubs.length})
          </button>
          <button onClick={() => setActiveTab('plans_config')} style={activeTab === 'plans_config' ? STYLES.tabActive : STYLES.tabInactive}>
            ⚙️ Config Batasan Paket ({plans.length})
          </button>
          <button onClick={() => setActiveTab('signature_stamp')} style={activeTab === 'signature_stamp' ? STYLES.tabActive : STYLES.tabInactive}>
            ✍️ Pengaturan Tanda Tangan &amp; Pembayaran
          </button>
          <button onClick={() => setActiveTab('project_retention')} style={activeTab === 'project_retention' ? STYLES.tabActive : STYLES.tabInactive}>
            ⏳ Retensi &amp; Arsip Proyek
          </button>
        </div>

        {apiError && <div style={STYLES.errorBox}>{apiError}</div>}

        <div style={STYLES.contentCard} className="content-card">
          
          {/* 1. KINERJA & AUDIT AKTIVITAS ADMIN */}
          {activeTab === 'admin_performance' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>📊 Audit Trail &amp; Ringkasan Kinerja Admin Pembantu</h3>
                  <p style={STYLES.cardDesc}>Rekam jejak tindakan admin secara transparan dan terukur.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleDeleteAdminLogs} style={{ ...STYLES.btnDelete, padding: '8px 12px' }} className="no-print">
                    🗑️ Hapus Riwayat Log
                  </button>
                  <button onClick={() => window.print()} style={{ ...STYLES.btnAdd, background: '#0284c7' }} className="no-print">
                    🖨️ Cetak PDF Laporan
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
                {adminPerformanceStats.map((st, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#1e3a8a', display: 'block' }}>{st.name}</strong>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{st.email}</div>
                      <div style={{ fontSize: 11, color: '#0284c7', marginTop: 6, fontWeight: 600 }}>🕒 Terakhir: {st.lastActive}</div>
                    </div>
                    <div style={{ background: '#fff', padding: '10px 18px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>TOTAL AKSI</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{st.totalActions}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>No</th>
                      <th style={STYLES.th}>Waktu</th>
                      <th style={STYLES.th}>Nama Admin</th>
                      <th style={STYLES.th}>Role</th>
                      <th style={STYLES.th}>Tindakan</th>
                      <th style={STYLES.th}>Detail Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogsList.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>{loading ? 'Memuat data log dari MySQL...' : 'Belum ada log audit aktivitas admin.'}</td></tr>
                    ) : (
                      adminLogsList.map((log, i) => (
                        <tr key={i}>
                          <td style={STYLES.td}>#{i + 1}</td>
                          <td style={STYLES.td}>{String(log.timestamp || '-')}</td>
                          <td style={STYLES.td}><strong>{String(log.nama_admin || '-')}</strong></td>
                          <td style={STYLES.td}>{String(log.role || 'Admin')}</td>
                          <td style={STYLES.td}><span style={STYLES.badgeActive}>{String(log.tindakan || '-')}</span></td>
                          <td style={STYLES.td}>{String(log.detail || '-')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. PENGATURAN AKUN ADMIN */}
          {activeTab === 'admins_management' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>👥 Kelola Akun Admin &amp; Wewenang Modul</h3>
                  <p style={STYLES.cardDesc}>Atur centangan akses modul operasional harian untuk Admin Pembantu.</p>
                </div>
                <button onClick={handleOpenAddAdmin} style={STYLES.btnAdd}>+ Tambah Admin Baru</button>
              </div>

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>Nama Admin</th>
                      <th style={STYLES.th}>Email</th>
                      <th style={STYLES.th}>Role</th>
                      <th style={STYLES.th}>Akses Modul</th>
                      <th style={STYLES.th}>Status</th>
                      <th style={{ ...STYLES.th, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Belum ada akun admin terdaftar.</td></tr>
                    ) : (
                      admins.map((adm, i) => {
                        let parsedModules: string[] = [];
                        try {
                          parsedModules = typeof adm.wewenang_modul === 'string' 
                            ? JSON.parse(adm.wewenang_modul) 
                            : (adm.wewenang_modul || []);
                        } catch {
                          parsedModules = String(adm.wewenang_modul || '').split(',');
                        }

                        return (
                          <tr key={i}>
                            <td style={STYLES.td}><strong>{String(adm.nama || adm.name || '-')}</strong></td>
                            <td style={STYLES.td}>{String(adm.email || '-')}</td>
                            <td style={STYLES.td}>
                              <span style={{ 
                                fontWeight: 700, 
                                color: String(adm.role).toLowerCase().includes('super') ? '#1e3a8a' : '#0284c7' 
                              }}>
                                {String(adm.role || 'Admin Pembantu')}
                              </span>
                            </td>
                            <td style={STYLES.td}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 280 }}>
                                {String(adm.role).toLowerCase().includes('super') ? (
                                  <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                    ⭐ Akses Penuh (All Modules)
                                  </span>
                                ) : (
                                  parsedModules.map((mod, mIdx) => (
                                    <span key={mIdx} style={{ fontSize: 10.5, background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                      {String(mod).replace(/_/g, ' ')}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                            <td style={STYLES.td}><span style={STYLES.badgeActive}>{String(adm.status || 'Aktif')}</span></td>
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button onClick={() => handleOpenEditAdmin(adm)} style={STYLES.btnEdit}>Edit Akses</button>
                                {!String(adm.role).toLowerCase().includes('super') && (
                                  <button onClick={() => handleDeleteAdmin(adm)} style={STYLES.btnDelete}>Hapus</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. USER SUBSCRIPTIONS */}
          {activeTab === 'subscriptions' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>📜 Subscriptions &amp; Hak Akses Komersial ({filteredUserSubs.length})</h3>
                  <p style={STYLES.cardDesc}>
                    Pengaturan paket komersial (FREE, PLUS, PRO, PREMIUM) dan batas kuota pengguna.
                  </p>
                </div>
                <button onClick={fetchSuperData} disabled={loading} style={{ ...STYLES.btnUpload, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                  {loading ? 'Memuat...' : 'Muat Ulang Data'}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="🔍 Cari email, nama, paket..."
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  style={STYLES.input}
                />
              </div>

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>Pengguna / Email</th>
                      <th style={STYLES.th}>Paket (Plan)</th>
                      <th style={STYLES.th}>Status Akses</th>
                      <th style={STYLES.th}>Expired Date</th>
                      <th style={STYLES.th}>Batas Kuota Khusus</th>
                      <th style={{ ...STYLES.th, textAlign: 'center' }}>Aksi Privilese</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserSubs.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Belum ada data pelanggan ditemukan di database.</td></tr>
                    ) : (
                      filteredUserSubs.map((item, idx) => {
                        const isStudentItem = String(item.status_user || '').toLowerCase() === 'student';
                        const customFeats = String(item.custom_features || '').split(',').map(s => s.trim()).filter(Boolean);

                        return (
                          <tr key={idx}>
                            <td style={STYLES.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: '#0f172a' }}>{item.nama || item.user_name || 'Pengguna'}</strong>
                                {isStudentItem && (
                                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                    🎓 Student
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.email || item.user_email}</div>
                            </td>
                            <td style={STYLES.td}><span style={STYLES.badgeActive}>{item.plan || 'FREE'}</span></td>
                            <td style={STYLES.td}><span style={{ color: String(item.status).toUpperCase() === 'ACTIVE' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{item.status || 'ACTIVE'}</span></td>
                            <td style={STYLES.td}>{item.expired_date || '-'}</td>
                            <td style={STYLES.td}>
                              <div style={{ fontSize: 11.5, color: '#475569', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span>Proyek: <strong>{isStudentItem ? '2 (Student)' : (item.custom_max_projects !== '' && item.custom_max_projects !== null ? item.custom_max_projects : 'Default')}</strong></span>
                                <span>Pakar: <strong>{isStudentItem ? '2 Pakar Simulasi' : (item.custom_max_experts !== '' && item.custom_max_experts !== null ? `${item.custom_max_experts} (Manual)` : 'Default')}</strong></span>
                                {customFeats.length > 0 && (
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                                    {customFeats.map((feat, fIdx) => (
                                      <span key={fIdx} style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', padding: '1px 5px', borderRadius: 4, border: '1px solid #bfdbfe', fontWeight: 700 }}>
                                        +{feat.toUpperCase()}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <button onClick={() => handleOpenEditSub(item)} style={STYLES.btnEdit}>✏️ Ubah Privilese</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. CONFIG BATASAN PAKET */}
          {activeTab === 'plans_config' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>⚙️ Konfigurasi Batasan Paket (Semester Pass)</h3>
                  <p style={STYLES.cardDesc}>
                    Ubah batasan kuota proyek, pakar, konsultasi, serta perizinan subkriteria, alternatif, dan AI secara dinamis.
                  </p>
                </div>
                <button onClick={handleSavePlans} disabled={saving} style={STYLES.btnAdd}>
                  {saving ? 'Menyimpan ke Database...' : '💾 Simpan Pengaturan Paket'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {plans.map((p, idx) => (
                  <div key={p.plan_key} style={{ border: '1.5px solid #cbd5e1', borderRadius: 12, padding: 16, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a' }}>
                        Paket {p.label}
                      </span>
                      <span style={{ fontSize: 11, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                        {p.plan_key}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={STYLES.label}>Harga (IDR) / 6 Bln</label>
                        <input type="number" value={p.price} onChange={(e) => handlePlanChange(idx, 'price', Number(e.target.value))} style={STYLES.input} />
                      </div>
                      <div>
                        <label style={STYLES.label}>Max Proyek</label>
                        <input type="number" value={p.max_projects} onChange={(e) => handlePlanChange(idx, 'max_projects', Number(e.target.value))} style={STYLES.input} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={STYLES.label}>Expert Manual</label>
                        <input type="number" value={p.max_experts_manual} onChange={(e) => handlePlanChange(idx, 'max_experts_manual', Number(e.target.value))} style={STYLES.input} />
                      </div>
                      <div>
                        <label style={STYLES.label}>Expert Direktori</label>
                        <input type="number" value={p.max_experts_directory} onChange={(e) => handlePlanChange(idx, 'max_experts_directory', Number(e.target.value))} style={STYLES.input} />
                      </div>
                    </div>

                    <div>
                      <label style={STYLES.label}>Max Konsultasi / Pakar (Sesi)</label>
                      <input 
                        type="number" 
                        value={p.max_consultation_per_expert} 
                        onChange={(e) => handlePlanChange(idx, 'max_consultation_per_expert', Number(e.target.value))} 
                        style={STYLES.input} 
                        placeholder="0 = Tanpa Konsultasi"
                      />
                    </div>

                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Izin Fitur &amp; Analisis:
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={Boolean(p.allow_subcriteria)} 
                          onChange={(e) => handlePlanChange(idx, 'allow_subcriteria', e.target.checked)} 
                          style={{ width: 16, height: 16, accentColor: '#1d4ed8', cursor: 'pointer' }}
                        />
                        <span>Izinkan Subkriteria Bertingkat</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={Boolean(p.allow_alternative_method)} 
                          onChange={(e) => handlePlanChange(idx, 'allow_alternative_method', e.target.checked)} 
                          style={{ width: 16, height: 16, accentColor: '#1d4ed8', cursor: 'pointer' }}
                        />
                        <span>Izinkan Bobot Alternatif</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={Boolean(p.allow_ai_features)} 
                          onChange={(e) => handlePlanChange(idx, 'allow_ai_features', e.target.checked)} 
                          style={{ width: 16, height: 16, accentColor: '#1d4ed8', cursor: 'pointer' }}
                        />
                        <span>Izinkan Bantuan AI Analisis</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PENGATURAN TANDA TANGAN & PEMBAYARAN */}
          {activeTab === 'signature_stamp' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>✍️ Pengaturan Pengesah Sertifikat &amp; Gateway Pembayaran</h3>
                  <p style={STYLES.cardDesc}>Data disimpan ke database `AHP - system_assets`, `AHP - payment_settings`, dan `AHP - didit_settings`.</p>
                </div>
                <button onClick={handleSaveSignatureSettings} disabled={saving} style={STYLES.btnAdd}>
                  {saving ? 'Menyimpan...' : '💾 Simpan Seluruh Pengaturan'}
                </button>
              </div>
              
              <form onSubmit={handleSaveSignatureSettings} style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 10, maxWidth: 800 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #cbd5e1' }}>
                  <label style={{ ...STYLES.label, color: '#1e3a8a', fontSize: 13, marginBottom: 8 }}>Pilih Pejabat Penandatangan E-Sertifikat Aktif:</label>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="signerType" 
                        value="main" 
                        checked={activeSignerType === 'main'} 
                        onChange={() => setActiveSignerType('main')} 
                      />
                      Penandatangan Utama (SuperAdmin)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      <input 
                        type="radio" 
                        name="signerType" 
                        value="backup" 
                        checked={activeSignerType === 'backup'} 
                        onChange={() => setActiveSignerType('backup')} 
                      />
                      Penandatangan Pengganti / Perwakilan
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#0f172a' }}>🟢 TTD SuperAdmin Utama</h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="URL TTD atau Base64..." value={superAdminSignatureUrl} onChange={e => setSuperAdminSignatureUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                      <label style={STYLES.btnUpload}>
                        Pilih File
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setSuperAdminSignatureUrl)} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {superAdminSignatureUrl && (
                      <div style={{ marginTop: 8, height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 6 }}>
                        <img src={superAdminSignatureUrl} alt="TTD Utama" style={{ maxHeight: 40, objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#fdf4ff', padding: 14, borderRadius: 8, border: '1px solid #f0abfc' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#86198f' }}>🟣 Logo Stempel Aplikasi</h4>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="URL Stempel PNG..." value={appSystemStampUrl} onChange={e => setAppSystemStampUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                      <label style={{ ...STYLES.btnUpload, background: '#a855f7' }}>
                        Pilih File
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setAppSystemStampUrl)} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {appSystemStampUrl && (
                      <div style={{ marginTop: 8, height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed #f0abfc', borderRadius: 6 }}>
                        <img src={appSystemStampUrl} alt="Stempel" style={{ maxHeight: 40, objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#0f172a' }}>🟡 Pejabat Penandatangan Cadangan / Perwakilan</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={STYLES.label}>Nama Penandatangan Perwakilan</label>
                      <input type="text" placeholder="Contoh: Nama Wakil Admin" value={backupSignerName} onChange={e => setBackupSignerName(e.target.value)} style={STYLES.input} />
                    </div>
                    <div>
                      <label style={STYLES.label}>Jabatan Penandatangan Perwakilan</label>
                      <input type="text" placeholder="Contoh: Perwakilan SuperAdmin" value={backupSignerTitle} onChange={e => setBackupSignerTitle(e.target.value)} style={STYLES.input} />
                    </div>
                  </div>
                  <div>
                    <label style={STYLES.label}>Tanda Tangan Digital Perwakilan</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="text" placeholder="URL TTD atau Base64..." value={backupSignerSignatureUrl} onChange={e => setBackupSignerSignatureUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                      <label style={STYLES.btnUpload}>
                        Pilih File
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setBackupSignerSignatureUrl)} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 10, border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#166534' }}>💳 Integrasi Xendit Payment Gateway</strong>
                      <div style={{ fontSize: 11.5, color: '#4ade80' }}>Disimpan ke tabel `AHP - payment_settings`.</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      <input type="checkbox" checked={xenditActive} onChange={e => setXenditActive(e.target.checked)} />
                      Aktifkan Xendit
                    </label>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={STYLES.label}>Mode Gateway</label>
                      <select value={xenditMode} onChange={e => setXenditMode(e.target.value)} style={STYLES.input}>
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>
                    <div>
                      <label style={STYLES.label}>Public Key Xendit</label>
                      <input type="text" placeholder="xnd_public_..." value={xenditPublicKey} onChange={e => setXenditPublicKey(e.target.value)} style={STYLES.input} />
                    </div>
                  </div>
                  <div>
                    <label style={STYLES.label}>Secret Key Xendit</label>
                    <input type="password" placeholder="xnd_development_... atau xnd_production_..." value={xenditSecretKey} onChange={e => setXenditSecretKey(e.target.value)} style={STYLES.input} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>🆔 Integrasi Didit.me Verifikasi</strong>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>Disimpan ke tabel `AHP - didit_settings`.</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      <input type="checkbox" checked={diditMeActive} onChange={e => setDiditMeActive(e.target.checked)} />
                      Aktifkan Didit.me
                    </label>
                  </div>
                  <div>
                    <label style={STYLES.label}>Didit API Key</label>
                    <input type="password" placeholder="API Key Didit.me..." value={diditApiKey} onChange={e => setDiditApiKey(e.target.value)} style={STYLES.input} />
                  </div>
                </div>

                <button type="submit" disabled={saving} style={{ ...STYLES.btnSaveModal, padding: '12px 20px', fontSize: 14 }}>
                  {saving ? 'Menyimpan ke MySQL...' : '💾 Simpan Seluruh Pengaturan'}
                </button>
              </form>
            </div>
          )}

          {/* 6. RETENSI PROYEK (UMUM & MAHASISWA) */}
          {activeTab === 'project_retention' && (
            <div>
              {/* KARTU PENGATURAN RETENSI MAHASISWA (STUDENT EDITION) */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: 12,
                padding: '20px 22px',
                marginBottom: 28,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={STYLES.cardTitleRow}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 6, fontWeight: 800 }}>
                        🎓 AKUN MAHASISWA (PRAKTIKUM)
                      </span>
                      <h4 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 800 }}>
                        Kebijakan Retensi &amp; Pembersihan Data Praktikum
                      </h4>
                    </div>
                    <p style={STYLES.cardDesc}>
                      Tentukan masa aktif akun/proyek simulasi mahasiswa dan lakukan pembersihan data latihan secara fleksibel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchStudentRetentionStats(studentRetentionDays)}
                    disabled={loadingStudentCleanup}
                    style={{ ...STYLES.btnUpload, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
                  >
                    {loadingStudentCleanup ? 'Memuat...' : '🔄 Refresh Data Praktikum'}
                  </button>
                </div>

                {/* Indikator Statistik Data Mahasiswa */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, margin: '16px 0' }}>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Total Akun Mahasiswa</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                      {studentStats.totalStudents} Akun
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Total Proyek Praktikum</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                      {studentStats.totalStudentProjects} Proyek
                    </div>
                  </div>
                  <div style={{
                    background: studentStats.expiredProjectsCount > 0 ? '#fef2f2' : '#f0fdf4',
                    padding: 14,
                    borderRadius: 10,
                    border: studentStats.expiredProjectsCount > 0 ? '1.5px solid #fecaca' : '1.5px solid #bbf7d0'
                  }}>
                    <div style={{ fontSize: 11.5, color: studentStats.expiredProjectsCount > 0 ? '#991b1b' : '#166534', fontWeight: 700 }}>
                      Kadaluarsa (&gt; {studentRetentionDays} Hari)
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: studentStats.expiredProjectsCount > 0 ? '#dc2626' : '#16a34a', marginTop: 4 }}>
                      {studentStats.expiredProjectsCount} Proyek
                    </div>
                  </div>
                </div>

                {/* Kontrol Pilihan Masa Retensi Mahasiswa */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                      Batas Waktu Retensi Mahasiswa:
                    </label>
                    <select
                      value={studentRetentionDays}
                      onChange={(e) => {
                        const newDays = Number(e.target.value);
                        setStudentRetentionDays(newDays);
                        fetchStudentRetentionStats(newDays);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        fontWeight: 600,
                        background: '#ffffff',
                        minWidth: 200,
                      }}
                    >
                      <option value={7}>7 Hari (1 Minggu - Praktikum Singkat)</option>
                      <option value={14}>14 Hari (2 Minggu)</option>
                      <option value={30}>30 Hari (1 Bulan - Standar)</option>
                      <option value={60}>60 Hari (2 Bulan)</option>
                      <option value={90}>90 Hari (3 Bulan - Tengah Semester)</option>
                      <option value={180}>180 Hari (6 Bulan - 1 Semester Penuh)</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleSaveStudentRetentionDays}
                      disabled={savingStudentRetention}
                      style={{
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: savingStudentRetention ? 'wait' : 'pointer',
                      }}
                    >
                      {savingStudentRetention ? 'Menyimpan...' : '💾 Simpan Kebijakan Retensi'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteStudentCleanup}
                    disabled={loadingStudentCleanup || studentStats.expiredProjectsCount === 0}
                    style={{
                      background: studentStats.expiredProjectsCount > 0 ? '#dc2626' : '#94a3b8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: studentStats.expiredProjectsCount > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: studentStats.expiredProjectsCount > 0 ? '0 2px 8px rgba(220,38,38,0.25)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {loadingStudentCleanup ? 'Memproses...' : `🧹 Hapus Data Kadaluarsa (${studentStats.expiredProjectsCount})`}
                  </button>
                </div>

                {studentCleanupMsg && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    ✅ {studentCleanupMsg}
                  </div>
                )}

                {studentCleanupErr && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    ⚠ {studentCleanupErr}
                  </div>
                )}
              </div>

              {/* KARTU PENGATURAN RETENSI PROYEK UMUM */}
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>⏳ Kebijakan Retensi &amp; Kedaluwarsa Proyek Umum</h3>
                  <p style={STYLES.cardDesc}>Pengarsipan otomatis data proyek umum ke tabel `AHP - Archive_*`.</p>
                </div>
              </div>

              <form onSubmit={handleSaveProjectRetention} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, marginTop: 10 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>Otomatisasi Backup &amp; Pembersihan</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Pindahkan proyek kadaluarsa ke tabel arsip.</div>
                    </div>
                    <input type="checkbox" checked={autoDeleteEnabled} onChange={(e) => setAutoDeleteEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
                  </label>
                </div>

                <div>
                  <label style={STYLES.label}>Batas Waktu Tanpa Aktivitas:</label>
                  <select value={expirationMonths} onChange={(e) => setExpirationMonths(Number(e.target.value))} style={STYLES.input}>
                    <option value={1}>1 Bulan</option>
                    <option value={3}>3 Bulan</option>
                    <option value={6}>6 Bulan (Standar)</option>
                    <option value={12}>12 Bulan</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={savingRetention} style={STYLES.btnSaveModal}>
                    {savingRetention ? 'Menyimpan ke Database...' : '💾 Simpan Kebijakan Retensi'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRunArchiveSimulation}
                    disabled={runningArchive}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {runningArchive ? 'Sedang Memproses Arsip...' : '🚀 Jalankan Simulasi Pembersihan & Arsip'}
                  </button>
                </div>
              </form>

              {/* DAFTAR PROYEK TERARSIP */}
              <div style={{ marginTop: 36, borderTop: '2px solid #e2e8f0', paddingTop: 20 }}>
                <div style={STYLES.cardTitleRow}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 16, color: '#0f172a', fontWeight: 800 }}>
                      🗄️ Daftar Proyek Terarsip ({archivedList.length})
                    </h4>
                    <p style={STYLES.cardDesc}>
                      Data yang dipindahkan ke tabel `AHP - Archive_*`. Anda dapat mengunduh salinan backup, memulihkan, atau menghapusnya secara permanen.
                    </p>
                  </div>
                  <button onClick={fetchArchivedProjects} disabled={loadingArchiveList} style={{ ...STYLES.btnUpload, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                    {loadingArchiveList ? 'Memuat...' : '🔄 Muat Ulang Arsip'}
                  </button>
                </div>

                <div style={STYLES.tableWrap}>
                  <table style={STYLES.table}>
                    <thead>
                      <tr>
                        <th style={STYLES.th}>ID Proyek</th>
                        <th style={STYLES.th}>Nama Proyek</th>
                        <th style={STYLES.th}>Pemilik / Email</th>
                        <th style={STYLES.th}>Tanggal Dibuat</th>
                        <th style={{ ...STYLES.th, textAlign: 'center' }}>Aksi Arsip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedList.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                            {loadingArchiveList ? 'Memuat data arsip...' : 'Belum ada proyek yang tersimpan di tabel arsip.'}
                          </td>
                        </tr>
                      ) : (
                        archivedList.map((item, idx) => (
                          <tr key={idx}>
                            <td style={STYLES.td}><code>{item.project_id}</code></td>
                            <td style={STYLES.td}><strong>{item.nama_proyek}</strong></td>
                            <td style={STYLES.td}>{item.pemilik}</td>
                            <td style={STYLES.td}>{item.created_at}</td>
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadArchive(item.project_id, item.nama_proyek)}
                                  title="Unduh satu paket data JSON"
                                  style={{ ...STYLES.btnEdit, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                                >
                                  📥 Unduh JSON
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRestoreArchive(item.project_id)}
                                  title="Kembalikan ke proyek aktif"
                                  style={STYLES.btnEdit}
                                >
                                  ↺ Pulihkan
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePermanent(item.project_id, item.nama_proyek)}
                                  title="Hapus permanen dari database"
                                  style={STYLES.btnDelete}
                                >
                                  🗑️ Hapus Permanen
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* MODAL EDIT / TAMBAH ADMIN */}
      {isAdminModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalBox, maxWidth: 520 }}>
            <div style={STYLES.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>{editingAdmin ? 'Edit Akses & Kata Sandi Admin' : 'Tambah Admin Baru'}</h3>
              <button onClick={() => setIsAdminModalOpen(false)} style={STYLES.btnCloseModal}>✕</button>
            </div>
            <form onSubmit={handleSaveAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div>
                <label style={STYLES.label}>Nama Lengkap Admin *</label>
                <input type="text" required placeholder="Nama Operator / Admin" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} style={STYLES.input} />
              </div>
              <div>
                <label style={STYLES.label}>Email Login *</label>
                <input type="email" required disabled={!!editingAdmin} placeholder="admin@email.com" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} style={{ ...STYLES.input, background: editingAdmin ? '#f1f5f9' : '#fff' }} />
              </div>
              <div>
                <label style={STYLES.label}>{editingAdmin ? 'Ganti Password Baru (Opsional, min. 6 karakter)' : 'Password Login * (min. 6 karakter)'}</label>
                <input 
                  type="password" 
                  required={!editingAdmin} 
                  placeholder={editingAdmin ? 'Kosongkan jika password tidak ingin diubah' : 'Minimal 6 karakter...'} 
                  value={adminForm.password} 
                  onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} 
                  style={STYLES.input} 
                />
              </div>
              <div>
                <label style={STYLES.label}>Role Akses Admin</label>
                <select value={adminForm.role} onChange={e => setAdminForm({ ...adminForm, role: e.target.value })} style={STYLES.input}>
                  <option value="Admin Pembantu">Admin Pembantu (Akses Modul Terbatas)</option>
                  <option value="SuperAdmin">SuperAdmin (Akses Penuh Keseluruhan)</option>
                </select>
              </div>

              {adminForm.role !== 'SuperAdmin' && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <label style={{ ...STYLES.label, color: '#1e3a8a', marginBottom: 8 }}>Wewenang Modul Akses Admin Pembantu:</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('expert_directory')} onChange={() => toggleAccessCheck('expert_directory')} />
                      <span>Direktori Pakar</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('products')} onChange={() => toggleAccessCheck('products')} />
                      <span>Manajemen Produk</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('consultation_user')} onChange={() => toggleAccessCheck('consultation_user')} />
                      <span>Konsultasi User</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('consultation_admin')} onChange={() => toggleAccessCheck('consultation_admin')} />
                      <span>Catatan Admin</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('visitor_stats')} onChange={() => toggleAccessCheck('visitor_stats')} />
                      <span>Statistik Kunjungan</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={adminForm.allowed_access.includes('feedback')} onChange={() => toggleAccessCheck('feedback')} />
                      <span>Masukan Publik</span>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => setIsAdminModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={submittingAdmin} style={STYLES.btnSaveModal}>{submittingAdmin ? 'Menyimpan...' : 'Simpan Akun'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PRIVILESE USER */}
      {isEditSubModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalBox, maxWidth: 540 }}>
            <div style={STYLES.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Ubah Privilese Pelanggan</h3>
                {subForm.status_user === 'student' && (
                  <span style={{ fontSize: 10.5, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                    🎓 Student Edition
                  </span>
                )}
              </div>
              <button onClick={() => setIsEditSubModalOpen(false)} style={STYLES.btnCloseModal}>✕</button>
            </div>
            <form onSubmit={handleSaveUserSub} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              
              {subForm.status_user === 'student' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1e40af', lineHeight: 1.45 }}>
                  💡 <strong>Akun Praktikum Mahasiswa:</strong> Akun ini menggunakan <strong>2 Pakar Simulasi Sistem</strong> (<em>Prof. Linglungan</em> &amp; <em>DR. Raos</em>). Mahasiswa tidak diperkenankan menambah pakar manual mandiri.
                </div>
              )}

              <div>
                <label style={STYLES.label}>Email Pengguna</label>
                <input type="email" value={subForm.user_email} readOnly style={{ ...STYLES.input, background: '#f1f5f9', fontWeight: 700 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Paket Langganan (Plan)</label>
                  <select 
                    value={subForm.plan} 
                    onChange={(e) => handlePlanSelectChange(e.target.value)} 
                    style={STYLES.input}
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                    <option value="PLUS">PLUS</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>
                <div>
                  <label style={STYLES.label}>Status Akun</label>
                  <select value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value })} style={STYLES.input}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={STYLES.label}>Tanggal Kedaluwarsa (Expired Date)</label>
                <input 
                  type="date" 
                  value={subForm.expired_date} 
                  onChange={(e) => setSubForm({ ...subForm, expired_date: e.target.value })} 
                  style={STYLES.input} 
                />
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...STYLES.label, color: '#1e3a8a', margin: 0 }}>
                    Batas Kuota Kustom (Mengikuti Paket {subForm.plan}):
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePlanSelectChange(subForm.plan)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, cursor: 'pointer', fontWeight: 700, padding: 0 }}
                  >
                    ↺ Reset ke Nilai Default
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>
                      {subForm.status_user === 'student' ? 'Max Proyek (Praktikum)' : 'Max Proyek'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="Kuota proyek" 
                      value={subForm.custom_max_projects} 
                      onChange={(e) => setSubForm({ ...subForm, custom_max_projects: e.target.value })} 
                      style={STYLES.input} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: subForm.status_user === 'student' ? '#1e40af' : '#64748b', fontWeight: subForm.status_user === 'student' ? 700 : 400 }}>
                      {subForm.status_user === 'student' ? 'Pakar Simulasi (Terkunci Sistem)' : 'Max Expert Manual'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="Kuota pakar manual" 
                      value={subForm.status_user === 'student' ? 2 : subForm.custom_max_experts} 
                      readOnly={subForm.status_user === 'student'}
                      disabled={subForm.status_user === 'student'}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_experts: e.target.value })} 
                      style={{
                        ...STYLES.input,
                        background: subForm.status_user === 'student' ? '#f1f5f9' : '#fff',
                        color: subForm.status_user === 'student' ? '#1e40af' : '#0f172a',
                        fontWeight: subForm.status_user === 'student' ? 800 : 400,
                        cursor: subForm.status_user === 'student' ? 'not-allowed' : 'text'
                      }} 
                    />
                    {subForm.status_user === 'student' && (
                      <span style={{ fontSize: 10, color: '#64748b', marginTop: 2, display: 'block' }}>
                        🔒 2 Slot Pakar Otomatis Sistem
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>
                      {subForm.status_user === 'student' ? 'Direktori Pakar (Nonaktif)' : 'Max Expert Direktori'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="Kuota direktori pakar" 
                      value={subForm.status_user === 'student' ? 0 : subForm.custom_max_experts_directory} 
                      readOnly={subForm.status_user === 'student'}
                      disabled={subForm.status_user === 'student'}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_experts_directory: e.target.value })} 
                      style={{
                        ...STYLES.input,
                        background: subForm.status_user === 'student' ? '#f1f5f9' : '#fff',
                        cursor: subForm.status_user === 'student' ? 'not-allowed' : 'text'
                      }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: '#64748b' }}>
                      {subForm.status_user === 'student' ? 'Konsultasi (Nonaktif)' : 'Max Konsultasi/Pakar'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="Kuota konsultasi" 
                      value={subForm.status_user === 'student' ? 0 : subForm.custom_max_consultation_per_expert} 
                      readOnly={subForm.status_user === 'student'}
                      disabled={subForm.status_user === 'student'}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_consultation_per_expert: e.target.value })} 
                      style={{
                        ...STYLES.input,
                        background: subForm.status_user === 'student' ? '#f1f5f9' : '#fff',
                        cursor: subForm.status_user === 'student' ? 'not-allowed' : 'text'
                      }} 
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a', display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                    Izin Fitur Khusus User Ini:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#ffffff', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={subForm.custom_allow_subcriteria}
                        onChange={(e) => setSubForm(prev => ({ ...prev, custom_allow_subcriteria: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      <span>Izinkan Struktur Subkriteria Bertingkat</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={subForm.custom_allow_alternative}
                        onChange={(e) => setSubForm(prev => ({ ...prev, custom_allow_alternative: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      <span>Izinkan Modul Bobot Alternatif (Perankingan)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: '#334155' }}>
                      <input
                        type="checkbox"
                        checked={subForm.custom_allow_ai}
                        onChange={(e) => setSubForm(prev => ({ ...prev, custom_allow_ai: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      <span>Izinkan Fitur AI Analisis (Pembuatan Proyek &amp; Narasi Laporan)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label style={STYLES.label}>Catatan Tambahan (Notes)</label>
                <textarea 
                  rows={2} 
                  placeholder="Catatan khusus dari SuperAdmin..." 
                  value={subForm.notes} 
                  onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })} 
                  style={{ ...STYLES.input, resize: 'vertical' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setIsEditSubModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={saving} style={STYLES.btnSaveModal}>{saving ? 'Menyimpan...' : 'Simpan Privilese'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' },
  headerSubtitle: { margin: '2px 0 0', fontSize: 13, color: '#64748b' },
  container: { maxWidth: 1200, margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  tabsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  tabActive: { background: '#1e3a8a', border: '1px solid #1e3a8a', borderRadius: 8, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  tabInactive: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: '#334155', cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 14, color: '#b91c1c' },
  contentCard: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' },
  cardTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  cardTitle: { margin: '0 0 4px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' },
  cardDesc: { margin: 0, fontSize: 13.5, color: '#64748b' },
  btnAdd: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnEdit: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnDelete: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnUpload: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  badgeActive: { background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700 },
  tableWrap: { overflowX: 'auto', marginTop: 16 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 },
  modalBox: { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 },
  btnCloseModal: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' },
  label: { fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  btnCancel: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSaveModal: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
};