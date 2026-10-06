// app/api/projects/bundle/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function getSafeTableRows(tableName: string, whereClause: string = ''): Promise<any[]> {
  try {
    const colRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = '${tableName}' 
        AND DATA_TYPE NOT IN ('datetime', 'timestamp', 'date')
    `);

    if (!colRows || colRows.length === 0) return [];
    const safeCols = colRows.map((r: any) => `\`${r.COLUMN_NAME}\``).join(', ');
    return await prisma.$queryRawUnsafe(`SELECT ${safeCols} FROM \`${tableName}\` ${whereClause}`);
  } catch (err: any) {
    console.warn(`Query aman pada tabel ${tableName} dilewati:`, err.message);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = String(
      searchParams.get('id') ||
      searchParams.get('projectId') ||
      searchParams.get('project_id') ||
      ''
    ).trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: 'ID proyek wajib disertakan.' }, { status: 400 });
    }

    const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');

    // 1. Ambil data proyek utama
    const projectRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM \`AHP - projects\` 
      WHERE \`project_id\` = '${safeProjectId}' 
      LIMIT 1
    `).catch(() => []);

    if (!projectRows || projectRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Proyek dengan ID #${projectId} tidak ditemukan pada database.`,
      }, { status: 404 });
    }

    const prjRaw = projectRows[0];

    // 2. Ambil Kriteria, Subkriteria, Alternatif, Responden Pakar, dan Respons secara paralel
    const [criteriaRows, subcriteriaRows, alternativeRows, expertRows, responseRows]: [any[], any[], any[], any[], any[]] = await Promise.all([
      getSafeTableRows('AHP - criteria', `WHERE \`project_id\` = '${safeProjectId}' ORDER BY \`urutan\` ASC`).catch(() => []),
      getSafeTableRows('AHP - subcriteria', `WHERE \`project_id\` = '${safeProjectId}' ORDER BY \`urutan\` ASC`).catch(() => []),
      getSafeTableRows('AHP - alternatives', `WHERE \`project_id\` = '${safeProjectId}' ORDER BY \`urutan\` ASC`).catch(() => []),

      prisma.$queryRawUnsafe(`
        SELECT 
          pe.id,
          pe.project_id,
          pe.expert_id,
          pe.expert_index,
          pe.token,
          pe.status,
          pe.response_status,
          COALESCE(e.expert_name, pe.expert_id) AS expert_name,
          COALESCE(e.gelar_depan, '') AS gelar_depan,
          COALESCE(e.gelar_belakang, '') AS gelar_belakang,
          COALESCE(e.expert_email, '') AS expert_email,
          COALESCE(e.expert_whatsapp, '') AS expert_whatsapp,
          COALESCE(e.asal_instansi, '') AS asal_instansi,
          COALESCE(e.pendidikan_terakhir, '') AS pendidikan_terakhir,
          COALESCE(e.bidang_keahlian, '') AS bidang_keahlian,
          COALESCE(e.foto_url, '') AS foto_url
        FROM \`AHP - project_experts\` pe
        LEFT JOIN \`AHP - experts\` e ON pe.expert_id = e.expert_id
        WHERE pe.project_id = '${safeProjectId}'
        ORDER BY pe.expert_index ASC, pe.id ASC
      `).catch(() => []),

      getSafeTableRows('AHP - responses', `WHERE \`project_id\` = '${safeProjectId}'`).catch(() => []),
    ]);

    // 3. Normalisasi data pakar
    const formattedExperts = (expertRows || []).map((row: any, idx: number) => {
      const gD = String(row.gelar_depan || '').trim();
      const gB = String(row.gelar_belakang || '').trim();
      const nameCore = String(row.expert_name || `Pakar ${idx + 1}`).trim();

      let fullName = nameCore;
      if (gD && !fullName.toLowerCase().startsWith(gD.toLowerCase())) fullName = `${gD} ${fullName}`;
      if (gB && !fullName.toLowerCase().endsWith(gB.toLowerCase())) fullName = `${fullName}, ${gB}`;

      return {
        ...row,
        id: String(row.expert_id || row.id || `EXP-${idx + 1}`),
        expert_id: String(row.expert_id || ''),
        projectid: safeProjectId,
        expertindex: row.expert_index || idx + 1,
        expertname: fullName,
        expert_name: fullName,
        expertemail: String(row.expert_email || '').trim(),
        expertwhatsapp: String(row.expert_whatsapp || '').trim(),
        gelardepan: gD,
        gelarbelakang: gB,
        asalinstansi: String(row.asal_instansi || '-').trim(),
        pendidikanterakhir: String(row.pendidikan_terakhir || '-').trim(),
        bidangkeahlian: String(row.bidang_keahlian || 'Umum').trim(),
        foto_url: String(row.foto_url || '').trim(),
        token: String(row.token || ''),
        status: String(row.status || 'Aktif'),
        responsestatus: String(row.response_status || ''),
      };
    });

    // 4. Normalisasi data respons matriks (termasuk original matriks)
    const formattedResponses = (responseRows || []).map((r: any) => {
      let parsedItemNames: any[] = [];
      let parsedMatrix: any[] = [];
      let parsedOriginalMatrix: any[] = [];

      try {
        parsedItemNames = r.item_names_json ? JSON.parse(r.item_names_json) : [];
      } catch {
        parsedItemNames = [];
      }

      try {
        parsedMatrix = r.matriks_json ? JSON.parse(r.matriks_json) : (r.matriksjson ? JSON.parse(r.matriksjson) : []);
      } catch {
        parsedMatrix = [];
      }

      try {
        parsedOriginalMatrix = r.original_matriks_json
          ? JSON.parse(r.original_matriks_json)
          : (r.originalmatriksjson ? JSON.parse(r.originalmatriksjson) : parsedMatrix);
      } catch {
        parsedOriginalMatrix = parsedMatrix;
      }

      return {
        ...r,
        id: String(r.response_id || r.id || ''),
        projectid: safeProjectId,
        expertid: String(r.expert_id || ''),
        expertname: String(r.expert_name || ''),
        matrixtype: String(r.matrix_type || r.matrixtype || ''),
        parentid: String(r.parent_id || r.parentname || safeProjectId),
        parentname: String(r.parent_name || ''),
        itemnames: parsedItemNames,
        matriksjson: parsedMatrix,
        originalmatriksjson: parsedOriginalMatrix,
        cr: Number(r.cr || 0),
        isconfirmed: r.is_confirmed === 1 || r.is_confirmed === true,
        submittedat: String(r.submitted_at || ''),
      };
    });

    // 5. Normalisasi objek proyek
    const project = {
      ...prjRaw,
      id: String(prjRaw.project_id || safeProjectId),
      project_id: String(prjRaw.project_id || safeProjectId),
      projectid: String(prjRaw.project_id || safeProjectId),
      namaproyek: String(prjRaw.nama_proyek || prjRaw.namaproyek || 'Proyek AHP'),
      nama_proyek: String(prjRaw.nama_proyek || prjRaw.namaproyek || 'Proyek AHP'),
      deskripsi: String(prjRaw.deskripsi || ''),
      metode: String(prjRaw.metode || 'Bobot Saja'),
      punyasubkriteria: Boolean(prjRaw.punya_subkriteria || prjRaw.punyasubkriteria),
      jumlahexpert: formattedExperts.length,
      fasilitatornama: String(prjRaw.fasilitatornama || prjRaw.nama_user || 'Dr. Arben Virgota, S.Pi., M.Si'),
      fasilitatorlembaga: String(prjRaw.fasilitatorlembaga || prjRaw.institusi || 'Universitas Mataram'),
      fasilitatoremail: String(prjRaw.fasilitatoremail || prjRaw.email || 'arben@unram.ac.id'),
      fasilitatorwhatsapp: String(prjRaw.fasilitatorwhatsapp || ''),
      fasilitatorsignature: String(prjRaw.fasilitatorsignature || prjRaw.digital_signature || ''),
    };

    return NextResponse.json({
      success: true,
      data: {
        project,
        criteria: criteriaRows || [],
        subcriteria: subcriteriaRows || [],
        alternatif: alternativeRows || [],
        experts: formattedExperts,
        responses: formattedResponses,
      },
    });
  } catch (error: any) {
    console.error('Error fetching project bundle from MySQL:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}