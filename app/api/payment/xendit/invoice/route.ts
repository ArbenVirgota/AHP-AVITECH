// app/api/payment/xendit/invoice/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { user_email, plan_key, amount } = body;

    // 1. Ambil pengaturan Xendit dari database tabel AHP - payment_settings
    const settings: any[] = await prisma.$queryRawUnsafe(`
      SELECT key_name, key_value 
      FROM \`AHP - payment_settings\` 
      WHERE key_name IN ('xendit_active', 'xendit_secret_key')
    `).catch(() => []);

    let isXenditActive = false;
    let xenditApiKey = '';

    settings.forEach(row => {
      if (row.key_name === 'xendit_active') {
        // Mendukung nilai '1', 'true', atau 'aktif'
        isXenditActive = (row.key_value === '1' || row.key_value === 'true' || row.key_value === 'aktif');
      }
      if (row.key_name === 'xendit_secret_key') {
        xenditApiKey = row.key_value || '';
      }
    });

    // 2. Jika Xendit dimatikan oleh Super Admin (xendit_active = 0) atau Key kosong, 
    // kembalikan status fallback_to_manual agar frontend membuka tiket manual.
    if (!isXenditActive || !xenditApiKey || xenditApiKey.trim() === '') {
      return NextResponse.json({ 
        success: false, 
        message: 'Mode Pembayaran Otomatis belum aktif.',
        fallback_to_manual: true
      }, { status: 200 }); 
    }

    // 3. Jika aktif, buat tagihan ke server Xendit
    const response = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(xenditApiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: `INV-${plan_key.toUpperCase()}-${Date.now()}-${user_email}`,
        amount: Number(amount),
        payer_email: user_email,
        description: `Upgrade Paket AHP Avitech ke ${plan_key.toUpperCase()}`,
        success_redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?payment=success`,
        failure_redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?payment=failed`,
      }),
    });

    const invoice = await response.json();
    if (!response.ok) throw new Error(invoice.message || 'Gagal membuat tagihan via Xendit.');

    return NextResponse.json({
      success: true,
      invoice_url: invoice.invoice_url,
      external_id: invoice.external_id,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}