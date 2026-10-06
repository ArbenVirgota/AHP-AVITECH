// app/api/expert/profile/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('id') || searchParams.get('expert_id') || searchParams.get('token');

    if (!identifier) return NextResponse.json({ success: false, message: 'Parameter ID wajib disertakan.' }, { status: 400 });
    const cleanId = identifier.trim();

    let rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - experts\` WHERE \`expert_id\` = ? LIMIT 1`, cleanId);
    if (!rows || rows.length === 0) {
      const peRows: any[] = await prisma.$queryRawUnsafe(`SELECT expert_id FROM \`AHP - project_experts\` WHERE token = ? OR expert_id = ? LIMIT 1`, cleanId, cleanId);
      if (peRows && peRows.length > 0 && peRows[0].expert_id) {
        rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - experts\` WHERE \`expert_id\` = ? LIMIT 1`, String(peRows[0].expert_id).trim());
      }
    }

    if (!rows || rows.length === 0) return NextResponse.json({ success: false, message: 'Data pakar tidak ditemukan.' }, { status: 404 });
    const exp = rows[0];
    
    return NextResponse.json({
      success: true,
      data: {
        expert_id: exp.expert_id || cleanId,
        expert_name: exp.expert_name || exp.nama || '',
        gelar_depan: exp.gelar_depan || '',
        gelar_belakang: exp.gelar_belakang || '',
        expert_email: exp.expert_email || exp.email || '',
        expert_whatsapp: exp.expert_whatsapp || exp.whatsapp || '',
        asal_instansi: exp.asal_instansi || exp.instansi || '',
        pendidikan_terakhir: exp.pendidikan_terakhir || exp.pendidikan || '',
        bidang_keahlian: exp.bidang_keahlian || exp.keahlian || '',
        durasi_pengalaman: exp.durasi_pengalaman || exp.pengalaman || '',
        foto_url: exp.foto_url || exp.foto || '',
        portofolio_url: exp.portofolio_url || exp.portofolio || '',
        ktp_url: exp.ktp_url || exp.ktp || '',
        is_public: exp.is_public ?? 1
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Gagal membaca profil.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rawText = await request.text();
    if (!rawText) return NextResponse.json({ success: false, message: 'Payload data kosong.' }, { status: 400 });

    let body: any = {};
    try { body = JSON.parse(rawText); } catch { return NextResponse.json({ success: false, message: 'Format JSON tidak valid.' }, { status: 400 }); }

    const token = String(body.token || '').trim();
    const expertId = String(body.expert_id || body.expertid || body.id || '').trim();
    const expertName = String(body.expert_name || body.nama || '').trim();
    const gelarDepan = String(body.gelar_depan || '').trim();
    const gelarBelakang = String(body.gelar_belakang || '').trim();
    const expertEmail = String(body.expert_email || body.email || '').trim().toLowerCase();
    const expertWhatsapp = String(body.expert_whatsapp || body.whatsapp || '').trim();
    const asalInstansi = String(body.asal_instansi || body.instansi || '').trim();
    const pendidikanTerakhir = String(body.pendidikan_terakhir || body.pendidikan || '').trim();
    const bidangKeahlian = String(body.bidang_keahlian || body.keahlian || '').trim();
    const durasiPengalaman = String(body.durasi_pengalaman ?? body.pengalaman ?? '').trim();
    const ktpUrl = String(body.ktp_url || body.foto_ktp || '').trim();
    const fotoUrl = String(body.foto_url || body.foto || '').trim();
    const portofolioUrl = String(body.portofolio_url || body.portofolio || '').trim();
    const isPublic = body.is_public === 'PUBLIK' || body.is_public === true || body.is_public === 1 ? 1 : 0;

    if (!token && !expertId && !expertEmail) {
      return NextResponse.json({ success: false, message: 'Identitas pakar (ID/Email) tidak terdeteksi.' }, { status: 400 });
    }

    let resolvedExpertId = expertId;
    if (token) {
      const peRows: any[] = await prisma.$queryRawUnsafe(`SELECT expert_id FROM \`AHP - project_experts\` WHERE token = ? LIMIT 1`, token);
      if (peRows && peRows.length > 0 && peRows[0].expert_id) {
        resolvedExpertId = String(peRows[0].expert_id).trim();
        await prisma.$executeRawUnsafe(`UPDATE \`AHP - project_experts\` SET response_status = 'SELESAI', completed_at = NOW(), status = 'Selesai' WHERE token = ?`, token).catch(() => null);
      }
    }

    let masterRows: any[] = [];
    if (resolvedExpertId) {
      masterRows = await prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - experts\` WHERE \`expert_id\` = ? LIMIT 1`, resolvedExpertId);
    } else if (expertEmail) {
      masterRows = await prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - experts\` WHERE \`expert_email\` = ? LIMIT 1`, expertEmail);
    }

    const old = masterRows && masterRows.length > 0 ? masterRows[0] : {};
    const finalMasterId = String(old.expert_id || resolvedExpertId).trim();
    const finalEmail = String(expertEmail || old.expert_email || '').trim().toLowerCase();

    // 1. SIMPAN KE TABEL AHP - EXPERTS
    if (finalMasterId) {
      await prisma.$executeRawUnsafe(`
        UPDATE \`AHP - experts\`
        SET 
          gelar_depan = ?, expert_name = ?, gelar_belakang = ?, expert_email = ?, expert_whatsapp = ?,
          asal_instansi = ?, pendidikan_terakhir = ?, bidang_keahlian = ?, durasi_pengalaman = ?,
          ktp_url = ?, foto_url = ?, portofolio_url = ?, is_public = ?, updated_at = NOW()
        WHERE \`expert_id\` = ?
      `,
        gelarDepan || old.gelar_depan || '', expertName || old.expert_name || '', gelarBelakang || old.gelar_belakang || '', finalEmail,
        expertWhatsapp || old.expert_whatsapp || '', asalInstansi || old.asal_instansi || '', pendidikanTerakhir || old.pendidikan_terakhir || 'S2 / Magister',
        bidangKeahlian || old.bidang_keahlian || '', durasiPengalaman !== '' && durasiPengalaman !== '0' ? durasiPengalaman : (old.durasi_pengalaman || ''),
        ktpUrl || old.ktp_url || '', fotoUrl || old.foto_url || '', portofolioUrl || old.portofolio_url || '', isPublic, finalMasterId
      );
    }

    // 2. SINKRONISASI TIKET DENGAN MODE "RADAR DEBUG"
    if (!token && finalEmail) {
      try {
        const affectedRows = await prisma.$executeRawUnsafe(`
          UPDATE \`AHP - consultations\`
          SET \`Status\` = 'Selesai', \`Isi_Email\` = 'Otomatis Selesai'
          WHERE \`Expert Tujuan\` = ?
        `, finalEmail);

        if (affectedRows === 0) {
           return NextResponse.json({ 
             success: false, 
             message: `DEBUG DB: Profil tersimpan, TETAPI tiket untuk email [${finalEmail}] tidak ditemukan di tabel consultations.` 
           });
        }
      } catch (errConsult: any) {
        return NextResponse.json({ 
          success: false, 
          message: `DEBUG SQL ERROR: Gagal mengakses tabel AHP - consultations. Pesan error: ${errConsult.message}` 
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Profil dan status tiket berhasil diperbarui!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: `SERVER ERROR: ${error.message}` }, { status: 500 });
  }
}