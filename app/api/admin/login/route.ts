// app/api/admin/login/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const inputPassword = String(password || '').trim();

    if (!cleanEmail || !inputPassword) {
      return NextResponse.json(
        { success: false, message: 'Email dan password wajib diisi.' },
        { status: 400 }
      );
    }

    // 🟢 Ambil data admin langsung dari tabel MySQL `AHP - Admins`
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT 
        \`id\`,
        COALESCE(\`nama\`, 'Admin') AS \`nama\`,
        COALESCE(\`email\`, '') AS \`email\`,
        COALESCE(\`password\`, '') AS \`password\`,
        COALESCE(\`role\`, 'Admin Pembantu') AS \`role\`,
        COALESCE(\`wewenang_modul\`, '[]') AS \`wewenang_modul\`,
        COALESCE(\`status\`, 'Aktif') AS \`status\`
      FROM \`AHP - Admins\`
      WHERE LOWER(\`email\`) = ?
      LIMIT 1`,
      cleanEmail
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Kredensial login admin tidak valid atau tidak terdaftar.' },
        { status: 401 }
      );
    }

    const admin = rows[0];

    // Periksa status aktif/non-aktif akun
    const statusLower = String(admin.status || '').trim().toLowerCase();
    if (statusLower === 'non-aktif' || statusLower === 'inactive') {
      return NextResponse.json(
        { success: false, message: 'Akun admin ini sedang dinonaktifkan. Hubungi SuperAdmin.' },
        { status: 403 }
      );
    }

    // Cocokkan kata sandi
    if (admin.password !== inputPassword) {
      return NextResponse.json(
        { success: false, message: 'Kata sandi admin yang Anda masukkan salah.' },
        { status: 401 }
      );
    }

    // Parsing wewenang modul (baik berupa JSON array ataupun teks pisah koma)
    let allowedModules: string[] = [];
    try {
      allowedModules = typeof admin.wewenang_modul === 'string'
        ? JSON.parse(admin.wewenang_modul)
        : (admin.wewenang_modul || []);
    } catch {
      allowedModules = String(admin.wewenang_modul || '')
        .split(',')
        .map((s) => s.replace(/[\[\]"']/g, '').trim())
        .filter(Boolean);
    }

    // Catat riwayat login ke tabel `AHP - admin_logs`
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, ?, 'LOGIN_SISTEM', 'Berhasil masuk ke panel operasional admin')`,
        String(admin.nama),
        String(admin.email),
        String(admin.role)
      );
    } catch (logErr) {
      console.warn('Gagal mencatat log login admin:', logErr);
    }

    const adminSession = {
      id: admin.id,
      email: admin.email,
      nama: admin.nama,
      role: admin.role,
      status: admin.status,
      allowed_access: allowedModules, // 🟢 Array hak modul: ['expert_directory', 'products', dst]
      loginAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: 'Login admin berhasil.',
      data: adminSession,
    });
  } catch (error) {
    console.error('API Admin Login Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Terjadi kegagalan server saat proses login admin.',
      },
      { status: 500 }
    );
  }
}