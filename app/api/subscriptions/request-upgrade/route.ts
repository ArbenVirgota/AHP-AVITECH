// app/api/subscription/request-upgrade/route.ts
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
    const { plan, user_email, user_name, institusi, pesan_tambahan } = body;

    const cleanEmail = String(user_email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, message: 'Email pengguna tidak valid.' },
        { status: 400 }
      );
    }

    const planUpper = String(plan || 'PRO').toUpperCase().trim();
    const cleanName = String(user_name || cleanEmail).trim();
    const cleanInstitusi = String(institusi || 'Umum / Peneliti').trim();

    // Buat tiket ID unik format: PRICING-SUP-{timestamp}
    const ticketId = `PRICING-SUP-${Date.now()}`;
    const expertId = 'ADMIN-PRICING';
    const expertEmail = 'admin@avitech.cloud';

    const isiPertanyaan = pesan_tambahan
      ? `[Peminatan Plan: ${planUpper} Semester Pass] ${pesan_tambahan}`
      : `[Peminatan Plan: ${planUpper} Semester Pass] Halo Admin, saya berminat untuk upgrade ke paket ${planUpper}. Mohon petunjuk instruksi aktivasi lisensinya.`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO \`AHP - ConsultationRequests\` 
        (\`ticket_id\`, \`expert_id\`, \`expert_email\`, \`user_name\`, \`user_email\`, \`asal_institusi\`, \`pertanyaan\`, \`status\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NOW())`,
      ticketId,
      expertId,
      expertEmail,
      cleanName,
      cleanEmail,
      cleanInstitusi,
      isiPertanyaan
    );

    return NextResponse.json({
      success: true,
      message: `Tiket permohonan koordinasi untuk aktivasi Paket ${planUpper} telah berhasil dikirim ke Administrator. Tim admin akan segera menindaklanjuti permohonan Anda.`,
      ticket_id: ticketId,
    });
  } catch (error: any) {
    console.error('Error request upgrade plan:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengirim permohonan upgrade.' },
      { status: 500 }
    );
  }
}