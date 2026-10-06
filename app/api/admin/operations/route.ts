// app/api/admin/operations/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
// Inisialisasi Prisma paling standar, tanpa parameter log custom agar anti-crash
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const [
      rawExperts, rawUsers, rawProducts, rawConsultationRequests,
      rawConsultationsLegacy, rawFeedbacks, rawVisitorLogs
    ] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`SELECT \`expert_id\`, \`gelar_depan\`, \`expert_name\`, \`gelar_belakang\`, \`expert_email\`, \`expert_whatsapp\`, \`asal_instansi\`, \`pendidikan_terakhir\`, \`bidang_keahlian\`, \`durasi_pengalaman\`, \`foto_url\`, \`portofolio_url\`, \`ktp_url\`, COALESCE(\`is_public\`, 1) AS \`is_public\`, COALESCE(\`status\`, 'Aktif') AS \`status\` FROM \`AHP - experts\` ORDER BY \`expert_name\` ASC`).catch(() => []),
      (async () => {
        try { return await prisma.$queryRawUnsafe<any[]>(`SELECT \`user_id\`, \`nama\`, \`email\`, \`status_user\`, \`institusi\`, \`status\`, UPPER(COALESCE(\`plan\`, 'FREE')) AS \`plan\` FROM \`AHP - users\` ORDER BY \`user_id\` DESC`); }
        catch {
          try { return await prisma.$queryRawUnsafe<any[]>(`SELECT \`user_id\`, \`nama\`, \`email\`, \`status_user\`, \`institusi\`, \`status\`, UPPER(COALESCE(\`plan\`, 'FREE')) AS \`plan\` FROM \`AHP - Users\` ORDER BY \`user_id\` DESC`); } catch { return []; }
        }
      })(),
      prisma.$queryRawUnsafe<any[]>(`SELECT \`ID_Produk\`, \`Nama_Produk\`, \`Deskripsi\`, \`Status\`, \`Kategori\`, \`Link\`, \`Image_URL\` FROM \`AHP - Products\` ORDER BY \`ID_Produk\` DESC`).catch(() => []),
      prisma.$queryRawUnsafe<any[]>(`SELECT \`ticket_id\`, \`expert_id\`, \`expert_email\`, \`user_name\`, \`user_email\`, \`asal_institusi\`, \`pertanyaan\`, \`status\`, \`jawaban_expert\`, \`lampiran\`, COALESCE(NULLIF(DATE_FORMAT(\`created_at\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')) AS \`created_at\` FROM \`AHP - ConsultationRequests\` ORDER BY \`created_at\` DESC`).catch(() => []),
      prisma.$queryRawUnsafe<any[]>(`SELECT \`ID Tiket\` AS \`ID_Tiket\`, \`Nama User\` AS \`Nama_User\`, \`Kontak User\` AS \`Kontak_User\`, \`Expert Tujuan\` AS \`Expert_Tujuan\`, \`Topik Pesan\` AS \`Topik_Pesan\`, \`Status\`, \`Isi_Email\`, COALESCE(NULLIF(DATE_FORMAT(\`Tanggal Dibuat\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')) AS \`Tanggal_Dibuat\` FROM \`AHP - consultations\` ORDER BY \`Tanggal Dibuat\` DESC`).catch(() => []),
      (async () => { try { const rawFb: any[] = await prisma.$queryRawUnsafe(`SELECT \`id\`, \`Nama\`, \`Email\`, \`Kategori\`, \`Pesan\`, COALESCE(\`Sentimen\`, 'NETRAL') AS \`Sentimen\`, COALESCE(NULLIF(DATE_FORMAT(\`Timestamp\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')) AS \`safe_timestamp\` FROM \`AHP - Feedback\` ORDER BY \`Timestamp\` DESC`); return (rawFb || []).map((f) => ({ id: f.id, nama: f.Nama, email: f.Email, kategori: f.Kategori, pesan: f.Pesan, sentiment: f.Sentimen, timestamp: f.safe_timestamp })); } catch { return []; } })(),
      (async () => { try { const logs: any[] = await prisma.$queryRawUnsafe(`SELECT \`id\`, COALESCE(NULLIF(DATE_FORMAT(\`timestamp\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')) AS \`safe_timestamp\`, \`user_email\` AS \`email\`, COALESCE(\`visitor_name\`, 'Visitor Umum') AS \`visitor_name\`, \`page_path\` AS \`page\`, \`ip_address\` FROM \`AHP - visitor_logs\` ORDER BY \`id\` DESC LIMIT 500`); return (logs || []).map((row) => { const email = String(row.email || 'Visitor Umum').trim(); const page = String(row.page || '/').trim(); return { id: Number(row.id), timestamp: row.safe_timestamp, email: email, name: String(row.visitor_name || 'Visitor Umum').trim(), page: page, ip_address: row.ip_address || '127.0.0.1', role: email.toLowerCase().includes('admin') || page.startsWith('/admin') ? 'admin' : (email !== 'Visitor Umum' && email !== '' ? 'user' : 'guest') }; }); } catch { return []; } })(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        experts: (rawExperts || []).map((exp: any) => ({ ...exp, is_public: exp.is_public === 1 || String(exp.is_public).toUpperCase() === 'PUBLIK' ? 'PUBLIK' : 'PRIVAT', status: exp.status || 'Aktif' })),
        users: rawUsers || [],
        products: (rawProducts || []).map((p: any) => ({ id: p.ID_Produk, nama: p.Nama_Produk, deskripsi: p.Deskripsi, status: p.Status, kategori: p.Kategori, link: p.Link, imageurl: p.Image_URL })),
        userConsultations: (rawConsultationRequests || []).map((c: any) => ({ ticket_id: c.ticket_id, expert_id: c.expert_id, expert_email: c.expert_email, user_name: c.user_name, user_email: c.user_email, asal_institusi: c.asal_institusi, pertanyaan: c.pertanyaan, status: c.status, jawaban_expert: c.jawaban_expert, lampiran: c.lampiran, created_at: c.created_at })),
        adminConsultations: (rawConsultationsLegacy || []).map((c: any) => ({ ticket_id: c.ID_Tiket, admin_name: c.Nama_User, expert_email: c.Expert_Tujuan, pertanyaan: c.Topik_Pesan, status: c.Status, jawaban_expert: c.Isi_Email, created_at: c.Tanggal_Dibuat })),
        feedbacks: rawFeedbacks || [], visitorStats: rawVisitorLogs || [], totalVisits: (rawVisitorLogs || []).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Gagal memuat data operasi admin.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    if (!bodyText) return NextResponse.json({ success: false, message: 'Payload kosong' }, { status: 400 });
    
    let body;
    try { body = JSON.parse(bodyText); } catch { return NextResponse.json({ success: false, message: 'Format JSON tidak valid' }, { status: 400 }); }

    const action = body.action ? String(body.action).trim().toLowerCase() : '';

    if (action === 'updateconsultationstatus') {
      const { ticket_id, new_status } = body;
      await prisma.$executeRawUnsafe('UPDATE `AHP - ConsultationRequests` SET `status` = ? WHERE `ticket`_id = ?', new_status, ticket_id).catch(() => {});
      await prisma.$executeRawUnsafe('UPDATE `AHP - consultations` SET `Status` = ? WHERE `ID Tiket` = ?', new_status, ticket_id).catch(() => {});
      return NextResponse.json({ success: true, message: 'Status tiket berhasil diperbarui.' });
    }

    if (action === 'submitconsultationreply') {
      const { ticket_id, reply_message, status } = body;
      await prisma.$executeRawUnsafe('UPDATE `AHP - ConsultationRequests` SET `jawaban_expert` = ?, `status` = ? WHERE `ticket_id` = ?', reply_message || '', status || 'Selesai', ticket_id).catch(() => {});
      await prisma.$executeRawUnsafe('UPDATE `AHP - consultations` SET `Isi_Email` = ?, `Status` = ? WHERE `ID Tiket` = ?', reply_message || '', status || 'Selesai', ticket_id).catch(() => {});
      return NextResponse.json({ success: true, message: 'Tanggapan tiket berhasil disimpan.' });
    }

    if (action === 'admin_update_user_plan') {
      const { email, plan } = body;
      try { await prisma.$executeRawUnsafe('UPDATE `AHP - users` SET `plan` = ? WHERE LOWER(`email`) = ?', String(plan).toUpperCase(), String(email).trim().toLowerCase()); } 
      catch { await prisma.$executeRawUnsafe('UPDATE `AHP - Users` SET `plan` = ? WHERE LOWER(`email`) = ?', String(plan).toUpperCase(), String(email).trim().toLowerCase()).catch(() => {}); }
      return NextResponse.json({ success: true, message: 'Paket pengguna berhasil diubah.' });
    }

    if (action === 'admin_update_user_password') {
      const { email, new_password } = body;
      const hashedPassword = await bcrypt.hash(String(new_password).trim(), 10);
      try { await prisma.$executeRawUnsafe('UPDATE `AHP - users` SET `password_hash` = ? WHERE LOWER(`email`) = ?', hashedPassword, String(email).trim().toLowerCase()); } 
      catch { await prisma.$executeRawUnsafe('UPDATE `AHP - Users` SET `password_hash` = ? WHERE LOWER(`email`) = ?', hashedPassword, String(email).trim().toLowerCase()).catch(() => {}); }
      return NextResponse.json({ success: true, message: 'Kata sandi berhasil direset.' });
    }

    // PENANGANAN SIMPAN / UPDATE / TAMBAH DATA PAKAR (MENCAKUP SEMUA VARIASI NAMA ACTION)
    if (
      action === 'update_expert' || 
      action === 'save_expert' || 
      action === 'add_expert' || 
      action === 'edit_expert' || 
      action === 'saveexpert' || 
      action === 'editexpert' || 
      action === 'updateexpert' ||
      action.includes('expert')
    ) {
      const { expert_id, gelar_depan, expert_name, gelar_belakang, expert_email, asal_instansi, expert_whatsapp, pendidikan_terakhir, bidang_keahlian, durasi_pengalaman, status, is_public, foto_url } = body;

      const isPublicVal = String(is_public).toUpperCase() === 'PUBLIK' || is_public === 1 || is_public === true ? 1 : 0;
      const safeExpertName = expert_name ? String(expert_name).trim() : '';
      const safeExpertEmail = expert_email ? String(expert_email).trim() : '';

      if (!safeExpertName || !safeExpertEmail) {
        return NextResponse.json({ success: false, message: 'Nama Pakar dan Email Pakar wajib diisi.' }, { status: 400 });
      }

      try {
        if (expert_id) {
          // Update data pakar yang sudah ada
          await prisma.$executeRawUnsafe(`
            UPDATE \`AHP - experts\` 
            SET \`gelar_depan\` = ?, \`expert_name\` = ?, \`gelar_belakang\` = ?, \`expert_email\` = ?, \`asal_instansi\` = ?, \`expert_whatsapp\` = ?, \`pendidikan_terakhir\` = ?, \`bidang_keahlian\` = ?, \`durasi_pengalaman\` = ?, \`status\` = ?, \`is_public\` = ?
            WHERE \`expert_id\` = ?
          `, 
          gelar_depan || '', 
          safeExpertName, 
          gelar_belakang || '', 
          safeExpertEmail, 
          asal_instansi || '', 
          expert_whatsapp || '', 
          pendidikan_terakhir || '', 
          bidang_keahlian || '', 
          durasi_pengalaman || '', 
          status || 'Aktif', 
          isPublicVal, 
          expert_id
          );
          
          return NextResponse.json({ success: true, message: 'Data pakar berhasil diperbarui.' });
        } else {
          // Tambah data pakar baru
          const newId = `EXP-${Date.now()}`;
          await prisma.$executeRawUnsafe(`
            INSERT INTO \`AHP - experts\` (\`expert_id\`, \`gelar_depan\`, \`expert_name\`, \`gelar_belakang\`, \`expert_email\`, \`asal_instansi\`, \`expert_whatsapp\`, \`pendidikan_terakhir\`, \`bidang_keahlian\`, \`durasi_pengalaman\`, \`status\`, \`is_public\`, \`foto_url\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, 
          newId, 
          gelar_depan || '', 
          safeExpertName, 
          gelar_belakang || '', 
          safeExpertEmail, 
          asal_instansi || '', 
          expert_whatsapp || '', 
          pendidikan_terakhir || '', 
          bidang_keahlian || '', 
          durasi_pengalaman || '', 
          status || 'Aktif', 
          isPublicVal, 
          foto_url || ''
          );

          return NextResponse.json({ success: true, message: 'Pakar baru berhasil ditambahkan.' });
        }
      } catch (dbError: any) {
        return NextResponse.json({ success: false, message: `Gagal database: ${dbError.message}` }, { status: 400 });
      }
    }

    // 7. CATAT RIWAYAT PENGIRIMAN LINK 
    if (action === 'record_admin_note') {
      const { expert_email, admin_name, message, note_body, textBody } = body;
      const ticketId = `ADM-${Math.floor(100000 + Math.random() * 900000)}`;
      const teksInstruksi = String(message || note_body || textBody || '[VERIFIKASI] Kelengkapan Data Pakar').trim();

      const expertRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT expert_id FROM \`AHP - experts\` WHERE LOWER(TRIM(\`expert_email\`)) = LOWER(?) LIMIT 1
      `, expert_email);
      const expertId = expertRows.length > 0 && expertRows[0].expert_id ? expertRows[0].expert_id : '';

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const updateLink = expertId ? `${baseUrl}/expert/update-profile?id=${expertId}` : `${baseUrl}/expert/update-profile`;
      const finalTopikPesan = `${teksInstruksi}\n\nTautan Pembaruan:\n${updateLink}`;

      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - consultations\` (\`ID Tiket\`, \`Nama User\`, \`Kontak User\`, \`Expert Tujuan\`, \`Topik Pesan\`, \`Status\`, \`Isi_Email\`, \`Tanggal Dibuat\`)
        VALUES (?, ?, 'admin@avitech.cloud', ?, ?, 'Menunggu', NULL, NOW())
      `, ticketId, admin_name || 'Super Administrator', expert_email, finalTopikPesan);

      return NextResponse.json({ success: true, message: 'Tautan berbasis Expert ID berhasil dibuat dan dicatat.' });
    }

    if (action === 'deleteuser') {
      try { await prisma.$executeRawUnsafe('DELETE FROM `AHP - users` WHERE LOWER(`email`) = ?', String(body.email).trim().toLowerCase()); } 
      catch { await prisma.$executeRawUnsafe('DELETE FROM `AHP - Users` WHERE LOWER(`email`) = ?', String(body.email).trim().toLowerCase()).catch(() => {}); }
      return NextResponse.json({ success: true, message: 'User berhasil dihapus.' });
    }

    if (action === 'deleteexpert') {
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - experts` WHERE `expert_id` = ?', body.expertId);
      return NextResponse.json({ success: true, message: 'Pakar berhasil dihapus.' });
    }

    if (action === 'deleteproduct') {
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - Products` WHERE `ID_Produk` = ?', body.productId);
      return NextResponse.json({ success: true, message: 'Produk berhasil dihapus.' });
    }

    if (action === 'deleteconsultation') {
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - ConsultationRequests` WHERE `ticket_id` = ?', body.ticket_id);
      await prisma.$executeRawUnsafe('DELETE FROM `AHP - consultations` WHERE `ID Tiket` = ?', body.ticket_id);
      return NextResponse.json({ success: true, message: 'Tiket berhasil dihapus.' });
    }

    return NextResponse.json({ success: false, message: `Action '${action}' tidak dikenali atau diabaikan.` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Gagal memproses.' }, { status: 500 });
  }
}