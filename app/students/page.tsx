'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Upload, Download, Trash2, ChevronLeft, ChevronRight, CheckCircle2, UserPlus, Edit3, User } from 'lucide-react';
import Modal from '@/components/Modal';
import * as XLSX from 'xlsx';

type Student = {
  id: string;
  nis: string;
  full_name: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  class_id?: string;
  photo_url?: string;
  classes?: { name: string };
};

type SchoolClass = {
  id: string;
  name: string;
};

type UserSession = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State untuk Modal Impor Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [targetClassId, setTargetClassId] = useState('');
  const [importing, setImporting] = useState(false);

  // State untuk Modal Tambah / Edit Siswa Satuan
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formNis, setFormNis] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState('Laki-laki');
  const [formClassId, setFormClassId] = useState('');
  const [formBirthPlace, setFormBirthPlace] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  
  // State untuk Foto
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingStudent, setSavingStudent] = useState(false);

  // State untuk Modal Modern Global (Notifikasi / Konfirmasi)
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'success';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    // Ambil data user login dari localStorage
    const sessionStr = localStorage.getItem('sagara_user');
    if (sessionStr) {
      try {
        const userObj = JSON.parse(sessionStr);
        setCurrentUser(userObj);
        fetchStudentsAndClasses(userObj);
      } catch (e) {
        console.error('Gagal parsing sesi user');
        fetchStudentsAndClasses(null);
      }
    } else {
      fetchStudentsAndClasses(null);
    }
  }, []);

  async function fetchStudentsAndClasses(user: UserSession | null) {
    try {
      setLoading(true);
      let allowedClassIds: string[] = [];

      // Jika user adalah pelatih, ambil daftar kelas binaannya dari tabel teacher_classes
      if (user && user.role === 'pelatih') {
        const { data: assignments, error: assignErr } = await supabase
          .from('teacher_classes')
          .select('class_id')
          .eq('teacher_id', user.id);

        if (!assignErr && assignments) {
          allowedClassIds = assignments.map((item: any) => item.class_id);
        }
      }

      // Ambil data kelas untuk dropdown (jika pelatih, batasi hanya kelas binaannya)
      let classQuery = supabase.from('classes').select('id, name').order('name');
      if (user && user.role === 'pelatih') {
        if (allowedClassIds.length > 0) {
          classQuery = classQuery.in('id', allowedClassIds);
        } else {
          classQuery = classQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      const { data: clsData } = await classQuery;
      if (clsData) setClassesList(clsData);

      // Ambil data siswa sesuai role
      let studQuery = supabase
        .from('students')
        .select('*, classes(name)')
        .order('full_name', { ascending: true });

      if (user && user.role === 'pelatih') {
        if (allowedClassIds.length > 0) {
          studQuery = studQuery.in('class_id', allowedClassIds);
        } else {
          setStudents([]);
          setLoading(false);
          return;
        }
      }

      const { data: studData, error: studErr } = await studQuery;
      if (studErr) throw studErr;
      if (studData) setStudents(studData);

    } catch (error: any) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  }

  // --- HANDLER UBAH FOTO ---
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFormPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  }

  // --- BUKA MODAL TAMBAH ---
  function openAddModal() {
    setEditingStudentId(null);
    setFormNis('');
    setFormName('');
    setFormGender('Laki-laki');
    setFormClassId('');
    setFormBirthPlace('');
    setFormBirthDate('');
    setFormPhotoFile(null);
    setPhotoPreview(null);
    setIsAddModalOpen(true);
  }

  // --- BUKA MODAL EDIT ---
  function openEditModal(student: Student) {
    setEditingStudentId(student.id);
    setFormNis(student.nis || '');
    setFormName(student.full_name || '');
    setFormGender(student.gender || 'Laki-laki');
    setFormClassId(student.class_id || '');
    setFormBirthPlace(student.birth_place || '');
    setFormBirthDate(student.birth_date || '');
    setFormPhotoFile(null);
    setPhotoPreview(student.photo_url || null);
    setIsAddModalOpen(true);
  }

  // --- SIMPAN / PERBARUI SISWA SATUAN ---
  async function handleSaveSingleStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!formNis.trim() || !formName.trim() || !formClassId) {
      showError('NIS, Nama Lengkap, dan Kelas wajib diisi.');
      return;
    }

    try {
      setSavingStudent(true);
      let finalPhotoUrl = photoPreview;

      if (formPhotoFile) {
        const fileExt = formPhotoFile.name.split('.').pop();
        const fileName = `${formNis}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(fileName, formPhotoFile, { upsert: true });

        if (uploadError) throw new Error('Gagal mengunggah foto: ' + uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from('student-photos')
          .getPublicUrl(fileName);

        finalPhotoUrl = publicUrlData.publicUrl;
      }

      const payload = {
        nis: formNis.trim(),
        full_name: formName.trim(),
        gender: formGender,
        class_id: formClassId,
        birth_place: formBirthPlace.trim(),
        birth_date: formBirthDate,
        photo_url: finalPhotoUrl,
      };

      if (editingStudentId) {
        const { error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudentId);

        if (error) throw error;
        showSuccess(`Data siswa ${formName} berhasil diperbarui.`);
      } else {
        const { error } = await supabase.from('students').insert([payload]);

        if (error) {
          if (error.code === '23505') {
            throw new Error(`NIS "${formNis}" sudah terdaftar di dalam sistem!`);
          }
          throw error;
        }
        showSuccess(`Siswa ${formName} berhasil ditambahkan.`);
      }

      setIsAddModalOpen(false);
      fetchStudentsAndClasses(currentUser);
    } catch (error: any) {
      showError(error.message || 'Gagal menyimpan data siswa.');
    } finally {
      setSavingStudent(false);
    }
  }

  // --- FITUR DOWNLOAD TEMPLATE EXCEL ---
  function downloadTemplate() {
    const templateData = [
      { NIS: '102301', Nama_Siswa: 'Ahmad Fauzi', Jenis_Kelamin: 'Laki-laki', Tempat_Lahir: 'Karawang', Tanggal_Lahir: '2008-05-14' },
      { NIS: '102302', Nama_Siswa: 'Siti Rahmawati', Jenis_Kelamin: 'Perempuan', Tempat_Lahir: 'Karawang', Tanggal_Lahir: '2008-08-20' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
    XLSX.writeFile(workbook, 'Template_Impor_Siswa_Sagara.xlsx');
  }

  // --- HANDLE UPLOAD & PREVIEW EXCEL ---
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          showError('File Excel kosong atau format tidak sesuai.');
          return;
        }

        setPreviewData(data);
      } catch (err: any) {
        showError('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  // --- SIMPAN DATA IMPOR KE SUPABASE ---
  async function confirmBulkImport() {
    if (!targetClassId) {
      showError('Silakan pilih kelas tujuan terlebih dahulu sebelum mengimpor.');
      return;
    }
    if (previewData.length === 0) return;

    try {
      setImporting(true);
      
      const formattedData = previewData.map((row: any) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(
              (rk) => rk.toLowerCase().replace(/[\s_]/g, '') === k.toLowerCase().replace(/[\s_]/g, '')
            );
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
          }
          return '';
        };

        const nis = String(getVal(['nis', 'nomorinduk'])).trim();
        const full_name = String(getVal(['namasiswa', 'nama', 'fullname', 'nama_lengkap'])).trim();
        const rawGender = String(getVal(['jeniskelamin', 'gender', 'jk'])).trim().toLowerCase();
        const gender = (rawGender.includes('perempuan') || rawGender === 'p' || rawGender === 'wanita') ? 'Perempuan' : 'Laki-laki';
        const birth_place = String(getVal(['tempatlahir', 'birthplace', 'tempat'])).trim();
        
        let rawDate = getVal(['tanggallahhir', 'tgllahir', 'birthdate', 'tanggal_lahir', 'tgl']);
        let birth_date = '';

        if (typeof rawDate === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const convertedDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
          birth_date = convertedDate.toISOString().split('T')[0];
        } else {
          birth_date = String(rawDate).trim();
        }

        return {
          nis,
          full_name,
          gender,
          birth_place,
          birth_date,
          class_id: targetClassId,
        };
      });

      const validRows = formattedData.filter(r => r.nis && r.full_name);

      if (validRows.length === 0) {
        showError('Tidak ada data valid yang ditemukan. Pastikan kolom NIS dan Nama Siswa terisi.');
        setImporting(false);
        return;
      }

      const { error } = await supabase.from('students').upsert(validRows, { onConflict: 'nis' });
      if (error) throw error;

      setIsImportModalOpen(false);
      setPreviewData([]);
      setTargetClassId('');
      fetchStudentsAndClasses(currentUser);
      showSuccess(`Berhasil mengimpor ${validRows.length} data siswa ke dalam sistem!`);
    } catch (error: any) {
      showError('Gagal menyimpan ke database: ' + error.message);
    } finally {
      setImporting(false);
    }
  }

  // --- HAPUS SISWA ---
  function confirmDeleteStudent(id: string, name: string) {
    setModalConfig({
      isOpen: true,
      title: 'Konfirmasi Hapus Siswa',
      message: `Apakah Anda yakin ingin menghapus data siswa "${name}" dari sistem?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('students').delete().eq('id', id);
          if (error) throw error;
          fetchStudentsAndClasses(currentUser);
          setModalConfig({ isOpen: false, title: '', message: '', type: 'info' });
        } catch (err: any) {
          alert('Gagal menghapus: ' + err.message);
        }
      }
    });
  }

  function showSuccess(msg: string) {
    setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success' });
  }
  function showError(msg: string) {
    setModalConfig({ isOpen: true, title: 'Peringatan', message: msg, type: 'danger' });
  }

  // Filter & Pencarian
  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.nis.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter ? student.class_id === selectedClassFilter : true;
    return matchesSearch && matchesClass;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  return (
    <div className="w-full h-[calc(100vh-6rem)] flex flex-col overflow-hidden space-y-4">
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{modalConfig.message}</p>
          <div className="flex justify-end gap-3 pt-2">
            {modalConfig.onConfirm ? (
              <>
                <button
                  onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={modalConfig.onConfirm}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-rose-600/20"
                >
                  Ya, Hapus
                </button>
              </>
            ) : (
              <button
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="px-5 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20"
              >
                Mengerti
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL TAMBAH / EDIT SISWA SATUAN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col my-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                {editingStudentId ? <Edit3 className="w-5 h-5 text-sky-600" /> : <UserPlus className="w-5 h-5 text-sky-600" />}
                <h3 className="font-bold text-gray-900">{editingStudentId ? 'Edit Data Siswa' : 'Form Tambah Siswa Baru'}</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSaveSingleStudent} className="p-6 space-y-4">
              <div className="flex flex-col items-center justify-center gap-2 mb-2">
                <div className="relative w-20 h-24 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden group">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-300" />
                  )}
                  <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload className="w-5 h-5 text-white mb-1" />
                    <span className="text-[9px] font-medium text-white uppercase">Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>
                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Pas Foto (Opsional)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  placeholder="Contoh: 102301"
                  value={formNis}
                  onChange={(e) => setFormNis(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Fauzi"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Kelas / Rombel</label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                    required
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    placeholder="Contoh: Karawang"
                    value={formBirthPlace}
                    onChange={(e) => setFormBirthPlace(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formBirthDate}
                    onChange={(e) => setFormBirthDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
                >
                  {savingStudent ? 'Menyimpan...' : (editingStudentId ? 'Perbarui Data' : 'Simpan Siswa')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-gray-900">Impor Data Siswa via Excel / CSV</h3>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setPreviewData([]); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-sky-50 p-4 rounded-xl border border-sky-100">
                <div>
                  <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wide">Langkah 1: Unduh Format Template</h4>
                  <p className="text-xs text-sky-700 mt-0.5">Gunakan templat resmi agar kolom terbaca otomatis oleh sistem.</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-white text-sky-700 hover:bg-sky-100 px-4 py-2 rounded-xl text-xs font-semibold border border-sky-200 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" /> Unduh Template Excel
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Langkah 2: Pilih Kelas Tujuan untuk Seluruh Siswa di File</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Pilih Kelas Rombel Tujuan --</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Langkah 3: Unggah File Excel (.xlsx / .csv)</label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
              </div>

              {previewData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Pratinjau Data ({previewData.length} baris terdeteksi):</span>
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Siap diimpor
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="p-2">NIS</th>
                          <th className="p-2">Nama</th>
                          <th className="p-2">Gender</th>
                          <th className="p-2">Tempat Lahir</th>
                          <th className="p-2">Tanggal Lahir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.map((row: any, idx) => {
                          const getV = (keys: string[]) => {
                            for (const k of keys) {
                              const fk = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_]/g, '') === k.toLowerCase().replace(/[\s_]/g, ''));
                              if (fk) return row[fk];
                            }
                            return '-';
                          };
                          
                          let rawD = getV(['tanggallahhir', 'tgllahir', 'birthdate', 'tanggal_lahir', 'tgl']);
                          let formattedD = rawD;
                          if (typeof rawD === 'number') {
                            const excelEpoch = new Date(1899, 11, 30);
                            formattedD = new Date(excelEpoch.getTime() + rawD * 86400000).toISOString().split('T')[0];
                          }

                          return (
                            <tr key={idx}>
                              <td className="p-2 font-medium">{getV(['nis', 'nomorinduk'])}</td>
                              <td className="p-2">{getV(['namasiswa', 'nama', 'fullname', 'nama_lengkap'])}</td>
                              <td className="p-2">{getV(['jeniskelamin', 'gender', 'jk'])}</td>
                              <td className="p-2">{getV(['tempatlahir', 'birthplace', 'tempat'])}</td>
                              <td className="p-2">{formattedD}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setIsImportModalOpen(false); setPreviewData([]); }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmBulkImport}
                disabled={previewData.length === 0 || importing || !targetClassId}
                className="flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {importing ? 'Menyimpan...' : `Impor ${previewData.length} Data Siswa`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Modul */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Manajemen Direktori Data Siswa</h2>
          <p className="text-xs text-gray-500 mt-0.5">Kelola database siswa, penempatan rombel kelas, dan impor massal via Excel</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shadow-md shadow-emerald-600/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor Excel</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-colors shadow-md shadow-sky-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Filter & Pencarian */}
      <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between shrink-0">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari Nama / NIS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="">-- Semua Kelas (Binaan) --</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500 font-medium">
            Total: {filteredStudents.length} Siswa
          </span>
        </div>
      </div>

      {/* Tabel Data Siswa */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-6 w-1/4">NIS & Foto</th>
                <th className="py-3 px-6">Nama Siswa</th>
                <th className="py-3 px-6">L / P</th>
                <th className="py-3 px-6">Kelas / Rombel</th>
                <th className="py-3 px-6">Tempat, Tanggal Lahir</th>
                <th className="py-3 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Memuat data siswa dari database...
                  </td>
                </tr>
              ) : currentStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Belum ada data siswa untuk kelas binaan Anda.
                  </td>
                </tr>
              ) : (
                currentStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <span className="font-semibold text-gray-900">{student.nis}</span>
                      </div>
                    </td>

                    <td className="py-3 px-6 font-medium text-gray-800">{student.full_name}</td>
                    
                    <td className="py-3 px-6">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        student.gender === 'Laki-laki' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-pink-50 text-pink-700 border border-pink-100'
                      }`}>
                        {student.gender}
                      </span>
                    </td>
                    
                    <td className="py-3 px-6 font-medium text-sky-700">{student.classes?.name || '-'}</td>
                    <td className="py-3 px-6 text-gray-600">
                      {student.birth_place ? `${student.birth_place}, ` : ''}
                      {student.birth_date || '-'}
                    </td>
                    
                    <td className="py-3 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors"
                          title="Edit Siswa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDeleteStudent(student.id, student.full_name)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50 shrink-0">
          <span>
            Menampilkan {currentStudents.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredStudents.length)} dari {filteredStudents.length} siswa
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-medium text-gray-700">
              Halaman {currentPage} dari {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}