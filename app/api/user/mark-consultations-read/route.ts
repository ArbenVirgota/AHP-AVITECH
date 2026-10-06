// app/api/user/mark-consultations-read/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body?.email;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email tidak ditemukan.' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Tandai semua tiket yang memiliki balasan menjadi sudah dibaca oleh user
    await prisma.$executeRawUnsafe(`
      UPDATE \`AHP - ConsultationRequests\`
      SET \`is_read_user\` = 1
      WHERE LOWER(TRIM(\`user_email\`)) = ?
        AND \`jawaban_expert\` IS NOT NULL
        AND TRIM(\`jawaban_expert\`) != ''
        AND COALESCE(\`is_read_user\`, 0) = 0
    `, cleanEmail);

    return NextResponse.json({ success: true, message: 'Tiket berhasil ditandai sudah dibaca.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Gagal menandai tiket.' }, { status: 500 });
  }
}