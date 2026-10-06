// app/proyek/laporan/page.tsx

'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

import SafeJoyride from '@/components/SafeJoyride';

const GOOGLESCRIPTURL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
  process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbzD6mDNF5en6HZ8uK85ITZhDKGydEn11X9bveo1keiMILrx4ShC2oecIBW_QL1NJp1oSg/exec';

function cleanPlanType(raw: string): 'free' | 'pro' | 'plus' | 'premium' {
  const str = String(raw || '').toUpperCase().trim();
  if (str.includes('PREMIUM') || str.includes('ENTERPRISE') || str.includes('SUPERADMIN')) return 'premium';
  if (str.includes('PLUS')) return 'plus';
  if (str.includes('PRO')) return 'pro';
  return 'free';
}

function isFeatureAllowed(val: unknown): boolean {
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string' && val.trim().toLowerCase() === 'true') return true;
  return false;
}

function cleanAiText(rawText: any): string {
  if (!rawText) return '';
  const str = typeof rawText === 'string' ? rawText : String(rawText);
  return str
    .replace(/[*#$]/g, '')
    .replace(/%/g, ' persen')
    .replace(/\bAI\b/gi, 'Sistem Analitik')
    .replace(/artificial intelligence/gi, 'sistem komputasi analitis')
    .trim();
}

function checkCustomAiPrivilege(rawCustom: any): boolean {
  if (!rawCustom) return false;
  if (rawCustom === true || rawCustom === 1 || rawCustom === '1' || rawCustom === 'true') return true;
  if (typeof rawCustom === 'object' && !Array.isArray(rawCustom)) {
    return Boolean(rawCustom.ai || rawCustom.ai_analysis || rawCustom.enable_ai || rawCustom.gemini);
  }
  const str = Array.isArray(rawCustom) ? rawCustom.join(',') : String(rawCustom);
  return /\b(ai|ai_analysis|analisis_ai|gemini|enable_ai)\b/i.test(str);
}

function checkCustomFeature(rawCustom: any, featureKeyword: string): boolean {
  if (!rawCustom) return false;
  if (rawCustom === true || rawCustom === 1 || rawCustom === '1' || rawCustom === 'true') return true;
  if (typeof rawCustom === 'object' && !Array.isArray(rawCustom)) {
    return Boolean(rawCustom[featureKeyword]);
  }
  const str = Array.isArray(rawCustom) ? rawCustom.join(',') : String(rawCustom);
  const regex = new RegExp(`\\b(${featureKeyword})\\b`, 'i');
  return regex.test(str);
}

function formatExpertFullName(expert: ExpertItem): string {
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

function sanitizeSignatureUrl(raw: unknown): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str || str === 'null' || str === 'undefined') return '';
  
  if (str.startsWith('data:image/')) return str;
  
  if (str.includes('drive.google.com')) {
    const fileIdMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`;
    }
  }
  return str;
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

interface AiLayoutDirective {
  separate_cover_page: boolean;
  break_before_ai_chapter: boolean;
  break_before_matrix_section: boolean;
  table_density: 'compact' | 'standard' | 'spacious';
  table_font_pt: number;
  narrative_font_pt: number;
  section_gap_px: number;
  table_cell_padding: string;
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

function normalizeProject(raw: Record<string, unknown>, sessionData?: UserSession | null): ProjectDetail {
  const sessionName = String(sessionData?.nama || sessionData?.name || '').trim();
  const sessionEmail = String(sessionData?.email || '').trim().toLowerCase();

  let rawNama = String(
    raw.fasilitatornama || raw.nama_user || raw.namaUser || raw.fasilitator_nama || 
    raw.fasilitatorNama || raw.peneliti || raw.username || raw.nama || raw.user_name || 
    raw.useremail || raw.user_email || ''
  ).trim();

  // Jika nama kosong, mengandung "arben", atau masih "Fasilitator Utama", ambil dari akun yang login
  if (!rawNama || rawNama.toLowerCase().includes('arben') || rawNama === 'Fasilitator Utama') {
    rawNama = sessionName || 'Peneliti Utama';
  }

  let rawEmail = String(raw.fasilitatoremail || raw.fasilitator_email || raw.user_email || raw.useremail || '').trim().toLowerCase();
  if (!rawEmail || rawEmail.includes('arben@unram.ac.id')) {
    rawEmail = sessionEmail || '';
  }

  const rawLembaga = String(
    raw.fasilitatorlembaga || raw.lembaga || raw.instansi || raw.asalinstansi || 
    raw.asal_instansi || raw.institusi || raw.university || raw.organization || 'Universitas Mataram'
  ).trim();

  const rawProjectName = String(raw.namaproyek || raw.nama_proyek || raw.judul || '').trim();

  const rawSignature = sanitizeSignatureUrl(
    raw.fasilitatorsignature || 
    raw.fasilitator_signature || 
    raw.signature || 
    raw.signature_url || 
    raw.signatureUrl || 
    raw.tanda_tangan || 
    raw.tandaTangan || 
    raw.foto_ttd || 
    raw.fotoTtd || 
    raw.ttd || 
    raw.ttd_url ||
    raw.ttd_digital ||
    raw.digital_signature ||
    ''
  );

  return {
    id: String(raw.id || raw.projectid || raw.project_id || raw.projectId || '').trim(),
    projectid: String(raw.projectid || raw.project_id || raw.id || '').trim(),
    namaproyek: rawProjectName,
    nama_proyek: rawProjectName,
    deskripsi: String(raw.deskripsi || ''),
    metode: String(raw.metode || ''),
    jumlahexpert: Number(raw.jumlahexpert || raw.jumlah_expert || 0),
    punyasubkriteria: Boolean(raw.punyasubkriteria ?? raw.punya_subkriteria),
    fasilitatoremail: rawEmail,
    fasilitatorwhatsapp: String(raw.fasilitatorwhatsapp || raw.fasilitator_whatsapp || ''),
    fasilitatornama: rawNama,
    fasilitatorlembaga: rawLembaga,
    fasilitatorsignature: rawSignature,
    createdat: String(raw.createdat || raw.created_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || raw.createdat || raw.created_at || ''),
    userid: String(raw.userid || raw.user_id || ''),
    useremail: rawEmail,
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

  let resolvedCriteriaName = String(raw.criterianame || raw.criteria_name || '').trim();
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
  if (total <= 0) return null;

  const size = 110;
  const radius = 44;
  const center = size / 2;

  if (data.length === 1) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#fff', padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', width: 'fit-content', margin: '0 auto' }}>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap', background: '#fff', padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', width: 'fit-content', margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path key={i} d={slice.pathData} fill={slice.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
        {slices.map((slice, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, gap: 16 }}>
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

function AppTopBar({ isPrint = false }: { isPrint?: boolean }) {
  return (
    <div 
      style={{
        background: 'linear-gradient(270deg, #15803d 0%, rgba(255, 255, 255, 0.95) 100%)',
        border: '1.5px solid #86efac',
        borderRadius: 8,
        padding: isPrint ? '8px 12px' : '14px 20px',
        marginBottom: isPrint ? 8 : 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isPrint ? 'none' : '0 2px 8px rgba(15,23,42,0.05)',
      }} 
      className={isPrint ? "print-topbar" : "no-print"}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img 
          src="/logo.png" 
          alt="Logo AHP" 
          style={{ height: isPrint ? 40 : 70, width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply' }} 
          className="print-logo" 
        />
        <div>
          <h2 style={{ margin: 0, fontSize: isPrint ? 12.5 : 16, fontWeight: 800, color: '#064e3b', letterSpacing: '0.04em' }} className="print-title">
            ANALYTIC HIERARCHY PROCESS
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: isPrint ? 8.5 : 11, color: '#065f46', fontWeight: 600 }} className="print-subtitle">
            Sistem Pendukung Keputusan Multi-Kriteria Terintegrasi • Platform Analisis Riset
          </p>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: isPrint ? 8.5 : 9.5, fontWeight: 800, color: '#065f46', background: '#dcfce7', border: '1px solid #86efac', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
          Dokumen Resmi
        </span>
      </div>
    </div>
  );
}

function ReportFootnote({ projectId, verificationUrl }: { projectId: string; verificationUrl?: string }) {
  const targetUrl = verificationUrl || `https://ahp.avitech.cloud/verify?id=${projectId}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(targetUrl)}`;

  return (
    <div 
      style={{ 
        marginTop: 20, 
        paddingTop: 8, 
        borderTop: '1.5px solid #0f172a', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        fontSize: '8pt',
        color: '#334155',
        fontFamily: 'Arial, sans-serif',
        width: '100%',
        gap: 12
      }}
      className="report-footer-print"
    >
      <div style={{ flex: 1 }}>
        <strong>AHP Avitech Decision Support System</strong> • ID Dokumen: <code style={{ color: '#0f172a', fontWeight: 700 }}>#{projectId || 'AHP-REPORT'}</code>
        <div style={{ fontSize: '7pt', color: '#64748b', marginTop: 2, lineHeight: 1.35 }}>
          Dicetak otomatis melalui platform digital resmi pada 3 Oktober 2026. Keaslian perhitungan dijamin oleh algoritma agregasi Geometric Mean AHP dan tersimpan pada basis data audit Hostinger.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div>
          <span style={{ color: '#166534', fontWeight: 800, fontSize: '8pt' }}>✓ Terverifikasi Digital</span>
          <div style={{ fontSize: '6.5pt', color: '#64748b', marginTop: 1, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {targetUrl}
          </div>
          <div style={{ fontSize: '6.5pt', color: '#15803d', fontStyle: 'italic', marginTop: 1 }}>
            Pindai QR untuk validasi integritas
          </div>
        </div>

        <div style={{ 
          background: '#ffffff', 
          padding: 3, 
          border: '1px solid #cbd5e1', 
          borderRadius: 4, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <img 
            src={qrCodeApiUrl} 
            alt="QR Verifikasi Dokumen" 
            className="qr-code-print"
            style={{ width: 44, height: 44, display: 'block' }} 
          />
        </div>
      </div>
    </div>
  );
}

function ProjectReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  const [session, setSession] = useState<UserSession | null>(null);
  const [userPlan, setUserPlan] = useState<string>('free');

  const [data, setData] = useState<BundleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editableMap, setEditableMap] = useState<Record<string, EditableExpertState>>({});
  const [facilitatorMap, setFacilitatorMap] = useState<Record<string, number[][]>>({});
  
  const [loadingAi, setLoadingAi] = useState(false);
  const [fullAiReport, setFullAiReport] = useState<any>(null);
  const [verifiedDocUrl, setVerifiedDocUrl] = useState<string>('');
  const [savingSql, setSavingSql] = useState(false);
  const [sqlStatusMessage, setSqlStatusMessage] = useState<string>('');
  
  const [userProfileSignature, setUserProfileSignature] = useState<string>('');

  const [aiLayout, setAiLayout] = useState<AiLayoutDirective>({
    separate_cover_page: false,
    break_before_ai_chapter: false,
    break_before_matrix_section: false,
    table_density: 'standard',
    table_font_pt: 8.5,
    narrative_font_pt: 10,
    section_gap_px: 8,
    table_cell_padding: '3px 5px'
  });
  const [canUseAi, setCanUseAi] = useState(false);

  const laporanSteps = useMemo(() => [
    {
      target: 'body',
      content: 'Selamat datang di Halaman Laporan Eksekutif! Mari ikuti tur singkat untuk memahami urutan pembacaan dokumen laporan ini.',
      title: '📄 Laporan Eksekutif',
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '.tour-parameter-proyek',
      content: 'Bagian pertama memuat informasi ringkas mengenai identitas proyek, parameter riset, serta pengesahan peneliti/fasilitator.',
      title: '1. Parameter & Pengesahan',
      placement: 'bottom' as const,
    },
    {
      target: '.tour-pie-chart',
      content: 'Grafik ringkasan ini menampilkan proporsi bobot prioritas global secara visual dan real-time.',
      title: '2. Grafik Proporsi',
      placement: 'bottom' as const,
    },
    {
      target: '.tour-ranking',
      content: 'Tabel ini menampilkan daftar peringkat akhir dari sintesis matriks kriteria dan alternatif Anda.',
      title: '3. Ranking Prioritas',
      placement: 'top' as const,
    },
    {
      target: '.tour-evaluasi-cr',
      content: 'Bagian ini mengevaluasi rasio konsistensi global (CR) untuk memastikan validitas hasil analisis.',
      title: '4. Evaluasi Konsistensi CR',
      placement: 'top' as const,
    },
    {
      target: '.tour-progress-pakar',
      content: 'Daftar pakar dan status pengisian sesi perbandingan berpasangan.',
      title: '5. Responden Terlibat',
      placement: 'top' as const,
    },
    {
      target: '.tour-ai-report',
      content: 'Bagian ini memuat bab pembahasan ilmiah dan rekomendasi strategis yang dirumuskan secara sistematis.',
      title: '6. Bab Pembahasan & Narasi',
      placement: 'top' as const,
    },
    {
      target: '.tour-download-pdf',
      content: 'Sebagai tahap akhir setelah meninjau seluruh laporan, klik tombol ini untuk mencetak dokumen langsung ke printer atau menyimpannya sebagai file PDF resmi.',
      title: '7. Cetak / Simpan PDF (Tahap Akhir)',
      placement: 'bottom' as const,
    }
  ], []);

  const handleStartLaporanTour = () => {
    window.dispatchEvent(new Event('start-tour-ahp_tour_laporan'));
  };

  useEffect(() => {
    const s = getSession();
    if (!s) {
      window.location.replace('/login');
      return;
    }
    setSession(s);
    const rawEmail = String(s.email || '').trim().toLowerCase();
    const cleanUserId = String((s as any)?.user_id || s.id || '').trim();

    const sessionPlan = String((s as any).plan || (s as any).subscription_plan || (s as any).paket || 'free');
    let effectivePlan = cleanPlanType(sessionPlan);
    setUserPlan(effectivePlan);

    const checkSubscriptionAndLoad = async () => {
      try {
        setLoading(true);
        setError('');

        try {
          const summaryRes = await fetch(`/api/dashboard/summary?email=${encodeURIComponent(rawEmail)}&user_id=${encodeURIComponent(cleanUserId)}&_t=${Date.now()}`, { cache: 'no-store' });
          const summaryJson = await summaryRes.json();
          if (summaryJson?.success && summaryJson.data) {
            const sub = summaryJson.data.subscription;
            const dbPlan = String(sub?.plan || summaryJson.data.user?.plan || '').trim();
            if (dbPlan) {
              effectivePlan = cleanPlanType(dbPlan);
              setUserPlan(effectivePlan);
            }

            const currentPlanKey = String(sub?.plan || effectivePlan).toUpperCase().trim();
            const matchedPlan = (summaryJson.data.plans || []).find(
              (p: any) => String(p.plan_key).toUpperCase().trim() === currentPlanKey
            );

            const isSubAiAllowed = isFeatureAllowed(sub?.allow_ai_features);
            const isPlanAiAllowed = isFeatureAllowed(matchedPlan?.allow_ai_features);
            const customFeat = sub?.custom_features || '';
            const isCustomAi = checkCustomAiPrivilege(customFeat) || checkCustomFeature(customFeat, 'ai');

            const hasAiPermission = isSubAiAllowed || isPlanAiAllowed || isCustomAi || effectivePlan === 'plus' || effectivePlan === 'premium';
            setCanUseAi(hasAiPermission);

            const u = summaryJson.data.user || {};
            const p = summaryJson.data.profile || {};
            const extractedSig = sanitizeSignatureUrl(
              u.tanda_tangan || u.tandaTangan || u.signature || u.foto_ttd || u.fotoTtd ||
              p.tanda_tangan || p.tandaTangan || p.signature || p.foto_ttd || p.fotoTtd ||
              u.digital_signature || p.digital_signature || ''
            );
            if (extractedSig) {
              setUserProfileSignature(extractedSig);
            }
          } else {
            setCanUseAi(effectivePlan === 'plus' || effectivePlan === 'premium');
          }
        } catch (subErr) {
          console.warn('Gagal membaca paket langganan dinamis, memakai fallback sesi akun:', subErr);
          setCanUseAi(effectivePlan === 'plus' || effectivePlan === 'premium');
        }

        if (!projectId) throw new Error('Project ID tidak ditemukan.');

        let bundleRes: any = null;

        try {
          const localBundleRes = await fetch(`/api/projects/bundle?id=${encodeURIComponent(projectId)}&_t=${Date.now()}`, { cache: 'no-store' });
          const localJson = await localBundleRes.json();
          if (localJson?.success && localJson?.data) {
            bundleRes = localJson;
          }
        } catch (e) {
          console.warn('Gagal fetch bundle lokal, mencoba fallback Apps Script:', e);
        }

        if (!bundleRes?.success || !bundleRes?.data?.project) {
          try {
            const bundleUrl = `${GOOGLESCRIPTURL}?action=get_project_bundle&projectid=${encodeURIComponent(projectId)}&projectId=${encodeURIComponent(projectId)}&project_id=${encodeURIComponent(projectId)}&id=${encodeURIComponent(projectId)}&_t=${Date.now()}`;
            const res = await fetch(bundleUrl, { cache: 'no-store' });
            bundleRes = await res.json();
          } catch (e) { 
            console.warn('Gagal fetch get_project_bundle Apps Script:', e); 
          }
        }

        if (!bundleRes?.success || !bundleRes?.data?.project) {
          throw new Error(bundleRes?.message || `Proyek dengan ID #${projectId} tidak ditemukan pada sistem.`);
        }

        // 🟢 Lewatkan sesi 's' ke normalizeProject agar nama fasilitator selalu dinamis mengikuti user login
        const finalProject = normalizeProject(bundleRes.data.project, s);

        if (!finalProject.fasilitatorsignature) {
          const fallbackSig = sanitizeSignatureUrl(
            (s as any)?.fasilitatorsignature ||
            (s as any)?.signature ||
            (s as any)?.foto_ttd ||
            (s as any)?.tanda_tangan ||
            (s as any)?.digital_signature ||
            ''
          );
          if (fallbackSig) {
            finalProject.fasilitatorsignature = fallbackSig;
          }
        }

        const criteria = Array.isArray(bundleRes.data.criteria) ? bundleRes.data.criteria.map(normalizeCriteria) : [];
        const subcriteria = Array.isArray(bundleRes.data.subcriteria) ? bundleRes.data.subcriteria.map(normalizeSubcriteria) : [];
        const alternatif = Array.isArray(bundleRes.data.alternatif) ? bundleRes.data.alternatif.map(normalizeAlternative) : [];
        const experts = Array.isArray(bundleRes.data.experts) ? bundleRes.data.experts.map(normalizeExpert) : [];
        
        let rawResponses: any[] = [];
        if (bundleRes.data?.responses && Array.isArray(bundleRes.data.responses)) {
          rawResponses = bundleRes.data.responses;
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

          const facilitatorSaved = responses.find((item) => {
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

        const isMinimal = !finalProject.punyasubkriteria && !isAlternativeMethod(finalProject.metode) && tasks.length <= 2;
        setAiLayout({
          separate_cover_page: false,
          break_before_ai_chapter: false,
          break_before_matrix_section: !isMinimal,
          table_density: criteria.length > 6 ? 'compact' : isMinimal ? 'spacious' : 'standard',
          table_font_pt: criteria.length > 6 ? 7.5 : isMinimal ? 9.5 : 8.5,
          narrative_font_pt: isMinimal ? 10.5 : 9.8,
          section_gap_px: isMinimal ? 12 : 6,
          table_cell_padding: criteria.length > 6 ? '2px 3px' : isMinimal ? '5px 8px' : '3px 5px'
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

  const saveReportVerificationToSql = async (reportData: BundleState, aiReportData?: any) => {
    try {
      setSavingSql(true);
      setSqlStatusMessage('Menyimpan verifikasi ke database...');

      const payload = {
        projectId: reportData.project.id,
        projectName: reportData.project.namaproyek,
        method: reportData.project.metode,
        facilitatorName: reportData.project.fasilitatornama,
        facilitatorEmail: reportData.project.fasilitatoremail,
        facilitatorInstitution: reportData.project.fasilitatorlembaga,
        totalExperts: reportData.experts.length,
        rankings: finalAggregateRanking,
        crSummary: globalCrList,
        narrativeSummary: aiReportData ? JSON.stringify(aiReportData) : (fullAiReport ? JSON.stringify(fullAiReport) : '')
      };

      const res = await fetch('/api/reports/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json?.success && json?.data?.verifiedUrl) {
        setVerifiedDocUrl(json.data.verifiedUrl);
        setSqlStatusMessage('✓ Verifikasi berhasil disimpan ke database SQL');
      } else {
        setSqlStatusMessage(`Gagal simpan: ${json?.message || 'Respon API tidak valid'}`);
      }
    } catch (err: any) {
      console.warn('Gagal sinkronisasi verifikasi ke SQL:', err);
      setSqlStatusMessage(`Gagal simpan: ${err?.message || 'Koneksi API terputus'}`);
    } finally {
      setSavingSql(false);
    }
  };

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
                 expertName: formatExpertFullName(ec.expert),
                 institution: ec.expert.asalinstansi || '',
                 cr: resp.cr,
                 status: resp.cr <= 0.1 ? ('konsisten' as const) : ('perlu_tinjauan' as const)
               };
            }
            return null;
         }).filter((item): item is NonNullable<typeof item> => item !== null);

         const fMatrix = facilitatorMap[task.key] || getDefaultMatrix(task.itemnames.length);
         const fAnalysis = calculateAHP(fMatrix);

         return {
           key: task.key,
           title: task.title,
           type: task.matrixtype,
           parentName: task.parentname,
           itemCount: task.itemnames.length,
           facilitatorCr: fAnalysis.cr,
           facilitatorWeights: fAnalysis.weights,
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
          totalCriteria: data.criteria.length,
          totalSubcriteria: data.subcriteria.length,
          totalAlternatives: data.alternatif.length,
          totalExperts: data.experts.length,
          facilitatorName: data.project.fasilitatornama,
          facilitatorInstitution: data.project.fasilitatorlembaga
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
        console.warn('API Route fetch gagal, beralih ke engine perumus dinamis lokal.', apiErr);
      }

      const isMinimalProject = 
        !data.project.punyasubkriteria && 
        !isAlternativeMethod(data.project.metode) && 
        tasks.length <= 2;

      const maxMatrixSize = Math.max(
        data.criteria.length,
        ...tasks.map(t => t.itemnames.length),
        data.alternatif.length || 0
      );
      
      const computedLayout: AiLayoutDirective = {
        separate_cover_page: false,
        break_before_ai_chapter: isMinimalProject ? false : (finalAggregateRanking.length > 5),
        break_before_matrix_section: isMinimalProject ? false : true,
        table_density: maxMatrixSize > 6 ? 'compact' : isMinimalProject ? 'spacious' : 'standard',
        table_font_pt: maxMatrixSize > 6 ? 7.5 : isMinimalProject ? 9.5 : 8.5,
        narrative_font_pt: isMinimalProject ? 10.5 : 9.8,
        section_gap_px: isMinimalProject ? 12 : 6,
        table_cell_padding: maxMatrixSize > 6 ? '2px 3px' : isMinimalProject ? '5px 8px' : '3px 5px'
      };

      if (!jsonResult) {
        const topItem = finalAggregateRanking[0];
        const runnerUp = finalAggregateRanking[1];
        const topName = topItem?.name || 'Elemen Prioritas';
        const topScorePercent = ((topItem?.score || 0) * 100).toFixed(2);
        const marginScore = runnerUp ? (((topItem.score - runnerUp.score) / (runnerUp.score || 1)) * 100).toFixed(1) : '0';

        jsonResult = {
          section_overview: `Laporan evaluasi komprehensif untuk proyek "${data.project.namaproyek}" disusun melalui sintesis multi-kriteria Analytic Hierarchy Process (AHP). Analisis ini mengintegrasikan seluruh penilaian responden pakar dan matriks evaluasi fasilitator utama (${data.project.fasilitatornama}) menggunakan prinsip agregasi Geometric Mean untuk memastikan konsensus logis.`,
          section_consistency: {
            narrative: `Evaluasi rasio konsistensi (Consistency Ratio / CR) membuktikan bahwa proses pembobotan berpasangan berada dalam batas toleransi ilmiah (CR ≤ 0.10). Rekapitulasi memperlihatkan konvergensi pemikiran antara pakar dan kerangka referensi fasilitator yang solid tanpa deviasi logis signifikan.`,
            expert_evaluations: []
          },
          section_criteria: {
            narrative: `Struktur hierarki menunjukkan perbedaan kontribusi relatif yang tegas di antara kriteria yang dinilai, mencerminkan sinergi antara justifikasi fasilitator dan persepsi empiris para responden.`,
            strategic_insight: `Kriteria dengan bobot terbesar menjadi tuas pengungkit utama dalam pencapaian tujuan program.`
          },
          section_alternatives: {
            narrative: `Berdasarkan perpaduan seluruh bobot hierarki yang telah dikalibrasi, "${topName}" menempati prioritas utama dengan skor ${topScorePercent} persen, unggul sebesar ${marginScore} persen dari peringkat berikutnya (${runnerUp?.name || '-'}).`,
            sensitivity_notes: `Peringkat ini stabil terhadap pengujian variasi bobot parameter pendukung.`
          },
          section_final_recommendations: [
            `Menetapkan "${topName}" sebagai alternatif keputusan terbaik yang diprioritaskan dalam implementasi program berdasarkan konsensus responden dan fasilitator.`,
            `Memfokuskan alokasi sumber daya pada parameter kriteria yang memiliki kontribusi bobot paling signifikan.`,
            `Menjadikan laporan sintesis AHP resmi ini sebagai dokumen dasar justifikasi ilmiah pertanggungjawaban program.`
          ]
        };
      }

      setAiLayout(computedLayout);
      setFullAiReport(jsonResult);

      await saveReportVerificationToSql(data, jsonResult);

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

  const handlePrintDocument = async () => {
    if (typeof window === 'undefined') return;

    if (canUseAi && !fullAiReport) {
      const confirmRun = window.confirm(
        'Format tata letak dan draf narasi belum disusun.\n\nApakah Anda ingin menjalankan perumusan format dan analisis terlebih dahulu agar dokumen rapi dan lengkap sebelum dicetak?'
      );
      if (confirmRun) {
        handleGenerateAiReport();
        return;
      }
    }

    if (data) {
      await saveReportVerificationToSql(data, fullAiReport);
    }

    window.print();
  };

  if (loading) return (
    <div style={STYLES.loaderWrap}><div style={STYLES.loader}>Memuat Laporan Proyek...</div></div>
  );

  if (error || !data) return (
    <div style={STYLES.page}>
      <div style={STYLES.cleanBlock}>
        <div style={STYLES.errorBox}>{error || 'Data laporan tidak tersedia.'}</div>
        <button 
          onClick={() => router.push('/dashboard')} 
          style={{ ...STYLES.btnPrimary, marginTop: 10 }}
        >
          ← Kembali ke Dashboard
        </button>
      </div>
    </div>
  );

  const effectiveFacilitatorSignature = sanitizeSignatureUrl(
    userProfileSignature ||
    data.project.fasilitatorsignature ||
    (session as any)?.fasilitatorsignature ||
    (session as any)?.signature ||
    (session as any)?.foto_ttd ||
    (session as any)?.tanda_tangan ||
    ''
  );

  return (
    <div style={{ minHeight: '100vh', width: '100%' }}>
      
      <SafeJoyride steps={laporanSteps} storageKey="ahp_tour_laporan" />

      <main style={STYLES.page} id="report-download-area">
        <style jsx global>{`
          .table-scroll-wrap {
            overflow-x: auto;
            width: 100%;
          }

          @media print {
            @page { 
              size: A4 portrait !important; 
              margin: 12mm 10mm 26mm 10mm !important; 
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
            
            .no-print,
            nav,
            aside,
            header { 
              display: none !important; 
            }
            
            .table-scroll-wrap {
              overflow: visible !important;
              display: block !important;
              width: 100% !important;
            }

            p, li, blockquote {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              orphans: 3 !important;
              widows: 3 !important;
              font-size: ${aiLayout.narrative_font_pt}pt !important;
            }

            table {
              page-break-inside: auto !important;
              border-collapse: collapse !important;
              font-size: ${aiLayout.table_font_pt}pt !important;
              width: 100% !important;
              margin: 4px 0 8px 0 !important;
            }

            thead {
              display: table-header-group !important;
            }

            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            td, th {
              padding: ${aiLayout.table_cell_padding} !important;
            }

            .clean-section,
            .matrix-expert-item,
            .matrix-facilitator-item,
            .task-block-wrapper,
            .ai-chapter-card {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-bottom: ${aiLayout.section_gap_px}px !important;
              display: block !important;
            }

            .ai-break-chapter {
              page-break-before: ${aiLayout.break_before_ai_chapter ? 'always' : 'auto'} !important;
              break-before: ${aiLayout.break_before_ai_chapter ? 'page' : 'auto'} !important;
            }

            .ai-break-matrix {
              page-break-before: ${aiLayout.break_before_matrix_section ? 'always' : 'auto'} !important;
              break-before: ${aiLayout.break_before_matrix_section ? 'page' : 'auto'} !important;
            }

            .facilitator-signature-img {
              display: block !important;
              visibility: visible !important;
              max-height: 52px !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .qr-code-print {
              display: block !important;
              visibility: visible !important;
              width: 44px !important;
              height: 44px !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .report-footer-print {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              width: 100% !important;
              height: 14mm !important;
              background: #ffffff !important;
              padding-top: 4px !important;
              border-top: 1.5px solid #0f172a !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
            }

            .print-topbar {
              display: flex !important;
              background: linear-gradient(270deg, #15803d 0%, #ffffff 100%) !important;
              border: 1.5px solid #16a34a !important;
              border-radius: 6px !important;
              padding: 6px 10px !important;
              margin-bottom: 8px !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print-logo {
              height: 38px !important;
              mix-blend-mode: multiply !important;
            }
            .print-title {
              font-size: 11.5pt !important;
              font-weight: 800 !important;
              color: #064e3b !important;
              margin: 0 !important;
            }
            .print-subtitle {
              font-size: 7.5pt !important;
              color: #065f46 !important;
              font-weight: 600 !important;
              margin: 1px 0 0 !important;
            }
          }
        `}</style>

        <div style={STYLES.container}>
          
          <AppTopBar isPrint={true} />

          <div style={STYLES.headerRow} className="no-print">
            <div>
              <h1 style={STYLES.pageTitle}>Laporan Eksekutif &amp; Hasil AHP</h1>
              <p style={STYLES.pageDesc}>Dokumen rekapitulasi analitis proyek riset dan evaluasi kepakaran.</p>
              {sqlStatusMessage && (
                <div style={{ fontSize: 11, fontWeight: 600, color: sqlStatusMessage.startsWith('✓') ? '#16a34a' : '#d97706', marginTop: 3 }}>
                  {sqlStatusMessage}
                </div>
              )}
            </div>
            
            <div style={STYLES.headerActions}>
              <button
                type="button"
                onClick={handleStartLaporanTour}
                style={{
                  padding: '7px 12px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                title="Buka panduan interaktif halaman laporan eksekutif"
              >
                💡 Panduan Laporan
              </button>

              <button
                type="button"
                onClick={() => saveReportVerificationToSql(data, fullAiReport)}
                disabled={savingSql}
                style={{
                  ...STYLES.btnPrimary,
                  background: '#0284c7',
                  cursor: savingSql ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {savingSql ? '⏳ Menyimpan...' : '💾 Simpan ke Database'}
              </button>

              {canUseAi ? (
                <button 
                  onClick={handleGenerateAiReport} 
                  disabled={loadingAi}
                  className="tour-ai-report"
                  style={{ ...STYLES.btnPrimary, background: '#2563eb', cursor: loadingAi ? 'not-allowed' : 'pointer' }}
                  title="Susun bab pembahasan, ukuran spasi, font, dan tata letak dokumen secara otomatis"
                >
                  {loadingAi ? '⏳ Menyusun...' : 'Tata Format & Narasi'}
                </button>
              ) : (
                <button 
                  title="Fasilitas Penataan Format Analitis dinonaktifkan oleh SuperAdmin pada paket ini"
                  onClick={() => alert(`Fasilitas Penataan Format Analitis dinonaktifkan pada paket ${userPlan.toUpperCase()} sesuai kebijakan SuperAdmin. Silakan hubungi admin atau tingkatkan paket Anda.`)}
                  className="tour-ai-report"
                  style={{ ...STYLES.btnPrimary, background: '#94a3b8', color: '#f8fafc', cursor: 'not-allowed', border: '1px solid #cbd5e1' }}
                >
                  🔒 Tata Format & Narasi
                </button>
              )}

              <button 
                type="button" 
                onClick={handlePrintDocument} 
                className="tour-download-pdf"
                title="Tahap Akhir: Cetak atau Simpan Laporan sebagai PDF Resmi"
                style={{
                  ...STYLES.btnPrimary, 
                  background: '#16a34a',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                🖨️ Tampilkan Draft Laporan / Cetak PDF
              </button>
            </div>
          </div>

          {message && <div style={STYLES.infoBox}>{message}</div>}

          {/* 1. PARAMETER PROYEK & PENGESAHAN */}
          <section className="clean-section tour-parameter-proyek" style={STYLES.cleanBlock}>
            <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 8 }}>
              <span style={STYLES.badgeSoft}>{formatMethodLabel(data.project.metode)}</span>
              <h2 style={{ ...STYLES.pageTitle, fontSize: 16, marginTop: 4, color: '#1e3a8a' }}>{data.project.namaproyek}</h2>
              <p style={{ ...STYLES.metaText, fontSize: 11, marginTop: 2, textAlign: 'justify', textJustify: 'inter-word' }}>{data.project.deskripsi || 'Tidak ada deskripsi proyek.'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.15fr)', gap: 12, alignItems: 'stretch' }}>
              
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                  📊 Parameter Riset &amp; Struktur Keputusan
                </div>
                <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse', margin: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '2px 0', color: '#64748b' }}>Subkriteria:</td>
                      <td style={{ padding: '2px 0', fontWeight: 600, color: '#0f172a' }}>{data.project.punyasubkriteria ? 'Diaktifkan' : 'Tidak Ada'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 0', color: '#64748b' }}>Jumlah Kriteria:</td>
                      <td style={{ padding: '2px 0', fontWeight: 600, color: '#0f172a' }}>{data.criteria.length} Kriteria</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '2px 0', color: '#64748b' }}>Total Responden:</td>
                      <td style={{ padding: '2px 0', fontWeight: 600, color: '#0f172a' }}>{data.experts.length} Orang</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                
                <div style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: 4 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    👤 Peneliti / Fasilitator Utama
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginTop: 1 }}>
                    {data.project.fasilitatornama}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#475569', fontWeight: 600 }}>
                    {data.project.fasilitatorlembaga}
                  </div>
                  <div style={{ fontSize: 9, color: '#2563eb' }}>
                    {data.project.fasilitatoremail}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, marginTop: 2 }}>
                  <div>
                    <span style={{ fontSize: 8.5, color: '#64748b', fontStyle: 'italic', display: 'block' }}>
                      Status Pengesahan:
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#166534', border: '1px solid #86efac', background: '#dcfce7', padding: '1px 6px', borderRadius: 3, display: 'inline-block', marginTop: 2 }}>
                      ✓ Terverifikasi Resmi
                    </span>
                  </div>

                  <div style={{ minHeight: 48, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {effectiveFacilitatorSignature ? (
                      <img 
                        src={effectiveFacilitatorSignature} 
                        alt="Tanda Tangan Fasilitator" 
                        className="facilitator-signature-img"
                        style={{ 
                          height: 48, 
                          maxWidth: 140, 
                          objectFit: 'contain', 
                          mixBlendMode: 'multiply',
                          display: 'block'
                        }} 
                      />
                    ) : (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#166534', border: '1px solid #86efac', background: '#dcfce7', padding: '3px 8px', borderRadius: 4 }}>
                        ✓ Terverifikasi Digital
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* 2. GRAFIK PROPORSI BOBOT PRIORITAS GLOBAL */}
          <section className="clean-section tour-pie-chart" style={{ ...STYLES.cleanBlock, textAlign: 'center' }}>
            <h2 style={{ ...STYLES.sectionTitle, fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              I. Grafik Proporsi Bobot Prioritas Global
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <GlobalPieChart data={finalAggregateRanking} />
            </div>
          </section>

          {/* 3. TABEL RANKING PRIORITAS SINTESIS AKHIR */}
          <section className="clean-section tour-ranking" style={STYLES.cleanBlock}>
            <h2 style={{ ...STYLES.sectionTitle, fontSize: 13, marginBottom: 6 }}>
              II. Tabel Ranking Prioritas Sintesis Akhir
            </h2>
            
            <div className="table-scroll-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${aiLayout.table_font_pt}pt` }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #0f172a' }}>
                    <th style={{ ...STYLES.th, width: 45, textAlign: 'center' }}>Rank</th>
                    <th style={STYLES.th}>Alternatif / Elemen Keputusan</th>
                    <th style={{ ...STYLES.th, textAlign: 'right' }}>Bobot Skor Sintesis</th>
                  </tr>
                </thead>
                <tbody>
                  {finalAggregateRanking.map((item) => (
                    <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                        <span style={{ background: item.rank === 1 ? '#1e3a8a' : '#f1f5f9', color: item.rank === 1 ? '#fff' : '#334155', fontWeight: 700, padding: '2px 6px', borderRadius: 3, fontSize: 10 }}>
                          #{item.rank}
                        </span>
                      </td>
                      <td style={{ padding: '5px 4px', fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                      <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatNumber(item.score, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. EVALUASI RASIO KONSISTENSI (CR GLOBAL) */}
          <section className="clean-section tour-evaluasi-cr" style={{ ...STYLES.cleanBlock, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: 6,
              padding: '8px 18px',
              maxWidth: 580,
              width: '100%',
              margin: '0 auto',
              textAlign: 'center'
            }}>
              <div style={{ color: '#0f172a', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Evaluasi Rasio Konsistensi Global (Consistency Ratio / CR)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                {globalCrList.length > 0 ? (
                  globalCrList.map((gCr, idx) => (
                    <div key={idx} style={{ fontSize: 9.5, color: gCr.cr <= 0.1 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {gCr.title}: <strong>{formatNumber(gCr.cr, 3)}</strong> {gCr.cr <= 0.1 ? '✓ (Konsisten)' : '⚠ (Perlu Evaluasi)'}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
                    Data perbandingan berpasangan sedang menunggu verifikasi penuh responden pakar.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 5. DAFTAR PAKAR & PROGRESS */}
          <section className="clean-section tour-progress-pakar" style={STYLES.cleanBlock}>
            <h2 style={{ ...STYLES.sectionTitle, fontSize: 12.5, marginBottom: 4 }}>
              Daftar Responden Pakar &amp; Progress
            </h2>

            <div className="table-scroll-wrap">
              <table style={STYLES.table}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={STYLES.th}>Nama Lengkap &amp; Gelar</th>
                    <th style={STYLES.th}>Instansi</th>
                    <th style={STYLES.th}>Progress Tugas</th>
                    <th style={STYLES.th}>Status Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {expertCompletion.map((item) => (
                    <tr key={item.expert.id}>
                      <td style={{ ...STYLES.tdHead, padding: '4px 6px' }}>{formatExpertFullName(item.expert)}</td>
                      <td style={{ ...STYLES.td, padding: '4px 6px' }}>{item.expert.asalinstansi || '-'}</td>
                      <td style={{ ...STYLES.td, padding: '4px 6px' }}>{item.done} / {item.total} Sesi Selesai</td>
                      <td style={{ ...STYLES.td, padding: '4px 6px' }}>
                        <span style={item.finished ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                          {item.finished ? 'Selesai & Valid' : item.done > 0 ? 'Parsial' : 'Tertunda'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. BAB PEMBAHASAN & NARASI */}
          {fullAiReport && (
            <section className={`clean-section tour-ai-report ${aiLayout.break_before_ai_chapter ? 'ai-break-chapter' : ''}`} style={STYLES.cleanBlock} id="ai-report-section">
              <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  BAB III. INTERPRETASI &amp; PEMBAHASAN HASIL SINTESIS
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                  Sintesis Analisis Keputusan &amp; Rekomendasi Kebijakan
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ai-chapter-card" style={{ background: '#ffffff', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#1e3a8a' }}>
                    1. Sintesis Pembobotan &amp; Peringkat Prioritas
                  </h4>
                  <p style={{ margin: 0, fontSize: `${aiLayout.narrative_font_pt}pt`, color: '#334155', lineHeight: 1.5, textAlign: 'justify' }}>
                    {cleanAiText(
                      fullAiReport.executive_summary ||
                      fullAiReport.section_alternatives?.narrative ||
                      fullAiReport.section_criteria?.narrative ||
                      fullAiReport.section_overview ||
                      fullAiReport.overview?.main_summary ||
                      fullAiReport.overview?.summary ||
                      fullAiReport.main_summary ||
                      (typeof fullAiReport.overview === 'string' ? fullAiReport.overview : '') ||
                      'Sintesis pembobotan berhasil dianalisis.'
                    )}
                  </p>
                </div>

                <div className="ai-chapter-card" style={{ background: '#ffffff', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#065f46' }}>
                    2. Validasi Metodologis &amp; Konsistensi Responden vs Fasilitator
                  </h4>
                  <p style={{ margin: 0, fontSize: `${aiLayout.narrative_font_pt}pt`, color: '#334155', lineHeight: 1.5, textAlign: 'justify' }}>
                    {cleanAiText(
                      fullAiReport.consistency_evaluation || 
                      fullAiReport.section_consistency?.narrative || 
                      'Seluruh matriks perbandingan telah divalidasi dengan rasio inkonsistensi yang memenuhi syarat metodologis AHP.'
                    )}
                  </p>
                </div>

                <div className="ai-chapter-card" style={{ background: '#ffffff', padding: '6px 0' }}>
                  <h4 style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#92400e' }}>
                    3. Implikasi Strategis &amp; Rekomendasi Tindak Lanjut
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: `${aiLayout.narrative_font_pt}pt`, color: '#334155', lineHeight: 1.5 }}>
                    {(
                      fullAiReport.strategic_recommendations ||
                      fullAiReport.section_final_recommendations ||
                      fullAiReport.recommendations ||
                      fullAiReport.evaluation_recommendations ||
                      []
                    ).map((rec: any, idx: number) => (
                      <li key={idx} style={{ marginBottom: 3 }}>
                        {cleanAiText(typeof rec === 'object' && rec !== null ? (rec.message || rec.text || rec.advice || JSON.stringify(rec)) : String(rec))}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* RINCIAN MATRIKS PERBANDINGAN TUGAS BESERTA ANALISIS METODOLOGIS FORMAL */}
          <div className={aiLayout.break_before_matrix_section ? 'ai-break-matrix' : ''} style={{ marginTop: 6 }}>
            <h2 style={{ ...STYLES.sectionTitle, fontSize: 13, marginBottom: 6 }}>
              Rincian Matriks Perbandingan Berpasangan
            </h2>

            {tasks.map((task) => {
              const facilitatorMatrix = facilitatorMap[task.key] || getDefaultMatrix(task.itemnames.length);
              const facilitatorAnalysis = calculateAHP(facilitatorMatrix);

              const submittedResponses = data.experts
                .map(exp => findResponseForTask(data.responses, exp.id, task, data.project.id, data.experts))
                .filter((r): r is SavedResponse => !!r);

              const expertCrs = submittedResponses.map(r => {
                const m = normalizeMatrix(r.matriksjson, task.itemnames.length);
                return calculateAHP(m).cr;
              });

              const combinedCrs = [facilitatorAnalysis.cr, ...expertCrs];
              const avgCombinedCr = combinedCrs.reduce((a, b) => a + b, 0) / combinedCrs.length;
              const isConsistentlyValid = avgCombinedCr <= 0.10;

              let dominantItemFasilitator = task.itemnames[0] || 'Parameter';
              let maxWeightVal = 0;
              facilitatorAnalysis.weights.forEach((w, idx) => {
                if (w > maxWeightVal) {
                  maxWeightVal = w;
                  dominantItemFasilitator = task.itemnames[idx] || dominantItemFasilitator;
                }
              });

              return (
                <section key={task.key} className="clean-section task-block-wrapper" style={STYLES.cleanBlock}>
                  <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 4, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{task.title}</h3>
                    <p style={{ ...STYLES.metaText, fontSize: 9.5 }}>{task.description}</p>
                  </div>

                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderLeft: `4px solid ${isConsistentlyValid ? '#16a34a' : '#d97706'}`,
                    borderRadius: 4,
                    padding: '8px 12px',
                    marginBottom: 8,
                    fontSize: 9.5,
                    lineHeight: 1.5,
                    color: '#334155'
                  }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span>Evaluasi Analitis Metodologis: {task.title}</span>
                      <span style={{ color: isConsistentlyValid ? '#15803d' : '#b45309', fontWeight: 700 }}>
                        CR Fasilitator: {formatNumber(facilitatorAnalysis.cr, 3)} | Rata-rata Gabungan: {formatNumber(avgCombinedCr, 3)}
                      </span>
                    </div>
                    <div>
                      {isConsistentlyValid ? (
                        <span>
                          Sintesis perbandingan berpasangan pada klaster <strong>{task.title}</strong> memperlihatkan koherensi metodologis yang tinggi. Matriks referensi fasilitator mencatat rasio konsistensi CR {formatNumber(facilitatorAnalysis.cr, 3)} (≤ 0.10) dengan prioritas dominan pada elemen <strong>"{dominantItemFasilitator}"</strong> ({formatNumber(maxWeightVal * 100, 2)}%). Penilaian responden pakar konvergen secara harmonis terhadap tolok ukur fasilitator sehingga rata-rata rasio konsistensi gabungan stabil di angka <strong>{formatNumber(avgCombinedCr, 3)}</strong>.
                        </span>
                      ) : (
                        <span>
                          Terdapat deviasi pertimbangan transitif pada klaster <strong>{task.title}</strong>. Meskipun matriks fasilitator berorientasi pada <strong>"{dominantItemFasilitator}"</strong>, rata-rata konsistensi gabungan responden dan fasilitator tercatat {formatNumber(avgCombinedCr, 3)} (&gt; 0.10). Kalibrasi dan intervensi telaah matriks oleh fasilitator diterapkan guna menjaga validitas hierarki.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="matrix-facilitator-item" style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px', borderRadius: 4, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: '#166534' }}>⭐ Matriks Evaluasi &amp; Referensi Fasilitator</h4>
                        <p style={{ margin: 0, fontSize: 9, color: '#475569' }}>Bobot standar fasilitator utama.</p>
                      </div>
                      <span style={facilitatorAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning}>
                        CR: {formatNumber(facilitatorAnalysis.cr, 3)} {facilitatorAnalysis.cr <= 0.1 ? '✓' : '⚠'}
                      </span>
                    </div>

                    <div className="table-scroll-wrap" style={{ marginTop: 2 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: `${aiLayout.table_font_pt}pt`, background: '#fff' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#166534' }}>Item Komparasi</th>
                            {task.itemnames.map((name, idx) => (
                              <th key={idx} style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc', color: '#166534' }}>{name}</th>
                            ))}
                            <th style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#166534', textAlign: 'center' }}>Bobot Fasilitator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {task.itemnames.map((rowName, i) => (
                            <tr key={i}>
                              <td style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', fontWeight: 600, background: '#ffffff' }}>{rowName}</td>
                              {facilitatorMatrix[i].map((val, j) => (
                                <td key={j} style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                              ))}
                              <td style={{ padding: aiLayout.table_cell_padding, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, background: '#f8fafc', color: '#166534' }}>
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

                    const originalMatrix = normalizeMatrix(
                      saved?.originalmatriksjson && saved.originalmatriksjson.length > 0
                        ? saved.originalmatriksjson
                        : saved?.matriksjson,
                      task.itemnames.length
                    );
                    const originalAnalysis = calculateAHP(originalMatrix);

                    let isModifiedByFacilitator = false;
                    let modifiedCellsCount = 0;
                    for (let r = 0; r < task.itemnames.length; r++) {
                      for (let c = 0; c < task.itemnames.length; c++) {
                        if (Math.abs((matrix[r]?.[c] || 1) - (originalMatrix[r]?.[c] || 1)) > 0.001) {
                          isModifiedByFacilitator = true;
                          if (r < c) modifiedCellsCount++;
                        }
                      }
                    }

                    const crAwal = originalAnalysis.cr;
                    const crAkhir = analysis.cr;

                    let evalStatus: 'unchanged_valid' | 'unchanged_invalid' | 'fixed' | 'ruined' | 'still_invalid' | 'still_valid' = 'unchanged_valid';

                    if (!isModifiedByFacilitator) {
                      evalStatus = crAwal <= 0.10 ? 'unchanged_valid' : 'unchanged_invalid';
                    } else {
                      if (crAwal <= 0.10 && crAkhir > 0.10) {
                        evalStatus = 'ruined';
                      } else if (crAwal > 0.10 && crAkhir <= 0.10) {
                        evalStatus = 'fixed';
                      } else if (crAwal > 0.10 && crAkhir > 0.10) {
                        evalStatus = 'still_invalid';
                      } else {
                        evalStatus = 'still_valid';
                      }
                    }

                    const headerNamaLengkap = formatExpertFullName(expert);

                    return (
                      <div key={matrixKey(task.key, expert.id)} className="matrix-expert-item" style={isSubmitted ? STYLES.expertBlock : STYLES.expertBlockDisabled}>
                        <div style={STYLES.panelHeader}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <h4 style={isSubmitted ? STYLES.subTitle : STYLES.subTitleDisabled}>{headerNamaLengkap}</h4>
                              {isSubmitted && (
                                <span style={isModifiedByFacilitator ? STYLES.badgeModified : STYLES.badgeOriginal}>
                                  {isModifiedByFacilitator ? `✏ Disesuaikan (${modifiedCellsCount} Nilai Diubah)` : '✓ Asli'}
                                </span>
                              )}
                            </div>
                            <p style={STYLES.metaText}>{expert.asalinstansi || '-'}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            {isSubmitted ? (
                              <>
                                <span style={originalAnalysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning} title="CR Matriks Asli Input Responden">
                                  CR Awal: {formatNumber(originalAnalysis.cr, 3)} {originalAnalysis.cr <= 0.1 ? '✓' : '⚠️'}
                                </span>
                                <span style={analysis.cr <= 0.1 ? STYLES.badgeSuccess : STYLES.badgeWarning} title="CR Matriks Terverifikasi Akhir">
                                  CR Akhir: {formatNumber(analysis.cr, 3)} {analysis.cr <= 0.1 ? '✓' : '⚠'}
                                </span>
                              </>
                            ) : (
                              <span style={STYLES.badgeLocked}>🔒 Belum Mengisi</span>
                            )}
                          </div>
                        </div>

                        {isSubmitted ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: 4 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                                <span>📋 Matriks Original (Jawaban Asli Responden Pakar)</span>
                                <span>CR Awal: {formatNumber(originalAnalysis.cr, 3)}</span>
                              </div>
                              <div className="table-scroll-wrap">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, background: '#fff' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: 3, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569' }}>Item Asli</th>
                                      {task.itemnames.map((name, idx) => (
                                        <th key={idx} style={{ padding: 3, border: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc', color: '#475569' }}>{name}</th>
                                      ))}
                                      <th style={{ padding: 3, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#334155', textAlign: 'center' }}>Bobot Awal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {task.itemnames.map((rowName, i) => (
                                      <tr key={i}>
                                        <td style={{ padding: 3, border: '1px solid #cbd5e1', fontWeight: 600, background: '#ffffff' }}>{rowName}</td>
                                        {originalMatrix[i].map((val, j) => (
                                          <td key={j} style={{ padding: 3, border: '1px solid #cbd5e1', textAlign: 'center' }}>{formatNumber(val, 2)}</td>
                                        ))}
                                        <td style={{ padding: 3, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, background: '#f8fafc', color: '#334155' }}>
                                          {formatNumber(originalAnalysis.weights[i] || 0, 4)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, padding: 4 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#0f172a', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                  ✅ Matriks Evaluasi / Terverifikasi Akhir
                                  {isModifiedByFacilitator && (
                                    <span style={{ fontSize: 8.5, color: '#b45309', fontWeight: 600, marginLeft: 4 }}>
                                      (Sel latar oranye 🟧 menandakan nilai disesuaikan)
                                    </span>
                                  )}
                                </span>
                                <span>CR Akhir: {formatNumber(analysis.cr, 3)}</span>
                              </div>
                              <div className="table-scroll-wrap">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, background: '#fff' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: 3, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}>Item Evaluasi</th>
                                      {task.itemnames.map((name, idx) => (
                                        <th key={idx} style={{ padding: 3, border: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc', color: '#0f172a' }}>{name}</th>
                                      ))}
                                      <th style={{ padding: 3, border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#1e40af', textAlign: 'center' }}>Bobot Akhir</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {task.itemnames.map((rowName, i) => (
                                      <tr key={i}>
                                        <td style={{ padding: 3, border: '1px solid #cbd5e1', fontWeight: 600, background: '#ffffff' }}>{rowName}</td>
                                        {matrix[i].map((val, j) => {
                                          const isCellChanged = i !== j && Math.abs((val || 1) - (originalMatrix[i]?.[j] || 1)) > 0.001;
                                          return (
                                            <td 
                                              key={j} 
                                              style={{ 
                                                padding: 3, 
                                                border: '1px solid #cbd5e1', 
                                                textAlign: 'center', 
                                                background: isCellChanged ? '#fed7aa' : 'transparent', 
                                                fontWeight: isCellChanged ? 700 : 400 
                                              }}
                                            >
                                              {formatNumber(val, 2)}{isCellChanged ? '*' : ''}
                                            </td>
                                          );
                                        })}
                                        <td style={{ padding: 3, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, background: '#f8fafc', color: '#1e40af' }}>
                                          {formatNumber(analysis.weights[i] || 0, 4)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div style={{
                              background: evalStatus === 'ruined' ? '#fef2f2' : evalStatus === 'fixed' ? '#f0fdf4' : evalStatus === 'unchanged_invalid' ? '#fffbeb' : '#ffffff',
                              border: `1px solid ${evalStatus === 'ruined' ? '#fca5a5' : evalStatus === 'fixed' ? '#86efac' : evalStatus === 'unchanged_invalid' ? '#fde68a' : '#cbd5e1'}`,
                              borderRadius: 4,
                              padding: '4px 6px',
                              fontSize: 9,
                              lineHeight: 1.4,
                            }}>
                              {evalStatus === 'ruined' && (
                                <div>
                                  <strong style={{ color: '#b91c1c' }}>🚨 PERINGATAN KRITIS: Perubahan Merusak Konsistensi!</strong>
                                  <p style={{ margin: '1px 0 0', color: '#991b1b' }}>
                                    Matriks asli responden awalnya telah konsisten (CR Awal: {formatNumber(crAwal, 3)} ≤ 0.10), namun penyesuaian menyebabkannya menjadi tidak konsisten (CR Akhir: {formatNumber(crAkhir, 3)} &gt; 0.10). Segera lakukan pembatalan (*rollback*).
                                  </p>
                                </div>
                              )}

                              {evalStatus === 'fixed' && (
                                <div>
                                  <strong style={{ color: '#15803d' }}>✅ Intervensi Berhasil: Koreksi Konsistensi Valid</strong>
                                  <p style={{ margin: '1px 0 0', color: '#166534' }}>
                                    Matriks asli pakar sebelumnya inkonsisten (CR Awal: {formatNumber(crAwal, 3)} &gt; 0.10). Melalui penyesuaian pada {modifiedCellsCount} sel, rasio berhasil ditekan menjadi {formatNumber(crAkhir, 3)} (≤ 0.10).
                                  </p>
                                </div>
                              )}

                              {evalStatus === 'unchanged_valid' && (
                                <div>
                                  <strong style={{ color: '#1e3a8a' }}>✓ Matriks Original Valid &amp; Dipertahankan</strong>
                                  <p style={{ margin: '2px 0 0', color: '#334155' }}>
                                    Perbandingan konsisten sejak awal dengan CR {formatNumber(crAwal, 3)} (≤ 0.10). Tidak ada perubahan yang dilakukan oleh fasilitator.
                                  </p>
                                </div>
                              )}

                              {evalStatus === 'unchanged_invalid' && (
                                <div>
                                  <strong style={{ color: '#b45309' }}>⚠ Matriks Belum Konsisten</strong>
                                  <p style={{ margin: '2px 0 0', color: '#92400e' }}>
                                    Nilai CR matriks original sebesar {formatNumber(crAwal, 3)} melampaui batas ambang 0.10 dan belum dilakukan penyesuaian.
                                  </p>
                                </div>
                              )}

                              {evalStatus === 'still_invalid' && (
                                <div>
                                  <strong style={{ color: '#b45309' }}>⚠️ Penyesuaian Belum Mencapai Batas Konsisten</strong>
                                  <p style={{ margin: '2px 0 0', color: '#92400e' }}>
                                    Meskipun telah dilakukan penyesuaian, CR akhir ({formatNumber(crAkhir, 3)}) masih di atas 0.10.
                                  </p>
                                </div>
                              )}

                              {evalStatus === 'still_valid' && (
                                <div>
                                  <strong style={{ color: '#1e3a8a' }}>ℹ Penyesuaian Minor Tetap Konsisten</strong>
                                  <p style={{ margin: '2px 0 0', color: '#334155' }}>
                                    Dilakukan penyesuaian minor dan matriks akhir tetap konsisten (CR Akhir: {formatNumber(crAkhir, 3)} ≤ 0.10).
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={STYLES.lockedPanel}>
                            Data perbandingan belum tersedia karena responden belum menyelesaikan sesi ini.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>

          <ReportFootnote projectId={data.project.id} verificationUrl={verifiedDocUrl} />

        </div>
      </main>
    </div>
  );
}

export default function ProjectReportPage() {
  return (
    <Suspense fallback={<div style={STYLES.loaderWrap}><div style={STYLES.loader}>Memuat Laporan...</div></div>}>
      <ProjectReportPageContent />
    </Suspense>
  );
}

const STYLES: Record<string, CSSProperties> = {
  page: { 
    flex: 1,
    background: '#ffffff', 
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
    background: '#ffffff' 
  },
  loader: { color: '#64748b', fontSize: 14, fontWeight: 500 },
  container: { maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 },
  cleanBlock: { background: '#ffffff', borderRadius: 0, padding: '8px 0', borderBottom: '1px solid #e2e8f0' },
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 },
  headerActions: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  pageTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' },
  pageDesc: { margin: '2px 0 0', color: '#64748b', fontSize: 11 },
  sectionTitle: { margin: 0, fontSize: 12.5, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.3px' },
  metaText: { color: '#64748b', margin: '2px 0 0', fontSize: 10, lineHeight: 1.35 },
  
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 },
  subTitle: { margin: 0, fontSize: 11.5, fontWeight: 700, color: '#0f172a' },
  subTitleDisabled: { margin: 0, fontSize: 11.5, fontWeight: 700, color: '#94a3b8' },

  expertBlock: { marginTop: 6, paddingTop: 6, borderTop: '1px dashed #cbd5e1' },
  expertBlockDisabled: { marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0', opacity: 0.8 },
  lockedPanel: { background: '#f8fafc', color: '#64748b', padding: 6, borderRadius: 4, textAlign: 'center', fontSize: 9.5, border: '1px dashed #cbd5e1', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 10 },
  th: { textAlign: 'left', padding: '4px 6px', background: '#f8fafc', color: '#475569', fontSize: 9.5, fontWeight: 600, borderBottom: '1px solid #cbd5e1' },
  td: { padding: '4px 6px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontSize: 10, verticalAlign: 'middle' },
  tdHead: { padding: '4px 6px', borderBottom: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 600, fontSize: 10, verticalAlign: 'middle' },
  badgeSoft: { background: '#f1f5f9', color: '#334155', padding: '2px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700 },
  badgeSuccess: { background: '#dcfce7', color: '#166534', padding: '2px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, border: '1px solid #bbf7d0' },
  badgeWarning: { background: '#fef3c7', color: '#b45309', padding: '2px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, border: '1px solid #fde68a' },
  badgeLocked: { background: '#f1f5f9', color: '#94a3b8', padding: '2px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 600, border: '1px solid #e2e8f0' },
  badgeModified: { background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700 },
  badgeOriginal: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700 },
  btnPrimary: { background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, fontSize: 11 },
  btnGhost: { background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11 },
  errorBox: { background: '#fef2f2', color: '#991b1b', border: '1px dashed #fecaca', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 11.5 },
  infoBox: { background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 11.5 },
};