'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

const DEFAULT_PLANS = [
  { 
    plan_key: 'free', label: 'Free Pass', price: 0, duration_months: 6, 
    max_projects: 1, max_experts_manual: 5, max_experts_directory: 2, max_consultation_per_expert: 1,
    allow_subcriteria: true, allow_alternative_method: false, allow_ai_features: false 
  },
  { 
    plan_key: 'pro', label: 'Pro Semester Pass', price: 150000, duration_months: 6, 
    max_projects: 3, max_experts_manual: 8, max_experts_directory: 5, max_consultation_per_expert: 3,
    allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: false 
  },
  { 
    plan_key: 'plus', label: 'Plus Semester Pass', price: 350000, duration_months: 6, 
    max_projects: 10, max_experts_manual: 15, max_experts_directory: 10, max_consultation_per_expert: 5,
    allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true 
  },
  { 
    plan_key: 'premium', label: 'Premium Pass', price: 750000, duration_months: 6, 
    max_projects: 999999, max_experts_manual: 999999, max_experts_directory: 999999, max_consultation_per_expert: 15,
    allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true 
  },
];

export default function AdminPlansPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submittingPlans, setSubmittingPlans] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [plans, setPlans] = useState<any[]>(DEFAULT_PLANS);
  const [paymentConfig, setPaymentConfig] = useState({
    is_xendit_active: false,
    xendit_mode: 'sandbox',
    xendit_public_key: '',
    xendit_secret_key: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [resPlans, resPayment] = await Promise.all([
        fetch(`${GOOGLE_SCRIPT_URL}?action=getplansettings`, { cache: 'no-store' }),
        fetch(`${GOOGLE_SCRIPT_URL}?action=getpaymentsettings`, { cache: 'no-store' })
      ]);

      const jsonPlans = await resPlans.json();
      if (jsonPlans.success && Array.isArray(jsonPlans.data) && jsonPlans.data.length > 0) {
        const normalized = jsonPlans.data.map((item: any) => ({
          ...item,
          allow_subcriteria: String(item.allow_subcriteria).toUpperCase() === 'TRUE' || item.allow_subcriteria === true,
          allow_alternative_method: String(item.allow_alternative_method).toUpperCase() === 'TRUE' || item.allow_alternative_method === true,
          allow_ai_features: String(item.allow_ai_features).toUpperCase() === 'TRUE' || item.allow_ai_features === true,
        }));
        setPlans(normalized);
      } else {
        setPlans(DEFAULT_PLANS);
      }

      const jsonPayment = await resPayment.json().catch(() => ({}));
      if (jsonPayment.success && jsonPayment.data) {
        setPaymentConfig({
          is_xendit_active: String(jsonPayment.data.is_xendit_active).toUpperCase() === 'TRUE',
          xendit_mode: jsonPayment.data.xendit_mode || 'sandbox',
          xendit_public_key: jsonPayment.data.xendit_public_key || '',
          xendit_secret_key: jsonPayment.data.xendit_secret_key || ''
        });
      }
    } catch (err: any) {
      console.warn('Gagal memuat konfigurasi:', err.message);
      setPlans(DEFAULT_PLANS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role') || '';
    if (!token || !role.toLowerCase().includes('superadmin')) {
      alert('Akses Ditolak. Khusus SuperAdmin.');
      router.replace('/admin/dashboard');
      return;
    }
    fetchData();
  }, [router, fetchData]);

  const handleInputChange = (index: number, field: string, value: any) => {
    const updated = [...plans];
    updated[index][field] = value;
    setPlans(updated);
  };

  const handleSaveAllPlans = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Simpan seluruh perubahan pengaturan global paket ke Google Sheets?')) return;

    try {
      setSubmittingPlans(true);
      setError('');
      setSuccessMsg('');

      const formattedPlans = plans.map(p => ({
        ...p,
        allow_subcriteria: p.allow_subcriteria ? 'TRUE' : 'FALSE',
        allow_alternative_method: p.allow_alternative_method ? 'TRUE' : 'FALSE',
        allow_ai_features: p.allow_ai_features ? 'TRUE' : 'FALSE',
      }));

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateplansettings',
          plans: formattedPlans,
          adminName: localStorage.getItem('admin_name') || 'SuperAdmin',
          adminEmail: localStorage.getItem('admin_email') || ''
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg('✅ Pengaturan global plan berhasil diperbarui!');
        fetchData();
      } else {
        setError(json.message || 'Gagal menyimpan perubahan paket.');
      }
    } catch (err: any) {
      setError(`Gagal menyimpan paket: ${err.message}`);
    } finally {
      setSubmittingPlans(false);
    }
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingPayment(true);
      setError('');
      setSuccessMsg('');

      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updatepaymentsettings',
          settings: paymentConfig,
          adminName: localStorage.getItem('admin_name') || 'SuperAdmin',
          adminEmail: localStorage.getItem('admin_email') || ''
        })
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg('✅ Pengaturan Payment Gateway Xendit berhasil diperbarui!');
        fetchData();
      } else {
        setError(json.message || 'Gagal menyimpan konfigurasi Xendit.');
      }
    } catch (err: any) {
      setError(`Gagal menyimpan Xendit: ${err.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <div>
          <h2 style={STYLES.headerTitle}>⚙️ Pengaturan Global Paket &amp; Payment Gateway</h2>
          <p style={STYLES.headerSubtitle}>Kelola harga, batasan kuota, serta API Key integrasi Xendit secara terpusat.</p>
        </div>
        <button onClick={() => router.push('/admin/dashboard')} style={STYLES.btnBack}>
          ← Kembali ke Dashboard
        </button>
      </header>

      <div style={STYLES.container}>
        {error && <div style={STYLES.errorBox}>⚠️ {error}</div>}
        {successMsg && <div style={STYLES.successBox}>{successMsg}</div>}

        {loading ? (
          <div style={STYLES.loadingBox}>Memuat data konfigurasi...</div>
        ) : (
          <>
            {/* 🟢 SEKSI KONFIGURASI INTEGRASI XENDIT */}
            <div style={{ ...STYLES.card, marginBottom: 24, border: '2px solid #2563eb' }}>
              <div style={{ ...STYLES.cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, color: '#1e3a8a' }}>
                  💳 Konfigurasi Integrasi Payment Gateway (Xendit)
                </h3>
                <span style={{
                  fontSize: 11.5, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                  background: paymentConfig.is_xendit_active ? '#dcfce7' : '#fef2f2',
                  color: paymentConfig.is_xendit_active ? '#15803d' : '#dc2626'
                }}>
                  {paymentConfig.is_xendit_active ? '🟢 XENDIT AKTIF' : '🔴 XENDIT NONAKTIF'}
                </span>
              </div>

              <form onSubmit={handleSavePaymentConfig} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={STYLES.label}>Status Pembayaran Otomatis Xendit</label>
                    <select
                      value={paymentConfig.is_xendit_active ? 'true' : 'false'}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, is_xendit_active: e.target.value === 'true' })}
                      style={STYLES.input}
                    >
                      <option value="false">Nonaktif (Sistem Manual / Koordinasi Admin)</option>
                      <option value="true">Aktif (Proses Otomatis via Xendit API)</option>
                    </select>
                  </div>

                  <div>
                    <label style={STYLES.label}>Mode Lingkungan (Environment)</label>
                    <select
                      value={paymentConfig.xendit_mode}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, xendit_mode: e.target.value })}
                      style={STYLES.input}
                    >
                      <option value="sandbox">Sandbox (Testing / Development)</option>
                      <option value="live">Live (Production / Transaksi Asli)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={STYLES.label}>Xendit Public API Key</label>
                    <input
                      type="text"
                      placeholder="xnd_public_development_..."
                      value={paymentConfig.xendit_public_key}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, xendit_public_key: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>

                  <div>
                    <label style={STYLES.label}>Xendit Secret API Key</label>
                    <input
                      type="password"
                      placeholder="xnd_development_..."
                      value={paymentConfig.xendit_secret_key}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, xendit_secret_key: e.target.value })}
                      style={STYLES.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={submittingPayment} style={{ ...STYLES.btnSave, background: '#2563eb' }}>
                    {submittingPayment ? 'Menyimpan API Key...' : '🔑 Simpan Pengaturan Xendit'}
                  </button>
                </div>
              </form>
            </div>

            {/* 🟢 SEKSI PENGATURAN PAKET GLOBAL */}
            <form onSubmit={handleSaveAllPlans} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>📦 Pengaturan Kuota &amp; Harga Paket Global</h3>

              {plans.map((plan, idx) => (
                <div key={idx} style={STYLES.card}>
                  <div style={STYLES.cardHeader}>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#1e3a8a' }}>
                      Paket: <strong>{String(plan.plan_key || '').toUpperCase()}</strong> ({plan.label || plan.name})
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={STYLES.label}>Label Tampilan</label>
                      <input 
                        type="text" 
                        value={plan.label || ''} 
                        onChange={(e) => handleInputChange(idx, 'label', e.target.value)}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Harga (Rp)</label>
                      <input 
                        type="number" 
                        value={plan.price || 0} 
                        onChange={(e) => handleInputChange(idx, 'price', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Durasi (Bulan)</label>
                      <input 
                        type="number" 
                        value={plan.duration_months || 0} 
                        onChange={(e) => handleInputChange(idx, 'duration_months', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Max Proyek</label>
                      <input 
                        type="number" 
                        value={plan.max_projects || 0} 
                        onChange={(e) => handleInputChange(idx, 'max_projects', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Max Pakar Manual</label>
                      <input 
                        type="number" 
                        value={plan.max_experts_manual || 0} 
                        onChange={(e) => handleInputChange(idx, 'max_experts_manual', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Max Pakar Direktori</label>
                      <input 
                        type="number" 
                        value={plan.max_experts_directory || 0} 
                        onChange={(e) => handleInputChange(idx, 'max_experts_directory', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>

                    <div>
                      <label style={STYLES.label}>Max Konsultasi/Pakar</label>
                      <input 
                        type="number" 
                        value={plan.max_consultation_per_expert || 0} 
                        onChange={(e) => handleInputChange(idx, 'max_consultation_per_expert', Number(e.target.value))}
                        style={STYLES.input} 
                      />
                    </div>
                  </div>

                  {/* 🟢 TOGGLE Izin Fitur */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={Boolean(plan.allow_subcriteria)}
                        onChange={(e) => handleInputChange(idx, 'allow_subcriteria', e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      Akses Subkriteria
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={Boolean(plan.allow_alternative_method)}
                        onChange={(e) => handleInputChange(idx, 'allow_alternative_method', e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      Bobot Alternatif
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={Boolean(plan.allow_ai_features)}
                        onChange={(e) => handleInputChange(idx, 'allow_ai_features', e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      Fitur AI Analisis
                    </label>
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="submit" disabled={submittingPlans} style={STYLES.btnSave}>
                  {submittingPlans ? 'Menyimpan Perubahan...' : '💾 Simpan Seluruh Perubahan Global'}
                </button>
              </div>
            </form>
          </>
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
  container: { maxWidth: 1000, margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column' },
  card: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(15,23,42,0.02)' },
  cardHeader: { borderBottom: '1px solid #f1f5f9', paddingBottom: 10 },
  label: { fontSize: 11, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4, textTransform: 'uppercase' },
  input: { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' },
  btnSave: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  errorBox: { background: '#fef2f2', color: '#dc2626', padding: 14, borderRadius: 8, border: '1px solid #fca5a5', marginBottom: 16 },
  successBox: { background: '#f0fdf4', color: '#15803d', padding: '12px 16px', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 16, fontWeight: 600 },
  loadingBox: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 }
};