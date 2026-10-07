// app/api/expert-directory/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    // 🟢 Ambil data pakar PUBLIK & Aktif serta hubungkan dengan tabel ulasan (AHP - expert_reviews)
    // 🟢 Kecualikan semua pakar PRIVAT, bertipe SIMULASI, serta Prof. Linglungan dan DR. Raos
    let rawExperts: any[] = [];
    try {
      rawExperts = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          e.\`expert_id\`,
          e.\`gelar_depan\`,
          e.\`expert_name\`,
          e.\`gelar_belakang\`,
          e.\`expert_email\`,
          e.\`expert_whatsapp\`,
          e.\`asal_instansi\`,
          e.\`pendidikan_terakhir\`,
          e.\`bidang_keahlian\`,
          e.\`durasi_pengalaman\`,
          e.\`foto_url\`,
          e.\`ktp_url\`,
          e.\`is_public\`,
          e.\`status\`,
          COALESCE(rev.\`average_rating\`, 0) AS \`average_rating\`,
          COALESCE(rev.\`total_reviews\`, 0) AS \`total_reviews\`
        FROM \`AHP - experts\` e
        LEFT JOIN (
          SELECT 
            \`expert_id\`,
            ROUND(AVG(COALESCE(\`rating_rata\`, (\`aspek_kompetensi\` + \`aspek_responsif\` + \`aspek_ketepatan\`) / 3.0)), 1) AS \`average_rating\`,
            COUNT(\`review_id\`) AS \`total_reviews\`
          FROM \`AHP - expert_reviews\`
          GROUP BY \`expert_id\`
        ) rev ON e.\`expert_id\` = rev.\`expert_id\`
        WHERE UPPER(TRIM(COALESCE(e.\`is_public\`, ''))) IN ('PUBLIK', '1', 'TRUE', 'YA')
          AND LOWER(TRIM(COALESCE(e.\`status\`, ''))) = 'aktif'
          AND UPPER(TRIM(COALESCE(e.\`source\`, ''))) != 'SIMULASI'
          AND LOWER(TRIM(COALESCE(e.\`expert_email\`, ''))) NOT IN ('pakar1@gmail.com', 'pakar2@gmail.com')
          AND LOWER(COALESCE(e.\`expert_name\`, '')) NOT LIKE '%linglungan%'
          AND LOWER(COALESCE(e.\`expert_name\`, '')) NOT LIKE '%raos%'
        ORDER BY \`average_rating\` DESC, e.\`expert_name\` ASC
      `);
    } catch {
      // Cadangan apabila tabel ulasan belum tersedia di lingkungan lokal
      rawExperts = await prisma.$queryRawUnsafe<any[]>(`
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
          \`status\`,
          0 AS \`average_rating\`,
          0 AS \`total_reviews\`
        FROM \`AHP - experts\`
        WHERE UPPER(TRIM(COALESCE(\`is_public\`, ''))) IN ('PUBLIK', '1', 'TRUE', 'YA')
          AND LOWER(TRIM(COALESCE(\`status\`, ''))) = 'aktif'
          AND UPPER(TRIM(COALESCE(\`source\`, ''))) != 'SIMULASI'
          AND LOWER(TRIM(COALESCE(\`expert_email\`, ''))) NOT IN ('pakar1@gmail.com', 'pakar2@gmail.com')
          AND LOWER(COALESCE(\`expert_name\`, '')) NOT LIKE '%linglungan%'
          AND LOWER(COALESCE(\`expert_name\`, '')) NOT LIKE '%raos%'
        ORDER BY \`expert_name\` ASC
      `).catch(() => []);
    }

    const formattedExperts = (rawExperts || []).map((e: any) => {
      const gD = String(e.gelar_depan || e.gelardepan || '').trim();
      const gB = String(e.gelar_belakang || e.gelarbelakang || '').trim();
      const nameCore = String(e.expert_name || e.expertname || e.nama || 'Pakar').trim();

      let fullName = nameCore;
      if (gD && !fullName.toLowerCase().startsWith(gD.toLowerCase())) fullName = `${gD} ${fullName}`;
      if (gB && !fullName.toLowerCase().endsWith(gB.toLowerCase())) fullName = `${fullName}, ${gB}`;

      // Mempertahankan teks pengalaman asli (misal: "3 - 5 Tahun", "Lebih dari 10 Tahun")
      let expDurationRaw = (e.durasi_pengalaman ?? e.durasipengalaman ?? '').toString().trim();
      if (expDurationRaw.endsWith(',00')) {
        expDurationRaw = expDurationRaw.replace(/,00$/, '').trim();
      }

      const avgRating = Number(e.average_rating) || 0;
      const totalReviews = Number(e.total_reviews) || 0;

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
        durasi_pengalaman: expDurationRaw,
        pengalaman: expDurationRaw,
        foto_url: String(e.foto_url || e.fotourl || e.foto || '').trim(),
        status: String(e.status || 'Aktif').trim(),
        average_rating: avgRating,
        total_reviews: totalReviews,
        is_public: true,
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