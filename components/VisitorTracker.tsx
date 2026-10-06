// components/VisitorTracker.tsx
'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

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

    // Ambil identitas pengguna/admin yang tersimpan di localStorage
    let email = 'Visitor Umum';
    let name = 'Visitor Umum';

    try {
      const adminEmail = localStorage.getItem('admin_email');
      const adminName = localStorage.getItem('admin_name');
      const userEmail = localStorage.getItem('user_email');
      const userName = localStorage.getItem('user_name');

      if (adminEmail) {
        email = adminEmail;
        name = adminName || 'Admin Operator';
      } else if (userEmail) {
        email = userEmail;
        name = userName || 'User Terdaftar';
      }
    } catch {}

    const token = searchParams ? searchParams.get('token') || '' : '';

    // Kirim pencatatan kunjungan ke backend
    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: pathname,
        email,
        name,
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