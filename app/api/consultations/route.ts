// app/api/consultations/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Konfigurasi kuota konsultasi (Sesi per pakar) sesuai Plan
const PLAN_CONSULTATION_LIMITS: Record<string, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 3,
  PLUS: 5,
  PREMIUM: 9999,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');

    let query = 'SELECT * FROM `AHP - ConsultationRequests`';
    const params: any[] = [];

    if (emailParam) {
      query += ' WHERE LOWER(TRIM(`user_email`)) = ?';
      params.push(emailParam.trim().toLowerCase());
    }

    query += ' ORDER BY `created_at` DESC';

    const rawTickets: any[] = await prisma.$queryRawUnsafe(query, ...params);

    const data = rawTickets.map((t) => ({
      ticket_id: t.ticket_id || t.idTiket || t.id || '-',
      idTiket: t.ticket_id || t.idTiket || t.id || '-',
      user_name: t.user_name || t.namaUser || 'User',
      namaUser: t.user_name || t.namaUser || 'User',
      user_email: t.user_email || t.kontakUser || '',
      kontakUser: t.user_email || t.kontakUser || '',
      expert_tujuan: t.expert_email || t.expert_id || t.expert_tujuan || 'Tim Administrator & Billing',
      expertTujuan: t.expert_email || t.expert_id || t.expert_tujuan || 'Tim Administrator & Billing',
      topik_pesan: t.asal_institusi || t.topik_pesan || 'Konsultasi Riset / Upgrade Paket',
      topikPesan: t.asal_institusi || t.topik_pesan || 'Konsultasi Riset / Upgrade Paket',
      pertanyaan: t.pertanyaan || t.topik_pesan || '',
      jawaban_expert: t.jawaban_expert || t.jawabanExpert || '',
      jawabanExpert: t.jawaban_expert || t.jawabanExpert || '',
      status: t.status || 'open',
      created_at: t.created_at || t.tanggal_dibuat || '',
      lampiran: t.lampiran || t.fileUrl || '',
      is_read_user: Number(t.is_read_user ?? 0),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error GET consultations:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memuat konsultasi.', data: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      ticket_id, 
      expert_id, 
      expert_email, 
      expert_name,
      user_name, 
      user_email, 
      asal_institusi, 
      pertanyaan, 
      lampiran,
      client_plan // Cadangan dari state frontend jika ada
    } = body;

    const cleanTicketId = String(ticket_id || '').trim();

    // =========================================================================
    // 1. UPDATE BUKTI TRANSFER UNTUK TIKET YANG SUDAH ADA
    // =========================================================================
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
        message: 'Bukti transfer berhasil disimpan dan sedang diverifikasi admin.',
        ticket_id: cleanTicketId,
      });
    }

    // =========================================================================
    // 2. PENGAJUAN KONSULTASI BARU (USER KE PAKAR)
    // =========================================================================
    const cleanUserEmail = String(user_email || '').trim().toLowerCase();
    const cleanExpertEmail = String(expert_email || '').trim().toLowerCase();
    const cleanUserName = String(user_name || 'Pengguna AHP').trim();
    const cleanInstitusi = String(asal_institusi || 'Umum / Akademik').trim();
    
    // 🟢 Hapus prefiks [Pakar: ...] jika ada, agar isi pesan murni pertanyaan riset
    const cleanPertanyaan = String(pertanyaan || '-')
      .replace(/^\[Pakar:[^\]]+\]\s*/i, '')
      .trim();

    const cleanExpertId = String(expert_id || 'EXPERT').trim();

    const isTargetingExpert = cleanExpertEmail !== 'admin@avitech.cloud' && !cleanExpertId.toUpperCase().startsWith('ADMIN');

    if (isTargetingExpert) {
      let detectedPlan = '';

      // 1. Cek tabel `AHP - subscriptions`
      try {
        const subRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT * FROM \`AHP - subscriptions\`
          WHERE (
            LOWER(TRIM(COALESCE(\`user_email\`, ''))) = ? 
            OR LOWER(TRIM(COALESCE(\`email\`, ''))) = ?
          )
          ORDER BY \`id\` DESC LIMIT 1
        `, cleanUserEmail, cleanUserEmail);

        if (subRows && subRows.length > 0) {
          const s = subRows[0];
          const rawPlan = s.plan || s.Plan || s.paket || s.nama_paket;
          const rawStatus = String(s.status || s.Status || '').toLowerCase();
          
          if (rawPlan && (!rawStatus || ['aktif', 'active', 'approved', 'diverifikasi', 'success', 'sukses'].includes(rawStatus))) {
            detectedPlan = String(rawPlan).toUpperCase().trim();
          }
        }
      } catch (err) {
        console.warn('Gagal membaca tabel subscriptions:', err);
      }

      // 2. Cek tabel `AHP - Users`
      if (!detectedPlan || detectedPlan === 'FREE') {
        try {
          const userRows: any[] = await prisma.$queryRawUnsafe(`
            SELECT * FROM \`AHP - Users\`
            WHERE LOWER(TRIM(\`email\`)) = ?
            LIMIT 1
          `, cleanUserEmail);

          if (userRows && userRows.length > 0) {
            const u = userRows[0];
            const p = u.plan || u.Plan || u.paket;
            if (p && String(p).toUpperCase().trim() !== 'FREE') {
              detectedPlan = String(p).toUpperCase().trim();
            }
          }
        } catch (err) {
          console.warn('Gagal membaca tabel Users:', err);
        }
      }

      // 3. Fallback client_plan dari frontend
      if (!detectedPlan || detectedPlan === 'FREE') {
        if (client_plan && String(client_plan).toUpperCase() !== 'FREE') {
          detectedPlan = String(client_plan).toUpperCase().trim();
        }
      }

      const finalPlan = detectedPlan || 'FREE';
      const maxLimit = PLAN_CONSULTATION_LIMITS[finalPlan] ?? 0;

      // 4. Hitung riwayat sesi ke pakar spesifik ini
      const countRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total FROM \`AHP - ConsultationRequests\`
        WHERE LOWER(TRIM(\`user_email\`)) = ?
          AND (
            LOWER(TRIM(\`expert_email\`)) = ?
            OR LOWER(TRIM(\`expert_id\`)) = ?
          )
      `, cleanUserEmail, cleanExpertEmail, cleanExpertId.toLowerCase());

      const usedCount = Number(countRows[0]?.total || 0);

      if (usedCount >= maxLimit) {
        return NextResponse.json({
          success: false,
          message: `Kuota konsultasi untuk Paket ${finalPlan} Anda telah mencapai batas (${usedCount}/${maxLimit} sesi untuk pakar ini). Silakan upgrade paket langganan Anda untuk mendapatkan kuota tambahan.`,
        }, { status: 403 });
      }
    }

    const newTicketId = `REQ-${Date.now()}`;

    // Simpan tiket baru ke database
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`AHP - ConsultationRequests\`
        (\`ticket_id\`, \`expert_id\`, \`expert_email\`, \`user_name\`, \`user_email\`, \`asal_institusi\`, \`pertanyaan\`, \`lampiran\`, \`status\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu', NOW())`,
      newTicketId,
      cleanExpertId,
      cleanExpertEmail || 'admin@avitech.cloud',
      cleanUserName,
      cleanUserEmail,
      cleanInstitusi,
      cleanPertanyaan,
      lampiran || ''
    );

    // =========================================================================
    // 3. KIRIM EMAIL NOTIFIKASI KE PAKAR
    // =========================================================================
    let emailStatus = 'skipped';
    if (cleanExpertEmail && cleanExpertEmail !== 'admin@avitech.cloud') {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const replyLink = `${baseUrl}/expert/consultation-reply?ticket_id=${encodeURIComponent(newTicketId)}`;

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
            <h2 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-top: 0;">Permohonan Konsultasi Riset Baru</h2>
            <p>Yth. <strong>${expert_name || 'Bapak/Ibu Pakar'}</strong>,</p>
            <p>Anda menerima permohonan konsultasi riset ilmiah baru melalui platform AHP Avitech dengan rincian berikut:</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 16px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr><td style="padding: 4px 0; font-weight: bold; width: 130px; color: #475569;">ID Tiket:</td><td><strong>#${newTicketId}</strong></td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #475569;">Nama Pemohon:</td><td>${cleanUserName}</td></tr>
                <tr><td style="padding: 4px 0; font-weight: bold; color: #475569;">Asal Instansi:</td><td>${cleanInstitusi}</td></tr>
              </table>
            </div>

            <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
              <div style="font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin-bottom: 4px;">Topik / Pertanyaan Riset:</div>
              <div style="font-size: 13.5px; color: #0f172a; white-space: pre-wrap;">${cleanPertanyaan}</div>
            </div>

            ${lampiran ? `<p style="font-size: 13px;">📎 <strong>Berkas Lampiran:</strong> <a href="${lampiran}" target="_blank" style="color: #2563eb;">Lihat Berkas Pendukung</a></p>` : ''}

            <p style="font-size: 13px; color: #334155; margin-top: 20px;">
              Mohon kesediaan Anda untuk meninjau pertanyaan di atas dan memberikan tanggapan ilmiah kepada pemohon melalui tautan berikut:
            </p>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${replyLink}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                ✍ Jawab / Balas Konsultasi Ini
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0; text-align: center;">
              Pemberitahuan otomatis dikirim oleh Platform Analytic Hierarchy Process (AHP) Avitech. Komunikasi dilayani melalui sistem aplikasi.
            </p>
          </div>
        `;

        await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanExpertEmail,
            subject: `[Konsultasi Riset #${newTicketId}] Pertanyaan Baru dari ${cleanUserName}`,
            textBody: `Konsultasi Baru #${newTicketId}\nDari: ${cleanUserName} (${cleanInstitusi})\nPertanyaan:\n${cleanPertanyaan}\n\nJawab melalui tautan: ${replyLink}`,
            htmlBody: htmlContent,
          }),
        });

        emailStatus = 'sent';
      } catch (mailErr: any) {
        console.error('Gagal memicu pengiriman email ke pakar:', mailErr);
        emailStatus = `failed: ${mailErr.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tiket konsultasi berhasil diajukan.',
      ticket_id: newTicketId,
      email_status: emailStatus,
    });
  } catch (error: any) {
    console.error('Error pengajuan konsultasi:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengajukan konsultasi.' },
      { status: 500 }
    );
  }
}