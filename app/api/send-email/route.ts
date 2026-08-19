// app/api/send-email/route.ts

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, textBody, htmlBody } = body;

    // 1. Validasi input
    if (!to || !subject) {
      return NextResponse.json(
        { success: false, message: 'Alamat penerima dan subjek wajib diisi.' },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpUser = process.env.SMTP_USER || 'admin@avitech.cloud';
    const smtpPass = (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, '');

    // 2. Konfigurasi Transporter SMTP (DIUBAH UNTUK SERVERLESS)
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true untuk port 465 (SSL)
      
      // 🚫 JANGAN GUNAKAN pool: true DI SERVERLESS / NEXT.JS API
      // pool: false (default), agar koneksi langsung ditutup setelah 1x kirim
      
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      
      // Batasi timeout agar tidak terjadi hang yang ekstrim
      connectionTimeout: 10000, 
      greetingTimeout: 10000,   
      socketTimeout: 15000,     
      
      tls: {
        // Mengabaikan sertifikat SSL/TLS yang mungkin bermasalah di local/hosting
        rejectUnauthorized: false 
      }
    } as nodemailer.TransportOptions);

    // 3. Konfigurasi Data Email
    const mailOptions = {
      from: `"Admin AHP Avitech" <${smtpUser}>`,
      to: String(to).trim().toLowerCase(),
      subject: String(subject).trim(),
      text: textBody || '',
      html: htmlBody || '',
    };

    // 4. Proses Pengiriman
    const info = await transporter.sendMail(mailOptions);
    console.log('Email terkirim:', info.messageId);

    // 5. Tutup transporter secara eksplisit (Penting untuk Serverless)
    transporter.close();

    return NextResponse.json({
      success: true,
      message: 'Email berhasil terkirim!',
      messageId: info.messageId
    });

  } catch (error: any) {
    console.error('Gagal mengirim email:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Gagal mengirim email: ' + (error.message || error.toString()) 
      },
      { status: 500 }
    );
  }
}