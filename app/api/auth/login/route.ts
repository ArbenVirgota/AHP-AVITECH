// app/api/auth/login/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // 1. Cari data pengguna di tabel AHP - users
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Alamat email tidak terdaftar.' },
        { status: 404 }
      );
    }

    // 2. Validasi Status Verifikasi Email (Hanya untuk akun baru yang belum aktif)
    if (user.isVerified === false) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Akun Anda belum aktif. Silakan periksa email Anda dan lakukan konfirmasi verifikasi terlebih dahulu.' 
        },
        { status: 403 }
      );
    }

    // 3. Verifikasi Kata Sandi (Mendukung Akun Lama Plain Text & Akun Baru Bcrypt)
    let isPasswordMatch = false;

    // Cek apakah password_hash di database berupa hash bcrypt (diawali $2a$, $2b$, atau $2y$)
    const isBcryptHash = user.passwordHash.startsWith('$2a$') || 
                         user.passwordHash.startsWith('$2b$') || 
                         user.passwordHash.startsWith('$2y$');

    if (isBcryptHash) {
      // Untuk akun baru yang terenkripsi
      isPasswordMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    } else {
      // Untuk akun lama yang tersimpan dalam plain text
      isPasswordMatch = user.passwordHash === cleanPassword;
    }

    if (!isPasswordMatch) {
      return NextResponse.json(
        { success: false, message: 'Kata sandi salah. Periksa kembali.' },
        { status: 401 }
      );
    }

    // 4. Update jumlah kunjungan pengguna
    try {
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          jumlah_kunjungan: (user.jumlah_kunjungan || 0) + 1,
        },
      });
    } catch {
      // Abaikan jika update kunjungan gagal
    }

    // 5. Kembalikan data profil login pengguna
    return NextResponse.json({
      success: true,
      message: 'Login berhasil.',
      user_id: user.user_id,
      name: user.nama,
      email: user.email,
      status_user: user.status_user || 'USER',
      institusi: user.institusi || '',
      city: user.city || '',
      digital_signature: user.digital_signature || '',
    });

  } catch (error: any) {
    console.error('Error saat login:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server saat memproses login.' },
      { status: 500 }
    );
  }
}