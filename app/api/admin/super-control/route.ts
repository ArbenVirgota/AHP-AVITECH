// app/api/admin/super-control/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function parseBooleanToTinyInt(val: unknown): number {
  if (val === true || val === 1 || val === '1') return 1;
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return 1;
  return 0;
}

// GET: Mengambil data kontrol SuperAdmin
export async function GET() {
  try {
    const [rawAdminLogs, rawAdmins, rawSubscriptions, rawPlanSettings, rawSystemAssets, rawPaymentSettings, rawDiditSettings] = await Promise.all([
      // 1. Audit Trail (AHP - admin_logs)
      (async () => {
        try {
          const logs: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
              \`id\`,
              COALESCE(
                NULLIF(DATE_FORMAT(\`Timestamp\`, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00'),
                DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
              ) AS \`safe_timestamp\`,
              COALESCE(\`Nama_Admin\`, 'Admin Platform') AS \`nama_admin\`,
              COALESCE(\`Email_Admin\`, '-') AS \`email_admin\`,
              COALESCE(\`Role\`, 'Admin Pembantu') AS \`role\`,
              COALESCE(\`Aksi___Tindakan\`, 'AKTIVITAS') AS \`tindakan\`,
              COALESCE(\`Detail_Keterangan\`, '-') AS \`detail\`
            FROM \`AHP - admin_logs\`
            ORDER BY \`Timestamp\` DESC
            LIMIT 300
          `);

          return (logs || []).map((row, index) => ({
            id: row.id || index + 1,
            timestamp: row.safe_timestamp,
            nama_admin: row.nama_admin,
            email_admin: row.email_admin,
            role: row.role,
            tindakan: row.tindakan,
            detail: row.detail,
          }));
        } catch (err) {
          console.error('Gagal membaca tabel AHP - admin_logs:', err);
          return [];
        }
      })(),

      // 2. Akun Admin (AHP - Admins)
      (async () => {
        try {
          const admins: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
              \`id\`,
              COALESCE(\`nama\`, 'Admin') AS \`nama\`,
              COALESCE(\`email\`, '-') AS \`email\`,
              COALESCE(\`role\`, 'Admin Pembantu') AS \`role\`,
              COALESCE(\`wewenang_modul\`, '[]') AS \`wewenang_modul\`,
              COALESCE(\`status\`, 'Aktif') AS \`status\`
            FROM \`AHP - Admins\`
            ORDER BY \`id\` ASC
          `);
          return admins || [];
        } catch (err) {
          console.warn('Gagal membaca tabel AHP - Admins:', err);
          return [];
        }
      })(),

      // 3. Subscriptions (AHP - subscriptions)
      (async () => {
        try {
          const subs: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
              s.\`user_email\`,
              COALESCE(u.\`nama\`, 'User Terdaftar') AS \`nama\`,
              COALESCE(u.\`status_user\`, 'general') AS \`status_user\`,
              UPPER(COALESCE(s.\`plan\`, 'FREE')) AS \`plan\`,
              UPPER(COALESCE(s.\`status\`, 'ACTIVE')) AS \`status\`,
              DATE_FORMAT(s.\`expired_date\`, '%Y-%m-%d') AS \`expired_date\`,
              s.\`max_projects\`,
              s.\`max_experts\`,
              s.\`max_experts_directory\`,
              s.\`max_consultation_per_expert\`,
              COALESCE(s.\`custom_features\`, '') AS \`custom_features\`,
              COALESCE(s.\`notes\`, '') AS \`notes\`
            FROM \`AHP - subscriptions\` s
            LEFT JOIN \`AHP - users\` u ON LOWER(s.\`user_email\`) = LOWER(u.\`email\`)
            ORDER BY s.\`user_email\` ASC
          `);
          return (subs || []).map((item) => ({
            user_email: item.user_email,
            email: item.user_email,
            user_name: item.nama,
            nama: item.nama,
            status_user: String(item.status_user || 'general').toLowerCase(),
            plan: item.plan,
            status: item.status,
            expired_date: item.expired_date || '-',
            custom_max_projects: item.max_projects ?? '',
            custom_max_experts: item.max_experts ?? '',
            custom_max_experts_directory: item.max_experts_directory ?? '',
            custom_max_consultation_per_expert: item.max_consultation_per_expert ?? '',
            custom_features: item.custom_features,
            notes: item.notes,
          }));
        } catch (err) {
          console.error('Gagal membaca data subscriptions:', err);
          return [];
        }
      })(),

      // 4. Konfigurasi Batasan Paket (AHP - plan_settings)
      (async () => {
        try {
          const configs: any[] = await prisma.$queryRawUnsafe(`
            SELECT 
              \`plan_key\`,
              \`label\`,
              COALESCE(\`price\`, 0) AS \`price\`,
              COALESCE(\`duration_months\`, 6) AS \`duration_months\`,
              COALESCE(\`max_projects\`, 0) AS \`max_projects\`,
              COALESCE(\`max_experts_manual\`, 0) AS \`max_experts_manual\`,
              COALESCE(\`max_experts_directory\`, 0) AS \`max_experts_directory\`,
              COALESCE(\`max_consultation_per_expert\`, 0) AS \`max_consultation_per_expert\`,
              COALESCE(\`allow_subcriteria\`, 0) AS \`allow_subcriteria\`,
              COALESCE(\`allow_alternative_method\`, 0) AS \`allow_alternative_method\`,
              COALESCE(\`allow_ai_features\`, 0) AS \`allow_ai_features\`
            FROM \`AHP - plan_settings\`
            ORDER BY FIELD(UPPER(\`plan_key\`), 'FREE', 'PRO', 'PLUS', 'PREMIUM')
          `);
          return configs || [];
        } catch (err) {
          console.error('Gagal membaca tabel AHP - plan_settings:', err);
          return [];
        }
      })(),

      // 5. Aset Sistem (AHP - system_assets)
      (async () => {
        try {
          const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT \`setting_key\`, \`setting_value\` FROM \`AHP - system_assets\`
          `);
          const map: Record<string, string> = {};
          (rows || []).forEach((r) => {
            if (r.setting_key) map[r.setting_key] = r.setting_value || '';
          });
          return map;
        } catch (err) {
          console.warn('Gagal membaca tabel AHP - system_assets:', err);
          return {};
        }
      })(),

      // 6. Pengaturan Pembayaran (AHP - payment_settings)
      (async () => {
        try {
          const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT \`key_name\`, \`key_value\` FROM \`AHP - payment_settings\`
          `);
          const map: Record<string, string> = {};
          (rows || []).forEach((r) => {
            if (r.key_name) map[r.key_name] = r.key_value || '';
          });

          if (map['xendit_active'] === undefined && map['is_xendit_active'] !== undefined) {
            const rawVal = String(map['is_xendit_active']).toLowerCase().trim();
            map['xendit_active'] = rawVal === 'true' || rawVal === '1' ? '1' : '0';
          }

          return map;
        } catch (err) {
          console.warn('Gagal membaca tabel AHP - payment_settings:', err);
          return {};
        }
      })(),

      // 7. Pengaturan Didit (AHP - didit_settings)
      (async () => {
        try {
          const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT \`Key\`, \`Value\` FROM \`AHP - didit_settings\`
          `);
          const map: Record<string, string> = {};
          (rows || []).forEach((r) => {
            if (r.Key) map[r.Key] = r.Value || '';
          });

          const activeRaw = map['didit_me_active'] ?? map['didit_active'] ?? map['is_didit_active'] ?? '0';
          const apiKeyRaw = map['didit_api_key'] ?? map['api_key'] ?? '';

          map['didit_me_active'] = String(activeRaw).toLowerCase().trim() === 'true' || activeRaw === '1' ? '1' : '0';
          map['didit_api_key'] = apiKeyRaw;

          return map;
        } catch (err) {
          console.warn('Gagal membaca tabel AHP - didit_settings:', err);
          return { didit_me_active: '0', didit_api_key: '' };
        }
      })(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        adminLogs: rawAdminLogs,
        admins: rawAdmins,
        subscriptions: rawSubscriptions,
        planConfigs: rawPlanSettings,
        systemAssets: rawSystemAssets,
        paymentSettings: rawPaymentSettings,
        diditSettings: rawDiditSettings,
        totalLogs: rawAdminLogs.length,
        totalAdmins: rawAdmins.length,
      },
    });
  } catch (error) {
    console.error('API Super Control GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal memuat data kontrol SuperAdmin.',
      },
      { status: 500 }
    );
  }
}

