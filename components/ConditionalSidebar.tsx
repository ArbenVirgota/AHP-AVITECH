// components/ConditionalSidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function ConditionalSidebar() {
  const pathname = usePathname();

  // Meniadakan render sidebar pada semua halaman expert, admin, verify, login, dan register
  const isExcluded =
    pathname?.startsWith('/expert') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/verify') ||
    pathname === '/login' ||
    pathname === '/register';

  if (isExcluded) {
    return null; // Komponen dan tombol sidebar benar-benar tidak dirender ke DOM
  }

  return <Sidebar defaultCollapsed={true} />;
}