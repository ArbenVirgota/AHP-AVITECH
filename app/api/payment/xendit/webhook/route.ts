export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Pastikan status tagihan dari Xendit adalah PAID (Lunas)
    if (body.status === 'PAID') {
      const payerEmail = body.payer_email;
      const externalId = body.external_id || ''; 
      
      const planMatch = externalId.match(/INV-([A-Z]+)-/);
      const planKey = planMatch ? planMatch[1].toLowerCase() : 'pro';

      // Set masa aktif +180 hari dari sekarang
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 180);

      if (payerEmail) {
        // Sesuaikan nama tabel 'users' di bawah dengan nama tabel pengguna di database Anda (misal: 'AHP - users')
        await prisma.$executeRawUnsafe(`
          UPDATE \`users\` 
          SET 
            \`plan\` = ?, 
            \`status\` = 'active',
            \`expires_at\` = ?,
            \`updated_at\` = NOW()
          WHERE \`email\` = ?
        `, planKey, expiresAt, payerEmail);
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received' }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}