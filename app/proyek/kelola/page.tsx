// app/proyek/kelola/page.tsx

'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/auth';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

function cleanPlanType(raw: string): 'free' | 'pro' | 'plus' | 'premium' {
  const str = String(raw || '').toUpperCase().trim();
  if (str.includes('PREMIUM')) return 'premium';
  if (str.includes('PLUS')) return 'plus';
  if (str.includes('PRO')) return 'pro';
  return 'free';
}

function cleanAiText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/[*#$]/g, '')
    .replace(/%/g, ' persen')
    .trim();
}

interface ProjectDetail {
  id: string;
  projectid?: string;
  namaproyek: string;
  deskripsi: string;
  metode: string;
  jumlahexpert: number;
  punyasubkriteria: boolean;
  fasilitatoremail: string;
  fasilitatorwhatsapp: string;
  fasilitatornama?: string;
  createdat?: string;
  updatedat?: string;
  userid?: string;
  useremail?: string;
}

interface CriteriaItem {
  id: string;
  projectid: string;
  kode: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

interface SubcriteriaItem {
  id: string;
  projectid: string;
  criteriaid: string;
  kode: string;
  criterianame?: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

interface AlternatifItem {
  id: string;
  projectid: string;
  kode: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

interface ExpertItem {
  id: string;
  projectid: string;
  expertindex: number;
  expertname: string;
  expertemail: string;
  expertwhatsapp: string;
  gelardepan?: string;
  gelarbelakang?: string;
  token?: string;
  status?: string;
  role?: string;
  asalinstansi?: string;
  pendidikanterakhir?: string;
  bidangkeahlian?: string;
  invitechannel?: string;
  invitesentat?: string;
  confirmedat?: string;
  responsestatus?: string;
  createdat?: string;
  updatedat?: string;
  isreviewed?: boolean;
  [key: string]: any;
}

interface SavedResponse {
  id: string;
  projectid: string;
  expertid: string;
  expertindex: number;
  expertname: string;
  matrixtype: string;
  parentid: string;
  parentname: string;
  itemids: string[];
  itemnames: string[];
  matriksjson: number[][];
  originalmatriksjson: number[][];
  cr: number;
  submittedat: string;
  updatedat: string;
  submittedby?: string;
  lasteditedby?: string;
  editnotes?: string;
  isconfirmed?: boolean;
  confirmedat?: string;
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

interface BundleState {
  project: ProjectDetail;
  criteria: CriteriaItem[];
  subcriteria: SubcriteriaItem[];
  alternatif: AlternatifItem[];
  experts: ExpertItem[];
  responses: SavedResponse[];
}

interface AppsScriptResponse<T = unknown> {
  success?: boolean;
  message?: string;
  errorcode?: string;
  data?: T;
}

interface AhpResult {
  weights: number[];
  lambdaMax: number;
  ci: number;
  cr: number;
}

interface ExpertCompletionItem {
  expert: ExpertItem;
  done: number;
  total: number;
  finished: boolean;
}

interface FinalAggregateRankingItem {
  name: string;
  score: number;
  rank: number;
}

interface EditableExpertState {
  responseId: string;
  expertId: string;
  taskKey: string;
  originalMatrix: number[][];
  currentMatrix: number[][];
}

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

function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => [...row]);
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

function calculateAHP(matrix: number[][]): AhpResult {
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

function sliderToSaaty(val: number, direction: 'left' | 'right' | 'center'): number {
  if (direction === 'center' || val === 0) return 1;
  if (direction === 'left') return val + 1;
  return 1 / (val + 1);
}

function saatyToSliderState(saatyVal: number): { val: number; dir: 'left' | 'right' | 'center' } {
  if (!Number.isFinite(saatyVal) || Math.abs(saatyVal - 1) < 0.0001) {
    return { val: 0, dir: 'center' };
  }
  if (saatyVal > 1) {
    const v = Math.max(1, Math.min(8, Math.round(saatyVal - 1)));
    return { val: v, dir: 'left' };
  } else {
    const reciprocal = 1 / saatyVal;
    const v = Math.max(1, Math.min(8, Math.round(reciprocal - 1)));
    return { val: v, dir: 'right' };
  }
}

function sliderLabel(saatyVal: number, left: string, right: string): string {
  if (Math.abs(saatyVal - 1) < 0.0001) return 'Seimbang (1)';
  if (saatyVal > 1) {
    return `${left} (${Math.round(saatyVal)})`;
  }
  return `${right} (1/${Math.round(1 / saatyVal)})`;
}

function normalizeProject(raw: Record<string, unknown>): ProjectDetail {
  return {
    id: String(raw.id || raw.projectid || raw.project_id || raw.projectId || '').trim(),
    projectid: String(raw.projectid || raw.project_id || raw.id || '').trim(),
    namaproyek: String(raw.namaproyek || raw.nama_proyek || ''),
    deskripsi: String(raw.deskripsi || ''),
    metode: String(raw.metode || ''),
    jumlahexpert: Number(raw.jumlahexpert || raw.jumlah_expert || 0),
    punyasubkriteria: Boolean(raw.punyasubkriteria ?? raw.punya_subkriteria),
    fasilitatoremail: String(raw.fasilitatoremail || raw.fasilitator_email || ''),
    fasilitatorwhatsapp: String(raw.fasilitatorwhatsapp || raw.fasilitator_whatsapp || ''),
    fasilitatornama: String(raw.nama || raw.fasilitatornama || raw.fasilitator_nama || raw.fasilitatorNama || raw.useremail || ''),
    createdat: String(raw.createdat || raw.created_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || raw.createdat || raw.created_at || ''),
    userid: String(raw.userid || raw.user_id || ''),
    useremail: String(raw.useremail || raw.user_email || ''),
  };
}

function normalizeCriteria(raw: Record<string, unknown> | any): CriteriaItem {
  if (!raw || typeof raw !== 'object') {
    const str = String(raw || '').trim();
    return { id: str, projectid: '', kode: '', nama: str, urutan: 0, createdat: '' };
  }
  
  const resolvedName = String(
    raw.kriteria || raw.criteria || raw.nama_kriteria || raw.namakriteria ||
    raw.criteria_name || raw.criterianame || raw.nama || raw.name || raw.teks || ''
  ).trim();

  return {
    id: String(raw.id || raw.criteriaid || raw.criteria_id || '').trim(),
    projectid: String(raw.projectid || raw.project_id || '').trim(),
    kode: String(raw.kode || ''),
    nama: resolvedName,
    urutan: Number(raw.urutan || 0),
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

function normalizeSubcriteria(raw: Record<string, unknown> | any): SubcriteriaItem {
  if (!raw || typeof raw !== 'object') {
    const str = String(raw || '').trim();
    return { id: str, projectid: '', criteriaid: '', kode: '', criterianame: '', nama: str, urutan: 0, createdat: '' };
  }

  let resolvedName = String(
    raw.subkriteria || raw.subcriteria || raw.nama_subkriteria || raw.namasubkriteria ||
    raw.subcriteria_name || raw.subcriterianame || raw.nama || raw.name || raw.teks || ''
  ).trim();

  let resolvedCriteriaName = String(
    raw.criterianame || raw.criteria_name || ''
  ).trim();

  if (/^\d+$/.test(resolvedName) && resolvedCriteriaName && !/^\d+$/.test(resolvedCriteriaName)) {
    resolvedName = resolvedCriteriaName; 
    resolvedCriteriaName = '';           
  }

  const resolvedCriteriaId = String(
    raw.criteriaid || raw.criteria_id || raw.parent_id || raw.parentid || raw.kriteria_id || raw.kriteriaid || ''
  ).trim();

  let parsedUrutan = Number(raw.urutan || 0);
  if (Number.isNaN(parsedUrutan) && /^\d+$/.test(String(raw.nama).trim())) {
    parsedUrutan = Number(String(raw.nama).trim());
  }

  return {
    id: String(raw.id || raw.subcriteriaid || raw.subcriteria_id || '').trim(),
    projectid: String(raw.projectid || raw.project_id || '').trim(),
    criteriaid: resolvedCriteriaId,
    kode: String(raw.kode || ''),
    criterianame: resolvedCriteriaName,
    nama: resolvedName,
    urutan: parsedUrutan,
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

function normalizeAlternative(raw: Record<string, unknown> | any): AlternatifItem {
  if (!raw || typeof raw !== 'object') {
    const str = String(raw || '').trim();
    return { id: str, projectid: '', kode: '', nama: str, urutan: 0, createdat: '' };
  }

  const resolvedName = String(
    raw.alternatif || raw.alternative || raw.nama_alternatif || raw.namaalternatif ||
    raw.alternative_name || raw.alternativename || raw.nama || raw.name || raw.teks || ''
  ).trim();

  return {
    id: String(raw.id || raw.alternativeid || raw.alternative_id || '').trim(),
    projectid: String(raw.projectid || raw.project_id || '').trim(),
    kode: String(raw.kode || ''),
    nama: resolvedName,
    urutan: Number(raw.urutan || 0),
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

function normalizeExpert(raw: Record<string, unknown>): ExpertItem {
  return {
    id: String(raw.id || raw.expertid || raw.expert_id || raw.expertId || '').trim(),
    projectid: String(raw.projectid || raw.project_id || raw.projectId || '').trim(),
    expertindex: Number(raw.expertindex || raw.expert_index || 0),
    expertname: String(raw.expertname || raw.expert_name || raw.nama || ''),
    expertemail: String(raw.expertemail || raw.expert_email || raw.email || ''),
    expertwhatsapp: String(raw.expertwhatsapp || raw.expert_whatsapp || raw.whatsapp || ''),
    gelardepan: String(raw.gelardepan || raw.gelar_depan || ''),
    gelarbelakang: String(raw.gelarbelakang || raw.gelar_belakang || ''),
    token: String(raw.token || ''),
    status: String(raw.status || ''),
    role: String(raw.role || ''),
    asalinstansi: String(raw.asalinstansi || raw.asal_instansi || raw.instansi || ''),
    pendidikanterakhir: String(raw.pendidikanterakhir || raw.pendidikan_terakhir || ''),
    bidangkeahlian: String(raw.bidangkeahlian || raw.bidang_keahlian || ''),
    invitechannel: String(raw.invitechannel || raw.invite_channel || ''),
    invitesentat: String(raw.invitesentat || raw.invite_sent_at || ''),
    confirmedat: String(raw.confirmedat || raw.confirmed_at || ''),
    responsestatus: String(raw.responsestatus || raw.response_status || ''),
    createdat: String(raw.createdat || raw.created_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || ''),
    isreviewed: Boolean(raw.is_reviewed || raw.isreviewed || raw.rating || raw.kompetensi || false)
  };
}

function normalizeSavedResponse(raw: Record<string, unknown>): SavedResponse {
  const parseStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item ?? ''));
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? ''));
      } catch {
        return trimmed.split('|').map((item) => item.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const parseMatrix = (value: unknown): number[][] => {
    if (Array.isArray(value)) {
      return value.map((row) => Array.isArray(row) ? row.map((cell) => Number(cell || 0)) : []);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((row) => Array.isArray(row) ? row.map((cell) => Number(cell || 0)) : []);
        }
      } catch { return []; }
    }
    return [];
  };

  return {
    id: String(raw.id || raw.responseid || raw.response_id || raw.responseId || '').trim(),
    projectid: String(raw.projectid || raw.project_id || raw.projectId || '').trim(),
    expertid: String(raw.expertid || raw.expert_id || raw.expertId || '').trim(),
    expertindex: Number(raw.expertindex || raw.expert_index || raw.expertIndex || 0),
    expertname: String(raw.expertname || raw.expert_name || raw.expertName || ''),
    matrixtype: String(raw.matrixtype || raw.matrix_type || raw.matrixType || '').trim(),
    parentid: String(raw.parentid || raw.parent_id || raw.parentId || '').trim(),
    parentname: String(raw.parentname || raw.parent_name || raw.parentName || ''),
    itemids: parseStringArray(raw.itemids || raw.item_ids || raw.itemIds || raw.item_ids_json),
    itemnames: parseStringArray(raw.itemnames || raw.item_names || raw.itemNames || raw.item_names_json),
    matriksjson: parseMatrix(raw.matriksjson || raw.matriks_json || raw.matrix_json || raw.matrixJson),
    originalmatriksjson: parseMatrix(raw.originalmatriksjson || raw.original_matriks_json || raw.original_matrix_json || raw.originalMatrixJson),
    cr: Number(raw.cr || 0),
    submittedat: String(raw.submittedat || raw.submitted_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || ''),
    submittedby: String(raw.submittedby || raw.submitted_by || ''),
    lasteditedby: String(raw.lasteditedby || raw.last_edited_by || ''),
    editnotes: String(raw.editnotes || raw.edit_notes || ''),
    isconfirmed: Boolean(raw.isconfirmed ?? raw.is_confirmed),
    confirmedat: String(raw.confirmedat || raw.confirmed_at || ''),
  };
}

function buildMatrixTasks(data: BundleState): MatrixTask[] {
  const criteria = sortByOrder(data.criteria);
  const subcriteria = sortByOrder(data.subcriteria);
  const alternatif = sortByOrder(data.alternatif);
  const tasks: MatrixTask[] = [];

  // 1. Kriteria Utama
  if (criteria.length >= 2) {
    tasks.push({
      key: 'criteria::root', 
      title: 'Perbandingan Antar Kriteria Utama',
      description: 'Penilaian bobot kepentingan relatif antar kriteria utama dalam proyek.', 
      matrixtype: 'criteria',
      parentid: data.project.id, 
      parentname: 'Kriteria Utama', 
      itemids: criteria.map(i => i.id), 
      itemnames: criteria.map(i => {
        const n = i.nama.trim();
        if (!n) return `Kriteria ${i.kode || i.urutan || 'Baru'}`;
        if (/^\d+$/.test(n)) return `Kriteria ${n}`;
        return n;
      }),
    });
  }

  // 2. Subkriteria
  if (data.project.punyasubkriteria) {
    criteria.forEach((criterion) => {
      const children = subcriteria.filter((item) => {
        const itemCritId = normalizeParentMatch(item.criteriaid);
        const critId = normalizeParentMatch(criterion.id);
        const critCode = normalizeParentMatch(criterion.kode);
        const critName = normalizeParentMatch(criterion.nama);
        return itemCritId === critId || (critCode && itemCritId === critCode) || (critName && itemCritId === critName);
      });

      if (children.length >= 2) {
        tasks.push({
          key: `subcriteria::${criterion.id}`, 
          title: `Perbandingan Subkriteria: ${criterion.nama}`,
          description: `Penilaian bobot relatif subkriteria di bawah kriteria "${criterion.nama}".`, 
          matrixtype: 'subcriteria',
          parentid: criterion.id, 
          parentname: criterion.nama, 
          itemids: children.map(i => i.id), 
          itemnames: children.map(i => {
            const n = i.nama.trim();
            if (!n) return `Subkriteria ${i.kode || i.urutan || 'Baru'}`;
            if (/^\d+$/.test(n)) return `Subkriteria ${n}`;
            return n;
          }),
        });
      }
    });
  }

  // 3. Alternatif
  if (alternatif.length >= 2 && isAlternativeMethod(data.project.metode)) {
    if (data.project.punyasubkriteria) {
      subcriteria.forEach((subcriterion) => {
        tasks.push({
          key: `alternativesbysubcriteria::${subcriterion.id}`, 
          title: `Perbandingan Alternatif terhadap Subkriteria: ${subcriterion.nama}`,
          description: `Penilaian alternatif berdasarkan performa pada subkriteria "${subcriterion.nama}".`, 
          matrixtype: 'alternativesbysubcriteria',
          parentid: subcriterion.id, 
          parentname: subcriterion.nama, 
          itemids: alternatif.map(i => i.id), 
          itemnames: alternatif.map(i => {
            const n = i.nama.trim();
            if (!n) return `Alternatif ${i.kode || i.urutan || 'Baru'}`;
            if (/^\d+$/.test(n)) return `Alternatif ${n}`;
            return n;
          }),
        });
      });
    } else {
      criteria.forEach((criterion) => {
        tasks.push({
          key: `alternativesbycriteria::${criterion.id}`, 
          title: `Perbandingan Alternatif terhadap Kriteria: ${criterion.nama}`,
          description: `Penilaian alternatif berdasarkan performa pada kriteria "${criterion.nama}".`, 
          matrixtype: 'alternativesbycriteria',
          parentid: criterion.id, 
          parentname: criterion.nama, 
          itemids: alternatif.map(i => i.id), 
          itemnames: alternatif.map(i => {
            const n = i.nama.trim();
            if (!n) return `Alternatif ${i.kode || i.urutan || 'Baru'}`;
            if (/^\d+$/.test(n)) return `Alternatif ${n}`;
            return n;
          }),
        });
      });
    }
  }
  return tasks;
}

function findResponseForTask(
  responses: SavedResponse[], expertId: string, task: MatrixTask, projectId?: string,
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

function buildExpertCompletion(
  experts: ExpertItem[], tasks: MatrixTask[], responses: SavedResponse[], projectId?: string,
): ExpertCompletionItem[] {
  return experts.map((expert) => {
    const done = tasks.filter((task) => findResponseForTask(responses, expert.id, task, projectId)).length;
    return { expert, done, total: tasks.length, finished: tasks.length > 0 && done === tasks.length };
  });
}

function buildFinalAggregateRanking(
  project: ProjectDetail,
  criteria: CriteriaItem[],
  subcriteria: SubcriteriaItem[],
  alternatif: AlternatifItem[],
  tasks: MatrixTask[],
  responses: SavedResponse[],
  facilitatorMap: Record<string, number[][]>,
  editableMap: Record<string, EditableExpertState>
): { rankings: FinalAggregateRankingItem[]; globalCrList: { title: string; cr: number }[] } {
  if (criteria.length === 0) return { rankings: [], globalCrList: [] };

  const globalCrList: { title: string; cr: number }[] = [];

  const getMatricesForTask = (taskKey: string) => {
    const task = tasks.find((t) => t.key === taskKey);
    if (!task) return [];
    
    const matrices: number[][][] = [];

    responses.forEach((r) => {
      const sameType = normalizeMethod(r.matrixtype) === normalizeMethod(task.matrixtype);
      if (!sameType) return;
      
      const rExpertId = String(r.expertid || '').trim();
      const isFacilitator = rExpertId === 'FACILITATOR' || r.submittedby === 'Fasilitator';
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

      if (parentMatch) {
        if (!isFacilitator) {
          const editKey = matrixKey(task.key, r.expertid);
          if (editableMap[editKey] && editableMap[editKey].currentMatrix) {
            matrices.push(normalizeMatrix(editableMap[editKey].currentMatrix, task.itemnames.length));
          } else {
            matrices.push(normalizeMatrix(r.matriksjson, task.itemnames.length));
          }
        }
      }
    });

    if (facilitatorMap[task.key]) {
      matrices.push(normalizeMatrix(facilitatorMap[task.key], task.itemnames.length));
    }

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
      globalCrList.push({ title: criteriaTask.title, cr: ahpRes.cr });
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
          globalCrList.push({ title: subTask.title, cr: ahpRes.cr });

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
          globalCrList.push({ title: altTask.title, cr: ahpRes.cr });

          alternatif.forEach((a, aIdx) => {
            const currentScore = altScores.get(a.nama) || 0;
            altScores.set(a.nama, currentScore + globalData.weight * (altWeights[aIdx] || 0));
          });
        }
      }
    });

    const rankings = [...altScores.entries()]
      .map(([name, score]) => ({ name, score, rank: 0 }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { rankings, globalCrList };
  } else {
    const rankings = Array.from(lowestLevelWeights.values())
      .map(item => ({ name: item.name, score: item.weight, rank: 0 }))
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { rankings, globalCrList };
  }
}

function matrixKey(taskKey: string, expertId: string): string {
  return `${taskKey}::${expertId}`;
}

function upsertResponse(current: SavedResponse[], nextItem: SavedResponse): SavedResponse[] {
  const idx = current.findIndex((item) => item.id === nextItem.id);
  if (idx === -1) return [...current, nextItem];
  const cloned = [...current];
  cloned[idx] = nextItem;
  return cloned;
}

function GlobalPieChart({ data }: { data: FinalAggregateRankingItem[] }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.score, 0);
  if (total === 0) return null;

  const size = 95;
  const radius = 38;
  const center = size / 2;

  if (data.length === 1) {
    return (
      <div title="Distribusi bobot global (100% untuk kategori tunggal)" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill={PIE_COLORS[0]} stroke="#0f172a" strokeWidth="1" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_COLORS[0], display: 'inline-block' }} />
              <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{data[0].name}</span>
            </div>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>100.0%</span>
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
    <div title="Grafik Proporsi Bobot Prioritas Global AHP" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.pathData} fill={slice.color} stroke="#0f172a" strokeWidth="1" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 120 }}>
        {slices.map((slice, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: slice.color, display: 'inline-block' }} />
              <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{slice.name}</span>
            </div>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PairwiseSliderList({ 
  labels, 
  matrix, 
  onChange, 
  disabled = false,
  parentName
}: { 
  labels: string[]; 
  matrix: number[][]; 
  onChange: (i: number, j: number, val: number, dir: 'left' | 'right' | 'center') => void; 
  disabled?: boolean;
  parentName?: string;
}) {
  const pairs: Array<{ i: number; j: number; left: string; right: string }> = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      pairs.push({ i, j, left: labels[i], right: labels[j] });
    }
  }

