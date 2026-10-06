// app/api/user/unread-consultations/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: true, unreadCount: 0 });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 🟢 Hitung tiket yang sudah dijawab pakar/admin dan belum dibaca (is_read_user = 0 atau NULL)
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as unreadCount 
      FROM \`AHP - ConsultationRequests\`
      WHERE LOWER(TRIM(\`user_email\`)) = ?
        AND \`jawaban_expert\` IS NOT NULL 
        AND TRIM(\`jawaban_expert\`) != ''
        AND (COALESCE(\`is_read_user\`, 0) = 0)
    `, cleanEmail);

    const count = Number(rows[0]?.unreadCount || 0);

    return NextResponse.json({
      success: true,
      unreadCount: count,
    });
  } catch (error: any) {
    console.error('Error GET unread-consultations:', error);
    return NextResponse.json({
      success: false,
      unreadCount: 0,
    });
  }
}