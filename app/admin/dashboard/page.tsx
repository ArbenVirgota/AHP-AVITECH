// app/admin/dashboard/page.tsx

'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler
);

const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_WEBAPP_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || ''

const PRODUCT_CATEGORIES = [
  'Modul Riset',
  'Lisensi Software',
  'Software / Aplikasi',
  'Layanan Konsultasi',
  'Pelatihan & Training',
  'Buku / Dokumen Panduan',
  'Layanan Verifikasi Data',
  'Umum'
];

type TabType = 
  | 'expert_directory' 
  | 'users' 
  | 'products' 
  | 'consultation_user'   
  | 'consultation_admin'  
  | 'visitor_stats'
  | 'feedback' 
  | 'sop_guide';

interface UserItem {
  id?: string;
  user_id?: string;
  nama?: string;
  name?: string;
  email?: string;
  plan?: string;          
  status_user?: string;   
  deactivated_at?: string;
  digital_signature?: string;
  institusi?: string;
  [key: string]: any;
}

interface ExpertItem {
  id?: string;
  expert_id?: string;
  expertId?: string;
  expert_name?: string;
  expertname?: string;
  nama?: string;
  gelar_depan?: string;
  gelardepan?: string;
  gelar_belakang?: string;
  gelarbelakang?: string;
  bidang_keahlian?: string;
  bidangkeahlian?: string;
  keahlian?: string;
  asal_instansi?: string;
  asalinstansi?: string;
  instansi?: string;
  lembaga?: string;
  pendidikan_terakhir?: string;
  pendidikanterakhir?: string;
  pendidikan?: string;
  durasi_pengalaman?: string;
  durasipengalaman?: string;
  pengalaman?: string;
  expert_email?: string;
  expertemail?: string;
  email?: string;
  expert_whatsapp?: string;
  expertwhatsapp?: string;
  whatsapp?: string;
  foto_url?: string;
  foto?: string;
  portofolio_url?: string;
  portofolio?: string;
  cv?: string;
  ktp_url?: string;
  ktp?: string;
  status?: string;
  is_public?: string;
  ispublic?: string;
  [key: string]: any;
}

