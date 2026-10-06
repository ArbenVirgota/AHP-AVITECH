// app/api/consultations/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    let query = `
      SELECT 
        \`ticket_id\`,
        \`expert_id\`,
        \`expert_email\`,
        \`user_name\`,
        \`user_email\`,
        \`asal_institusi\`,
        \`pertanyaan\`,
        \`status\`,
        \`created_at\`,
        COALESCE(\`jawaban_expert\`, '') AS \`jawaban_expert\`,
        COALESCE(\`lampiran\`, '') AS \`lampiran\`
      FROM \`AHP - ConsultationRequests\`
    `;

    const params: any[] = [];
    if (emailParam) {
      query += ` WHERE LOWER(TRIM(\`user_email\`)) = ?`;
      params.push(emailParam.trim().toLowerCase());
    }

    query += ` ORDER BY \`created_at\` DESC`;

    const tickets: any[] = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json({
      success: true,
      data: tickets.map((t) => ({
        ticket_id: t.ticket_id,
        idTiket: t.ticket_id,
        user_name: t.user_name,
        namaUser: t.user_name,
        user_email: t.user_email,
        kontakUser: t.user_email,
        expert_tujuan: t.expert_email || t.expert_id,
        expertTujuan: t.expert_email || t.expert_id,
        topik_pesan: t.asal_institusi || 'Konsultasi Riset / Upgrade Paket',
        topikPesan: t.asal_institusi || 'Konsultasi Riset / Upgrade Paket',
        pertanyaan: t.pertanyaan,
        jawaban_expert: t.jawaban_expert,
        jawabanExpert: t.jawaban_expert,
        status: t.status || 'open',
        created_at: t.created_at,
        lampiran: t.lampiran,
      })),
    });
  } catch (error: any) {
    console.error('Error GET consultations:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memuat konsultasi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { ticket_id, lampiran, pertanyaan, user_email, user_name } = body;

    const cleanTicketId = String(ticket_id || '').trim();

    // 🟢 1. JIKA PENGGUNA MENGUNGGAH BUKTI TRANSFER TIKET
    if (cleanTicketId) {
      await prisma.$executeRawUnsafe(
        `UPDATE \`AHP - ConsultationRequests\`
         SET 
           \`lampiran\` = ?,
           \`status\` = 'Sedang Diverifikasi'
         WHERE LOWER(TRIM(\`ticket_id\`)) = LOWER(TRIM(?))`,
        lampiran || '',
        cleanTicketId
      );

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
           VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 'Sistem Mandiri', ?, 'User', 'UPLOAD_BUKTI_BAYAR', ?)`,
          String(user_email || '').trim().toLowerCase(),
          `User mengunggah bukti transfer untuk tiket #${cleanTicketId}`
        );
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Bukti transfer berhasil disimpan dan sedang diverifikasi oleh admin.',
        ticket_id: cleanTicketId,
      });
    }

    // 🟢 2. JIKA PEMBUATAN TIKET BARU BIASA
    const newTicketId = `REQ-${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`AHP - ConsultationRequests\`
        (\`ticket_id\`, \`expert_id\`, \`expert_email\`, \`user_name\`, \`user_email\`, \`asal_institusi\`, \`pertanyaan\`, \`lampiran\`, \`status\`, \`created_at\`)
       VALUES (?, 'ADMIN-PRICING', 'admin@avitech.cloud', ?, ?, 'Umum', ?, ?, 'Menunggu', NOW())`,
      newTicketId,
      user_name || 'User',
      String(user_email || '').trim().toLowerCase(),
      pertanyaan || '-',
      lampiran || ''
    );

    return NextResponse.json({
      success: true,
      message: 'Tiket berhasil diajukan.',
      ticket_id: newTicketId,
    });
  } catch (error: any) {
    console.error('Error POST consultations:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memproses permohonan.' },
      { status: 500 }
    );
  }
}