// components/SafeJoyride.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { CallBackProps, STATUS, Step } from 'react-joyride';
import dynamic from 'next/dynamic';

const Joyride = dynamic(
  () => import('react-joyride').then((mod: any) => mod.default || mod.Joyride),
  { ssr: false }
);

interface SafeJoyrideProps {
  steps: Step[];
  storageKey: string;
  primaryColor?: string;
}

// Helper untuk membaca Cookie
function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : '';
}

// Helper untuk menyimpan Cookie (berlaku selama 1 tahun)
function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

export default function SafeJoyride({ steps, storageKey, primaryColor = '#2563eb' }: SafeJoyrideProps) {
  const [run, setRun] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      // 🟢 Mengecek status dari Cookie (jauh lebih stabil dibanding localStorage)
      const hasSeen = getCookie(storageKey);
      if (!hasSeen) {
        const timer = setTimeout(() => setRun(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Cookie tidak dapat diakses:', e);
    }
  }, [storageKey]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      try {
        // 🟢 Menyimpan status permanen ke Cookie
        setCookie(storageKey, 'true');
      } catch (e) {}
      setRun(false);
    }
  };

  if (!isMounted || typeof window === 'undefined') return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      scrollToFirstStep={true}
      scrollOffset={100}
      disableScrollParentFix={true}
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: primaryColor,
          textColor: '#334155',
          zIndex: 100000,
        },
        buttonClose: { display: 'none' },
        tooltipContainer: { textAlign: 'left' }
      }}
      locale={{
        back: 'Kembali',
        close: 'Tutup',
        last: 'Selesai',
        next: 'Lanjut',
        skip: 'Lewati Tur',
      }}
    />
  );
}