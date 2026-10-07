// app/api/expert/review/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { expert_id, user_id, project_id, aspek_kompetensi, aspek_responsif, aspek_ketepatan, ulasan } = body;

    const k = Number(aspek_kompetensi) || 5;
    const r = Number(aspek_responsif) || 5;
    const t = Number(aspek_ketepatan) || 5;
    const ratingRata = Number(((k + r + t) / 3).toFixed(2));
    const reviewId = `REV-${Date.now()}`;

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - expert_reviews\` 
      (\`review_id\`, \`expert_id\`, \`user_id\`, \`project_id\`, \`aspek_kompetensi\`, \`aspek_responsif\`, \`aspek_ketepatan\`, \`rating_rata\`, \`ulasan\`, \`created_at\`)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, reviewId, expert_id, user_id || 'USER-SYS', project_id || '', k, r, t, ratingRata, ulasan || '');

    return NextResponse.json({ success: true, message: 'Review berhasil disimpan' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}