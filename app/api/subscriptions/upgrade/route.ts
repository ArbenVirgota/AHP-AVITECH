// app/api/subscription/upgrade/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, plan = 'FREE', status_user = 'general' } = body;

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, message: 'Alamat email pengguna wajib disertakan.' },
        { status: 400 }
      );
    }

    const targetPlan = String(plan).toUpperCase().trim();
    const targetStatusUser = String(status_user).toLowerCase().trim();

    // 1. UPDATE status_user DI TABEL INDUK `AHP - users`
    await prisma.$executeRawUnsafe(
      `UPDATE \`AHP - users\` 
       SET \`status_user\` = ? 
       WHERE LOWER(TRIM(\`email\`)) = LOWER(TRIM(?))`,
      targetStatusUser,
      cleanEmail
    );

    // 2. SISIPKAN KE TABEL `AHP - subscriptions` (MASUKKAN SEBAGAI PLAN FREE AKTIF)
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`AHP - subscriptions\` 
        (\`user_email\`, \`plan\`, \`status\`, \`expired_date\`, \`max_projects\`, \`max_experts\`, \`max_experts_directory\`, \`max_consultation_per_expert\`, \`custom_features\`, \`notes\`)
       VALUES 
        (?, ?, 'ACTIVE', DATE_ADD(NOW(), INTERVAL 6 MONTH), 1, 4, 0, 0, '', 'Upgrade mandiri dari Student Edition ke General Free')
       ON DUPLICATE KEY UPDATE 
        \`plan\` = VALUES(\`plan\`),
        \`status\` = 'ACTIVE',
        \`expired_date\` = VALUES(\`expired_date\`)`,
      cleanEmail,
      targetPlan
    );

    // 3. REKAM LOG AUDIT
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 'Sistem Mandiri', ?, 'User', 'UPGRADE_PLAN_MANDIRI', ?)`,
        cleanEmail,
        `Pengguna beralih dari Student Edition ke Plan ${targetPlan} (${targetStatusUser})`
      );
    } catch {
      // Abaikan jika tabel log belum siap
    }

    return NextResponse.json({
      success: true,
      message: `Selamat! Akun Anda berhasil beralih ke Plan ${targetPlan} (General / Peneliti).`,
      data: {
        email: cleanEmail,
        plan: targetPlan,
        status_user: targetStatusUser,
      },
    });
  } catch (error: any) {
    console.error('Error upgrade mandiri subscription:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses peralihan paket.' },
      { status: 500 }
    );
  }
}