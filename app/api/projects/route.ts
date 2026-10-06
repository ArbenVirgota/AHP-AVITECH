// app/api/projects/route.ts

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

async function getTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `, tableName);
    return new Set((rows || []).map((r: any) => String(r.COLUMN_NAME).toLowerCase()));
  } catch {
    return new Set();
  }
}

// Helper: Pembersihan otomatis proyek mahasiswa yang melewati masa retensi 6 bulan
async function cleanupExpiredStudentProjects(email: string, userId: string) {
  try {
    if (!email && !userId) return;

    const expiredProjects: any[] = await prisma.$queryRawUnsafe(`
      SELECT \`project_id\` FROM \`AHP - projects\`
      WHERE (LOWER(\`user_email\`) = ? OR \`user_id\` = ?)
        AND (\`created_at\` < NOW() - INTERVAL 6 MONTH)
    `, email, userId);

    if (expiredProjects && expiredProjects.length > 0) {
      for (const p of expiredProjects) {
        const pid = p.project_id;
        if (!pid) continue;
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - project_experts` WHERE `project_id` = ?', pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - responses` WHERE `project_id` = ?', pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - criteria` WHERE `project_id` = ?', pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - subcriteria` WHERE `project_id` = ?', pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - alternatives` WHERE `project_id` = ?', pid).catch(() => {});
        await prisma.$executeRawUnsafe('DELETE FROM `AHP - projects` WHERE `project_id` = ?', pid).catch(() => {});
      }
      console.log(`[CLEANUP] Berhasil membersihkan ${expiredProjects.length} proyek Student Edition yang melewati batas 6 bulan.`);
    }
  } catch (err: any) {
    console.warn('[CLEANUP-WARN] Gagal menjalankan pembersihan retensi 6 bulan:', err.message);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.toLowerCase().trim() || '';
    const userId = searchParams.get('user_id')?.trim() || '';
    const projectId = searchParams.get('id')?.trim() || '';

    // Cek apakah pengguna bertipe 'student' untuk evaluasi retensi 6 bulan
    if (email || userId) {
      let userRecord: any = null;
      try {
        const uRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT status_user FROM \`AHP - users\`
          WHERE ${email ? 'LOWER(`email`) = ?' : ''} ${email && userId ? 'OR' : ''} ${userId ? '`user_id` = ?' : ''}
          LIMIT 1
        `, ...(email && userId ? [email, userId] : email ? [email] : [userId])).catch(() => []);
        if (uRows && uRows.length > 0) userRecord = uRows[0];
      } catch {}

      if (!userRecord) {
        userRecord = await (prisma as any).user?.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(userId ? [{ user_id: userId }] : []),
            ],
          },
          select: { status_user: true },
        }).catch(() => null);
      }

      if (userRecord?.status_user?.toLowerCase() === 'student') {
        await cleanupExpiredStudentProjects(email, userId);
      }
    }

    const cols = await getTableColumns('AHP - projects');

    if (projectId) {
      const idCol = cols.has('project_id') ? '`project_id`' : cols.has('id') ? '`id`' : '`projectid`';
      const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM \`AHP - projects\`
        WHERE ${idCol} = ?
        LIMIT 1
      `, projectId);

      if (!rows || rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Proyek tidak ditemukan.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: rows[0],
      });
    }

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (email) {
      if (cols.has('user_email')) {
        whereConditions.push('LOWER(`user_email`) = ?');
        params.push(email);
      } else if (cols.has('useremail')) {
        whereConditions.push('LOWER(`useremail`) = ?');
        params.push(email);
      }

      if (cols.has('fasilitator_email')) {
        whereConditions.push('LOWER(`fasilitator_email`) = ?');
        params.push(email);
      } else if (cols.has('fasilitatoremail')) {
        whereConditions.push('LOWER(`fasilitatoremail`) = ?');
        params.push(email);
      }
    }

    if (userId) {
      if (cols.has('user_id')) {
        whereConditions.push('`user_id` = ?');
        params.push(userId);
      } else if (cols.has('userid')) {
        whereConditions.push('`userid` = ?');
        params.push(userId);
      }
    }

    let query = 'SELECT * FROM `AHP - projects`';
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' OR ')}`;
    }

    const orderCol = cols.has('created_at') ? '`created_at`' : cols.has('createdat') ? '`createdat`' : '`id`';
    query += ` ORDER BY ${orderCol} DESC`;

    const projects: any[] = await prisma.$queryRawUnsafe(query, ...params);

    return NextResponse.json({
      success: true,
      data: projects || [],
    });
  } catch (error: any) {
    console.error('API Projects GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengambil data proyek.',
        data: [],
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email || body.user_email || '').trim().toLowerCase();
    const userId = String(body.user_id || body.userId || '').trim();
    const namaProyek = String(body.nama_proyek || body.namaProyek || body.namaproyek || '').trim();
    const deskripsi = String(body.deskripsi || '').trim();
    const metode = String(body.metode || 'Bobot saja').trim();
    let jumlahExpert = Number(body.jumlah_expert || body.jumlahExpert || body.jumlahexpert || 1);
    
    // Fasilitator: Pastikan email dan nama fasilitator murni milik akun pembuat proyek
    const fasilitatorEmail = String(body.fasilitator_email || body.fasilitatorEmail || email).trim().toLowerCase();
    const fasilitatorWhatsapp = String(body.fasilitator_whatsapp || body.fasilitatorWhatsapp || '').trim();
    let fasilitatorNama = String(body.fasilitator_nama || body.fasilitatorNama || '').trim();

    let namaExpert = String(body.nama_expert || body.namaExpert || 'Evaluator Pakar').trim();
    const punyaSubkriteria = Boolean(body.punya_subkriteria ?? body.punyasubkriteria ?? false);

    const rawKriteria = body.kriteria || body.criteria || [];
    const rawSubkriteria = body.subkriteria || body.subcriteria || [];
    const rawAlternatif = body.alternatif || body.alternative || [];

    if (!namaProyek) {
      return NextResponse.json({ success: false, message: 'Nama proyek wajib diisi.' }, { status: 400 });
    }

    // 1. Cek Profil dan Role Pengguna dari Basis Data
    let userRecord: any = null;
    if (email || userId) {
      try {
        const uRows: any[] = await prisma.$queryRawUnsafe(`
          SELECT * FROM \`AHP - users\`
          WHERE ${email ? 'LOWER(`email`) = ?' : ''} ${email && userId ? 'OR' : ''} ${userId ? '`user_id` = ?' : ''}
          LIMIT 1
        `, ...(email && userId ? [email, userId] : email ? [email] : [userId])).catch(() => []);
        if (uRows && uRows.length > 0) userRecord = uRows[0];
      } catch {}

      if (!userRecord) {
        userRecord = await (prisma as any).user?.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(userId ? [{ user_id: userId }] : []),
            ],
          },
        }).catch(() => null);
      }
    }

    // Ambil nama fasilitator dari basis data jika belum tersedia
    if (!fasilitatorNama && userRecord) {
      fasilitatorNama = String(userRecord.nama || userRecord.name || '').trim();
    }
    if (!fasilitatorNama) {
      fasilitatorNama = 'Fasilitator Utama';
    }

    let isStudent = false;
    const statusUserStr = String(userRecord?.status_user || body.status_user || '').toLowerCase().trim();
    if (statusUserStr === 'student') {
      isStudent = true;
    }

    // 2. Validasi Server-Side Khusus Akun Student Edition
    if (isStudent) {
      if (!Array.isArray(rawKriteria) || rawKriteria.length < 3) {
        return NextResponse.json({
          success: false,
          message: 'Student Edition: Minimal 3 kriteria utama harus diisi agar rasio konsistensi (CR) dapat dihitung.',
        }, { status: 400 });
      }
      if (rawKriteria.length > 3) {
        return NextResponse.json({
          success: false,
          message: 'Student Edition: Dibatasi maksimal 3 kriteria utama untuk mode praktikum.',
        }, { status: 400 });
      }

      if (punyaSubkriteria && Array.isArray(rawSubkriteria)) {
        const subCountPerCrit: Record<string, number> = {};
        for (const item of rawSubkriteria) {
          const pKey = String(item.criteria_id || item.criteriaid || item.parent_id || item.criteria_name || item.parent_name || 'default');
          subCountPerCrit[pKey] = (subCountPerCrit[pKey] || 0) + 1;
        }

        for (const count of Object.values(subCountPerCrit)) {
          if (count < 3) {
            return NextResponse.json({
              success: false,
              message: 'Student Edition: Setiap kriteria wajib memiliki minimal 3 subkriteria agar rasio konsistensi (CR) dapat dihitung.',
            }, { status: 400 });
          }
          if (count > 3) {
            return NextResponse.json({
              success: false,
              message: 'Student Edition: Setiap kriteria dibatasi maksimal 3 subkriteria.',
            }, { status: 400 });
          }
        }
      }

      if (metode.toLowerCase().includes('alternatif')) {
        if (!Array.isArray(rawAlternatif) || rawAlternatif.length < 2) {
          return NextResponse.json({
            success: false,
            message: 'Student Edition: Minimal 2 alternatif pilihan harus diisi.',
          }, { status: 400 });
        }
        if (rawAlternatif.length > 3) {
          return NextResponse.json({
            success: false,
            message: 'Student Edition: Dibatasi maksimal 3 alternatif pilihan.',
          }, { status: 400 });
        }
      }
    } else {
      if (!Array.isArray(rawKriteria) || rawKriteria.length < 2) {
        return NextResponse.json({
          success: false,
          message: 'Minimal 2 kriteria utama wajib diisi.',
        }, { status: 400 });
      }
      if (metode.toLowerCase().includes('alternatif') && (!Array.isArray(rawAlternatif) || rawAlternatif.length < 2)) {
        return NextResponse.json({
          success: false,
          message: 'Minimal 2 alternatif pilihan wajib diisi jika memilih metode bobot alternatif.',
        }, { status: 400 });
      }
    }

    // 3. Aturan Batas Kuota & Penyiapan Pakar
    let expertsList = Array.isArray(body.experts_data || body.experts || body.pakar) ? (body.experts_data || body.experts || body.pakar) : [];

    if (isStudent) {
      await cleanupExpiredStudentProjects(email, userId);

      const countRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) AS total FROM \`AHP - projects\`
        WHERE (LOWER(\`user_email\`) = ? OR \`user_id\` = ?)
      `, email, userId);

      const totalStudentProjects = Number(countRows[0]?.total || 0);

      if (totalStudentProjects >= 2) {
        return NextResponse.json({
          success: false,
          message: 'Batas kuota akun Student Edition telah tercapai (maksimal 2 proyek). Silakan hapus salah satu proyek lama Anda untuk membuat proyek baru.',
        }, { status: 400 });
      }

      jumlahExpert = 2;
      namaExpert = 'Simulasi Praktikum (2 Pakar)';

      let simExperts: any[] = [];
      try {
        simExperts = await prisma.$queryRawUnsafe(`
          SELECT \`expert_id\`, \`expert_name\`, \`expert_email\`, \`expert_whatsapp\`, \`gelar_depan\`, \`gelar_belakang\`
          FROM \`AHP - experts\`
          WHERE \`source\` = 'SIMULASI' 
             OR LOWER(\`expert_email\`) IN ('pakar1@gmail.com', 'pakar2@gmail.com')
             OR \`expert_name\` LIKE '%Linglungan%' 
             OR \`expert_name\` LIKE '%Raos%'
          LIMIT 2
        `);
      } catch (e: any) {
        console.warn('Gagal membaca pakar simulasi:', e.message);
      }

      if (simExperts && simExperts.length >= 2) {
        expertsList = simExperts.map((exp: any) => ({
          expert_id: exp.expert_id,
          fullName: [exp.gelar_depan, exp.expert_name, exp.gelar_belakang].filter(Boolean).join(' ').trim() || exp.expert_name,
          expert_email: exp.expert_email,
          expert_whatsapp: exp.expert_whatsapp || '',
          token: `TOK-SIM-${Math.floor(100 + Math.random() * 900)}`,
        }));
      } else {
        expertsList = [
          {
            expert_id: 'EXP-1790470094681',
            fullName: 'Prof. Linglungan',
            expert_email: 'pakar1@gmail.com',
            expert_whatsapp: '081234567891',
            token: `TOK-SIM-${Math.floor(100 + Math.random() * 900)}`,
          },
          {
            expert_id: 'EXP-1790470345671',
            fullName: 'DR. Raos',
            expert_email: 'pakar2@gmail.com',
            expert_whatsapp: '081234567892',
            token: `TOK-SIM-${Math.floor(100 + Math.random() * 900)}`,
          },
        ];
      }
    } else {
      // User Umum: Tentukan label nama pakar utama
      if (expertsList.length > 0) {
        const firstExp = expertsList[0];
        const firstEmail = String(firstExp.expert_email || firstExp.email || '').trim().toLowerCase();
        if (firstEmail) {
          try {
            const matchedFirst: any[] = await prisma.$queryRawUnsafe(`
              SELECT * FROM \`AHP - experts\` WHERE LOWER(\`expert_email\`) = ? LIMIT 1
            `, firstEmail);
            if (matchedFirst && matchedFirst.length > 0) {
              const m = matchedFirst[0];
              const gd = String(m.gelar_depan || '').trim();
              const cn = String(m.expert_name || m.nama || '').trim();
              const gb = String(m.gelar_belakang || '').trim();
              namaExpert = `${gd ? gd + ' ' : ''}${cn}${gb ? ', ' + gb : ''}`;
            } else {
              namaExpert = String(firstExp.fullName || firstExp.expert_name || firstExp.name || firstExp.nama || 'Evaluator Pakar').trim();
            }
          } catch {
            namaExpert = String(firstExp.fullName || firstExp.expert_name || firstExp.name || firstExp.nama || 'Evaluator Pakar').trim();
          }
        } else {
          namaExpert = String(firstExp.fullName || firstExp.expert_name || firstExp.name || firstExp.nama || 'Evaluator Pakar').trim();
        }
      }
    }

    const projectId = String(body.project_id || body.id || `PRJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`).trim();
    const projectCols = await getTableColumns('AHP - projects');

    // 🟢 Pemetaan Kolom Proyek: fasilitator_nama dan nama_expert dipisahkan
    const projFieldMap: Record<string, any> = {
      project_id: projectId,
      projectid: projectId,
      nama_proyek: namaProyek,
      namaproyek: namaProyek,
      deskripsi: deskripsi,
      metode: metode,
      user_email: email,
      useremail: email,
      user_id: userId,
      userid: userId,
      fasilitator_email: fasilitatorEmail,
      fasilitatoremail: fasilitatorEmail,
      fasilitator_whatsapp: fasilitatorWhatsapp,
      fasilitatorwhatsapp: fasilitatorWhatsapp,

      // Murni identitas Fasilitator Utama (Pengguna Login)
      fasilitator_nama: fasilitatorNama,
      fasilitatornama: fasilitatorNama,

      // Murni identitas Pakar Responden / Mode Simulasi
      nama_expert: namaExpert,
      namaexpert: namaExpert,

      jumlah_expert: jumlahExpert,
      jumlahexpert: jumlahExpert,
      punya_subkriteria: punyaSubkriteria ? 1 : 0,
      punyasubkriteria: punyaSubkriteria ? 1 : 0,
      subcriteria_count: Array.isArray(rawSubkriteria) ? rawSubkriteria.length : 0,
      subkriteria_json: JSON.stringify(rawSubkriteria),
      criteria: Array.isArray(rawKriteria) ? rawKriteria.map((k: any) => typeof k === 'string' ? k : (k.nama || k.name || '')).filter(Boolean).join(' | ') : '',
      alternatif: Array.isArray(rawAlternatif) ? rawAlternatif.map((a: any) => typeof a === 'string' ? a : (a.nama || a.name || '')).filter(Boolean).join(' | ') : '',
      status: 'Active',
    };

    const validProjCols: string[] = [];
    const validProjVals: any[] = [];
    const projPlaceholders: string[] = [];

    projectCols.forEach((col) => {
      if (projFieldMap[col] !== undefined) {
        validProjCols.push(`\`${col}\``);
        validProjVals.push(projFieldMap[col]);
        projPlaceholders.push('?');
      } else if (col === 'created_at' || col === 'createdat') {
        validProjCols.push(`\`${col}\``);
        projPlaceholders.push('NOW()');
      } else if (col === 'updated_at' || col === 'updatedat') {
        validProjCols.push(`\`${col}\``);
        projPlaceholders.push('NOW()');
      }
    });

    // 4. Simpan Proyek Utama
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`AHP - projects\` (${validProjCols.join(', ')})
      VALUES (${projPlaceholders.join(', ')})
    `, ...validProjVals);

    // 5. Simpan Kriteria ke `AHP - criteria`
    const criteriaIdMap = new Map<string, string>();

    if (Array.isArray(rawKriteria)) {
      for (const [idx, item] of rawKriteria.entries()) {
        const critNama = String(typeof item === 'string' ? item : (item.nama || item.name || '')).trim();
        if (!critNama) continue;

        const originalCritId = String(item.id || item.criteria_id || '');
        const critId = originalCritId || `crit_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        
        if (originalCritId) {
          criteriaIdMap.set(originalCritId, critId);
        }
        criteriaIdMap.set(critNama, critId);

        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO \`AHP - criteria\` (\`criteria_id\`, \`project_id\`, \`kode\`, \`nama\`, \`urutan\`, \`created_at\`)
            VALUES (?, ?, ?, ?, ?, NOW())
          `, critId, projectId, `C${idx + 1}`, critNama, idx + 1);
        } catch (e: any) {
          console.error(`[ERROR] Gagal insert ke AHP - criteria (${critNama}):`, e.message);
          throw e;
        }
      }
    }

    // 6. Simpan Subkriteria ke `AHP - subcriteria`
    if (Array.isArray(rawSubkriteria) && rawSubkriteria.length > 0) {
      for (const [idx, item] of rawSubkriteria.entries()) {
        const subNama = String(typeof item === 'string' ? item : (item.nama || item.name || '')).trim();
        if (!subNama) continue;

        const subId = String(item.id || item.subcriteria_id || `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);
        
        const rawCritId = String(item.criteria_id || item.criteriaid || item.parent_id || item.parentid || '');
        const parentCritName = String(item.criteria_name || item.parent_name || '').trim();
        
        const resolvedCritId = criteriaIdMap.get(rawCritId) || criteriaIdMap.get(parentCritName) || Array.from(criteriaIdMap.values())[0] || '';

        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO \`AHP - subcriteria\` (\`subcriteria_id\`, \`project_id\`, \`criteria_id\`, \`kode\`, \`nama\`, \`urutan\`, \`created_at\`)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
          `, subId, projectId, resolvedCritId, `SC${idx + 1}`, subNama, idx + 1);
        } catch (e: any) {
          console.error(`[ERROR] Gagal insert ke AHP - subcriteria (${subNama}):`, e.message);
          throw e;
        }
      }
    }

    // 7. Simpan Alternatif ke `AHP - alternatives`
    if (Array.isArray(rawAlternatif)) {
      const altCols = await getTableColumns('AHP - alternatives');
      for (const [idx, item] of rawAlternatif.entries()) {
        const altNama = String(typeof item === 'string' ? item : (item.nama || item.name || '')).trim();
        if (!altNama) continue;

        const altId = String(item.id || item.alternative_id || `alt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);

        const aData: Record<string, any> = {
          id: altId,
          alternative_id: altId,
          alternativeid: altId,
          project_id: projectId,
          projectid: projectId,
          nama: altNama,
          alternatif: altNama,
          alternative: altNama,
          urutan: idx + 1,
          kode: `A${idx + 1}`,
        };

        const aCols: string[] = [];
        const aVals: any[] = [];
        const aPlh: string[] = [];

        altCols.forEach((col) => {
          if (aData[col] !== undefined) {
            aCols.push(`\`${col}\``);
            aVals.push(aData[col]);
            aPlh.push('?');
          } else if (col === 'created_at' || col === 'createdat') {
            aCols.push(`\`${col}\``);
            aPlh.push('NOW()');
          }
        });

        if (aCols.length > 0) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO \`AHP - alternatives\` (${aCols.join(', ')})
              VALUES (${aPlh.join(', ')})
            `, ...aVals);
          } catch (e: any) {
            console.warn(`[PROJECT-CREATE] Gagal insert alternative ${altNama}:`, e.message);
          }
        }
      }
    }

    // 8. Simpan Project Experts (Pakar & Token) ke `AHP - project_experts`
    const expCols = await getTableColumns('AHP - project_experts');
    const masterExpCols = await getTableColumns('AHP - experts');
    
    if (expertsList.length === 0) {
      expertsList = [{
        expert_id: `EXP-${Date.now()}`,
        fullName: 'Prof. Linglungan',
        expert_email: 'pakar1@gmail.com',
        expert_whatsapp: '081234567891',
        token: `TOK-SIM-${Math.floor(100 + Math.random() * 900)}`
      }];
    }

    for (const [idx, exp] of expertsList.entries()) {
      const inputEmail = String(exp.expert_email || exp.email || '').trim().toLowerCase();
      let finalExpertId = String(exp.expert_id || exp.expertId || '').trim();
      let finalFullName = String(exp.fullName || exp.expert_name || exp.name || exp.nama || 'Evaluator Pakar').trim();
      let finalWhatsapp = String(exp.expert_whatsapp || exp.whatsapp || '').trim();
      const expToken = String(exp.token || `TOK-EXP-${Math.random().toString(36).substring(2, 8)}`).trim();

      // Cek apakah email terdaftar di Direktori Master AHP - experts
      let existingMaster: any = null;
      if (inputEmail) {
        try {
          const matched: any[] = await prisma.$queryRawUnsafe(`
            SELECT * FROM \`AHP - experts\`
            WHERE LOWER(\`expert_email\`) = ?
            LIMIT 1
          `, inputEmail);
          if (matched && matched.length > 0) {
            existingMaster = matched[0];
          }
        } catch (err: any) {
          console.warn('[PROJECT-CREATE] Gagal query check AHP - experts:', err.message);
        }
      }

      if (existingMaster) {
        // Gunakan identitas resmi dari Direktori Pakar
        finalExpertId = String(existingMaster.expert_id || finalExpertId || `EXP-${Date.now()}-${idx}`).trim();
        const gDepan = String(existingMaster.gelar_depan || '').trim();
        const coreName = String(existingMaster.expert_name || existingMaster.nama || finalFullName).trim();
        const gBelakang = String(existingMaster.gelar_belakang || '').trim();

        if (gDepan && gBelakang) {
          finalFullName = `${gDepan} ${coreName},${gBelakang}`;
        } else if (gDepan) {
          finalFullName = `${gDepan}${coreName}`;
        } else if (gBelakang) {
          finalFullName = `${coreName},${gBelakang}`;
        } else {
          finalFullName = coreName;
        }

        if (existingMaster.expert_whatsapp) {
          finalWhatsapp = String(existingMaster.expert_whatsapp).trim();
        }
      } else {
        // Pakar Manual Baru
        if (!finalExpertId) {
          finalExpertId = `EXP-${Date.now()}-${idx}`;
        }

        const gDepanStr = String(exp.gelar_depan || exp.gelarDepan || '').trim();
        const gBelakangStr = String(exp.gelar_belakang || exp.gelarBelakang || '').trim();
        const coreNameStr = String(exp.expert_name || exp.name || exp.nama || finalFullName).trim();

        if (gDepanStr || gBelakangStr) {
          if (gDepanStr && gBelakangStr) {
            finalFullName = `${gDepanStr} ${coreNameStr},${gBelakangStr}`;
          } else if (gDepanStr) {
            finalFullName = `${gDepanStr}${coreNameStr}`;
          } else if (gBelakangStr) {
            finalFullName = `${coreNameStr},${gBelakangStr}`;
          }
        }

        // Simpan pakar manual baru ke master AHP - experts sebagai privat
        if (masterExpCols.size > 0 && inputEmail) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO \`AHP - experts\`
                (\`expert_id\`, \`gelar_depan\`, \`expert_name\`, \`gelar_belakang\`, \`expert_email\`, \`expert_whatsapp\`, \`status\`, \`is_public\`, \`created_at\`)
              VALUES
                (?, ?, ?, ?, ?, ?, 'Aktif', 'PRIVAT', NOW())
              ON DUPLICATE KEY UPDATE \`status\` = 'Aktif'
            `, finalExpertId, gDepanStr, coreNameStr, gBelakangStr, inputEmail, finalWhatsapp);
          } catch (err: any) {
            console.warn('[PROJECT-CREATE] Gagal insert ke AHP - experts:', err.message);
          }
        }
      }

      // Masukkan relasi pakar ke AHP - project_experts
      const eData: Record<string, any> = {
        id: `PE-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        project_id: projectId,
        projectid: projectId,
        expert_id: finalExpertId,
        expertid: finalExpertId,
        expert_index: idx + 1,
        expertindex: idx + 1,
        expert_name: finalFullName,
        expertname: finalFullName,
        nama: finalFullName,
        nama_expert: finalFullName,
        expert_email: inputEmail,
        expertemail: inputEmail,
        email: inputEmail,
        expert_whatsapp: finalWhatsapp,
        expertwhatsapp: finalWhatsapp,
        whatsapp: finalWhatsapp,
        token: expToken,
        status: 'Aktif',
      };

      const eCols: string[] = [];
      const eVals: any[] = [];
      const ePlh: string[] = [];

      expCols.forEach((col) => {
        if (eData[col] !== undefined) {
          eCols.push(`\`${col}\``);
          eVals.push(eData[col]);
          ePlh.push('?');
        } else if (col === 'created_at' || col === 'createdat') {
          eCols.push(`\`${col}\``);
          ePlh.push('NOW()');
        }
      });

      if (eCols.length > 0) {
        try {
          await prisma.$executeRawUnsafe(`
            INSERT INTO \`AHP - project_experts\` (${eCols.join(', ')})
            VALUES (${ePlh.join(', ')})
          `, ...eVals);
        } catch (e: any) {
          console.warn(`[PROJECT-CREATE] Gagal insert project_experts ${finalFullName}:`, e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: isStudent 
        ? 'Proyek Student Edition berhasil dibuat dengan konfigurasi minimal 3 elemen dan 2 pakar simulasi.' 
        : 'Proyek beserta seluruh kriteria, subkriteria, alternatif, dan pakar berhasil disimpan.',
      project_id: projectId,
      data: { project_id: projectId },
    });
  } catch (error: any) {
    console.error('Error fatal POST /api/projects:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}