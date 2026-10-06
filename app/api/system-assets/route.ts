// app/api/system-assets/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`setting_key\`, \`setting_value\` FROM \`AHP - system_assets\`
    `).catch(() => []);

    const assetMap: Record<string, string> = {};
    (rows || []).forEach((row: any) => {
      const key = String(row.setting_key || '').trim();
      const val = String(row.setting_value || '').trim();
      if (key) {
        assetMap[key] = val;
      }
    });

    const activeSignerType = assetMap['active_signer_type'] || 'main'; // 'main' (SuperAdmin) atau 'backup' / 'perwakilan'
    const logo = assetMap['platform_logo'] || '/logo.png';
    const stamp = assetMap['app_system_stamp_url'] || '';

    let signerName = 'Dr. Arben Virgota, S.Pi., M.Si';
    let signerTitle = 'Avitech Platform Founder';
    let signerSig = '';

    if (activeSignerType === 'main' || activeSignerType.includes('superadmin')) {
      // Penandatangan Utama (SuperAdmin)
      signerSig = assetMap['admin_signature'] || assetMap['superadmin_signature_url'] || '';
      signerName = assetMap['superadmin_name'] || 'SuperAdmin DSS Platform';
      signerTitle = assetMap['superadmin_title'] || 'System Authority & Lead Developer';
    } else {
      // Penandatangan Pengganti / Perwakilan
      signerSig = assetMap['backup_signer_signature_url'] || assetMap['co_admin_signature'] || '';
      signerName = assetMap['backup_signer_name'] || 'Dr. Arben Virgota, S.Pi., M.Si';
      signerTitle = assetMap['backup_signer_title'] || 'Avitech Platform Founder';
    }

    return NextResponse.json({
      success: true,
      data: {
        active_signer_type: activeSignerType,
        platform_logo: logo,
        stamp_url: stamp,
        admin_signature: signerSig,
        admin_name: signerName,
        admin_title: signerTitle,
        ...assetMap,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}