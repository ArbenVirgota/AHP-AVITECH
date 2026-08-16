// app/expert/page.tsx

'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

interface ExpertItem {
  id: string;
  projectid: string;
  expertname: string;
  gelardepan?: string;
  gelarbelakang?: string;
  asalinstansi?: string;
  expertemail: string;
  expertwhatsapp: string;
  token: string;
}

interface ProjectDetail {
  id: string;
  namaproyek: string;
  deskripsi: string;
  metode: string;
  punyasubkriteria: boolean;
}

interface CriteriaItem {
  id: string;
  nama: string;
  urutan: number;
}

interface SubcriteriaItem {
  id: string;
  criteriaid: string;
  nama: string;
  urutan: number;
}

interface AlternatifItem {
  id: string;
  nama: string;
  urutan: number;
}

interface MatrixTask {
  key: string;
  title: string;
  description: string;
  matrixtype: string;
  parentid: string;
  parentname: string;
  itemids: string[];
  itemnames: string[];
}

interface RawCriteriaBundle {
  id?: string;
  criteriaid?: string;
  criteria_id?: string;
  nama?: string;
  namakriteria?: string;
  name?: string;
  urutan?: number;
  order?: number;
}

interface RawSubcriteriaBundle {
  id?: string;
  subcriteriaid?: string;
  subcriteria_id?: string;
  criteriaid?: string;
  criteria_id?: string;
  nama?: string;
  name?: string;
  urutan?: number;
}

interface RawAlternatifBundle {
  id?: string;
  alternatifid?: string;
  alternatif_id?: string;
  nama?: string;
  name?: string;
  urutan?: number;
}

interface RawResponseBundle {
  expertid?: string;
  expert_id?: string;
  matrixtype?: string;
  matrix_type?: string;
  parentid?: string;
  parent_id?: string;
  matriksjson?: string;
  matriks_json?: string;
  matrixjson?: string;
}

const RI_MAP: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

function getDefaultMatrix(size: number): number[][] {
  const m = Array.from({ length: size }, () => Array.from({ length: size }, () => 1));
  for (let i = 0; i < size; i++) m[i][i] = 1;
  return m;
}

function cloneMatrix(m: number[][]): number[][] {
  return m.map((row) => [...row]);
}

function sliderToSaaty(val: number, direction: 'left' | 'right' | 'center'): number {
  if (direction === 'center' || val <= 1) return 1;
  if (direction === 'right') return val;
  return 1 / val;
}

function saatyToSliderState(saatyVal: number): { val: number; dir: 'left' | 'right' | 'center' } {
  if (!Number.isFinite(saatyVal) || Math.abs(saatyVal - 1) < 0.0001) {
    return { val: 1, dir: 'center' };
  }
  if (saatyVal > 1) {
    const v = Math.max(1, Math.min(9, Math.round(saatyVal)));
    return { val: v, dir: 'right' };
  } else {
    const reciprocal = 1 / saatyVal;
    const v = Math.max(1, Math.min(9, Math.round(reciprocal)));
    return { val: v, dir: 'left' };
  }
}

function sliderLabel(saatyVal: number, left: string, right: string): string {
  if (Math.abs(saatyVal - 1) < 0.0001) return 'Sama penting (1)';
  if (saatyVal > 1) return `${right} lebih penting (Skala: ${Math.round(saatyVal)})`;
  return `${left} lebih penting (Skala: ${Math.round(1 / saatyVal)})`;
}

