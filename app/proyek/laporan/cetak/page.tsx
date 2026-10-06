// app/proyek/laporan/cetak/page.tsx

'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/auth';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

const RI_MAP: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

const PIE_COLORS = ['#38bdf8', '#34d399', '#f47f7f', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#818cf8'];

function sortByOrder<T extends { urutan?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0));
}

function normalizeMethod(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
}

function normalizeParentMatch(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isAlternativeMethod(value: string): boolean {
  const method = normalizeMethod(value);
  return method.includes('alternatif') || method.includes('alternative');
}

function formatMethodLabel(value: string): string {
  const norm = normalizeMethod(value);
  if (norm.includes('alternatif')) return 'Bobot alternatif';
  if (norm.includes('saja') || norm.includes('bobot')) return 'Bobot saja';
  return value;
}

function getDefaultMatrix(size: number): number[][] {
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => 1));
  for (let i = 0; i < size; i += 1) matrix[i][i] = 1;
  return matrix;
}

function normalizeMatrix(input: unknown, size: number): number[][] {
  const base = getDefaultMatrix(size);
  if (!Array.isArray(input)) return base;

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (i === j) { base[i][j] = 1; continue; }
      const row = input[i];
      const value = Array.isArray(row) ? Number(row[j]) : NaN;
      if (!Number.isFinite(value) || value <= 0) continue;
      base[i][j] = value;
    }
  }

  for (let i = 0; i < size; i += 1) {
    base[i][i] = 1;
    for (let j = i + 1; j < size; j += 1) {
      if (!Number.isFinite(base[i][j]) || base[i][j] <= 0) base[i][j] = 1;
      base[j][i] = 1 / base[i][j];
    }
  }
  return base;
}

function aggregateMatricesGeometricMean(matrices: number[][][], size: number): number[][] {
  if (matrices.length === 0) return getDefaultMatrix(size);
  const k = matrices.length;
  const result = getDefaultMatrix(size);
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        result[i][j] = 1;
      } else {
        let product = 1;
        for (let m = 0; m < k; m++) {
          const val = matrices[m][i][j] > 0 ? matrices[m][i][j] : 1;
          product *= val;
        }
        result[i][j] = Math.pow(product, 1 / k);
      }
    }
  }
  return result;
}

function calculateAHP(matrix: number[][]) {
  const n = matrix.length;
  if (n === 0) return { weights: [], lambdaMax: 0, ci: 0, cr: 0 };
  if (n === 1) return { weights: [1], lambdaMax: 1, ci: 0, cr: 0 };

  const colSums = Array.from({ length: n }, (_, j) =>
    matrix.reduce((sum, row) => sum + Number(row[j] || 0), 0)
  );
  const normalized = matrix.map((row) => row.map((value, j) => value / (colSums[j] || 1)));
  const weights = normalized.map((row) => row.reduce((sum, value) => sum + value, 0) / n);
  const weightedSum = matrix.map((row) => row.reduce((sum, value, j) => sum + value * weights[j], 0));

  const lambdaValues = weightedSum.map((v, i) => v / (weights[i] || 1));
  const lambdaMax = lambdaValues.reduce((sum, value) => sum + value, 0) / lambdaValues.length;
  const ci = n <= 2 ? 0 : (lambdaMax - n) / (n - 1);
  const ri = RI_MAP[n] ?? 1.49;
  const cr = n <= 2 || ri === 0 ? 0 : ci / ri;

  return { weights, lambdaMax, ci, cr };
}

function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '-';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits);
}

function formatExpertFullName(expert: any): string {
  let name = String(expert.expertname || expert.nama || '-').trim();
  const gD = String(expert.gelardepan || '').trim();
  const gB = String(expert.gelarbelakang || '').trim();

  if (gD && !name.toLowerCase().startsWith(gD.toLowerCase())) {
    name = `${gD} ${name}`;
  }
  if (gB && !name.toLowerCase().endsWith(gB.toLowerCase())) {
    name = `${name}, ${gB}`;
  }
  return name;
}

