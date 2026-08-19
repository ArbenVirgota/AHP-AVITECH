// components/VisitorTracker.tsx atau app/VisitorTracker.tsx
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
                process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || '';

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string>('');

  useEffect(() => {
    const rawPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');

    // Mencegah pencatatan berulang jika rute belum berubah
    if (lastLoggedPath.current === rawPath) return;
    lastLoggedPath.current = rawPath;

    const logVisitor = async () => {
      if (!API_URL) return;

      try {
        // 1. Identifikasi Email (User Login vs Tamu Publik)
        const session = getSession();
        const userEmail = (session && typeof session === 'object' && (session.email as string)) || 'Visitor Umum';

        // 2. Ambil IP Publik Pengunjung (dengan timeout 3 detik agar tidak menghambat UX)
        let visitorIp = 'Unknown';
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
          clearTimeout(timeoutId);
          
          const ipJson = await ipRes.json();
          visitorIp = ipJson.ip || 'Unknown';
        } catch {
          visitorIp = 'Unavailable'; // Jika diblokir oleh ekstensi ad-blocker pengguna
        }

        // 3. Kirim Log ke Google Apps Script (Sertakan ?action= pada URL)
        await fetch(`${API_URL}?action=recordvisitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'recordvisitor',
            email: userEmail,
            ip: visitorIp,
            ip_address: visitorIp,
            page: rawPath,
            timestamp: new Date().toISOString()
          }),
          redirect: 'follow'
        });
      } catch (err) {
        console.warn("Pencatatan log kunjungan dilewati:", err);
      }
    };

    logVisitor();
  }, [pathname]);

  return null;
}