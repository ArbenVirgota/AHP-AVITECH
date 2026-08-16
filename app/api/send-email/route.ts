// app/api/send-email/route.ts

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dns from 'dns';

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
    // Membersihkan tanda petik pembungkus jika terbaca dari .env.local
    const smtpPass = (process.env.SMTP_PASS || '1r25nPejanggik').replace(/^["']|["']$/g, '');

    // 2. Konfigurasi Transporter SMTP
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true untuk port 465 (SSL), false untuk port 587 (STARTTLS)
      
      // 🟢 TAMBAHAN WAJIB UNTUK GMAIL SMTP: Mencegah Error 421 (Rate Limit)
      pool: true,
      maxConnections: 3,
      maxMessages: 50,

      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // 💡 SOLUSI ERROR 535 AUTH PLAIN: Paksa metode otentikasi LOGIN
      authMethod: 'LOGIN',
      // 💡 SOLUSI HANG: Batasi timeout koneksi & socket
      connectionTimeout: 10000, // 10 detik
      greetingTimeout: 10000,   // 10 detik
      socketTimeout: 15000,     // 15 detik
      // 💡 SOLUSI ENETUNREACH: Paksa resolver DNS hanya mengembalikan alamat IPv4
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { family: 4 }, callback);
      },
      tls: {
        rejectUnauthorized: false // Memastikan koneksi tidak terhalang isu sertifikat
      }
    } as nodemailer.TransportOptions);

    // 3. Konfigurasi Data Email
    // Pengirim (from) dikunci persis sama dengan akun auth SMTP untuk menghindari Sender Mismatch
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