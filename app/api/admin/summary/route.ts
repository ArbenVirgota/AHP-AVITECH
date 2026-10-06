// app/api/admin/summary/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Hitung total metrik secara paralel
    const [
      totalUsers,
      totalProjects,
      totalExperts,
      totalConsultationsLegacy,
      totalConsultationRequests,
      totalFeedback,
    ] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.project.count().catch(() => 0),
      prisma.aHP___experts.count().catch(() => 0),
      prisma.aHP___consultations.count().catch(() => 0),
      prisma.aHP___ConsultationRequests.count().catch(() => 0),
      prisma.aHP___Feedback.count().catch(() => 0),
    ]);

    const totalConsultations = totalConsultationsLegacy + totalConsultationRequests;

    // 2. Ambil 5 pengguna terbaru (hanya kolom aman)
    const recentUsers = await prisma.user.findMany({
      take: 5,
      select: {
        user_id: true,
        nama: true,
        email: true,
        plan: true,
        status: true,
        institusi: true,
      },
      orderBy: {
        user_id: 'desc',
      },
    }).catch(() => []);

    // 3. Ambil 5 proyek terbaru
    const recentProjects = await prisma.project.findMany({
      take: 5,
      select: {
        project_id: true,
        namaProyek: true,
        user_email: true,
        metode: true,
        status: true,
        jumlahExpert: true,
      },
      orderBy: {
        project_id: 'desc',
      },
    }).catch(() => []);

    // 4. Ambil 5 pakar terbaru
    const recentExperts = await prisma.aHP___experts.findMany({
      take: 5,
      select: {
        expert_id: true,
        gelar_depan: true,
        expert_name: true,
        gelar_belakang: true,
        bidang_keahlian: true,
        status: true,
        asal_instansi: true,
      },
      orderBy: {
        expert_id: 'desc',
      },
    }).catch(() => []);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalProjects,
          totalExperts,
          totalConsultations,
          totalFeedback,
        },
        recentUsers,
        recentProjects,
        recentExperts,
      },
    });
  } catch (error) {
    console.error('API Admin Summary Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mengambil data ringkasan admin.',
      },
      { status: 500 }
    );
  }
}