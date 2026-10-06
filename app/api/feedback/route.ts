// app/api/feedback/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fungsi sederhana penentu sentimen otomatis berdasarkan kata kunci pesan
function detectSentiment(message: string): 'POSITIF' | 'NETRAL' | 'NEGATIF' {
  const text = (message || '').toLowerCase();
  
  const positiveWords = ['bagus', 'keren', 'mantap', 'membantu', 'terima kasih', 'puas', 'mudah', 'hebat', 'sukses', 'top'];
  const negativeWords = ['kecewa', 'buruk', 'error', 'bug', 'lambat', 'sulit', 'gagal', 'rusak', 'salah', 'payah'];

  const hasPos = positiveWords.some((word) => text.includes(word));
  const hasNeg = negativeWords.some((word) => text.includes(word));

  if (hasPos && !hasNeg) return 'POSITIF';
  if (hasNeg && !hasPos) return 'NEGATIF';
  return 'NETRAL';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { nama, email, kategori, pesan } = body;

    if (!pesan || !pesan.trim()) {
      return NextResponse.json(
        { success: false, message: 'Pesan masukan/feedback wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanNama = String(nama || 'Anonim').trim();
    const cleanEmail = String(email || '-').trim();
    const cleanKategori = String(kategori || 'Umum').trim();
    const cleanPesan = String(pesan).trim();
    const cleanSentiment = detectSentiment(cleanPesan);

    // Simpan data ke tabel `AHP - Feedback` di database MySQL
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`AHP - Feedback\` (\`Nama\`, \`Email\`, \`Kategori\`, \`Pesan\`, \`Sentimen\`, \`Timestamp\`)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
      cleanNama,
      cleanEmail,
      cleanKategori,
      cleanPesan,
      cleanSentiment
    );

    return NextResponse.json({
      success: true,
      message: 'Terima kasih, masukan Anda berhasil kami terima!',
    });
  } catch (error: any) {
    console.error('API Feedback Error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan masukan ke database.' },
      { status: 500 }
    );
  }
}