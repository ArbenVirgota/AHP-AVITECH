// app/api/admin/student-retention/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 1. GET: Ambil pengaturan masa retensi dan jumlah akun mahasiswa yang kadaluarsa
export async function GET() {
  try {
    // Ambil setting waktu retensi (default 30 hari)
    const settingRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT setting_value FROM \`AHP - system_assets\` 
      WHERE setting_key = 'student_retention_days' LIMIT 1
    `).catch(() => []);

    const retentionDays = parseInt(settingRows[0]?.setting_value || '30', 10);

    // Hitung akun mahasiswa yang dibuat lebih lama dari batas retensi
    const expiredCountRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total_expired 
      FROM \`AHP - users\`
      WHERE (role = 'student' OR is_student = 1 OR plan_type = 'student')
        AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, retentionDays).catch(() => [{ total_expired: 0 }]);

    const totalExpired = Number(expiredCountRows[0]?.total_expired || 0);

    // Hitung total seluruh akun mahasiswa aktif
    const totalStudentRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total_student 
      FROM \`AHP - users\`
      WHERE role = 'student' OR is_student = 1 OR plan_type = 'student'
    `).catch(() => [{ total_student: 0 }]);

    return NextResponse.json({
      success: true,
      data: {
        retention_days: retentionDays,
        total_student: Number(totalStudentRows[0]?.total_student || 0),
        total_expired: totalExpired,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. POST: Simpan batas hari retensi baru ATAU jalankan eksekusi penghapusan
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, retention_days } = body;

    // Aksi 1: Simpan konfigurasi hari retensi baru
    if (action === 'save_setting') {
      const days = Math.max(1, parseInt(retention_days || '30', 10));

      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - system_assets\` (setting_key, setting_value)
        VALUES ('student_retention_days', ?)
        ON DUPLICATE KEY UPDATE setting_value = ?
      `, String(days), String(days));

      return NextResponse.json({
        success: true,
        message: `Masa retensi data mahasiswa berhasil disimpan (${days} hari).`,
      });
    }

    // Aksi 2: Eksekusi penghapusan akun mahasiswa kadaluarsa
    if (action === 'purge_expired') {
      // Ambil durasi retensi saat ini
      const settingRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT setting_value FROM \`AHP - system_assets\` 
        WHERE setting_key = 'student_retention_days' LIMIT 1
      `).catch(() => []);

      const retentionDays = parseInt(settingRows[0]?.setting_value || '30', 10);

      // Cari ID & email mahasiswa yang kadaluarsa
      const expiredUsers: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, email FROM \`AHP - users\`
        WHERE (role = 'student' OR is_student = 1 OR plan_type = 'student')
          AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, retentionDays).catch(() => []);

      if (expiredUsers.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Tidak ada data mahasiswa kadaluarsa yang perlu dibersihkan.',
          purged_count: 0,
        });
      }

      const emails = expiredUsers.map((u) => u.email).filter(Boolean);

      // Pembersihan bertingkat (Cascade cleanup data simulasi):
      // 1. Hapus respon kuesioner dari proyek mahasiswa
      await prisma.$executeRawUnsafe(`
        DELETE r FROM \`AHP - responses\` r
        INNER JOIN \`AHP - projects\` p ON r.projectid = p.id
        WHERE p.user_email IN (${emails.map(() => '?').join(',')})
      `, ...emails).catch(() => null);

      // 2. Hapus expert simulasi terkait
      await prisma.$executeRawUnsafe(`
        DELETE e FROM \`AHP - project_experts\` e
        INNER JOIN \`AHP - projects\` p ON e.projectid = p.id
        WHERE p.user_email IN (${emails.map(() => '?').join(',')})
      `, ...emails).catch(() => null);

      // 3. Hapus proyek mahasiswa
      await prisma.$executeRawUnsafe(`
        DELETE FROM \`AHP - projects\`
        WHERE user_email IN (${emails.map(() => '?').join(',')})
      `, ...emails).catch(() => null);

      // 4. Hapus akun mahasiswa dari AHP - users
      await prisma.$executeRawUnsafe(`
        DELETE FROM \`AHP - users\`
        WHERE email IN (${emails.map(() => '?').join(',')})
      `, ...emails).catch(() => null);

      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${expiredUsers.length} akun mahasiswa dan seluruh data simulasinya.`,
        purged_count: expiredUsers.length,
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}