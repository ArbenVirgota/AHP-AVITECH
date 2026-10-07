// app/api/products/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET() {
  try {
    let rawProducts: any[] = [];

    // 1. Ambil data melalui Raw SQL untuk menghindari ketidakcocokan nama tabel pada Prisma ORM
    try {
      rawProducts = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - Products\`
      `);
    } catch {
      try {
        rawProducts = await prisma.$queryRawUnsafe(`
          SELECT * FROM \`AHP - products\`
        `);
      } catch {
        try {
          rawProducts = (await (prisma as any).aHP___Products?.findMany()) || [];
        } catch {
          rawProducts = [];
        }
      }
    }

    // 2. Filter produk: hanya kecualikan yang berstatus Arsip / Non-Aktif
    const activeProducts = rawProducts.filter((p: any) => {
      const statusStr = String(p.Status || p.status || '').trim().toLowerCase();
      if (!statusStr) return true;

      const isArchived =
        statusStr === 'arsip / non-aktif' ||
        statusStr === 'non-aktif' ||
        statusStr === 'non aktif' ||
        statusStr === 'arsip' ||
        statusStr.includes('arsip') ||
        statusStr.includes('non-aktif');

      return !isArchived;
    });

    // 3. Urutkan berdasarkan ID produk secara ascending
    activeProducts.sort((a: any, b: any) => {
      const idA = Number(a.ID_Produk ?? a.id_produk ?? a.id ?? 0);
      const idB = Number(b.ID_Produk ?? b.id_produk ?? b.id ?? 0);
      return idA - idB;
    });

    // 4. Petakan data dengan menyediakan seluruh variasi penamaan kunci (camelCase, snake_case, PascalCase)
    const products = activeProducts.map((p: any) => {
      const id = p.ID_Produk ?? p.id_produk ?? p.id ?? '';
      const nama = p.Nama_Produk ?? p.nama_produk ?? p.nama ?? '';
      const deskripsi = p.Deskripsi ?? p.deskripsi ?? '';
      const status = p.Status ?? p.status ?? 'Tersedia';
      const kategori = p.Kategori ?? p.kategori ?? 'Modul Riset';
      const link = p.Link ?? p.link ?? '';
      const imageurl = p.Image_URL ?? p.image_url ?? p.imageurl ?? p.gambar ?? '';

      return {
        id,
        ID_Produk: id,
        nama,
        Nama_Produk: nama,
        nama_produk: nama,
        deskripsi,
        Deskripsi: deskripsi,
        status,
        Status: status,
        kategori,
        Kategori: kategori,
        link,
        Link: link,
        imageurl,
        image_url: imageurl,
        Image_URL: imageurl,
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: products,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
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