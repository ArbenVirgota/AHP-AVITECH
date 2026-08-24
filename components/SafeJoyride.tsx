// components/SafeJoyride.tsx

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface StepItem {
  target?: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface SafeJoyrideProps {
  steps: StepItem[];
  storageKey: string;
  primaryColor?: string;
}

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

type ArrowDirection = 'left' | 'right' | 'top' | 'bottom' | 'none';

export default function SafeJoyride({ steps, storageKey, primaryColor = '#2563eb' }: SafeJoyrideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<RectBox | null>(null);
  const [isCenteredFallback, setIsCenteredFallback] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // 1. Cek Persistence LocalStorage & Event Pemicu Manual
  useEffect(() => {
    try {
      const isDone = localStorage.getItem(storageKey) === 'true';
      if (!isDone) {
        const timer = setTimeout(() => setIsOpen(true), 600);
        return () => clearTimeout(timer);
      }
    } catch (e) {}

    const handleStartTour = () => {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener(`start-tour-${storageKey}`, handleStartTour);
    return () => window.removeEventListener(`start-tour-${storageKey}`, handleStartTour);
  }, [storageKey]);

  // 2. Hitung Posisi Target & Otomatis Scroll ke Tengah Blok jika di luar layar
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || steps.length === 0) return;
    const step = steps[currentStep];

    if (!step.target || step.target === 'body') {
      setTargetRect(null);
      setIsCenteredFallback(true);
      return;
    }

    const el = document.querySelector(step.target);
    if (el) {
      // Gulirkan elemen target tepat ke tengah layar agar terlihat jelas
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      
      // Beri jeda kecil setelah smooth scroll selesai untuk menghitung ulang koordinat bounding rect
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        
        // Cek apakah elemen benar-benar berada di dalam viewport yang terlihat
        const isOutOfBounds = 
          rect.top < 0 || 
          rect.left < 0 || 
          rect.bottom > window.innerHeight || 
          rect.right > window.innerWidth;

        if (isOutOfBounds || rect.height === 0 || rect.width === 0) {
          // Jika masih di luar layar / terpotong, paksa tampil di tengah layar
          setTargetRect(null);
          setIsCenteredFallback(true);
        } else {
          setTargetRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          });
          setIsCenteredFallback(false);
        }
      }, 250);
    } else {
      setTargetRect(null);
      setIsCenteredFallback(true);
    }
  }, [isOpen, steps, currentStep]);

  useEffect(() => {
    updateTargetPosition();
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition);
    };
  }, [updateTargetPosition]);

  const handleFinish = () => {
    try {
      localStorage.setItem(storageKey, 'true');
      document.cookie = `${storageKey}=true; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];

  // 3. Kalkulasi Koordinat Pop-up Card (Otomatis Tengah jika isCenteredFallback bernilai true)
  let cardPositionStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1000002,
  };

  let arrowStyle: React.CSSProperties = { display: 'none' };

  if (targetRect && !isCenteredFallback) {
    const spaceRight = window.innerWidth - (targetRect.left + targetRect.width);
    const spaceBottom = window.innerHeight - (targetRect.top + targetRect.height);

    if (spaceRight > 390) {
      cardPositionStyle = {
        position: 'fixed',
        top: Math.max(20, Math.min(targetRect.top, window.innerHeight - 300)),
        left: targetRect.left + targetRect.width + 16,
        zIndex: 1000002,
      };
      arrowStyle = {
        position: 'absolute',
        top: 20,
        left: -8,
        width: 0,
        height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '8px solid #ffffff',
        display: 'block'
      };
    } else if (spaceBottom > 240) {
      cardPositionStyle = {
        position: 'fixed',
        top: targetRect.top + targetRect.height + 16,
        left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 380)),
        zIndex: 1000002,
      };
      arrowStyle = {
        position: 'absolute',
        top: -8,
        left: 24,
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '8px solid #ffffff',
        display: 'block'
      };
    } else {
      cardPositionStyle = {
        position: 'fixed',
        bottom: window.innerHeight - targetRect.top + 16,
        left: Math.max(20, Math.min(targetRect.left, window.innerWidth - 380)),
        zIndex: 1000002,
      };
      arrowStyle = {
        position: 'absolute',
        bottom: -8,
        left: 24,
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '8px solid #ffffff',
        display: 'block'
      };
    }
  }

  return (
    <>
      {/* SVG Spotlight Mask */}
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000000,
          pointerEvents: 'auto',
        }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && !isCenteredFallback && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target Highlight Border */}
      {targetRect && !isCenteredFallback && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            border: `2px solid ${primaryColor}`,
            borderRadius: 8,
            boxShadow: `0 0 0 4px ${primaryColor}33, 0 0 20px ${primaryColor}66`,
            pointerEvents: 'none',
            zIndex: 1000001,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}

      {/* Floating Card Container */}
      <div
        ref={cardRef}
        style={{
          ...cardPositionStyle,
          background: '#ffffff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Tanda Panah Penunjuk */}
        <div style={arrowStyle} />

        {/* Header & Step Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{step.title}</h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#64748b',
              background: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {currentStep + 1}/{steps.length}
          </span>
        </div>

        {/* Content */}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#334155' }}>{step.content}</p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            paddingTop: 10,
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            onClick={handleFinish}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 4px',
            }}
          >
            Lewati Tur
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 7,
                  cursor: 'pointer',
                }}
              >
                Kembali
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              style={{
                border: 'none',
                color: '#ffffff',
                background: primaryColor,
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: 7,
                cursor: 'pointer',
                boxShadow: `0 2px 8px ${primaryColor}40`,
              }}
            >
              {currentStep === steps.length - 1 ? 'Selesai 🎉' : 'Lanjut →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}