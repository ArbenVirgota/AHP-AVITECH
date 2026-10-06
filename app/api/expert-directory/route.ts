// app/api/expert-directory/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    // 🟢 Ambil HANYA pakar PUBLIK & Aktif
    // 🟢 Kecualikan semua pakar PRIVAT, bertipe SIMULASI, serta Prof. Linglungan dan DR. Raos
    const rawExperts: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        \`expert_id\`,
        \`gelar_depan\`,
        \`expert_name\`,
        \`gelar_belakang\`,
        \`expert_email\`,
        \`expert_whatsapp\`,
        \`asal_instansi\`,
        \`pendidikan_terakhir\`,
        \`bidang_keahlian\`,
        \`durasi_pengalaman\`,
        \`foto_url\`,
        \`ktp_url\`,
        \`is_public\`,
        \`status\`
      FROM \`AHP - experts\`
      WHERE UPPER(TRIM(COALESCE(\`is_public\`, ''))) IN ('PUBLIK', '1', 'TRUE', 'YA')
        AND LOWER(TRIM(COALESCE(\`status\`, ''))) = 'aktif'
        AND UPPER(TRIM(COALESCE(\`source\`, ''))) != 'SIMULASI'
        AND LOWER(TRIM(COALESCE(\`expert_email\`, ''))) NOT IN ('pakar1@gmail.com', 'pakar2@gmail.com')
        AND LOWER(COALESCE(\`expert_name\`, '')) NOT LIKE '%linglungan%'
        AND LOWER(COALESCE(\`expert_name\`, '')) NOT LIKE '%raos%'
      ORDER BY \`expert_name\` ASC
    `).catch(() => []);

    const formattedExperts = (rawExperts || []).map((e: any) => {
      const gD = String(e.gelar_depan || e.gelardepan || '').trim();
      const gB = String(e.gelar_belakang || e.gelarbelakang || '').trim();
      const nameCore = String(e.expert_name || e.expertname || e.nama || 'Pakar').trim();

      let fullName = nameCore;
      if (gD && !fullName.toLowerCase().startsWith(gD.toLowerCase())) fullName = `${gD} ${fullName}`;
      if (gB && !fullName.toLowerCase().endsWith(gB.toLowerCase())) fullName = `${fullName}, ${gB}`;

      return {
        ...e,
        id: String(e.expert_id || ''),
        expert_id: String(e.expert_id || ''),
        expertname: nameCore,
        expert_name: nameCore,
        nama: nameCore,
        fullName: fullName,
        full_name: fullName,
        gelar_depan: gD,
        gelar_belakang: gB,
        asalinstansi: String(e.asal_instansi || e.asalinstansi || e.instansi || '-').trim(),
        expertemail: String(e.expert_email || e.expertemail || '').trim(),
        expertwhatsapp: String(e.expert_whatsapp || e.expertwhatsapp || '').trim(),
        pendidikanterakhir: String(e.pendidikan_terakhir || e.pendidikanterakhir || '').trim(),
        bidangkeahlian: String(e.bidang_keahlian || e.bidangkeahlian || 'Umum').trim(),
        durasi_pengalaman: Number(e.durasi_pengalaman || e.durasipengalaman || 0),
        foto_url: String(e.foto_url || e.fotourl || e.foto || '').trim(),
        status: String(e.status || 'Aktif').trim(),
        is_public: true, // Dipastikan murni publik
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedExperts,
      total: formattedExperts.length,
    });
  } catch (error: any) {
    console.error('Error fetching expert directory:', error);
    return NextResponse.json(
      { success: false, message: error.message, data: [] },
      { status: 500 }
    );
  }
}