// app/proyek/laporan/helpers/report-types.ts

export interface ProjectDetail {
  id: string;
  projectid?: string;
  namaproyek: string;
  deskripsi: string;
  metode: string;
  jumlahexpert: number;
  punyasubkriteria: boolean;
  fasilitatoremail: string;
  fasilitatorwhatsapp: string;
  createdat?: string;
  updatedat?: string;
  userid?: string;
  useremail?: string;
}

export interface CriteriaItem {
  id: string;
  projectid: string;
  kode: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

export interface SubcriteriaItem {
  id: string;
  projectid: string;
  criteriaid: string;
  kode: string;
  criterianame?: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

export interface AlternatifItem {
  id: string;
  projectid: string;
  kode: string;
  nama: string;
  urutan: number;
  createdat?: string;
}

export interface ExpertItem {
  id: string;
  projectid: string;
  expertindex: number;
  expertname: string;
  expertemail: string;
  expertwhatsapp: string;
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
}

export interface SavedResponse {
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
  cr: number;
  submittedat: string;
  updatedat: string;
  submittedby?: string;
  lasteditedby?: string;
  editnotes?: string;
  isconfirmed?: boolean;
  confirmedat?: string;
}

export interface MatrixTask {
  key: string;
  title: string;
  description: string;
  matrixtype: string;
  parentid: string;
  parentname: string;
  itemids: string[];
  itemnames: string[];
}

export interface BundleState {
  project: ProjectDetail;
  criteria: CriteriaItem[];
  subcriteria: SubcriteriaItem[];
  alternatif: AlternatifItem[];
  experts: ExpertItem[];
  responses: SavedResponse[];
}

export interface AppsScriptResponse<T = unknown> {
  success?: boolean;
  message?: string;
  errorcode?: string;
  data?: T;
}

export interface AggregatedWeightItem {
  name: string;
  weight: number;
}

export interface TaskExpertReport {
  expert: ExpertItem;
  saved: SavedResponse | null;
  latestMatrix: number[][];
  baselineMatrix: number[][];
  latestAnalysis: {
    weights: number[];
    lambdaMax: number;
    ci: number;
    cr: number;
  };
  baselineAnalysis: {
    weights: number[];
    lambdaMax: number;
    ci: number;
    cr: number;
  };
}

export interface TaskReport {
  task: MatrixTask;
  expertReports: TaskExpertReport[];
  aggregatedWeights: AggregatedWeightItem[];
}

export interface ExpertCompletionItem {
  expert: ExpertItem;
  done: number;
  total: number;
  finished: boolean;
}

export interface FinalAlternativeRankingItem {
  name: string;
  score: number;
  rank: number;
}

export interface GeminiTaskExpertReview {
  expertId: string;
  expertName: string;
  institution?: string;
  cr: number;
  status: 'konsisten' | 'perlu_tinjauan';
  updatedAt?: string;
}

export interface GeminiTaskPayload {
  key: string;
  title: string;
  type: string;
  parentName: string;
  aggregatedWeights: AggregatedWeightItem[];
  expertReviews: GeminiTaskExpertReview[];
}

export interface GeminiAlternativePayload {
  name: string;
  score: number;
  rank: number;
}

export interface GeminiAnalysisPayload {
  project: {
    id: string;
    name: string;
    method: string;
    hasSubcriteria: boolean;
    totalExperts: number;
  };
  completion: {
    totalTasks: number;
    totalResponses: number;
    completedExperts: number;
    pendingExperts: number;
    status: 'lengkap' | 'parsial' | 'belum_lengkap';
  };
  tasks: GeminiTaskPayload[];
  alternatives: GeminiAlternativePayload[];
}