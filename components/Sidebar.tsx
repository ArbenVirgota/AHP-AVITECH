// components/Sidebar.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation'; // Jika menggunakan Next.js standar, Link dari 'next/link'
import { usePathname } from 'next/navigation';
import NextLink from 'next/link';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const menuItems = [
    { name: 'Dashboard Ruang Kerja', path: '/dashboard', icon: '📊' },
    { name: 'Direktori Pakar', path: '/expert-directory', icon: '📂' },
    { name: 'Panduan & Edukasi AHP', path: '/panduan', icon: '📖' },
  ];

  const bottomMenuItems = [
    { name: 'Pengaturan Profil', path: '/dashboard?action=profile', icon: '⚙️' },
    { name: 'Keluar (Logout)', path: '/login', icon: '🚪' },
  ];

  if (!isMounted) return null;

  // 🟢 1. SEMBUNYIKAN SIDEBAR DI LANDING PAGE (/) SERTA HALAMAN LOGIN, REGISTER, & ADMIN
  if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* TOMBOL HAMBURGER (MOBILE) */}
      <button 
        onClick={() => setIsMobileOpen(true)} 
        style={STYLES.mobileMenuBtn}
        aria-label="Buka Menu"
      >
        ☰ Menu
      </button>

      {/* OVERLAY MOBILE */}
      {isMobileOpen && (
        <div 
          style={STYLES.overlay} 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* TOMBOL TOGGLE (DESKTOP) */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          ...STYLES.desktopToggleBtn,
          left: isCollapsed ? 16 : 244,
        }}
        title={isCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>

      {/* SIDEBAR CONTAINER */}
      <aside style={{
        ...STYLES.sidebar,
        width: isCollapsed ? 76 : 260,
        left: isMobileOpen ? 0 : (isCollapsed ? '-260px' : '0'),
      }}>
        <div style={STYLES.sidebarHeader}>
          <div style={STYLES.logoBox}>AHP</div>
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={STYLES.brandName}>AHP Platform</span>
              <span style={STYLES.brandSub}>Decision Support</span>
            </div>
          )}
          
          {/* 🟢 2. TOMBOL 'X' DIHAPUS SESUAI PERMINTAAN */}
        </div>

        <div style={STYLES.menuContainer}>
          {!isCollapsed && <div style={STYLES.menuGroupTitle}>Menu Utama</div>}
          <nav style={STYLES.nav}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <NextLink 
                  key={item.path} 
                  href={item.path} 
                  onClick={() => setIsMobileOpen(false)}
                  title={item.name}
                  style={isActive ? { ...STYLES.navItem, ...STYLES.navItemActive } : STYLES.navItem}
                >
                  <span style={STYLES.navIcon}>{item.icon}</span>
                  {!isCollapsed && <span style={STYLES.navText}>{item.name}</span>}
                </NextLink>
              );
            })}
          </nav>
        </div>

        <div style={{ ...STYLES.menuContainer, marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: 16 }}>
          <nav style={STYLES.nav}>
            {bottomMenuItems.map((item) => (
              <NextLink 
                key={item.name} 
                href={item.path}
                onClick={() => {
                  if (item.name.includes('Keluar')) {
                    localStorage.clear();
                  }
                  setIsMobileOpen(false);
                }}
                title={item.name}
                style={{ ...STYLES.navItem, color: item.name.includes('Keluar') ? '#fca5a5' : '#94a3b8' }}
              >
                <span style={STYLES.navIcon}>{item.icon}</span>
                {!isCollapsed && <span style={STYLES.navText}>{item.name}</span>}
              </NextLink>
            ))}
          </nav>
        </div>
      </aside>

      <style>{`
        @media (min-width: 768px) {
          aside {
            left: 0 !important;
          }
          body {
            padding-left: ${isCollapsed ? '76px' : '260px'} !important;
            transition: padding-left 0.3s ease-in-out;
          }
          .mobile-btn {
            display: none !important;
          }
          button[title="Buka Sidebar"], button[title="Sembunyikan Sidebar"] {
            display: flex !important;
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
    transition: 'width 0.3s ease-in-out, left 0.3s ease-in-out',
    boxShadow: '4px 0 15px rgba(0,0,0,0.1)',
    overflowX: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '24px 16px',
    borderBottom: '1px solid #1e293b',
    minHeight: 38,
  },
  logoBox: {
    background: '#2563eb',
    color: 'white',
    width: 38,
    height: 38,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: 1,
    flexShrink: 0,
  },
  brandName: {
    fontSize: 15,
    fontWeight: 800,
    color: '#ffffff',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  brandSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  menuContainer: {
    padding: '20px 12px',
  },
  menuGroupTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 8,
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: 600,
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  navItemActive: {
    background: '#1e293b',
    color: '#38bdf8',
    fontWeight: 700,
  },
  navIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  navText: {
    whiteSpace: 'nowrap',
  },
  mobileMenuBtn: {
    position: 'fixed',
    top: 16,
    left: 16,
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
    top: 24,
    zIndex: 51,
    background: '#1e293b',
    color: '#38bdf8',
    border: '1px solid #334155',
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'left 0.3s ease-in-out',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 45,
    backdropFilter: 'blur(2px)',
  },
};