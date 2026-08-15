// app/proyek/laporan/helpers/report-builders.ts

import { calculateAHP, normalizeMatrix, getDefaultMatrix } from './ahp';
import type {
  AlternatifItem,
  BundleState,
  CriteriaItem,
  ExpertItem,
  MatrixTask,
  ProjectDetail,
  SavedResponse,
  SubcriteriaItem,
  TaskExpertReport,
  TaskReport,
  ExpertCompletionItem,
  FinalAlternativeRankingItem,
  GeminiAnalysisPayload,
} from './report-types';

export function sortByOrder<T extends { urutan?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0));
}

export function normalizeMethod(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

export function normalizeParentMatch(str: string): string {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isAlternativeMethod(value: string) {
  const method = normalizeMethod(value);
  return method.includes('alternatif') || method.includes('alternative');
}

export function aggregateMatricesGeometricMean(matrices: number[][][], size: number): number[][] {
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

export function buildSubcriteriaMap(subcriteria: SubcriteriaItem[]) {
  const map: Record<string, SubcriteriaItem[]> = {};

  for (const item of subcriteria) {
    if (!map[item.criteriaid]) map[item.criteriaid] = [];
    map[item.criteriaid].push(item);
  }

  Object.keys(map).forEach((key) => {
    map[key].sort((a, b) => a.urutan - b.urutan);
  });

  return map;
}

export function buildMatrixTasks(data: BundleState): MatrixTask[] {
  const criteria = sortByOrder(data.criteria);
  const subcriteria = sortByOrder(data.subcriteria);
  const alternatif = sortByOrder(data.alternatif);
  const tasks: MatrixTask[] = [];

  if (criteria.length >= 2) {
    tasks.push({
      key: 'criteria::root',
      title: 'Perbandingan Antar Kriteria',
      description: 'Penilaian bobot relatif antar kriteria utama.',
      matrixtype: 'criteria',
      parentid: data.project.id,
      parentname: 'Kriteria Utama',
      itemids: criteria.map((item) => item.id),
      itemnames: criteria.map((item) => item.nama),
    });
  }

  if (data.project.punyasubkriteria) {
    criteria.forEach((criterion) => {
      const children = subcriteria.filter((item) => item.criteriaid === criterion.id);
      if (children.length >= 2) {
        tasks.push({
          key: `subcriteria::${criterion.id}`,
          title: `Perbandingan Subkriteria - ${criterion.nama}`,
          description: `Penilaian subkriteria untuk kriteria ${criterion.nama}.`,
          matrixtype: 'subcriteria',
          parentid: criterion.id,
          parentname: criterion.nama,
          itemids: children.map((item) => item.id),
          itemnames: children.map((item) => item.nama),
        });
      }
    });
  }

  if (alternatif.length >= 2 && isAlternativeMethod(data.project.metode)) {
    if (data.project.punyasubkriteria) {
      subcriteria.forEach((subcriterion) => {
        tasks.push({
          key: `alternativesbysubcriteria::${subcriterion.id}`,
          title: `Perbandingan Alternatif - ${subcriterion.nama}`,
          description: `Penilaian alternatif berdasarkan subkriteria ${subcriterion.nama}.`,
          matrixtype: 'alternativesbysubcriteria',
          parentid: subcriterion.id,
          parentname: subcriterion.nama,
          itemids: alternatif.map((item) => item.id),
          itemnames: alternatif.map((item) => item.nama),
        });
      });
    } else {
      criteria.forEach((criterion) => {
        tasks.push({
          key: `alternativesbycriteria::${criterion.id}`,
          title: `Perbandingan Alternatif - ${criterion.nama}`,
          description: `Penilaian alternatif berdasarkan kriteria ${criterion.nama}.`,
          matrixtype: 'alternativesbycriteria',
          parentid: criterion.id,
          parentname: criterion.nama,
          itemids: alternatif.map((item) => item.id),
          itemnames: alternatif.map((item) => item.nama),
        });
      });
    }
  }

  return tasks;
}

// 🟢 100% IDENTIK DENGAN FUNGSI PENCOCOKAN DI HALAMAN KELOLA
export function findResponseForTask(
  responses: SavedResponse[],
  expertId: string,
  task: MatrixTask,
  projectId?: string,
): SavedResponse | null {
  return (
    responses.find((item) => {
      const itemExpert = String(item.expertid || '').trim();
      const targetExpert = String(expertId || '').trim();
      if (itemExpert !== targetExpert) return false;

      const itemType = normalizeMethod(item.matrixtype);
      const taskType = normalizeMethod(task.matrixtype);
      if (itemType !== taskType) return false;

      const itemParent = normalizeParentMatch(item.parentid);
      const taskParent = normalizeParentMatch(task.parentid);
      const projectParent = normalizeParentMatch(projectId || '');

      if (taskType === 'criteria') {
        const acceptableParents = [taskParent, projectParent, 'criteria', 'kriteriautama', ''];
        return acceptableParents.includes(itemParent);
      }
      
      return itemParent === taskParent;
    }) || null
  );
}

export function buildExpertCompletion(
  experts: ExpertItem[],
  tasks: MatrixTask[],
  responses: SavedResponse[],
  projectId?: string,
): ExpertCompletionItem[] {
  return experts.map((expert) => {
    const done = tasks.filter((task) =>
      findResponseForTask(responses, expert.id, task, projectId),
    ).length;
    const total = tasks.length;

    return {
      expert,
      done,
      total,
      finished: total > 0 && done >= total,
    };
  });
}

export function buildTaskExpertReport(
  expert: ExpertItem,
  task: MatrixTask,
  responses: SavedResponse[],
  projectId?: string,
): TaskExpertReport {
  const saved = findResponseForTask(responses, expert.id, task, projectId);

  const latestMatrix = normalizeMatrix(saved?.matriksjson, task.itemnames.length);

  const baselineMatrix = normalizeMatrix(
    saved?.originalmatriksjson && saved.originalmatriksjson.length > 0
      ? saved.originalmatriksjson
      : saved?.matriksjson,
    task.itemnames.length,
  );

  const latestAnalysis = calculateAHP(latestMatrix);
  const baselineAnalysis = calculateAHP(baselineMatrix);

  return {
    expert,
    saved,
    latestMatrix,
    baselineMatrix,
    latestAnalysis,
    baselineAnalysis,
  };
}

export function buildTaskReports(
  experts: ExpertItem[],
  tasks: MatrixTask[],
  responses: SavedResponse[],
  projectId?: string,
): TaskReport[] {
  return tasks.map((task) => {
    const expertReports = experts.map((expert) =>
      buildTaskExpertReport(expert, task, responses, projectId),
    );

    const validMatrices = expertReports
      .filter((item) => item.saved && Array.isArray(item.saved.matriksjson) && item.saved.matriksjson.length > 0)
      .map((item) => item.latestMatrix);

    // 🟢 MENIRU PENANGANAN MATRIKS DEFAULT FASILITATOR (SEPERTI DI KELOLA)
    const facilitatorSaved = responses.find((item: SavedResponse) => {
      const rExpertId = String(item.expertid || '').trim();
      const isFacilitator = rExpertId === 'FACILITATOR' || item.submittedby === 'Fasilitator' || item.submittedby === 'facilitator';
      const sameType = normalizeMethod(item.matrixtype) === normalizeMethod(task.matrixtype);
      if (!isFacilitator || !sameType) return false;
      
      const rParentId = normalizeParentMatch(item.parentid);
      const tParentId = normalizeParentMatch(task.parentid);
      
      if (normalizeMethod(task.matrixtype) === 'criteria') {
        const acceptableParents = [tParentId, normalizeParentMatch(projectId || ''), 'criteria', 'kriteriautama', ''];
        return acceptableParents.includes(rParentId);
      }
      return rParentId === tParentId;
    });

    const facMatrix = facilitatorSaved && facilitatorSaved.matriksjson && facilitatorSaved.matriksjson.length > 0
      ? normalizeMatrix(facilitatorSaved.matriksjson, task.itemnames.length)
      : getDefaultMatrix(task.itemnames.length);

    validMatrices.push(facMatrix);

    let aggregatedWeights: { name: string; weight: number }[] = [];

    if (validMatrices.length > 0) {
      const aggMatrix = aggregateMatricesGeometricMean(validMatrices, task.itemnames.length);
      const ahpRes = calculateAHP(aggMatrix);
      aggregatedWeights = task.itemnames.map((name, idx) => ({
        name,
        weight: ahpRes.weights[idx] || 0,
      }));
    }

    return {
      task,
      expertReports,
      aggregatedWeights,
    };
  });
}

// 🟢 PERHITUNGAN AGREGASI GEOMETRIC MEAN GLOBAL (100% MIRIP KELOLA)
export function buildFinalAggregateRanking(
  project: ProjectDetail,
  criteria: CriteriaItem[],
  subcriteria: SubcriteriaItem[],
  alternatif: AlternatifItem[],
  tasks: MatrixTask[],
  responses: SavedResponse[]
): FinalAlternativeRankingItem[] {
  if (criteria.length === 0) return [];

  const getMatricesForTask = (taskKey: string) => {
    const task = tasks.find((t) => t.key === taskKey);
    if (!task) return [];
    
    const matrices: number[][][] = [];

    responses.forEach((r) => {
      const sameType = normalizeMethod(r.matrixtype) === normalizeMethod(task.matrixtype);
      if (!sameType) return;
      
      const rExpertId = String(r.expertid || '').trim();
      const isFacilitator = rExpertId === 'FACILITATOR' || r.submittedby === 'Fasilitator' || r.submittedby === 'facilitator';
      const hasMatrixData = Array.isArray(r.matriksjson) && r.matriksjson.length > 0;

      if (!isFacilitator && !hasMatrixData) return;

      let parentMatch = false;
      const rParentId = normalizeParentMatch(r.parentid);
      const tParentId = normalizeParentMatch(task.parentid);
      const pId = normalizeParentMatch(project.id);

      if (normalizeMethod(task.matrixtype) === 'criteria') {
        const acceptableParents = [tParentId, pId, 'criteria', 'kriteriautama', ''];
        parentMatch = acceptableParents.includes(rParentId);
      } else {
        parentMatch = rParentId === tParentId;
      }

      if (parentMatch && !isFacilitator) {
        matrices.push(normalizeMatrix(r.matriksjson, task.itemnames.length));
      }
    });

    const facilitatorSaved = responses.find((item: SavedResponse) => {
      const rExpertId = String(item.expertid || '').trim();
      const isFacilitator = rExpertId === 'FACILITATOR' || item.submittedby === 'Fasilitator' || item.submittedby === 'facilitator';
      const sameType = normalizeMethod(item.matrixtype) === normalizeMethod(task.matrixtype);
      if (!isFacilitator || !sameType) return false;
      
      const rParentId = normalizeParentMatch(item.parentid);
      const tParentId = normalizeParentMatch(task.parentid);
      
      if (normalizeMethod(task.matrixtype) === 'criteria') {
        const acceptableParents = [tParentId, normalizeParentMatch(project.id), 'criteria', 'kriteriautama', ''];
        return acceptableParents.includes(rParentId);
      }
      return rParentId === tParentId;
    });

    const facMatrix = facilitatorSaved && facilitatorSaved.matriksjson && facilitatorSaved.matriksjson.length > 0
      ? normalizeMatrix(facilitatorSaved.matriksjson, task.itemnames.length)
      : getDefaultMatrix(task.itemnames.length);

    matrices.push(facMatrix);

    return matrices;
  };

  const criteriaTask = tasks.find((t) => t.key === 'criteria::root');
  let criteriaWeights = Array(criteria.length).fill(1 / criteria.length);
  if (criteriaTask) {
    const matrices = getMatricesForTask('criteria::root');
    if (matrices.length > 0) {
      const aggMatrix = aggregateMatricesGeometricMean(matrices, criteria.length);
      const ahpRes = calculateAHP(aggMatrix);
      criteriaWeights = ahpRes.weights;
    }
  }

  const lowestLevelWeights = new Map<string, {name: string, weight: number}>();

  if (project.punyasubkriteria && subcriteria.length > 0) {
    criteria.forEach((c, cIdx) => {
      const cWeight = criteriaWeights[cIdx] || 0;
      const subTask = tasks.find((t) => t.key === `subcriteria::${c.id}`);
      const subItems = sortByOrder(subcriteria.filter((s) => s.criteriaid === c.id));
      
      if (subTask && subItems.length >= 2) {
        const subMatrices = getMatricesForTask(subTask.key);
        if (subMatrices.length > 0) {
          const aggSubMatrix = aggregateMatricesGeometricMean(subMatrices, subItems.length);
          const ahpRes = calculateAHP(aggSubMatrix);
          const subWeights = ahpRes.weights;

          subItems.forEach((s, sIdx) => {
            lowestLevelWeights.set(s.id, { name: `${c.nama} - ${s.nama}`, weight: cWeight * (subWeights[sIdx] || 0) });
          });
        } else {
          subItems.forEach((s) => lowestLevelWeights.set(s.id, { name: `${c.nama} - ${s.nama}`, weight: cWeight * (1/subItems.length) }));
        }
      } else if (subItems.length === 1) {
        lowestLevelWeights.set(subItems[0].id, { name: `${c.nama} - ${subItems[0].nama}`, weight: cWeight });
      }
    });
  } else {
    criteria.forEach((c, cIdx) => {
      lowestLevelWeights.set(c.id, { name: c.nama, weight: criteriaWeights[cIdx] || 0 });
    });
  }

  if (isAlternativeMethod(project.metode) && alternatif.length > 0) {
    const altScores = new Map<string, number>();
    alternatif.forEach((a) => altScores.set(a.nama, 0));

    lowestLevelWeights.forEach((globalData, parentId) => {
      const altTaskType = project.punyasubkriteria ? 'alternativesbysubcriteria' : 'alternativesbycriteria';
      const altTask = tasks.find((t) => t.key === `${altTaskType}::${parentId}`);
      
      if (altTask) {
        const altMatrices = getMatricesForTask(altTask.key);
        if (altMatrices.length > 0) {
          const aggAltMatrix = aggregateMatricesGeometricMean(altMatrices, alternatif.length);
          const ahpRes = calculateAHP(aggAltMatrix);
          const altWeights = ahpRes.weights;

          alternatif.forEach((a, aIdx) => {
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
      .map(item => ({ name: item.name, score: item.weight, rank: 0 }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }
}

export function buildGeminiAnalysisPayload(params: {
  data: BundleState;
  tasks: MatrixTask[];
  taskReports: TaskReport[];
  expertCompletion: ExpertCompletionItem[];
  finalAlternativeRanking: FinalAlternativeRankingItem[];
}): GeminiAnalysisPayload {
  const { data, tasks, taskReports, expertCompletion, finalAlternativeRanking } = params;

  const completedExperts = expertCompletion.filter((x) => x.finished).length;

  return {
    project: {
      id: data.project.id,
      name: data.project.namaproyek,
      method: data.project.metode,
      hasSubcriteria: data.project.punyasubkriteria,
      totalExperts: data.experts.length,
    },
    completion: {
      totalTasks: tasks.length,
      totalResponses: data.responses.length,
      completedExperts,
      pendingExperts: data.experts.length - completedExperts,
      status:
        completedExperts === data.experts.length
          ? 'lengkap'
          : completedExperts > 0
          ? 'parsial'
          : 'belum_lengkap',
    },
    tasks: taskReports.map((report) => ({
      key: report.task.key,
      title: report.task.title,
      type: report.task.matrixtype,
      parentName: report.task.parentname,
      aggregatedWeights: report.aggregatedWeights.map((item) => ({
        name: item.name,
        weight: Number(item.weight.toFixed(6)),
      })),
      expertReviews: report.expertReports.map((item) => ({
        expertId: item.expert.id,
        expertName: item.expert.expertname,
        institution: item.expert.asalinstansi || '',
        cr: Number(item.latestAnalysis.cr.toFixed(6)),
        status: item.latestAnalysis.cr <= 0.1 ? 'konsisten' : 'perlu_tinjauan',
        updatedAt: item.saved?.updatedat || '',
      })),
    })),
    alternatives: finalAlternativeRanking.map((item) => ({
      name: item.name,
      score: Number(item.score.toFixed(6)),
      rank: item.rank,
    })),
  };
}