  return (
    <div style={{ ...STYLES.sliderList, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {pairs.map((pair, index) => {
        const saatyVal = matrix[pair.i]?.[pair.j] ?? 1;
        const state = saatyToSliderState(saatyVal);
        const isLast = index === pairs.length - 1;
        
        return (
          <div key={`${pair.i}-${pair.j}`} style={{ ...STYLES.sliderRow, borderBottom: isLast ? 'none' : '1px solid #e2e8f0' }}>
            <div style={STYLES.sliderHeaderFull}>
              <div style={STYLES.sliderItemLeft} title={pair.left}>
                {pair.left}
              </div>
              <div style={STYLES.sliderVs}>VS</div>
              <div style={STYLES.sliderItemRight} title={pair.right}>
                {pair.right}
              </div>
            </div>

            <div style={STYLES.directionToggleRow}>
              <button
                type="button"
                title={`Prioritaskan "${pair.left}"`}
                style={{
                  ...STYLES.dirBtn,
                  background: state.dir === 'left' ? '#1e3a8a' : '#f8fafc',
                  color: state.dir === 'left' ? '#fff' : '#1e293b',
                  borderColor: state.dir === 'left' ? '#1e3a8a' : '#cbd5e1',
                  fontWeight: state.dir === 'left' ? 700 : 500,
                }}
                onClick={() => onChange(pair.i, pair.j, state.val === 0 ? 1 : state.val, 'left')}
              >
                ← Lebih Penting {pair.left}
              </button>
              <button
                type="button"
                title="Tingkat kepentingan seimbang (Skala: 1)"
                style={{
                  ...STYLES.dirBtn,
                  background: state.dir === 'center' ? '#0f172a' : '#f8fafc',
                  color: state.dir === 'center' ? '#fff' : '#475569',
                  borderColor: state.dir === 'center' ? '#0f172a' : '#cbd5e1',
                  maxWidth: 110
                }}
                onClick={() => onChange(pair.i, pair.j, 0, 'center')}
              >
                Sama Penting (1)
              </button>
              <button
                type="button"
                title={`Prioritaskan "${pair.right}"`}
                style={{
                  ...STYLES.dirBtn,
                  background: state.dir === 'right' ? '#1e3a8a' : '#f8fafc',
                  color: state.dir === 'right' ? '#fff' : '#1e293b',
                  borderColor: state.dir === 'right' ? '#1e3a8a' : '#cbd5e1',
                  fontWeight: state.dir === 'right' ? 700 : 500,
                }}
                onClick={() => onChange(pair.i, pair.j, state.val === 0 ? 1 : state.val, 'right')}
              >
                Lebih Penting {pair.right} →
              </button>
            </div>

            {state.dir !== 'center' && (
              <div title="Geser untuk mengubah intensitas skala perbandingan berpasangan (1 - 9)" style={STYLES.sliderTrackWrap}>
                <input
                  type="range" min={1} max={8} step={1}
                  value={state.val}
                  disabled={disabled}
                  onChange={(e) => onChange(pair.i, pair.j, Number(e.target.value), state.dir)}
                  style={STYLES.slider}
                />
              </div>
            )}

            <div style={STYLES.sliderValueCompact}>
              {sliderLabel(saatyVal, pair.left, pair.right)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<AppsScriptResponse<T>> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  return res.json();
}

function ProjectReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  const [data, setData] = useState<BundleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editableMap, setEditableMap] = useState<Record<string, EditableExpertState>>({});
  const [facilitatorMap, setFacilitatorMap] = useState<Record<string, number[][]>>({});
  const [savingKey, setSavingKey] = useState('');
  const [message, setMessage] = useState('');

  const [loadingAi, setLoadingAi] = useState(false);
  const [fullAiReport, setFullAiReport] = useState<any>(null);

  const [reviewExpert, setReviewExpert] = useState<ExpertItem | null>(null);
  const [kompetensi, setKompetensi] = useState(5);
  const [responsif, setResponsif] = useState(5);
  const [ketepatan, setKetepatan] = useState(5);
  const [ulasan, setUlasan] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [reviewedExpertIds, setReviewedExpertIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const pid = new URLSearchParams(window.location.search).get('id');
      if (pid) {
        const cached = localStorage.getItem(`reviewed_experts_${pid}`);
        if (cached) {
          try { return JSON.parse(cached); } catch(e) {}
        }
      }
    }
    return [];
  });
  
  const [canUseAi, setCanUseAi] = useState(false);
  const [dismissWarning, setDismissWarning] = useState(false);

  useEffect(() => {
    const checkSubscriptionAndLoad = async () => {
      try {
        setLoading(true);
        setError('');
        setMessage('');

        // 🟢 SINKRONISASI PLAN USER DENGAN POLA: SUBSCRIPTIONS -> USERS
        const session = getSession();
        const rawUserId = String(session?.id || session?.userId || session?.user_id || '').trim();
        const rawEmail = String(session?.email || '').trim().toLowerCase();

        if (rawUserId || rawEmail) {
          try {
            const subRes = await fetchJson<any>(
              `${GOOGLESCRIPTURL}?action=getusersubscription&user_id=${encodeURIComponent(rawUserId)}&email=${encodeURIComponent(rawEmail)}`
            );
            if (subRes?.success && subRes?.data?.plan) {
              const cleanPlan = cleanPlanType(subRes.data.plan);
              setCanUseAi(cleanPlan === 'plus' || cleanPlan === 'premium');
            } else {
              // Fallback jika fetch subscription gagal, periksa data session lokal
              const localPlan = cleanPlanType(String(session?.plan || 'free'));
              setCanUseAi(localPlan === 'plus' || localPlan === 'premium');
            }
          } catch (subErr) {
            console.warn('Gagal sinkronisasi subscription:', subErr);
            const localPlan = cleanPlanType(String(session?.plan || 'free'));
            setCanUseAi(localPlan === 'plus' || localPlan === 'premium');
          }
        }

        if (!projectId) throw new Error('Project ID tidak ditemukan.');

        let bundleRes: any;
        let responsesRes: any;

        try {
          bundleRes = await fetchJson<any>(`${GOOGLESCRIPTURL}?action=get_project_bundle&projectid=${encodeURIComponent(projectId)}`);
        } catch (e) { console.error('Gagal fetch bundle'); }
        
        try {
          responsesRes = await fetchJson<any>(`${GOOGLESCRIPTURL}?action=get_all_project_responses&projectid=${encodeURIComponent(projectId)}`);
        } catch (e) { console.error('Gagal fetch responses'); }

        if (!bundleRes?.success || !bundleRes?.data?.project) {
          throw new Error(bundleRes?.message || 'Bundle proyek tidak ditemukan.');
        }

        const finalProject = normalizeProject(bundleRes.data.project);
        const criteria = Array.isArray(bundleRes.data.criteria) ? bundleRes.data.criteria.map(normalizeCriteria) : [];
        const subcriteria = Array.isArray(bundleRes.data.subcriteria) ? bundleRes.data.subcriteria.map(normalizeSubcriteria) : [];
        const alternatif = Array.isArray(bundleRes.data.alternatif) ? bundleRes.data.alternatif.map(normalizeAlternative) : [];
        const experts = Array.isArray(bundleRes.data.experts) ? bundleRes.data.experts.map(normalizeExpert) : [];
        
        let rawResponses: any[] = [];
        if (responsesRes?.success && Array.isArray(responsesRes.data)) {
          rawResponses = responsesRes.data;
        } else if (bundleRes.data?.responses && Array.isArray(bundleRes.data.responses)) {
          rawResponses = bundleRes.data.responses;
        } else if (bundleRes.data?.response && Array.isArray(bundleRes.data.response)) {
          rawResponses = bundleRes.data.response;
        }

        const responses = rawResponses.map(normalizeSavedResponse);

        const nextData: BundleState = { project: finalProject, criteria, subcriteria, alternatif, experts, responses };
        const tasks = buildMatrixTasks(nextData);
        const nextEditable: Record<string, EditableExpertState> = {};
        const nextFacilitator: Record<string, number[][]> = {};

        tasks.forEach((task) => {
          experts.forEach((expert) => {
            const saved = findResponseForTask(responses, expert.id, task, finalProject.id);
            const originalMatrix = normalizeMatrix(saved?.originalmatriksjson?.length ? saved.originalmatriksjson : saved?.matriksjson || [], task.itemnames.length);
            const currentMatrix = normalizeMatrix(saved?.matriksjson || [], task.itemnames.length);

            nextEditable[matrixKey(task.key, expert.id)] = {
              responseId: saved?.id || '', expertId: expert.id, taskKey: task.key, originalMatrix, currentMatrix,
            };
          });

          const facilitatorSaved = responses.find((item: SavedResponse) => {
            const rExpertId = String(item.expertid || '').trim();
            const isFacilitator = item.submittedby === 'Fasilitator' || item.submittedby === 'facilitator' || rExpertId === 'FACILITATOR';
            const sameType = normalizeMethod(item.matrixtype) === normalizeMethod(task.matrixtype);
            if (!isFacilitator || !sameType) return false;
            
            const rParentId = normalizeParentMatch(item.parentid);
            const tParentId = normalizeParentMatch(task.parentid);
            
            if (normalizeMethod(task.matrixtype) === 'criteria') {
              const acceptableParents = [tParentId, normalizeParentMatch(finalProject.id), 'criteria', 'kriteriautama', ''];
              return acceptableParents.includes(rParentId);
            }
            return rParentId === tParentId;
          });

          nextFacilitator[task.key] = facilitatorSaved && facilitatorSaved.matriksjson && facilitatorSaved.matriksjson.length > 0
            ? normalizeMatrix(facilitatorSaved.matriksjson, task.itemnames.length)
            : getDefaultMatrix(task.itemnames.length);
        });

        setEditableMap(nextEditable);
        setFacilitatorMap(nextFacilitator);
        setData(nextData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat laporan proyek.');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) checkSubscriptionAndLoad();
    else { setLoading(false); setError('Project ID tidak ditemukan.'); }
  }, [projectId]);

  const tasks = useMemo(() => {
    if (!data) return [];
    return buildMatrixTasks(data);
  }, [data]);

  const expertCompletion = useMemo(() => {
    if (!data) return [];
    return buildExpertCompletion(data.experts, tasks, data.responses, data.project.id);
  }, [data, tasks]);

  const aggregatedResult = useMemo(() => {
    if (!data) return { rankings: [], globalCrList: [] };
    return buildFinalAggregateRanking(data.project, data.criteria, data.subcriteria, data.alternatif, tasks, data.responses, facilitatorMap, editableMap);
  }, [data, tasks, facilitatorMap, editableMap]);

  const finalAggregateRanking = aggregatedResult.rankings;
  const globalCrList = aggregatedResult.globalCrList;

  const updateExpertMatrix = (taskKey: string, expertId: string, i: number, j: number, val: number, dir: 'left' | 'right' | 'center') => {
    const numericValue = sliderToSaaty(val, dir);
    const key = matrixKey(taskKey, expertId);
    setEditableMap((prev) => {
      const target = prev[key];
      if (!target) return prev;
      const nextMatrix = cloneMatrix(target.currentMatrix);
      nextMatrix[i][j] = numericValue;
      nextMatrix[j][i] = 1 / numericValue;
      nextMatrix[i][i] = 1;
      nextMatrix[j][j] = 1;
      return { ...prev, [key]: { ...target, currentMatrix: nextMatrix } };
    });
  };

  const revertExpertMatrix = (taskKey: string, expertId: string) => {
    const key = matrixKey(taskKey, expertId);
    setEditableMap((prev) => {
      const target = prev[key];
      if (!target) return prev;
      return { ...prev, [key]: { ...target, currentMatrix: cloneMatrix(target.originalMatrix) } };
    });
  };

  const updateFacilitatorMatrix = (taskKey: string, i: number, j: number, val: number, dir: 'left' | 'right' | 'center') => {
    const numericValue = sliderToSaaty(val, dir);
    setFacilitatorMap((prev) => {
      const current = prev[taskKey];
      if (!current) return prev;
      const next = cloneMatrix(current);
      next[i][j] = numericValue;
      next[j][i] = 1 / numericValue;
      next[i][i] = 1;
      next[j][j] = 1;
      return { ...prev, [taskKey]: next };
    });
  };

  const saveExpertRevision = async (task: MatrixTask, expert: ExpertItem) => {
    if (!data) return;
    const key = matrixKey(task.key, expert.id);
    const editable = editableMap[key];
    if (!editable) return;
    const found = findResponseForTask(data.responses, expert.id, task, data.project.id);
    if (!found) { setMessage(`Response expert ${expert.expertname} belum ditemukan.`); return; }

    try {
      setSavingKey(key);
      setMessage('');
      const currentAnalysis = calculateAHP(editable.currentMatrix);
      const isCriteria = normalizeMethod(task.matrixtype) === 'criteria';
      
      const payload = {
        action: 'update_expert_response',
        responseid: found.id,
        projectid: data.project.id,
        expertid: expert.id,
        expert_name: expert.expertname || 'User / Pakar',
        matrixtype: task.matrixtype,
        parent_id: isCriteria ? data.project.id : task.parentid,
        parent_name: isCriteria ? 'Kriteria Utama' : task.parentname,
        itemids: task.itemids,
        itemnames: task.itemnames,
        matriksjson: editable.currentMatrix,
        original_matriks_json: editable.originalMatrix?.length > 0 ? editable.originalMatrix : editable.currentMatrix,
        cr: currentAnalysis.cr,
        editnotes: 'Direvisi fasilitator dari halaman laporan proyek',
      };
      const res = await fetchJson<any>(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!res?.success) throw new Error(res?.message || 'Gagal menyimpan revisi expert.');

      const updatedItem: SavedResponse = {
        ...found,
        expertname: expert.expertname || found.expertname,
        parentid: isCriteria ? data.project.id : task.parentid,
        parent_name: isCriteria ? 'Kriteria Utama' : task.parentname,
        matriksjson: cloneMatrix(editable.currentMatrix),
        originalmatriksjson: editable.originalMatrix?.length > 0 ? cloneMatrix(editable.originalMatrix) : cloneMatrix(editable.currentMatrix),
        cr: currentAnalysis.cr,
        updatedat: new Date().toISOString(),
        editnotes: 'Direvisi fasilitator dari halaman laporan proyek',
      };
      setData((prev) => prev ? { ...prev, responses: upsertResponse(prev.responses, updatedItem) } : prev);
      setMessage(`Revisi expert ${expert.expertname} berhasil disimpan.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan revisi expert.');
    } finally { setSavingKey(''); }
  };

  const saveFacilitatorMatrix = async (task: MatrixTask) => {
    if (!data) return;
    const currentMatrix = facilitatorMap[task.key] || getDefaultMatrix(task.itemnames.length);
    const currentAnalysis = calculateAHP(currentMatrix);
    try {
      setSavingKey(`facilitator::${task.key}`);
      setMessage('');
      
      let cleanName = data.project.fasilitatornama || 'Fasilitator Utama';
      if (!cleanName || cleanName.includes('@')) {
        cleanName = 'Fasilitator Utama';
      }

      const isCriteria = normalizeMethod(task.matrixtype) === 'criteria';

      const payload = {
        action: 'save_facilitator_matrix',
        projectid: data.project.id,
        expertid: 'FACILITATOR',
        expert_name: cleanName,
        submittedby: cleanName,
        matrixtype: task.matrixtype,
        parent_id: isCriteria ? data.project.id : task.parentid,
        parent_name: isCriteria ? 'Kriteria Utama' : task.parentname,
        itemids: task.itemids,
        itemnames: task.itemnames,
        matriksjson: currentMatrix,
        cr: currentAnalysis.cr,
      };
      
      const res = await fetchJson<any>(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!res?.success) throw new Error(res?.message || 'Gagal menyimpan matriks fasilitator.');

      const existingFacilitator = data.responses.find(r => {
        const rExpertId = String(r.expertid || '').trim();
        const rMatrixType = normalizeMethod(r.matrixtype);
        const tMatrixType = normalizeMethod(task.matrixtype);
        if (rExpertId !== 'FACILITATOR' || rMatrixType !== tMatrixType) return false;
        
        const rParentId = normalizeParentMatch(r.parentid);
        const tParentId = normalizeParentMatch(task.parentid);
        
        if (isCriteria) {
          const acceptableParents = [normalizeParentMatch(data.project.id), 'criteria', 'kriteriautama', ''];
          return acceptableParents.includes(rParentId);
        }
        return rParentId === tParentId;
      });

      const updatedItem: SavedResponse = {
        ...(existingFacilitator || {}),
        id: existingFacilitator?.id || `TEMP-${Date.now()}`,
        projectid: data.project.id,
        expertid: 'FACILITATOR',
        expertindex: 0,
        expertname: cleanName,
        matrixtype: task.matrixtype,
        parentid: isCriteria ? data.project.id : task.parentid,
        parent_name: isCriteria ? 'Kriteria Utama' : task.parentname,
        itemids: task.itemids,
        itemnames: task.itemnames,
        matriksjson: currentMatrix,
        originalmatriksjson: currentMatrix,
        cr: currentAnalysis.cr,
        submittedat: existingFacilitator?.submittedat || new Date().toISOString(),
        updatedat: new Date().toISOString(),
        submittedby: cleanName
      };
      setData((prev) => prev ? { ...prev, responses: upsertResponse(prev.responses, updatedItem) } : prev);
      setMessage(`Matriks fasilitator untuk ${task.title} berhasil disimpan.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal menyimpan matriks fasilitator.');
    } finally { setSavingKey(''); }
  };

  const handleCopyLink = (token?: string) => {
    if (!token) return alert('Token tidak ditemukan untuk expert ini.');
    const url = `https://ahp.avitech.cloud/expert?token=${token}`;
    navigator.clipboard.writeText(url);
    alert('Link berhasil disalin!');
  };

  const handleSendEmail = async (expert: ExpertItem) => {
    if (!expert.token) return alert('Token kuesioner belum ada untuk pakar ini.');

    const targetEmail = (expert.expertemail || expert.expert_email || expert.email || '').toString().trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      return alert('Alamat email pakar tidak valid atau belum disetel.');
    }

    const gD = expert.gelardepan ? `${expert.gelardepan} ` : '';
    const gB = expert.gelarbelakang ? `, ${expert.gelarbelakang}` : '';
    const targetName = `${gD}${expert.expertname || expert.expert_name || expert.nama || 'Bapak/Ibu Expert'}${gB}`;

    try {
      setMessage(`Mengirim email undangan ke ${targetName} (${targetEmail})...`);
      const url = `https://ahp.avitech.cloud/expert?token=${expert.token}`;
      const projectName = data?.project.namaproyek || 'Penelitian AHP';

      const res = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sendexpertinvitation',
          expert_email: targetEmail,
          expert_name: targetName,
          project_name: projectName,
          link: url,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setMessage(`Undangan email berhasil dikirimkan ke ${targetName} (${targetEmail}).`);
        alert(`Undangan email berhasil dikirimkan ke ${targetEmail}!`);
      } else {
        throw new Error(json.message || 'Gagal mengirim email via Apps Script.');
      }
      
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : 'Koneksi terputus.';
      setMessage(`Gagal mengirim email: ${errMsg}`);
      alert(`Gagal mengirim email: ${errMsg}`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewExpert || !data) return;

    try {
      setSubmittingReview(true);
      const payload = {
        action: 'save_expert_review',
        expert_id: reviewExpert.id,
        user_id: data.project.userid || 'USER-SYS',
        project_id: data.project.id,
        aspek_kompetensi: kompetensi,
        aspek_responsif: responsif,
        aspek_ketepatan: ketepatan,
        ulasan: ulasan,
      };

      const res = await fetchJson<any>(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      if (!res?.success) throw new Error(res?.message || 'Gagal menyimpan penilaian.');

      setReviewedExpertIds((prev) => {
        const nextIds = [...prev, reviewExpert.id];
        if (typeof window !== 'undefined') {
          localStorage.setItem(`reviewed_experts_${data.project.id}`, JSON.stringify(nextIds));
        }
        return nextIds;
      });

      alert(`Penilaian untuk ${reviewExpert.expertname} berhasil disimpan!`);
      setReviewExpert(null);
      setUlasan('');
      setKompetensi(5);
      setResponsif(5);
      setKetepatan(5);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGenerateAiReport = async () => {
    if (!data) return;
    setLoadingAi(true);
    
    try {
      const completedExpertsCount = expertCompletion.filter(e => e.finished).length;
      
      const payloadTasks = tasks.map(task => {
         const reviews = expertCompletion.map(ec => {
            const resp = findResponseForTask(data.responses, ec.expert.id, task, data.project.id);
            if (resp) {
               return {
                 expertId: ec.expert.id,
                 expertName: ec.expert.expertname,
                 institution: ec.expert.asalinstansi || '',
                 cr: resp.cr,
                 status: resp.cr <= 0.1 ? ('konsisten' as const) : ('perlu_tinjauan' as const)
               };
            }
            return null;
         }).filter((r): r is NonNullable<typeof r> => r !== null);

         return {
           key: task.key,
           title: task.title,
           type: task.matrixtype,
           parentName: task.parentname,
           aggregatedWeights: [], 
           expertReviews: reviews
         };
      });

      const payload = {
        project: {
          id: data.project.id,
          name: data.project.namaproyek,
          method: data.project.metode,
          hasSubcriteria: data.project.punyasubkriteria,
          totalExperts: data.experts.length
        },
        completion: {
          totalTasks: tasks.length,
          totalResponses: data.responses.length,
          completedExperts: completedExpertsCount,
          pendingExperts: data.experts.length - completedExpertsCount,
          status: completedExpertsCount >= data.experts.length ? ('lengkap' as const) : (completedExpertsCount > 0 ? ('parsial' as const) : ('belum_lengkap' as const))
        },
        tasks: payloadTasks,
        alternatives: finalAggregateRanking 
      };

      const res = await fetch('/api/report-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      
      if (json.success) {
        setFullAiReport(json.data);
      } else {
        alert('Gagal membuat laporan AI: ' + json.message);
      }
    } catch(err) {
      alert('Terjadi kesalahan saat memanggil AI: ' + err);
    } finally {
      setLoadingAi(false);
    }
  };

  if (loading) return <div style={STYLES.page}><div style={STYLES.loader}>Memuat Data Laporan...</div></div>;
  if (error || !data) return (
    <div style={STYLES.page}>
      <div style={STYLES.card}>
        <div style={STYLES.errorBox}>{error || 'Data laporan tidak tersedia.'}</div>
        <button type="button" onClick={() => router.back()} style={STYLES.btnSecondary}>Kembali</button>
      </div>
    </div>
  );

  const hasAlternatives = isAlternativeMethod(data.project.metode) && data.alternatif.length > 0;
  
  const unreviewedFinishedExpertsCount = expertCompletion.filter(
    (item) => item.finished && !item.expert.isreviewed && !reviewedExpertIds.includes(item.expert.id)
  ).length;

  return (
    <div style={STYLES.page}>
      
      {/* 🟢 POSISI PALING ATAS & STICKY (FREEZE): GRAFIK & CR GLOBAL */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#f8fafc', paddingBottom: 8, paddingTop: 4 }}>
        <section style={STYLES.cardPrimarySticky} className="print-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            <div>
              <h2 style={{...STYLES.sectionTitle, color: '#fff', fontSize: 14}}>Grafik Pie Chart Global</h2>
              <p style={{...STYLES.metaText, color: '#cbd5e1', marginTop: 1, fontSize: 10.5}}>
                {hasAlternatives ? 'Skor prioritas alternatif tertinggi.' : 'Bobot prioritas kriteria/subkriteria.'}
              </p>
            </div>
            
            <div title="Consistency Ratio (CR) Global. Nilai <= 0.1 dianggap konsisten (✓)" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 6px', cursor: 'help' }}>
              <div style={{ color: '#94a3b8', fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 1 }}>CR Global</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {globalCrList.length === 0 ? (
                  <span style={{ color: '#fff', fontSize: 10.5 }}>-</span>
                ) : (
                  globalCrList.map((gCr, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: '#cbd5e1', fontSize: 10 }}>{gCr.title}:</span>
                      <span style={{ fontWeight: 700, fontSize: 10.5, color: gCr.cr <= 0.1 ? '#4ade80' : '#f87171' }}>
                        {formatNumber(gCr.cr, 3)} {gCr.cr <= 0.1 ? '✓' : '⚠️'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            <GlobalPieChart data={finalAggregateRanking} />
          </div>

          <div style={{...STYLES.weightRowGrid, maxHeight: 95, overflowY: 'auto' }}>
            {finalAggregateRanking.length === 0 ? (
              <div style={{color: '#fff', fontSize: 11}}>Belum ada data aktif...</div>
            ) : (
              finalAggregateRanking.map((item) => (
                <div key={item.name} title={`Peringkat #${item.rank}: ${item.name} (Skor: ${formatNumber(item.score, 5)})`} style={{...STYLES.weightCardDark, padding: '4px 8px', cursor: 'help'}}>
                  <div style={{...STYLES.rankBadge, width: 20, height: 20, fontSize: 10.5}}>#{item.rank}</div>
                  <div style={{...STYLES.weightInfo}}>
                    <div style={{...STYLES.weightLabelDark, fontSize: 10.5}}>{item.name}</div>
                    <div style={{...STYLES.weightValueDark, fontSize: 12}}>{formatNumber(item.score, 5)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div style={STYLES.container}>
        {reviewExpert && (
          <div style={STYLES.modalOverlay}>
            <div style={STYLES.modalContent}>
              <h3 style={STYLES.sectionTitle}>Beri Penilaian untuk {reviewExpert.expertname}</h3>
              <p style={STYLES.metaText}>Nilai expert berdasarkan beberapa aspek kualitas kinerja.</p>
              
              <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={STYLES.label}>Kompetensi / Keahlian (1 - 5):</label>
                  <input type="number" min={1} max={5} value={kompetensi} onChange={(e) => setKompetensi(Number(e.target.value))} style={STYLES.inputNumber} required />
                </div>
                <div>
                  <label style={STYLES.label}>Responsivitas / Komunikasi (1 - 5):</label>
                  <input type="number" min={1} max={5} value={responsif} onChange={(e) => setResponsif(Number(e.target.value))} style={STYLES.inputNumber} required />
                </div>
                <div>
                  <label style={STYLES.label}>Ketepatan Waktu Pengisian (1 - 5):</label>
                  <input type="number" min={1} max={5} value={ketepatan} onChange={(e) => setKetepatan(Number(e.target.value))} style={STYLES.inputNumber} required />
                </div>
                <div>
                  <label style={STYLES.label}>Ulasan / Catatan Tambahan (Opsional):</label>
                  <textarea value={ulasan} onChange={(e) => setUlasan(e.target.value)} style={STYLES.textarea} placeholder="Tulis ulasan kinerja expert..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => setReviewExpert(null)} style={STYLES.btnSecondary}>Batal</button>
                  <button type="submit" style={STYLES.btnPrimary} disabled={submittingReview}>
                    {submittingReview ? 'Menyimpan...' : 'Kirim Penilaian'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Laporan &amp; Review Matriks</h1>
            <p style={STYLES.pageDesc}>Pengelolaan pakar, review konsistensi (CR), dan rekapitulasi pembobotan AHP.</p>
          </div>
          <div style={STYLES.headerActions}>
            
            {canUseAi ? (
              <button 
                onClick={handleGenerateAiReport} 
                disabled={loadingAi}
                style={{
                  ...STYLES.btnPrimary,
                  background: '#2563eb',
                  cursor: loadingAi ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingAi ? '⏳ Menyusun...' : '🤖 Draf Laporan AI'}
              </button>
            ) : (
              <button 
                title="Tingkatkan paket ke PLUS atau PREMIUM untuk menggunakan fasilitas ini"
                onClick={() => alert('Fasilitas Draf Laporan AI hanya tersedia untuk paket PLUS dan PREMIUM. Silakan tingkatkan langganan Anda.')} 
                style={{
                  ...STYLES.btnPrimary,
                  background: '#94a3b8', 
                  color: '#f8fafc',
                  cursor: 'not-allowed',
                  border: '1px solid #cbd5e1'
                }}
              >
                🔒 Draf Laporan AI
              </button>
            )}

            <button 
              type="button" 
              title="Buka halaman laporan lengkap proyek di tab baru" 
              onClick={() => window.open(`/proyek/laporan?id=${projectId}`, '_blank')} 
              style={STYLES.btnGhost}
            >
              🖨️ Cetak
            </button>
            <button type="button" title="Kembali ke dashboard" onClick={() => router.push('/dashboard')} style={STYLES.btnSecondary}>Dashboard</button>
          </div>
        </div>

        {message && <div style={STYLES.infoBox}>{message}</div>}

        {/* AI REPORT SUMMARY */}
        {fullAiReport && (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '20px 24px', borderRadius: '12px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Draf Laporan Analisis AHP Otomatis (Gemini AI)
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: 13 }}>Ringkasan Eksekutif</h4>
              <p style={{ margin: 0, fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                {fullAiReport.overview?.main_summary || fullAiReport.overview || 'Ringkasan berhasil disusun.'}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: 13 }}>Temuan Kunci (Key Findings)</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                {fullAiReport.key_findings?.map((item: any, idx: number) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    <strong>{item.title}</strong>: {item.message}
                  </li>
                )) || <li>Temuan analisis berhasil diproses.</li>}
              </ul>
            </div>

            {fullAiReport.consistency_review && fullAiReport.consistency_review.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: 13 }}>Tinjauan Konsistensi Pakar</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                  {fullAiReport.consistency_review.map((item: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      <strong>{item.expert_name} ({item.task_title})</strong>: CR {Number(item.cr_value || 0).toFixed(3)} - 
                      <span style={{ color: item.status === 'konsisten' ? '#16a34a' : '#dc2626', marginLeft: 4, fontWeight: 600 }}>
                        {String(item.status || '').toUpperCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 style={{ margin: '0 0 6px', color: '#1e3a8a', fontSize: 13 }}>Rekomendasi Tindak Lanjut</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                {fullAiReport.recommendations?.map((rec: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: 4 }}>{rec}</li>
                )) || <li>Lanjutkan evaluasi hasil sintesis prioritas.</li>}
              </ul>
            </div>
          </div>
        )}

        {/* 🟢 BANNER PERINGATAN DENGAN TOMBOL TUTUP */}
        {unreviewedFinishedExpertsCount > 0 && !dismissWarning && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            border: '1px solid #f59e0b',
            color: '#b45309',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>Peringatan: Ada <strong>{unreviewedFinishedExpertsCount} expert</strong> yang telah menyelesaikan tugas kuesionernya namun belum Anda berikan penilaian kinerja (⭐).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, background: '#f59e0b', color: '#fff', padding: '2px 8px', borderRadius: 999 }}>Harap Nilai</span>
              <button 
                onClick={() => setDismissWarning(true)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: '#b45309', padding: '0 4px', fontWeight: 800 }}
                title="Abaikan peringatan ini"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 🟢 DI BAWAH GRAFIK & CR GLOBAL: JUDUL KEGIATAN, METODE, & PARAMETER */}
        <section style={{ ...STYLES.card, padding: '14px 16px' }}>
          <div>
            <div style={STYLES.metaHeader}>
              <h2 style={{...STYLES.sectionTitle, fontSize: 16}}>{data.project.namaproyek}</h2>
              <span title="Metode perhitungan dan pembobotan AHP" style={STYLES.badgeSoft}>{formatMethodLabel(data.project.metode)}</span>
            </div>
            <p style={{...STYLES.metaText, fontSize: 11.5, marginTop: 4}}>{data.project.deskripsi || 'Tidak ada deskripsi.'}</p>
          </div>
          
          <div style={{ marginTop: 10, overflowX: 'auto', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 11.5 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', color: '#64748b', fontWeight: 600, background: '#f8fafc', width: '35%' }}>Metode AHP</td>
                  <td style={{ padding: '6px 10px', color: '#0f172a', fontWeight: 700 }}>{formatMethodLabel(data.project.metode)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', color: '#64748b', fontWeight: 600, background: '#f8fafc' }}>Subkriteria</td>
                  <td style={{ padding: '6px 10px', color: '#0f172a', fontWeight: 700 }}>{data.project.punyasubkriteria ? 'Diaktifkan' : 'Tidak Ada'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', color: '#64748b', fontWeight: 600, background: '#f8fafc' }}>Sesi Tugas</td>
                  <td style={{ padding: '6px 10px', color: '#0f172a', fontWeight: 700 }}>{tasks.length} Sesi</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 10px', color: '#64748b', fontWeight: 600, background: '#f8fafc' }}>Jumlah Expert</td>
                  <td style={{ padding: '6px 10px', color: '#0f172a', fontWeight: 700 }}>{data.experts.length} Orang</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 🟢 RANKING PRIORITAS SINTESIS AKHIR (DI BAWAH JUDUL DAN METODE) */}
        <section style={STYLES.card}>
          <h2 style={{ ...STYLES.sectionTitle, marginBottom: 8 }}>Ranking Prioritas Sintesis Akhir</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th style={{ ...STYLES.th, width: 50, textAlign: 'center' }}>Rank</th>
                  <th style={STYLES.th}>Alternatif / Elemen</th>
                  <th style={{ ...STYLES.th, textAlign: 'right' }}>Bobot Skor</th>
                </tr>
              </thead>
              <tbody>
                {finalAggregateRanking.map((item) => (
                  <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ background: item.rank === 1 ? '#1e3a8a' : '#f1f5f9', color: item.rank === 1 ? '#fff' : '#334155', fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                        #{item.rank}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatNumber(item.score, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* STATUS RESPONDEN TABLE */}
        <section style={STYLES.card}>
          <h2 style={STYLES.sectionTitle}>Status Responden &amp; Penilaian (Rating)</h2>
          <div style={STYLES.tableWrap}>
            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Nama &amp; Instansi</th>
                  <th style={STYLES.th}>Progress</th>
                  <th style={STYLES.th}>Status</th>
                  <th style={STYLES.th}>Aksi Undangan</th>
                  <th style={STYLES.th}>Penilaian Expert</th>
                </tr>
              </thead>
              <tbody>
                {expertCompletion.length === 0 ? (
                  <tr><td style={STYLES.td} colSpan={5} align="center">Belum ada responden.</td></tr>
                ) : (
                  expertCompletion.map((item) => {
                    const expEmail = item.expert.expertemail || item.expert.expert_email || item.expert.email || '';

                    const gD = item.expert.gelardepan ? `${item.expert.gelardepan} ` : '';
                    const gB = item.expert.gelarbelakang ? `, ${item.expert.gelarbelakang}` : '';
                    const namaUtama = item.expert.expertname || item.expert.expert_name || item.expert.nama || 'Pakar Tanpa Nama';
                    const namaLengkap = `${gD}${namaUtama}${gB}`;

                    const isFinishedUnreviewed = item.finished && !item.expert.isreviewed && !reviewedExpertIds.includes(item.expert.id);

                    return (
                      <tr key={item.expert.id} style={{ opacity: item.finished ? 1 : 0.85 }}>
                        <td style={STYLES.tdHead}>
                          {namaLengkap}
                          <div style={STYLES.tdSubText}>{item.expert.asalinstansi || 'Instansi belum diatur'}</div>
                        </td>
                        <td style={STYLES.td}><strong>{item.done}</strong> / {item.total}</td>
                        <td style={STYLES.td}>
                          <span title={item.finished ? "Semua sesi matriks telah diisi" : "Belum lengkap"} style={item.finished ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                            {item.finished ? 'Selesai' : item.done > 0 ? 'Parsial' : 'Tertunda'}
                          </span>
                        </td>
                        <td style={STYLES.td}>
                          <div style={STYLES.actionGroup}>
                            <button title="Salin link kuesioner expert" onClick={() => handleCopyLink(item.expert.token)} style={STYLES.btnActionSmall}>🔗</button>
                            {expEmail && expEmail.trim() !== '' && (
                              <button title="Kirim undangan via Email" onClick={() => handleSendEmail(item.expert)} style={{...STYLES.btnActionSmall, color: '#3730a3', background: '#e0e7ff'}}>Mail</button>
                            )}
                          </div>
                        </td>
                        <td style={STYLES.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button 
                              onClick={() => item.finished && setReviewExpert(item.expert)} 
                              disabled={!item.finished}
                              style={{
                                ...STYLES.btnActionSmall, 
                                color: item.finished ? '#b45309' : '#94a3b8', 
                                background: isFinishedUnreviewed ? '#fef08a' : item.finished ? '#fef3c7' : '#f1f5f9',
                                border: isFinishedUnreviewed ? '1px solid #eab308' : 'none',
                                cursor: item.finished ? 'pointer' : 'not-allowed',
                                opacity: item.finished ? 1 : 0.6,
                                fontWeight: isFinishedUnreviewed ? 700 : 600
                              }} 
                              title={item.finished ? "Beri penilaian kinerja expert" : "Expert belum menyelesaikan tugas"}
                            >
                              ⭐ Nilai Expert
                            </button>
                            {isFinishedUnreviewed && (
                              <span title="Data expert sudah masuk, silakan berikan penilaian!" style={{ color: '#d97706', fontSize: 10, fontWeight: 700, background: '#fef9c3', padding: '2px 6px', borderRadius: 4, border: '1px solid #fde047' }}>
                                ⚠️ Belum Dinilai
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* TUGAS MATRIKS PERBANDINGAN BERPASANGAN */}
        {tasks.map((task) => {
          const facilitatorMatrix = facilitatorMap[task.key] || getDefaultMatrix(task.itemnames.length);
          const facilitatorAnalysis = calculateAHP(facilitatorMatrix);

          return (
            <section key={task.key} style={STYLES.card}>
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 12 }}>
                <h2 style={STYLES.sectionTitle}>{task.title}</h2>
                <p style={STYLES.metaText}>{task.description}</p>
              </div>

              {/* MATRIKS FASILITATOR */}
              <div style={STYLES.taskPanel}>
                <div style={STYLES.panelHeader}>
                  <div>
                    <h3 style={STYLES.subTitle}>Matriks Fasilitator</h3>
                    <p style={STYLES.metaText}>Perubahan bobot perbandingan di bawah akan langsung mempengaruhi hasil sintesis global.</p>
                  </div>
                  <div style={STYLES.headerActions}>
                    <span title={`Consistency Ratio (CR) Fasilitator: ${formatNumber(facilitatorAnalysis.cr, 4)}`} style={facilitatorAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                      CR: {formatNumber(facilitatorAnalysis.cr, 3)}
                    </span>
                    <button type="button" title="Simpan perubahan matriks fasilitator ke database" style={STYLES.btnPrimary} onClick={() => saveFacilitatorMatrix(task)} disabled={savingKey === `facilitator::${task.key}`}>
                      {savingKey === `facilitator::${task.key}` ? 'Menyimpan...' : 'Simpan Matriks'}
                    </button>
                  </div>
                </div>
                
                <div style={STYLES.contentGrid}>
                  <div style={{ flex: 2, minWidth: 280 }}>
                    <PairwiseSliderList 
                      labels={task.itemnames} 
                      matrix={facilitatorMatrix} 
                      onChange={(i, j, val, dir) => updateFacilitatorMatrix(task.key, i, j, val, dir)} 
                      parentName={task.parentname}
                    />
                  </div>
                  <div style={STYLES.compactWeightPanel}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Bobot Hasil Sintesis:</div>
                    {task.itemnames.map((label, idx) => (
                      <div key={`fac-${label}`} title={`Bobot lokal untuk ${label}`} style={STYLES.weightCardLight}>
                        <div style={STYLES.weightLabel}>{label}</div>
                        <div style={STYLES.weightValue}>{formatNumber(facilitatorAnalysis.weights[idx] || 0, 4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MATRIKS RESPONS EXPERT */}
              {data.experts.map((expert) => {
                const key = matrixKey(task.key, expert.id);
                const editable = editableMap[key];
                const saved = findResponseForTask(data.responses, expert.id, task, data.project.id);
                const isSubmitted = !!saved;

                const originalMatrix = editable?.originalMatrix || getDefaultMatrix(task.itemnames.length);
                const currentMatrix = editable?.currentMatrix || getDefaultMatrix(task.itemnames.length);
                const currentAnalysis = calculateAHP(currentMatrix);

                const gD = expert.gelardepan ? `${expert.gelardepan} ` : '';
                const gB = expert.gelarbelakang ? `, ${expert.gelarbelakang}` : '';
                const namaUtama = expert.expertname || expert.expert_name || expert.nama || '-';
                const headerNamaLengkap = `${gD}${namaUtama}${gB}`;

                return (
                  <div key={key} style={isSubmitted ? STYLES.expertBlock : STYLES.expertBlockDisabled}>
                    <div style={STYLES.panelHeader}>
                      <div>
                        <h3 style={isSubmitted ? STYLES.subTitle : STYLES.subTitleDisabled}>{headerNamaLengkap}</h3>
                        <p style={STYLES.metaText}>{expert.asalinstansi || '-'}</p>
                      </div>
                      <div style={STYLES.headerActions}>
                        {isSubmitted ? (
                          <>
                            <span title="Consistency Ratio (CR) dari jawaban asli expert" style={currentAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                              CR Asli: {formatNumber(calculateAHP(originalMatrix).cr, 3)}
                            </span>
                            <span title="Consistency Ratio (CR) berdasarkan revisi fasilitator saat ini" style={currentAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                              CR Revisi: {formatNumber(currentAnalysis.cr, 3)}
                            </span>
                            <button type="button" title="Simpan hasil revisi fasilitator untuk expert ini" style={STYLES.btnPrimary} onClick={() => saveExpertRevision(task, expert)} disabled={savingKey === key}>
                              {savingKey === key ? 'Menyimpan...' : 'Simpan Revisi'}
                            </button>
                            <button type="button" title="Kembalikan matriks ke jawaban asli expert (Revert)" style={STYLES.btnGhost} onClick={() => revertExpertMatrix(task.key, expert.id)}>Kembalikan</button>
                          </>
                        ) : (
                          <span title="Responden belum mengisi sesi ini" style={STYLES.badgeLocked}>🔒 Belum Mengisi</span>
                        )}
                      </div>
                    </div>

                    {isSubmitted ? (
                      <div style={STYLES.contentGrid}>
                        <div style={{ flex: 2, minWidth: 280 }}>
                          <PairwiseSliderList 
                            labels={task.itemnames} 
                            matrix={currentMatrix} 
                            onChange={(i, j, val, dir) => updateExpertMatrix(task.key, expert.id, i, j, val, dir)} 
                            parentName={task.parentname}
                          />
                        </div>
                        <div style={STYLES.compactWeightPanel}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Bobot Jawaban Expert:</div>
                          {task.itemnames.map((label, idx) => (
                            <div key={`exp-${label}`} title={`Bobot lokal expert untuk ${label}`} style={STYLES.weightCardLight}>
                              <div style={STYLES.weightLabel}>{label}</div>
                              <div style={STYLES.weightValue}>{formatNumber(currentAnalysis.weights[idx] || 0, 4)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={STYLES.lockedPanel}>
                        Data perbandingan belum tersedia karena <strong>{headerNamaLengkap}</strong> belum menyelesaikan tugas ini.
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectReportPage() {
  return (
    <Suspense fallback={<div style={STYLES.page}><div style={STYLES.loader}>Memuat Halaman Kelola...</div></div>}>
      <ProjectReportContent />
    </Suspense>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { 
    background: 'linear-gradient(rgba(248, 250, 252, 0.90), rgba(248, 250, 252, 0.60)), url("/bg-kelola.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    minHeight: '100vh', 
    padding: '16px 12px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  loader: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b', fontSize: 14, fontWeight: 500 },
  container: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  
  card: { background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.02)', border: '1px solid #f1f5f9' },
  
  cardPrimarySticky: { 
    background: '#0f172a', 
    borderRadius: 10, 
    padding: '12px 16px', 
    boxShadow: '0 6px 20px rgba(15,23,42,0.2)',
    maxWidth: 980,
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  headerActions: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  
  pageTitle: { margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' },
  pageDesc: { margin: '2px 0 0', color: '#64748b', fontSize: 12 },
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.3px' },
  subTitle: { margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1e293b' },
  subTitleDisabled: { margin: 0, fontSize: 13.5, fontWeight: 600, color: '#94a3b8' },
  
  metaHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  metaText: { color: '#64748b', margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.4 },
  
  taskPanel: { marginTop: 10, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafafb' },
  expertBlock: { marginTop: 14, paddingTop: 12, borderTop: '1px dashed #cbd5e1' },
  expertBlockDisabled: { marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0', opacity: 0.8 },
  lockedPanel: { background: '#f1f5f9', color: '#64748b', padding: 12, borderRadius: 6, textAlign: 'center', fontSize: 12, border: '1px dashed #cbd5e1' },
  contentGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  compactWeightPanel: { flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 5 },

  sliderList: { display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' },
  sliderRow: { padding: '8px 10px' }, 
  
  sliderHeaderFull: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    fontSize: 12,
    marginBottom: 6,
    gap: 8
  },
  sliderItemLeft: { fontWeight: 700, color: '#0f172a', flex: 1, textAlign: 'left', lineHeight: 1.3 },
  sliderItemRight: { fontWeight: 700, color: '#0f172a', flex: 1, textAlign: 'right', lineHeight: 1.3 },
  sliderVs: { color: '#94a3b8', fontSize: 10, fontWeight: 800, padding: '0 6px', background: '#f1f5f9', borderRadius: 4 },
  
  directionToggleRow: { display: 'flex', gap: 4, margin: '6px 0' },
  dirBtn: { 
    flex: 1, 
    padding: '6px 8px', 
    fontSize: 11, 
    fontWeight: 600, 
    border: '1px solid #cbd5e1', 
    borderRadius: 6, 
    cursor: 'pointer', 
    transition: '0.15s',
    lineHeight: 1.3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  },

  sliderTrackWrap: { marginTop: 4, padding: '0 4px' },
  slider: { width: '100%', cursor: 'pointer', height: '5px' },
  sliderValueCompact: { marginTop: 4, fontSize: 11, color: '#1e40af', textAlign: 'center', fontWeight: 700, background: '#eff6ff', padding: '2px 6px', borderRadius: 4, display: 'inline-block', width: '100%', boxSizing: 'border-box' },

  weightRowGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  weightCardDark: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 },
  rankBadge: { background: '#38bdf8', color: '#0f172a', fontWeight: 800, fontSize: 11, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  weightInfo: { display: 'flex', flexDirection: 'column', gap: 0 },
  weightLabelDark: { color: '#e2e8f0', fontSize: 10.5, fontWeight: 500 },
  weightValueDark: { color: '#fff', fontWeight: 800, fontSize: 12.5 },
  
  weightCardLight: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  weightLabel: { color: '#334155', fontSize: 11.5, fontWeight: 600, flex: 1, paddingRight: 8 },
  weightValue: { color: '#1e40af', fontWeight: 800, fontSize: 12 },

  tableWrap: { overflowX: 'auto', marginTop: 8, borderRadius: 6, border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 520, background: '#fff' },
  th: { textAlign: 'left', padding: '8px 10px', background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 600, borderBottom: '1px solid #e2e8f0' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: 11.5, verticalAlign: 'middle' },
  tdHead: { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, fontSize: 11.5, verticalAlign: 'middle' },
  tdSubText: { fontSize: 10, color: '#94a3b8', marginTop: 1, fontWeight: 400 },

  badgeSoft: { background: '#f8fafc', color: '#475569', padding: '2px 6px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.5px' },
  badgeSuccess: { background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 },
  badgeWarning: { background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 },
  badgeLocked: { background: '#f1f5f9', color: '#94a3b8', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, border: '1px solid #e2e8f0' },

  btnPrimary: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 11.5, transition: '0.2s' },
  btnSecondary: { background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 11.5 },
  btnGhost: { background: 'transparent', color: '#64748b', border: 'none', padding: '6px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11.5 },
  actionGroup: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  btnActionSmall: { padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: 'pointer', border: 'none', background: '#f8fafc', color: '#334155' },

  errorBox: { background: '#fef2f2', color: '#991b1b', border: '1px dashed #fecaca', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 12 },
  infoBox: { background: '#f0fdfa', color: '#0f766e', border: '1px dashed #99f6e4', padding: 10, borderRadius: 6, fontSize: 12, fontWeight: 500 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 10 },
  modalContent: { background: '#fff', borderRadius: 10, padding: 18, maxWidth: 420, width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
  label: { fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 3 },
  inputNumber: { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, minHeight: 60, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }
};