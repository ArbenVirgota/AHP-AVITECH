// app/api/certificates/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      certificateid,
      expertid,
      expertname,
      projectname,
      type = 'APRESIASI',
      fasilitator_nama,
    } = body;

    if (!certificateid || !expertid) {
      return NextResponse.json(
        { success: false, message: 'Data sertifikat tidak lengkap.' },
        { status: 400 }
      );
    }

    // Rekam ke tabel AHP - certificates (INSERT atau abaikan jika sudah ada)
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO \`AHP - certificates\` 
        (\`certificateid\`, \`expertid\`, \`expertname\`, \`projectname\`, \`issuedat\`, \`type\`, \`fasilitator_nama\`)
      VALUES 
        (?, ?, ?, ?, NOW(), ?, ?)
      ON DUPLICATE KEY UPDATE 
        \`expertname\` = VALUES(\`expertname\`),
        \`projectname\` = VALUES(\`projectname\`),
        \`fasilitator_nama\` = VALUES(\`fasilitator_nama\`)
    `,
      certificateid,
      expertid,
      expertname,
      projectname,
      type,
      fasilitator_nama || 'Peneliti Utama'
    );

    return NextResponse.json({
      success: true,
      message: 'Sertifikat berhasil dicatat ke sistem audit.',
    });
  } catch (error: any) {
    console.error('Error menyimpan sertifikat:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}