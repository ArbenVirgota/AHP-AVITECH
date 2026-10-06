// app/api/admin/archive-actions/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Helper: ambil kolom yang sama antara tabel arsip dan tabel operasional
async function getMatchingColumns(tableArchive: string, tableActive: string): Promise<string[]> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      AND COLUMN_NAME IN (
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      )
    `, tableArchive, tableActive);
    return rows.map((r: any) => `\`${r.COLUMN_NAME}\``);
  } catch (err) {
    console.error(`Gagal deteksi kolom ${tableArchive} <-> ${tableActive}:`, err);
    return [];
  }
}

// 1. GET: Ambil daftar proyek dari AHP - Archive_Projects
export async function GET() {
  try {
    const rawRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        \`project_id\`,
        COALESCE(\`nama_proyek\`, 'Proyek Tanpa Judul') AS \`nama_proyek\`,
        COALESCE(\`user_email\`, '-') AS \`user_email\`,
        COALESCE(
          NULLIF(DATE_FORMAT(\`created_at\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'),
          '-'
        ) AS \`safe_created_at\`,
        COALESCE(
          NULLIF(DATE_FORMAT(\`updated_at\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'),
          '-'
        ) AS \`safe_updated_at\`
      FROM \`AHP - Archive_Projects\`
      ORDER BY \`project_id\` DESC
    `);

    const formatted = (rawRows || []).map((row, idx) => ({
      project_id: String(row.project_id || `P-${idx + 1}`),
      nama_proyek: String(row.nama_proyek || 'Proyek Tanpa Judul'),
      pemilik: String(row.user_email || '-'),
      created_at: String(row.safe_created_at || '-'),
      updated_at: String(row.safe_updated_at || '-'),
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error('Error fetching archived projects:', error);
    return NextResponse.json(
      { success: false, message: error.message, data: [] },
      { status: 500 }
    );
  }
}

// 2. POST: Aksi Unduh, Pulihkan (Restore), dan Hapus Permanen
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('>>> [ARCHIVE-ACTIONS] Request body:', body);

    const action = String(body.action || '').trim().toLowerCase();
    const projectId = String(body.project_id || body.projectId || body.id || '').trim();
    const adminOperator = String(body.admin_operator || body.adminOperator || 'SuperAdmin').trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: 'project_id wajib disertakan.' }, { status: 400 });
    }

    // ==========================================
    // A. AKSI UNDUH PAKET ARSIP (Format JSON)
    // ==========================================
    if (action === 'download_archive' || action === 'download') {
      const [projectRows, criteriaRows, subcriteriaRows, alternativeRows, responseRows]: [any[], any[], any[], any[], any[]] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT 
            \`project_id\`, \`user_id\`, \`user_email\`, \`nama_proyek\`, \`deskripsi\`, \`metode\`, \`status\`,
            COALESCE(NULLIF(DATE_FORMAT(\`created_at\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), '-') AS \`created_at\`,
            COALESCE(NULLIF(DATE_FORMAT(\`updated_at\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'), '-') AS \`updated_at\`
          FROM \`AHP - Archive_Projects\` 
          WHERE \`project_id\` = ?
        `, projectId),
        prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - Archive_Criteria\` WHERE \`project_id\` = ?`, projectId).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - Archive_Subcriteria\` WHERE \`project_id\` = ?`, projectId).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - Archive_Alternatives\` WHERE \`project_id\` = ?`, projectId).catch(() => []),
        prisma.$queryRawUnsafe(`SELECT * FROM \`AHP - Archive_Responses\` WHERE \`project_id\` = ?`, projectId).catch(() => []),
      ]);

      if (!projectRows || projectRows.length === 0) {
        return NextResponse.json({ success: false, message: 'Data proyek tidak ditemukan di arsip.' }, { status: 404 });
      }

      const archivePackage = {
        meta: {
          exported_at: new Date().toISOString(),
          project_id: projectId,
          system: 'AHP Decision Support Platform',
        },
        project: projectRows[0],
        criteria: criteriaRows,
        subcriteria: subcriteriaRows,
        alternatives: alternativeRows,
        responses: responseRows,
      };

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
          VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, 'admin@avitech.cloud', 'SuperAdmin', 'DOWNLOAD_ARCHIVE', ?)
        `, adminOperator, `Mengunduh berkas backup arsip proyek ${projectId}`);
      } catch (err) {
        console.warn('Log download archive skipped:', err);
      }

      return NextResponse.json({
        success: true,
        data: archivePackage,
      });
    }

    // ==========================================
    // B. AKSI PULIHKAN PROYEK KE AKTIF (RESTORE)
    // Toleran: restore_project, restore, pulihkan
    // ==========================================
    if (action === 'restore_project' || action === 'restore' || action === 'pulihkan') {
      
      // 1. Pulihkan AHP - projects
      const projectCols = await getMatchingColumns('AHP - Archive_Projects', 'AHP - projects');
      if (projectCols.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Kolom antara tabel AHP - Archive_Projects dan AHP - projects tidak cocok.' 
        }, { status: 500 });
      }

      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - projects\` (${projectCols.join(', ')})
        SELECT ${projectCols.join(', ')} FROM \`AHP - Archive_Projects\`
        WHERE \`project_id\` = ?
      `, projectId);

      // Perbarui created_at & updated_at ke NOW() agar tidak langsung tereliminasi filter retensi
      await prisma.$executeRawUnsafe(`
        UPDATE \`AHP - projects\` 
        SET \`created_at\` = NOW(), \`updated_at\` = NOW() 
        WHERE \`project_id\` = ?
      `, projectId);

      // 2. Pulihkan AHP - criteria
      try {
        const critCols = await getMatchingColumns('AHP - Archive_Criteria', 'AHP - criteria');
        if (critCols.length > 0) {
          const selectCols = critCols.map(c => 
            c === '`created_at`' 
              ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" 
              : c
          ).join(', ');

          await prisma.$executeRawUnsafe(`
            INSERT IGNORE INTO \`AHP - criteria\` (${critCols.join(', ')})
            SELECT ${selectCols} FROM \`AHP - Archive_Criteria\`
            WHERE \`project_id\` = ?
          `, projectId);

          await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Criteria\` WHERE \`project_id\` = ?`, projectId);
        }
      } catch (e: any) {
        console.warn('Gagal memulihkan criteria:', e.message);
      }

      // 3. Pulihkan AHP - subcriteria
      try {
        const subCols = await getMatchingColumns('AHP - Archive_Subcriteria', 'AHP - subcriteria');
        if (subCols.length > 0) {
          const selectCols = subCols.map(c => 
            c === '`created_at`' 
              ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" 
              : c
          ).join(', ');

          await prisma.$executeRawUnsafe(`
            INSERT IGNORE INTO \`AHP - subcriteria\` (${subCols.join(', ')})
            SELECT ${selectCols} FROM \`AHP - Archive_Subcriteria\`
            WHERE \`project_id\` = ?
          `, projectId);

          await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Subcriteria\` WHERE \`project_id\` = ?`, projectId);
        }
      } catch (e: any) {
        console.warn('Gagal memulihkan subcriteria:', e.message);
      }

      // 4. Pulihkan AHP - alternatives
      try {
        const altCols = await getMatchingColumns('AHP - Archive_Alternatives', 'AHP - alternatives');
        if (altCols.length > 0) {
          const selectCols = altCols.map(c => 
            c === '`created_at`' 
              ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" 
              : c
          ).join(', ');

          await prisma.$executeRawUnsafe(`
            INSERT IGNORE INTO \`AHP - alternatives\` (${altCols.join(', ')})
            SELECT ${selectCols} FROM \`AHP - Archive_Alternatives\`
            WHERE \`project_id\` = ?
          `, projectId);

          await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Alternatives\` WHERE \`project_id\` = ?`, projectId);
        }
      } catch (e: any) {
        console.warn('Gagal memulihkan alternatives:', e.message);
      }

      // 5. Pulihkan AHP - responses
      try {
        const respCols = await getMatchingColumns('AHP - Archive_Responses', 'AHP - responses');
        if (respCols.length > 0) {
          const selectCols = respCols.map(c => 
            c === '`created_at`' 
              ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" 
              : c
          ).join(', ');

          await prisma.$executeRawUnsafe(`
            INSERT IGNORE INTO \`AHP - responses\` (${respCols.join(', ')})
            SELECT ${selectCols} FROM \`AHP - Archive_Responses\`
            WHERE \`project_id\` = ?
          `, projectId);

          await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Responses\` WHERE \`project_id\` = ?`, projectId);
        }
      } catch (e: any) {
        console.warn('Gagal memulihkan responses:', e.message);
      }

      // 6. Hapus baris dari AHP - Archive_Projects
      await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Projects\` WHERE \`project_id\` = ?`, projectId);

      // 7. Catat log admin
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
          VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, 'admin@avitech.cloud', 'SuperAdmin', 'RESTORE_PROJECT', ?)
        `, adminOperator, `Memulihkan proyek ${projectId} beserta relasinya ke status aktif.`);
      } catch (err) {
        console.warn('Log restore skipped:', err);
      }

      return NextResponse.json({
        success: true,
        message: `Proyek ${projectId} beserta seluruh kriteria, subkriteria, alternatif, dan respons berhasil dipulihkan!`,
      });
    }

    // ==========================================
    // C. AKSI HAPUS PERMANEN
    // Toleran: delete_permanent, delete, hapus
    // ==========================================
    if (action === 'delete_permanent' || action === 'delete' || action === 'hapus') {
      await Promise.all([
        prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Responses\` WHERE \`project_id\` = ?`, projectId).catch(() => null),
        prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Alternatives\` WHERE \`project_id\` = ?`, projectId).catch(() => null),
        prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Subcriteria\` WHERE \`project_id\` = ?`, projectId).catch(() => null),
        prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Criteria\` WHERE \`project_id\` = ?`, projectId).catch(() => null),
        prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Projects\` WHERE \`project_id\` = ?`, projectId),
      ]);

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
          VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, 'admin@avitech.cloud', 'SuperAdmin', 'DELETE_ARCHIVE_PERMANENT', ?)
        `, adminOperator, `Menghapus permanen seluruh paket arsip proyek ${projectId}`);
      } catch (err) {
        console.warn('Log delete skipped:', err);
      }

      return NextResponse.json({
        success: true,
        message: `Proyek ${projectId} beserta seluruh data kriteria, subkriteria, alternatif, dan respons telah dihapus permanen dari arsip!`,
      });
    }

    console.error('>>> [ARCHIVE-ACTIONS] Aksi tidak cocok. Diterima:', body.action);
    return NextResponse.json({ 
      success: false, 
      message: `Aksi arsip tidak dikenali (Nilai yang diterima: "${body.action}").` 
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error in archive actions:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}