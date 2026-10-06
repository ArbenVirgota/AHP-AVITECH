// app/api/products/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rawProducts = await prisma.aHP___Products.findMany({
      where: {
        AND: [
          { Status: { not: 'Arsip / Non-Aktif' } },
          { Status: { not: 'Non-Aktif' } },
          { Status: { not: 'non-aktif' } },
          { Status: { not: 'Arsip' } },
        ],
      },
      select: {
        ID_Produk: true,
        Nama_Produk: true,
        Deskripsi: true,
        Status: true,
        Kategori: true,
        Link: true,
        Image_URL: true,
      },
      orderBy: {
        ID_Produk: 'asc',
      },
    });

    const products = rawProducts.map((p) => ({
      id: p.ID_Produk,
      nama: p.Nama_Produk,
      deskripsi: p.Deskripsi || '',
      status: p.Status || 'Tersedia',
      kategori: p.Kategori || 'Modul Riset',
      link: p.Link || '',
      imageurl: p.Image_URL || '',
    }));

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('API Public Products Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mengambil data produk dari database.',
      },
      { status: 500 }
    );
  }
}