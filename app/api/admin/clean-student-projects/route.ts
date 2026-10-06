// app/api/admin/cleanup-student-projects/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * GET: Memindai status proyek mahasiswa dan menghitung yang sudah melewati 6 bulan
 */
export async function GET() {
  try {
    // 1. Ambil daftar email atau ID semua user bertipe 'student'
    const studentUsers: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`user_id\`, \`email\`, \`nama\` 
      FROM \`AHP - users\` 
      WHERE LOWER(\`status_user\`) = 'student'
    `);

    if (!studentUsers || studentUsers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalStudents: 0,
          totalStudentProjects: 0,
          expiredProjectsCount: 0,
          expiredProjectsList: [],
        },
      });
    }

    const studentEmails = studentUsers.map((u) => String(u.email || '').toLowerCase().trim()).filter(Boolean);
    const studentIds = studentUsers.map((u) => String(u.user_id || '').trim()).filter(Boolean);

    // 2. Ambil seluruh proyek mahasiswa
    const allStudentProjects: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`project_id\`, \`nama_proyek\`, \`user_email\`, \`user_id\`, \`created_at\`
      FROM \`AHP - projects\`
      WHERE LOWER(\`user_email\`) IN (${studentEmails.map(() => '?').join(',')})
         OR \`user_id\` IN (${studentIds.map(() => '?').join(',')})
      ORDER BY \`created_at\` ASC
    `, ...studentEmails, ...studentIds);

    // 3. Filter proyek yang dibuat lebih dari 6 bulan yang lalu (180 hari)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const expiredProjects = (allStudentProjects || []).filter((p) => {
      const createdAt = new Date(p.created_at);
      return !isNaN(createdAt.getTime()) && createdAt < sixMonthsAgo;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalStudents: studentUsers.length,
        totalStudentProjects: allStudentProjects.length,
        expiredProjectsCount: expiredProjects.length,
        expiredProjectsList: expiredProjects.slice(0, 50), // Batasi 50 teratas untuk pratinjau
      },
    });
  } catch (error: any) {
    console.error('Error GET cleanup-student-projects:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * POST: Mengeksekusi pembersihan massal data proyek mahasiswa yang kadaluarsa (> 6 bulan)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const adminEmail = String(body.admin_email || 'SuperAdmin').trim();

    // 1. Ambil email/user_id akun mahasiswa
    const studentUsers: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`user_id\`, \`email\` 
      FROM \`AHP - users\` 
      WHERE LOWER(\`status_user\`) = 'student'
    `);

    if (!studentUsers || studentUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada akun mahasiswa yang terdaftar.',
        deletedCount: 0,
      });
    }

    const studentEmails = studentUsers.map((u) => String(u.email || '').toLowerCase().trim()).filter(Boolean);
    const studentIds = studentUsers.map((u) => String(u.user_id || '').trim()).filter(Boolean);

    // 2. Ambil ID proyek mahasiswa yang sudah > 6 bulan
    const expiredProjects: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`project_id\`
      FROM \`AHP - projects\`
      WHERE (LOWER(\`user_email\`) IN (${studentEmails.map(() => '?').join(',')})
         OR \`user_id\` IN (${studentIds.map(() => '?').join(',')}))
        AND (\`created_at\` < NOW() - INTERVAL 6 MONTH)
    `, ...studentEmails, ...studentIds);

    const projectIdsToDelete = (expiredProjects || []).map((p: any) => p.project_id).filter(Boolean);

    if (projectIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Semua data proyek mahasiswa masih dalam batas retensi (belum ada yang melampaui 6 bulan).',
        deletedCount: 0,
      });
    }

    // 3. Hapus berantai (cascade) data relasi untuk mencegah error foreign key / orphan records
    for (const pid of projectIdsToDelete) {
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - project_experts` WHERE `project_id` = ?', pid).catch(() => {});
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - responses` WHERE `project_id` = ?', pid).catch(() => {});
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - criteria` WHERE `project_id` = ?', pid).catch(() => {});
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - subcriteria` WHERE `project_id` = ?', pid).catch(() => {});
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - alternatives` WHERE `project_id` = ?', pid).catch(() => {});
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - projects` WHERE `project_id` = ?', pid).catch(() => {});
    }

    // 4. Catat aktivitas ke tabel log admin jika ada
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama Admin\`, \`Email Admin\`, \`Role\`, \`Aksi / Tindakan\`, \`Detail Keterangan\`)
        VALUES (NOW(), 'SuperAdmin', ?, 'SUPERADMIN', 'Pembersihan Proyek Mahasiswa', ?)
      `, adminEmail, `Membersihkan massal ${projectIdsToDelete.length} proyek mahasiswa yang melewati batas retensi 6 bulan.`);
    } catch {
      // Abaikan jika struktur tabel admin_logs berbeda
    }

    return NextResponse.json({
      success: true,
      deletedCount: projectIdsToDelete.length,
      message: `Pembersihan berhasil! Sebanyak ${projectIdsToDelete.length} proyek latihan mahasiswa yang melewati retensi 6 bulan telah dihapus secara permanen.`,
    });
  } catch (error: any) {
    console.error('Error POST cleanup-student-projects:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}