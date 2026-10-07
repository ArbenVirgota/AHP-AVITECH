// app/api/expert/confirm/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ success: false, message: 'Token tidak valid' }, { status: 400 });
    }

    // 1. Cari data pakar dan proyek berdasarkan token
    const pExperts: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`project_id\`, \`expert_id\` 
      FROM \`AHP - project_experts\` 
      WHERE \`token\` = ? LIMIT 1
    `, token);

    if (!pExperts || pExperts.length === 0) {
      return NextResponse.json({ success: false, message: 'Data pakar tidak ditemukan' }, { status: 404 });
    }

    const { project_id, expert_id } = pExperts[0];

    // 2. Kunci seluruh respons matriks milik pakar pada proyek ini
    await prisma.$executeRawUnsafe(`
      UPDATE \`AHP - responses\`
      SET \`is_confirmed\` = 1, \`confirmed_at\` = NOW()
      WHERE \`project_id\` = ? AND \`expert_id\` = ?
    `, project_id, expert_id);

    // 3. Perbarui status pada relasi proyek pakar
    await prisma.$executeRawUnsafe(`
      UPDATE \`AHP - project_experts\`
      SET \`status\` = 'Selesai', \`response_status\` = 'Confirmed', \`confirmed_at\` = NOW()
      WHERE \`project_id\` = ? AND \`expert_id\` = ?
    `, project_id, expert_id);

    return NextResponse.json({
      success: true,
      message: 'Penilaian berhasil dikonfirmasi dan kuesioner telah dikunci.',
    });
  } catch (error: any) {
    console.error('Error confirming expert responses:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}