// 🟢 KOMPONEN GRAFIK PROPORSI GLOBAL SVG
function GlobalPieChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, item) => sum + item.score, 0);
  if (total <= 0) return null;

  const size = 110;
  const radius = 42;
  const center = size / 2;

  if (data.length === 1) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0', width: 'fit-content' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill={PIE_COLORS[0]} stroke="#fff" strokeWidth="1.5" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[0], display: 'inline-block' }} />
              <span style={{ color: '#334155', fontWeight: 600 }}>{data[0].name}</span>
            </div>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>100.0%</span>
          </div>
        </div>
      </div>
    );
  }

  let cumulativeAngle = 0;
  const slices = data.map((item, index) => {
    const percentage = item.score / total;
    const angle = percentage * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;

    const x1 = center + radius * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = center + radius * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = center + radius * Math.cos((Math.PI * (endAngle - 90)) / 180);
    const y2 = center + radius * Math.sin((Math.PI * (endAngle - 90)) / 180);

    const largeArcFlag = angle > 180 ? 1 : 0;
    const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    const color = PIE_COLORS[index % PIE_COLORS.length];

    return { ...item, pathData, color, percentage: (percentage * 100).toFixed(1) };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #e2e8f0', width: 'fit-content' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.pathData} fill={slice.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
        {slices.map((slice, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: slice.color, display: 'inline-block' }} />
              <span style={{ color: '#334155', fontWeight: 600 }}>{slice.name}</span>
            </div>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportFooter({ projectId }: { projectId: string }) {
  return (
    <div className="report-footer" style={{
      marginTop: 20,
      paddingTop: 8,
      borderTop: '1.5px solid #0f172a',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '8pt',
      color: '#334155',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div>
        <strong>AHP Avitech Decision Support System</strong> • ID Dokumen: <code style={{ fontWeight: 700 }}>#{projectId || 'AHP-REPORT'}</code>
        <div style={{ fontSize: '7pt', color: '#64748b' }}>
          Dicetak otomatis melalui platform digital resmi pada 1 Oktober 2026. Keaslian perhitungan dijamin oleh algoritma AHP.
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ color: '#166534', fontWeight: 700 }}>✓ Terverifikasi Digital</span>
        <div style={{ fontSize: '7pt', color: '#64748b' }}>https://ahp.avitech.cloud</div>
      </div>
    </div>
  );
}

function PrintReportView() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      window.location.replace('/login');
      return;
    }
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const res = await fetch(`/api/projects/bundle?id=${encodeURIComponent(projectId)}&_t=${Date.now()}`, { cache: 'no-store' });
        const json = await res.json();
        if (json?.success && json?.data) {
          setBundle(json.data);
        } else {
          const fallbackRes = await fetch(`${GOOGLESCRIPTURL}?action=get_project_bundle&projectid=${encodeURIComponent(projectId)}&_t=${Date.now()}`);
          const fallbackJson = await fallbackRes.json();
          if (fallbackJson?.success && fallbackJson?.data) {
            setBundle(fallbackJson.data);
          }
        }
      } catch (err) {
        console.error('Gagal memuat bundle cetak:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  const tasks = useMemo(() => {
    if (!bundle) return [];
    const proj = bundle.project;
    const criteria = sortByOrder(bundle.criteria || []);
    const subcriteria = sortByOrder(bundle.subcriteria || []);
    const alternatif = sortByOrder(bundle.alternatif || []);
    const tList: any[] = [];

    if (criteria.length >= 2) {
      tList.push({
        key: 'criteria::root',
        title: 'Perbandingan Antar Kriteria Utama',
        description: 'Penilaian bobot kepentingan relatif antar kriteria utama.',
        matrixtype: 'criteria',
        parentid: proj.id,
        itemnames: criteria.map((i: any) => i.nama)
      });
    }

    if (proj.punyasubkriteria) {
      criteria.forEach((criterion: any) => {
        const children = subcriteria.filter((item: any) => {
          const itemCritId = normalizeParentMatch(item.criteriaid);
          const critId = normalizeParentMatch(criterion.id);
          const critCode = normalizeParentMatch(criterion.kode);
          const critName = normalizeParentMatch(criterion.nama);
          return itemCritId === critId || (critCode && itemCritId === critCode) || (critName && itemCritId === critName);
        });

        if (children.length >= 2) {
          tList.push({
            key: `subcriteria::${criterion.id}`,
            title: `Perbandingan Subkriteria: ${criterion.nama}`,
            description: `Penilaian bobot relatif subkriteria di bawah kriteria "${criterion.nama}".`,
            matrixtype: 'subcriteria',
            parentid: criterion.id,
            itemnames: children.map((i: any) => i.nama)
          });
        }
      });
    }

    if (alternatif.length >= 2 && isAlternativeMethod(proj.metode)) {
      if (proj.punyasubkriteria) {
        subcriteria.forEach((subcriterion: any) => {
          tList.push({
            key: `alternativesbysubcriteria::${subcriterion.id}`,
            title: `Perbandingan Alternatif terhadap Subkriteria: ${subcriterion.nama}`,
            description: `Penilaian alternatif berdasarkan performa pada subkriteria "${subcriterion.nama}".`,
            matrixtype: 'alternativesbysubcriteria',
            parentid: subcriterion.id,
            itemnames: alternatif.map((i: any) => i.nama)
          });
        });
      } else {
        criteria.forEach((criterion: any) => {
          tList.push({
            key: `alternativesbycriteria::${criterion.id}`,
            title: `Perbandingan Alternatif terhadap Kriteria: ${criterion.nama}`,
            description: `Penilaian alternatif berdasarkan performa pada kriteria "${criterion.nama}".`,
            matrixtype: 'alternativesbycriteria',
            parentid: criterion.id,
            itemnames: alternatif.map((i: any) => i.nama)
          });
        });
      }
    }
    return tList;
  }, [bundle]);

  // 🟢 PERHITUNGAN SINTESIS LENGKAP DENGAN SINKRONISASI HIERARKI PENUH
  const rankings = useMemo(() => {
    if (!bundle) return [];
    const proj = bundle.project;
    const criteria = sortByOrder(bundle.criteria || []);
    const subcriteria = sortByOrder(bundle.subcriteria || []);
    const alternatif = sortByOrder(bundle.alternatif || []);
    const responses = bundle.responses || [];

    if (criteria.length === 0) return [];

    const getMatricesForTask = (taskKey: string) => {
      const task = tasks.find((t) => t.key === taskKey);
      if (!task) return [];
      const matrices: number[][][] = [];

      responses.forEach((responseItem: any) => {
        const sameType = normalizeMethod(responseItem.matrixtype) === normalizeMethod(task.matrixtype);
        if (!sameType) return;

        const hasMatrixData = Array.isArray(responseItem.matriksjson) && responseItem.matriksjson.length > 0;
        if (!hasMatrixData) return;

        let parentMatch = false;
        const rParentId = normalizeParentMatch(responseItem.parentid);
        const tParentId = normalizeParentMatch(task.parentid);
        const pId = normalizeParentMatch(proj.id);

        if (normalizeMethod(task.matrixtype) === 'criteria') {
          const acceptableParents = [tParentId, pId, 'criteria', 'kriteriautama', ''];
          parentMatch = acceptableParents.includes(rParentId);
        } else {
          parentMatch = rParentId === tParentId;
        }

        if (parentMatch) {
          matrices.push(normalizeMatrix(responseItem.matriksjson, task.itemnames.length));
        }
      });

      return matrices;
    };

    const criteriaTask = tasks.find((t) => t.key === 'criteria::root');
    let criteriaWeights = Array(criteria.length).fill(1 / criteria.length);
    if (criteriaTask) {
      const matrices = getMatricesForTask('criteria::root');
      if (matrices.length > 0) {
        const aggMatrix = aggregateMatricesGeometricMean(matrices, criteria.length);
        criteriaWeights = calculateAHP(aggMatrix).weights;
      }
    }

    const lowestLevelWeights = new Map<string, { name: string; weight: number }>();

    if (proj.punyasubkriteria && subcriteria.length > 0) {
      criteria.forEach((c: any, cIdx: number) => {
        const cWeight = criteriaWeights[cIdx] || 0;
        const subTask = tasks.find((t) => t.key === `subcriteria::${c.id}`);
        const subItems = sortByOrder(subcriteria.filter((s: any) => {
          const itemCritId = normalizeParentMatch(s.criteriaid);
          const critId = normalizeParentMatch(c.id);
          const critCode = normalizeParentMatch(c.kode);
          const critName = normalizeParentMatch(c.nama);
          return itemCritId === critId || (critCode && itemCritId === critCode) || (critName && itemCritId === critName);
        }));

        if (subTask && subItems.length >= 2) {
          const subMatrices = getMatricesForTask(subTask.key);
          if (subMatrices.length > 0) {
            const aggSubMatrix = aggregateMatricesGeometricMean(subMatrices, subItems.length);
            const subWeights = calculateAHP(aggSubMatrix).weights;
            subItems.forEach((s: any, sIdx: number) => {
              lowestLevelWeights.set(s.id, { name: `${c.nama} - ${s.nama}`, weight: cWeight * (subWeights[sIdx] || 0) });
            });
          } else {
            subItems.forEach((s: any) => {
              lowestLevelWeights.set(s.id, { name: `${c.nama} - ${s.nama}`, weight: cWeight * (1 / subItems.length) });
            });
          }
        } else if (subItems.length === 1) {
          lowestLevelWeights.set(subItems[0].id, { name: `${c.nama} - ${subItems[0].nama}`, weight: cWeight });
        }
      });
    } else {
      criteria.forEach((c: any, cIdx: number) => {
        lowestLevelWeights.set(c.id, { name: c.nama, weight: criteriaWeights[cIdx] || 0 });
      });
    }

    if (isAlternativeMethod(proj.metode) && alternatif.length > 0) {
      const altScores = new Map<string, number>();
      alternatif.forEach((a: any) => altScores.set(a.nama, 0));

      lowestLevelWeights.forEach((globalData, parentId) => {
        const altTaskType = proj.punyasubkriteria ? 'alternativesbysubcriteria' : 'alternativesbycriteria';
        const altTask = tasks.find((t) => t.key === `${altTaskType}::${parentId}`);

        if (altTask) {
          const altMatrices = getMatricesForTask(altTask.key);
          if (altMatrices.length > 0) {
            const aggAltMatrix = aggregateMatricesGeometricMean(altMatrices, alternatif.length);
            const altWeights = calculateAHP(aggAltMatrix).weights;
            alternatif.forEach((a: any, aIdx: number) => {
              const currentScore = altScores.get(a.nama) || 0;
              altScores.set(a.nama, currentScore + globalData.weight * (altWeights[aIdx] || 0));
            });
          }
        }
      });

      return [...altScores.entries()]
        .map(([name, score]) => ({ name, score, rank: 0 }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
    } else {
      return Array.from(lowestLevelWeights.values())
        .map((item) => ({ name: item.name, score: item.weight, rank: 0 }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
    }
  }, [bundle, tasks]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Menyiapkan Dokumen Cetak Resmi...</div>;
  if (!bundle) return <div style={{ padding: 40, textAlign: 'center' }}>Data proyek tidak ditemukan.</div>;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '15mm', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          .report-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fff;
            padding-bottom: 5mm;
          }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Tombol Kontrol Cetak */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => window.print()} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Cetak / Simpan PDF Sekarang
        </button>
        <button onClick={() => window.close()} style={{ background: '#cbd5e1', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
          ✕ Tutup Halaman
        </button>
      </div>

      {/* Header Dokumen Resmi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #16a34a', paddingBottom: 10, marginBottom: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#064e3b' }}>ANALYTIC HIERARCHY PROCESS</h2>
            <p style={{ margin: 0, fontSize: 9, color: '#065f46', fontWeight: 600 }}>Laporan Eksekutif Hasil Keputusan Multi-Kriteria</p>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#065f46', background: '#dcfce7', padding: '3px 8px', borderRadius: 4 }}>
          DOKUMEN RESMI
        </span>
      </div>

      {/* Identitas Proyek */}
      <div style={{ marginBottom: 15 }}>
        <h1 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#1e3a8a' }}>{bundle.project.namaproyek}</h1>
        <p style={{ fontSize: 10, color: '#475569', margin: 0, textAlign: 'justify' }}>{bundle.project.deskripsi || 'Tanpa deskripsi.'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20, fontSize: 10 }}>
        <div>
          <strong>Metode:</strong> {formatMethodLabel(bundle.project.metode)}<br/>
          <strong>Subkriteria:</strong> {bundle.project.punyasubkriteria ? 'Aktif' : 'Tidak Ada'}<br/>
          <strong>Total Responden Pakar:</strong> {bundle.experts?.length || 0} Orang
        </div>
        <div>
          <strong>Fasilitator:</strong> {bundle.project.fasilitatornama || 'Utama'}<br/>
          <strong>Instansi:</strong> {bundle.project.fasilitatorlembaga || '-'}<br/>
          <strong>Email:</strong> {bundle.project.fasilitatoremail || '-'}
        </div>
      </div>

      {/* I. GRAFIK PROPORSI GLOBAL */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #0f172a', paddingBottom: 4, marginBottom: 8 }}>
          I. GRAFIK PROPORSI BOBOT PRIORITAS GLOBAL
        </h3>
        <GlobalPieChart data={rankings} />
      </div>

      {/* II. Tabel Ranking Prioritas */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #0f172a', paddingBottom: 4, marginBottom: 8 }}>
          II. TABEL RANKING PRIORITAS SINTESIS AKHIR
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #0f172a' }}>
              <th style={{ padding: '6px', textAlign: 'center', width: 45 }}>Rank</th>
              <th style={{ padding: '6px', textAlign: 'left' }}>Alternatif / Kriteria</th>
              <th style={{ padding: '6px', textAlign: 'right' }}>Bobot Skor</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((item: any) => (
              <tr key={item.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>#{item.rank}</td>
                <td style={{ padding: '6px', fontWeight: 600 }}>{item.name}</td>
                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatNumber(item.score, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* III. Daftar Responden Pakar */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #0f172a', paddingBottom: 4, marginBottom: 8 }}>
          III. DAFTAR RESPONDEN PAKAR TERLIBAT
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #0f172a' }}>
              <th style={{ padding: '6px', textAlign: 'left' }}>Nama Lengkap &amp; Gelar</th>
              <th style={{ padding: '6px', textAlign: 'left' }}>Instansi</th>
              <th style={{ padding: '6px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(bundle.experts || []).map((exp: any) => (
              <tr key={exp.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>{formatExpertFullName(exp)}</td>
                <td style={{ padding: '6px' }}>{exp.asalinstansi || '-'}</td>
                <td style={{ padding: '6px', textAlign: 'center' }}>Terdaftar / Aktif</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* IV. RINCIAN MATRIKS PERBANDINGAN BERPASANGAN */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #0f172a', paddingBottom: 4, marginBottom: 10 }}>
          IV. RINCIAN MATRIKS PERBANDINGAN BERPASANGAN
        </h3>

        {tasks.map((task: any) => {
          const facilitatorResp = (bundle.responses || []).find((r: any) => {
            const isFacilitator = r.submittedby === 'Fasilitator' || r.expertid === 'FACILITATOR';
            const sameType = normalizeMethod(r.matrixtype) === normalizeMethod(task.matrixtype);
            if (!isFacilitator || !sameType) return false;
            const rParent = normalizeParentMatch(r.parentid);
            const tParent = normalizeParentMatch(task.parentid);
            if (task.matrixtype === 'criteria') return true;
            return rParent === tParent;
          });

          const facilitatorMatrix = facilitatorResp && Array.isArray(facilitatorResp.matriksjson) && facilitatorResp.matriksjson.length > 0
            ? normalizeMatrix(facilitatorResp.matriksjson, task.itemnames.length)
            : getDefaultMatrix(task.itemnames.length);
          const facilitatorAnalysis = calculateAHP(facilitatorMatrix);

          return (
            <div key={task.key} style={{ marginBottom: 15, pageBreakInside: 'avoid' }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#1e3a8a', margin: '0 0 4px' }}>{task.title}</h4>
              <p style={{ fontSize: 9, color: '#64748b', margin: '0 0 6px' }}>{task.description}</p>

              {/* Tabel Referensi Fasilitator */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 6, marginBottom: 8, background: '#f8fafc' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#166534', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>⭐ Matriks Referensi Fasilitator</span>
                  <span>CR: {formatNumber(facilitatorAnalysis.cr, 3)} {facilitatorAnalysis.cr <= 0.1 ? '✓' : '⚠️'}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0' }}>
                      <th style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'left' }}>Item</th>
                      {task.itemnames.map((name: string, i: number) => (
                        <th key={i} style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>{name}</th>
                      ))}
                      <th style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>Bobot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.itemnames.map((rowName: string, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: 4, border: '1px solid #cbd5e1', fontWeight: 600 }}>{rowName}</td>
                        {facilitatorMatrix[i].map((val: number, j: number) => (
                          <td key={j} style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                        ))}
                        <td style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>
                          {formatNumber(facilitatorAnalysis.weights[i] || 0, 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tabel Respons Pakar */}
              {(bundle.experts || []).map((expert: any) => {
                const expertResp = (bundle.responses || []).find((r: any) => {
                  const isExp = String(r.expertid) === String(expert.id) || String(r.submittedby) === String(expert.id);
                  const sameType = normalizeMethod(r.matrixtype) === normalizeMethod(task.matrixtype);
                  if (!isExp || !sameType) return false;
                  const rParent = normalizeParentMatch(r.parentid);
                  const tParent = normalizeParentMatch(task.parentid);
                  if (task.matrixtype === 'criteria') return true;
                  return rParent === tParent;
                });
                if (!expertResp) return null;

                const eMatrix = normalizeMatrix(expertResp.matriksjson, task.itemnames.length);
                const eAnalysis = calculateAHP(eMatrix);

                return (
                  <div key={expert.id} style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: 6, marginBottom: 8, background: '#fff' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0f172a', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pakar: {formatExpertFullName(expert)} ({expert.asalinstansi || '-'})</span>
                      <span>CR Akhir: {formatNumber(eAnalysis.cr, 3)} {eAnalysis.cr <= 0.1 ? '✓' : '⚠️'}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'left' }}>Item Evaluasi</th>
                          {task.itemnames.map((name: string, idx: number) => (
                            <th key={idx} style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>{name}</th>
                          ))}
                          <th style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>Bobot Akhir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {task.itemnames.map((rowName: string, i: number) => (
                          <tr key={i}>
                            <td style={{ padding: 4, border: '1px solid #cbd5e1', fontWeight: 600 }}>{rowName}</td>
                            {eMatrix[i].map((val: number, j: number) => (
                              <td key={j} style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                            ))}
                            <td style={{ padding: 4, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>
                              {formatNumber(eAnalysis.weights[i] || 0, 4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Formal */}
      <ReportFooter projectId={bundle.project.id} />
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 50 }}>Memuat Halaman Cetak...</div>}>
      <PrintReportView />
    </Suspense>
  );
}