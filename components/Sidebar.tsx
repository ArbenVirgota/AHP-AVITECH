// components/Sidebar.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

interface UserProfileData {
  nama: string;
  institusi: string;
  city: string;
  digital_signature: string;
  foto_profil?: string;
  whatsapp?: string;
  status_user?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Default ter-minimize (true) atau membaca pilihan terakhir di localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    }
    return true;
  });

  const [isMounted, setIsMounted] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // State Pengguna & Langganan
  const [user, setUser] = useState<UserSession | null>(null);
  const [isStudent, setIsStudent] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    nama: '',
    institusi: '',
    city: '',
    digital_signature: '',
    foto_profil: '',
    whatsapp: '',
    status_user: '',
  });
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [projectsCount, setProjectsCount] = useState<number>(0);

  // 🟢 State Tiket Konsultasi Belum Terbaca
  const [unreadConsultations, setUnreadConsultations] = useState<number>(0);

  // State Modal Profil Lokal
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', JSON.stringify(nextState));
    }
  };

  // Tarik Data Pengguna & Status Role dari MySQL
  const fetchUserData = useCallback(async () => {
    const s = getSession();
    if (!s || !s.email) return;

    setUser(s);
    const cleanEmail = String(s.email).trim().toLowerCase();

    // Deteksi awal dari sesi lokal
    if ((s as any)?.status_user?.toLowerCase() === 'student') {
      setIsStudent(true);
    }

    const sessionPhoto = String((s as any).foto_profil || (s as any).fotoprofil || (s as any).foto || (s as any).avatar || '');
    if (sessionPhoto) {
      setUserProfile((prev) => ({ ...prev, foto_profil: sessionPhoto }));
    }

    try {
      const [superRes, projRes, summaryRes, unreadRes] = await Promise.all([
        fetch(`/api/admin/super-control?_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/projects?email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/dashboard/summary?email=${encodeURIComponent(cleanEmail)}&user_id=${encodeURIComponent(s.id || '')}&_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/user/unread-consultations?email=${encodeURIComponent(cleanEmail)}&_t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
      ]);

      if (summaryRes) {
        const sumJson = await summaryRes.json().catch(() => ({}));
        if (sumJson && sumJson.success && sumJson.data) {
          const u = sumJson.data.user || {};
          const p = sumJson.data.profile || {};
          
          const isStudentRole = 
            sumJson.data.isStudent || 
            u.status_user?.toLowerCase() === 'student' || 
            (s as any)?.status_user?.toLowerCase() === 'student';
          
          setIsStudent(Boolean(isStudentRole));

          const mysqlPhoto = String(u.foto_profil || u.fotoprofil || u.foto || u.avatar || p.foto_profil || p.avatar || sessionPhoto || '');
          const mysqlNama = String(u.nama || p.nama || s.nama || s.email || 'Pengguna');
          const mysqlInstitusi = String(u.asal_instansi || u.institusi || p.asal_instansi || p.lembaga || (isStudentRole ? 'Universitas / Akademik' : 'Instansi Belum Diatur'));
          const mysqlCity = String(u.city || p.city || '');
          const mysqlSig = String(u.digital_signature || u.tanda_tangan || p.digital_signature || p.tanda_tangan || '');
          const mysqlWa = String(u.whatsapp || p.whatsapp || '');

          setUserProfile({
            nama: mysqlNama,
            institusi: mysqlInstitusi,
            city: mysqlCity,
            digital_signature: mysqlSig,
            foto_profil: mysqlPhoto,
            whatsapp: mysqlWa,
            status_user: u.status_user || '',
          });
          setAvatarError(false);
        }
      }

      if (superRes) {
        const superJson = await superRes.json().catch(() => ({}));
        if (superJson && superJson.success && superJson.data) {
          const subsList: any[] = superJson.data.subscriptions || [];
          const matched = subsList.find((sub: any) => {
            const m = String(sub.user_email || sub.email || '').trim().toLowerCase();
            return m === cleanEmail;
          });

          if (matched && matched.plan) {
            const p = String(matched.plan).toUpperCase();
            setUserPlan(p);
            localStorage.setItem('user_plan', p);
          }
        }
      }

      if (projRes) {
        const projJson = await projRes.json().catch(() => ({}));
        if (projJson && projJson.success && Array.isArray(projJson.data)) {
          setProjectsCount(projJson.data.length);
        }
      }

      if (unreadRes) {
        const unreadJson = await unreadRes.json().catch(() => ({}));
        if (unreadJson && unreadJson.success && typeof unreadJson.unreadCount === 'number') {
          setUnreadConsultations(unreadJson.unreadCount);
        }
      }
    } catch (err) {
      console.error('Gagal sinkronisasi data sidebar:', err);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    fetchUserData();

    // Polling penanda notifikasi konsultasi setiap 30 detik
    const timer = setInterval(() => {
      const s = getSession();
      if (!s?.email) return;
      fetch(`/api/user/unread-consultations?email=${encodeURIComponent(String(s.email).trim().toLowerCase())}&_t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          if (j?.success && typeof j.unreadCount === 'number') {
            setUnreadConsultations(j.unreadCount);
          }
        })
        .catch(() => null);
    }, 30000);

    return () => clearInterval(timer);
  }, [fetchUserData]);

  if (!isMounted) return null;

  const session = getSession();
  const isLoggedIn = Boolean(session && session.email);

  const publicPaths = ['/', '/login', '/register', '/expert-directory', '/products', '/faq', '/about'];
  const isPublicRoute = publicPaths.includes(pathname) || pathname.startsWith('/expert');

  if (isPublicRoute && !isLoggedIn) {
    return null;
  }

  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/admin')
  ) {
    return null;
  }

  const handleLogout = () => {
    clearSession();
    localStorage.clear();
    router.replace('/login');
  };

  // 🟢 Aksi Tombol Upgrade: Buka Modal Paket Komersial di Dashboard Langsung
  const handleOpenUpgrade = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-upgrade-modal'));
    }
    if (pathname !== '/dashboard') {
      router.push('/dashboard?action=upgrade');
    }
  };

  const isStudentRole = isStudent || (user as any)?.status_user?.toLowerCase() === 'student' || (session as any)?.status_user?.toLowerCase() === 'student';

  const planBadgeColor = isStudentRole ? '#d97706' :
    userPlan === 'PREMIUM' ? '#9333ea' :
    userPlan === 'PLUS' ? '#2563eb' :
    userPlan === 'PRO' ? '#16a34a' : '#64748b';

  // Navigasi: Sembunyikan 'Pusat Konsultasi' dan 'Direktori Pakar' untuk akun Student Edition
  const navItems = [
    {
      label: isStudentRole ? 'Student Edition' : `Plan: ${userPlan}`,
      icon: '⭐',
      badgeColor: planBadgeColor,
      isPlan: true,
      onClick: handleOpenUpgrade,
    },
    {
      label: 'Dashboard Utama',
      icon: '📊',
      path: '/dashboard',
      active: pathname === '/dashboard',
    },
    {
      label: 'Proyek AHP Saya',
      icon: '📁',
      path: '/user/projects',
      active: pathname === '/user/projects' || pathname.startsWith('/buat-proyek') || pathname.startsWith('/proyek'),
      badge: projectsCount > 0 ? String(projectsCount) : undefined,
      badgeColor: '#2563eb',
    },
    ...(!isStudentRole ? [{
      label: 'Pusat Konsultasi',
      icon: '💬',
      path: '/user/consultations',
      active: pathname === '/user/consultations',
      badge: unreadConsultations > 0 ? String(unreadConsultations > 99 ? '99+' : unreadConsultations) : undefined,
      badgeColor: '#ef4444',
    }] : []),
    ...(!isStudentRole ? [{
      label: 'Direktori Pakar',
      icon: '👥',
      path: '/expert-directory',
      active: pathname === '/expert-directory',
    }] : []),
    {
      label: 'Profil & Pengesahan',
      icon: '⚙️',
      isAction: true,
      onClick: () => setShowProfileModal(true),
    },
    {
      label: 'Panduan Sistem',
      icon: '📖',
      path: '/panduan',
      active: pathname === '/panduan',
    },
  ];

  return (
    <>
      {/* TOMBOL TOGGLE MOBILE */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        style={STYLES.mobileMenuBtn}
        aria-label="Buka Menu"
        className="mobile-btn"
      >
        ☰ Menu
      </button>

      {/* OVERLAY MOBILE */}
      {isMobileOpen && (
        <div style={STYLES.overlay} onClick={() => setIsMobileOpen(false)} />
      )}

      {/* TOMBOL TOGGLE DESKTOP */}
      <button
        type="button"
        onClick={handleToggleCollapse}
        style={{
          ...STYLES.desktopToggleBtn,
          left: isCollapsed ? 64 : 246,
        }}
        title={isCollapsed ? 'Buka Sidebar' : 'Sembunyikan Sidebar'}
      >
        <span style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>◀</span>
      </button>

      {/* CONTAINER ASIDE */}
      <aside
        style={{
          ...STYLES.sidebar,
          width: isCollapsed ? 76 : 260,
          left: isMobileOpen ? 0 : (isCollapsed ? '-260px' : '0'),
        }}
      >
        {/* HEADER BRAND */}
        <div style={STYLES.sidebarHeader}>
          <div style={STYLES.logoBox}>AHP</div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={STYLES.brandName}>AHP Avitech</span>
              <span style={STYLES.brandSub}>
                {isStudentRole ? '🎓 Student Edition' : 'DSS Platform'}
              </span>
            </div>
          )}
        </div>

        {/* KARTU PENGGUNA */}
        <div
          style={{
            ...STYLES.userCard,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: isCollapsed ? '10px 4px' : '10px 12px',
          }}
        >
          <div style={STYLES.userAvatar}>
            {userProfile.foto_profil && !avatarError ? (
              <img
                src={userProfile.foto_profil}
                alt="Foto Profil"
                style={STYLES.userAvatarImg}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>
                {(userProfile.nama || user?.nama || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <div style={STYLES.userInfo}>
              <div style={STYLES.userName} title={userProfile.nama || user?.nama || 'Pengguna'}>
                {userProfile.nama || user?.nama || 'Pengguna'}
              </div>
              <div style={STYLES.userInstansi} title={userProfile.institusi || ''}>
                {isStudentRole ? '🎓 Student Edition' : (userProfile.institusi || 'Instansi Belum Diatur')}
              </div>
              <div style={STYLES.userEmail} title={user?.email || ''}>
                {user?.email || 'user@ahp.com'}
              </div>
            </div>
          )}
        </div>

        {/* DAFTAR MENU NAVIGASI */}
        <nav style={STYLES.nav}>
          {navItems.map((item, idx) => {
            if (item.isPlan) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={item.onClick}
                  style={{
                    ...STYLES.navItemBtn,
                    background: '#1e293b',
                    border: '1px solid #334155',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                  }}
                  title={item.label}
                >
                  <span style={STYLES.navIcon}>{item.icon}</span>
                  {!isCollapsed && <span style={{ ...STYLES.navText, fontWeight: 700, color: '#f8fafc' }}>{item.label}</span>}
                  {!isCollapsed && (
                    <span
                      style={{
                        fontSize: 9.5,
                        background: planBadgeColor,
                        color: '#fff',
                        padding: '1px 5px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginLeft: 'auto',
                      }}
                    >
                      UPGRADE
                    </span>
                  )}
                </button>
              );
            }

            if (item.isAction) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    item.onClick?.();
                  }}
                  style={{
                    ...STYLES.navItemBtn,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                  }}
                  title={item.label}
                >
                  <span style={STYLES.navIcon}>{item.icon}</span>
                  {!isCollapsed && <span style={STYLES.navText}>{item.label}</span>}
                </button>
              );
            }

            return (
              <NextLink
                key={idx}
                href={item.path || '#'}
                onClick={() => setIsMobileOpen(false)}
                title={item.label}
                style={{
                  ...STYLES.navItem,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  ...(item.active ? STYLES.navItemActive : {}),
                }}
              >
                <span style={STYLES.navIcon}>{item.icon}</span>
                {!isCollapsed && <span style={STYLES.navText}>{item.label}</span>}
                {item.badge && (
                  <span
                    style={{
                      ...STYLES.badgeWarn,
                      background: item.badgeColor || '#2563eb',
                      marginLeft: isCollapsed ? '0' : 'auto',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NextLink>
            );
          })}
        </nav>

        {/* FOOTER LOGOUT */}
        <div style={STYLES.sidebarFooter}>
          <button
            type="button"
            onClick={handleLogout}
            style={STYLES.btnLogout}
            title={isCollapsed ? 'Keluar (Logout)' : undefined}
          >
            {isCollapsed ? '🚪' : '🚪 Logout Akun'}
          </button>
        </div>
      </aside>

      {/* MODAL PROFIL & PENGESAHAN */}
      {showProfileModal && (
        <div style={MODAL_STYLES.overlay} onClick={() => setShowProfileModal(false)}>
          <div style={MODAL_STYLES.modal} onClick={(e) => e.stopPropagation()}>
            <div style={MODAL_STYLES.header}>
              <h2 style={MODAL_STYLES.title}>⚙️ Profil &amp; Pengesahan Pengguna</h2>
              <button onClick={() => setShowProfileModal(false)} style={MODAL_STYLES.closeBtn} type="button">✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <div style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', border: '2px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                  {userProfile.foto_profil && !avatarError ? (
                    <img src={userProfile.foto_profil} alt="Foto Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 700, color: '#64748b' }}>
                      {(userProfile.nama || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>NAMA LENGKAP &amp; GELAR</label>
                <input
                  type="text"
                  value={userProfile.nama}
                  readOnly
                  style={{ ...MODAL_STYLES.input, background: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>EMAIL LOGIN</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  style={{ ...MODAL_STYLES.input, background: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>INSTANSI / PERAN</label>
                <input
                  type="text"
                  value={isStudentRole ? 'Student Edition' : (userProfile.institusi || 'Belum diatur')}
                  readOnly
                  style={{ ...MODAL_STYLES.input, background: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>KOTA</label>
                  <input
                    type="text"
                    value={userProfile.city || '-'}
                    readOnly
                    style={{ ...MODAL_STYLES.input, background: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>WHATSAPP</label>
                  <input
                    type="text"
                    value={userProfile.whatsapp || '-'}
                    readOnly
                    style={{ ...MODAL_STYLES.input, background: '#f8fafc' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4 }}>TANDA TANGAN DIGITAL</label>
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 8, textAlign: 'center', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {userProfile.digital_signature ? (
                    <img src={userProfile.digital_signature} alt="Tanda Tangan" style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                      {isStudentRole ? 'Opsional untuk Student Edition' : 'Tanda tangan digital belum diunggah'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setShowProfileModal(false)} style={MODAL_STYLES.btnClose} type="button">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MEDIA QUERIES CSS */}
      <style>{`
        @media (min-width: 768px) {
          aside {
            left: ${isPublicRoute && !isLoggedIn ? '-260px' : '0'} !important;
          }
          body {
            padding-left: ${isPublicRoute && !isLoggedIn ? '0px' : (isCollapsed ? '76px' : '260px')} !important;
            transition: padding-left 0.25s ease-in-out;
          }
          .mobile-btn {
            display: ${isPublicRoute && !isLoggedIn ? 'none' : 'flex'} !important;
          }
          button[title="Buka Sidebar"], button[title="Sembunyikan Sidebar"] {
            display: ${isPublicRoute && !isLoggedIn ? 'none' : 'flex'} !important;
          }
        }
      `}</style>
    </>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    background: '#0f172a',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    transition: 'width 0.25s ease-in-out, left 0.25s ease-in-out',
    boxShadow: '4px 0 15px rgba(0,0,0,0.1)',
    overflowX: 'hidden',
    height: '100vh',
    borderRight: '1px solid #1e293b',
    boxSizing: 'border-box',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 14px',
    borderBottom: '1px solid #1e293b',
    minHeight: 64,
    boxSizing: 'border-box',
  },
  logoBox: {
    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
    color: 'white',
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 13,
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
  },
  brandName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#ffffff',
    whiteSpace: 'nowrap',
  },
  brandSub: {
    fontSize: 10,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  userCard: {
    margin: '10px 8px',
    background: '#1e293b',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    overflow: 'hidden',
    border: '1.5px solid #38bdf8',
  },
  userAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  userInfo: {
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userInstansi: {
    fontSize: 10,
    fontWeight: 600,
    color: '#38bdf8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: 9,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '0 8px',
    flexGrow: 1,
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    color: '#cbd5e1',
    textDecoration: 'none',
    fontSize: 12.5,
    fontWeight: 600,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  navItemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    color: '#cbd5e1',
    background: 'transparent',
    border: 'none',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    width: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  },
  navItemActive: {
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  navIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  navText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeWarn: {
    color: 'white',
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  sidebarFooter: {
    borderTop: '1px solid #1e293b',
    padding: '12px 10px',
  },
  btnLogout: {
    width: '100%',
    padding: '8px 10px',
    background: '#1e293b',
    color: '#f87171',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  mobileMenuBtn: {
    position: 'fixed',
    top: 14,
    left: 14,
    zIndex: 40,
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  desktopToggleBtn: {
    position: 'fixed',
    top: 20,
    zIndex: 51,
    background: '#1e293b',
    color: '#38bdf8',
    border: '1px solid #334155',
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'left 0.25s ease-in-out',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 45,
    backdropFilter: 'blur(2px)',
  },
};

const MODAL_STYLES: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 16,
  },
  modal: {
    background: 'white',
    borderRadius: 14,
    padding: '24px 28px',
    maxWidth: 440,
    width: '100%',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#94a3b8',
  },
  desc: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    marginTop: 4,
  },
  btnClose: {
    width: '100%',
    padding: 10,
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
  },
};