// app/api/admin/restore-runner/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project_id, admin_operator } = body;

    if (!project_id) {
      return NextResponse.json({ success: false, message: 'project_id wajib disertakan.' }, { status: 400 });
    }

    // 1. Deteksi kolom yang sama-sama ada di AHP - Archive_Projects dan AHP - projects
    const commonCols: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AHP - Archive_Projects'
      AND COLUMN_NAME IN (
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'AHP - projects'
      )
    `);

    const columnList = commonCols.map(c => `\`${c.COLUMN_NAME}\``).join(', ');

    if (!columnList) {
      return NextResponse.json({ success: false, message: 'Kolom tidak cocok untuk restorasi.' }, { status: 500 });
    }

    // 2. Salin baris proyek kembali ke tabel aktif
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - projects\` (${columnList})
      SELECT ${columnList} FROM \`AHP - Archive_Projects\`
      WHERE \`project_id\` = ?
    `, project_id);

    // 3. Reset tanggal ke waktu sekarang agar tidak langsung kena filter retensi
    await prisma.$executeRawUnsafe(`
      UPDATE \`AHP - projects\` 
      SET \`created_at\` = NOW(), \`updated_at\` = NOW() 
      WHERE \`project_id\` = ?
    `, project_id);

    // 4. Salin data anak (kriteria, subkriteria, respons) jika ada
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - criteria\` SELECT * FROM \`AHP - Archive_Criteria\` WHERE \`project_id\` = ?
      `, project_id);
    } catch {}

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - subcriteria\` SELECT * FROM \`AHP - Archive_Subcriteria\` WHERE \`project_id\` = ?
      `, project_id);
    } catch {}

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - responses\` SELECT * FROM \`AHP - Archive_Responses\` WHERE \`project_id\` = ?
      `, project_id);
    } catch {}

    // 5. Hapus dari tabel-tabel arsip
    await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Responses\` WHERE \`project_id\` = ?`, project_id).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Subcriteria\` WHERE \`project_id\` = ?`, project_id).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Criteria\` WHERE \`project_id\` = ?`, project_id).catch(() => null);
    await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Archive_Projects\` WHERE \`project_id\` = ?`, project_id);

    // 6. Catat log admin
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
      VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, 'admin@avitech.cloud', 'SuperAdmin', 'RESTORE_PROJECT', ?)
    `, String(admin_operator || 'SuperAdmin'), `Memulihkan proyek ${project_id} dari arsip ke status aktif.`);

    return NextResponse.json({
      success: true,
      message: `Proyek ${project_id} berhasil dipulihkan ke proyek aktif!`,
    });
  } catch (error: any) {
    console.error('Error restore runner:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}