// app/api/subscriptions/route.ts

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || searchParams.get('user_email') || '';
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ success: false, message: 'Email tidak disertakan' }, { status: 400 });
    }

    // 1. Ambil data langganan pengguna dari `AHP - subscriptions`
    const subRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT 
         \`user_email\`,
         UPPER(COALESCE(\`plan\`, 'FREE')) AS \`plan\`,
         UPPER(COALESCE(\`status\`, 'ACTIVE')) AS \`status\`,
         DATE_FORMAT(\`expired_date\`, '%Y-%m-%d') AS \`expired_date\`,
         \`max_projects\`,
         \`max_experts\`,
         \`max_experts_directory\`,
         \`max_consultation_per_expert\`,
         COALESCE(\`custom_features\`, '') AS \`custom_features\`,
         COALESCE(\`notes\`, '') AS \`notes\`
       FROM \`AHP - subscriptions\`
       WHERE LOWER(\`user_email\`) = ?
       LIMIT 1`,
      cleanEmail
    );

    const userSub = subRows && subRows.length > 0 ? subRows[0] : null;
    const planKey = userSub?.plan || 'FREE';

    // 2. Ambil default setting dari `AHP - plan_settings` (Fallback untuk user tanpa privilese)
    const planRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM \`AHP - plan_settings\` WHERE UPPER(\`plan_key\`) = ? LIMIT 1`,
      planKey
    );
    const defaultSetting = planRows && planRows.length > 0 ? planRows[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        subscription: userSub,
        planSetting: defaultSetting,
      },
    });
  } catch (error) {
    console.error('API Subscription GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat status langganan' },
      { status: 500 }
    );
  }
}