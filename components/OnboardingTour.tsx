// components/OnboardingTour.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Cek di localStorage apakah user sudah pernah melihat tutorial ini
    const hasSeenTutorial = localStorage.getItem('has_seen_tutorial');
    
    // Jika belum pernah melihat, jalankan tour
    if (!hasSeenTutorial) {
      // Beri sedikit jeda agar semua halaman selesai dirender
      setTimeout(() => setRun(true), 1000); 
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Jika user klik "Skip" atau sudah selesai sampai akhir, catat di memori
      localStorage.setItem('has_seen_tutorial', 'true');
      setRun(false);
    }
  };

  // Definisikan langkah-langkah dan elemen mana yang akan disorot
  const steps: Step[] = [
    {
      target: 'body', // Sorot tengah layar untuk ucapan selamat datang
      content: 'Selamat datang di Platform AHP Avitech! Mari ikuti tur singkat untuk mengenal fitur-fitur utama sistem ini.',
      title: '👋 Selamat Datang!',
      placement: 'center',
    },
    {
      target: '.tour-step-project', // Kita akan tambahkan class ini ke tombol Buat Proyek
      content: 'Di sinilah langkah pertama Anda dimulai. Klik tombol ini untuk membuat proyek riset AHP baru, menentukan kriteria, dan alternatif.',
      title: '📁 Buat Proyek Baru',
    },
    {
      target: '.tour-step-expert', // Tambahkan class ini ke menu Direktori Pakar
      content: 'Anda butuh pakar untuk menilai kuesioner? Cari dan temukan pakar yang relevan dengan riset Anda di menu Direktori Pakar.',
      title: '👥 Direktori Pakar',
    },
    {
      target: '.tour-step-consultation', // Tambahkan class ini ke menu Konsultasi
      content: 'Jika Anda memiliki kendala atau butuh masukan dari pakar/admin, gunakan fitur Pusat Konsultasi untuk mengirim tiket pertanyaan.',
      title: '💬 Pusat Konsultasi',
    },
    {
      target: '.tour-step-profile', // Tambahkan class ini ke menu Profil
      content: 'Pastikan Anda melengkapi profil dan mengunggah tanda tangan digital agar sertifikat riset Anda sah.',
      title: '⚙️ Lengkapi Profil Anda',
    }
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true} // Melanjutkan otomatis ke langkah berikutnya
      showSkipButton={true} // Tombol untuk melewati tutorial
      showProgress={true} // Menampilkan "1 dari 5"
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#2563eb', // Warna biru untuk tombol "Lanjut"
          textColor: '#334155',
          zIndex: 10000,
        },
        buttonClose: {
          display: 'none', // Sembunyikan tombol (X) kecil agar fokus ke "Skip"
        }
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