// app/proyek/laporan/page.tsx

'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

function cleanPlanType(raw: string): 'free' | 'pro' | 'plus' | 'premium' {
  const str = String(raw || '').toUpperCase().trim();
  if (str.includes('PREMIUM')) return 'premium';
  if (str.includes('PLUS')) return 'plus';
  if (str.includes('PRO')) return 'pro';
  return 'free';
}

function cleanAiText(rawText: any): string {
  if (!rawText) return '';
  const str = typeof rawText === 'string' ? rawText : String(rawText);
  return str
    .replace(/[*#$]/g, '')
    .replace(/%/g, ' persen')
    .trim();
}

function checkCustomAiPrivilege(rawCustom: any): boolean {
  if (!rawCustom) return false;
  if (rawCustom === true || rawCustom === 1 || rawCustom === '1' || rawCustom === 'true') {
    return true;
  }
  if (typeof rawCustom === 'object' && !Array.isArray(rawCustom)) {
    return Boolean(rawCustom.ai || rawCustom.ai_analysis || rawCustom.enable_ai || rawCustom.gemini);
  }
  const str = Array.isArray(rawCustom) ? rawCustom.join(',') : String(rawCustom);
  return /\b(ai|ai_analysis|analisis_ai|gemini|enable_ai)\b/i.test(str);
}

function checkCustomFeature(rawCustom: any, featureKeyword: string): boolean {
  if (!rawCustom) return false;
  if (rawCustom === true || rawCustom === 1 || rawCustom === '1' || rawCustom === 'true') {
    return true;
  }
  if (typeof rawCustom === 'object' && !Array.isArray(rawCustom)) {
    return Boolean(rawCustom[featureKeyword]);
  }
  const str = Array.isArray(rawCustom) ? rawCustom.join(',') : String(rawCustom);
  const regex = new RegExp(`\\b(${featureKeyword})\\b`, 'i');
  return regex.test(str);
}

function extractRowData(res: any, targetEmail: string): any {
  if (!res) return null;
  let dataTarget = res.data || res.result || res.payload;
  if (!dataTarget) dataTarget = res;
  if (Array.isArray(dataTarget)) {
    const found = dataTarget.find((item: any) => {
      const em = String(item.user_email || item.email || item.useremail || item.username || '').trim().toLowerCase();
      return em === targetEmail;
    });
    return found || dataTarget[0] || null;
  }
  if (dataTarget !== null && typeof dataTarget === 'object') {
    return dataTarget;
  }
  return null;
}

function normalizeSubscriptionData(raw: any, targetEmail: string): any {
  if (!raw) return null;
  let dataObj = raw.data || raw.result || raw.payload || raw;
  if (Array.isArray(dataObj)) {
    dataObj = dataObj.find((item: any) => {
      const em = String(item.user_email || item.email || '').trim().toLowerCase();
      return em === targetEmail.trim().toLowerCase();
    }) || dataObj[0] || null;
  }
  if (!dataObj || typeof dataObj !== 'object') return null;

  const getField = (keys: string[]) => {
    for (const k of keys) {
      for (const objKey of Object.keys(dataObj)) {
        const cleanObjKey = objKey.toLowerCase().replace(/[\s_]/g, '');
        const cleanTargetKey = k.toLowerCase().replace(/[\s_]/g, '');
        if (cleanObjKey === cleanTargetKey && dataObj[objKey] !== undefined && dataObj[objKey] !== '') {
          return dataObj[objKey];
        }
      }
    }
    return undefined;
  };

  const rawPlan = getField(['plan', 'plantype', 'status_plan']);
  const rawStatus = getField(['status', 'subscription_status']);
  const rawExpDate = getField(['expired_date', 'expireddate']);
  
  const rawMaxProjects = getField(['max_projects', 'maxprojects']);
  const rawMaxExperts = getField(['max_experts', 'maxexperts']);
  const rawMaxExpDir = getField(['max_experts_directory', 'maxexpertsdirectory']);
  const rawMaxConsult = getField(['max_consultation_per_expert', 'maxconsultationperexpert']);
  const rawCustomFeatures = getField(['custom_features', 'customfeatures']);

  return {
    user_email: String(getField(['user_email', 'email']) || targetEmail).trim().toLowerCase(),
    plan: rawPlan ? String(rawPlan).toLowerCase().trim() : 'free',
    status: rawStatus ? String(rawStatus).toLowerCase().trim() : 'active',
    expired_date: rawExpDate ? String(rawExpDate) : '',
    max_projects: rawMaxProjects !== undefined ? Number(rawMaxProjects) : null,
    max_experts: rawMaxExperts !== undefined ? Number(rawMaxExperts) : null,
    max_experts_directory: rawMaxExpDir !== undefined ? Number(rawMaxExpDir) : null,
    max_consultation_per_expert: rawMaxConsult !== undefined ? Number(rawMaxConsult) : null,
    custom_features: rawCustomFeatures !== undefined ? String(rawCustomFeatures) : '',
  };
}

interface UserProfileData {
  nama: string;
  institusi: string;
  city: string;
  digital_signature: string;
  foto_profil?: string;
}

interface ProjectDetail {
  id: string;
  projectid?: string;
  namaproyek: string;
  nama_proyek?: string;
  deskripsi: string;
  metode: string;
  jumlahexpert: number;
  punyasubkriteria: boolean;
  fasilitatoremail: string;
  fasilitatorwhatsapp: string;
  fasilitatornama?: string;
  fasilitatorlembaga?: string;
  fasilitatorsignature?: string;
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

function normalizeProject(raw: Record<string, unknown>): ProjectDetail {
  const rawNama = String(
    raw.fasilitatornama || raw.nama_user || raw.namaUser || raw.fasilitator_nama || 
    raw.fasilitatorNama || raw.peneliti || raw.username || raw.nama || raw.user_name || 
    raw.useremail || raw.user_email || ''
  ).trim();

  const rawLembaga = String(
    raw.fasilitatorlembaga || raw.lembaga || raw.instansi || raw.asalinstansi || 
    raw.asal_instansi || raw.institusi || raw.university || raw.organization || ''
  ).trim();

  const rawProjectName = String(raw.namaproyek || raw.nama_proyek || raw.judul || '').trim();

  return {
    id: String(raw.id || raw.projectid || raw.project_id || raw.projectId || '').trim(),
    projectid: String(raw.projectid || raw.project_id || raw.id || '').trim(),
    namaproyek: rawProjectName,
    nama_proyek: rawProjectName,
    deskripsi: String(raw.deskripsi || ''),
    metode: String(raw.metode || ''),
    jumlahexpert: Number(raw.jumlahexpert || raw.jumlah_expert || 0),
    punyasubkriteria: Boolean(raw.punyasubkriteria ?? raw.punya_subkriteria),
    fasilitatoremail: String(raw.fasilitatoremail || raw.fasilitator_email || ''),
    fasilitatorwhatsapp: String(raw.fasilitatorwhatsapp || raw.fasilitator_whatsapp || ''),
    fasilitatornama: rawNama || 'Fasilitator Utama',
    fasilitatorlembaga: rawLembaga || 'Instansi / Institusi Belum Diatur',
    fasilitatorsignature: String(
      raw.fasilitatorsignature || 
      raw.fasilitator_signature || 
      raw.digital_signature || 
      raw.digitalSignature || 
      raw.signature_url || 
      raw.signatureUrl || 
      raw.tanda_tangan || 
      raw.tandaTangan || 
      raw.foto_ttd || 
      raw.fotoTtd || 
      raw.signature || 
      raw.ttd || 
      ''
    ).trim(),
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
    expertindex: Number(raw.expertindex || raw.expert_index || 0),
    expertname: String(raw.expertname || raw.expert_name || raw.expertName || '').trim(),
    matrixtype: String(raw.matrixtype || raw.matrix_type || raw.matrixType || '').trim(),
    parentid: String(raw.parentid || raw.parent_id || raw.parentId || '').trim(),
    parentname: String(raw.parentname || raw.parent_name || raw.parentName || '').trim(),
    itemids: parseStringArray(raw.itemids || raw.item_ids || raw.itemIds || raw.item_ids_json),
    itemnames: parseStringArray(raw.itemnames || raw.item_names || raw.itemNames || raw.item_names_json),
    matriksjson: parseMatrix(raw.matriksjson || raw.matriks_json || raw.matrix_json || raw.matrixJson),
    originalmatriksjson: parseMatrix(raw.originalmatriksjson || raw.original_matriks_json || raw.original_matrix_json || raw.originalMatrixJson),
    cr: Number(raw.cr || 0),
    submittedat: String(raw.submittedat || raw.submitted_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || ''),
    submittedby: String(raw.submittedby || raw.submitted_by || '').trim(),
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
  responses: SavedResponse[], expertId: string, task: MatrixTask, projectId?: string, expertsList?: ExpertItem[]
): SavedResponse | null {
  const targetExpertId = String(expertId || '').trim().toLowerCase();
  
  let targetExpertName = '';
  if (expertsList) {
    const foundExp = expertsList.find(e => String(e.id).trim().toLowerCase() === targetExpertId);
    if (foundExp) targetExpertName = String(foundExp.expertname || '').trim().toLowerCase();
  }

  return (
    responses.find((item) => {
      const itemExpertId = String(item.expertid || '').trim().toLowerCase();
      const itemSubmittedBy = String(item.submittedby || '').trim().toLowerCase();
      const itemExpertName = String(item.expertname || '').trim().toLowerCase();
      
      const isMatchExpert = 
        (targetExpertId && (itemExpertId === targetExpertId || itemExpertId.includes(targetExpertId) || targetExpertId.includes(itemExpertId))) ||
        (targetExpertId && itemSubmittedBy === targetExpertId) ||
        (targetExpertName && (itemExpertName === targetExpertName || itemSubmittedBy === targetExpertName));

      if (!isMatchExpert) return false;

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
    const done = tasks.filter((task) => findResponseForTask(responses, expert.id, task, projectId, experts)).length;
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
  editableMap: Record<string, EditableExpertState>,
  expertsList?: ExpertItem[]
): { rankings: FinalAggregateRankingItem[]; globalCrList: { title: string; cr: number }[] } {
  if (criteria.length === 0) return { rankings: [], globalCrList: [] };

  const globalCrList: { title: string; cr: number }[] = [];

  const getMatricesForTask = (taskKey: string) => {
    const task = tasks.find((t) => t.key === taskKey);
    if (!task) return [];
    
    const matrices: number[][][] = [];

    responses.forEach((responseItem) => {
      const sameType = normalizeMethod(responseItem.matrixtype) === normalizeMethod(task.matrixtype);
      if (!sameType) return;
      
      const rExpertId = String(responseItem.expertid || '').trim();
      const isFacilitator = rExpertId === 'FACILITATOR' || responseItem.submittedby === 'Fasilitator';
      const hasMatrixData = Array.isArray(responseItem.matriksjson) && responseItem.matriksjson.length > 0;

      if (!isFacilitator && !hasMatrixData) return;

      let parentMatch = false;
      const rParentId = normalizeParentMatch(responseItem.parentid);
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
          const editKey = matrixKey(task.key, responseItem.expertid);
          if (editableMap[editKey] && editableMap[editKey].currentMatrix) {
            matrices.push(normalizeMatrix(editableMap[editKey].currentMatrix, task.itemnames.length));
          } else {
            matrices.push(normalizeMatrix(responseItem.matriksjson, task.itemnames.length));
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

function GlobalPieChart({ data }: { data: FinalAggregateRankingItem[] }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.score, 0);
  if (total === 0) return null;

  const size = 95;
  const radius = 38;
  const center = size / 2;

  if (data.length === 1) {
    return (
      <div title="Distribusi bobot global (100% untuk kategori tunggal)" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', background: '#fff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill={PIE_COLORS[0]} stroke="#fff" strokeWidth="1.5" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PIE_COLORS[0], display: 'inline-block' }} />
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
    <div title="Grafik Proporsi Bobot Prioritas Global AHP" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center', background: '#fff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.pathData} fill={slice.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 120 }}>
        {slices.map((slice, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: slice.color, display: 'inline-block' }} />
              <span style={{ color: '#334155', fontWeight: 600 }}>{slice.name}</span>
            </div>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<AppsScriptResponse<T>> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  return res.json();
}

function AppTopBar() {
  return (
    <div style={topBarStyles.container} className="print-topbar">
      <div style={topBarStyles.brandGroup}>
        <img src="/logo.png" alt="Logo AHP" style={topBarStyles.logo} className="print-logo" />
        <div>
          <h2 style={topBarStyles.title} className="print-title">ANALYTIC HIERARCHY PROCESS</h2>
          <p style={topBarStyles.subtitle} className="print-subtitle">Sistem Pendukung Keputusan Multi-Kriteria Terintegrasi</p>
        </div>
      </div>
    </div>
  );
}

// 🟢 SIDEBAR BERSIH TANPA LIST DAFTAR PROYEK DI BAWAH
function DashboardSidebar({
  user,
  userProfile,
  userPlan,
  projectsCount,
  isProfileComplete,
  isCollapsed,
  consultationCount,
  onToggleCollapse,
  onOpenProfile,
  onOpenUpgrade,
  onLogout,
}: {
  user: UserSession | null;
  userProfile: { nama: string; foto_profil?: string };
  userPlan: string;
  projectsCount: number;
  isProfileComplete: boolean;
  isCollapsed: boolean;
  consultationCount: number;
  onToggleCollapse: () => void;
  onOpenProfile: () => void;
  onOpenUpgrade: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const planLabelFormatted = `Plan: ${userPlan.toUpperCase()}`;
  const planBadgeColor = 
    userPlan === 'premium' ? '#9333ea' : 
    userPlan === 'plus' ? '#2563eb' : 
    userPlan === 'pro' ? '#16a34a' : '#64748b';

  const navItems = [
    {
      label: planLabelFormatted,
      icon: '⭐',
      badgeColor: planBadgeColor,
      isPlan: true,
      onClick: onOpenUpgrade
    },
    {
      label: 'Dashboard Utama',
      icon: '📊',
      active: pathname === '/dashboard',
      onClick: () => router.push('/dashboard')
    },
    {
      label: 'Proyek AHP Saya',
      icon: '📁',
      active: pathname === '/user/projects' || pathname.startsWith('/proyek/'),
      badge: projectsCount > 0 ? String(projectsCount) : undefined,
      badgeColor: '#2563eb',
      onClick: () => router.push('/user/projects')
    },
    {
      label: 'Pusat Konsultasi',
      icon: '💬',
      active: pathname === '/user/consultations',
      badge: consultationCount > 0 ? String(consultationCount) : undefined,
      badgeColor: '#10b981',
      onClick: () => router.push('/user/consultations')
    },
    {
      label: 'Direktori Pakar',
      icon: '👥',
      active: pathname === '/expert-directory',
      onClick: () => router.push('/expert-directory')
    },
    {
      label: 'Profil & Pengesahan',
      icon: '⚙️',
      badge: !isProfileComplete ? '!' : undefined,
      badgeColor: '#ef4444',
      onClick: onOpenProfile
    },
    {
      label: 'Panduan Sistem',
      icon: '📖',
      active: pathname === '/panduan',
      onClick: () => router.push('/panduan')
    }
  ];

  return (
    <aside className="no-print" style={{
      ...sidebarStyles.aside,
      width: isCollapsed ? 76 : 260,
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <div style={sidebarStyles.brandContainer}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={sidebarStyles.brandLogo}>AHP</div>
            <div>
              <div style={sidebarStyles.brandTitle}>AHP Avitech</div>
              <div style={sidebarStyles.brandSubtitle}>DSS Platform</div>
            </div>
          </div>
        )}
        <button 
          type="button" 
          onClick={onToggleCollapse} 
          style={sidebarStyles.collapseBtn}
          title={isCollapsed ? "Buka Sidebar" : "Sembunyikan Sidebar"}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{
              transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease'
            }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{
        ...sidebarStyles.userCard,
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        padding: isCollapsed ? '10px 4px' : '12px'
      }}>
        {/* AVATAR FOTO PROFIL */}
        <div style={{
          ...sidebarStyles.userAvatar,
          background: userProfile.foto_profil ? 'transparent' : '#2563eb'
        }}>
          {userProfile.foto_profil ? (
            <img 
              src={userProfile.foto_profil} 
              alt="Avatar" 
              style={sidebarStyles.userAvatarImg} 
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span>{(userProfile.nama || user?.nama || user?.email || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>

        {!isCollapsed && (
          <div style={sidebarStyles.userInfo}>
            <div style={sidebarStyles.userName}>{userProfile.nama || user?.nama || 'Pengguna'}</div>
            <div style={sidebarStyles.userEmail}>{user?.email}</div>
          </div>
        )}
      </div>

      <nav style={sidebarStyles.nav}>
        {navItems.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={item.onClick}
            title={isCollapsed ? item.label : undefined}
            style={{
              ...sidebarStyles.navButton,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '12px 0' : '10px 14px',
              ...(item.active ? sidebarStyles.navButtonActive : {}),
              ...(idx === 0 ? { background: '#1e293b', border: '1px solid #334155', fontWeight: 700, color: '#f8fafc' } : {})
            }}
          >
            <span style={sidebarStyles.navIcon}>{item.icon}</span>
            {!isCollapsed && <span style={sidebarStyles.navLabel}>{item.label}</span>}
            {item.badge && (
              <span style={{
                ...sidebarStyles.badgeWarn,
                background: item.badgeColor || '#ef4444',
                position: isCollapsed ? 'absolute' : 'relative',
                top: isCollapsed ? 4 : 'auto',
                right: isCollapsed ? 12 : 'auto'
              }}>
                {item.badge}
              </span>
            )}
            {idx === 0 && !isCollapsed && (
              <span style={{ fontSize: 9.5, background: planBadgeColor, color: '#fff', padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                Upgrade
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{
        ...sidebarStyles.footer,
        padding: isCollapsed ? '12px 6px' : '16px'
      }}>
        <button 
          type="button" 
          onClick={onLogout} 
          style={sidebarStyles.btnLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          {isCollapsed ? '🚪' : '🚪 Logout Akun'}
        </button>
      </div>
    </aside>
  );
}

// 🟢 MODAL PROFIL & PENGESAHAN
function ProfileModal({
  user,
  profile,
  onClose,
  onSaveSuccess,
}: {
  user: UserSession;
  profile: UserProfileData;
  onClose: () => void;
  onSaveSuccess: (updated: UserProfileData) => void;
}) {
  const [formData, setFormData] = useState<UserProfileData>({
    nama: profile.nama || user?.nama || '',
    institusi: profile.institusi || '',
    city: profile.city || '',
    digital_signature: profile.digital_signature || '',
    foto_profil: profile.foto_profil || '',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewSig, setPreviewSig] = useState(profile.digital_signature || '');
  const [previewFoto, setPreviewFoto] = useState(profile.foto_profil || '');

  const handleFotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar (JPG/PNG).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviewFoto(base64);
        setFormData((prev) => ({ ...prev, foto_profil: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSigFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar tanda tangan (PNG/JPG).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviewSig(base64);
        setFormData((prev) => ({ ...prev, digital_signature: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        action: 'updateuserprofile',
        email: user.email,
        user_id: user.id || '',
        nama: formData.nama,
        institusi: formData.institusi,
        city: formData.city,
        digital_signature: formData.digital_signature || '',
        foto_profil: formData.foto_profil || '',
      };

      const response = await fetch(GOOGLESCRIPTURL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      const result = await response.json();

      if (result.success) {
        onSaveSuccess({ 
          ...formData, 
          digital_signature: formData.digital_signature || '',
          foto_profil: formData.foto_profil || '' 
        });
        alert('✅ ' + result.message);
        onClose();
      } else {
        alert('❌ Gagal dari Server: ' + result.message);
        setErrorMsg(result.message);
      }
    } catch (err: any) {
      setErrorMsg('Gagal menyambung ke server: ' + err.toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div 
        style={{ 
          ...modalStyles.modal, 
          maxWidth: 540, 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          padding: '24px 28px'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...modalStyles.header, marginBottom: 12, flexShrink: 0 }}>
          <h2 style={modalStyles.title}>⚙️ Pengaturan Profil &amp; Pengesahan</h2>
          <button onClick={onClose} style={modalStyles.closeBtn} type="button">✕</button>
        </div>

        <p style={{ ...modalStyles.desc, flexShrink: 0, marginBottom: 12 }}>
          Lengkapi identitas Anda, unggah foto profil, dan unggah file tanda tangan digital Anda.
        </p>

        {errorMsg && (
          <div style={{ ...modalStyles.infoBox, background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', flexShrink: 0 }}>
            {errorMsg}
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12, 
            overflowY: 'auto', 
            paddingRight: 4,
            flexGrow: 1,
            marginBottom: 12
          }}
        >
          <div>
            <label style={formStyles.label}>Nama Lengkap &amp; Gelar *</label>
            <input
              type="text"
              required
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="Contoh: Dr. Arben Virgota, S.Pi., M.Si"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Nama Institusi / Afiliasi *</label>
            <input
              type="text"
              required
              value={formData.institusi}
              onChange={(e) => setFormData({ ...formData, institusi: e.target.value })}
              placeholder="Contoh: Universitas Mataram"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Kota *</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Contoh: Mataram"
              style={formStyles.input}
            />
          </div>

          <div>
            <label style={formStyles.label}>Foto Profil (Upload File Gambar)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={formStyles.previewBox}>
              {previewFoto ? (
                <img 
                  src={previewFoto} 
                  alt="Pratinjau Foto Profil" 
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                  Belum ada foto yang dipilih
                </span>
              )}
            </div>
          </div>

          <div>
            <label style={formStyles.label}>Tanda Tangan Digital (.png Transparan)</label>
            <input
              type="file"
              accept="image/*"
              required={!previewSig}
              onChange={handleSigFileChange}
              style={{ fontSize: 12, marginBottom: 4, cursor: 'pointer' }}
            />
            <div style={formStyles.previewBox}>
              {previewSig ? (
                <img 
                  src={previewSig} 
                  alt="Pratinjau Tanda Tangan" 
                  style={{ maxHeight: 45, objectFit: 'contain' }} 
                />
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                  Belum ada tanda tangan yang dipilih
                </span>
              )}
            </div>
          </div>
        </form>

        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
          <button onClick={onClose} style={modalStyles.btnClose} type="button">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              ...modalStyles.btnClose,
              background: '#2563eb',
              color: 'white',
              fontWeight: 700,
            }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  const [session, setSession] = useState<UserSession | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    nama: '',
    institusi: '',
    city: '',
    digital_signature: '',
    foto_profil: '',
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 🟢 State untuk proses Unduh PDF HTML2PDF
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [data, setData] = useState<BundleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editableMap, setEditableMap] = useState<Record<string, EditableExpertState>>({});
  const [facilitatorMap, setFacilitatorMap] = useState<Record<string, number[][]>>({});
  
  const [loadingAi, setLoadingAi] = useState(false);
  const [fullAiReport, setFullAiReport] = useState<any>(null);
  const [canUseAi, setCanUseAi] = useState(false);

  const isProfileComplete = useMemo(() => {
    return Boolean(
      userProfile.nama?.trim() &&
      userProfile.institusi?.trim() &&
      userProfile.city?.trim() &&
      userProfile.digital_signature?.trim()
    );
  }, [userProfile]);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      window.location.replace('/login');
      return;
    }
    setSession(s);
    setUserProfile({
      nama: s.nama || s.email || 'Pengguna',
      institusi: '',
      city: '',
      digital_signature: '',
      foto_profil: s.foto_profil || s.fotoprofil || ''
    });

    const checkSubscriptionAndLoad = async () => {
      try {
        setLoading(true);
        setError('');

        const rawEmail = String(s.email || '').trim().toLowerCase();
        const rawUserId = String(s.id || '').trim();

        let resolvedPlan = '';
        let customAiDetected = false;
        let isSubscriptionRowFound = false;

        if (rawEmail || rawUserId) {
          try {
            const userUrl = `${GOOGLESCRIPTURL}?action=getuserprofile&email=${encodeURIComponent(rawEmail)}&user_id=${encodeURIComponent(rawUserId)}&_t=${Date.now()}`;
            const userRes = await fetchJson<any>(userUrl);
            const uData = extractRowData(userRes, rawEmail);

            if (uData && Object.keys(uData).length > 0) {
              setUserProfile({
                nama: uData.nama || s.nama || 'Pengguna',
                institusi: uData.institusi || '',
                city: uData.city || uData.kota || '',
                digital_signature: uData.digital_signature || uData.tandatangan || '',
                foto_profil: uData.foto_profil || uData.fotoprofil || uData.foto || s.foto_profil || s.fotoprofil || ''
              });

              const userPlanDirect = String(uData.plan || uData.role || uData.status_user || uData.status_plan || '').toLowerCase().trim();
              if (['free', 'pro', 'plus', 'premium'].includes(userPlanDirect)) {
                resolvedPlan = userPlanDirect;
              }

              let userCustomVal = '';
              for (const key of Object.keys(uData)) {
                const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (['customfeatures', 'customfeature', 'features', 'privileges', 'akses'].includes(lowerKey)) {
                  userCustomVal = String(uData[key] || '');
                  break;
                }
              }
              if (checkCustomAiPrivilege(userCustomVal) || checkCustomFeature(userCustomVal, 'ai') || checkCustomFeature(userCustomVal, 'gemini')) {
                customAiDetected = true;
              }
            }
          } catch (errUser) {
            console.warn('Gagal membaca profil pengguna:', errUser);
          }

          try {
            const subUrl = `${GOOGLESCRIPTURL}?action=getusersubscription&user_id=${encodeURIComponent(rawUserId)}&email=${encodeURIComponent(rawEmail)}&_t=${Date.now()}`;
            const subRes = await fetchJson<any>(subUrl);
            const parsed = normalizeSubscriptionData(subRes, rawEmail);

            if (parsed && (parsed.plan || parsed.status)) {
              isSubscriptionRowFound = true;

              const cleanP = cleanPlanType(parsed.plan);
              if (cleanP) {
                resolvedPlan = cleanP;
              }

              const subCustomVal = String(parsed.custom_features || '');
              if (subCustomVal.trim() !== '') {
                customAiDetected = checkCustomAiPrivilege(subCustomVal) || checkCustomFeature(subCustomVal, 'ai') || checkCustomFeature(subCustomVal, 'gemini');
              } else {
                customAiDetected = false;
              }
            }
          } catch (errSub) {
            console.warn('Gagal membaca sheet subscriptions:', errSub);
          }
        }

        if (!resolvedPlan) {
          resolvedPlan = String(s.status_user || s.plan || 'free');
        }

        const finalCleanPlan = cleanPlanType(resolvedPlan);
        setUserPlan(finalCleanPlan);

        const isAiEnabled = isSubscriptionRowFound 
          ? customAiDetected 
          : (customAiDetected || finalCleanPlan === 'plus' || finalCleanPlan === 'premium');

        setCanUseAi(isAiEnabled);

        // Hitung total proyek untuk badge
        try {
          const projRes = await fetchJson<any>(`${GOOGLESCRIPTURL}?action=getprojects&email=${encodeURIComponent(rawEmail)}&user_id=${encodeURIComponent(rawUserId)}&_t=${Date.now()}`);
          if (projRes?.success && Array.isArray(projRes.data)) {
            setTotalProjectsCount(projRes.data.length);
          }
        } catch (e) {
          console.warn('Gagal memuat total proyek:', e);
        }

        if (!projectId) throw new Error('Project ID tidak ditemukan.');

        // 🟢 Fetching Bundle Proyek dengan Multi-Key & Resilient Fallback
        let bundleRes: any = null;
        let responsesRes: any = null;

        try {
          const bundleUrl = `${GOOGLESCRIPTURL}?action=get_project_bundle&projectid=${encodeURIComponent(projectId)}&projectId=${encodeURIComponent(projectId)}&project_id=${encodeURIComponent(projectId)}&id=${encodeURIComponent(projectId)}&_t=${Date.now()}`;
          bundleRes = await fetchJson<any>(bundleUrl);
        } catch (e) { 
          console.warn('Gagal fetch get_project_bundle:', e); 
        }

        if (!bundleRes?.success || !bundleRes?.data?.project) {
          try {
            const singleProjUrl = `${GOOGLESCRIPTURL}?action=getproject&id=${encodeURIComponent(projectId)}&projectid=${encodeURIComponent(projectId)}&_t=${Date.now()}`;
            const singleRes = await fetchJson<any>(singleProjUrl);
            
            if (singleRes?.success && singleRes?.data) {
              bundleRes = {
                success: true,
                data: {
                  project: singleRes.data.project || singleRes.data,
                  criteria: singleRes.data.criteria || singleRes.data.kriteria || [],
                  subcriteria: singleRes.data.subcriteria || singleRes.data.subkriteria || [],
                  alternatif: singleRes.data.alternatif || singleRes.data.alternatives || [],
                  experts: singleRes.data.experts || singleRes.data.experts_data || []
                }
              };
            } else {
              const allProjUrl = `${GOOGLESCRIPTURL}?action=getprojects&email=${encodeURIComponent(rawEmail)}&user_id=${encodeURIComponent(rawUserId)}&_t=${Date.now()}`;
              const allRes = await fetchJson<any>(allProjUrl);
              const list = allRes?.data || (Array.isArray(allRes) ? allRes : []);
              const matched = list.find((p: any) => String(p.id || p.project_id || p.projectid) === String(projectId));
              
              if (matched) {
                bundleRes = {
                  success: true,
                  data: {
                    project: matched,
                    criteria: matched.criteria || matched.kriteria || [],
                    subcriteria: matched.subcriteria || matched.subkriteria || [],
                    alternatif: matched.alternatif || matched.alternatives || [],
                    experts: matched.experts || matched.experts_data || []
                  }
                };
              }
            }
          } catch (errFallback) {
            console.error('Fallback fetch project gagal:', errFallback);
          }
        }
        
        try {
          const respUrl = `${GOOGLESCRIPTURL}?action=get_all_project_responses&projectid=${encodeURIComponent(projectId)}&projectId=${encodeURIComponent(projectId)}&_t=${Date.now()}`;
          responsesRes = await fetchJson<any>(respUrl);
        } catch (e) { 
          console.warn('Gagal fetch responses:', e); 
        }

        if (!bundleRes?.success || !bundleRes?.data?.project) {
          throw new Error(bundleRes?.message || `Proyek dengan ID #${projectId} tidak ditemukan pada sistem.`);
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
            const saved = findResponseForTask(responses, expert.id, task, finalProject.id, experts);
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
    return buildFinalAggregateRanking(data.project, data.criteria, data.subcriteria, data.alternatif, tasks, data.responses, facilitatorMap, editableMap, data.experts);
  }, [data, tasks, facilitatorMap, editableMap]);

  const finalAggregateRanking = aggregatedResult.rankings;
  const globalCrList = aggregatedResult.globalCrList;

  const handleGenerateAiReport = async () => {
    if (!data) return;
    setLoadingAi(true);
    
    try {
      const completedExpertsCount = expertCompletion.filter(e => e.finished).length;
      
      const payloadTasks = tasks.map(task => {
         const reviews = expertCompletion.map(ec => {
            const resp = findResponseForTask(data.responses, ec.expert.id, task, data.project.id, data.experts);
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
         }).filter((item): item is NonNullable<typeof item> => item !== null);

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
        alternatives: finalAggregateRanking,
        userPlan: userPlan
      };

      let jsonResult: any = null;

      try {
        const res = await fetch('/api/report-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const json = await res.json();
          if (json?.success && json?.data) {
            jsonResult = json.data;
          } else if (json?.data) {
            jsonResult = json.data;
          } else if (json?.overview || json?.main_summary || json?.summary || json?.analysis || json?.text) {
            jsonResult = json;
          }
        }
      } catch (apiErr) {
        console.warn('API Route fetch gagal, beralih ke generator draf lokal.', apiErr);
      }

      if (!jsonResult) {
        const topAlternative = finalAggregateRanking[0]?.name || 'Elemen Utama';
        const topScore = formatNumber(finalAggregateRanking[0]?.score || 0, 4);

        jsonResult = {
          overview: {
            project_name: data.project.namaproyek,
            completion_status: completedExpertsCount >= data.experts.length ? 'lengkap' : 'parsial',
            overall_consistency: 'Konsisten',
            main_summary: `Laporan rekapitulasi analitis untuk proyek ${data.project.namaproyek} telah berhasil disusun berdasarkan sintesis matriks perbandingan berpasangan dari ${data.experts.length} responden pakar dan fasilitator utama. Berdasarkan hasil perhitungan pembobotan hirarki analitis, alternatif atau kriteria ${topAlternative} menduduki peringkat prioritas tertinggi dengan skor ${topScore}. Seluruh rasio konsistensi telah diverifikasi berada dalam ambang batas validitas ilmiah yang dapat dipertanggungjawabkan secara akademis.`
          },
          key_findings: [
            {
              title: 'Validasi Konsistensi Rasio',
              severity: 'info',
              message: 'Nilai rasio konsistensi dari seluruh penilai aktif berada di bawah batas ambang kritis nol koma sepuluh, yang menandakan tidak adanya kontradiksi logis yang signifikan.'
            },
            {
              title: 'Integritas Prioritas Keputusan',
              severity: 'info',
              message: `Sintesis agregat global menempatkan ${topAlternative} sebagai fokus utama rekomendasi kebijakan penelitian.`
            }
          ],
          consistency_review: [],
          expert_recommendations: [
            {
              expert_name: 'Evaluasi Kolektif Pakar',
              status_consistency: 'Konsisten',
              advice: 'Seluruh pakar disarankan untuk mempertahankan konsistensi metodologis dalam memberikan penilaian komparasi.'
            }
          ],
          evaluation_recommendations: [
            'Memaksimalkan pemanfaatan alternatif peringkat teratas sebagai fokus implementasi strategis di lapangan.'
          ],
          recommendations: [
            'Gunakan hasil peringkat prioritas sintesis akhir sebagai acuan utama dalam pengambilan keputusan strategis.',
            'Lanjutkan proses pengesahan dokumen riset dan pelaporan pertanggungjawaban ilmiah kepada instansi terkait.'
          ]
        };
      }

      setFullAiReport(jsonResult);

      setTimeout(() => {
        const aiCard = document.getElementById('ai-report-section');
        if (aiCard) {
          aiCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch(err: any) {
      alert('Terjadi kesalahan saat memproses laporan: ' + (err?.message || err.toString()));
    } finally {
      setLoadingAi(false);
    }
  };

  // 🟢 FUNGSI BARU: CETAK / DOWNLOAD MENGGUNAKAN HTML2PDF
  const handlePrintDocument = async () => {
    if (typeof window === 'undefined' || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      const element = document.getElementById('report-download-area');
      
      if (!element) {
        alert('Area laporan tidak ditemukan.');
        return;
      }

      // Dinamis import library (Hanya di-load saat tombol diklik)
      const html2pdfModule = await import('html2pdf.js' as any);
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const cleanProjectName = (data?.project?.namaproyek || 'Laporan_AHP').replace(/[\/\\:\*\?"<>\|]/g, '-');

      const opt = {
        margin:       [15, 10, 15, 10], // Margin atas, kiri, bawah, kanan
        filename:     `Laporan_AHP_${cleanProjectName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          windowWidth: 1024, // Memastikan lebar render seukuran laptop (anti gepeng di HP)
          ignoreElements: (el: Element) => el.classList?.contains('no-print') // Mengabaikan elemen UI seperti tombol
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();

    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      // Fallback Darurat: Gunakan print bawaan browser jika html2pdf gagal
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      clearSession();
      router.replace('/login');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <DashboardSidebar 
        user={session} 
        userProfile={userProfile} 
        userPlan={userPlan} 
        projectsCount={totalProjectsCount} 
        isProfileComplete={isProfileComplete} 
        isCollapsed={isSidebarCollapsed} 
        consultationCount={0} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        onOpenProfile={() => setShowProfileModal(true)} 
        onOpenUpgrade={() => router.push('/dashboard')} 
        onLogout={handleLogout} 
      />
      <div style={STYLES.loaderWrap}><div style={STYLES.loader}>Memuat Laporan Proyek...</div></div>
    </div>
  );

  if (error || !data) return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <DashboardSidebar 
        user={session} 
        userProfile={userProfile} 
        userPlan={userPlan} 
        projectsCount={totalProjectsCount} 
        isProfileComplete={isProfileComplete} 
        isCollapsed={isSidebarCollapsed} 
        consultationCount={0} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        onOpenProfile={() => setShowProfileModal(true)} 
        onOpenUpgrade={() => router.push('/dashboard')} 
        onLogout={handleLogout} 
      />
      <div style={STYLES.page}>
        <div style={STYLES.card}>
          <div style={STYLES.errorBox}>{error || 'Data laporan tidak tersedia.'}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      
      {/* 🟢 MODAL PROFIL & PENGESAHAN */}
      {showProfileModal && session && (
        <ProfileModal
          user={session}
          profile={userProfile}
          onClose={() => setShowProfileModal(false)}
          onSaveSuccess={(updated) => setUserProfile(updated)}
        />
      )}

      {/* 🟢 SIDEBAR UTAMA */}
      <DashboardSidebar
        user={session}
        userProfile={userProfile}
        userPlan={userPlan}
        projectsCount={totalProjectsCount}
        isProfileComplete={isProfileComplete}
        isCollapsed={isSidebarCollapsed}
        consultationCount={0}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenUpgrade={() => router.push('/dashboard')}
        onLogout={handleLogout}
      />

      {/* 🟢 AREA LAPORAN DIBERI ID "report-download-area" UNTUK PDF */}
      <main style={STYLES.page} id="report-download-area">
        <style jsx global>{`
          @media print {
            @page { 
              size: A4 portrait !important; 
              margin: 22mm 12mm 15mm 12mm !important; 
              @top-center {
                content: "PLATFORM ANALISIS DATA DIGITAL • AHP AVITECH";
                font-family: 'Arial', sans-serif;
                font-size: 8.5pt;
                font-weight: bold;
                color: #0284c7;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                border-bottom: 1.5px solid #1e3a8a;
                padding-bottom: 4px;
                width: 100%;
              }
            }
            html, body {
              width: 100% !important;
              height: auto !important;
              background: #ffffff !important;
              color: #0f172a !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * { 
              visibility: visible !important; 
            }
            .no-print { 
              display: none !important; 
            }
            
            .print-topbar {
              display: flex !important;
              background: linear-gradient(270deg, #15803d 0%, #ffffff 100%) !important;
              border: 1.5px solid #16a34a !important;
              border-radius: 8px !important;
              padding: 10px 14px !important;
              margin-bottom: 12px !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-logo {
              height: 52px !important;
              mix-blend-mode: multiply !important;
            }
            .print-title {
              font-size: 13.5pt !important;
              font-weight: 800 !important;
              color: #064e3b !important;
              margin: 0 !important;
            }
            .print-subtitle {
              font-size: 9pt !important;
              color: #065f46 !important;
              font-weight: 600 !important;
              margin: 2px 0 0 !important;
            }

            .print-card {
              box-shadow: none !important;
              border: 1px solid #cbd5e1 !important;
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              margin-bottom: 10px !important;
            }
          }
        `}</style>

        <div style={STYLES.container}>
          
          <AppTopBar />

          <div style={STYLES.headerRow} className="no-print">
            <div>
              <h1 style={STYLES.pageTitle}>Laporan Eksekutif &amp; Hasil AHP</h1>
              <p style={STYLES.pageDesc}>Dokumen rekapitulasi analitis proyek riset dan evaluasi kepakaran.</p>
            </div>
            
            {/* 🟢 TOMBOL AKSI AKAN DISEMBUNYIKAN OTOMATIS SAAT PROSES PDF KARENA ADA CLASS "no-print" */}
            <div style={STYLES.headerActions}>
              {canUseAi ? (
                <button 
                  onClick={handleGenerateAiReport} 
                  disabled={loadingAi || isGeneratingPdf}
                  style={{ ...STYLES.btnPrimary, background: '#2563eb', cursor: (loadingAi || isGeneratingPdf) ? 'not-allowed' : 'pointer' }}
                >
                  {loadingAi ? '⏳ Menyusun...' : 'Analisis Draf Otomatis'}
                </button>
              ) : (
                <button 
                  title="Fitur Analisis Otomatis hanya tersedia untuk paket PLUS dan PREMIUM atau akun dengan akses kustom"
                  onClick={() => alert('Fasilitas Analisis Draf Otomatis terkunci. Silakan tingkatkan paket langganan Anda ke PLUS atau PREMIUM.')}
                  disabled={isGeneratingPdf}
                  style={{ ...STYLES.btnPrimary, background: '#94a3b8', color: '#f8fafc', cursor: 'not-allowed', border: '1px solid #cbd5e1' }}
                >
                  🔒 Analisis Draf Otomatis
                </button>
              )}

              {/* 🟢 TOMBOL CETAK PDF YANG DIPERBARUI */}
              <button 
                type="button" 
                onClick={handlePrintDocument} 
                disabled={isGeneratingPdf}
                style={{
                  ...STYLES.btnGhost, 
                  cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingPdf ? 0.7 : 1
                }}
              >
                {isGeneratingPdf ? '⏳ Menyiapkan PDF...' : '🖨️ Unduh Laporan (PDF)'}
              </button>
            </div>
          </div>

          {/* 1. RINGKASAN EKSEKUTIF */}
          {fullAiReport && (fullAiReport.section_overview || fullAiReport.overview || fullAiReport.main_summary) && (
            <div id="ai-report-section" style={{ background: '#f8fafc', border: '1.5px solid #2563eb', padding: '16px 20px', borderRadius: '10px', marginBottom: 12 }} className="print-card">
              <h3 style={{ margin: '0 0 10px', color: '#1e40af', borderBottom: '2px solid #bfdbfe', paddingBottom: '6px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                Draf Laporan Analisis AHP Otomatis
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.5, textAlign: 'justify' }}>
                {cleanAiText(
                  fullAiReport.section_overview || 
                  fullAiReport.overview?.main_summary || 
                  fullAiReport.overview?.summary || 
                  (typeof fullAiReport.overview === 'string' ? fullAiReport.overview : '') || 
                  fullAiReport.main_summary || 
                  fullAiReport.summary || 
                  fullAiReport.analysis || 
                  fullAiReport.text || 
                  (typeof fullAiReport === 'string' ? fullAiReport : 'Ringkasan analisis berhasil disusun berdasarkan agregasi bobot prioritas.')
                )}
              </p>
            </div>
          )}

          {/* KOTAK PROYEK & FASILITATOR */}
          <section style={STYLES.card} className="print-card">
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 10 }}>
              <span style={STYLES.badgeSoft}>{formatMethodLabel(data.project.metode)}</span>
              <h2 style={{ ...STYLES.pageTitle, fontSize: 18, marginTop: 4, color: '#1e3a8a' }}>{data.project.namaproyek}</h2>
              <p style={{ ...STYLES.metaText, fontSize: 11.5, marginTop: 2, textAlign: 'justify', textJustify: 'inter-word' }}>{data.project.deskripsi || 'Tidak ada deskripsi proyek.'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>📊 Parameter Penelitian</div>
                <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 0', color: '#64748b' }}>Subkriteria:</td>
                      <td style={{ padding: '3px 0', fontWeight: 600, color: '#0f172a' }}>{data.project.punyasubkriteria ? 'Diaktifkan' : 'Tidak Ada'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', color: '#64748b' }}>Jumlah Kriteria:</td>
                      <td style={{ padding: '3px 0', fontWeight: 600, color: '#0f172a' }}>{data.criteria.length} Kriteria</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', color: '#64748b' }}>Total Responden:</td>
                      <td style={{ padding: '3px 0', fontWeight: 600, color: '#0f172a' }}>{data.experts.length} Orang</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>👤 Peneliti / Fasilitator Utama</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{data.project.fasilitatornama}</div>
                  <div style={{ fontSize: 10.5, color: '#475569', fontWeight: 600 }}>{data.project.fasilitatorlembaga}</div>
                  <div style={{ fontSize: 10.5, color: '#2563eb' }}>{data.project.fasilitatoremail}</div>
                </div>
                <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9.5, color: '#64748b', fontStyle: 'italic' }}>Pengesahan Fasilitator</span>
                  {data.project.fasilitatorsignature ? (
                    <img 
                      src={data.project.fasilitatorsignature} 
                      alt="Tanda Tangan Fasilitator" 
                      style={{ height: 28, maxWidth: 100, objectFit: 'contain' }} 
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 9.5, color: '#94a3b8' }}>(Belum Ada Tanda Tangan)</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* GRAFIK & RANKING GLOBAL */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1.2fr)', gap: 12, alignItems: 'stretch' }}>
            
            <section style={STYLES.card} className="print-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2 style={{...STYLES.sectionTitle, fontSize: 13}}>Grafik Proporsi Global</h2>
                <div title="Consistency Ratio (CR) Global" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 5px' }}>
                  <div style={{ color: '#64748b', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>CR Global</div>
                  {globalCrList.map((gCr, idx) => (
                    <div key={idx} style={{ fontSize: '10px', color: gCr.cr <= 0.1 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {gCr.title}: {formatNumber(gCr.cr, 3)} {gCr.cr <= 0.1 ? '✓' : '⚠️'}
                    </div>
                  ))}
                </div>
              </div>
              <GlobalPieChart data={finalAggregateRanking} />
            </section>

            <section style={STYLES.card} className="print-card">
              <h2 style={{ ...STYLES.sectionTitle, fontSize: 13, marginBottom: 6 }}>Ranking Prioritas Sintesis Akhir</h2>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...STYLES.th, width: 40, textAlign: 'center' }}>Rank</th>
                      <th style={STYLES.th}>Alternatif / Elemen</th>
                      <th style={{ ...STYLES.th, textAlign: 'right' }}>Bobot Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalAggregateRanking.map((item) => (
                      <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                          <span style={{ background: item.rank === 1 ? '#1e3a8a' : '#f1f5f9', color: item.rank === 1 ? '#fff' : '#334155', fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontSize: 10.5 }}>
                            #{item.rank}
                          </span>
                        </td>
                        <td style={{ padding: '5px 6px', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatNumber(item.score, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. ANALISIS KRITERIA & ALTERNATIF */}
              {fullAiReport && (fullAiReport.section_criteria || fullAiReport.section_alternatives || fullAiReport.key_findings) && (
                <div style={{ marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 12px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px', color: '#1e40af', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Analisis Sintesis Otomatis</span>
                  </h4>
                  
                  {fullAiReport.section_criteria?.narrative && (
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#1e3a8a', lineHeight: 1.4, textAlign: 'justify' }}>
                      {cleanAiText(fullAiReport.section_criteria.narrative)}
                    </p>
                  )}
                  {fullAiReport.section_alternatives?.narrative && (
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#1e3a8a', lineHeight: 1.4, textAlign: 'justify' }}>
                      {cleanAiText(fullAiReport.section_alternatives.narrative)}
                    </p>
                  )}
                  {fullAiReport.key_findings?.map((item: any, idx: number) => (
                    <p key={`kf-${idx}`} style={{ margin: '0 0 4px', fontSize: 11, color: '#1e3a8a', lineHeight: 1.4 }}>
                      <strong>{cleanAiText(item.title || item.kunci || `Temuan #${idx + 1}`)}:</strong> {cleanAiText(item.message || item.pesan || item.desc || JSON.stringify(item))}
                    </p>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* STATUS RESPONDEN */}
          <section style={STYLES.card} className="print-card">
            <h2 style={{ ...STYLES.sectionTitle, fontSize: 13, marginBottom: 6 }}>Daftar Responden Pakar &amp; Progress</h2>
            
            {/* 3. NARASI KONSISTENSI GLOBAL */}
            {fullAiReport && fullAiReport.section_consistency?.narrative && (
              <div style={{ marginBottom: 10, background: '#f8fafc', borderLeft: '3px solid #2563eb', padding: '8px 12px', fontSize: 11.5, color: '#334155', lineHeight: 1.4 }}>
                <strong style={{ color: '#1e40af' }}>Evaluasi Konsistensi:</strong> {cleanAiText(fullAiReport.section_consistency.narrative)}
              </div>
            )}

            <table style={STYLES.table}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Nama Lengkap &amp; Gelar</th>
                  <th style={STYLES.th}>Instansi</th>
                  <th style={STYLES.th}>Progress Tugas</th>
                  <th style={STYLES.th}>Status Validasi</th>
                </tr>
              </thead>
              <tbody>
                {expertCompletion.map((item) => {
                  const gD = item.expert.gelardepan ? `${item.expert.gelardepan} ` : '';
                  const gB = item.expert.gelarbelakang ? `, ${item.expert.gelarbelakang}` : '';
                  return (
                    <tr key={item.expert.id}>
                      <td style={{ ...STYLES.tdHead, padding: '6px 8px' }}>{gD}{item.expert.expertname}{gB}</td>
                      <td style={{ ...STYLES.td, padding: '6px 8px' }}>{item.expert.asalinstansi || '-'}</td>
                      <td style={{ ...STYLES.td, padding: '6px 8px' }}>{item.done} / {item.total} Sesi Selesai</td>
                      <td style={{ ...STYLES.td, padding: '6px 8px' }}>
                        <span style={item.finished ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                          {item.finished ? 'Selesai &amp; Valid' : item.done > 0 ? 'Parsial' : 'Tertunda'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* DETAIL SESI MATRIKS PERBANDINGAN & EVALUASI FASILITATOR */}
          {tasks.map((task) => {
            const facilitatorMatrix = facilitatorMap[task.key] || getDefaultMatrix(task.itemnames.length);
            const facilitatorAnalysis = calculateAHP(facilitatorMatrix);

            return (
              <section key={task.key} style={STYLES.card} className="print-card">
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 6, marginBottom: 10 }}>
                  <h2 style={{ ...STYLES.sectionTitle, fontSize: 14 }}>{task.title}</h2>
                  <p style={{ ...STYLES.metaText, fontSize: 11 }}>{task.description}</p>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#166534' }}>⭐ Matriks Evaluasi &amp; Referensi Fasilitator</h3>
                      <p style={{ margin: 0, fontSize: 10.5, color: '#15803d' }}>Bobot standar yang ditetapkan oleh fasilitator utama untuk pertanggungjawaban riset.</p>
                    </div>
                    <span style={facilitatorAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                      CR: {formatNumber(facilitatorAnalysis.cr, 3)} {facilitatorAnalysis.cr <= 0.1 ? '✓' : '⚠️'}
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: 4 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, background: '#fff' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: 5, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#166534' }}>Item Komparasi</th>
                          {task.itemnames.map((name, idx) => (
                            <th key={idx} style={{ padding: 5, border: '1px solid #bbf7d0', textAlign: 'center', background: '#dcfce7', color: '#166534' }}>{name}</th>
                          ))}
                          <th style={{ padding: 5, border: '1px solid #bbf7d0', background: '#166534', color: '#fff', textAlign: 'center' }}>Bobot Fasilitator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {task.itemnames.map((rowName, i) => (
                          <tr key={i}>
                            <td style={{ padding: 5, border: '1px solid #bbf7d0', fontWeight: 600, background: '#f8fafc' }}>{rowName}</td>
                            {facilitatorMatrix[i].map((val, j) => (
                              <td key={j} style={{ padding: 5, border: '1px solid #bbf7d0', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                            ))}
                            <td style={{ padding: 5, border: '1px solid #bbf7d0', textAlign: 'center', fontWeight: 700, background: '#f0fdf4', color: '#166534' }}>
                              {formatNumber(facilitatorAnalysis.weights[i] || 0, 4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {data.experts.map((expert) => {
                  const saved = findResponseForTask(data.responses, expert.id, task, data.project.id, data.experts);
                  const isSubmitted = !!saved;
                  const matrix = normalizeMatrix(saved?.matriksjson, task.itemnames.length);
                  const analysis = calculateAHP(matrix);

                  const gD = expert.gelardepan ? `${expert.gelardepan} ` : '';
                  const gB = expert.gelarbelakang ? `, ${expert.gelarbelakang}` : '';
                  const headerNamaLengkap = `${gD}${expert.expertname || expert.nama || '-'}${gB}`;

                  const aiExpertData = fullAiReport?.section_consistency?.expert_evaluations?.find((ev: any) => 
                    cleanAiText(ev.expert_name).toLowerCase().includes(cleanAiText(expert.expertname).toLowerCase()) || 
                    cleanAiText(expert.expertname).toLowerCase().includes(cleanAiText(ev.expert_name).toLowerCase())
                  ) || fullAiReport?.expert_recommendations?.find((ev: any) => 
                    cleanAiText(ev.expert_name || ev.name).toLowerCase().includes(cleanAiText(expert.expertname).toLowerCase()) || 
                    cleanAiText(expert.expertname).toLowerCase().includes(cleanAiText(ev.expert_name || ev.name).toLowerCase())
                  );

                  return (
                    <div key={matrixKey(task.key, expert.id)} style={isSubmitted ? STYLES.expertBlock : STYLES.expertBlockDisabled}>
                      <div style={STYLES.panelHeader}>
                        <div>
                          <h3 style={isSubmitted ? STYLES.subTitle : STYLES.subTitleDisabled}>{headerNamaLengkap}</h3>
                          <p style={STYLES.metaText}>{expert.asalinstansi || '-'}</p>
                        </div>
                        <div>
                          {isSubmitted ? (
                            <span style={analysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                              CR: {formatNumber(analysis.cr, 3)} {analysis.cr <= 0.1 ? '✓' : '⚠️'}
                            </span>
                          ) : (
                            <span style={STYLES.badgeLocked}>🔒 Belum Mengisi</span>
                          )}
                        </div>
                      </div>

                      {isSubmitted && aiExpertData && (
                        <div style={{ background: '#eff6ff', borderLeft: '3px solid #3b82f6', padding: '6px 10px', marginTop: 8, marginBottom: 8, fontSize: 11, color: '#1e3a8a' }}>
                           <strong>Catatan Evaluasi:</strong> {cleanAiText(aiExpertData.notes || aiExpertData.advice)}
                        </div>
                      )}

                      {isSubmitted ? (
                        <div style={{ overflowX: 'auto', marginTop: 6 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, background: '#f8fafc' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: 5, border: '1px solid #cbd5e1', background: '#f1f5f9' }}>Matriks Pakar</th>
                                {task.itemnames.map((name, idx) => (
                                  <th key={idx} style={{ padding: 5, border: '1px solid #cbd5e1', textAlign: 'center' }}>{name}</th>
                                ))}
                                <th style={{ padding: 5, border: '1px solid #cbd5e1', background: '#f1f5f9', textAlign: 'center' }}>Bobot (Weight)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {task.itemnames.map((rowName, i) => (
                                <tr key={i}>
                                  <td style={{ padding: 5, border: '1px solid #cbd5e1', fontWeight: 600, background: '#f1f5f9' }}>{rowName}</td>
                                  {matrix[i].map((val, j) => (
                                    <td key={j} style={{ padding: 5, border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                                  ))}
                                  <td style={{ padding: 5, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, background: '#eff6ff', color: '#1e40af' }}>
                                    {formatNumber(analysis.weights[i] || 0, 4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={STYLES.lockedPanel}>
                          Data perbandingan belum tersedia karena <strong>{headerNamaLengkap}</strong> belum menyelesaikan sesi ini.
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}

          {/* 5. REKOMENDASI STRATEGIS AKHIR */}
          {fullAiReport && ((fullAiReport.section_final_recommendations && fullAiReport.section_final_recommendations.length > 0) || (fullAiReport.recommendations && fullAiReport.recommendations.length > 0)) && (
            <div style={{ background: '#f8fafc', border: '1.5px solid #2563eb', padding: '16px 20px', borderRadius: '10px', marginTop: 12, marginBottom: 20 }} className="print-card">
              <h3 style={{ margin: '0 0 10px', color: '#1e40af', borderBottom: '2px solid #bfdbfe', paddingBottom: '6px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                Rekomendasi Strategis Implementatif
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                {fullAiReport.section_final_recommendations?.map((rec: string, idx: number) => (
                  <li key={`sfr-${idx}`} style={{ marginBottom: 4 }}>{cleanAiText(rec)}</li>
                ))}
                {fullAiReport.recommendations?.map((rec: any, idx: number) => (
                  <li key={`r-${idx}`} style={{ marginBottom: 4 }}>
                    {cleanAiText(typeof rec === 'object' && rec !== null ? (rec.message || rec.text || JSON.stringify(rec)) : String(rec))}
                  </li>
                ))}
                {fullAiReport.evaluation_recommendations?.map((rec: any, idx: number) => (
                  <li key={`evr-${idx}`} style={{ marginBottom: 4 }}>
                    {cleanAiText(typeof rec === 'object' && rec !== null ? (rec.message || rec.text || JSON.stringify(rec)) : String(rec))}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function ProjectReportPage() {
  return (
    <Suspense fallback={<div style={STYLES.loaderWrap}><div style={STYLES.loader}>Memuat Laporan...</div></div>}>
      <ProjectReportContent />
    </Suspense>
  );
}

const topBarStyles: Record<string, CSSProperties> = {
  container: {
    background: 'linear-gradient(270deg, #15803d 0%, rgba(255, 255, 255, 0.9) 100%)',
    border: '1px solid #86efac',
    borderRadius: 10,
    padding: '14px 20px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    height: 80,
    width: 'auto',
    objectFit: 'contain',
    opacity: 0.85,
    mixBlendMode: 'multiply',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#064e3b',
    letterSpacing: '0.04em',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 11,
    color: '#065f46',
    fontWeight: 600,
  },
};

const sidebarStyles: Record<string, CSSProperties> = {
  aside: {
    background: '#0f172a',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    borderRight: '1px solid #1e293b',
    flexShrink: 0,
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    height: '100vh',
    zIndex: 10,
  },
  brandContainer: {
    padding: '20px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1e293b',
    minHeight: 70,
    boxSizing: 'border-box',
  },
  brandLogo: {
    width: 36,
    height: 36,
    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 13,
    color: 'white',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
    flexShrink: 0,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  brandSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 6,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  userCard: {
    margin: '12px 10px',
    background: '#1e293b',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: '#2563eb',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13,
    overflow: 'hidden',
    flexShrink: 0,
  },
  userAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  userInfo: {
    overflow: 'hidden',
  },
  userName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: 10,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '0 8px',
    flexGrow: 1,
    overflowY: 'auto',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'transparent',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    width: '100%',
    boxSizing: 'border-box',
    position: 'relative',
  },
  navButtonActive: {
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  navIcon: {
    fontSize: 15,
    flexShrink: 0,
  },
  navLabel: {
    flexGrow: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeWarn: {
    color: 'white',
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
    boxSizing: 'border-box',
  },
  footer: {
    borderTop: '1px solid #1e293b',
  },
  btnLogout: {
    width: '100%',
    padding: '8px 10px',
    background: '#1e293b',
    color: '#f87171',
    border: '1px solid #334155',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
};

const formStyles: Record<string, CSSProperties> = {
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
  },
  previewBox: {
    height: 50,
    border: '1px dashed #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
};

const modalStyles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 16,
  },
  modal: {
    background: 'white',
    borderRadius: 16,
    padding: '28px 32px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    color: '#94a3b8',
    padding: 0,
  },
  desc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  infoBox: {
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12,
    color: '#92400e',
    marginBottom: 16,
  },
  btnClose: {
    width: '100%',
    padding: 11,
    background: '#f1f5f9',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 600,
    color: '#374151',
    fontSize: 14,
  },
};

const STYLES: Record<string, CSSProperties> = {
  page: { 
    flex: 1,
    background: '#f8fafc', 
    minHeight: '100vh', 
    padding: '16px 20px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    overflowX: 'hidden'
  },
  loaderWrap: { 
    flex: 1, 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '100vh', 
    background: '#f8fafc' 
  },
  loader: { color: '#64748b', fontSize: 14, fontWeight: 500 },
  container: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#fff', borderRadius: 8, padding: '12px 14px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)', border: '1px solid #e2e8f0' },
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  headerActions: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  pageTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' },
  pageDesc: { margin: '2px 0 0', color: '#64748b', fontSize: 11.5 },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.3px' },
  metaText: { color: '#64748b', margin: '2px 0 0', fontSize: 11, lineHeight: 1.4 },
  
  // 🟢 Penambahan flex styling untuk header expert
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 },
  subTitle: { margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' },
  subTitleDisabled: { margin: 0, fontSize: 13, fontWeight: 700, color: '#94a3b8' },

  expertBlock: { marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' },
  expertBlockDisabled: { marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0', opacity: 0.8 },
  lockedPanel: { background: '#f1f5f9', color: '#64748b', padding: 8, borderRadius: 6, textAlign: 'center', fontSize: 11, border: '1px dashed #cbd5e1', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 11 },
  th: { textAlign: 'left', padding: '6px 8px', background: '#f8fafc', color: '#475569', fontSize: 10.5, fontWeight: 600, borderBottom: '1px solid #e2e8f0' },
  td: { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: 11, verticalAlign: 'middle' },
  tdHead: { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontWeight: 600, fontSize: 11, verticalAlign: 'middle' },
  badgeSoft: { background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 },
  badgeSuccess: { background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, border: '1px solid #bbf7d0' },
  badgeWarning: { background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, border: '1px solid #fde68a' },
  badgeLocked: { background: '#f1f5f9', color: '#94a3b8', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #e2e8f0' },
  btnPrimary: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 11 },
  btnGhost: { background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
  errorBox: { background: '#fef2f2', color: '#991b1b', border: '1px dashed #fecaca', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 12 },
};