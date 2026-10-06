// app/api/user/profile/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, nama, institusi, city, digital_signature, foto_profil } = body;

    const cleanEmail = email?.toLowerCase().trim();

    if (!cleanEmail) {
      return NextResponse.json(
        { success: false, message: 'Email pengguna tidak valid.' },
        { status: 400 }
      );
    }

    // Perbarui data user di tabel AHP - users via Prisma
    const updatedUser = await prisma.user.update({
      where: { email: cleanEmail },
      data: {
        nama: nama || '',
        institusi: institusi || null,
        city: city || null,
        digital_signature: digital_signature || null,
        foto_profil: foto_profil || null,
      },
      select: {
        user_id: true,
        nama: true,
        email: true,
        institusi: true,
        city: true,
        digital_signature: true,
        foto_profil: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: updatedUser,
    });
  } catch (error) {
    console.error('API Update Profile Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal memperbarui profil di database.',
      },
      { status: 500 }
    );
  }
}