// POST: Eksekusi perubahan data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1. TAMBAH / UPDATE ADMIN
    if (action === 'save_admin') {
      const { id, nama, email, password, role, status, allowed_access, admin_operator } = body;
      const cleanNama = String(nama || 'Admin').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanRole = String(role || 'Admin Pembantu').trim();
      const cleanStatus = String(status || 'Aktif').trim();
      const cleanAccess = typeof allowed_access === 'string' ? allowed_access : JSON.stringify(allowed_access || []);
      const cleanPassword = password ? String(password).trim() : '';

      if (!cleanEmail) {
        return NextResponse.json({ success: false, message: 'Email admin wajib diisi.' }, { status: 400 });
      }

      if (id) {
        if (cleanPassword && cleanPassword.length >= 6) {
          await prisma.$executeRawUnsafe(
            `UPDATE \`AHP - Admins\` 
             SET \`nama\` = ?, \`role\` = ?, \`password\` = ?, \`status\` = ?, \`wewenang_modul\` = ? 
             WHERE \`id\` = ? OR LOWER(\`email\`) = ?`,
            cleanNama, cleanRole, cleanPassword, cleanStatus, cleanAccess, Number(id), cleanEmail
          );
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE \`AHP - Admins\` 
             SET \`nama\` = ?, \`role\` = ?, \`status\` = ?, \`wewenang_modul\` = ? 
             WHERE \`id\` = ? OR LOWER(\`email\`) = ?`,
            cleanNama, cleanRole, cleanStatus, cleanAccess, Number(id), cleanEmail
          );
        }

        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
           VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_ADMIN', ?)`,
          String(admin_operator || 'SuperAdmin'), 'admin@avitech.cloud', 'Pembaruan akun admin ' + cleanEmail
        );

        return NextResponse.json({ success: true, message: 'Data akun admin berhasil diperbarui di database!' });
      } else {
        const initialPassword = cleanPassword && cleanPassword.length >= 6 ? cleanPassword : 'admin123';

        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - Admins\` (\`nama\`, \`email\`, \`password\`, \`role\`, \`wewenang_modul\`, \`status\`)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             \`nama\` = VALUES(\`nama\`), 
             \`role\` = VALUES(\`role\`), 
             \`password\` = VALUES(\`password\`),
             \`wewenang_modul\` = VALUES(\`wewenang_modul\`), 
             \`status\` = VALUES(\`status\`)`,
          cleanNama, cleanEmail, initialPassword, cleanRole, cleanAccess, cleanStatus
        );

        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
           VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'TAMBAH_ADMIN', ?)`,
          String(admin_operator || 'SuperAdmin'), 'admin@avitech.cloud', 'Menambahkan admin baru ' + cleanEmail
        );

        return NextResponse.json({ success: true, message: 'Akun admin baru berhasil disimpan ke database!' });
      }
    }

    // 2. HAPUS ADMIN
    if (action === 'delete_admin') {
      const { email, admin_operator } = body;
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!cleanEmail) {
        return NextResponse.json({ success: false, message: 'Email admin tidak valid.' }, { status: 400 });
      }

      await prisma.$executeRawUnsafe(`DELETE FROM \`AHP - Admins\` WHERE LOWER(\`email\`) = ?`, cleanEmail);

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'HAPUS_ADMIN', ?)`,
        String(admin_operator || 'SuperAdmin'), 'admin@avitech.cloud', 'Menghapus akun admin ' + cleanEmail
      );

      return NextResponse.json({ success: true, message: 'Akun admin berhasil dihapus dari database.' });
    }

    // 3. UPDATE SUBSCRIPTION USER (DIPERBAIKI: Sinkronisasi status_user, role, dan is_student)
    if (action === 'update_subscription') {
      const {
        user_email,
        plan,
        status,
        status_user,
        expired_date,
        max_projects,
        max_experts,
        max_experts_directory,
        max_consultation_per_expert,
        custom_features,
        notes,
        admin_operator,
      } = body;

      const cleanEmail = String(user_email || '').trim().toLowerCase();
      if (!cleanEmail) {
        return NextResponse.json({ success: false, message: 'Email pengguna tidak valid.' }, { status: 400 });
      }

      const planUpper = String(plan || 'FREE').toUpperCase().trim();
      const statusUpper = String(status || 'ACTIVE').toUpperCase().trim();
      const statusUserVal = String(status_user || 'general').toLowerCase().trim();
      const expDateVal = expired_date ? String(expired_date).slice(0, 10) : null;

      const parseNumOrNull = (val: any) => {
        if (val === '' || val === null || val === undefined) return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      };

      // 1. Simpan/Update ke tabel AHP - subscriptions
      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - subscriptions\` 
         (\`user_email\`, \`plan\`, \`status\`, \`expired_date\`, \`max_projects\`, \`max_experts\`, \`max_experts_directory\`, \`max_consultation_per_expert\`, \`custom_features\`, \`notes\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           \`plan\` = VALUES(\`plan\`),
           \`status\` = VALUES(\`status\`),
           \`expired_date\` = VALUES(\`expired_date\`),
           \`max_projects\` = VALUES(\`max_projects\`),
           \`max_experts\` = VALUES(\`max_experts\`),
           \`max_experts_directory\` = VALUES(\`max_experts_directory\`),
           \`max_consultation_per_expert\` = VALUES(\`max_consultation_per_expert\`),
           \`custom_features\` = VALUES(\`custom_features\`),
           \`notes\` = VALUES(\`notes\`)`,
        cleanEmail,
        planUpper,
        statusUpper,
        expDateVal,
        parseNumOrNull(max_projects),
        parseNumOrNull(max_experts),
        parseNumOrNull(max_experts_directory),
        parseNumOrNull(max_consultation_per_expert),
        String(custom_features || '').trim(),
        String(notes || '').trim()
      );

      // 2. Sinkronkan status_user, role, dan is_student ke tabel AHP - users secara tangguh
      const isStudentRole = statusUserVal === 'student';
      const targetRole = isStudentRole ? 'student' : 'user';
      const targetIsStudent = isStudentRole ? 1 : 0;

      try {
        await prisma.$executeRawUnsafe(
          `UPDATE \`AHP - users\` 
           SET 
             \`status_user\` = ?,
             \`role\` = ?,
             \`is_student\` = ?
           WHERE LOWER(\`email\`) = ?`,
          statusUserVal,
          targetRole,
          targetIsStudent,
          cleanEmail
        );
      } catch (errFirst) {
        // Fallback jika salah satu kolom (misal is_student) tidak ada di skema MySQL
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE \`AHP - users\` 
             SET 
               \`status_user\` = ?,
               \`role\` = ?
             WHERE LOWER(\`email\`) = ?`,
            statusUserVal,
            targetRole,
            cleanEmail
          );
        } catch (errSecond) {
          // Fallback paling minimal: hanya update status_user
          await prisma.$executeRawUnsafe(
            `UPDATE \`AHP - users\` 
             SET \`status_user\` = ? 
             WHERE LOWER(\`email\`) = ?`,
            statusUserVal,
            cleanEmail
          ).catch((e) => console.error('Gagal update status_user di AHP - users:', e));
        }
      }

      // Sinkronkan ke tabel user jika tabel tersebut digunakan
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE \`user\` 
           SET 
             \`status_user\` = ?,
             \`role\` = ?
           WHERE LOWER(\`email\`) = ?`,
          statusUserVal,
          targetRole,
          cleanEmail
        );
      } catch (e) {
        // Abaikan jika tabel `user` tidak ada
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_SUBSCRIPTION', ?)`,
        String(admin_operator || 'SuperAdmin'),
        'admin@avitech.cloud',
        `Ubah paket ${cleanEmail} ke${planUpper} (${statusUpper}) [Status:${statusUserVal}]`
      );

      return NextResponse.json({
        success: true,
        message: `Hak akses privilege untuk ${cleanEmail} berhasil diperbarui di database!`,
      });
    }

    // 4. SIMPAN PLAN SETTINGS
    if (action === 'save_plans') {
      const { plans, admin_operator } = body;

      if (!Array.isArray(plans) || plans.length === 0) {
        return NextResponse.json({ success: false, message: 'Data paket tidak valid.' }, { status: 400 });
      }

      for (const p of plans) {
        const planKey = String(p.plan_key || '').toUpperCase().trim();
        if (!planKey) continue;

        await prisma.$executeRawUnsafe(
          `UPDATE \`AHP - plan_settings\` 
           SET 
             \`label\` = ?,
             \`price\` = ?,
             \`duration_months\` = ?,
             \`max_projects\` = ?,
             \`max_experts_manual\` = ?,
             \`max_experts_directory\` = ?,
             \`max_consultation_per_expert\` = ?,
             \`allow_subcriteria\` = ?,
             \`allow_alternative_method\` = ?,
             \`allow_ai_features\` = ?
           WHERE UPPER(\`plan_key\`) = ?`,
          String(p.label || planKey).trim(),
          Number(p.price) || 0,
          Number(p.duration_months) || 6,
          Number(p.max_projects) || 0,
          Number(p.max_experts_manual) || 0,
          Number(p.max_experts_directory) || 0,
          Number(p.max_consultation_per_expert) || 0,
          parseBooleanToTinyInt(p.allow_subcriteria),
          parseBooleanToTinyInt(p.allow_alternative_method),
          parseBooleanToTinyInt(p.allow_ai_features),
          planKey
        );
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_PLAN_SETTINGS', ?)`,
        String(admin_operator || 'SuperAdmin'),
        'admin@avitech.cloud',
        'Memperbarui konfigurasi batasan paket komersial di database'
      );

      return NextResponse.json({
        success: true,
        message: 'Konfigurasi batasan paket berhasil diperbarui di database!',
      });
    }

    // 5. SIMPAN TANDA TANGAN, LOGO, DAN PAYMENT GATEWAY
    if (action === 'save_payment_signature') {
      const {
        active_signer_type,
        superadmin_signature_url,
        backup_signer_name,
        backup_signer_title,
        backup_signer_signature_url,
        app_system_stamp_url,
        xendit_active,
        xendit_mode,
        xendit_public_key,
        xendit_secret_key,
        didit_me_active,
        didit_api_key,
        admin_operator,
      } = body;

      const systemAssetsData: [string, string][] = [
        ['active_signer_type', String(active_signer_type || 'main')],
        ['superadmin_signature_url', String(superadmin_signature_url || '')],
        ['backup_signer_name', String(backup_signer_name || '')],
        ['backup_signer_title', String(backup_signer_title || '')],
        ['backup_signer_signature_url', String(backup_signer_signature_url || '')],
        ['app_system_stamp_url', String(app_system_stamp_url || '')],
      ];

      for (const [sKey, sVal] of systemAssetsData) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - system_assets\` (\`setting_key\`, \`setting_value\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`)`,
          sKey,
          sVal
        );
      }

      const paymentData: [string, string][] = [
        ['xendit_active', xendit_active ? '1' : '0'],
        ['xendit_mode', String(xendit_mode || 'sandbox')],
        ['xendit_public_key', String(xendit_public_key || '')],
        ['xendit_secret_key', String(xendit_secret_key || '')],
      ];

      for (const [pKey, pVal] of paymentData) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - payment_settings\` (\`key_name\`, \`key_value\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`key_value\` = VALUES(\`key_value\`)`,
          pKey,
          pVal
        );
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM \`AHP - payment_settings\` WHERE \`key_name\` = 'is_xendit_active'`
      );

      const diditData: [string, string][] = [
        ['didit_me_active', didit_me_active ? '1' : '0'],
        ['didit_api_key', String(didit_api_key || '')],
      ];

      for (const [dKey, dVal] of diditData) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - didit_settings\` (\`Key\`, \`Value\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`Value\` = VALUES(\`Value\`)`,
          dKey,
          dVal
        );
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM \`AHP - didit_settings\` 
         WHERE \`Key\` NOT IN ('didit_me_active', 'didit_api_key')`
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_PAYMENT_SIGNATURE', ?)`,
        String(admin_operator || 'SuperAdmin'),
        'admin@avitech.cloud',
        'Memperbarui aset sistem (tanda tangan/stempel) dan konfigurasi pembayaran di database'
      );

      return NextResponse.json({
        success: true,
        message: 'Pengaturan tanda tangan, stempel, dan gateway pembayaran berhasil disimpan ke database!',
      });
    }

    // 6. SIMPAN PENGATURAN RETENSI & ARSIP PROYEK UMUM
    if (action === 'save_project_retention') {
      const { expiration_months, auto_delete_enabled, admin_operator } = body;

      const retentionData: [string, string][] = [
        ['project_retention_months', String(Number(expiration_months) || 6)],
        ['project_auto_archive_enabled', auto_delete_enabled ? '1' : '0'],
      ];

      for (const [rKey, rVal] of retentionData) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO \`AHP - system_assets\` (\`setting_key\`, \`setting_value\`)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`)`,
          rKey,
          rVal
        );
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_PROJECT_RETENTION', ?)`,
        String(admin_operator || 'SuperAdmin'),
        'admin@avitech.cloud',
        `Memperbarui kebijakan retensi proyek (${expiration_months} bulan, otomatisasi:${auto_delete_enabled ? 'Aktif' : 'Nonaktif'})`
      );

      return NextResponse.json({
        success: true,
        message: 'Kebijakan retensi dan kedaluwarsa proyek berhasil diperbarui di database!',
      });
    }

    // 7. SIMPAN PENGATURAN RETENSI DATA MAHASISWA (STUDENT EDITION)
    if (action === 'save_student_retention') {
      const { student_retention_days, admin_operator } = body;
      const days = Math.max(1, parseInt(String(student_retention_days || 30), 10));

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - system_assets\` (\`setting_key\`, \`setting_value\`)
         VALUES ('student_retention_days', ?)
         ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`)`,
        String(days)
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO \`AHP - admin_logs\` (\`Timestamp\`, \`Nama_Admin\`, \`Email_Admin\`, \`Role\`, \`Aksi___Tindakan\`, \`Detail_Keterangan\`)
         VALUES (DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR), ?, ?, 'SuperAdmin', 'UPDATE_STUDENT_RETENTION', ?)`,
        String(admin_operator || 'SuperAdmin'),
        'admin@avitech.cloud',
        `Memperbarui masa retensi akun praktikum mahasiswa menjadi ${days} hari`
      ).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Masa retensi data mahasiswa berhasil disimpan (${days} hari).`,
      });
    }

    // 8. CLEAR LOGS
    if (action === 'clear_admin_logs') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`AHP - admin_logs\``);
      return NextResponse.json({ success: true, message: 'Seluruh riwayat log aktivitas berhasil dibersihkan.' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenali.' }, { status: 400 });
  } catch (error) {
    console.error('API Super Control POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal memproses aksi pada panel SuperAdmin.',
      },
      { status: 500 }
    );
  }
}