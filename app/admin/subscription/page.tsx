'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

// Daftar Fitur Boolean (TRUE/FALSE) yang Bisa Dicentang
const AVAILABLE_FEATURES = [
  { id: 'allow_subcriteria', label: 'Akses Subkriteria Multi-Level' },
  { id: 'allow_alternative_method', label: 'Matriks Bobot Alternatif' },
  { id: 'allow_ai_features', label: 'Akses AI Analisis Riset' },
];

export default function AdminSubscriptionPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // State Utama
  const [targetUser, setTargetUser] = useState<any>(null);
  const [plan, setPlan] = useState('free');
  const [status, setStatus] = useState('active');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  
  // State Custom Overrides (Pengecualian Batas)
  const [maxProjects, setMaxProjects] = useState('');
  const [maxExpertsManual, setMaxExpertsManual] = useState('');
  const [maxExpertsDirectory, setMaxExpertsDirectory] = useState('');
  const [maxConsultations, setMaxConsultations] = useState('');

  // State untuk fitur yang dicentang
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role') || '';
    const name = localStorage.getItem('admin_name') || 'Admin';
    const email = localStorage.getItem('admin_email') || '';

    if (!token) {
      router.replace('/admin/login');
      return;
    }

    const checkSuper = role.toLowerCase().includes('superadmin') || role.toLowerCase().includes('super admin');
    setIsSuperAdmin(checkSuper);
    setAdminName(name);
    setAdminEmail(email);
    setAdminRole(role);

    if (!checkSuper) {
      alert('Akses Ditolak. Hanya SuperAdmin yang dapat mengelola Subscription.');
      router.replace('/admin/dashboard');
    }
  }, [router]);

  // Set fitur otomatis saat Preset Plan diubah
  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value;
    setPlan(newPlan);

    // Mengosongkan custom overrides agar kembali ke setelan global (bawaan paket)
    setMaxProjects('');
    setMaxExpertsManual('');
    setMaxExpertsDirectory('');
    setMaxConsultations('');

    if (newPlan === 'free') {
      setSelectedFeatures(['allow_subcriteria']);
    } else if (newPlan === 'pro') {
      setSelectedFeatures(['allow_subcriteria', 'allow_alternative_method']);
    } else if (newPlan === 'plus' || newPlan === 'premium') {
      setSelectedFeatures(['allow_subcriteria', 'allow_alternative_method', 'allow_ai_features']);
    }
  };

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId) 
        : [...prev, featureId]
    );
  };

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      setTargetUser(null);

      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=getsubscription&user_email=${encodeURIComponent(searchEmail.trim())}`);
      const json = await res.json();

      if (json.success && json.data) {
        const d = json.data;
        setTargetUser(d);
        setPlan(d.plan || 'free');
        setStatus(d.status || 'active');
        
        if (d.expires_at || d.end_date) {
          const dateObj = new Date(d.expires_at || d.end_date);
          if (!isNaN(dateObj.getTime())) setExpiresAt(dateObj.toISOString().split('T')[0]);
        } else {
          setExpiresAt('');
        }
        
        setNotes(d.notes || '');
        
        // Load custom overrides jika ada
        setMaxProjects(d.max_projects || '');
        setMaxExpertsManual(d.max_experts || d.max_experts_manual || '');
        setMaxExpertsDirectory(d.max_experts_directory || '');
        setMaxConsultations(d.max_consultation_per_expert || '');

        // Muat fitur kustom jika ada dari database
        if (d.custom_features) {
          setSelectedFeatures(d.custom_features.split(',').map((f: string) => f.trim()));
        } else {
          // Fallback bawaan
          const p = d.plan || 'free';
          if (p === 'free') setSelectedFeatures(['allow_subcriteria']);
          else if (p === 'pro') setSelectedFeatures(['allow_subcriteria', 'allow_alternative_method']);
          else if (p === 'plus' || p === 'premium') setSelectedFeatures(['allow_subcriteria', 'allow_alternative_method', 'allow_ai_features']);
          else setSelectedFeatures([]);
        }
      } else {
        const confirmCreate = window.confirm(
          `Data langganan untuk email "${searchEmail}" tidak ditemukan.\nApakah Anda ingin membuat profil langganan baru untuk email ini sekarang?`
        );
        
        if (confirmCreate) {
          setTargetUser({ user_email: searchEmail });
          setPlan('free');
          setStatus('active');
          setExpiresAt('');
          setNotes('');
          setMaxProjects('');
          setMaxExpertsManual('');
          setMaxExpertsDirectory('');
          setMaxConsultations('');
          setSelectedFeatures(['allow_subcriteria']);
          setSuccessMsg('Silakan atur paket langganan baru di bawah ini lalu klik Simpan Perubahan.');
        } else {
          setError('Pencarian dibatalkan. Data tidak ditemukan.');
        }
      }
    } catch (err: any) {
      setError(`Gagal mencari data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!window.confirm(`Simpan pengaturan & override paket untuk [${searchEmail}]?`)) return;

    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      const payload = {
        action: 'updatesubscriptionadmin', 
        user_id: targetUser?.user_id || `USR-${Date.now()}`,
        user_email: searchEmail.trim(),
        plan: plan,
        status: status,
        expires_at: expiresAt,
        notes: notes,
        
        // Pengecualian Batasan (Kirim sbg string kosong jika tidak diisi)
        max_projects: maxProjects,
        max_experts: maxExpertsManual,
        max_experts_directory: maxExpertsDirectory,
        max_consultation_per_expert: maxConsultations,
        
        custom_features: selectedFeatures.join(','),
        adminName,
        adminEmail,
        adminRole
      };

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      
      if (json.success) {
        setSuccessMsg(`✅ Paket langganan & Kustomisasi untuk ${searchEmail} berhasil disimpan!`);
      } else {
        setError(json.message || 'Gagal menyimpan pembaruan langganan.');
      }
    } catch (err: any) {
      setError(`Terjadi kesalahan jaringan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) return null; 

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <div>
          <h2 style={STYLES.headerTitle}>💳 Manajemen Akun &amp; Kustomisasi Langganan User</h2>
          <p style={STYLES.headerSubtitle}>Tetapkan paket atau berikan akses pengecualian fitur (Override) secara spesifik.</p>
        </div>
        <button onClick={() => router.push('/admin/dashboard')} style={STYLES.btnBack}>
          ← Kembali
        </button>
      </header>

      <div style={STYLES.container}>
        
        <div style={STYLES.card}>
          <h3 style={STYLES.cardTitle}>Cari Akun Pengguna</h3>
          <form onSubmit={handleSearchUser} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <input 
              type="email" 
              placeholder="Masukkan Email Pengguna..." 
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              style={STYLES.input}
              required
            />
            <button type="submit" disabled={loading} style={STYLES.btnSearch}>
              {loading && !targetUser ? 'Mencari...' : '🔍 Cari'}
            </button>
          </form>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 14, borderRadius: 8, border: '1px solid #fca5a5', marginTop: 16 }}>⚠️ {error}</div>}
        {successMsg && <div style={{ background: '#f0fdf4', color: '#15803d', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0', marginTop: 16 }}>✅ {successMsg}</div>}

        {targetUser && (
          <div style={{ ...STYLES.card, marginTop: 20 }}>
            <h3 style={STYLES.cardTitle}>Detail &amp; Pengaturan Paket</h3>
            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 16, color: '#1e3a8a', fontSize: 13 }}>
              <strong>Email:</strong> {targetUser.user_email || searchEmail}
            </div>

            <form onSubmit={handleSaveSubscription} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={STYLES.label}>Tipe Paket Dasar (Preset)</label>
                  <select value={plan} onChange={handlePlanChange} style={STYLES.input}>
                    <option value="free">Free Pass</option>
                    <option value="pro">Pro Semester Pass</option>
                    <option value="plus">Plus Semester Pass</option>
                    <option value="premium">Premium Pass</option>
                  </select>
                </div>
                <div>
                  <label style={STYLES.label}>Status Berlangganan</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={STYLES.input}>
                    <option value="active">Active</option>
                    <option value="expired">Expired / Inactive</option>
                  </select>
                </div>
              </div>

              {/* 🟢 CUSTOM OVERRIDE (BATASAN KHUSUS) */}
              <div style={{ padding: 16, border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0f172a' }}>🛠️ Pengecualian Batas Kuota (Override)</h4>
                <p style={{ margin: '0 0 14px', fontSize: 11.5, color: '#64748b' }}>
                  Kosongkan input jika Anda ingin menggunakan batasan standar paket. Isi dengan angka (atau 999999 untuk Unlimited) jika Anda ingin memberi pengecualian untuk user ini.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={STYLES.label}>Override Max Proyek</label>
                    <input type="number" placeholder="Bawaan Paket..." value={maxProjects} onChange={(e) => setMaxProjects(e.target.value)} style={STYLES.input}/>
                  </div>
                  <div>
                    <label style={STYLES.label}>Override Max Pakar Manual</label>
                    <input type="number" placeholder="Bawaan Paket..." value={maxExpertsManual} onChange={(e) => setMaxExpertsManual(e.target.value)} style={STYLES.input}/>
                  </div>
                  <div>
                    <label style={STYLES.label}>Override Max Pakar Direktori</label>
                    <input type="number" placeholder="Bawaan Paket..." value={maxExpertsDirectory} onChange={(e) => setMaxExpertsDirectory(e.target.value)} style={STYLES.input}/>
                  </div>
                  <div>
                    <label style={STYLES.label}>Override Max Konsultasi/Pakar</label>
                    <input type="number" placeholder="Bawaan Paket..." value={maxConsultations} onChange={(e) => setMaxConsultations(e.target.value)} style={STYLES.input}/>
                  </div>
                </div>
              </div>

              {/* 🟢 KUSTOMISASI FITUR (CHECKBOX) */}
              <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <label style={{ ...STYLES.label, marginBottom: 10 }}>Kustomisasi Izin Fitur (Centang untuk Mengizinkan)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {AVAILABLE_FEATURES.map((feature) => (
                    <label key={feature.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#334155' }}>
                      <input 
                        type="checkbox"
                        checked={selectedFeatures.includes(feature.id)}
                        onChange={() => handleFeatureToggle(feature.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      {feature.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={STYLES.label}>Tanggal Kedaluwarsa</label>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={STYLES.input}/>
                </div>
                <div>
                  <label style={STYLES.label}>Catatan Admin</label>
                  <input type="text" placeholder="Contoh: Bonus fitur sertifikat khusus instansi" value={notes} onChange={(e) => setNotes(e.target.value)} style={STYLES.input}/>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="submit" disabled={loading} style={STYLES.btnSave}>
                  {loading ? 'Menyimpan...' : '💾 Simpan Konfigurasi User'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif', paddingBottom: 40 },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' },
  headerSubtitle: { margin: '2px 0 0', fontSize: 13, color: '#64748b' },
  btnBack: { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  container: { maxWidth: 800, margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column' },
  card: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(15,23,42,0.02)' },
  cardTitle: { margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' },
  label: { fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none' },
  btnSearch: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSave: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
};