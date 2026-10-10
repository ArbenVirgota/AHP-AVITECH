// components/VisitorTracker.tsx
'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/auth';

function VisitorTrackerCore() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevTrackedUrl = useRef<string>('');

  useEffect(() => {
    if (!pathname) return;

    // Abaikan rute internal Next.js, API, dan aset file
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
      return;
    }

    const currentFullUrl = `${pathname}${searchParams ? `?${searchParams.toString()}` : ''}`;
    if (prevTrackedUrl.current === currentFullUrl) return;
    prevTrackedUrl.current = currentFullUrl;

    let email = 'Visitor Umum';
    let name = 'Visitor Umum';
    let role = 'guest';

    try {
      // 1. Cek sesi utama via auth helper (SSOT)
      const session = typeof getSession === 'function' ? getSession() : null;
      if (session && session.email) {
        email = String(session.email).trim();
        name = String(session.nama || session.name || email.split('@')[0]).trim();
        role = String(session.status_user || session.role || 'user').trim();
      } else if (typeof window !== 'undefined') {
        // 2. Cek penyimpanan sesi admin
        const adminEmail = localStorage.getItem('admin_email');
        const adminName = localStorage.getItem('admin_name');

        // 3. Cek penyimpanan sesi user (berbagai variasi key lokal)
        const userEmail = 
          localStorage.getItem('user_email') || 
          localStorage.getItem('email');
        const userName = 
          localStorage.getItem('user_name') || 
          localStorage.getItem('nama');

        if (adminEmail && adminEmail !== 'Visitor Umum') {
          email = adminEmail;
          name = adminName || 'Admin Operator';
          role = 'admin';
        } else if (userEmail && userEmail !== 'Visitor Umum') {
          email = userEmail;
          name = userName || userEmail.split('@')[0];
          role = 'user';
        } else {
          // 4. Cadangan ekstra: periksa session object di localStorage
          const savedSessionRaw = localStorage.getItem('user_session') || localStorage.getItem('ahp_user_data');
          if (savedSessionRaw) {
            try {
              const parsed = JSON.parse(savedSessionRaw);
              if (parsed?.email && parsed.email !== 'Visitor Umum') {
                email = parsed.email;
                name = parsed.nama || parsed.name || parsed.email.split('@')[0];
                role = parsed.status_user || parsed.role || 'user';
              }
            } catch {}
          }
        }
      }
    } catch {}

    const token = searchParams ? searchParams.get('token') || '' : '';

    // Kirim pencatatan kunjungan ke backend
    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: pathname,
        path: pathname,
        email,
        name,
        role,
        token,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}

export default function VisitorTracker() {
  return (
    <Suspense fallback={null}>
      <VisitorTrackerCore />
    </Suspense>
  );
}