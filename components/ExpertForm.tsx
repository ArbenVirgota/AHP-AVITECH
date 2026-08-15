import React, { useState } from 'react';

// ====================================================================
// 1. DEFINISI TIPE DATA (TYPESCRIPT INTERFACES)
// ====================================================================

// Tipe data untuk struktur profil Pakar
export interface Expert {
  expert_id?: string;
  expert_name: string;
  expert_email?: string;
  expert_whatsapp?: string;
  // Menampung variasi properti dari backend (opsional)
  nama?: string;
  expertemail?: string;
  expertwhatsapp?: string;
  [key: string]: any; 
}

// Tipe data untuk Props yang diterima oleh komponen ini
interface ExpertFormProps {
  expertDirectory: Expert[];
  onUpdateProjectExperts?: (experts: Expert[]) => void;
}

// ====================================================================
// 2. KOMPONEN UTAMA
// ====================================================================

export default function ExpertForm({ expertDirectory, onUpdateProjectExperts }: ExpertFormProps) {
  // State untuk form input manual
  const [formData, setFormData] = useState<Expert>({
    expert_id: "", 
    expert_name: "",
    expert_email: "",
    expert_whatsapp: ""
  });

  // State untuk menyimpan pesan error validasi
  const [errorMessage, setErrorMessage] = useState<string>("");

  // State sementara untuk daftar pakar yang akan dimasukkan ke proyek
  const [projectExperts, setProjectExperts] = useState<Expert[]>([]);

  // ====================================================================
  // FUNGSI VALIDASI
  // ====================================================================
  const checkDuplicateExpert = (
    inputName: string, 
    inputEmail: string, 
    inputWa: string, 
    currentExpertId?: string
  ): string | null => {
    const cleanInputName = inputName.trim().toLowerCase();
    const cleanInputEmail = inputEmail.trim().toLowerCase();
    const cleanInputWa = inputWa.replace(/[^0-9]/g, '');

    for (const exp of expertDirectory) {
      // Lewati pengecekan jika ID pakar sama (mode dari autosuggest)
      if (currentExpertId && exp.expert_id === currentExpertId) continue;

      const existingName = String(exp.expert_name || exp.nama || "").trim().toLowerCase();
      const existingEmail = String(exp.expert_email || exp.expertemail || "").trim().toLowerCase();
      const existingWa = String(exp.expert_whatsapp || exp.expertwhatsapp || "").replace(/[^0-9]/g, '');

      const isNameMatch = cleanInputName === existingName && cleanInputName !== "";
      const isEmailMatch = cleanInputEmail === existingEmail && cleanInputEmail !== "";
      const isWaMatch = cleanInputWa === existingWa && cleanInputWa !== "";

      // SKENARIO 1: NAMA SUDAH ADA DI DIREKTORI
      if (isNameMatch) {
        if (isEmailMatch || isWaMatch) {
          return `Pakar bernama "${exp.expert_name}" sudah ada di direktori. Silakan pilih langsung dari daftar saran otomatis (dropdown) agar tidak menduplikat data.`;
        } else {
          return `Pakar dengan nama "${exp.expert_name}" sudah terdaftar di sistem dengan kontak yang berbeda.\n\nCatatan:\n- Pembaruan kontak hanya bisa dilakukan oleh Admin atau Pakar.\n- Jika ini pakar yang berbeda, mohon tambahkan identitas unik pada nama (misal: ${exp.expert_name} - Univ X).`;
        }
      }

      // SKENARIO 2: NAMA BEDA, TAPI EMAIL / WA SAMA
      if (!isNameMatch && isEmailMatch) {
        return `Email ${inputEmail} sudah terdaftar untuk pakar bernama "${exp.expert_name}". Setiap pakar harus memiliki email yang unik.`;
      }
      if (!isNameMatch && isWaMatch) {
        return `Nomor WhatsApp ${inputWa} sudah terdaftar untuk pakar bernama "${exp.expert_name}". Setiap pakar harus memiliki nomor yang unik.`;
      }
    }
    return null; // Lolos validasi (Aman)
  };

  // ====================================================================
  // HANDLER TOMBOL "TAMBAH PAKAR"
  // ====================================================================
  const handleAddExpert = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setErrorMessage(""); 

    // Pastikan nama tidak kosong
    if (!formData.expert_name.trim()) {
      setErrorMessage("Nama pakar wajib diisi.");
      return;
    }

    // 1. Jalankan Validasi (Hanya untuk input manual / ID kosong)
    if (!formData.expert_id) {
      const duplicateError = checkDuplicateExpert(
        formData.expert_name,
        formData.expert_email || "",
        formData.expert_whatsapp || "",
        formData.expert_id
      );

      // 2. Jika ada error, hentikan proses dan tampilkan di UI
      if (duplicateError) {
        setErrorMessage(duplicateError);
        return; 
      }
    }

    // 3. Jika aman (atau dipilih dari autosuggest), tambahkan ke daftar proyek
    const newExpertList = [...projectExperts, { ...formData }];
    setProjectExperts(newExpertList);
    
    // Kirim data terbaru ke komponen Parent (page.tsx)
    if (onUpdateProjectExperts) {
      onUpdateProjectExperts(newExpertList);
    }

    // 4. Bersihkan form untuk input selanjutnya
    setFormData({ expert_id: "", expert_name: "", expert_email: "", expert_whatsapp: "" });
  };

  // ====================================================================
  // RENDER UI
  // ====================================================================
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Daftar Pakar Proyek</h3>
      
      {/* FORM INPUT */}
      <form className="flex flex-col gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nama Pakar</label>
          <input 
            type="text" 
            className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ketik nama pakar..."
            value={formData.expert_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setFormData({ ...formData, expert_name: e.target.value, expert_id: "" })
            }
          />
          {/* Note: Jika Anda membuat dropdown Autosuggest nantinya, 
              saat user klik item, jalankan: setFormData({ expert_id: item.id, expert_name: item.nama, ... }) */}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input 
            type="email" 
            className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500"
            placeholder="email@contoh.com"
            value={formData.expert_email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setFormData({ ...formData, expert_email: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">WhatsApp</label>
          <input 
            type="text" 
            className="w-full border p-2 rounded focus:ring-blue-500 focus:border-blue-500"
            placeholder="08123456789"
            value={formData.expert_whatsapp}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
              setFormData({ ...formData, expert_whatsapp: e.target.value })
            }
          />
        </div>

        {/* AREA NOTIFIKASI ERROR */}
        {errorMessage && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded text-sm whitespace-pre-wrap">
            <strong>⚠️ Perhatian:</strong><br/>
            {errorMessage}
          </div>
        )}

        <button 
          onClick={handleAddExpert}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-fit mt-2 transition-colors"
        >
          Tambah Pakar
        </button>
      </form>

      {/* LIST PAKAR YANG SUDAH DITAMBAHKAN */}
      <hr className="my-4"/>
      <h4 className="font-medium text-gray-700 mb-2">Pakar Terpilih ({projectExperts.length})</h4>
      
      {projectExperts.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Belum ada pakar yang ditambahkan.</p>
      ) : (
        <ul className="list-disc pl-5">
          {projectExperts.map((exp, index) => (
            <li key={index} className="mb-2 text-sm text-gray-800">
              <strong>{exp.expert_name}</strong> 
              <span className="text-gray-500 ml-1">
                - {exp.expert_email || exp.expert_whatsapp || 'Tanpa Kontak'}
              </span>
              {exp.expert_id && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  Dari Direktori
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}