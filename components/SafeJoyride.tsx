// components/SafeJoyride.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Joyride } from 'react-joyride';
import type { Step, CallBackProps, TooltipRenderProps } from 'react-joyride';

interface SafeJoyrideProps {
  steps: Step[];
  storageKey?: string;
}

export default function SafeJoyride({ steps, storageKey = 'ahp_tour_default' }: SafeJoyrideProps) {
  const [runTour, setRunTour] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const isGlobalDisabled = localStorage.getItem('ahp_disable_all_tours') === 'true';
    const isTourSkipped = localStorage.getItem(`tour_skipped_${storageKey}`) === 'true';
    const hasFinished = localStorage.getItem(`tour_finished_${storageKey}`) === 'true';

    // Jika belum di-skip atau di-finish secara permanen, jalankan otomatis di awal
    if (!isGlobalDisabled && !isTourSkipped && !hasFinished) {
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  useEffect(() => {
    // 🟢 Mendengarkan event klik tombol Panduan Interaktif dari seluruh halaman
    const handleStartTour = (e: Event) => {
      const customEvent = e as CustomEvent;
      // Hapus status skip/finish sementara agar tur bisa diputar ulang saat tombol diklik
      localStorage.removeItem(`tour_skipped_${storageKey}`);
      localStorage.removeItem(`tour_finished_${storageKey}`);
      localStorage.removeItem('ahp_disable_all_tours');

      if (!customEvent.detail || customEvent.detail === storageKey) {
        setRunTour(false);
        setTimeout(() => {
          setRunTour(true);
        }, 100);
      }
    };

    const eventName = `start-tour-${storageKey}`;
    window.addEventListener(eventName, handleStartTour as EventListener);
    window.addEventListener('start-tour-global', handleStartTour as EventListener);

    return () => {
      window.removeEventListener(eventName, handleStartTour as EventListener);
      window.removeEventListener('start-tour-global', handleStartTour as EventListener);
    };
  }, [storageKey]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action } = data;
    if (status === 'skipped' || action === 'skip' || action === 'close') {
      setRunTour(false);
      localStorage.setItem(`tour_skipped_${storageKey}`, 'true');
    } else if (status === 'finished') {
      setRunTour(false);
      localStorage.setItem(`tour_finished_${storageKey}`, 'true');
    }
  };

  const handleSkipPermanently = () => {
    setRunTour(false);
    localStorage.setItem(`tour_skipped_${storageKey}`, 'true');
    localStorage.setItem('ahp_disable_all_tours', 'true');
  };

  const CustomTooltip = ({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    isLastStep,
  }: TooltipRenderProps) => (
    <div
      {...tooltipProps}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        color: '#0f172a',
        maxWidth: 380,
        padding: '20px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        fontFamily: '"Inter", sans-serif',
        border: '1px solid #e2e8f0',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
          {step.title}
        </h3>
        <button
          {...closeProps}
          onClick={handleSkipPermanently}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 16,
            fontWeight: 800,
            padding: 4,
          }}
          title="Tutup panduan"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
        {step.content}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        <button
          onClick={handleSkipPermanently}
          style={{
            background: 'none',
            border: 'none',
            color: '#dc2626',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Lewati &amp; Jangan Tampilkan Lagi
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {index > 0 && (
            <button
              {...backProps}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Kembali
            </button>
          )}
          <button
            {...primaryProps}
            style={{
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {isLastStep ? 'Selesai' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || !steps || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={runTour}
      continuous={true}
      showProgress={true}
      showSkipButton={false}
      callback={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
      scrollToFirstStep={true}
      scrollOffset={150}
      spotlightClicks={true}
      disableCloseOnEsc={false}
    />
  );
}