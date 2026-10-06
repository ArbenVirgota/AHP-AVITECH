// app/api/dashboard/summary/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function parseBooleanVal(val: unknown): boolean {
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    const userIdParam = searchParams.get('user_id');

    const email = emailParam && emailParam !== 'undefined' ? emailParam.toLowerCase().trim() : '';
    const userId = userIdParam && userIdParam !== 'undefined' ? userIdParam.trim() : '';

    // 1. Ambil Profil Pengguna dari `AHP - users` secara aman
    let user: any = null;
    if (email) {
      const uRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - users\` WHERE LOWER(\`email\`) = ? LIMIT 1
      `, email).catch(() => []);
      if (uRows && uRows.length > 0) user = uRows[0];
    }

    if (!user && userId) {
      const uRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - users\` WHERE \`user_id\` = ? OR \`id\` = ? LIMIT 1
      `, userId, userId).catch(async () => {
        return await prisma.$queryRawUnsafe(`
          SELECT * FROM \`AHP - users\` WHERE \`id\` = ? LIMIT 1
        `, userId).catch(() => []);
      });
      if (uRows && uRows.length > 0) user = uRows[0];
    }

    if (user) {
      if (!user.digital_signature && user.tanda_tangan) {
        user.digital_signature = user.tanda_tangan;
      }
      if (!user.nama && user.name) {
        user.nama = user.name;
      }
    }

    const effectiveEmail = String(user?.email || email || '').toLowerCase().trim();
    const statusUserStr = String(user?.status_user || user?.role || '').toLowerCase().trim();
    const isStudent = statusUserStr === 'student';

    // 2. Ambil Semua Konfigurasi Paket SuperAdmin Langsung dari `AHP - plan_settings`
    const rawPlans: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        \`plan_key\`,
        \`label\`,
        COALESCE(\`price\`, 0) AS \`price\`,
        COALESCE(\`duration_months\`, 6) AS \`duration_months\`,
        COALESCE(\`max_projects\`, 1) AS \`max_projects\`,
        COALESCE(\`max_experts_manual\`, 4) AS \`max_experts_manual\`,
        COALESCE(\`max_experts_directory\`, 0) AS \`max_experts_directory\`,
        COALESCE(\`max_consultation_per_expert\`, 0) AS \`max_consultation_per_expert\`,
        COALESCE(\`allow_subcriteria\`, 0) AS \`allow_subcriteria\`,
        COALESCE(\`allow_alternative_method\`, 0) AS \`allow_alternative_method\`,
        COALESCE(\`allow_ai_features\`, 0) AS \`allow_ai_features\`
      FROM \`AHP - plan_settings\`
      ORDER BY FIELD(UPPER(\`plan_key\`), 'FREE', 'PRO', 'PLUS', 'PREMIUM')
    `).catch(() => []);

    const planConfigs = (rawPlans && rawPlans.length > 0)
      ? rawPlans.map((p) => ({
          plan_key: String(p.plan_key || '').toUpperCase().trim(),
          label: String(p.label || p.plan_key || ''),
          price: Number(p.price || 0),
          duration_months: Number(p.duration_months || 6),
          max_projects: Number(p.max_projects ?? 1),
          max_experts_manual: Number(p.max_experts_manual ?? 4),
          max_experts_directory: Number(p.max_experts_directory ?? 0),
          max_consultation_per_expert: Number(p.max_consultation_per_expert ?? 0),
          allow_subcriteria: parseBooleanVal(p.allow_subcriteria),
          allow_alternative_method: parseBooleanVal(p.allow_alternative_method),
          allow_ai_features: parseBooleanVal(p.allow_ai_features),
        }))
      : [
          { plan_key: 'FREE', label: 'Free Pass', price: 0, duration_months: 6, max_projects: 1, max_experts_manual: 4, max_experts_directory: 0, max_consultation_per_expert: 0, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true },
          { plan_key: 'PRO', label: 'PRO', price: 150000, duration_months: 6, max_projects: 3, max_experts_manual: 8, max_experts_directory: 5, max_consultation_per_expert: 3, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: false },
          { plan_key: 'PLUS', label: 'PLUS', price: 350000, duration_months: 6, max_projects: 10, max_experts_manual: 15, max_experts_directory: 10, max_consultation_per_expert: 5, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true },
          { plan_key: 'PREMIUM', label: 'PREMIUM', price: 750000, duration_months: 6, max_projects: 999999, max_experts_manual: 999999, max_experts_directory: 999999, max_consultation_per_expert: 15, allow_subcriteria: true, allow_alternative_method: true, allow_ai_features: true },
        ];

    // 3. Ambil Data Langganan Individual Pengguna dari `AHP - subscriptions`
    let subRow: any = null;
    if (effectiveEmail) {
      const sRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - subscriptions\` WHERE LOWER(\`user_email\`) = ? LIMIT 1
      `, effectiveEmail).catch(() => []);
      if (sRows && sRows.length > 0) subRow = sRows[0];
    }

    const rawPlanKey = String(subRow?.plan || user?.plan || (isStudent ? 'STUDENT' : 'FREE')).toUpperCase().trim();
    const targetKey = isStudent 
      ? 'FREE' 
      : (rawPlanKey.includes('PREMIUM') ? 'PREMIUM' : rawPlanKey.includes('PLUS') ? 'PLUS' : rawPlanKey.includes('PRO') ? 'PRO' : 'FREE');

    const matchedMasterPlan = planConfigs.find((p) => p.plan_key === targetKey) || planConfigs[0];
    const effectivePlanKey = isStudent ? 'free' : targetKey.toLowerCase();

    // Nilai izin fitur dari SuperAdmin
    const effectiveAllowSub = isStudent ? true : parseBooleanVal(matchedMasterPlan?.allow_subcriteria);
    const effectiveAllowAlt = isStudent ? true : parseBooleanVal(matchedMasterPlan?.allow_alternative_method);
    const effectiveAllowAi = isStudent ? false : parseBooleanVal(matchedMasterPlan?.allow_ai_features);

    // Bangun string custom_features agar kompatibel dengan seluruh fungsi frontend lama
    let customFeaturesList: string[] = [];
    if (subRow?.custom_features) {
      customFeaturesList = String(subRow.custom_features).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    }
    if (effectiveAllowAi && !customFeaturesList.includes('ai')) customFeaturesList.push('ai');
    if (effectiveAllowSub && !customFeaturesList.includes('subcriteria')) customFeaturesList.push('subcriteria');
    if (effectiveAllowAlt && !customFeaturesList.includes('alternative')) customFeaturesList.push('alternative');
    const customFeaturesStr = customFeaturesList.join(',');

    // 🟢 SINKRONISASI MUTLAK: Gunakan konfigurasi aktif SuperAdmin
    const resolvedSubscription = {
      plan: effectivePlanKey,
      status: String(subRow?.status || 'active').toLowerCase(),
      user_email: effectiveEmail,
      
      // Kuota Proyek
      max_projects: isStudent 
        ? 2 
        : (effectivePlanKey === 'free'
            ? Number(matchedMasterPlan?.max_projects ?? 1)
            : (subRow?.max_projects !== undefined && subRow?.max_projects !== null && subRow?.max_projects !== ''
                ? Number(subRow.max_projects)
                : Number(matchedMasterPlan?.max_projects ?? 3))),

      // Kuota Pakar Manual
      max_experts: isStudent 
        ? 2 
        : (effectivePlanKey === 'free'
            ? Number(matchedMasterPlan?.max_experts_manual ?? 4)
            : (subRow?.max_experts !== undefined && subRow?.max_experts !== null && subRow?.max_experts !== ''
                ? Number(subRow.max_experts)
                : Number(matchedMasterPlan?.max_experts_manual ?? 8))),

      max_experts_manual: isStudent 
        ? 2 
        : (effectivePlanKey === 'free'
            ? Number(matchedMasterPlan?.max_experts_manual ?? 4)
            : (subRow?.max_experts !== undefined && subRow?.max_experts !== null && subRow?.max_experts !== ''
                ? Number(subRow.max_experts)
                : Number(matchedMasterPlan?.max_experts_manual ?? 8))),

      // Kuota Direktori Pakar
      max_experts_directory: isStudent 
        ? 0 
        : (effectivePlanKey === 'free'
            ? Number(matchedMasterPlan?.max_experts_directory ?? 0)
            : (subRow?.max_experts_directory !== undefined && subRow?.max_experts_directory !== null && subRow?.max_experts_directory !== ''
                ? Number(subRow.max_experts_directory)
                : Number(matchedMasterPlan?.max_experts_directory ?? 5))),

      // Kuota Konsultasi Pakar
      max_consultation_per_expert: isStudent 
        ? 0 
        : (effectivePlanKey === 'free'
            ? Number(matchedMasterPlan?.max_consultation_per_expert ?? 0)
            : (subRow?.max_consultation_per_expert !== undefined && subRow?.max_consultation_per_expert !== null && subRow?.max_consultation_per_expert !== ''
                ? Number(subRow.max_consultation_per_expert)
                : Number(matchedMasterPlan?.max_consultation_per_expert ?? 3))),

      // Status Izin Fitur (Subkriteria, Alternatif, dan AI)
      allow_subcriteria: effectiveAllowSub,
      allow_alternative_method: effectiveAllowAlt,
      allow_ai_features: effectiveAllowAi,

      custom_features: customFeaturesStr,
      notes: String(subRow?.notes || ''),
    };

    // 4. Ambil Proyek Pengguna & Saring Proyek Praktikum jika Akun Sudah General
    let projRows: any[] = [];
    if (effectiveEmail || userId) {
      const pConditions: string[] = [];
      const pParams: any[] = [];

      if (effectiveEmail) {
        pConditions.push('LOWER(`user_email`) = ?');
        pParams.push(effectiveEmail);
        pConditions.push('LOWER(`fasilitator_email`) = ?');
        pParams.push(effectiveEmail);
      }
      if (userId) {
        pConditions.push('`user_id` = ?');
        pParams.push(userId);
      }

      projRows = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - projects\` 
        WHERE ${pConditions.join(' OR ')}
        ORDER BY \`created_at\` DESC
      `, ...pParams).catch(() => []);
    }

    let finalProjects = projRows;
    if (!isStudent) {
      finalProjects = projRows.filter((p: any) => {
        const expName = String(p?.nama_expert ?? p?.namaExpert ?? '').toLowerCase();
        const fasName = String(p?.fasilitator_nama ?? p?.fasilitatorNama ?? '').toLowerCase();
        const pId = String(p?.project_id ?? p?.id ?? '').toUpperCase();
        const isSim = (
          expName.includes('simulasi') ||
          expName.includes('praktikum') ||
          expName.includes('linglungan') ||
          expName.includes('raos') ||
          fasName.includes('simulasi') ||
          pId.includes('SIM') ||
          Boolean(p?.is_student_project) ||
          Boolean(p?.is_student)
        );
        return !isSim;
      });

      // Bersihkan proyek simulasi praktikum yang tersisa di database MySQL
      if (projRows.length > finalProjects.length) {
        const simIds = projRows
          .filter((p: any) => !finalProjects.includes(p))
          .map((p: any) => String(p?.project_id ?? p?.id ?? ''))
          .filter(Boolean);

        for (const simId of simIds) {
          prisma.$executeRawUnsafe('DELETE FROM `AHP - project_experts` WHERE `project_id` = ?', simId).catch(() => {});
          prisma.$executeRawUnsafe('DELETE FROM `AHP - responses` WHERE `project_id` = ?', simId).catch(() => {});
          prisma.$executeRawUnsafe('DELETE FROM `AHP - criteria` WHERE `project_id` = ?', simId).catch(() => {});
          prisma.$executeRawUnsafe('DELETE FROM `AHP - subcriteria` WHERE `project_id` = ?', simId).catch(() => {});
          prisma.$executeRawUnsafe('DELETE FROM `AHP - alternatives` WHERE `project_id` = ?', simId).catch(() => {});
          prisma.$executeRawUnsafe('DELETE FROM `AHP - projects` WHERE `project_id` = ?', simId).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        isStudent,
        subscription: resolvedSubscription,
        plans: planConfigs,
        projects: finalProjects,
        visitorStats: Number(user?.jumlah_kunjungan || 1),
      },
    });
  } catch (error: any) {
    console.error('API Dashboard Summary Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}