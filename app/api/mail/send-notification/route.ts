// app/api/mail/send-notification/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fasilitator_email, fasilitator_nama, expert_name, project_name, certificate_id } = body;

    if (!fasilitator_email) {
      return NextResponse.json({ success: false, message: 'Email peneliti utama tidak ditemukan.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'admin@avitech.cloud',
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f766e; margin-top: 0;">Evaluasi Pakar Telah Selesai!</h2>
        <p>Halo <strong>${fasilitator_nama || 'Peneliti Utama'}</strong>,</p>
        <p>Pakar berikut telah menyelesaikan seluruh penilaian matriks perbandingan berpasangan AHP dan memperbarui profil mereka:</p>
        
        <div style="background: #f8fafc; padding: 12px 16px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Nama Pakar:</strong> ${expert_name}</p>
          <p style="margin: 4px 0;"><strong>Judul Proyek:</strong> ${project_name}</p>
          <p style="margin: 4px 0;"><strong>No. Sertifikat:</strong> ${certificate_id}</p>
        </div>

        <p>Anda dapat masuk ke dashboard penelitian untuk melihat hasil rekapitulasi penilaian dan memvalidasi laporan akhir riset.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11.5px; color: #64748b; text-align: center;">Pesan otomatis dari Platform Analisis Data Digital • AHP Avitech</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"AHP Avitech System" <${process.env.SMTP_USER || 'admin@avitech.cloud'}>`,
      to: fasilitator_email,
      subject: `[Konfirmasi Selesai] Evaluasi Proyek: ${project_name}`,
      text: `Evaluasi oleh ${expert_name} untuk proyek ${project_name} telah selesai.`,
      html: htmlContent,
    });

    return NextResponse.json({
      success: true,
      message: 'Email konfirmasi berhasil dikirim ke peneliti utama melalui Hostinger.',
    });
  } catch (error: any) {
    console.error('Send Notification Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengirim email notifikasi.' },
      { status: 500 }
    );
  }
}