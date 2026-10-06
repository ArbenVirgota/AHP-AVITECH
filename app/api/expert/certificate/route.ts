// app/api/expert/certificate/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const expertId = body.expert_id;
    const projectId = body.project_id;
    const expertName = body.expert_name || '';
    
    const certId = `AHP-EXP-${Date.now()}`;

    // Upaya aman untuk mencatat riwayat sertifikat jika tabelnya ada
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`AHP - certificates\` (certificate_id, expert_id, project_id, expert_name, issued_at)
        VALUES (?, ?, ?, ?, NOW())
      `, certId, expertId, projectId, expertName);
    } catch (dbError) {
      // Abaikan eror jika tabel sertifikat belum dibuat di phpMyAdmin, 
      // tetap kembalikan ID sertifikat agar frontend bisa lanjut mencetak PDF.
      console.warn('Tabel AHP - certificates mungkin belum ada, melewati penyimpanan log sertifikat.');
    }

    return NextResponse.json({ success: true, certificate_id: certId });
  } catch (error: any) {
    console.error('Error generating certificate:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}