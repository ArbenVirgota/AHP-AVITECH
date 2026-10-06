// app/api/send-email/route.ts

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, textBody, htmlBody } = body;

    if (!to || !subject) {
      return NextResponse.json(
        { success: false, message: 'Alamat tujuan (to) dan subject wajib diisi.' },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // SSL untuk port 465 Hostinger
      auth: {
        user: process.env.SMTP_USER || 'admin@avitech.cloud',
        pass: process.env.SMTP_PASS, // Kata sandi email webmail Hostinger
      },
    });

    await transporter.sendMail({
      from: `"AHP Avitech Admin" <${process.env.SMTP_USER || 'admin@avitech.cloud'}>`,
      to,
      subject,
      text: textBody,
      html: htmlBody || textBody?.replace(/\n/g, '<br/>'),
    });

    return NextResponse.json({
      success: true,
      message: 'Email instruksi berhasil dikirim melalui mail server Hostinger.',
    });
  } catch (error: any) {
    console.error('Send Email Hostinger Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengirim email.' },
      { status: 500 }
    );
  }
}