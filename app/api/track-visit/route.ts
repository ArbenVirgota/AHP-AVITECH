// app/api/track-visit/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const pagePath = String(body.page || body.path || '/').trim();
    
    // Normalisasi identitas pengunjung
    const rawEmail = String(body.email || body.user_email || '').trim();
    const rawName = String(body.name || body.user_name || '').trim();

    const isRegistered = rawEmail && rawEmail !== 'Visitor Umum' && rawEmail.includes('@');
    const finalEmail = isRegistered ? rawEmail.toLowerCase() : 'Visitor Umum';
    const finalName = isRegistered 
      ? (rawName && rawName !== 'Visitor Umum' ? rawName : rawEmail.split('@')[0]) 
      : 'Visitor Umum';

    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = (forwardedFor ? forwardedFor.split(',')[0] : realIp || '127.0.0.1').trim();

    // 1. Jika ada token pakar, perbarui status pengisian kuesioner (Fungsi Asli Tetap Berjalan)
    if (token) {
      await prisma.$executeRawUnsafe(`
        UPDATE \`AHP - project_experts\`
        SET 
          opened_at = COALESCE(opened_at, NOW()),
          status = CASE WHEN status = 'Belum' THEN 'Sedang' ELSE status END
        WHERE token = ?
      `, token).catch(() => null);
    }

    // 2. Simpan setiap kunjungan langsung ke AHP - visitor_logs
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - visitor_logs\` (
        \`timestamp\`,
        \`user_email\`,
        \`visitor_name\`,
        \`page_path\`,
        \`ip_address\`
      ) VALUES (
        NOW(),
        ?,
        ?,
        ?,
        ?
      )
    `, finalEmail, finalName, pagePath, ip);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // Non-blocking agar tidak mengganggu navigasi pengguna
    return NextResponse.json({ success: true, error: err?.message });
  }
}