// app/api/expert/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function sanitizeSignatureUrl(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str === 'null' || str === 'undefined') return '';
  if (str.startsWith('data:image/')) return str;
  if (str.includes('drive.google.com')) {
    const fileIdMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
    }
  }
  return str;
}

// 🟢 1. HANDLER GET: MENGAMBIL DATA PAKAR ATAU DIREKTORI
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token')?.trim();

    // KASUS TOKEN KUESIONER PAKAR
    if (token) {
      const peRows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM `AHP - project_experts` WHERE `token` = ? OR TRIM(`token`) = ? LIMIT 1',
        token, token
      ).catch(() => []);

      if (!peRows || peRows.length === 0) {
        return NextResponse.json({ success: false, message: 'Token kuesioner tidak valid.' }, { status: 404 });
      }

      const pe = peRows[0];
      const projectId = String(pe.project_id || '').trim();
      const expertId = String(pe.expert_id || '').trim();

      const projectRows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM `AHP - projects` WHERE `project_id` = ? LIMIT 1', projectId).catch(() => []);
      const project = projectRows && projectRows.length > 0 ? projectRows[0] : null;

      const expertRows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM `AHP - experts` WHERE `expert_id` = ? LIMIT 1', expertId).catch(() => []);
      let expert = expertRows && expertRows.length > 0 ? expertRows[0] : null;

      if (!expert) {
        expert = { id: expertId, expert_id: expertId, expert_name: 'Pakar Simulasi', status: 'Aktif', is_public: false };
      }

      const [criteriaRows, subcriteriaRows, alternativeRows, responseRows] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>('SELECT * FROM `AHP - criteria` WHERE `project_id` = ? ORDER BY `urutan` ASC', projectId).catch(() => []),
        prisma.$queryRawUnsafe<any[]>('SELECT * FROM `AHP - subcriteria` WHERE `project_id` = ? ORDER BY `urutan` ASC', projectId).catch(() => []),
        prisma.$queryRawUnsafe<any[]>('SELECT * FROM `AHP - alternatives` WHERE `project_id` = ? ORDER BY `urutan` ASC', projectId).catch(() => []),
        prisma.$queryRawUnsafe<any[]>('SELECT * FROM `AHP - responses` WHERE `project_id` = ? AND `expert_id` = ? ORDER BY `id` ASC', projectId, expertId).catch(() => []),
      ]);

      await prisma.$executeRawUnsafe('UPDATE `AHP - project_experts` SET `opened_at` = NOW() WHERE `token` = ? AND `opened_at` IS NULL', token).catch(() => {});

      const bundlePayload = {
        token,
        expert,
        project: project || { id: projectId, project_id: projectId },
        criteria: criteriaRows,
        subcriteria: subcriteriaRows,
        alternatif: alternativeRows,
        responses: responseRows,
      };

      return NextResponse.json({ success: true, data: bundlePayload, ...bundlePayload });
    }

    // KASUS DIREKTORI PAKAR PUBLIK
    const rawExperts: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM \`AHP - experts\`
      WHERE UPPER(TRIM(COALESCE(\`is_public\`, ''))) IN ('PUBLIK', '1', 'TRUE', 'YA')
        AND LOWER(TRIM(COALESCE(\`status\`, ''))) = 'aktif'
      ORDER BY \`expert_name\` ASC
    `).catch(() => []);

    return NextResponse.json({ success: true, data: rawExperts, total: rawExperts.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message, data: [] }, { status: 500 });
  }
}