interface ProductItem {
  id?: string;
  productId?: string;
  product_id?: string;
  nama?: string;
  name?: string;
  deskripsi?: string;
  description?: string;
  status?: string;
  kategori?: string;
  category?: string;
  link?: string;
  imageurl?: string;
  gambar?: string;
  [key: string]: any;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userAllowedAccess, setUserAllowedAccess] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('expert_directory');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [experts, setExperts] = useState<ExpertItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [userConsultations, setUserConsultations] = useState<any[]>([]);
  const [adminConsultations, setAdminConsultations] = useState<any[]>([]);
  const [visitorStatsList, setVisitorStatsList] = useState<any[]>([]);
  const [totalPublicVisits, setTotalPublicVisits] = useState(0);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [selectedConsultations, setSelectedConsultations] = useState<string[]>([]);
  const [selectedAdminConsultations, setSelectedAdminConsultations] = useState<string[]>([]);
  
  // STATE FILTER PENCARIAN
  const [expertSearchQuery, setExpertSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [consultSearchQuery, setConsultSearchQuery] = useState('');
  const [consultStatusFilter, setConsultStatusFilter] = useState('ALL');
  const [adminConsultSearchQuery, setAdminConsultSearchQuery] = useState('');
  const [adminConsultStatusFilter, setAdminConsultStatusFilter] = useState('ALL');
  const [visitorSearchQuery, setVisitorSearchQuery] = useState('');
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState('');

  // MODAL PRODUK
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productForm, setProductForm] = useState({ id: '', nama: '', deskripsi: '', status: 'Tersedia', kategori: 'Modul Riset', link: '', imageurl: '' });
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // MODAL EXPERT
  const [isExpertModalOpen, setIsExpertModalOpen] = useState(false);
  const [editingExpert, setEditingExpert] = useState<ExpertItem | null>(null);
  const [expertForm, setExpertForm] = useState({
    expert_id: '', gelar_depan: '', expert_name: '', gelar_belakang: '',
    bidang_keahlian: '', asal_instansi: '', pendidikan_terakhir: 'S2 / Magister', durasi_pengalaman: '',
    expert_email: '', expert_whatsapp: '', foto_url: '', portofolio_url: '', ktp_url: '',
    status: 'Aktif', is_public: 'PUBLIK'
  });
  const [submittingExpert, setSubmittingExpert] = useState(false);

  // MODAL CATATAN
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [targetExpertForNote, setTargetExpertForNote] = useState<ExpertItem | null>(null);
  const [noteFormIsian, setNoteFormIsian] = useState({
    needFotoFix: false, needCvFix: false, needKtpFix: false, needDataFix: false,
    formUrl: '', customNote: ''
  });

  // MODAL PASSWORD
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<UserItem | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // MODAL TIKET KONSULTASI
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState('Selesai');
  const [submittingReply, setSubmittingReply] = useState(false);

  const generateRandomExpPass = () => `EXP-${Math.floor(1000 + Math.random() * 9000)}`;

  // HELPER FORMAT TANGGAL
  const formatDisplayDate = (val: any) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
      return String(val);
    } catch {
      return String(val);
    }
  };

  // TEMPLATE JAWABAN CEPAT 1 - 4
  const applyTemplate = (templateIndex: number) => {
    if (!selectedTicket) return;
    const userName = selectedTicket.user_name || selectedTicket['Nama User'] || selectedTicket.nama_user || selectedTicket.namaUser || selectedTicket[3] || 'Pengguna';
    const ticketId = selectedTicket.ticket_id || selectedTicket['ID Tiket'] || selectedTicket.id_tiket || selectedTicket.idTiket || selectedTicket.id || selectedTicket[0] || '';

    let text = '';

    if (templateIndex === 1) {
      text = `Halo ${userName},\n\nTerima kasih atas minat Anda untuk meningkatkan layanan ke Paket [PRO / PLUS / PREMIUM - Semester Pass].\n\nBerikut adalah rincian tagihan dan rekening resmi pembayaran:\n• Paket Langganan : Paket [PRO / PLUS / PREMIUM] (6 Bulan)\n• Total Nominal    : Rp [Contoh: 350.000]\n• Bank Tujuan      : Bank [BCA / Mandiri / BNI / BRI]\n• Nomor Rekening   : [1234-5678-9000]\n• Atas Nama        : [Nama Pemilik Rekening / Instansi]\n\nPetunjuk Konfirmasi:\nSetelah transfer berhasil dilakukan, silakan klik tombol "💸 Konfirmasi Telah Bayar (Upload Bukti)" di bawah pesan ini untuk mengunggah foto struk/bukti transfer Anda. Tim admin akan segera memverifikasi dan mengaktifkan hak akses akun Anda.\n\nSalam hangat,\nTim Layanan Pelanggan & Billing AHP`;
      setReplyStatus('Menunggu');
    } else if (templateIndex === 2) {
      text = `Halo ${userName},\n\nKabar baik! Pembayaran Anda telah terverifikasi dan akun Anda telah berhasil di-upgrade ke Paket [PRO / PLUS / PREMIUM].\n\nRincian Hak Akses Baru Anda:\n• Status Paket    : [PRO / PLUS / PREMIUM] (Aktif)\n• Masa Berlaku    : 6 Bulan (Semester Pass) hingga [Tanggal Expired]\n• Kuota Proyek    : [3 / 10 / Unlimited] Proyek AHP\n• Kuota Evaluator : Akses Evaluator Manual & Direktori Pakar Platform\n• Fitur Unggulan  : [Subkriteria / Bobot Alternatif / AI Analisis Riset]\n\nSilakan muat ulang (refresh) halaman Dashboard Anda untuk mulai menggunakan fasilitas paket baru. Terima kasih telah mempercayakan analisis riset Anda pada platform kami.\n\nSalam sukses,\nTim Administrator Sistem AHP`;
      setReplyStatus('Selesai');
    } else if (templateIndex === 3) {
      text = `Halo ${userName},\n\nBukti transfer yang Anda unggah untuk tiket #${ticketId} telah kami terima dengan baik.\n\nSaat ini tim billing kami sedang melakukan pencocokan mutasi perbankan (estimasi 15–60 menit pada jam kerja). Status paket Anda akan diperbarui secara otomatis begitu verifikasi selesai.\n\nMohon kesediaan Anda untuk menunggu sejenak.\n\nSalam,\nTim Verifikasi & Billing AHP`;
      setReplyStatus('Sedang Diverifikasi');
    } else if (templateIndex === 4) {
      text = `Halo ${userName},\n\nMohon maaf, pengajuan upgrade untuk tiket #${ticketId} saat ini belum dapat kami proses karena alasan berikut:\n\n• [Bukti transfer yang diunggah tidak terbaca jelas / buram / nominal transfer tidak sesuai / dana belum masuk pada mutasi rekening].\n\nLangkah Selanjutnya:\nSilakan periksa kembali bukti transaksi Anda dan kirimkan konfirmasi ulang, atau hubungi kami kembali melalui tiket ini jika Anda membutuhkan bantuan lebih lanjut.\n\nSalam,\nTim Layanan Pelanggan AHP`;
      setReplyStatus('Ditolak');
    }

    setReplyMessage(text);
  };

  const handleOpenReplyModal = (ticket: any) => {
    setSelectedTicket(ticket);
    const status = ticket.status || ticket['Status'] || ticket[7] || 'Selesai';
    setReplyStatus(status);
    setReplyMessage(ticket.jawaban_expert || ticket['Isi_Email'] || ticket.isi_email || '');
    setShowReplyModal(true);
  };

  const canAccessTab = (tabKey: TabType) => {
    if (isSuperAdmin) return true;
    if (tabKey === 'sop_guide') return true;
    if (!userAllowedAccess || !Array.isArray(userAllowedAccess)) return false;
    return userAllowedAccess.some(accessKey => {
      const cleanKey = String(accessKey).toLowerCase().trim().replace(/[\[\]"']/g, '');
      return cleanKey === String(tabKey).toLowerCase().trim();
    });
  };

  const fetchWithCatch = useCallback(async (action: string) => {
    if (!GOOGLE_SCRIPT_URL) return [];
    try {
      const timestampCacheBuster = new Date().getTime();
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=${action}&_t=${timestampCacheBuster}`, { method: 'GET', cache: 'no-store', redirect: 'follow' });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { return []; }
      if (json && (json.success || Array.isArray(json.data) || Array.isArray(json))) return json.data || (Array.isArray(json) ? json : []);
      return [];
    } catch { return []; }
  }, []);

  const fetchAllOperasionalData = useCallback(async () => {
    if (!GOOGLE_SCRIPT_URL) { setApiError('⚠️ URL Google Apps Script belum dikonfigurasi.'); return; }
    try {
      setLoading(true);
      setApiError('');
      setSelectedLogs([]);
      setSelectedConsultations([]);
      setSelectedAdminConsultations([]);

      const results = await Promise.allSettled([
        fetchWithCatch('getexpertdirectory'),
        fetchWithCatch('getproducts'),
        fetchWithCatch('getconsultationrequests'),
        fetchWithCatch('getconsultations'),
        fetchWithCatch('getvisitorstats'),
        fetchWithCatch('getfeedbacks'),
        fetchWithCatch('getusers')
      ]);

      setExperts(results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : []);
      setProducts(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : []);
      setUserConsultations(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : []);
      setAdminConsultations(results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []);
      setFeedbacks(results[5].status === 'fulfilled' && Array.isArray(results[5].value) ? results[5].value : []);
      setUsersList(results[6].status === 'fulfilled' && Array.isArray(results[6].value) ? results[6].value : []);

      const visitRes = results[4].status === 'fulfilled' ? results[4].value : {};
      const logs = Array.isArray(visitRes) ? visitRes : (visitRes.logs || []);
      setVisitorStatsList(logs);
      setTotalPublicVisits(typeof visitRes === 'object' && !Array.isArray(visitRes) ? (visitRes.total_public_visits || logs.length) : logs.length);

    } catch (err: any) { setApiError(`⚠️ Gagal memuat data: ${err.message}`); } finally { setLoading(false); }
  }, [fetchWithCatch]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const role = localStorage.getItem('admin_role') || 'Admin Pembantu';
    const name = localStorage.getItem('admin_name') || 'Admin Operator';
    const email = localStorage.getItem('admin_email') || '';
    const accessRaw = localStorage.getItem('admin_access') || '';

    if (!token) { router.replace('/admin/login'); return; }

    const checkSuper = role.toLowerCase().includes('superadmin') || role.toLowerCase().includes('super admin');
    setAdminName(name); setAdminEmail(email); setAdminRole(role); setIsSuperAdmin(checkSuper);

    let parsedAccess: string[] = [];
    if (accessRaw) {
      try { const temp = JSON.parse(accessRaw); parsedAccess = Array.isArray(temp) ? temp : String(temp).split(','); } 
      catch { parsedAccess = String(accessRaw).split(','); }
    } else { parsedAccess = ['expert_directory', 'users', 'products', 'consultation_user', 'consultation_admin', 'feedback', 'visitor_stats']; }
    setUserAllowedAccess(parsedAccess.map(a => String(a).replace(/[\[\]"']/g, '').trim()));

    fetchAllOperasionalData();
  }, [router, fetchAllOperasionalData]);

  // HANDLER UPDATE STATUS DARI DROPDOWN
  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    if (!GOOGLE_SCRIPT_URL) return;

    setUserConsultations(prev =>
      prev.map(item => {
        const id = String(item.ticket_id || item['ID Tiket'] || item.id_tiket || item.idTiket || item.id || item[0] || '');
        return id === ticketId ? { ...item, status: newStatus, Status: newStatus } : item;
      })
    );

    setAdminConsultations(prev =>
      prev.map(item => {
        const id = String(item.ticket_id || item['ID Tiket'] || item.id_tiket || item.idTiket || item.id || item[0] || '');
        return id === ticketId ? { ...item, status: newStatus, Status: newStatus } : item;
      })
    );

    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=updateconsultationstatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'updateconsultationstatus',
          ticket_id: ticketId,
          idTiket: ticketId,
          id: ticketId,
          status: newStatus,
          new_status: newStatus,
          adminName,
          adminEmail,
          adminRole
        }),
        redirect: 'follow'
      });

      const textRes = await res.text();
      let json;
      try { json = JSON.parse(textRes); } catch { json = { success: true }; }

      if (json && json.success === false) {
        alert(`⚠️ Gagal memperbarui status di server: ${json.message}`);
        fetchAllOperasionalData();
      }
    } catch (err: any) {
      alert(`Gagal koneksi ke server: ${err.message}`);
      fetchAllOperasionalData();
    }
  };

  const handleDeleteExpert = async (exp: ExpertItem) => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    const expId = String(exp.expert_id || exp.expertId || exp.id || '');
    if (!window.confirm(`Yakin ingin menghapus Pakar: ${exp.expert_name || exp.nama}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteexpert`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: 'deleteexpert', expertId: expId, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Berhasil dihapus.'); fetchAllOperasionalData(); } else { alert(json.message); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteProduct = async (prod: ProductItem) => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    const prodId = String(prod.id || prod.productId || prod.product_id || '');
    if (!window.confirm(`Yakin ingin menghapus Produk: ${prod.nama || prod.name}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteproduct`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: 'deleteproduct', productId: prodId, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Berhasil dihapus.'); fetchAllOperasionalData(); } else { alert(json.message); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteConsultation = async (ticket: any) => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    const ticketId = String(ticket.ticket_id || ticket['ID Tiket'] || ticket.id_tiket || ticket.idTiket || ticket.id || ticket[0] || '').trim();
    if (!ticketId) return alert('ID Tiket tidak ditemukan.');
    if (!window.confirm(`Yakin ingin menghapus Tiket #${ticketId}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteconsultation`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: 'deleteconsultation', ticket_id: ticketId, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Berhasil dihapus.'); fetchAllOperasionalData(); } else { alert(json.message); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteBulkConsultations = async () => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    if (selectedConsultations.length === 0) return alert('Pilih minimal 1 tiket untuk dihapus.');
    if (!window.confirm(`Yakin ingin menghapus secara permanen ${selectedConsultations.length} tiket yang dipilih?`)) return;

    try {
      setLoading(true);
      for (const ticketId of selectedConsultations) {
        await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteconsultation`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
          body: JSON.stringify({ action: 'deleteconsultation', ticket_id: ticketId, adminName, adminEmail, adminRole }),
          redirect: 'follow'
        });
      }
      alert('Tiket terpilih berhasil dihapus.');
      setSelectedConsultations([]);
      fetchAllOperasionalData();
    } catch (err: any) {
      alert(`Terjadi kesalahan saat menghapus: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBulkAdminConsultations = async () => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    if (selectedAdminConsultations.length === 0) return alert('Pilih minimal 1 tiket untuk dihapus.');
    if (!window.confirm(`Yakin ingin menghapus secara permanen ${selectedAdminConsultations.length} tiket admin-pakar yang dipilih?`)) return;

    try {
      setLoading(true);
      for (const ticketId of selectedAdminConsultations) {
        await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteconsultation`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
          body: JSON.stringify({ action: 'deleteconsultation', ticket_id: ticketId, adminName, adminEmail, adminRole }),
          redirect: 'follow'
        });
      }
      alert('Tiket admin-pakar terpilih berhasil dihapus.');
      setSelectedAdminConsultations([]);
      fetchAllOperasionalData();
    } catch (err: any) {
      alert(`Terjadi kesalahan saat menghapus: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFeedback = async (fb: any) => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    if (!window.confirm(`Yakin ingin menghapus Masukan dari: ${fb.nama || fb.Name || fb[1] || 'Anonim'}?`)) return;
    try {
      setLoading(true);
      const timestamp = fb.timestamp || fb.Timestamp || fb[0];
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deletefeedback`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: 'deletefeedback', timestamp: timestamp, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Berhasil dihapus.'); fetchAllOperasionalData(); } else { alert(json.message); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteUser = async (usr: UserItem) => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    if (!window.confirm(`⚠️ Yakin ingin MENGHAPUS User Pakar: ${usr.nama || usr.name} (${usr.email})? Aksi ini mungkin tidak dapat dibatalkan.`)) return;
    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deleteuser`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: 'deleteuser', email: usr.email, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { 
        alert('Berhasil dihapus.'); fetchAllOperasionalData(); 
      } else { 
        alert(`Gagal: ${json.message}`); 
      }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleDeleteVisitorLogs = async () => {
    if (!isSuperAdmin) return alert('Akses ditolak: Hanya Super Admin yang dapat menghapus data.');
    if (selectedLogs.length === 0) return alert('Pilih minimal 1 log untuk dihapus.');
    if (!window.confirm(`Hapus ${selectedLogs.length} data kunjungan terpilih?`)) return;

    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=deletevisitorlogs`, {
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'deletevisitorlogs', 
          rows: selectedLogs,
          adminName, adminEmail, adminRole 
        }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) {
        alert('Berhasil dihapus.');
        setSelectedLogs([]);
        fetchAllOperasionalData();
      } else { alert(`Gagal menghapus log: ${json.message}`); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  const handleUpdateExpertPlan = async (targetEmail: string, selectedPlan: string) => {
    if (!window.confirm(`Ubah plan untuk pengguna ${targetEmail} menjadi ${selectedPlan.toUpperCase()} dan sinkronkan ke sheet subscriptions?`)) return;

    try {
      setLoading(true);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const expiryStr = nextYear.toISOString().split('T')[0];

      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=admin_update_user_plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'admin_update_user_plan',
          email: targetEmail,
          plan: selectedPlan.toUpperCase(),
          status_user: 'ACTIVE',
          deactivated_at: expiryStr,
          sync_subscriptions: true,
          adminName, 
          adminEmail, 
          adminRole
        }),
        redirect: 'follow'
      });

      const json = await res.json();
      if (json.success) {
        alert(`✅ Berhasil! Akun ${targetEmail} kini berstatus ${selectedPlan.toUpperCase()} di sheet Users & Subscriptions.`);
        fetchAllOperasionalData();
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) { 
      alert(`Error: ${err.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleOpenPasswordModal = (usr: UserItem) => {
    setTargetUserForPassword(usr);
    setCustomPassword(generateRandomExpPass());
    setIsPasswordModalOpen(true);
  };

  const handleSavePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPassword?.email) return;
    if (!customPassword || customPassword.length < 6) { alert('Kata sandi minimal 6 karakter.'); return; }

    try {
      setSubmittingPassword(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=admin_update_user_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'admin_update_user_password', email: targetUserForPassword.email, new_password: customPassword, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });

      const json = await res.json();
      if (json.success) {
        alert(`✅ Berhasil! Kata sandi untuk ${targetUserForPassword.email} telah diubah.`);
        setIsPasswordModalOpen(false);
        fetchAllOperasionalData();
      } else { alert(`Gagal: ${json.message}`); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmittingPassword(false); }
  };

  const getFormattedName = (exp: ExpertItem) => {
    const gDepan = String(exp.gelar_depan || exp.gelardepan || '').trim() ? `${String(exp.gelar_depan || exp.gelardepan).trim()} ` : '';
    const nameOnly = String(exp.expert_name || exp.expertname || exp.nama || exp.name || 'Pakar').trim();
    if (nameOnly === '-') return '';
    const gBelakang = String(exp.gelar_belakang || exp.gelarbelakang || '').trim() ? `, ${String(exp.gelar_belakang || exp.gelarbelakang).trim()}` : '';
    return `${gDepan}${nameOnly}${gBelakang}`;
  };

  const handleOpenNoteModal = (exp: ExpertItem) => {
    setTargetExpertForNote(exp);
    const expId = String(exp.expert_id || exp.expertId || exp.id || '');
    setNoteFormIsian({
      needFotoFix: false, needCvFix: false, needKtpFix: false, needDataFix: false,
      formUrl: expId ? `https://ahp.avitech.cloud/expert/update-profile?id=${expId}` : 'https://ahp.avitech.cloud/expert/update-profile',
      customNote: ''
    });
    setIsNoteModalOpen(true);
  };

  const buildNoteText = () => {
    if (!targetExpertForNote) return '';
    const name = getFormattedName(targetExpertForNote);
    let points: string[] = [];
    if (noteFormIsian.needFotoFix) points.push('- Perbaikan / Upload Pas Foto Resmi');
    if (noteFormIsian.needCvFix) points.push('- Perbaikan / Upload Portofolio / CV');
    if (noteFormIsian.needKtpFix) points.push('- Perbaikan / Upload Berkas KTP');
    if (noteFormIsian.needDataFix) points.push('- Pembaruan Kelengkapan Profil Akademik');

    let text = `Yth. ${name}\n\nMohon kesediaan Anda untuk melengkapi data berikut:\n\n`;
    text += points.length > 0 ? points.join('\n') + '\n\n' : '';
    if (noteFormIsian.customNote) text += `Catatan: "${noteFormIsian.customNote}"\n\n`;
    text += `Tautan: ${noteFormIsian.formUrl}`;
    return text;
  };

  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetExpertForNote) return;
    const email = targetExpertForNote.expert_email || targetExpertForNote.expertemail || targetExpertForNote.email;
    if (!email) { alert('Email tidak ditemukan.'); return; }

    try {
      setLoading(true);
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=sendadminnotetoexpert`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sendadminnotetoexpert',
          email, name: getFormattedName(targetExpertForNote),
          subject: '[VERIFIKASI] Kelengkapan Data Pakar', note: buildNoteText(),
          adminName, adminEmail, adminRole
        }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Instruksi berhasil dikirim!'); setIsNoteModalOpen(false); fetchAllOperasionalData(); } 
      else { alert(`Gagal: ${json.message}`); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setLoading(false); }
  };

  // SUBMIT TANGGAPAN DARI MODAL
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) { alert('Pesan balasan kosong.'); return; }
    try {
      setSubmittingReply(true);
      const ticketId = String(selectedTicket.ticket_id || selectedTicket['ID Tiket'] || selectedTicket.id_tiket || selectedTicket.idTiket || selectedTicket.id || selectedTicket[0] || '').trim();
      const payload = {
        action: 'submitconsultationreply',
        ticket_id: ticketId,
        idTiket: ticketId,
        id: ticketId,
        reply_message: replyMessage.trim(),
        jawaban_expert: replyMessage.trim(),
        status: replyStatus,
        new_status: replyStatus,
        adminName,
        adminEmail,
        adminRole
      };
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=submitconsultationreply`, {
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload), 
        redirect: 'follow'
      });
      const json = await res.json().catch(() => ({ success: true }));
      if (json && json.success !== false) { 
        alert('✅ Balasan & Status berhasil disimpan!'); 
        setShowReplyModal(false); 
        fetchAllOperasionalData(); 
      } else { 
        alert('Gagal: ' + (json?.message || 'Terjadi kesalahan')); 
      }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmittingReply(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Maksimal ukuran file 500 KB.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (fieldName === 'imageurl') setProductForm(p => ({ ...p, imageurl: String(reader.result) }));
      else setExpertForm(ex => ({ ...ex, [fieldName]: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAddExpert = () => {
    setEditingExpert(null);
    setExpertForm({ expert_id: '', gelar_depan: '', expert_name: '', gelar_belakang: '', bidang_keahlian: '', asal_instansi: '', pendidikan_terakhir: 'S2 / Magister', durasi_pengalaman: '3 - 5 Tahun', expert_email: '', expert_whatsapp: '', foto_url: '', portofolio_url: '', ktp_url: '', status: 'Aktif', is_public: 'PUBLIK' });
    setIsExpertModalOpen(true);
  };

  const handleOpenEditExpert = (exp: ExpertItem) => {
    setEditingExpert(exp);
    setExpertForm({
      expert_id: String(exp.expert_id || exp.expertId || exp.id || ''), 
      gelar_depan: String(exp.gelar_depan || exp.gelardepan || ''), 
      expert_name: String(exp.expert_name || exp.expertname || exp.nama || ''), 
      gelar_belakang: String(exp.gelar_belakang || exp.gelarbelakang || ''), 
      bidang_keahlian: String(exp.bidang_keahlian || exp.bidangkeahlian || exp.keahlian || ''), 
      asal_instansi: String(exp.asal_instansi || exp.asalinstansi || exp.instansi || exp.lembaga || ''), 
      pendidikan_terakhir: String(exp.pendidikan_terakhir || exp.pendidikanterakhir || exp.pendidikan || 'S2 / Magister'), 
      durasi_pengalaman: String(exp.durasi_pengalaman || exp.durasipengalaman || exp.pengalaman || '3 - 5 Tahun'),
      expert_email: String(exp.expert_email || exp.expertemail || exp.email || ''), 
      expert_whatsapp: String(exp.expert_whatsapp || exp.expertwhatsapp || exp.whatsapp || ''),
      foto_url: String(exp.foto_url || exp.foto || ''), 
      portofolio_url: String(exp.portofolio_url || exp.portofolio || exp.cv || ''), 
      ktp_url: String(exp.ktp_url || exp.ktp || ''),
      status: String(exp.status || 'Aktif'), 
      is_public: String(exp.is_public || exp.ispublic || 'PUBLIK')
    });
    setIsExpertModalOpen(true);
  };

  const handleSaveExpertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingExpert(true);
      const payload = { action: 'saveexpert', source: 'admin_dashboard', ...expertForm, adminName, adminEmail, adminRole };
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=saveexpert`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify(payload), 
        redirect: 'follow' 
      });
      const json = await res.json();
      if (json.success) { alert('Pakar disimpan!'); setIsExpertModalOpen(false); fetchAllOperasionalData(); } else { alert(`Gagal: ${json.message}`); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmittingExpert(false); }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null); 
    setProductForm({ id: '', nama: '', deskripsi: '', status: 'Tersedia', kategori: 'Modul Riset', link: '', imageurl: '' });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: ProductItem) => {
    setEditingProduct(prod);
    setProductForm({ 
      id: String(prod.id || prod.productId || prod.product_id || ''), 
      nama: String(prod.nama || prod.name || ''), 
      deskripsi: String(prod.deskripsi || prod.description || ''), 
      status: String(prod.status || 'Tersedia'), 
      kategori: String(prod.kategori || prod.category || 'Modul Riset'), 
      link: String(prod.link || ''), 
      imageurl: String(prod.imageurl || prod.gambar || '') 
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingProduct(true);
      const actionName = editingProduct ? 'updateproduct' : 'saveproduct';
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=${actionName}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({ action: actionName, ...productForm, adminName, adminEmail, adminRole }),
        redirect: 'follow'
      });
      const json = await res.json();
      if (json.success) { alert('Produk disimpan!'); setIsProductModalOpen(false); fetchAllOperasionalData(); }
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setSubmittingProduct(false); }
  };

  // LOGIKA FILTER PENCARIAN (SEARCH)
  const filteredExperts = useMemo(() => {
    const q = expertSearchQuery.toLowerCase();
    return experts.filter((exp: ExpertItem) => {
      const name = getFormattedName(exp).toLowerCase();
      const bidang = String(exp.bidang_keahlian || exp.bidangkeahlian || exp.keahlian || '').toLowerCase();
      const instansi = String(exp.asal_instansi || exp.asalinstansi || exp.instansi || exp.lembaga || '').toLowerCase();
      return name.includes(q) || bidang.includes(q) || instansi.includes(q);
    });
  }, [experts, expertSearchQuery]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase();
    return usersList.filter((u: UserItem) => {
      const statusUser = String(u.status_user || u.pro_source || '').toUpperCase();
      const userId = String(u.id || u.user_id || '').toUpperCase();
      const isExpertUser = statusUser === 'EXPERT_REWARD' || userId.startsWith('EXP-');
      if (!isExpertUser) return false;
      const nama = String(u.nama || u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return nama.includes(q) || email.includes(q);
    });
  }, [usersList, userSearchQuery]);

  // LOGIKA FILTER KONSULTASI PUBLIK
  const filteredUserConsultations = useMemo(() => {
    const q = consultSearchQuery.toLowerCase();
    return userConsultations.filter((c: any) => {
      const ticketIdStr = String(c.ticket_id || c['ID Tiket'] || c.id_tiket || c.idTiket || c.id || c[0] || '').toLowerCase();
      const userName = String(c.user_name || c['Nama User'] || c.nama_user || c.nama || c[3] || '').toLowerCase();
      const userEmail = String(c.user_email || c['Kontak User'] || c.kontak_user || c.email || c[4] || '').toLowerCase();
      const instansi = String(c.asal_institusi || c['Asal Institusi'] || c.institusi || c[5] || '').toLowerCase();
      const expertEmail = String(c.expert_email || c['Expert Tujuan'] || c.expert_tujuan || c[2] || '').toLowerCase();
      const pertanyaan = String(c.pertanyaan || c['Topik Pesan'] || c.topik_pesan || c.pesan || c[6] || '').toLowerCase();
      const jawaban = String(c.jawaban_expert || c['Isi_Email'] || c.isi_email || c[9] || '').toLowerCase();
      
      const rawStatus = String(c.status || c['Status'] || c[7] || 'Menunggu').toLowerCase().trim();

      const matchesSearch = userName.includes(q) || userEmail.includes(q) || instansi.includes(q) || expertEmail.includes(q) || ticketIdStr.includes(q) || pertanyaan.includes(q) || jawaban.includes(q);
      const matchesStatus = consultStatusFilter === 'ALL' || rawStatus === consultStatusFilter.toLowerCase();
      
      return matchesSearch && matchesStatus;
    });
  }, [userConsultations, consultSearchQuery, consultStatusFilter]);

  // LOGIKA FILTER KONSULTASI ADMIN-PAKAR
  const filteredAdminConsultations = useMemo(() => {
    const q = adminConsultSearchQuery.toLowerCase();
    return adminConsultations.filter((c: any) => {
      const ticketIdStr = String(c.ticket_id || c['ID Tiket'] || c.id_tiket || c.idTiket || c.id || c[0] || '').toLowerCase();
      const adminPengirim = String(c.admin_name || c.adminName || c['Admin Pengirim'] || c.user_name || c[3] || '').toLowerCase();
      const pertanyaan = String(c.pertanyaan || c['Topik Pesan'] || c.topik_pesan || c.pesan || c[6] || '').toLowerCase();
      const jawaban = String(c.jawaban_expert || c['Isi_Email'] || c.isi_email || c[9] || '').toLowerCase();
      const rawStatus = String(c.status || c['Status'] || c[7] || 'Menunggu').toLowerCase().trim();

      const matchesSearch = adminPengirim.includes(q) || ticketIdStr.includes(q) || pertanyaan.includes(q) || jawaban.includes(q);
      const matchesStatus = adminConsultStatusFilter === 'ALL' || rawStatus === adminConsultStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [adminConsultations, adminConsultSearchQuery, adminConsultStatusFilter]);

  const filteredVisitorStats = useMemo(() => {
    const q = visitorSearchQuery.toLowerCase();
    return visitorStatsList.filter(v => {
      const emailUser = String(v.email || v[1] || 'Visitor Umum').toLowerCase();
      const pagePath = String(v.page || v[2] || '/').toLowerCase();
      const ipAddress = String(v.ip_address || v.ip || v[3] || '').toLowerCase();
      return emailUser.includes(q) || pagePath.includes(q) || ipAddress.includes(q);
    });
  }, [visitorStatsList, visitorSearchQuery]);

  const filteredFeedbacks = useMemo(() => {
    const q = feedbackSearchQuery.toLowerCase();
    return feedbacks.filter(fb => {
      const nama = String(fb.nama || fb.Name || fb[1] || '').toLowerCase();
      const email = String(fb.email || fb.Email || fb[2] || '').toLowerCase();
      const pesan = String(fb.pesan || fb.Message || fb[4] || '').toLowerCase();
      return nama.includes(q) || email.includes(q) || pesan.includes(q);
    });
  }, [feedbacks, feedbackSearchQuery]);

  const visitorAnalytics = useMemo(() => {
    let generalVisitors = 0; let registeredUsers = 0; let adminVisits = 0; let anomalies = 0;
    const pageCounts: Record<string, number> = {};
    const dateCounts: Record<string, { user: number, guest: number, admin: number, anomaly: number }> = {};

    visitorStatsList.forEach((v) => {
      const emailUser = String(v.email || v[1] || 'Visitor Umum').trim();
      const pagePath = String(v.page || v[2] || '/').trim();
      const explicitRole = String(v.role || v[4] || '').trim().toLowerCase();
      const rawDate = v.timestamp || v[0];

      const isSuspiciousPath = pagePath.includes('.env') || pagePath.includes('wp-admin') || pagePath.includes('sql');
      const isUnauthorizedAdminAccess = pagePath.includes('/admin') && emailUser !== 'Visitor Umum' && !emailUser.toLowerCase().includes('admin');
      const isExplicitAnomaly = explicitRole === 'hacker' || explicitRole === 'blocked';

      let category: 'user' | 'guest' | 'admin' | 'anomaly' = 'guest';

      if (isSuspiciousPath || isUnauthorizedAdminAccess || isExplicitAnomaly) {
        category = 'anomaly';
        anomalies += 1;
      } else if (emailUser.toLowerCase().includes('admin') || explicitRole.includes('admin')) {
        category = 'admin';
        adminVisits += 1;
      } else if (emailUser !== 'Visitor Umum' && emailUser !== '') {
        category = 'user';
        registeredUsers += 1;
      } else {
        category = 'guest';
        generalVisitors += 1;
      }

      pageCounts[pagePath] = (pageCounts[pagePath] || 0) + 1;

      if (rawDate) {
        const dateKey = new Date(rawDate).toISOString().split('T')[0];
        if (!dateCounts[dateKey]) dateCounts[dateKey] = { user: 0, guest: 0, admin: 0, anomaly: 0 };
        dateCounts[dateKey][category] += 1;
      }
    });

    const sortedPages = Object.entries(pageCounts).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count);
    const sortedDates = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));

    return { 
      generalVisitors, 
      registeredUsers, 
      adminVisits,
      anomalies,
      topPages: sortedPages,
      trendData: {
        labels: sortedDates.map(item => item[0]),
        datasets: [
          {
            label: 'User Terdaftar',
            data: sortedDates.map(item => item[1].user),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.3, fill: true, pointRadius: 3
          },
          {
            label: 'Pengunjung Umum',
            data: sortedDates.map(item => item[1].guest),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            tension: 0.3, fill: true, pointRadius: 3
          },
          {
            label: 'Super Admin & Admin',
            data: sortedDates.map(item => item[1].admin),
            borderColor: '#9333ea',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            tension: 0.3, fill: true, pointRadius: 3
          },
          {
            label: 'Anomali / Ilegal',
            data: sortedDates.map(item => item[1].anomaly),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.3, fill: true, pointRadius: 3
          }
        ]
      }
    };
  }, [visitorStatsList]);

  const feedbackSentimentAnalytics = useMemo(() => {
    let positive = 0; let neutral = 0; let negative = 0;
    const sentimentDateCounts: Record<string, { pos: number, neu: number, neg: number }> = {};

    feedbacks.forEach((fb) => {
      const rawSent = String(fb.sentiment || fb.sentimen || fb.Sentiment || '').toUpperCase().trim();
      const text = String(fb.pesan || fb.message || '').toLowerCase();
      const rawDate = fb.timestamp || fb.Timestamp || fb[0];

      let currentType = 'neu';
      if (rawSent.includes('POS') || text.includes('bagus') || text.includes('mantap')) {
        positive += 1;
        currentType = 'pos';
      } else if (rawSent.includes('NEG') || text.includes('kecewa') || text.includes('error')) {
        negative += 1;
        currentType = 'neg';
      } else {
        neutral += 1;
        currentType = 'neu';
      }

      if (rawDate) {
        const dateKey = new Date(rawDate).toISOString().split('T')[0];
        if (!sentimentDateCounts[dateKey]) {
          sentimentDateCounts[dateKey] = { pos: 0, neu: 0, neg: 0 };
        }
        sentimentDateCounts[dateKey][currentType] += 1;
      }
    });

    const total = feedbacks.length;
    const sortedSentimentDates = Object.entries(sentimentDateCounts).sort((a, b) => a[0].localeCompare(b[0]));

    return {
      total, positive, neutral, negative,
      posPercent: total > 0 ? Math.round((positive / total) * 100) : 0,
      neuPercent: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negPercent: total > 0 ? Math.round((negative / total) * 100) : 0,
      trendData: {
        labels: sortedSentimentDates.map(item => item[0]),
        datasets: [
          {
            label: 'Positif',
            data: sortedSentimentDates.map(item => item[1].pos),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Netral',
            data: sortedSentimentDates.map(item => item[1].neu),
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            tension: 0.3,
            fill: false
          },
          {
            label: 'Negatif',
            data: sortedSentimentDates.map(item => item[1].neg),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            tension: 0.3,
            fill: false
          }
        ]
      }
    };
  }, [feedbacks]);

  const getItemSentimentLabel = (fb: any) => {
    const rawSent = String(fb.sentiment || fb.sentimen || '').toUpperCase().trim();
    if (rawSent.includes('POS')) return { label: '🟢 POSITIF', style: STYLES.badgeActive };
    if (rawSent.includes('NEG')) return { label: '🔴 NEGATIF', style: { ...STYLES.badgePending, background: '#fef2f2', color: '#dc2626' } };
    return { label: '🟡 NETRAL', style: STYLES.badgePending };
  };

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <div>
          <h2 style={STYLES.headerTitle}>Panel Dashboard Operasional Admin</h2>
          <p style={STYLES.headerSubtitle}>Operator: <strong>{adminName}</strong> ({adminRole})</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isSuperAdmin && (
            <>
              <button onClick={() => router.push('/admin/archives')} style={{ ...STYLES.btnAdd, background: '#0284c7' }}>
                📦 Repositori Arsip
              </button>
              <button onClick={() => router.push('/admin/super-control')} style={{ ...STYLES.btnAdd, background: '#4f46e5' }}>
                🛡️ Panel SuperAdmin
              </button>
            </>
          )}
          <button onClick={() => { localStorage.clear(); router.replace('/admin/login'); }} style={STYLES.btnLogout}>Keluar</button>
        </div>
      </header>

      <div style={STYLES.container}>
        <div style={STYLES.tabsRow}>
          {canAccessTab('expert_directory') && <button onClick={() => setActiveTab('expert_directory')} style={activeTab === 'expert_directory' ? STYLES.tabActive : STYLES.tabInactive}>Direktori Pakar ({experts.length})</button>}
          {canAccessTab('users') && <button onClick={() => setActiveTab('users')} style={activeTab === 'users' ? STYLES.tabActive : STYLES.tabInactive}>Manajemen User Pakar ({filteredUsers.length})</button>}
          {canAccessTab('products') && <button onClick={() => setActiveTab('products')} style={activeTab === 'products' ? STYLES.tabActive : STYLES.tabInactive}>Produk Platform ({products.length})</button>}
          {canAccessTab('consultation_user') && <button onClick={() => setActiveTab('consultation_user')} style={activeTab === 'consultation_user' ? STYLES.tabActive : STYLES.tabInactive}>Konsultasi Publik ({userConsultations.length})</button>}
          {canAccessTab('consultation_admin') && <button onClick={() => setActiveTab('consultation_admin')} style={activeTab === 'consultation_admin' ? STYLES.tabActive : STYLES.tabInactive}>Konsultasi Admin-Pakar ({adminConsultations.length})</button>}
          {canAccessTab('visitor_stats') && <button onClick={() => setActiveTab('visitor_stats')} style={activeTab === 'visitor_stats' ? STYLES.tabActive : STYLES.tabInactive}>Statistik Kunjungan</button>}
          {canAccessTab('feedback') && <button onClick={() => setActiveTab('feedback')} style={activeTab === 'feedback' ? STYLES.tabActive : STYLES.tabInactive}>Masukan ({feedbacks.length})</button>}
          {canAccessTab('sop_guide') && <button onClick={() => setActiveTab('sop_guide')} style={activeTab === 'sop_guide' ? STYLES.tabActive : STYLES.tabInactive}>📖 SOP</button>}
        </div>

        {apiError && <div style={STYLES.errorBox}>{apiError}</div>}

        <div style={STYLES.contentCard}>
          
          {/* TAB 1: EXPERT DIRECTORY */}
          {activeTab === 'expert_directory' && canAccessTab('expert_directory') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Direktori Pakar &amp; Tenaga Ahli ({filteredExperts.length})</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleOpenAddExpert} style={STYLES.btnAdd}>+ Tambah Pakar Baru</button>
                  <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
                </div>
              </div>
              <input type="text" placeholder="Cari pakar berdasarkan nama, bidang, atau instansi..." value={expertSearchQuery} onChange={e => setExpertSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 350, marginBottom: 14 }} />
              
              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={{ ...STYLES.th, width: 50, textAlign: 'center' }}>Foto</th>
                      <th style={STYLES.th}>Nama Pakar</th>
                      <th style={STYLES.th}>Keahlian &amp; Instansi</th>
                      <th style={STYLES.th}>Berkas</th>
                      <th style={STYLES.th}>Status &amp; Visibilitas</th>
                      <th style={{ ...STYLES.th, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExperts.map((exp: ExpertItem, i: number) => {
                      const photoSrc = exp.foto_url || exp.foto;
                      const keahlian = exp.bidang_keahlian || exp.bidangkeahlian || exp.keahlian || '-';
                      const instansi = exp.asal_instansi || exp.asalinstansi || exp.instansi || exp.lembaga || '-';
                      const emailExp = exp.expert_email || exp.expertemail || exp.email || '-';
                      
                      const ktp = exp.ktp_url || exp.ktp;
                      const portofolio = exp.portofolio_url || exp.portofolio || exp.cv;

                      const statusPakar = exp.status || 'Aktif';
                      const isPublic = exp.is_public || exp.ispublic || 'PRIVAT';

                      return (
                        <tr key={i}>
                          <td style={{ ...STYLES.td, textAlign: 'center' }}>
                            {photoSrc ? (
                              <img src={photoSrc} alt="Pakar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid #e2e8f0', margin: '0 auto' }}>👤</div>
                            )}
                          </td>
                          <td style={STYLES.td}>
                            <strong>{getFormattedName(exp)}</strong>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{emailExp}</div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{keahlian}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>🏢 {instansi}</div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {ktp ? <a href={ktp} target="_blank" rel="noreferrer" style={STYLES.linkBadge}>🪪 KTP</a> : <span style={STYLES.missingBadge}>KTP ❌</span>}
                              {portofolio ? <a href={portofolio} target="_blank" rel="noreferrer" style={STYLES.linkBadge}>📁 CV</a> : <span style={STYLES.missingBadge}>CV ❌</span>}
                            </div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ marginBottom: 4 }}>
                              <span style={statusPakar.toLowerCase() === 'aktif' ? STYLES.badgeActive : STYLES.badgePending}>{statusPakar.toUpperCase()}</span>
                            </div>
                            <div>
                              <span style={isPublic.toUpperCase() === 'PUBLIK' ? STYLES.badgeActive : STYLES.badgePending}>{isPublic.toUpperCase()}</span>
                            </div>
                          </td>
                          <td style={{ ...STYLES.td, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button onClick={() => handleOpenNoteModal(exp)} style={STYLES.btnNote}>Kirim Link</button>
                              <button onClick={() => handleOpenEditExpert(exp)} style={STYLES.btnEdit}>Edit</button>
                              {isSuperAdmin && (
                                <button onClick={() => handleDeleteExpert(exp)} style={STYLES.btnDelete}>Hapus</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MANAJEMEN USER PAKAR */}
          {activeTab === 'users' && canAccessTab('users') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Manajemen Akun User Pakar ({filteredUsers.length})</h3>
                <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
              </div>
              <input type="text" placeholder="Cari akun berdasarkan nama atau email..." value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 350, marginBottom: 14 }} />
              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>Nama</th>
                      <th style={STYLES.th}>Email</th>
                      <th style={STYLES.th}>Plan Aktif</th>
                      <th style={STYLES.th}>Ubah Plan &amp; Kontrol Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((usr: UserItem, i: number) => {
                      const currentPlan = String(usr.plan || 'PRO').toUpperCase();
                      return (
                        <tr key={i}>
                          <td style={STYLES.td}><strong>{usr.nama || usr.name}</strong></td>
                          <td style={STYLES.td}>{usr.email}</td>
                          <td style={STYLES.td}><span style={STYLES.badgeActive}>{currentPlan}</span></td>
                          <td style={STYLES.td}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <select 
                                defaultValue={currentPlan}
                                onChange={(e) => handleUpdateExpertPlan(String(usr.email), e.target.value)}
                                style={{ ...STYLES.input, width: 130, padding: 6, fontWeight: 700, fontSize: 12 }}
                              >
                                <option value="PRO">PRO</option>
                                <option value="PLUS">PLUS</option>
                                <option value="PREMIUM">PREMIUM</option>
                              </select>
                              <button onClick={() => handleOpenPasswordModal(usr)} style={{ ...STYLES.btnEdit, background: '#f8fafc', border: '1px solid #cbd5e1' }}>🔑 Sandi</button>
                              {isSuperAdmin && (
                                <button onClick={() => handleDeleteUser(usr)} style={STYLES.btnDelete}>Hapus</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUK */}
          {activeTab === 'products' && canAccessTab('products') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Produk Platform</h3>
                <button onClick={handleOpenAddProduct} style={STYLES.btnAdd}>+ Tambah Produk</button>
              </div>
              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={{ ...STYLES.th, width: 60, textAlign: 'center' }}>Gambar</th>
                      <th style={STYLES.th}>Nama Produk</th>
                      <th style={STYLES.th}>Deskripsi</th>
                      <th style={STYLES.th}>Kategori &amp; Status</th>
                      <th style={STYLES.th}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const imgSrc = p.imageurl || p.gambar;
                      const desc = p.deskripsi || p.description || '-';
                      return (
                        <tr key={i}>
                          <td style={{ ...STYLES.td, textAlign: 'center' }}>
                            {imgSrc ? (
                              <img src={imgSrc} alt="Produk" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                            ) : (
                              <div style={{ width: 50, height: 50, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '1px solid #e2e8f0', margin: '0 auto' }}>📦</div>
                            )}
                          </td>
                          <td style={STYLES.td}><strong>{p.nama || p.name}</strong></td>
                          <td style={STYLES.td}>
                            <div style={{ maxWidth: 280, fontSize: 11.5, color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {desc}
                            </div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: '#64748b' }}>{p.kategori || p.category}</div>
                            <span style={STYLES.badgeActive}>{p.status}</span>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleOpenEditProduct(p)} style={STYLES.btnEdit}>Edit</button>
                              {isSuperAdmin && (
                                <button onClick={() => handleDeleteProduct(p)} style={STYLES.btnDelete}>Hapus</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: KONSULTASI PUBLIK */}
          {activeTab === 'consultation_user' && canAccessTab('consultation_user') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Pusat Konsultasi Publik (User - Pakar)</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isSuperAdmin && selectedConsultations.length > 0 && (
                    <button onClick={handleDeleteBulkConsultations} style={{ ...STYLES.btnDelete, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      🗑️ Hapus Terpilih ({selectedConsultations.length})
                    </button>
                  )}
                  <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <input type="text" placeholder="Cari nama, email, pertanyaan, atau ID Tiket..." value={consultSearchQuery} onChange={e => setConsultSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 320 }} />
                <select value={consultStatusFilter} onChange={e => setConsultStatusFilter(e.target.value)} style={{ ...STYLES.input, maxWidth: 200 }}>
                  <option value="ALL">Semua Status</option>
                  <option value="Menunggu">⏳ Menunggu</option>
                  <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
                  <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
                  <option value="Selesai">✅ Selesai</option>
                  <option value="Ditolak">❌ Ditolak</option>
                </select>
              </div>

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      {isSuperAdmin && (
                        <th style={{ ...STYLES.th, width: 40, textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              const allIds = filteredUserConsultations.map(c => String(c.ticket_id || c['ID Tiket'] || c.id_tiket || c.idTiket || c.id || c[0] || ''));
                              setSelectedConsultations(e.target.checked ? allIds : []);
                            }}
                            checked={selectedConsultations.length === filteredUserConsultations.length && filteredUserConsultations.length > 0}
                          />
                        </th>
                      )}
                      <th style={{ ...STYLES.th, width: 130 }}>Tanggal Dibuat</th>
                      <th style={{ ...STYLES.th, width: 100 }}>ID Tiket</th>
                      <th style={{ ...STYLES.th, width: 220 }}>Pemohon &amp; Pakar</th>
                      <th style={STYLES.th}>Rincian Pertanyaan &amp; Jawaban</th>
                      <th style={{ ...STYLES.th, width: 130 }}>Status Tiket</th>
                      <th style={{ ...STYLES.th, width: 140, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUserConsultations.map((c, i) => {
                      const ticketId = String(c.ticket_id || c['ID Tiket'] || c.id_tiket || c.idTiket || c.id || c[0] || i);
                      const userName = c.user_name || c['Nama User'] || c.nama_user || c[3] || 'Pemohon';
                      const userEmail = c.user_email || c['Kontak User'] || c.email || c[4] || '';
                      const asalInstitusi = c.asal_institusi || c['Asal Institusi'] || c.institusi || c[5] || '';
                      const expertEmail = c.expert_email || c['Expert Tujuan'] || c.expert_tujuan || c[2] || '';
                      const expertId = c.expert_id || c[1] || '';

                      const pertanyaanUser = c.pertanyaan || c['Topik Pesan'] || c.topik_pesan || c.pesan || c[6] || '-';
                      const jawabanExpert = c.jawaban_expert || c['Isi_Email'] || c.isi_email || c[9] || '';
                      const lampiranUrl = c.lampiran || c['Lampiran'] || c.fileUrl || c[10] || '';
                      const status = c.status || c['Status'] || c[7] || 'Menunggu';
                      
                      const rawDate = c.created_at || c['Tanggal Dibuat'] || c.tanggal_dibuat || c.timestamp || c[8] || c[0];
                      const dateStr = formatDisplayDate(rawDate);
                      
                      return (
                        <tr key={i}>
                          {isSuperAdmin && (
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedConsultations.includes(ticketId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedConsultations([...selectedConsultations, ticketId]);
                                  } else {
                                    setSelectedConsultations(selectedConsultations.filter(id => id !== ticketId));
                                  }
                                }}
                              />
                            </td>
                          )}
                          <td style={STYLES.td}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>📅 {dateStr}</div>
                          </td>
                          <td style={STYLES.td}>
                            <span style={STYLES.idTag}>#{ticketId}</span>
                          </td>
                          <td style={STYLES.td}>
                            <div>
                              <strong style={{ color: '#0f172a', fontSize: 13.5 }}>👤 {userName}</strong>
                              {asalInstitusi && <div style={{ fontSize: 11, color: '#64748b' }}>🏢 {asalInstitusi}</div>}
                              {userEmail && <div style={{ fontSize: 11, color: '#475569' }}>✉️ {userEmail}</div>}
                            </div>
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0', fontSize: 11.5 }}>
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>🎓 Target: </span>
                              <span style={{ color: '#334155' }}>{expertEmail || expertId || 'Umum'}</span>
                            </div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ background: '#f8fafc', borderLeft: '4px solid #2563eb', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                                  💬 Pertanyaan User:
                                </div>
                                <div style={{ fontSize: 12.5, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                                  {pertanyaanUser}
                                </div>
                                {lampiranUrl && (
                                  <div style={{ marginTop: 6 }}>
                                    <a href={lampiranUrl} target="_blank" rel="noreferrer" style={STYLES.linkBadge}>
                                      📎 Lihat Berkas Lampiran
                                    </a>
                                  </div>
                                )}
                              </div>
                              <div style={{ background: jawabanExpert ? '#f0fdf4' : '#fffbeb', borderLeft: `4px solid ${jawabanExpert ? '#16a34a' : '#f59e0b'}`, padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: jawabanExpert ? '#166534' : '#b45309', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                                  {jawabanExpert ? '✅ Tanggapan / Balasan:' : '⏳ Status Jawaban:'}
                                </div>
                                <div style={{ fontSize: 12.5, color: jawabanExpert ? '#14532d' : '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.45, fontStyle: jawabanExpert ? 'normal' : 'italic' }}>
                                  {jawabanExpert || 'Belum ada tanggapan atau balasan yang dikirimkan.'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={STYLES.td}>
                            <select
                              value={status || 'Menunggu'}
                              onChange={(e) => handleUpdateStatus(ticketId, e.target.value)}
                              style={{
                                ...STYLES.statusSelect,
                                background:
                                  status === 'Selesai' ? '#dcfce7' :
                                  status === 'Sedang Diverifikasi' ? '#e0e7ff' :
                                  status === 'Diteruskan ke Pakar' ? '#dbeafe' :
                                  status === 'Ditolak' ? '#fee2e2' : '#fef9c3',
                                color:
                                  status === 'Selesai' ? '#166534' :
                                  status === 'Sedang Diverifikasi' ? '#3730a3' :
                                  status === 'Diteruskan ke Pakar' ? '#1e40af' :
                                  status === 'Ditolak' ? '#991b1b' : '#854d0e'
                              }}
                            >
                              <option value="Menunggu">⏳ Menunggu</option>
                              <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
                              <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
                              <option value="Selesai">✅ Selesai</option>
                              <option value="Ditolak">❌ Ditolak</option>
                            </select>
                          </td>
                          <td style={{ ...STYLES.td, textAlign: 'center' }}>
                            <button 
                              onClick={() => handleOpenReplyModal(c)} 
                              style={{ ...STYLES.btnEdit, background: '#2563eb', color: '#fff', padding: '6px 12px', width: '100%', whiteSpace: 'nowrap' }}
                            >
                              ✍️ Jawab Tiket
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: KONSULTASI ADMIN - PAKAR */}
          {activeTab === 'consultation_admin' && canAccessTab('consultation_admin') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Pusat Konsultasi Admin &amp; Pakar ({filteredAdminConsultations.length})</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isSuperAdmin && selectedAdminConsultations.length > 0 && (
                    <button onClick={handleDeleteBulkAdminConsultations} style={{ ...STYLES.btnDelete, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      🗑️ Hapus Terpilih ({selectedAdminConsultations.length})
                    </button>
                  )}
                  <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input type="text" placeholder="Cari pengirim, topik, atau ID Tiket..." value={adminConsultSearchQuery} onChange={e => setAdminConsultSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 320 }} />
                <select value={adminConsultStatusFilter} onChange={e => setAdminConsultStatusFilter(e.target.value)} style={{ ...STYLES.input, maxWidth: 200 }}>
                  <option value="ALL">Semua Status</option>
                  <option value="Menunggu">⏳ Menunggu</option>
                  <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
                  <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
                  <option value="Selesai">✅ Selesai</option>
                  <option value="Ditolak">❌ Ditolak</option>
                </select>
              </div>

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      {isSuperAdmin && (
                        <th style={{ ...STYLES.th, width: 40, textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              const allIds = filteredAdminConsultations.map(c => String(c.ticket_id || c['ID Tiket'] || c.id_tiket || c.idTiket || c.id || c[0] || ''));
                              setSelectedAdminConsultations(e.target.checked ? allIds : []);
                            }}
                            checked={selectedAdminConsultations.length === filteredAdminConsultations.length && filteredAdminConsultations.length > 0}
                          />
                        </th>
                      )}
                      <th style={{ ...STYLES.th, width: 130 }}>Tanggal</th>
                      <th style={{ ...STYLES.th, width: 100 }}>ID Tiket</th>
                      <th style={{ ...STYLES.th, width: 220 }}>Admin &amp; Pakar</th>
                      <th style={STYLES.th}>Rincian Pesan &amp; Tanggapan</th>
                      <th style={{ ...STYLES.th, width: 130 }}>Status</th>
                      <th style={{ ...STYLES.th, width: 140, textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminConsultations.map((item: any, i: number) => {
                      const ticketId = String(item.ticket_id || item['ID Tiket'] || item.id_tiket || item.idTiket || item.id || item[0] || i);
                      const adminPengirim = item.admin_name || item.adminName || item.user_name || item['Nama User'] || adminName || 'Admin Operator';
                      const expertTujuan = item.expert_email || item['Expert Tujuan'] || item.pakar_email || 'Pakar Terkait';
                      
                      const pesanPertanyaan = item.pertanyaan || item.pesan || item['Topik Pesan'] || item[6] || '-';
                      const jawabanAdmin = item.jawaban_expert || item.jawaban_admin || item.isi_email || item['Isi_Email'] || item[9] || '';
                      const status = item.status || item['Status'] || item[7] || 'Menunggu';
                      
                      const rawDate = item.created_at || item['Tanggal Dibuat'] || item.timestamp || item[8] || item[0];
                      const dateStr = formatDisplayDate(rawDate);
                      
                      return (
                        <tr key={i}>
                          {isSuperAdmin && (
                            <td style={{ ...STYLES.td, textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedAdminConsultations.includes(ticketId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAdminConsultations([...selectedAdminConsultations, ticketId]);
                                  } else {
                                    setSelectedAdminConsultations(selectedAdminConsultations.filter(id => id !== ticketId));
                                  }
                                }}
                              />
                            </td>
                          )}
                          <td style={STYLES.td}>📅 {dateStr}</td>
                          <td style={STYLES.td}><span style={STYLES.idTag}>#{ticketId}</span></td>
                          <td style={STYLES.td}>
                            <div><strong>👤 {adminPengirim}</strong></div>
                            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>🎯 Pakar: {expertTujuan}</div>
                          </td>
                          <td style={STYLES.td}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ background: '#f8fafc', padding: 8, borderRadius: 4, borderLeft: '3px solid #64748b', fontSize: 12 }}>
                                <strong>Topik/Pertanyaan:</strong> {pesanPertanyaan}
                              </div>
                              {jawabanAdmin && (
                                <div style={{ background: '#f0fdf4', padding: 8, borderRadius: 4, borderLeft: '3px solid #16a34a', fontSize: 12, color: '#14532d' }}>
                                  <strong>Tanggapan:</strong> {jawabanAdmin}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={STYLES.td}>
                            <select
                              value={status || 'Menunggu'}
                              onChange={(e) => handleUpdateStatus(ticketId, e.target.value)}
                              style={{
                                ...STYLES.statusSelect,
                                background:
                                  status === 'Selesai' ? '#dcfce7' :
                                  status === 'Sedang Diverifikasi' ? '#e0e7ff' :
                                  status === 'Diteruskan ke Pakar' ? '#dbeafe' :
                                  status === 'Ditolak' ? '#fee2e2' : '#fef9c3',
                                color:
                                  status === 'Selesai' ? '#166534' :
                                  status === 'Sedang Diverifikasi' ? '#3730a3' :
                                  status === 'Diteruskan ke Pakar' ? '#1e40af' :
                                  status === 'Ditolak' ? '#991b1b' : '#854d0e'
                              }}
                            >
                              <option value="Menunggu">⏳ Menunggu</option>
                              <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
                              <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
                              <option value="Selesai">✅ Selesai</option>
                              <option value="Ditolak">❌ Ditolak</option>
                            </select>
                          </td>
                          <td style={{ ...STYLES.td, textAlign: 'center' }}>
                            <button 
                              onClick={() => handleOpenReplyModal(item)} 
                              style={{ ...STYLES.btnEdit, background: '#2563eb', color: '#fff', padding: '6px 12px', width: '100%' }}
                            >
                              ✍️ Jawab Tiket
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: STATISTIK KUNJUNGAN (DENGAN KOLOM IP ADDRESS) */}
          {activeTab === 'visitor_stats' && canAccessTab('visitor_stats') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Statistik Kunjungan Pengguna</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isSuperAdmin && (
                    <button onClick={handleDeleteVisitorLogs} disabled={selectedLogs.length === 0} style={{ ...STYLES.btnCancel, background: selectedLogs.length > 0 ? '#fef2f2' : '#f1f5f9', color: selectedLogs.length > 0 ? '#dc2626' : '#94a3b8', borderColor: selectedLogs.length > 0 ? '#fecaca' : '#cbd5e1' }}>
                      🗑️ Hapus Log Terpilih ({selectedLogs.length})
                    </button>
                  )}
                  <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Total Kunjungan</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a8a', marginTop: 4 }}>{totalPublicVisits}</div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Pengunjung Umum</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#14532d', marginTop: 4 }}>{visitorAnalytics.generalVisitors}</div>
                </div>
                <div style={{ background: '#fdf4ff', border: '1px solid #fbcfe8', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#86198f', fontWeight: 600 }}>User Terdaftar</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#701a75', marginTop: 4 }}>{visitorAnalytics.registeredUsers}</div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>Admin &amp; Anomali</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#7f1d1d', marginTop: 4 }}>{visitorAnalytics.adminVisits + visitorAnalytics.anomalies}</div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, color: '#0f172a' }}>📈 Tren Kunjungan Harian (Berdasarkan Role)</h4>
                <div style={{ height: 300, position: 'relative' }}>
                  {visitorAnalytics.trendData.labels.length > 0 ? (
                    <Line 
                      data={visitorAnalytics.trendData} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true, position: 'top' } },
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                      }} 
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#64748b' }}>
                      Belum ada cukup data waktu untuk menampilkan grafik tren.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div>
                  <h4 style={{ marginBottom: 10, fontSize: 14 }}>Daftar Log Terakhir</h4>
                  <input type="text" placeholder="Cari pengguna, IP, atau alamat halaman..." value={visitorSearchQuery} onChange={e => setVisitorSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 350, marginBottom: 14 }} />
                  <div style={STYLES.tableWrap}>
                    <table style={STYLES.table}>
                      <thead>
                        <tr>
                          {isSuperAdmin && (
                            <th style={{ ...STYLES.th, width: 40, textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                onChange={e => {
                                  const visibleRows = filteredVisitorStats.map(v => visitorStatsList.indexOf(v) + 2).filter(x => x > 1);
                                  setSelectedLogs(e.target.checked ? visibleRows : []);
                                }} 
                                checked={selectedLogs.length > 0 && filteredVisitorStats.every(v => selectedLogs.includes(visitorStatsList.indexOf(v) + 2))} 
                              />
                            </th>
                          )}
                          <th style={STYLES.th}>Waktu</th>
                          <th style={STYLES.th}>Pengguna (Email)</th>
                          <th style={STYLES.th}>Alamat IP</th>
                          <th style={STYLES.th}>Halaman</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVisitorStats.slice(0, 50).map((v, i) => {
                          const originalIndex = visitorStatsList.indexOf(v);
                          const rowNum = originalIndex !== -1 ? originalIndex + 2 : -1;
                          const ipAddress = v.ip_address || v.ip || v[3] || 'Unknown';

                          return (
                            <tr key={i}>
                              {isSuperAdmin && (
                                <td style={{ ...STYLES.td, textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedLogs.includes(rowNum)} 
                                    onChange={e => { 
                                      if(rowNum === -1) return;
                                      setSelectedLogs(prev => e.target.checked ? [...prev, rowNum] : prev.filter(x => x !== rowNum)); 
                                    }} 
                                  />
                                </td>
                              )}
                              <td style={STYLES.td}>{v.timestamp || v[0] ? new Date(v.timestamp || v[0]).toLocaleString('id-ID') : '-'}</td>
                              <td style={STYLES.td}>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.email || v[1] || 'Visitor Umum'}</div>
                              </td>
                              <td style={STYLES.td}>
                                <span style={STYLES.ipBadge}>{ipAddress}</span>
                              </td>
                              <td style={STYLES.td}>
                                <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                                  {v.page || v[2] || '/'}
                                </code>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: 10, fontSize: 14 }}>Halaman Paling Sering Dikunjungi</h4>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                    {visitorAnalytics.topPages.slice(0, 8).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 12.5, color: '#334155', wordBreak: 'break-all' }}>{p.page}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{p.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: FEEDBACK / MASUKAN */}
          {activeTab === 'feedback' && canAccessTab('feedback') && (
            <div>
              <div style={STYLES.cardTitleRow}>
                <h3>Umpan Balik Pengguna</h3>
                <button onClick={fetchAllOperasionalData} style={STYLES.btnRefresh}>Muat Ulang</button>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Masukan</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{feedbackSentimentAnalytics.total}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>🟢 {feedbackSentimentAnalytics.posPercent}% Positif</div>
                    <div style={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>🟡 {feedbackSentimentAnalytics.neuPercent}% Netral</div>
                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>🔴 {feedbackSentimentAnalytics.negPercent}% Negatif</div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: 14, color: '#0f172a' }}>📊 Tren Analisis Sentimen Masukan Berdasarkan Waktu</h4>
                <div style={{ height: 260, position: 'relative' }}>
                  {feedbackSentimentAnalytics.trendData.labels.length > 0 ? (
                    <Line 
                      data={feedbackSentimentAnalytics.trendData} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' as const } },
                        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                      }} 
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#64748b' }}>
                      Belum ada cukup data waktu untuk menampilkan grafik sentimen.
                    </div>
                  )}
                </div>
              </div>

              <input type="text" placeholder="Cari pesan umpan balik atau nama pengirim..." value={feedbackSearchQuery} onChange={e => setFeedbackSearchQuery(e.target.value)} style={{ ...STYLES.input, maxWidth: 350, marginBottom: 14 }} />

              <div style={STYLES.tableWrap}>
                <table style={STYLES.table}>
                  <thead>
                    <tr>
                      <th style={STYLES.th}>Tanggal</th>
                      <th style={STYLES.th}>Pengirim</th>
                      <th style={STYLES.th}>Sentimen</th>
                      <th style={STYLES.th}>Pesan</th>
                      <th style={STYLES.th}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedbacks.map((fb, i) => {
                      const sentiment = getItemSentimentLabel(fb);
                      return (
                        <tr key={i}>
                          <td style={STYLES.td}>{fb.timestamp || fb.Timestamp || fb[0] ? new Date(fb.timestamp || fb.Timestamp || fb[0]).toLocaleDateString('id-ID') : '-'}</td>
                          <td style={STYLES.td}>
                            <strong>{fb.nama || fb.Name || fb[1] || 'Anonim'}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{fb.email || fb.Email || fb[2] || '-'}</div>
                          </td>
                          <td style={STYLES.td}><span style={sentiment.style}>{sentiment.label}</span></td>
                          <td style={STYLES.td}>
                            <div style={{ fontSize: 12.5, color: '#334155', maxWidth: 400 }}>{fb.pesan || fb.Message || fb[4] || '-'}</div>
                          </td>
                          <td style={STYLES.td}>
                            {isSuperAdmin && (
                              <button onClick={() => handleDeleteFeedback(fb)} style={STYLES.btnDelete}>Hapus</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: SOP & PANDUAN */}
          {activeTab === 'sop_guide' && (
            <div>
              <h3>SOP &amp; Panduan Operasional</h3>
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
                Selamat datang di Panduan Operasional Admin. Pastikan Anda berhati-hati dalam mengubah data, terutama data Pakar dan Konsultasi.
              </p>

              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a', fontSize: 14 }}>1. Manajemen Direktori Pakar</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    <li>Pakar yang diatur ke status <strong>PRIVAT</strong> tidak akan terlihat di halaman publik pencarian pakar.</li>
                    <li>Gunakan fitur <strong>Kirim Link</strong> untuk meminta pakar memperbarui profil mereka secara mandiri (melalui form publik).</li>
                    <li>Pakar baru yang ditambahkan secara manual di sini otomatis akan terdaftar dan mendapatkan akses sistem.</li>
                  </ul>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a', fontSize: 14 }}>2. Manajemen Akun User (Plan)</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    <li>Tab ini berisikan seluruh user yang telah mendaftar di platform.</li>
                    <li>Gunakan <strong>Ubah Plan</strong> untuk memberikan akses fitur secara gratis (sebagai <i>reward</i>) ke Pakar atau untuk kebutuhan aktivasi layanan pelanggan.</li>
                    <li>Fitur <strong>Acak Otomatis (Reset Password)</strong> akan menghasilkan password acak berawalan `EXP-` (Contoh: EXP-1234). Password ini harus Anda berikan secara manual (WA/Email) kepada user terkait.</li>
                  </ul>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a', fontSize: 14 }}>3. Tiket Konsultasi &amp; Template 1 - 4</h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                    <li>Gunakan <strong>Template 1</strong> untuk mengirimkan rincian rekening transfer bank kepada pemohon upgrade paket.</li>
                    <li>Gunakan <strong>Template 2</strong> setelah bukti pembayaran diverifikasi untuk mengaktifkan akun dan mengubah status tiket menjadi Selesai.</li>
                    <li>Gunakan <strong>Template 3</strong> jika bukti transfer sedang dicocokkan dengan mutasi perbankan.</li>
                    <li>Gunakan <strong>Template 4</strong> jika data pembayaran atau bukti transfer tidak valid.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL EDIT/TAMBAH EXPERT */}
      {isExpertModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <h3 style={{ marginTop: 0 }}>{editingExpert ? 'Edit Pakar' : 'Tambah Pakar Baru'}</h3>
            <form onSubmit={handleSaveExpertSubmit} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={STYLES.label}>Gelar Depan</label><input type="text" value={expertForm.gelar_depan} onChange={e => setExpertForm({...expertForm, gelar_depan: e.target.value})} style={STYLES.input} /></div>
                <div><label style={STYLES.label}>Nama Lengkap *</label><input type="text" required value={expertForm.expert_name} onChange={e => setExpertForm({...expertForm, expert_name: e.target.value})} style={STYLES.input} /></div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={STYLES.label}>Gelar Belakang</label><input type="text" value={expertForm.gelar_belakang} onChange={e => setExpertForm({...expertForm, gelar_belakang: e.target.value})} style={STYLES.input} /></div>
                <div><label style={STYLES.label}>Bidang Keahlian *</label><input type="text" required value={expertForm.bidang_keahlian} onChange={e => setExpertForm({...expertForm, bidang_keahlian: e.target.value})} style={STYLES.input} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={STYLES.label}>Email Pakar *</label><input type="email" required value={expertForm.expert_email} onChange={e => setExpertForm({...expertForm, expert_email: e.target.value})} style={STYLES.input} /></div>
                <div><label style={STYLES.label}>Asal Instansi *</label><input type="text" required value={expertForm.asal_instansi} onChange={e => setExpertForm({...expertForm, asal_instansi: e.target.value})} style={STYLES.input} /></div>
              </div>

              <div>
                <label style={STYLES.label}>WhatsApp</label>
                <input type="text" value={expertForm.expert_whatsapp} onChange={e => setExpertForm({...expertForm, expert_whatsapp: e.target.value})} style={STYLES.input} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Pendidikan Terakhir</label>
                  <select value={expertForm.pendidikan_terakhir} onChange={e => setExpertForm({...expertForm, pendidikan_terakhir: e.target.value})} style={STYLES.input}>
                    <option value="D4 / Sarjana Terapan">D4 / Sarjana Terapan</option>
                    <option value="S1 / Sarjana">S1 / Sarjana</option>
                    <option value="S2 / Magister">S2 / Magister</option>
                    <option value="S3 / Doktor">S3 / Doktor</option>
                    <option value="Profesor">Profesor</option>
                  </select>
                </div>
                <div>
                  <label style={STYLES.label}>Durasi Pengalaman</label>
                  <select value={expertForm.durasi_pengalaman} onChange={e => setExpertForm({...expertForm, durasi_pengalaman: e.target.value})} style={STYLES.input}>
                    <option value="1 - 3 Tahun">1 - 3 Tahun</option>
                    <option value="3 - 5 Tahun">3 - 5 Tahun</option>
                    <option value="5 - 10 Tahun">5 - 10 Tahun</option>
                    <option value="Lebih dari 10 Tahun">Lebih dari 10 Tahun</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Status Verifikasi</label>
                  <select value={expertForm.status} onChange={e => setExpertForm({...expertForm, status: e.target.value})} style={STYLES.input}>
                    <option value="Aktif">Aktif</option>
                    <option value="Pending">Pending</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
                <div>
                  <label style={STYLES.label}>Visibilitas (Direktori)</label>
                  <select value={expertForm.is_public} onChange={e => setExpertForm({...expertForm, is_public: e.target.value})} style={STYLES.input}>
                    <option value="PUBLIK">PUBLIK</option>
                    <option value="PRIVAT">PRIVAT</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={STYLES.label}>Unggah Pas Foto (Maks 500KB)</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {expertForm.foto_url && <img src={expertForm.foto_url} alt="Pratinjau Foto" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #cbd5e1' }} />}
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'foto_url')} style={{ ...STYLES.input, flex: 1 }} />
                  </div>
                </div>
              </div>
              
              <div>
                <label style={STYLES.label}>File CV / Portofolio (Opsional)</label>
                <input type="text" placeholder="Masukkan URL Link CV (Google Drive, dll)" value={expertForm.portofolio_url} onChange={e => setExpertForm({...expertForm, portofolio_url: e.target.value})} style={STYLES.input} />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setIsExpertModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={submittingExpert} style={STYLES.btnSaveModal}>{submittingExpert ? 'Menyimpan...' : 'Simpan Pakar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PRODUK */}
      {isProductModalOpen && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <h3 style={{ marginTop: 0 }}>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
            <form onSubmit={handleSaveProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={STYLES.label}>Nama Produk *</label><input type="text" required value={productForm.nama} onChange={e => setProductForm({...productForm, nama: e.target.value})} style={STYLES.input} /></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={STYLES.label}>Kategori</label>
                  <select value={productForm.kategori} onChange={e => setProductForm({...productForm, kategori: e.target.value})} style={STYLES.input}>
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={STYLES.label}>Status</label>
                  <select value={productForm.status} onChange={e => setProductForm({...productForm, status: e.target.value})} style={STYLES.input}>
                    <option value="Tersedia">Tersedia</option>
                    <option value="Kosong">Kosong</option>
                  </select>
                </div>
              </div>

              <div><label style={STYLES.label}>Deskripsi Singkat *</label><textarea rows={3} required value={productForm.deskripsi} onChange={e => setProductForm({...productForm, deskripsi: e.target.value})} style={{...STYLES.input, resize: 'vertical'}} /></div>
              <div><label style={STYLES.label}>Link Beli / Akses</label><input type="text" value={productForm.link} onChange={e => setProductForm({...productForm, link: e.target.value})} style={STYLES.input} /></div>
              <div>
                <label style={STYLES.label}>Upload Gambar Utama (Maks 500KB)</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {productForm.imageurl && <img src={productForm.imageurl} alt="Pratinjau Gambar" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />}
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'imageurl')} style={{ ...STYLES.input, flex: 1 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setIsProductModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={submittingProduct} style={STYLES.btnSaveModal}>{submittingProduct ? 'Menyimpan...' : 'Simpan Produk'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATATAN LINK EXPERT */}
      {isNoteModalOpen && targetExpertForNote && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <h3 style={{ marginTop: 0 }}>Kirim Pesan Link Perbaikan Data</h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>Kirim tautan langsung ke email pakar agar mereka dapat memperbaiki profilnya.</p>
            <form onSubmit={handleSendNote} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={noteFormIsian.needFotoFix} onChange={e => setNoteFormIsian({...noteFormIsian, needFotoFix: e.target.checked})} /> Upload Pas Foto Resmi</label>
                <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={noteFormIsian.needCvFix} onChange={e => setNoteFormIsian({...noteFormIsian, needCvFix: e.target.checked})} /> Upload CV / Portofolio</label>
                <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={noteFormIsian.needKtpFix} onChange={e => setNoteFormIsian({...noteFormIsian, needKtpFix: e.target.checked})} /> Upload Berkas KTP</label>
                <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={noteFormIsian.needDataFix} onChange={e => setNoteFormIsian({...noteFormIsian, needDataFix: e.target.checked})} /> Pembaruan Profil Akademik</label>
              </div>

              <div><label style={STYLES.label}>Catatan Khusus (Opsional):</label><textarea value={noteFormIsian.customNote} onChange={e => setNoteFormIsian({...noteFormIsian, customNote: e.target.value})} style={{...STYLES.input, minHeight: 60}} /></div>
              
              <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: 8, border: '1px dashed #94a3b8', marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>Pratinjau Pesan Email:</div>
                <div style={{ fontSize: 12.5, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                  {buildNoteText()}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setIsNoteModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={loading} style={STYLES.btnSaveModal}>{loading ? 'Mengirim...' : 'Kirim Email'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PASSWORD */}
      {isPasswordModalOpen && targetUserForPassword && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <h3 style={{ marginTop: 0 }}>Reset Password User Pakar</h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>Ubah kata sandi login untuk pengguna ini.</p>
            <form onSubmit={handleSavePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" value={customPassword} onChange={e => setCustomPassword(e.target.value)} style={STYLES.input} required minLength={6} />
              <button type="button" onClick={() => setCustomPassword(generateRandomExpPass())} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 8, borderRadius: 6, cursor: 'pointer', fontWeight: 700, color: '#1d4ed8' }}>🎲 Acak Otomatis (Rekomendasi)</button>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" style={STYLES.btnSaveModal} disabled={submittingPassword}>{submittingPassword ? 'Menyimpan...' : 'Simpan Sandi Baru'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TANGGAPI / BALAS TIKET KONSULTASI */}
      {showReplyModal && selectedTicket && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17 }}>✍️ Tanggapi / Balas Tiket Konsultasi</h3>
              {isSuperAdmin && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (window.confirm("Yakin ingin menghapus tiket ini secara permanen?")) {
                      handleDeleteConsultation(selectedTicket);
                      setShowReplyModal(false);
                    }
                  }} 
                  style={{ ...STYLES.btnDelete, padding: '6px 12px' }}
                >
                  🗑️ Hapus Tiket
                </button>
              )}
            </div>
            
            {/* Pratinjau Lengkap Data Pemohon & Pertanyaan */}
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>ID Tiket: <strong style={{ color: '#1e3a8a' }}>#{selectedTicket.ticket_id || selectedTicket['ID Tiket'] || selectedTicket.id_tiket || selectedTicket.idTiket || selectedTicket[0]}</strong></span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Waktu: <strong>{formatDisplayDate(selectedTicket.created_at || selectedTicket['Tanggal Dibuat'] || selectedTicket[8] || selectedTicket[0])}</strong></span>
              </div>
              <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 6 }}>
                Pemohon: <strong style={{ color: '#0f172a' }}>{selectedTicket.user_name || selectedTicket['Nama User'] || selectedTicket.nama_user || selectedTicket[3] || 'Pemohon'}</strong> ({selectedTicket.user_email || selectedTicket['Kontak User'] || selectedTicket.email || selectedTicket[4] || '-'})
                {selectedTicket.asal_institusi || selectedTicket[5] ? ` - ${selectedTicket.asal_institusi || selectedTicket[5]}` : ''}
              </div>
              
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', marginBottom: 3 }}>Pertanyaan User:</div>
                <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  {selectedTicket.pertanyaan || selectedTicket['Topik Pesan'] || selectedTicket.topik_pesan || selectedTicket[6] || '-'}
                </div>
                {(selectedTicket.lampiran || selectedTicket.fileUrl || selectedTicket[10]) && (
                  <div style={{ marginTop: 8 }}>
                    <a href={selectedTicket.lampiran || selectedTicket.fileUrl || selectedTicket[10]} target="_blank" rel="noreferrer" style={STYLES.linkBadge}>
                      📎 Buka Berkas Lampiran User
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* TOMBOL PILIH TEMPLATE BALASAN CEPAT 1 - 4 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                ⚡ Pilih Template Balasan Cepat:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => applyTemplate(1)}
                  style={{ ...STYLES.btnTemplate, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                >
                  💳 1. Instruksi Transfer Bank
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate(2)}
                  style={{ ...STYLES.btnTemplate, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
                >
                  🟢 2. Upgrade Berhasil (Aktif)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate(3)}
                  style={{ ...STYLES.btnTemplate, background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' }}
                >
                  ⏳ 3. Sedang Diverifikasi
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate(4)}
                  style={{ ...STYLES.btnTemplate, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                >
                  ❌ 4. Upgrade Ditolak
                </button>
              </div>
            </div>

            <form onSubmit={handleReplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={STYLES.label}>Status Tiket</label>
                <select value={replyStatus} onChange={e => setReplyStatus(e.target.value)} style={STYLES.input}>
                  <option value="Menunggu">⏳ Menunggu</option>
                  <option value="Sedang Diverifikasi">🔍 Sedang Diverifikasi</option>
                  <option value="Diteruskan ke Pakar">➡️ Diteruskan ke Pakar</option>
                  <option value="Selesai">✅ Selesai</option>
                  <option value="Ditolak">❌ Ditolak</option>
                </select>
              </div>
              <div>
                <label style={STYLES.label}>Jawaban / Balasan Resmi (Akan Terkirim ke User) *</label>
                <textarea rows={8} value={replyMessage} onChange={e => setReplyMessage(e.target.value)} style={{...STYLES.input, resize: 'vertical'}} required placeholder="Ketik isi jawaban/balasan konsultasi atau gunakan template cepat di atas..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setShowReplyModal(false)} style={STYLES.btnCancel}>Batal</button>
                <button type="submit" disabled={submittingReply} style={STYLES.btnSaveModal}>{submittingReply ? 'Mengirim...' : 'Kirim Jawaban & Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const STYLES: Record<string, React.CSSProperties> = {
  page: { background: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", "Segoe UI", sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  headerTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' },
  headerSubtitle: { margin: '2px 0 0', fontSize: 13, color: '#64748b' },
  btnLogout: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  container: { maxWidth: 1200, margin: '24px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  tabsRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  tabActive: { background: '#1e3a8a', border: '1px solid #1e3a8a', borderRadius: 8, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  tabInactive: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, color: '#334155', cursor: 'pointer', transition: 'background 0.2s' },
  errorBox: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 14, color: '#b91c1c', fontSize: 13, fontWeight: 600 },
  contentCard: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
  cardTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnAdd: { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnRefresh: { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnNote: { background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 6 },
  btnEdit: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnDelete: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: '0.2s' },
  badgeActive: { background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, display: 'inline-block' },
  badgePending: { background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, display: 'inline-block' },
  idTag: { background: '#eff6ff', color: '#1d4ed8', padding: '3px 7px', borderRadius: 5, fontSize: 11.5, fontWeight: 800, border: '1px solid #bfdbfe' },
  ipBadge: { background: '#f8fafc', color: '#334155', padding: '3px 7px', borderRadius: 5, fontSize: 11.5, fontWeight: 700, border: '1px solid #cbd5e1', fontFamily: 'monospace' },
  statusSelect: { padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', outline: 'none' },
  btnTemplate: { padding: '8px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left' },
  linkBadge: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: 4, fontSize: 11, textDecoration: 'none', fontWeight: 700, border: '1px solid #bfdbfe', display: 'inline-block' },
  missingBadge: { background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, border: '1px solid #fecaca' },
  tableWrap: { overflowX: 'auto', marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600 },
  td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#334155', verticalAlign: 'top' },
  label: { fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20, backdropFilter: 'blur(2px)' },
  modalBox: { background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  input: { width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  btnCancel: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnSaveModal: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }
};