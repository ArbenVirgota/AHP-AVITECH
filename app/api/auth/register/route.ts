// app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/mailer';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nama, email, password, institusi, city, status_user } = body;

    // 1. Validasi input wajib
    if (!nama || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Nama lengkap, email, dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 2. Cek apakah email sudah terdaftar sebelumnya
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Alamat email sudah terdaftar. Silakan gunakan email lain atau masuk.' },
        { status: 400 }
      );
    }

    // 3. Tentukan status_user yang valid (student / fasilitator)
    const validStatusUser = status_user === 'student' ? 'student' : 'fasilitator';

    // 4. Hash password dan buat token verifikasi
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam
    const userId = `USR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // 5. Simpan akun ke tabel AHP - users
    await prisma.user.create({
      data: {
        user_id: userId,
        nama: String(nama).trim(),
        email: cleanEmail,
        passwordHash: hashedPassword,
        status_user: validStatusUser,
        institusi: institusi ? String(institusi).trim() : 'Umum',
        city: city ? String(city).trim() : null,
        status: 'active',
        plan: 'FREE',
        isVerified: false,
        verificationToken: verificationToken,
        tokenExpiry: tokenExpiry,
      },
    });

    // 6. Sinkronisasi otomatis ke tabel `AHP - subscriptions`
    try {
      const isStudent = validStatusUser === 'student';

      // Ambil default limit dari paket FREE pada AHP - plan_settings jika tersedia
      let defaultProjects = 1;
      let defaultExperts = 4;
      let defaultDirectory = 0;
      let defaultConsult = 0;

      try {
        const freePlanRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT max_projects, max_experts_manual, max_experts_directory, max_consultation_per_expert
          FROM \`AHP - plan_settings\`
          WHERE UPPER(TRIM(\`plan_key\`)) = 'FREE'
          LIMIT 1
        `);
        if (freePlanRows && freePlanRows.length > 0) {
          defaultProjects = Number(freePlanRows[0].max_projects ?? 1);
          defaultExperts = Number(freePlanRows[0].max_experts_manual ?? 4);
          defaultDirectory = Number(freePlanRows[0].max_experts_directory ?? 0);
          defaultConsult = Number(freePlanRows[0].max_consultation_per_expert ?? 0);
        }
      } catch (planErr) {
        console.warn('Gagal membaca default plan_settings FREE:', planErr);
      }

      const maxProjects = isStudent ? 2 : defaultProjects;
      const maxExperts = isStudent ? 2 : defaultExperts;
      const maxDirectory = isStudent ? 0 : defaultDirectory;
      const maxConsultation = isStudent ? 0 : defaultConsult;
      const customFeatures = isStudent ? 'subcriteria,alternative' : '';
      const notes = isStudent ? 'Registrasi Akun Praktikum (Student Edition)' : 'Registrasi Akun Baru (FREE Pass)';

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - subscriptions\` (
           \`user_email\`,
           \`plan\`,
           \`status\`,
           \`expired_date\`,
           \`max_projects\`,
           \`max_experts\`,
           \`max_experts_directory\`,
           \`max_consultation_per_expert\`,
           \`custom_features\`,
           \`notes\`
         )
         VALUES (?, 'FREE', 'ACTIVE', DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           \`plan\` = VALUES(\`plan\`),
           \`status\` = VALUES(\`status\`),
           \`max_projects\` = VALUES(\`max_projects\`),
           \`max_experts\` = VALUES(\`max_experts\`),
           \`custom_features\` = VALUES(\`custom_features\`)`,
        cleanEmail,
        maxProjects,
        maxExperts,
        maxDirectory,
        maxConsultation,
        customFeatures,
        notes
      );
    } catch (subError: any) {
      console.error('Gagal menyisipkan data langganan ke AHP - subscriptions:', subError.message);
    }

    // 7. Kirim email konfirmasi ke email pengguna
    try {
      await sendVerificationEmail(cleanEmail, String(nama).trim(), verificationToken);
    } catch (mailError) {
      console.error('Gagal mengirim email aktivasi:', mailError);
      return NextResponse.json({
        success: true,
        message: 'Akun berhasil dibuat, namun email verifikasi gagal terkirim otomatis. Silakan hubungi admin.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Registrasi berhasil! Tautan aktivasi telah dikirim ke email Anda. Silakan periksa kotak masuk atau spam email Anda.',
    });
  } catch (error: any) {
    console.error('Error pendaftaran:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan sistem saat mendaftar.' },
      { status: 500 }
    );
  }
}