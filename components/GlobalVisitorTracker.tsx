'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function GlobalVisitorTracker() {
  const pathname = usePathname();
  const prevPath = useRef('');

  useEffect(() => {
    if (!pathname || pathname.startsWith('/api') || pathname.startsWith('/_next')) return;
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;

    const email = localStorage.getItem('user_email') || localStorage.getItem('admin_email') || 'Visitor Umum';
    const name = localStorage.getItem('user_name') || localStorage.getItem('admin_name') || 'Visitor Umum';

    fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: pathname, email, name }),
    }).catch(() => null);
  }, [pathname]);

  return null;
}