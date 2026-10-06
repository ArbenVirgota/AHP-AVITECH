// app/api/admin/archive-runner/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function getMatchingColumns(sourceTable: string, targetTable: string): Promise<string[]> {
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
    `, sourceTable, targetTable);
    return rows.map((r: any) => `\`${r.COLUMN_NAME}\``);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    // 1. Ambil nilai retensi dari baris Key-Value di AHP - system_assets
    let months = 6;
    let autoArchiveEnabled = true;

    try {
      const assetRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT \`setting_key\`, \`setting_value\` 
        FROM \`AHP - system_assets\`
        WHERE \`setting_key\` IN ('project_retention_months', 'project_auto_archive_enabled')
      `);

      for (const row of assetRows || []) {
        if (row.setting_key === 'project_retention_months' && row.setting_value) {
          months = Number(row.setting_value) || 6;
        }
        if (row.setting_key === 'project_auto_archive_enabled') {
          autoArchiveEnabled = row.setting_value === '1' || String(row.setting_value).toLowerCase() === 'true';
        }
      }
    } catch (e: any) {
      console.warn('Gagal membaca setting_key system_assets, gunakan nilai standar:', e.message);
    }

    if (!autoArchiveEnabled) {
      return NextResponse.json({
        success: false,
        message: 'Otomatisasi pengarsipan sedang dinonaktifkan di pengaturan sistem.',
      });
    }

    // 2. Ambil ID proyek yang tidak aktif lebih dari batas bulan retensi
    const expiredProjects: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`project_id\` 
      FROM \`AHP - projects\`
      WHERE \`updated_at\` < DATE_SUB(NOW(), INTERVAL ? MONTH)
         OR (\`updated_at\` IS NULL AND \`created_at\` < DATE_SUB(NOW(), INTERVAL ? MONTH))
         OR CAST(\`created_at\` AS CHAR) LIKE '0000-%'
         OR CAST(\`updated_at\` AS CHAR) LIKE '0000-%'
    `, months, months);

    if (!expiredProjects || expiredProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Tidak ada proyek yang melampaui batas kedaluwarsa ${months} bulan.`,
      });
    }

    const projectIdsList = expiredProjects.map(p => `'${p.project_id}'`).join(', ');

    // 3. Pindahkan tabel anak ke tabel arsip secara berurutan
    // A. Alternatif
    try {
      const altCols = await getMatchingColumns('AHP - alternatives', 'AHP - Archive_Alternatives');
      if (altCols.length > 0) {
        const selectCols = altCols.map(c => 
          c === '`created_at`' ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" : c
        ).join(', ');

        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO \`AHP - Archive_Alternatives\` (${altCols.join(', ')})
          SELECT ${selectCols} FROM \`AHP - alternatives\`
          WHERE \`project_id\` IN (${projectIdsList})
        `);
        await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - alternatives\` WHERE \`project_id\` IN (${projectIdsList})`);
      }
    } catch (e: any) {
      console.warn('Lewati/gagal arsip alternatives:', e.message);
    }

    // B. Kriteria (dengan normalisasi tanggal 0000-00-00)
    try {
      const critCols = await getMatchingColumns('AHP - criteria', 'AHP - Archive_Criteria');
      if (critCols.length > 0) {
        const selectCols = critCols.map(c => 
          c === '`created_at`' ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" : c
        ).join(', ');

        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO \`AHP - Archive_Criteria\` (${critCols.join(', ')})
          SELECT ${selectCols} FROM \`AHP - criteria\`
          WHERE \`project_id\` IN (${projectIdsList})
        `);
        await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - criteria\` WHERE \`project_id\` IN (${projectIdsList})`);
      }
    } catch (e: any) {
      console.warn('Lewati/gagal arsip criteria:', e.message);
    }

    // C. Subkriteria
    try {
      const subCols = await getMatchingColumns('AHP - subcriteria', 'AHP - Archive_Subcriteria');
      if (subCols.length > 0) {
        const selectCols = subCols.map(c => 
          c === '`created_at`' ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" : c
        ).join(', ');

        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO \`AHP - Archive_Subcriteria\` (${subCols.join(', ')})
          SELECT ${selectCols} FROM \`AHP - subcriteria\`
          WHERE \`project_id\` IN (${projectIdsList})
        `);
        await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - subcriteria\` WHERE \`project_id\` IN (${projectIdsList})`);
      }
    } catch (e: any) {
      console.warn('Lewati/gagal arsip subcriteria:', e.message);
    }

    // D. Responses
    try {
      const respCols = await getMatchingColumns('AHP - responses', 'AHP - Archive_Responses');
      if (respCols.length > 0) {
        const selectCols = respCols.map(c => 
          c === '`created_at`' ? "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`" : c
        ).join(', ');

        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO \`AHP - Archive_Responses\` (${respCols.join(', ')})
          SELECT ${selectCols} FROM \`AHP - responses\`
          WHERE \`project_id\` IN (${projectIdsList})
        `);
        await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - responses\` WHERE \`project_id\` IN (${projectIdsList})`);
      }
    } catch (e: any) {
      console.warn('Lewati/gagal arsip responses:', e.message);
    }

    // 4. Pindahkan Tabel Utama AHP - projects
    const projCols = await getMatchingColumns('AHP - projects', 'AHP - Archive_Projects');
    const selectProjCols = projCols.map(c => {
      if (c === '`created_at`') return "COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW()) AS `created_at`";
      if (c === '`updated_at`') return "COALESCE(NULLIF(`updated_at`, '0000-00-00 00:00:00'), NOW()) AS `updated_at`";
      return c;
    }).join(', ');

    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO \`AHP - Archive_Projects\` (${projCols.join(', ')})
      SELECT ${selectProjCols} FROM \`AHP - projects\`
      WHERE \`project_id\` IN (${projectIdsList})
    `);
    await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - projects\` WHERE \`project_id\` IN (${projectIdsList})`);

    // 5. Catat ke AHP - admin_logs
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
        VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), 'SuperAdmin', 'admin@avitech.cloud', 'SuperAdmin', 'AUTO_ARCHIVE_RUN', ?)
      `, `Memindahkan ${expiredProjects.length} proyek kadaluarsa beserta kriteria, subkriteria, alternatif, dan responnya ke tabel arsip.`);
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Berhasil memindahkan ${expiredProjects.length} proyek beserta seluruh kriteria, alternatif, subkriteria, dan respons ke tabel arsip.`,
    });

  } catch (error: any) {
    console.error('Error in archive-runner:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}