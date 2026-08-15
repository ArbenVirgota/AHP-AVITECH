'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// 🟢 DISESUAIKAN: Menggunakan variabel lingkungan terbaru
const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 🟢 State Toggle Tampilkan/Sembunyikan Password
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Semua kolom wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      if (!GOOGLESCRIPTURL) {
        throw new Error('URL Web App Google Apps Script belum dikonfigurasi di .env.local');
      }

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminlogin', // Action ke handleAdminLogin_
          email: email.trim().toLowerCase(),
          password: password
        })
      });

      const textRes = await res.text();
      let json;
      try {
        json = JSON.parse(textRes);
      } catch {
        throw new Error(`Respons server tidak valid: ${textRes}`);
      }

      if (json && json.success && (json.data || json.user || json.admin)) {
        const adminData = json.data || json.admin || json.user || {};

        // Simpan sesi admin di localStorage
        localStorage.setItem('admin_token', adminData.token || 'active_token');
        localStorage.setItem('admin_role', adminData.role || 'SuperAdmin'); 
        localStorage.setItem('admin_name', adminData.name || adminData.nama || email);

        // 🟢 NOTIFIKASI KEAMANAN: Kirim email alert ke admin@avitech.cloud
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'admin@avitech.cloud',
              to: 'admin@avitech.cloud',
              subject: '🔒 Peringatan Keamanan: Log Masuk Panel Admin Detected',
              textBody: `Halo Admin, akun (${email.trim()}) baru saja berhasil masuk ke Panel Otoritas Admin.`,
              htmlBody: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                  <h2>Notifikasi Keamanan Admin 🔐</h2>
                  <p>Sistem mendeteksi aktivitas masuk baru ke <strong>Panel Otoritas Admin AHP Avitech</strong>.</p>
                  <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 12px 0;">
                    <p style="margin: 4px 0;"><strong>Role:</strong> ${adminData.role || 'SuperAdmin'}</p>
                    <p style="margin: 4px 0;"><strong>Email Login:</strong> ${email.trim()}</p>
                    <p style="margin: 4px 0;"><strong>Waktu Akses:</strong> ${new Date().toLocaleString('id-ID')}</p>
                  </div>
                  <p style="color: #64748b; font-size: 12.5px;">Jika ini bukan Anda, segera amankan kata sandi dan periksa kredensial akun Anda.</p>
                  <br/>
                  <p>Salam hangat,<br/><strong>Tim Admin AHP Avitech</strong></p>
                </div>
              `
            })
          });
        } catch (emailErr) {
          console.error('Gagal mengirim email alert admin:', emailErr);
        }

        router.push('/admin/dashboard');
      } else {
        setErrorMsg(json?.message || 'Gagal masuk sebagai admin. Periksa kembali email dan kata sandi Anda.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan koneksi ke server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.card}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={STYLES.title}>Panel Otoritas Admin</h1>
          <p style={STYLES.subtitle}>Masuk untuk mengelola data sistem di balik layar</p>
        </div>

        {errorMsg && (
          <div style={STYLES.errorBox}>
            <p style={{ margin: 0, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>⚠️ {errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleLogin} style={STYLES.form}>
          <div style={STYLES.inputGroup}>
            <label style={STYLES.label}>Email Admin:</label>
            <input 
              type="email" 
              placeholder="admin@avitech.cloud" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={STYLES.input}
              required
            />
          </div>

          <div style={STYLES.inputGroup}>
            <label style={STYLES.label}>Kata Sandi (Password):</label>
            {/* 🟢 INPUT KATA SANDI DENGAN TOMBOL TOGGLE SHOW/HIDE */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...STYLES.input, width: '100%', paddingRight: 42 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={STYLES.btnTogglePassword}
                title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={STYLES.btnLogin}>
            {loading ? 'Memverifikasi Akses...' : 'Masuk Panel Admin →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" onClick={() => router.push('/')} style={STYLES.btnBack}>
            ← Kembali ke Beranda Utama
          </button>
        </div>
      </div>
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { background: '#0f172a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"Inter", "Segoe UI", sans-serif' },
  card: { background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  subtitle: { margin: '6px 0 0', fontSize: 13.5, color: '#64748b' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#334155' },
  input: { padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', color: '#0f172a', boxSizing: 'border-box' },
  btnTogglePassword: { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnLogin: { background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'center', marginTop: 4 },
  btnBack: { background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
};