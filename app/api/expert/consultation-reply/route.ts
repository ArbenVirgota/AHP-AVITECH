// app/api/expert/consultation-reply/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ success: false, message: 'ID Tiket wajib disertakan.' }, { status: 400 });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        \`ticket_id\`,
        \`user_name\`,
        \`asal_institusi\`,
        \`pertanyaan\`,
        \`lampiran\`,
        \`status\`,
        \`jawaban_expert\`
      FROM \`AHP - ConsultationRequests\`
      WHERE LOWER(TRIM(\`ticket_id\`)) = LOWER(TRIM(?))
      LIMIT 1
    `, ticketId);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Tiket konsultasi tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticket_id, jawaban_expert } = body;

    if (!ticket_id || !jawaban_expert) {
      return NextResponse.json({ success: false, message: 'ID Tiket dan jawaban wajib diisi.' }, { status: 400 });
    }

    // 🟢 Set jawaban_expert, ubah status ke 'Selesai', dan set is_read_user = 0
    await prisma.$executeRawUnsafe(`
      UPDATE \`AHP - ConsultationRequests\`
      SET 
        \`jawaban_expert\` = ?,
        \`status\` = 'Selesai',
        \`is_read_user\` = 0
      WHERE LOWER(TRIM(\`ticket_id\`)) = LOWER(TRIM(?))
    `, jawaban_expert, ticket_id);

    return NextResponse.json({
      success: true,
      message: 'Tanggapan berhasil disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}