function calculateAHP(matrix: number[][]) {
  const n = matrix.length;
  if (n <= 1) return { weights: [1], cr: 0 };
  const colSums = Array.from({ length: n }, (_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
  const norm = matrix.map((row) => row.map((v, j) => v / colSums[j]));
  const weights = norm.map((row) => row.reduce((a, b) => a + b, 0) / n);
  const weightedSum = matrix.map((row) => row.reduce((sum, v, j) => sum + v * weights[j], 0));
  const lambdaMax = weightedSum.reduce((sum, v, i) => sum + v / weights[i], 0) / n;
  const ci = (lambdaMax - n) / (n - 1);
  const ri = RI_MAP[n] ?? 1.49;
  const cr = n <= 2 || ri === 0 ? 0 : ci / ri;
  return { weights, cr };
}

function ExpertMainContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [step, setStep] = useState<'welcome' | 'matrix'>('welcome');

  const [expert, setExpert] = useState<ExpertItem | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [subcriteria, setSubcriteria] = useState<SubcriteriaItem[]>([]);
  const [alternatif, setAlternatif] = useState<AlternatifItem[]>([]);

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [matrices, setMatrices] = useState<Record<string, number[][]>>({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  useEffect(() => {
    const loadExpertData = async () => {
      if (!token) {
        setError('Token expert tidak valid atau tidak ditemukan di URL.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(GOOGLESCRIPTURL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          cache: 'no-store',
          body: JSON.stringify({
            action: 'getexpertbytoken',
            token: token,
            t: Date.now()
          })
        });
        
        const rawText = await res.text();
        let json;
        try {
          json = JSON.parse(rawText);
        } catch (e) {
          throw new Error('Respons dari server tidak dikenali.');
        }

        if (!json?.success || !json?.data?.expert || !json?.data?.project) {
          throw new Error(json?.message || 'Token kuesioner tidak valid atau sudah kadaluarsa.');
        }

        const rawExp = json.data.expert;
        const rawProj = json.data.project;

        const validProjectId = String(rawProj.id || rawProj.projectid || rawProj.project_id || '').trim();
        const validExpertId = String(rawExp.id || rawExp.expertid || rawExp.expert_id || '').trim();
        const validExpertName = String(rawExp.expertname || rawExp.expert_name || rawExp.nama || 'Expert').trim();

        const exp: ExpertItem = {
          ...rawExp,
          id: validExpertId,
          expertname: validExpertName,
          gelardepan: String(rawExp.gelardepan || rawExp.gelar_depan || '').trim(),
          gelarbelakang: String(rawExp.gelarbelakang || rawExp.gelar_belakang || '').trim(),
          asalinstansi: String(rawExp.asalinstansi || rawExp.instansi || rawExp.asal_instansi || '').trim(),
          projectid: validProjectId,
        };

        const proj: ProjectDetail = {
          ...rawProj,
          id: validProjectId,
          namaproyek: String(rawProj.namaproyek || rawProj.nama_proyek || ''),
        };

        setExpert(exp);
        setProject(proj);

        if (!validProjectId) throw new Error('Data Project ID tidak ditemukan.');

        const bundleRes = await fetch(`${GOOGLESCRIPTURL}?action=get_project_bundle&projectid=${encodeURIComponent(validProjectId)}`);
        const bundleJson = await bundleRes.json();

        if (bundleJson?.success && bundleJson?.data) {
          const bd = bundleJson.data;
          const rawCrit: RawCriteriaBundle[] = bd.criteria || bd.Criteria || bd.kriteria || [];
          const rawSub: RawSubcriteriaBundle[] = bd.subcriteria || bd.Subcriteria || bd.subkriteria || [];
          const rawAlt: RawAlternatifBundle[] = bd.alternatif || bd.Alternatif || bd.alternatives || [];
          const rawResponses: RawResponseBundle[] = bd.responses || [];

          setCriteria(rawCrit.map((c) => ({
            id: String(c.id || c.criteriaid || c.criteria_id || ''),
            nama: String(c.nama || c.namakriteria || c.name || ''),
            urutan: Number(c.urutan || c.order || 0)
          })));

          setSubcriteria(rawSub.map((s) => ({
            id: String(s.id || s.subcriteriaid || s.subcriteria_id || ''),
            criteriaid: String(s.criteriaid || s.criteria_id || ''),
            nama: String(s.nama || s.name || ''),
            urutan: Number(s.urutan || 0)
          })));

          setAlternatif(rawAlt.map((a) => ({
            id: String(a.id || a.alternatifid || a.alternatif_id || ''),
            nama: String(a.nama || a.name || ''),
            urutan: Number(a.urutan || 0)
          })));

          if (rawResponses.length > 0 && exp.id) {
            const loadedMatrices: Record<string, number[][]> = {};
            rawResponses.forEach((r) => {
              if (String(r.expertid || r.expert_id || '').trim() === exp.id) {
                const mType = String(r.matrixtype || r.matrix_type || '').trim().toLowerCase();
                
                let key = '';
                if (mType === 'criteria' || mType === 'kriteria') {
                  key = 'criteria::root';
                } else {
                  const pId = String(r.parentid || r.parent_id || '').trim();
                  if (mType === 'subcriteria') {
                    key = `subcriteria::${pId}`;
                  } else if (mType === 'alternativesbysubcriteria') {
                    key = `alternativesbysubcriteria::${pId}`;
                  } else if (mType === 'alternativesbycriteria') {
                    key = `alternativesbycriteria::${pId}`;
                  }
                }

                if (key) {
                  try {
                    const rawMatStr = r.matriksjson || r.matriks_json || r.matrixjson;
                    const parsedMatrix = typeof rawMatStr === 'string' ? JSON.parse(rawMatStr) : rawMatStr;
                    if (Array.isArray(parsedMatrix) && parsedMatrix.length > 0) {
                      loadedMatrices[key] = parsedMatrix;
                    }
                  } catch (e) {
                    console.error('Gagal memparsing matriks tersimpan:', e);
                  }
                }
              }
            });

            if (Object.keys(loadedMatrices).length > 0) {
              setMatrices((prev) => ({ ...prev, ...loadedMatrices }));
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data expert.');
      } finally {
        setLoading(false);
      }
    };

    void loadExpertData();
  }, [token]);

  const tasks = useMemo(() => {
    if (!project || !project.id) return [];
    const list: MatrixTask[] = [];
    const sortedCrit = [...criteria].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    const sortedSub = [...subcriteria].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    const sortedAlt = [...alternatif].sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

    if (sortedCrit.length >= 2) {
      list.push({
        key: 'criteria::root',
        title: 'Perbandingan Antar Kriteria Utama',
        description: 'Tentukan tingkat kepentingan relatif antar kriteria utama.',
        matrixtype: 'criteria',
        parentid: project.id,
        parentname: 'Kriteria Utama',
        itemids: sortedCrit.map((i) => i.id),
        itemnames: sortedCrit.map((i) => i.nama),
      });
    }

    if (project.punyasubkriteria) {
      sortedCrit.forEach((c) => {
        const children = sortedSub.filter((s) => s.criteriaid === c.id);
        if (children.length >= 2) {
          list.push({
            key: `subcriteria::${c.id}`,
            title: `Perbandingan Subkriteria - ${c.nama}`,
            description: `Penilaian subkriteria di bawah kriteria ${c.nama}.`,
            matrixtype: 'subcriteria',
            parentid: c.id,
            parentname: c.nama,
            itemids: children.map((i) => i.id),
            itemnames: children.map((i) => i.nama),
          });
        }
      });
    }

    const isAltMethod = String(project.metode || '').toLowerCase().includes('alternatif');
    if (sortedAlt.length >= 2 && isAltMethod) {
      if (project.punyasubkriteria) {
        sortedSub.forEach((s) => {
          list.push({
            key: `alternativesbysubcriteria::${s.id}`,
            title: `Perbandingan Alternatif berdasarkan Subkriteria: ${s.nama}`,
            description: 'Pilih alternatif terbaik berdasarkan subkriteria ini.',
            matrixtype: 'alternativesbysubcriteria',
            parentid: s.id,
            parentname: s.nama,
            itemids: sortedAlt.map((i) => i.id),
            itemnames: sortedAlt.map((i) => i.nama),
          });
        });
      } else {
        sortedCrit.forEach((c) => {
          list.push({
            key: `alternativesbycriteria::${c.id}`,
            title: `Perbandingan Alternatif berdasarkan Kriteria: ${c.nama}`,
            description: 'Pilih alternatif terbaik berdasarkan kriteria ini.',
            matrixtype: 'alternativesbycriteria',
            parentid: c.id,
            parentname: c.nama,
            itemids: sortedAlt.map((i) => i.id),
            itemnames: sortedAlt.map((i) => i.nama),
          });
        });
      }
    }

    return list;
  }, [project, criteria, subcriteria, alternatif]);

  useEffect(() => {
    if (tasks.length > 0) {
      setMatrices((prev) => {
        const initial = { ...prev };
        tasks.forEach((t) => {
          if (!initial[t.key]) {
            initial[t.key] = getDefaultMatrix(t.itemnames.length);
          }
        });
        return initial;
      });
    }
  }, [tasks]);

  const handleSliderChange = (taskKey: string, i: number, j: number, val: number, dir: 'left' | 'right' | 'center') => {
    const saatyVal = sliderToSaaty(val, dir);
    setMatrices((prev) => {
      const current = prev[taskKey] ? cloneMatrix(prev[taskKey]) : getDefaultMatrix(2);
      current[i][j] = saatyVal;
      current[j][i] = 1 / saatyVal;
      current[i][i] = 1;
      current[j][j] = 1;
      return { ...prev, [taskKey]: current };
    });
  };

  const isLastTask = tasks.length > 0 && currentTaskIndex === tasks.length - 1;

  const saveCurrentTask = async () => {
    const task = tasks[currentTaskIndex];
    if (!task || !expert || !project) return;
    const currentMat = matrices[task.key] || getDefaultMatrix(task.itemnames.length);
    const analysis = calculateAHP(currentMat);

    try {
      setSavingMatrix(true);
      
      const isCriteria = String(task.matrixtype).trim().toLowerCase() === 'criteria';
      const accurateParentId = isCriteria ? project.id : task.parentid;
      const accurateParentName = isCriteria ? 'Kriteria Utama' : task.parentname;

      const gD = expert.gelardepan ? `${expert.gelardepan} ` : '';
      const gB = expert.gelarbelakang ? `, ${expert.gelarbelakang}` : '';
      const expertFullName = `${gD}${expert.expertname}${gB}`;

      const payload = {
        action: 'saveExpertResponse',
        token: token || '',
        project_id: project.id,
        projectid: project.id,
        expert_id: expert.id,
        expertid: expert.id,
        expert_name: expertFullName,
        expertname: expertFullName,
        matrix_type: task.matrixtype,
        matrixtype: task.matrixtype,
        parent_id: accurateParentId, 
        parentid: accurateParentId,
        parent_name: accurateParentName, 
        parentname: accurateParentName,
        item_ids: task.itemids,
        itemids: task.itemids,
        item_names: task.itemnames,
        itemnames: task.itemnames,
        matriks_json: currentMat,
        matriksjson: currentMat,
        cr: analysis.cr,
        is_confirmed: isLastTask
      };

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      
      const textRes = await res.text();
      let json;
      try {
        json = JSON.parse(textRes);
      } catch {
        throw new Error(`Respons server tidak valid: ${textRes}`);
      }

      if (!json?.success) throw new Error(json?.message || 'Gagal menyimpan.');

      if (currentTaskIndex < tasks.length - 1) {
        setCurrentTaskIndex((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        router.push(`/expert/selesai?token=${encodeURIComponent(token || '')}`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan matriks.');
    } finally {
      setSavingMatrix(false);
    }
  };

  if (loading) {
    return (
      <div style={STYLES.page}>
        <style jsx global>{`
          aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] { display: none !important; width: 0 !important; height: 0 !important; }
          body, html, main, div[class*="layout"], div[class*="wrapper"] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding-left: 0 !important; }
        `}</style>
        <div style={STYLES.card}>Memuat data expert dan matriks...</div>
      </div>
    );
  }

  if (error || !expert || !project) {
    return (
      <div style={STYLES.page}>
        <style jsx global>{`
          aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] { display: none !important; width: 0 !important; height: 0 !important; }
          body, html, main, div[class*="layout"], div[class*="wrapper"] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding-left: 0 !important; }
        `}</style>
        <div style={STYLES.card}><div style={STYLES.errorBox}>{error || 'Akses ditolak.'}</div></div>
      </div>
    );
  }

  if (step === 'welcome') {
    const gD = expert.gelardepan ? `${expert.gelardepan} ` : '';
    const gB = expert.gelarbelakang ? `, ${expert.gelarbelakang}` : '';
    const expertFullName = `${gD}${expert.expertname || 'Pakar'}${gB}`;

    return (
      <div style={STYLES.page}>
        {/* 🟢 CSS GLOBAL PENYEMBUNYI SIDEBAR */}
        <style jsx global>{`
          aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] { display: none !important; width: 0 !important; height: 0 !important; }
          body, html, main, div[class*="layout"], div[class*="wrapper"] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding-left: 0 !important; }
        `}</style>
        <div style={STYLES.container}>
          <div style={STYLES.card}>
            <span style={STYLES.badge}>Selamat Datang, {expertFullName}</span>
            {expert.asalinstansi && (
              <div style={{ marginTop: -8, marginBottom: 16, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                🏢 {expert.asalinstansi}
              </div>
            )}
            <h1 style={STYLES.title}>{project.namaproyek}</h1>
            <p style={STYLES.desc}>{project.deskripsi || 'Silakan lakukan evaluasi perbandingan berpasangan AHP untuk proyek ini.'}</p>
            
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, margin: '16px 0', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
              ℹ️ Total Sesi Matriks yang Tersedia: <strong>{tasks.length} Sesi</strong>
              {tasks.length === 0 && (
                <div style={{ color: '#dc2626', marginTop: 6, fontWeight: 600 }}>
                  ⚠️ Perhatian: Proyek ini belum memiliki kriteria (atau jumlah kriteria kurang dari 2), sehingga matriks tidak dapat dibuat. Silakan hubungi fasilitator Anda.
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                if (tasks.length === 0) {
                  alert('Tidak ada tugas matriks karena jumlah kriteria kurang dari 2.');
                  return;
                }
                setStep('matrix');
              }} 
              style={{
                ...STYLES.btnPrimary,
                opacity: tasks.length === 0 ? 0.6 : 1,
                cursor: tasks.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Mulai Evaluasi Matriks AHP →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const task = tasks[currentTaskIndex];
  if (!task) {
    return (
      <div style={STYLES.page}>
        <style jsx global>{`
          aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] { display: none !important; width: 0 !important; height: 0 !important; }
          body, html, main, div[class*="layout"], div[class*="wrapper"] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding-left: 0 !important; }
        `}</style>
        <div style={STYLES.card}>
          <h3>Tidak ada tugas matriks yang tersedia untuk proyek ini.</h3>
          <button onClick={() => router.push(`/expert/selesai?token=${encodeURIComponent(token || '')}`)} style={STYLES.btnPrimary}>
            Lanjut ke Halaman Selesai
          </button>
        </div>
      </div>
    );
  }

  const currentMatrix = matrices[task.key] || getDefaultMatrix(task.itemnames.length);
  const analysis = calculateAHP(currentMatrix);

  const pairs: Array<{ i: number; j: number; left: string; right: string }> = [];
  for (let i = 0; i < task.itemnames.length; i++) {
    for (let j = i + 1; j < task.itemnames.length; j++) {
      pairs.push({ i, j, left: task.itemnames[i], right: task.itemnames[j] });
    }
  }

  const isSubmitDisabled = savingMatrix;

  return (
    <div style={STYLES.page}>
      {/* 🟢 CSS GLOBAL PENYEMBUNYI SIDEBAR */}
      <style jsx global>{`
        aside, nav, header, .sidebar, [class*="sidebar"], .drawer, [class*="drawer"] { display: none !important; width: 0 !important; height: 0 !important; }
        body, html, main, div[class*="layout"], div[class*="wrapper"] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; margin-left: 0 !important; padding-left: 0 !important; }
      `}</style>
      <div style={STYLES.container}>
        <div style={STYLES.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={STYLES.badge}>Tugas {currentTaskIndex + 1} dari {tasks.length}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: analysis.cr <= 0.1 ? '#16a34a' : '#dc2626' }}>
              CR: {analysis.cr.toFixed(4)} {analysis.cr <= 0.1 ? ' (Konsisten)' : ' (Perlu Evaluasi)'}
            </span>
          </div>

          <h2 style={STYLES.title}>{task.title}</h2>
          <p style={STYLES.desc}>{task.description}</p>

          <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
            {pairs.map((p) => {
              const saatyVal = currentMatrix[p.i]?.[p.j] ?? 1;
              const state = saatyToSliderState(saatyVal);

              return (
                <div key={`${p.i}-${p.j}`} style={STYLES.sliderCard}>
                  <div style={STYLES.sliderHeader}>
                    <strong>{p.left}</strong>
                    <span style={{ fontSize: 12, color: '#64748b' }}>vs</span>
                    <strong>{p.right}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                    <button
                      type="button"
                      style={{
                        ...STYLES.dirBtn,
                        background: state.dir === 'left' ? '#0f172a' : '#f1f5f9',
                        color: state.dir === 'left' ? '#fff' : '#475569',
                      }}
                      onClick={() => handleSliderChange(task.key, p.i, p.j, state.val === 1 ? 2 : state.val, 'left')}
                    >
                      ← {p.left} Lebih Penting
                    </button>
                    <button
                      type="button"
                      style={{
                        ...STYLES.dirBtn,
                        background: state.dir === 'center' ? '#0f172a' : '#f1f5f9',
                        color: state.dir === 'center' ? '#fff' : '#475569',
                      }}
                      onClick={() => handleSliderChange(task.key, p.i, p.j, 1, 'center')}
                    >
                      Sama Penting (1)
                    </button>
                    <button
                      type="button"
                      style={{
                        ...STYLES.dirBtn,
                        background: state.dir === 'right' ? '#0f172a' : '#f1f5f9',
                        color: state.dir === 'right' ? '#fff' : '#475569',
                      }}
                      onClick={() => handleSliderChange(task.key, p.i, p.j, state.val === 1 ? 2 : state.val, 'right')}
                    >
                      {p.right} Lebih Penting →
                    </button>
                  </div>

                  {state.dir !== 'center' && (
                    <div style={{ marginTop: 6, padding: '0 4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                        <span>1 (Lemah)</span>
                        <span>Intensitas: {state.val}</span>
                        <span>9 (Ekstrem)</span>
                      </div>
                      <input
                        type="range" min={1} max={9} step={1} value={state.val}
                        onChange={(e) => handleSliderChange(task.key, p.i, p.j, Number(e.target.value), state.dir)}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>
                  )}

                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, marginTop: 8, color: '#1e293b' }}>
                    {sliderLabel(saatyVal, p.left, p.right)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            {currentTaskIndex > 0 ? (
              <button onClick={() => setCurrentTaskIndex((prev) => prev - 1)} style={STYLES.btnSecondary}>← Sebelumnya</button>
            ) : <div />}

            <button 
              onClick={() => void saveCurrentTask()} 
              disabled={isSubmitDisabled} 
              style={{
                ...STYLES.btnPrimary,
                opacity: isSubmitDisabled ? 0.6 : 1,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {savingMatrix ? 'Menyimpan...' : !isLastTask ? 'Simpan & Lanjut →' : 'Selesai & Isi Profil →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpertPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 40, color: '#0f172a' }}>Memuat kuesioner pakar...</div>}>
      <ExpertMainContent />
    </Suspense>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { 
    background: 'url("/bg-expert.png") center/cover no-repeat fixed, #f5f7fb', 
    minHeight: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '24px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    overflowY: 'auto'
  },
  container: { width: '100%', maxWidth: 720 },
  card: { background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 6px 24px rgba(15,23,42,0.06)' },
  title: { margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' },
  desc: { margin: '0 0 16px', color: '#475569', fontSize: 13.5, lineHeight: 1.6 },
  btnPrimary: { padding: '12px 20px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, transition: 'all 0.2s', cursor: 'pointer' },
  btnSecondary: { padding: '12px 20px', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  badge: { fontSize: 11.5, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: 999, fontWeight: 700, display: 'inline-block', marginBottom: 12 },
  sliderCard: { border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#f8fafc' },
  sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 13.5, color: '#0f172a' },
  dirBtn: { flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' },
  errorBox: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: 14, borderRadius: 10, fontSize: 14 },
};