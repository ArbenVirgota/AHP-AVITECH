// components/SafeJoyride.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { CallBackProps, STATUS, Step } from 'react-joyride';
import dynamic from 'next/dynamic';

// 🟢 Import Dinamis Standar untuk Next.js
const Joyride = dynamic(
  () => import('react-joyride').then((mod: any) => mod.default || mod.Joyride),
  { ssr: false }
);

interface SafeJoyrideProps {
  steps: Step[];
  storageKey: string;
  primaryColor?: string;
}

export default function SafeJoyride({ steps, storageKey, primaryColor = '#2563eb' }: SafeJoyrideProps) {
  const [run, setRun] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const hasSeen = localStorage.getItem(storageKey);
    if (!hasSeen) {
      setTimeout(() => setRun(true), 1000);
    }
  }, [storageKey]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem(storageKey, 'true');
      setRun(false);
    }
  };

  if (!isMounted) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      
      // 🟢 PENGATURAN STANDAR YANG BERSIH DAN AMAN
      disableScroll={false}          // Biarkan Joyride mengatur scroll secara otomatis
      scrollToFirstStep={true}
      scrollOffset={100}             // Jarak aman standar
      disableScrollParentFix={true}  // Melindungi dari cacat layout flex/grid
      
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