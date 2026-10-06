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
    const email = String(body.email || body.user_email || 'Visitor Umum').trim();
    const name = String(body.name || body.user_name || 'Visitor Umum').trim();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // 1. Jika ada token pakar, perbarui status pengisian kuesioner
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
    `, email, name, pagePath, ip);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    // Non-blocking agar tidak mengganggu navigasi pengguna
    return NextResponse.json({ success: true, error: err?.message });
  }
}