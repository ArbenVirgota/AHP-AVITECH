// app/api/projects/response/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    let projectId = String(
      body.project_id || body.projectid || body.projectId || ''
    ).trim();
    let expertId = String(
      body.expert_id || body.expertid || body.expertId || body.token || ''
    ).trim();
    const token = String(body.token || '').trim();
    let expertName = String(
      body.expert_name || body.expertname || body.expertName || ''
    ).trim();
    const matrixType = String(
      body.matrix_type || body.matrixtype || body.matrixType || 'criteria'
    ).trim();
    const parentId = String(
      body.parent_id || body.parentid || body.parentId || ''
    ).trim();
    const parentName = String(
      body.parent_name || body.parentname || body.parentName || ''
    ).trim();
    let submittedBy = String(
      body.submitted_by || body.submittedby || body.submittedBy || ''
    ).trim();
    const cr = Number(body.cr || 0);

    // 1. Cocokkan relasi di AHP - project_experts menggunakan token atau expertId
    let peMatch: any[] = [];
    if (projectId) {
      peMatch = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - project_experts\`
        WHERE (\`token\` = ? OR \`id\` = ? OR \`expert_id\` = ?) AND \`project_id\` = ?
        LIMIT 1
      `, token || expertId, expertId, expertId, projectId).catch(() => []);
    }
    if ((!peMatch || peMatch.length === 0) && (token || expertId)) {
      peMatch = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - project_experts\`
        WHERE \`token\` = ? OR \`id\` = ? OR \`expert_id\` = ?
        LIMIT 1
      `, token || expertId, expertId, expertId).catch(() => []);
    }

    if (peMatch && peMatch.length > 0) {
      const pe = peMatch[0];
      expertId = String(pe.expert_id || expertId).trim();
      if (!projectId) {
        projectId = String(pe.project_id || '').trim();
      }
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'ID Proyek wajib disertakan.' },
        { status: 400 }
      );
    }

    // 2. Tentukan nama resmi pakar (fallback khusus Pakar Simulasi)
    if (expertId && expertId !== 'FACILITATOR') {
      const expMaster: any[] = await prisma.$queryRawUnsafe(`
        SELECT \`expert_name\`, \`nama\`, \`gelar_depan\`, \`gelar_belakang\` 
        FROM \`AHP - experts\` 
        WHERE \`expert_id\` = ?
        LIMIT 1
      `, expertId).catch(() => []);

      if (expMaster && expMaster.length > 0) {
        const m = expMaster[0];
        const bName = String(m.expert_name || m.nama || '').trim();
        const gD = String(m.gelar_depan || '').trim();
        const gB = String(m.gelar_belakang || '').trim();

        let compiled = bName;
        if (gD && !compiled.startsWith(gD)) compiled = `${gD} ${compiled}`;
        if (gB && !compiled.includes(gB)) compiled = `${compiled}, ${gB}`;

        if (compiled) {
          expertName = compiled;
        }
      }
    }

    if (!expertName) {
      if (token.includes('838') || expertId.includes('01') || expertId.includes('681')) {
        expertName = 'Prof. Linglungan';
      } else if (token.includes('601') || expertId.includes('02') || expertId.includes('671')) {
        expertName = 'DR. Raos';
      } else {
        expertName = 'Pakar Responden';
      }
    }

    const finalSubmittedBy = submittedBy || expertName || 'Pakar Responden';

    // Format Data JSON
    const matriksJson = typeof body.matriks_json === 'string'
      ? body.matriks_json
      : JSON.stringify(body.matriks_json || body.matriksjson || body.matrix || []);

    const itemIdsJson = typeof body.item_ids === 'string'
      ? body.item_ids
      : JSON.stringify(body.item_ids || body.itemids || []);

    const itemNamesJson = typeof body.item_names === 'string'
      ? body.item_names
      : JSON.stringify(body.item_names || body.itemnames || []);

    // 3. Deteksi nama kolom aktual di tabel AHP - responses
    const rawCols: any[] = await prisma.$queryRawUnsafe('SHOW COLUMNS FROM `AHP - responses`').catch(() => []);
    const availableCols = new Set(rawCols.map((c: any) => c.Field));

    // 4. Periksa apakah respon sudah pernah tersimpan
    let existingId: string | null = null;
    try {
      const existing: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - responses\`
        WHERE \`project_id\` = ? 
          AND \`expert_id\` = ? 
          AND (\`matrix_type\` = ? OR \`matrix_type\` = ?)
          AND (\`parent_id\` = ? OR \`parent_id\` IS NULL OR \`parent_id\` = '')
        LIMIT 1
      `, projectId, expertId, matrixType, matrixType.toLowerCase(), parentId || '');

      if (existing && existing.length > 0) {
        existingId = String(existing[0].response_id || existing[0].id || '').trim();
      }
    } catch (e) {
      console.warn('Cek existing response dilewati:', e);
    }

    // UPDATE jika sudah ada
    if (existingId) {
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (availableCols.has('expert_name')) { updateFields.push('`expert_name` = ?'); updateValues.push(expertName); }
      if (availableCols.has('parent_name')) { updateFields.push('`parent_name` = ?'); updateValues.push(parentName); }
      if (availableCols.has('item_ids_json')) { updateFields.push('`item_ids_json` = ?'); updateValues.push(itemIdsJson); }
      if (availableCols.has('item_names_json')) { updateFields.push('`item_names_json` = ?'); updateValues.push(itemNamesJson); }
      if (availableCols.has('matriks_json')) { updateFields.push('`matriks_json` = ?'); updateValues.push(matriksJson); }
      if (availableCols.has('cr')) { updateFields.push('`cr` = ?'); updateValues.push(cr); }
      if (availableCols.has('submitted_by')) { updateFields.push('`submitted_by` = ?'); updateValues.push(finalSubmittedBy); }
      if (availableCols.has('updated_at')) { updateFields.push('`updated_at` = NOW()'); }

      const idCol = availableCols.has('response_id') ? '`response_id`' : '`id`';
      updateValues.push(existingId);

      await prisma.$executeRawUnsafe(`
        UPDATE \`AHP - responses\` SET ${updateFields.join(', ')}
        WHERE ${idCol} = ?
      `, ...updateValues);

      // Sinkronkan status konfirmasi di AHP - project_experts
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE \`AHP - project_experts\`
          SET \`confirmed_at\` = NOW()
          WHERE (\`token\` = ? OR \`expert_id\` = ?) AND \`project_id\` = ?
        `, token || expertId, expertId, projectId);
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'Hasil evaluasi matriks berhasil diperbarui.',
        response_id: existingId,
      });
    }

    // INSERT jika data baru
    const newId = `RESP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const insertFields: string[] = [];
    const insertPlaceholders: string[] = [];
    const insertValues: any[] = [];

    if (availableCols.has('id')) { insertFields.push('`id`'); insertPlaceholders.push('?'); insertValues.push(newId); }
    if (availableCols.has('response_id')) { insertFields.push('`response_id`'); insertPlaceholders.push('?'); insertValues.push(newId); }
    if (availableCols.has('project_id')) { insertFields.push('`project_id`'); insertPlaceholders.push('?'); insertValues.push(projectId); }
    if (availableCols.has('expert_id')) { insertFields.push('`expert_id`'); insertPlaceholders.push('?'); insertValues.push(expertId); }
    if (availableCols.has('expert_name')) { insertFields.push('`expert_name`'); insertPlaceholders.push('?'); insertValues.push(expertName); }
    if (availableCols.has('matrix_type')) { insertFields.push('`matrix_type`'); insertPlaceholders.push('?'); insertValues.push(matrixType); }
    if (availableCols.has('parent_id')) { insertFields.push('`parent_id`'); insertPlaceholders.push('?'); insertValues.push(parentId); }
    if (availableCols.has('parent_name')) { insertFields.push('`parent_name`'); insertPlaceholders.push('?'); insertValues.push(parentName); }
    if (availableCols.has('item_ids_json')) { insertFields.push('`item_ids_json`'); insertPlaceholders.push('?'); insertValues.push(itemIdsJson); }
    if (availableCols.has('item_names_json')) { insertFields.push('`item_names_json`'); insertPlaceholders.push('?'); insertValues.push(itemNamesJson); }
    if (availableCols.has('matriks_json')) { insertFields.push('`matriks_json`'); insertPlaceholders.push('?'); insertValues.push(matriksJson); }
    if (availableCols.has('original_matriks_json')) { insertFields.push('`original_matriks_json`'); insertPlaceholders.push('?'); insertValues.push(matriksJson); }
    if (availableCols.has('cr')) { insertFields.push('`cr`'); insertPlaceholders.push('?'); insertValues.push(cr); }
    if (availableCols.has('submitted_by')) { insertFields.push('`submitted_by`'); insertPlaceholders.push('?'); insertValues.push(finalSubmittedBy); }
    if (availableCols.has('submitted_at')) { insertFields.push('`submitted_at`'); insertPlaceholders.push('NOW()'); }
    if (availableCols.has('updated_at')) { insertFields.push('`updated_at`'); insertPlaceholders.push('NOW()'); }

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - responses\` (${insertFields.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
    `, ...insertValues);

    // Tandai status pakar menjadi selesai di AHP - project_experts
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE \`AHP - project_experts\`
        SET \`confirmed_at\` = NOW()
        WHERE (\`token\` = ? OR \`expert_id\` = ?) AND \`project_id\` = ?
      `, token || expertId, expertId, projectId);
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Hasil evaluasi matriks berhasil disimpan ke MySQL.',
      response_id: newId,
    });
  } catch (error: any) {
    console.error('Error saat menyimpan response matriks:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan evaluasi matriks.' },
      { status: 500 }
    );
  }
}