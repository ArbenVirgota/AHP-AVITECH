// app/api/reports/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export const dynamic = 'force-dynamic';

function getDbConnectionConfig() {
  const rawUrl = process.env.DATABASE_URL || '';
  if (!rawUrl) {
    throw new Error('DATABASE_URL belum didefinisikan pada file .env');
  }

  try {
    // Parse URL standar mysql://user:password@host:port/database
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      connectTimeout: 20000,
    };
  } catch {
    // Fallback jika parsing URL gagal, ambil string sebelum query parameter
    return {
      uri: rawUrl.split('?')[0],
      connectTimeout: 20000,
    };
  }
}

// 🟢 HANDLER POST: Menyimpan / Memperbarui Snapshot Verifikasi Laporan ke MySQL
export async function POST(req: NextRequest) {
  let connection: mysql.Connection | null = null;
  try {
    const body = await req.json();
    const {
      projectId,
      projectName,
      method,
      facilitatorName,
      facilitatorEmail,
      facilitatorInstitution,
      totalExperts,
      rankings,
      crSummary,
      narrativeSummary
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: 'Project ID wajib diisi.' },
        { status: 400 }
      );
    }

    const config = getDbConnectionConfig();
    connection = await mysql.createConnection(config as any);

    const verificationId = `VER-${projectId}`;
    const tokenPayload = `${projectId}-${Date.now()}`;
    const verificationToken = crypto
      .createHash('sha256')
      .update(tokenPayload)
      .digest('hex')
      .substring(0, 32);

    const verifiedUrl = `https://ahp.avitech.cloud/verify?doc=${verificationId}&token=${verificationToken}`;

    const query = `
      INSERT INTO report_verifications (
        id, project_id, project_name, method, 
        facilitator_name, facilitator_email, facilitator_institution, 
        total_experts, rankings_json, cr_summary_json, narrative_summary, 
        verification_token, verified_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        project_name = VALUES(project_name),
        method = VALUES(method),
        facilitator_name = VALUES(facilitator_name),
        facilitator_email = VALUES(facilitator_email),
        facilitator_institution = VALUES(facilitator_institution),
        total_experts = VALUES(total_experts),
        rankings_json = VALUES(rankings_json),
        cr_summary_json = VALUES(cr_summary_json),
        narrative_summary = VALUES(narrative_summary),
        verified_url = VALUES(verified_url),
        updated_at = NOW()
    `;

    await connection.execute(query, [
      verificationId,
      projectId,
      projectName || 'Proyek AHP',
      method || 'AHP',
      facilitatorName || '',
      facilitatorEmail || '',
      facilitatorInstitution || '',
      Number(totalExperts) || 0,
      JSON.stringify(rankings || []),
      JSON.stringify(crSummary || []),
      narrativeSummary || '',
      verificationToken,
      verifiedUrl
    ]);

    return NextResponse.json({
      success: true,
      message: 'Data verifikasi berhasil disimpan ke basis data MySQL.',
      data: {
        verificationId,
        verificationToken,
        verifiedUrl
      }
    });
  } catch (error: any) {
    console.error('Database Error POST /api/reports/verify:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error?.message || 'Gagal menyimpan snapshot ke basis data MySQL.' 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 🟢 HANDLER GET: Mengambil Data Verifikasi untuk Halaman Publik /verify
export async function GET(req: NextRequest) {
  let connection: mysql.Connection | null = null;
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('doc') || searchParams.get('id');

    if (!docId) {
      return NextResponse.json(
        { success: false, message: 'Parameter ID Dokumen (doc/id) tidak ditemukan.' },
        { status: 400 }
      );
    }

    const config = getDbConnectionConfig();
    connection = await mysql.createConnection(config as any);

    const query = `
      SELECT * FROM report_verifications 
      WHERE id = ? OR project_id = ? 
      LIMIT 1
    `;
    const [rows]: any = await connection.execute(query, [docId, docId]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Dokumen verifikasi tidak terdaftar pada basis data.' },
        { status: 404 }
      );
    }

    const row = rows[0];

    // Parsing kolom JSON agar siap dipakai langsung oleh frontend verify
    let rankings = [];
    let crSummary = [];
    try {
      rankings = typeof row.rankings_json === 'string' ? JSON.parse(row.rankings_json) : (row.rankings_json || []);
    } catch {
      rankings = [];
    }

    try {
      crSummary = typeof row.cr_summary_json === 'string' ? JSON.parse(row.cr_summary_json) : (row.cr_summary_json || []);
    } catch {
      crSummary = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        project_id: row.project_id,
        project_name: row.project_name,
        method: row.method,
        facilitator_name: row.facilitator_name,
        facilitator_email: row.facilitator_email,
        facilitator_institution: row.facilitator_institution,
        total_experts: row.total_experts,
        rankings: rankings,
        crSummary: crSummary,
        narrative_summary: row.narrative_summary,
        verification_token: row.verification_token,
        verified_url: row.verified_url,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    });
  } catch (error: any) {
    console.error('Database Error GET /api/reports/verify:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error?.message || 'Gagal membaca data verifikasi dari basis data.' 
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}