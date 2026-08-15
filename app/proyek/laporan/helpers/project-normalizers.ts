// app/proyek/laporan/helpers/project-normalizers.ts

import type {
  AlternatifItem,
  CriteriaItem,
  ExpertItem,
  ProjectDetail,
  SavedResponse,
  SubcriteriaItem,
} from './report-types';

export function normalizeProject(raw: Record<string, unknown>): ProjectDetail {
  return {
    id: String(raw.id || raw.projectid || raw.project_id || ''),
    projectid: String(raw.projectid || raw.project_id || raw.id || ''),
    namaproyek: String(raw.namaproyek || raw.nama_proyek || ''),
    deskripsi: String(raw.deskripsi || ''),
    metode: String(raw.metode || ''),
    jumlahexpert: Number(raw.jumlahexpert || raw.jumlah_expert || 0),
    punyasubkriteria: Boolean(raw.punyasubkriteria ?? raw.punya_subkriteria),
    fasilitatoremail: String(raw.fasilitatoremail || raw.fasilitator_email || ''),
    fasilitatorwhatsapp: String(raw.fasilitatorwhatsapp || raw.fasilitator_whatsapp || ''),
    createdat: String(raw.createdat || raw.created_at || ''),
    updatedat: String(
      raw.updatedat || raw.updated_at || raw.createdat || raw.created_at || '',
    ),
    userid: String(raw.userid || raw.user_id || ''),
    useremail: String(raw.useremail || raw.user_email || ''),
  };
}

export function normalizeCriteria(raw: Record<string, unknown>): CriteriaItem {
  return {
    id: String(raw.id || raw.criteriaid || raw.criteria_id || ''),
    projectid: String(raw.projectid || raw.project_id || ''),
    kode: String(raw.kode || ''),
    nama: String(raw.nama || ''),
    urutan: Number(raw.urutan || 0),
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

export function normalizeSubcriteria(
  raw: Record<string, unknown>,
): SubcriteriaItem {
  return {
    id: String(raw.id || raw.subcriteriaid || raw.subcriteria_id || ''),
    projectid: String(raw.projectid || raw.project_id || ''),
    criteriaid: String(raw.criteriaid || raw.criteria_id || ''),
    kode: String(raw.kode || ''),
    criterianame: String(raw.criterianame || raw.criteria_name || ''),
    nama: String(raw.nama || ''),
    urutan: Number(raw.urutan || 0),
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

export function normalizeAlternative(
  raw: Record<string, unknown>,
): AlternatifItem {
  return {
    id: String(raw.id || raw.alternativeid || raw.alternative_id || ''),
    projectid: String(raw.projectid || raw.project_id || ''),
    kode: String(raw.kode || ''),
    nama: String(raw.nama || ''),
    urutan: Number(raw.urutan || 0),
    createdat: String(raw.createdat || raw.created_at || ''),
  };
}

export function normalizeExpert(raw: Record<string, unknown>): ExpertItem {
  return {
    id: String(raw.id || raw.expertid || raw.expert_id || ''),
    projectid: String(raw.projectid || raw.project_id || ''),
    expertindex: Number(raw.expertindex || raw.expert_index || 0),
    expertname: String(raw.expertname || raw.expert_name || ''),
    expertemail: String(raw.expertemail || raw.expert_email || ''),
    expertwhatsapp: String(raw.expertwhatsapp || raw.expert_whatsapp || ''),
    token: String(raw.token || ''),
    status: String(raw.status || ''),
    role: String(raw.role || ''),
    asalinstansi: String(raw.asalinstansi || raw.asal_instansi || ''),
    pendidikanterakhir: String(
      raw.pendidikanterakhir || raw.pendidikan_terakhir || '',
    ),
    bidangkeahlian: String(raw.bidangkeahlian || raw.bidang_keahlian || ''),
    invitechannel: String(raw.invitechannel || raw.invite_channel || ''),
    invitesentat: String(raw.invitesentat || raw.invite_sent_at || ''),
    confirmedat: String(raw.confirmedat || raw.confirmed_at || ''),
    responsestatus: String(raw.responsestatus || raw.response_status || ''),
    createdat: String(raw.createdat || raw.created_at || ''),
    updatedat: String(raw.updatedat || raw.updated_at || ''),
  };
}

export function normalizeSavedResponse(
  raw: Record<string, unknown>,
): SavedResponse {
  return {
    id: String(raw.id || raw.responseid || raw.response_id || ''),
    projectid: String(raw.projectid || raw.project_id || ''),
    expertid: String(raw.expertid || raw.expert_id || ''),
    expertindex: Number(raw.expertindex || raw.expert_index || 0),
    expertname: String(raw.expertname || raw.expert_name || ''),
    matrixtype: String(raw.matrixtype || raw.matrix_type || ''),
    parentid: String(raw.parentid || raw.parent_id || ''),
    parentname: String(raw.parentname || raw.parent_name || ''),
    itemids: Array.isArray(raw.itemids)
      ? raw.itemids.map((x) => String(x))
      : Array.isArray(raw.item_ids)
      ? (raw.item_ids as unknown[]).map((x) => String(x))
      : [],
    itemnames: Array.isArray(raw.itemnames)
      ? raw.itemnames.map((x) => String(x))
      : Array.isArray(raw.item_names)
      ? (raw.item_names as unknown[]).map((x) => String(x))
      : [],
    matriksjson: Array.isArray(raw.matriksjson)
      ? (raw.matriksjson as number[][])
      : Array.isArray(raw.matriks_json)
      ? (raw.matriks_json as number[][])
      : [],
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