// 🟢 2. HANDLER POST: SIMPAN PENDAFTARAN PAKAR & RESPON KUESIONER
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // =========================================================================
    // CABANG A: PENDAFTARAN PAKAR BARU DARI HALAMAN DIREKTORI
    // =========================================================================
    if (body.expert_email && body.expert_name && body.bidang_keahlian) {
      
      // 🔮 PERSIAPAN OTOMATISASI DIDIT.ME (KYC / Verifikasi KTP)
      let isDiditActive = false;
      let diditApiKey = '';

      try {
        // Mengambil pengaturan dari database (menggunakan backtick untuk kata kunci 'Key' di MySQL)
        const diditSettings: any[] = await prisma.$queryRawUnsafe(`
          SELECT \`Key\`, \`Value\`
          FROM \`AHP - didit_settings\`
          WHERE \`Key\` IN ('didit_me_active', 'didit_api_key')
        `);

        diditSettings.forEach(row => {
          if (row.Key === 'didit_me_active') {
            isDiditActive = (row.Value === '1' || row.Value === 'true' || row.Value === 'aktif');
          }
          if (row.Key === 'didit_api_key') {
            diditApiKey = row.Value || '';
          }
        });
      } catch (dbErr) {
        console.warn('Gagal mengambil pengaturan Didit.me dari database:', dbErr);
      }

      // Eksekusi validasi Didit jika status aktif dan API Key tersedia
      if (isDiditActive && diditApiKey && body.ktp_url) {
        try {
          // Contoh pemanggilan API Didit.me
          /*
          const diditRes = await fetch('https://api.didit.me/v1/verification/kyc', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${diditApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ document_image: body.ktp_url, expected_name: body.expert_name }),
          });
          const diditJson = await diditRes.json();
          if (!diditJson.success) {
            return NextResponse.json({ success: false, message: 'Verifikasi KTP via Didit.me gagal. KTP tidak valid.' }, { status: 400 });
          }
          */
        } catch (diditErr) {
          console.warn('Peringatan: Gagal menghubungi server Didit.me, dilanjutkan secara manual:', diditErr);
        }
      }

      const newExpertId = `EXP-${Date.now()}`;
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - experts\` (
          \`expert_id\`, \`gelar_depan\`, \`expert_name\`, \`gelar_belakang\`,
          \`expert_email\`, \`expert_whatsapp\`, \`asal_instansi\`, \`pendidikan_terakhir\`,
          \`bidang_keahlian\`, \`durasi_pengalaman\`, \`portofolio_url\`, \`ktp_url\`,
          \`foto_url\`, \`status\`, \`is_public\`, \`created_at\`, \`updated_at\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Aktif', 1, NOW(), NOW())
      `,
        newExpertId,
        String(body.gelar_depan || '').trim(),
        String(body.expert_name || '').trim(),
        String(body.gelar_belakang || '').trim(),
        String(body.expert_email || '').trim().toLowerCase(),
        String(body.expert_whatsapp || '').trim(),
        String(body.asal_instansi || '').trim(),
        String(body.pendidikan_terakhir || '').trim(),
        String(body.bidang_keahlian || '').trim(),
        String(body.durasi_pengalaman || '').trim(),
        String(body.portofolio_url || '').trim(),
        String(body.ktp_url || ''),
        String(body.foto_url || '')
      );

      return NextResponse.json({
        success: true,
        message: 'Pendaftaran pakar berhasil dicatat dan dipublikasikan di direktori.',
        expert_id: newExpertId,
      });
    }

    // =========================================================================
    // CABANG B: PENYIMPANAN RESPONS KUESIONER (AHP)
    // =========================================================================
    const {
      project_id, expert_id, expert_name, matrix_type, parent_id,
      parent_name, item_ids, item_names, matriks_json, cr, submitted_by,
    } = body;

    if (!project_id || !expert_id || !matrix_type || !matriks_json) {
      return NextResponse.json({ success: false, message: 'Data payload tidak dikenali sistem.' }, { status: 400 });
    }

    const responseId = `RESP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const matriksJsonStr = typeof matriks_json === 'string' ? matriks_json : JSON.stringify(matriks_json);
    const itemIdsStr = Array.isArray(item_ids) ? JSON.stringify(item_ids) : String(item_ids || '');
    const itemNamesStr = Array.isArray(item_names) ? JSON.stringify(item_names) : String(item_names || '');

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - responses\`
        (\`response_id\`, \`project_id\`, \`expert_id\`, \`expert_name\`, \`matrix_type\`, \`parent_id\`, \`parent_name\`, \`item_ids_json\`, \`item_names_json\`, \`matriks_json\`, \`original_matriks_json\`, \`cr\`, \`submitted_by\`, \`submitted_at\`, \`updated_at\`)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`matriks_json\` = VALUES(\`matriks_json\`),
        \`cr\` = VALUES(\`cr\`),
        \`updated_at\` = NOW()
    `,
      responseId, project_id, expert_id, expert_name || 'Pakar Responden', matrix_type, parent_id || '', parent_name || '', itemIdsStr, itemNamesStr, matriksJsonStr, matriksJsonStr, Number(cr || 0), submitted_by || 'Pakar Responden'
    );

    return NextResponse.json({ success: true, message: 'Respons perbandingan berhasil disimpan.', response_id: responseId });

  } catch (error: any) {
    console.error('Error di POST /api/expert:', error);
    return NextResponse.json({ success: false, message: error.message || 'Gagal menyimpan data.' }, { status: 500 });
  }
}