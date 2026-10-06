// app/api/auth/verify/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!token) {
      return NextResponse.redirect(`${baseUrl}/login?error=invalid_token`);
    }

    // 1. Cari pengguna berdasarkan verificationToken
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/login?error=token_not_found`);
    }

    // 2. Periksa masa kedaluwarsa token (24 jam)
    if (user.tokenExpiry && new Date() > user.tokenExpiry) {
      return NextResponse.redirect(`${baseUrl}/login?error=token_expired`);
    }

    // 3. Perbarui status akun menjadi aktif (terverifikasi) dan bersihkan token
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        isVerified: true,
        verificationToken: null,
        tokenExpiry: null,
      },
    });

    // 4. Arahkan pengguna ke halaman login dengan notifikasi berhasil
    return NextResponse.redirect(`${baseUrl}/login?verified=true`);
  } catch (error) {
    console.error('Error verifikasi token:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/login?error=server_error`);
  }
}