// app/api/user/switch-to-general/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const userId = String(body.user_id || '').trim();

    if (!email && !userId) {
      return NextResponse.json(
        { success: false, message: 'Identitas akun tidak valid.' },
        { status: 400 }
      );
    }

    // 1. Bersihkan seluruh proyek praktikum simulasi beserta relasinya
    const projectConditions: string[] = [];
    const projectParams: any[] = [];

    if (email) {
      projectConditions.push('LOWER(TRIM(`user_email`)) = ?');
      projectParams.push(email);
      projectConditions.push('LOWER(TRIM(`fasilitator_email`)) = ?');
      projectParams.push(email);
    }

    if (userId) {
      projectConditions.push('`user_id` = ?');
      projectParams.push(userId);
    }

    const studentProjects: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`id\`, \`project_id\` FROM \`AHP - projects\`
      WHERE ${projectConditions.join(' OR ')}
    `, ...projectParams).catch(() => []);

    if (studentProjects && studentProjects.length > 0) {
      for (const p of studentProjects) {
        const pid = p.project_id || p.id;
        if (!pid) continue;

        await prisma.$executeRawUnsafe('DELETE FROM `AHP - project_experts` WHERE `projectid` = ? OR `project_id` = ?', pid, pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - responses` WHERE `projectid` = ? OR `project_id` = ?', pid, pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - criteria` WHERE `projectid` = ? OR `project_id` = ?', pid, pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - subcriteria` WHERE `projectid` = ? OR `project_id` = ?', pid, pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - alternatives` WHERE `projectid` = ? OR `project_id` = ?', pid, pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - projects` WHERE `id` = ? OR `project_id` = ?', pid, pid).catch(() => {});
      }
    }

    // 2. 🟢 Update status_user ke 'general' di tabel `AHP - users` dan tabel `user`
    if (email) {
      // Update tabel utama AHP - users
      await prisma.$executeRawUnsafe(
        "UPDATE `AHP - users` SET `status_user` = 'general' WHERE LOWER(TRIM(`email`)) = ?",
        email
      ).catch(() => {});

      // Update tabel pendukung `user` (jika ada di skema)
      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `status_user` = 'general', `role` = 'user', `plan` = 'FREE' WHERE LOWER(TRIM(`email`)) = ?",
        email
      ).catch(() => {});
    }

    if (userId) {
      await prisma.$executeRawUnsafe(
        "UPDATE `AHP - users` SET `status_user` = 'general' WHERE `user_id` = ?",
        userId
      ).catch(() => {});

      await prisma.$executeRawUnsafe(
        "UPDATE `user` SET `status_user` = 'general', `role` = 'user', `plan` = 'FREE' WHERE `user_id` = ?",
        userId
      ).catch(() => {});
    }

    // 3. Ambil kuota plan FREE aktif dari SuperAdmin (AHP - plan_settings)
    const freePlanSetting: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`max_projects\`, \`max_experts_manual\` 
      FROM \`AHP - plan_settings\` 
      WHERE LOWER(TRIM(\`plan_key\`)) = 'free' 
      LIMIT 1
    `).catch(() => []);

    const maxProjectsAllowed = freePlanSetting?.[0]?.max_projects !== undefined
      ? Number(freePlanSetting[0].max_projects)
      : 1;

    const maxExpManual = freePlanSetting?.[0]?.max_experts_manual !== undefined
      ? Number(freePlanSetting[0].max_experts_manual)
      : 4;

    // 4. Masukkan data langganan baru ke tabel `AHP - subscriptions`
    if (email) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - subscriptions\`
          (\`user_email\`, \`plan\`, \`status\`, \`expired_date\`, \`max_projects\`, \`max_experts\`, \`max_experts_directory\`, \`max_consultation_per_expert\`, \`notes\`)
        VALUES
          (?, 'FREE', 'ACTIVE', DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, ?, 0, 0, 'Beralih mandiri dari Student Edition ke General Free')
        ON DUPLICATE KEY UPDATE
          \`plan\` = 'FREE',
          \`status\` = 'ACTIVE',
          \`expired_date\` = DATE_ADD(NOW(), INTERVAL 6 MONTH),
          \`max_projects\` = ?,
          \`max_experts\` = ?,
          \`notes\` = 'Beralih mandiri dari Student Edition ke General Free'
      `, email, maxProjectsAllowed, maxExpManual, maxProjectsAllowed, maxExpManual).catch(() => {});
    }

    // 5. Catat ke log audit admin
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 'Sistem Mandiri', ?, 'User', 'SWITCH_TO_GENERAL', 'Pengguna berhasil beralih dari Student Edition ke General Edition (FREE)')`,
        email || userId
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Akun berhasil dialihkan ke General Edition.',
      updated_user: {
        status_user: 'general',
        role: 'user',
        plan: 'free',
      }
    });
  } catch (error: any) {
    console.error('Error saat switch ke General Edition:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengubah status akun.' },
      { status: 500 }
    );
  }
}