// app/admin/super-control/page.tsx

'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || ''

const PRINT_STYLES = `
  @media print {
    header, .no-print, button { display: none !important; }
    body, .content-card { background: #fff !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
    .print-header { display: block !important; text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
  }
  .print-header { display: none; }
`

interface AdminItem {
  id?: string;
  email?: string;
  admin_email?: string;
  name?: string;
  nama?: string;
  admin_name?: string;
  role?: string;
  admin_role?: string;
  status?: string;
  allowed_access?: string;
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
  kontakUser?: string
  user_name?: string
  namaUser?: string
  nama?: string
  plan?: string
  status?: string
  status_user?: string
  pro_source?: string
  start_date?: string
  expired_date?: string
  expired?: string
  max_projects?: number | string
  max_experts?: number | string
  max_experts_manual?: number | string
  max_experts_directory?: number | string
  max_consultation_per_expert?: number | string
  custom_features?: string
  notes?: string
  [key: string]: any
}

export default function SuperAdminControlPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  const [activeTab, setActiveTab] = useState<'admin_performance' | 'admins_management' | 'subscriptions' | 'plans_config' | 'signature_stamp'>('admin_performance');

  // State Data Khusus SuperAdmin
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [adminLogsList, setAdminLogsList] = useState<any[]>([]);

  // State User Subscriptions (Privilege User)
  const [userSubs, setUserSubscriptions] = useState<UserSubscriptionItem[]>([]);
  const [subSearchQuery, setSubSearchQuery] = useState('');
  
  // State Modal Edit Privilese User LENGKAP
  const [isEditSubModalOpen, setIsEditSubModalOpen] = useState(false);
  const [editingUserSub, setEditingUserSub] = useState<UserSubscriptionItem | null>(null);
  const [subForm, setSubForm] = useState({
    user_email: '',
    plan: 'FREE',
    status: 'ACTIVE',
    expired_date: '',
    custom_max_projects: '',
    custom_max_experts: '',
    custom_max_experts_directory: '',
    custom_max_consultation_per_expert: '',
    custom_features: '',
    notes: ''
  });

  // State Config Plans (Default Kapital)
  const [plans, setPlans] = useState<PlanSetting[]>([
    { plan_key: 'FREE', label: 'FREE', price: 0, duration_months: 6, max_projects: 1, max_experts_manual: 5, max_experts_directory: 0, max_consultation_per_expert: 0, allow_subcriteria: true, allow_alternative_method: false, allow_ai_features: false },
    { plan_key: 'PRO', label: 'PRO', price: 150000, duration_months: 6, max_projects: 3, max_experts_manual: 8, max_experts_directory: 5, max_consultation_per_expert: 3, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: false },
    { plan_key: 'PLUS', label: 'PLUS', price: 350000, duration_months: 6, max_projects: 10, max_experts_manual: 15, max_experts_directory: 10, max_consultation_per_expert: 5, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true },
    { plan_key: 'PREMIUM', label: 'PREMIUM', price: 750000, duration_months: 6, max_projects: 999999, max_experts_manual: 999999, max_experts_directory: 999999, max_consultation_per_expert: 15, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true }
  ]);

  // State Modal CRUD Admin
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminItem | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'Admin Pembantu',
    status: 'Aktif',
    allowed_access: ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'] as string[]
  });
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // State Tanda Tangan, Logo, Xendit & Didit.me
  const [activeSignerType, setActiveSignerType] = useState<'main' | 'backup'>('main');
  const [superAdminSignatureUrl, setSuperAdminSignatureUrl] = useState('');
  const [backupSignerName, setBackupSignerName] = useState('');
  const [backupSignerTitle, setBackupSignerTitle] = useState('Wakil System Admin / Perwakilan SuperAdmin');
  const [backupSignerSignatureUrl, setBackupSignerSignatureUrl] = useState('');
  const [appSystemStampUrl, setAppSystemStampUrl] = useState('');
  
  // State Xendit Lengkap
  const [xenditActive, setXenditActive] = useState(true);
  const [xenditMode, setXenditMode] = useState('sandbox');
  const [xenditPublicKey, setXenditPublicKey] = useState('');
  const [xenditSecretKey, setXenditSecretKey] = useState('');

  // State Didit.me
  const [diditMeActive, setDiditMeActive] = useState(true);
  const [diditApiKey, setDiditApiKey] = useState('');

  const fetchWithCatch = useCallback(async (action: string) => {
    if (!GOOGLE_SCRIPT_URL) return [];
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}`, { 
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow' 
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { return []; }
      if (json && (json.success || Array.isArray(json.data) || Array.isArray(json))) {
        return json.data || (Array.isArray(json) ? json : []);
      }
      return json || [];
    } catch {
      return [];
    }
  }, []);

  const fetchSuperData = useCallback(async () => {
    if (!GOOGLE_SCRIPT_URL) {
      setApiError('⚠️ URL Google Apps Script belum disetel di .env.local.');
      return;
    }
    
    try {
      setLoading(true);
      setApiError('');

      const [admData, logsData, paymentSettings, diditSettings, planSettingsData, userSubsData, systemAssetsData] = await Promise.all([
        fetchWithCatch('getadmins'),
        fetchWithCatch('getadminlogs'),
        fetchWithCatch('getpaymentsettings'),
        fetchWithCatch('getdiditsettings'),
        fetchWithCatch('getplansettings'),
        fetchWithCatch('getallusersubscriptions'),
        fetchWithCatch('get_system_assets')
      ]);

      setAdmins(Array.isArray(admData) ? admData : []);
      setAdminLogsList(Array.isArray(logsData) ? logsData : []);
      setUserSubscriptions(Array.isArray(userSubsData) ? userSubsData : []);

      // 🟢 Sinkronisasi data Aset Sistem dari Sheet system_assets / app_settings
      if (systemAssetsData && typeof systemAssetsData === 'object' && !Array.isArray(systemAssetsData)) {
        if (systemAssetsData.active_signer_type) {
          setActiveSignerType(systemAssetsData.active_signer_type as 'main' | 'backup');
          localStorage.setItem('active_signer_type', systemAssetsData.active_signer_type);
        }
        if (systemAssetsData.admin_signature || systemAssetsData.superadmin_signature_url) {
          const sig = systemAssetsData.admin_signature || systemAssetsData.superadmin_signature_url;
          setSuperAdminSignatureUrl(sig);
          localStorage.setItem('superadmin_signature_url', sig);
        }
        if (systemAssetsData.backup_signer_name) {
          setBackupSignerName(systemAssetsData.backup_signer_name);
          localStorage.setItem('backup_signer_name', systemAssetsData.backup_signer_name);
        }
        if (systemAssetsData.backup_signer_title) {
          setBackupSignerTitle(systemAssetsData.backup_signer_title);
          localStorage.setItem('backup_signer_title', systemAssetsData.backup_signer_title);
        }
        if (systemAssetsData.co_admin_signature || systemAssetsData.backup_signer_signature_url) {
          const coSig = systemAssetsData.co_admin_signature || systemAssetsData.backup_signer_signature_url;
          setBackupSignerSignatureUrl(coSig);
          localStorage.setItem('backup_signer_signature_url', coSig);
        }
        if (systemAssetsData.platform_logo || systemAssetsData.app_system_stamp_url) {
          const logo = systemAssetsData.platform_logo || systemAssetsData.app_system_stamp_url;
          setAppSystemStampUrl(logo);
          localStorage.setItem('app_system_stamp_url', logo);
        }
      }

      if (Array.isArray(planSettingsData) && planSettingsData.length > 0) {
        const normalizedPlans = planSettingsData.map((p: any) => ({
          ...p,
          plan_key: String(p.plan_key || p.label || 'FREE').toUpperCase()
        }));
        setPlans(normalizedPlans);
      }

      if (paymentSettings && !Array.isArray(paymentSettings)) {
        if (paymentSettings.xendit !== undefined || paymentSettings.is_xendit_active !== undefined) {
          const isAct = paymentSettings.xendit !== undefined ? Boolean(paymentSettings.xendit) : Boolean(paymentSettings.is_xendit_active);
          setXenditActive(isAct);
          localStorage.setItem('xendit_active', String(isAct));
        }
        if (paymentSettings.xendit_mode) setXenditMode(paymentSettings.xendit_mode);
        if (paymentSettings.xendit_public_key) setXenditPublicKey(paymentSettings.xendit_public_key);
        if (paymentSettings.xendit_secret_key) setXenditSecretKey(paymentSettings.xendit_secret_key);
      }

      if (diditSettings && !Array.isArray(diditSettings)) {
        if (diditSettings.diditme !== undefined) {
          setDiditMeActive(Boolean(diditSettings.diditme));
          localStorage.setItem('diditme_active', String(diditSettings.diditme));
        }
        if (diditSettings.diditme_apikey !== undefined) {
          setDiditApiKey(String(diditSettings.diditme_apikey));
        }
      }

    } catch (err: any) {
      setApiError(`Gagal mengambil data kontrol: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchWithCatch]);

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

    setSuperAdminSignatureUrl(localStorage.getItem('superadmin_signature_url') || '');
    setActiveSignerType((localStorage.getItem('active_signer_type') as 'main' | 'backup') || 'main');
    setBackupSignerName(localStorage.getItem('backup_signer_name') || '');
    setBackupSignerTitle(localStorage.getItem('backup_signer_title') || 'Wakil System Admin / Perwakilan SuperAdmin');
    setBackupSignerSignatureUrl(localStorage.getItem('backup_signer_signature_url') || '');
    setAppSystemStampUrl(localStorage.getItem('app_system_stamp_url') || '');

    const storedXendit = localStorage.getItem('xendit_active');
    if (storedXendit !== null) setXenditActive(storedXendit === 'true');
    const storedDidit = localStorage.getItem('diditme_active');
    if (storedDidit !== null) setDiditMeActive(storedDidit === 'true');

    fetchSuperData();
  }, [router, fetchSuperData]);

  // Statistik Kinerja Admin Pembantu
  const adminPerformanceStats = useMemo(() => {
    const statsByAdmin: Record<string, { name: string; role: string; email: string; totalActions: number; expertsManaged: number; notesSent: number; lastActive: string }> = {};

    adminLogsList.forEach((log) => {
      const email = String(log.adminEmail || log[2] || 'unknown@admin.com').toLowerCase().trim();
      const name = String(log.adminName || log[1] || email).trim();
      const role = String(log.adminRole || log[3] || 'Admin Pembantu').trim();
      const action = String(log.actionName || log[4] || '').toUpperCase().trim();
      const timestamp = String(log.timestamp || log[0] || '-').trim();

      if (!statsByAdmin[email]) {
        statsByAdmin[email] = { name, role, email, totalActions: 0, expertsManaged: 0, notesSent: 0, lastActive: timestamp };
      }

      statsByAdmin[email].totalActions += 1;
      if (action.includes('EXPERT') || action.includes('PAKAR')) statsByAdmin[email].expertsManaged += 1;
      if (action.includes('NOTE') || action.includes('CATATAN')) statsByAdmin[email].notesSent += 1;
      statsByAdmin[email].lastActive = timestamp;
    });

    return Object.values(statsByAdmin);
  }, [adminLogsList]);

  // 🟢 Filter User Subscription: HANYA USER KOMERSIAL UMUM (Data Pakar Disembunyikan)
  const filteredUserSubs = useMemo(() => {
    const q = subSearchQuery.toLowerCase().trim();

    return userSubs.filter((item) => {
      const statusUser = String(item.status_user || item.status || item.source || '').toUpperCase();
      const userId = String(item.user_id || item.id || '').toUpperCase();
      const proSource = String(item.pro_source || item.plan_source || '').toUpperCase();

      const isExpertUser = 
        statusUser === 'EXPERT_REWARD' || 
        statusUser === 'PAKAR' ||
        proSource === 'EXPERT_REWARD' || 
        userId.startsWith('EXP-');

      if (isExpertUser) return false;

      if (!q) return true;

      const email = String(
        item.user_email || item.email || item.kontakUser || item.kontak || item.userEmail || ''
      ).toLowerCase();
      
      const name = String(
        item.user_name || item.namaUser || item.nama || item.name || ''
      ).toLowerCase();
      
      const plan = String(item.plan || item.Plan || '').toLowerCase();
      const status = String(item.status || item.Status || '').toLowerCase();
      const notes = String(item.notes || '').toLowerCase();

      return email.includes(q) || name.includes(q) || plan.includes(q) || status.includes(q) || notes.includes(q);
    });
  }, [userSubs, subSearchQuery]);

  const toggleCustomFeatureCheck = (featureKey: string) => {
    let currentList: string[] = subForm.custom_features
      ? subForm.custom_features.split(',').map((f) => f.trim().toLowerCase())
      : [];

    if (currentList.includes(featureKey)) {
      currentList = currentList.filter((f) => f !== featureKey);
    } else {
      currentList.push(featureKey);
    }

    setSubForm({
      ...subForm,
      custom_features: currentList.join(',')
    });
  };

  const isCustomFeatureChecked = (featureKey: string) => {
    if (!subForm.custom_features) return false;
    const currentList = subForm.custom_features.split(',').map((f) => f.trim().toLowerCase());
    return currentList.includes(featureKey);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert('⚠️ Ukuran gambar terlalu besar (>500 KB).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({ 
      email: '', password: '', name: '', role: 'Admin Pembantu', status: 'Aktif', 
      allowed_access: ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'] 
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEditAdmin = (adm: AdminItem) => {
    setEditingAdmin(adm);
    let accessList: string[] = ['expert_directory', 'products', 'consultation_user', 'consultation_admin', 'visitor_stats', 'feedback'];
    if (adm.allowed_access) {
      try {
        const temp = typeof adm.allowed_access === 'string' ? JSON.parse(adm.allowed_access) : adm.allowed_access;
        accessList = Array.isArray(temp) ? temp : String(temp).split(',');
      } catch {
        accessList = String(adm.allowed_access).split(',');
      }
    }
    setAdminForm({
      email: String(adm.email || adm.admin_email || ''),
      password: '',
      name: String(adm.name || adm.nama || adm.admin_name || ''),
      role: String(adm.role || adm.admin_role || 'Admin Pembantu'),
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
    try {
      setSubmittingAdmin(true);
      const action = editingAdmin ? 'editadmin' : 'registeradmin';
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          email: adminForm.email,
          password: adminForm.password,
          name: adminForm.name,
          role: adminForm.role,
          status: adminForm.status,
          allowed_access: JSON.stringify(adminForm.allowed_access),
          adminName, adminEmail, adminRole
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(editingAdmin ? 'Akses admin berhasil diperbarui!' : 'Akun admin baru berhasil dibuat!');
        setIsAdminModalOpen(false);
        fetchSuperData();
      } else { alert(`Gagal: ${json.message}`); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmittingAdmin(false); }
  };

  const handleDeleteAdmin = async (adm: AdminItem) => {
    const email = String(adm.email || adm.admin_email || '').trim();
    const name = String(adm.name || adm.nama || 'Admin');
    if (!window.confirm(`⚠️ PERINGATAN FATAL: Hapus akun admin "${name}" (${email})?`)) return;

    try {
      setLoading(true);
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'deleteadmin', 
          email: email,
          adminEmail: email,
          adminName, 
          currentAdminEmail: adminEmail, 
          adminRole 
        })
      });
      const textRes = await res.text();
      let json;
      try { json = JSON.parse(textRes); } catch { json = { success: true }; }

      if (json.success !== false) {
        alert(`Akun admin "${name}" berhasil dihapus.`);
        fetchSuperData();
      } else { 
        alert(`Gagal dari server: ${json.message}`); 
      }
    } catch (err: any) { 
      alert(`Gagal menghapus admin: ${err.message}`); 
      fetchSuperData();
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenEditSub = (item: UserSubscriptionItem) => {
    setEditingUserSub(item);
    setSubForm({
      user_email: String(item.user_email || item.email || item.kontakUser || ''),
      plan: String(item.plan || 'FREE').toUpperCase(),
      status: String(item.status || 'ACTIVE').toUpperCase(),
      expired_date: String(item.expired_date || item.expired || '').slice(0, 10),
      custom_max_projects: String(item.max_projects || ''),
      custom_max_experts: String(item.max_experts || item.max_experts_manual || ''),
      custom_max_experts_directory: String(item.max_experts_directory || ''),
      custom_max_consultation_per_expert: String(item.max_consultation_per_expert || ''),
      custom_features: String(item.custom_features || ''),
      notes: String(item.notes || '')
    });
    setIsEditSubModalOpen(true);
  };

  const handlePlanSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value.toUpperCase();
    const currentPlan = subForm.plan.toUpperCase();
    
    let updatedForm = { ...subForm, plan: newPlan };
    
    if (newPlan !== currentPlan) {
      const confirmReset = window.confirm(`Anda mengubah paket dari ${currentPlan} ke ${newPlan}.\n\nApakah Anda ingin mengosongkan nilai Override/Custom agar sistem otomatis mengikuti batas bawaan dan fitur paket baru?`);
      if (confirmReset) {
        updatedForm.custom_max_projects = '';
        updatedForm.custom_max_experts = '';
        updatedForm.custom_max_experts_directory = '';
        updatedForm.custom_max_consultation_per_expert = '';
        
        const selectedPlanConfig = plans.find(p => p.plan_key.toUpperCase() === newPlan);
        if (selectedPlanConfig) {
          const features = [];
          if (selectedPlanConfig.allow_subcriteria) features.push('subcriteria');
          if (selectedPlanConfig.allow_alternative_method) features.push('alternative');
          if (selectedPlanConfig.allow_ai_features) features.push('ai');
          updatedForm.custom_features = features.join(',');
        } else {
          updatedForm.custom_features = '';
        }
      }
    }
    setSubForm(updatedForm);
  };

  const handleSaveUserSub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updatesubscription',
          user_email: subForm.user_email,
          plan: subForm.plan.toUpperCase(),
          status: subForm.status.toUpperCase(),
          expired_date: subForm.expired_date,
          max_projects: subForm.custom_max_projects,
          max_experts: subForm.custom_max_experts,
          max_experts_directory: subForm.custom_max_experts_directory,
          max_consultation_per_expert: subForm.custom_max_consultation_per_expert,
          custom_features: subForm.custom_features,
          notes: subForm.notes,
          adminName, adminEmail, adminRole
        }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) {
        alert(`✅ Hak Akses Privilege / Plan untuk ${subForm.user_email} berhasil diperbarui!`);
        setIsEditSubModalOpen(false);
        fetchSuperData();
      } else {
        alert('Gagal memperbarui: ' + (json.message || 'Terjadi kesalahan'));
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message);
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
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveplansettings',
          plans: plans,
          adminName, adminEmail, adminRole
        }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) {
        alert('✅ Pengaturan Config Paket & Batasan berhasil disimpan!');
      } else {
        alert('Gagal menyimpan: ' + json.message);
      }
    } catch (err: any) {
      alert('Kesalahan jaringan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 🟢 SIMPAN TANDA TANGAN & LOGO LANGSUNG KE SHEET SYSTEM_ASSETS
  const handleSaveSignatureSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      localStorage.setItem('active_signer_type', activeSignerType);
      localStorage.setItem('superadmin_signature_url', superAdminSignatureUrl);
      localStorage.setItem('backup_signer_name', backupSignerName);
      localStorage.setItem('backup_signer_title', backupSignerTitle);
      localStorage.setItem('backup_signer_signature_url', backupSignerSignatureUrl);
      localStorage.setItem('app_system_stamp_url', appSystemStampUrl);
      localStorage.setItem('xendit_active', String(xenditActive));
      localStorage.setItem('diditme_active', String(diditMeActive));

      if (GOOGLE_SCRIPT_URL) {
        await Promise.all([
          // 🟢 Simpan batch ke sheet system_assets / app_settings
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'save_system_assets',
              assets: {
                active_signer_type: activeSignerType,
                admin_signature: superAdminSignatureUrl,
                superadmin_signature_url: superAdminSignatureUrl,
                backup_signer_name: backupSignerName,
                backup_signer_title: backupSignerTitle,
                co_admin_signature: backupSignerSignatureUrl,
                backup_signer_signature_url: backupSignerSignatureUrl,
                platform_logo: appSystemStampUrl,
                app_system_stamp_url: appSystemStampUrl
              },
              adminEmail, adminName, adminRole
            })
          }),
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'updatepaymentsettings',
              xendit: xenditActive,
              is_xendit_active: xenditActive,
              xendit_mode: xenditMode,
              xendit_public_key: xenditPublicKey,
              xendit_secret_key: xenditSecretKey,
              adminName, adminEmail, adminRole
            })
          }),
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'updateditsettings',
              diditme: diditMeActive,
              diditme_apikey: diditApiKey,
              adminName, adminEmail, adminRole
            })
          })
        ]);
      }

      alert('✅ Pengaturan Tanda Tangan, Logo (Tersimpan ke Sheets), Xendit & Didit.me berhasil disimpan!');
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdminLogs = async () => {
    if (!window.confirm('⚠️ PERINGATAN FATAL: Apakah Anda yakin ingin menghapus SELURUH riwayat aktivitas audit admin?')) return;

    try {
      setLoading(true);
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteadminlogsulk',
          deleteAll: true,
          adminName,
          adminEmail,
          adminRole
        }),
        redirect: 'follow'
      });

      const textRes = await res.text();
      let json;
      try { json = JSON.parse(textRes); } catch { json = { success: true }; }

      if (json.success !== false) {
        alert('Seluruh audit trail berhasil dibersihkan.');
        fetchSuperData();
      } else {
        alert(`Gagal dari server: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Gagal menghapus log audit: ${err.message}`);
      fetchSuperData();
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
            📊 Kinerja & Audit Aktivitas Admin ({adminLogsList.length})
          </button>
          <button onClick={() => setActiveTab('admins_management')} style={activeTab === 'admins_management' ? STYLES.tabActive : STYLES.tabInactive}>
            👥 Pengaturan Akun Admin & Wewenang Modul ({admins.length})
          </button>
          <button onClick={() => setActiveTab('subscriptions')} style={activeTab === 'subscriptions' ? STYLES.tabActive : STYLES.tabInactive}>
            📜 Subscriptions Komersial ({filteredUserSubs.length})
          </button>
          <button onClick={() => setActiveTab('plans_config')} style={activeTab === 'plans_config' ? STYLES.tabActive : STYLES.tabInactive}>
            ⚙️ Config Batasan Paket ({plans.length})
          </button>
          <button onClick={() => setActiveTab('signature_stamp')} style={activeTab === 'signature_stamp' ? STYLES.tabActive : STYLES.tabInactive}>
            ✍️ Pengaturan Tanda Tangan & Pembayaran
          </button>
        </div>

        {apiError && <div style={STYLES.errorBox}>{apiError}</div>}

        <div style={STYLES.contentCard} className="content-card">
          
          {/* 1. KINERJA & AUDIT AKTIVITAS ADMIN */}
          {activeTab === 'admin_performance' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>📊 Audit Trail & Ringkasan Kinerja Admin Pembantu</h3>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
                {adminPerformanceStats.map((st, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10, padding: 16 }}>
                    <strong style={{ fontSize: 14, color: '#1e3a8a' }}>{st.name}</strong>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 10 }}>{st.email}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
                      <div style={{ background: '#fff', padding: 6, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 9, color: '#64748b' }}>TOTAL AKSI</div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>{st.totalActions}</div>
                      </div>
                      <div style={{ background: '#fff', padding: 6, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 9, color: '#64748b' }}>PAKAR</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{st.expertsManaged}</div>
                      </div>
                      <div style={{ background: '#fff', padding: 6, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 9, color: '#64748b' }}>CATATAN</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#d97706' }}>{st.notesSent}</div>
                      </div>
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
                    {adminLogsList.map((log, i) => (
                      <tr key={i}>
                        <td style={STYLES.td}>#{i + 1}</td>
                        <td style={STYLES.td}>{String(log.timestamp || log[0] || '-')}</td>
                        <td style={STYLES.td}><strong>{String(log.adminName || log[1] || '-')}</strong></td>
                        <td style={STYLES.td}>{String(log.adminRole || log[3] || 'Admin')}</td>
                        <td style={STYLES.td}>{String(log.actionName || log[4] || '-')}</td>
                        <td style={STYLES.td}>{String(log.details || log[5] || '-')}</td>
                      </tr>
                    ))}
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
                  <h3 style={STYLES.cardTitle}>👥 Kelola Akun Admin & Wewenang Modul</h3>
                  <p style={STYLES.cardDesc}>Atur centangan akses modul harian untuk Admin Pembantu.</p>
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
                    {admins.map((adm, i) => (
                      <tr key={i}>
                        <td style={STYLES.td}><strong>{String(adm.name || adm.nama || '-')}</strong></td>
                        <td style={STYLES.td}>{String(adm.email || adm.admin_email || '-')}</td>
                        <td style={STYLES.td}>{String(adm.role || 'Admin Pembantu')}</td>
                        <td style={STYLES.td}>
                          <div style={{ maxWidth: 200, fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                            {String(adm.allowed_access || 'Direktori, Konsultasi').replace(/_/g, ' ')}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. USER SUBSCRIPTIONS (KHUSUS PENGGUNA KOMERSIAL) */}
          {activeTab === 'subscriptions' && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <div>
                  <h3 style={STYLES.cardTitle}>📜 Subscriptions &amp; Hak Akses Komersial ({filteredUserSubs.length})</h3>
                  <p style={STYLES.cardDesc}>
                    Pengaturan paket komersial (FREE, PLUS, PRO, PREMIUM). Data Evaluator Pakar dikelola terpisah pada Dashboard Operasional Admin.
                  </p>
                </div>
                <button onClick={fetchSuperData} disabled={loading} style={{ ...STYLES.btnUpload, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
                  {loading ? 'Memuat...' : 'Muat Ulang Data'}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="🔍 Cari email, nama, paket, atau catatan pelanggan umum..."
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
                      <th style={STYLES.th}>Rincian Privilese & Custom Limits</th>
                      <th style={STYLES.th}>Catatan SuperAdmin</th>
                      <th style={{ ...STYLES.th, textAlign: 'center' }}>Aksi Privilese</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserSubs.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>{loading ? 'Sedang memuat data...' : 'Belum ada data pelanggan komersial ditemukan.'}</td></tr>
                    ) : (
                      filteredUserSubs.map((item, idx) => {
                        const email = item.user_email || item.email || item.kontakUser || item.kontak || '-';
                        const name = item.user_name || item.namaUser || item.nama || item.name || 'User Terdaftar';
                        const plan = String(item.plan || item.Plan || 'FREE').toUpperCase();
                        const status = String(item.status || item.Status || 'ACTIVE').toUpperCase();
                        const exp = item.expired_date || item.expired || '-';
                        
                        const maxProj = item.max_projects;
                        const maxExp = item.max_experts || item.max_experts_manual;
                        const maxExpDir = item.max_experts_directory;
                        const maxConsult = item.max_consultation_per_expert;
                        const custFeatures = item.custom_features;
                        const notes = item.notes || '-';
                        
                        let badgeBg = '#f1f5f9';
                        let badgeColor = '#475569';
                        if (plan === 'PRO') { badgeBg = '#eff6ff'; badgeColor = '#1d4ed8'; }
                        else if (plan === 'PLUS') { badgeBg = '#f3e8ff'; badgeColor = '#7e22ce'; }
                        else if (plan === 'PREMIUM') { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }

                        return (
                          <tr key={idx}>
                            <td style={STYLES.td}>
                              <strong style={{ color: '#0f172a' }}>{name}</strong>
                              <div style={{ fontSize: 11.5, color: '#64748b' }}>{email}</div>
                            </td>
                            <td style={STYLES.td}>
                              <span style={{ background: badgeBg, color: badgeColor, padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>
                                {plan}
                              </span>
                            </td>
                            <td style={STYLES.td}>
                              <span style={{ color: status === 'ACTIVE' ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12 }}>
                                {status === 'ACTIVE' ? '🟢 AKTIF' : '🔴 EXPIRED'}
                              </span>
                            </td>
                            <td style={{ ...STYLES.td, color: '#64748b', fontSize: 12 }}>{exp}</td>
                            <td style={{ ...STYLES.td, fontSize: 11.5, color: '#334155', lineHeight: 1.4 }}>
                              <div><strong>• Max Projects:</strong> {maxProj ? maxProj : 'Default Plan'}</div>
                              <div><strong>• Max Experts:</strong> {maxExp ? maxExp : 'Default Plan'}</div>
                              {maxExpDir && <div><strong>• Max Dir Experts:</strong> {maxExpDir}</div>}
                              {maxConsult && <div><strong>• Max Consultation:</strong> {maxConsult}</div>}
                              {custFeatures && <div style={{ color: '#1d4ed8', fontWeight: 600 }}><strong>• Features:</strong> {custFeatures}</div>}
                            </td>
                            <td style={{ ...STYLES.td, fontSize: 11.5, color: '#64748b', fontStyle: 'italic', maxWidth: 160 }}>
                              {notes}
                            </td>
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <button
                                onClick={() => handleOpenEditSub(item)}
                                style={STYLES.btnEdit}
                              >
                                ✏️ Ubah Privilese
                              </button>
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
                  <h3 style={STYLES.cardTitle}>⚙️ Konfigurasi Harga & Batasan Paket (Semester Pass)</h3>
                  <p style={STYLES.cardDesc}>Ubah batasan kuota proyek, expert, serta fitur khusus untuk masing-masing paket bawaan.</p>
                </div>
                <button onClick={handleSavePlans} disabled={saving} style={STYLES.btnAdd}>
                  {saving ? 'Menyimpan...' : '💾 Simpan Pengaturan Paket'}
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Memuat konfigurasi paket...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  {plans.map((p, idx) => (
                    <div key={p.plan_key} style={{ border: '1.5px solid #cbd5e1', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1e3a8a', marginBottom: 10, textTransform: 'uppercase' }}>
                        Paket {p.label}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label style={STYLES.label}>Harga (IDR) / 6 Bulan</label>
                          <input type="number" value={p.price} onChange={(e) => handlePlanChange(idx, 'price', Number(e.target.value))} style={STYLES.input} />
                        </div>

                        <div>
                          <label style={STYLES.label}>Max Proyek (999999 = Unlimited)</label>
                          <input type="number" value={p.max_projects} onChange={(e) => handlePlanChange(idx, 'max_projects', Number(e.target.value))} style={STYLES.input} />
                        </div>

                        <div>
                          <label style={STYLES.label}>Max Expert Manual</label>
                          <input type="number" value={p.max_experts_manual} onChange={(e) => handlePlanChange(idx, 'max_experts_manual', Number(e.target.value))} style={STYLES.input} />
                        </div>

                        <div>
                          <label style={STYLES.label}>Max Expert Direktori</label>
                          <input type="number" value={p.max_experts_directory} onChange={(e) => handlePlanChange(idx, 'max_experts_directory', Number(e.target.value))} style={STYLES.input} />
                        </div>

                        <div>
                          <label style={STYLES.label}>Kuota Tiket Konsultasi/Pakar</label>
                          <input type="number" value={p.max_consultation_per_expert} onChange={(e) => handlePlanChange(idx, 'max_consultation_per_expert', Number(e.target.value))} style={STYLES.input} />
                        </div>

                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={p.allow_subcriteria} onChange={(e) => handlePlanChange(idx, 'allow_subcriteria', e.target.checked)} />
                            <span>Penyusunan Subkriteria</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={p.allow_alternative_method} onChange={(e) => handlePlanChange(idx, 'allow_alternative_method', e.target.checked)} />
                            <span>Bobot & Ranking Alternatif</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                            <input type="checkbox" checked={p.allow_ai_features} onChange={(e) => handlePlanChange(idx, 'allow_ai_features', e.target.checked)} />
                            <span>Akses Fitur AI Analisis</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. PENGATURAN TANDA TANGAN, LOGO, & PEMBAYARAN */}
          {activeTab === 'signature_stamp' && (
            <div>
              <h3 style={STYLES.cardTitle}>✍️ Pengaturan Pengesah Sertifikat, Logo &amp; Pembayaran</h3>
              <p style={STYLES.cardDesc}>Konfigurasi tanda tangan digital, stempel resmi, serta gateway pembayaran.</p>
              
              <form onSubmit={handleSaveSignatureSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, maxWidth: 600 }}>
                <div>
                  <label style={STYLES.label}>Pilih Penandatangan Aktif:</label>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#1e3a8a' }}>
                      <input type="radio" name="signerType" value="main" checked={activeSignerType === 'main'} onChange={() => setActiveSignerType('main')} />
                      <span>1. SuperAdmin Utama</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#0284c7' }}>
                      <input type="radio" name="signerType" value="backup" checked={activeSignerType === 'backup'} onChange={() => setActiveSignerType('backup')} />
                      <span>2. Admin Cadangan / Perwakilan</span>
                    </label>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#0f172a' }}>🟢 Tanda Tangan SuperAdmin Utama</h4>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="text" placeholder="URL TTD atau Base64..." value={superAdminSignatureUrl} onChange={e => setSuperAdminSignatureUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                    <label style={STYLES.btnUpload}>
                      Upload PNG
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setSuperAdminSignatureUrl)} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {superAdminSignatureUrl && (
                    <div style={{ marginTop: 8, textAlign: 'center', background: '#fff', padding: 8, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                      <img src={superAdminSignatureUrl} alt="TTD Utama" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#0f172a' }}>🔵 Tanda Tangan Admin Cadangan / Perwakilan</h4>
                  <input type="text" placeholder="Nama Lengkap Cadangan" value={backupSignerName} onChange={e => setBackupSignerName(e.target.value)} style={{ ...STYLES.input, marginBottom: 10 }} />
                  <input type="text" placeholder="Jabatan Cadangan" value={backupSignerTitle} onChange={e => setBackupSignerTitle(e.target.value)} style={{ ...STYLES.input, marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="text" placeholder="URL TTD Cadangan..." value={backupSignerSignatureUrl} onChange={e => setBackupSignerSignatureUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                    <label style={STYLES.btnUpload}>
                      Upload PNG
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setBackupSignerSignatureUrl)} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {backupSignerSignatureUrl && (
                    <div style={{ marginTop: 8, textAlign: 'center', background: '#fff', padding: 8, borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                      <img src={backupSignerSignatureUrl} alt="TTD Cadangan" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                <div style={{ background: '#fdf4ff', padding: 14, borderRadius: 8, border: '1px solid #f0abfc' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#86198f' }}>🟣 Logo Stempel Aplikasi</h4>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="text" placeholder="URL Logo PNG..." value={appSystemStampUrl} onChange={e => setAppSystemStampUrl(e.target.value)} style={{ ...STYLES.input, flex: 1 }} />
                    <label style={{ ...STYLES.btnUpload, background: '#a855f7' }}>
                      Upload Logo
                      <input type="file" accept="image/*" onChange={e => handleFileUpload(e, setAppSystemStampUrl)} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {appSystemStampUrl && (
                    <div style={{ marginTop: 8, textAlign: 'center', background: '#fff', padding: 8, borderRadius: 6, border: '1px dashed #f0abfc' }}>
                      <img src={appSystemStampUrl} alt="Logo Aplikasi" style={{ maxHeight: 60, maxWidth: 180, objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                {/* BLOK PENGATURAN XENDIT LENGKAP */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#0f172a' }}>💳 Konfigurasi Xendit Payment Gateway</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1e3a8a' }}>Status Aktif Xendit</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Aktifkan otomatisasi tagihan pembayaran langganan di halaman user.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={xenditActive} 
                        onChange={(e) => setXenditActive(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Xendit Mode:</label>
                      <select value={xenditMode} onChange={e => setXenditMode(e.target.value)} style={STYLES.input}>
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>

                    <div>
                      <label style={STYLES.label}>Xendit Public Key:</label>
                      <input 
                        type="text" 
                        placeholder="xnd_public_..." 
                        value={xenditPublicKey} 
                        onChange={e => setXenditPublicKey(e.target.value)} 
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Xendit Secret Key:</label>
                      <input 
                        type="password" 
                        placeholder="xnd_development_... / xnd_production_..." 
                        value={xenditSecretKey} 
                        onChange={e => setXenditSecretKey(e.target.value)} 
                        style={STYLES.input} 
                      />
                    </div>
                  </div>
                </div>

                {/* BLOK PENGATURAN DIDIT.ME */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#0f172a' }}>🔗 Integrasi Didit.me (Halaman Publik Expert Directory)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      <div>
                        <strong style={{ fontSize: 13, color: '#1e3a8a' }}>Status Aktif Didit.me</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Aktifkan verifikasi otomatis Didit.me saat publik mendaftar di direktori pakar.</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={diditMeActive} 
                        onChange={(e) => setDiditMeActive(e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Didit.me API Key / Secret:</label>
                      <input 
                        type="password" 
                        placeholder="Masukkan API Key Didit.me..." 
                        value={diditApiKey} 
                        onChange={e => setDiditApiKey(e.target.value)} 
                        style={STYLES.input} 
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading} style={STYLES.btnSaveModal}>
                  {loading ? 'Menyimpan...' : 'Simpan Pengaturan Sistem'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* MODAL EDIT / TAMBAH ADMIN */}
      {isAdminModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalBox, maxWidth: 520 }}>
            <div style={STYLES.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>{editingAdmin ? 'Edit Akses Admin' : 'Tambah Admin Baru'}</h3>
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
                <label style={STYLES.label}>{editingAdmin ? 'Password Baru (Opsional)' : 'Password Login *'}</label>
                <input type="password" required={!editingAdmin} placeholder={editingAdmin ? 'Kosongkan jika tidak diubah' : '••••••••'} value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} style={STYLES.input} />
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

      {/* MODAL EDIT PRIVILESE USER (DENGAN PILIHAN PLAN KAPITAL & OPSI CHECKBOX CUSTOM FEATURES) */}
      {isEditSubModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalBox, maxWidth: 500 }}>
            <div style={STYLES.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>Ubah Privilese User LENGKAP</h3>
              <button onClick={() => setIsEditSubModalOpen(false)} style={STYLES.btnCloseModal}>✕</button>
            </div>

            <form onSubmit={handleSaveUserSub} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div>
                <label style={STYLES.label}>Email User (Pengguna)</label>
                <input type="email" value={subForm.user_email} readOnly style={{ ...STYLES.input, background: '#f1f5f9', fontWeight: 700 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Pilih Paket (Plan Privilese)</label>
                  <select
                    value={subForm.plan.toUpperCase()}
                    onChange={handlePlanSelectionChange}
                    style={{ ...STYLES.input, fontWeight: 700 }}
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                    <option value="PLUS">PLUS</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>

                <div>
                  <label style={STYLES.label}>Status Akses</label>
                  <select
                    value={subForm.status}
                    onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}
                    style={STYLES.input}
                  >
                    <option value="ACTIVE">ACTIVE (Aktif)</option>
                    <option value="EXPIRED">EXPIRED (Kedaluwarsa)</option>
                    <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={STYLES.label}>Tanggal Kadaluarsa (Expired Date)</label>
                <input
                  type="date"
                  value={subForm.expired_date}
                  onChange={(e) => setSubForm({ ...subForm, expired_date: e.target.value })}
                  style={STYLES.input}
                />
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <strong style={{ fontSize: 12, color: '#1e3a8a', display: 'block', marginBottom: 8 }}>Overriding Limits (Custom Limits):</strong>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={STYLES.label}>Max Projects</label>
                    <input
                      type="number"
                      placeholder="Kosong = Ikut Plan"
                      value={subForm.custom_max_projects}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_projects: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>

                  <div>
                    <label style={STYLES.label}>Max Manual Experts</label>
                    <input
                      type="number"
                      placeholder="Kosong = Ikut Plan"
                      value={subForm.custom_max_experts}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_experts: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>

                  <div>
                    <label style={STYLES.label}>Max Directory Experts</label>
                    <input
                      type="number"
                      placeholder="Kosong = Ikut Plan"
                      value={subForm.custom_max_experts_directory}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_experts_directory: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>

                  <div>
                    <label style={STYLES.label}>Max Consultation / Expert</label>
                    <input
                      type="number"
                      placeholder="Kosong = Ikut Plan"
                      value={subForm.custom_max_consultation_per_expert}
                      onChange={(e) => setSubForm({ ...subForm, custom_max_consultation_per_expert: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>
                </div>
              </div>

              {/* OPSI CHECKBOX UNTUK CUSTOM FEATURES */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}>
                <label style={{ ...STYLES.label, color: '#1e3a8a', marginBottom: 8 }}>
                  ⚡ Opsi Fitur Khusus (Custom Features / Overrides):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={isCustomFeatureChecked('subcriteria')}
                      onChange={() => toggleCustomFeatureCheck('subcriteria')}
                    />
                    <span>Penyusunan Subkriteria (<code style={{ fontSize: 11, background: '#e2e8f0', padding: '1px 4px', borderRadius: 4 }}>subcriteria</code>)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={isCustomFeatureChecked('alternative')}
                      onChange={() => toggleCustomFeatureCheck('alternative')}
                    />
                    <span>Bobot & Ranking Alternatif (<code style={{ fontSize: 11, background: '#e2e8f0', padding: '1px 4px', borderRadius: 4 }}>alternative</code>)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={isCustomFeatureChecked('ai')}
                      onChange={() => toggleCustomFeatureCheck('ai')}
                    />
                    <span>Akses Fitur AI Analisis (<code style={{ fontSize: 11, background: '#e2e8f0', padding: '1px 4px', borderRadius: 4 }}>ai</code>)</span>
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ ...STYLES.label, fontSize: 11, color: '#64748b' }}>Custom Feature String / Tag tambahan:</label>
                  <input
                    type="text"
                    placeholder="Kosong = Ikut Plan"
                    value={subForm.custom_features}
                    onChange={(e) => setSubForm({ ...subForm, custom_features: e.target.value })}
                    style={{ ...STYLES.input, fontSize: 12, background: '#fff' }}
                  />
                </div>
              </div>

              <div>
                <label style={STYLES.label}>Catatan SuperAdmin (notes)</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan khusus, alasan upgrade manual, dll."
                  value={subForm.notes}
                  onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                  style={{ ...STYLES.input, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setIsEditSubModalOpen(false)} style={STYLES.btnCancel}>
                  Batal
                </button>
                <button type="submit" disabled={saving} style={STYLES.btnSaveModal}>
                  {saving ? 'Menyimpan...' : 'Simpan Privilese'}
                </button>
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