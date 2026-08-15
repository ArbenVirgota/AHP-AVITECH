'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string>('');

  useEffect(() => {
    // 🟢 Ambil rute URL asli dari browser, jangan pernah gunakan string 'Dashboard / Public'
    const rawPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');

    // Mencegah pencatatan berulang jika rute belum benar-benar berubah
    if (lastLoggedPath.current === rawPath) return;
    lastLoggedPath.current = rawPath;

    const logVisitor = async () => {
      try {
        const session = getSession();
        const userEmail = (session && typeof session === 'object' && (session.email as string)) || 'Visitor Umum';
        
        console.log("🟢 Mengirim log rute ke Apps Script:", rawPath); // Untuk verifikasi di console browser

        await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'recordvisitor',
            email: userEmail,
            page: rawPath // 🟢 Mengirim rute aktual murni (contoh: '/', '/expert-directory', '/products', '/dashboard')
          }),
          redirect: 'follow'
        });
      } catch (err) {
        console.error("Gagal mencatat log kunjungan:", err);
      }
    };

    logVisitor();
  }, [pathname]);

  return null;
}