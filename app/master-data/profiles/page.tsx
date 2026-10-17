'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, X, UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  nip?: string;
  password?: string;
  role: string;
};

type SchoolClass = {
  id: string;
  name: string;
};

type TeacherClassAssignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  academic_year: string;
  profiles?: { full_name: string; email: string; nip?: string };
  classes?: { name: string };
};

export default function ProfilesManagementPage() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'assignments'>('profiles');
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // State Form Tambah Pengguna Baru
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNip, setNewNip] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newProfileRole, setNewProfileRole] = useState('pelatih');

  // Modal State untuk Edit Profil Lengkap
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoleValue, setEditRoleValue] = useState('pelatih');

  // Modal State untuk Edit Penugasan Kelas
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignTeacherId, setEditAssignTeacherId] = useState('');
  const [editAssignClassId, setEditAssignClassId] = useState('');
  const [editAssignAcademicYear, setEditAssignAcademicYear] = useState('');
  const [isAssignmentEditModalOpen, setIsAssignmentEditModalOpen] = useState(false);

  // State Form Tambah Penugasan Kelas
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026/2027');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'success';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: profData, error: profErr } = await supabase.from('profiles').select('*').order('full_name');
      if (profErr) throw profErr;
      if (profData) setProfiles(profData);

      const { data: clsData, error: clsErr } = await supabase.from('classes').select('id, name').order('name');
      if (clsErr) throw clsErr;
      if (clsData) setClasses(clsData);

      const { data: assignData, error: assignErr } = await supabase
        .from('teacher_classes')
        .select(`
          id,
          teacher_id,
          class_id,
          academic_year,
          profiles (full_name, email, nip),
          classes (name)
        `);

      if (assignErr) console.error('Assignment error:', assignErr.message);
      if (assignData) {
        setAssignments(assignData as any);
      }
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Error Koneksi Database',
        message: err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }

  // Tambah Pengguna Baru
  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!newFullName || !newEmail || !newPassword) {
      setModalConfig({ isOpen: true, title: 'Perhatian', message: 'Nama, email, dan password wajib diisi.', type: 'info' });
      return;
    }

    try {
      const { error } = await supabase.from('profiles').insert([
        {
          full_name: newFullName,
          email: newEmail,
          nip: newNip || null,
          password: newPassword,
          role: newProfileRole
        }
      ]);

      if (error) throw error;

      setModalConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Pengguna/guru baru berhasil ditambahkan.',
        type: 'success'
      });
      setNewFullName('');
      setNewEmail('');
      setNewNip('');
      setNewPassword('123456');
      setNewProfileRole('pelatih');
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  // Buka Modal Edit Profil
  function handleOpenEditModal(profile: Profile) {
    setSelectedProfile(profile);
    setEditFullName(profile.full_name || '');
    setEditEmail(profile.email || '');
    setEditNip(profile.nip || '');
    setEditPassword(profile.password || '');
    setEditRoleValue(profile.role || 'pelatih');
    setIsEditModalOpen(true);
  }

  // Simpan Update Profil
  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfile) return;

    try {
      const updateData: any = {
        full_name: editFullName,
        email: editEmail,
        nip: editNip || null,
        role: editRoleValue,
      };

      if (editPassword.trim() !== '') {
        updateData.password = editPassword;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedProfile.id);

      if (error) throw error;

      setModalConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Data pengguna berhasil diperbarui.',
        type: 'success'
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  // Hapus Profil
  async function handleDeleteProfile(id: string, name: string) {
    if (!confirm(`Yakin ingin menghapus akun "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;

      setModalConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Akun pengguna berhasil dihapus.',
        type: 'success'
      });
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  // Penugasan Kelas
  async function handleAssignClass(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacherId || !selectedClassId) {
      setModalConfig({ isOpen: true, title: 'Perhatian', message: 'Pilih guru dan kelas terlebih dahulu.', type: 'info' });
      return;
    }

    // Validasi: Cek apakah kelas ini sudah memiliki pelatih lain di daftar penugasan
    const isClassAlreadyAssigned = assignments.some(
      (item) => item.class_id === selectedClassId
    );

    if (isClassAlreadyAssigned) {
      setModalConfig({
        isOpen: true,
        title: 'Kelas Sudah Memiliki Pelatih',
        message: 'Kelas ini sudah ditugaskan ke pelatih lain. Harap hapus atau edit penugasan yang ada terlebih dahulu jika ingin menggantinya.',
        type: 'danger'
      });
      return;
    }

    try {
      const { error } = await supabase.from('teacher_classes').insert([
        {
          teacher_id: selectedTeacherId,
          class_id: selectedClassId,
          academic_year: academicYear
        }
      ]);

      if (error) throw error;

      setModalConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Kelas berhasil ditugaskan ke pelatih.',
        type: 'success'
      });
      setSelectedTeacherId('');
      setSelectedClassId('');
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  // Buka Modal Edit Penugasan Kelas
  function handleOpenEditAssignment(item: TeacherClassAssignment) {
    setEditingAssignmentId(item.id);
    setEditAssignTeacherId(item.teacher_id);
    setEditAssignClassId(item.class_id);
    setEditAssignAcademicYear(item.academic_year || '2026/2027');
    setIsAssignmentEditModalOpen(true);
  }

  // Simpan Update Penugasan Kelas
  async function handleUpdateAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAssignmentId) return;

    try {
      const { error } = await supabase
        .from('teacher_classes')
        .update({
          teacher_id: editAssignTeacherId,
          class_id: editAssignClassId,
          academic_year: editAssignAcademicYear,
        })
        .eq('id', editingAssignmentId);

      if (error) throw error;

      setModalConfig({
        isOpen: true,
        title: 'Berhasil',
        message: 'Penugasan kelas berhasil diperbarui.',
        type: 'success'
      });
      setIsAssignmentEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  async function handleDeleteAssignment(id: string) {
    if (!confirm('Hapus penugasan kelas ini dari pelatih?')) return;

    try {
      const { error } = await supabase.from('teacher_classes').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setModalConfig({ isOpen: true, title: 'Gagal', message: err.message, type: 'danger' });
    }
  }

  return (
    <div className="w-full space-y-4 text-xs pb-6">
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
      >
        <p className="text-slate-600 text-xs mb-4">{modalConfig.message}</p>
        <div className="flex justify-end">
          <button
            onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
            className="px-4 py-2 bg-sky-600 text-white rounded-xl font-semibold text-xs"
          >
            Tutup
          </button>
        </div>
      </Modal>

      {/* Modal Edit Profil Lengkap */}
      {isEditModalOpen && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Edit Data Pengguna</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nama Lengkap & Gelar:</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">NIP (Nomor Induk Pegawai):</label>
                <input
                  type="text"
                  placeholder="Contoh: 19880520 201503 1 002"
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email:</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Password Baru (Kosongkan jika tidak diubah):</label>
                <input
                  type="text"
                  placeholder="Masukkan password baru"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Role Akses:</label>
                <select
                  value={editRoleValue}
                  onChange={(e) => setEditRoleValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                >
                  <option value="pelatih">Pelatih / Guru</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl font-semibold shadow"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Penugasan Kelas */}
      {isAssignmentEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Edit Penugasan Kelas Pelatih</h3>
              <button onClick={() => setIsAssignmentEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateAssignment} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Pilih Pelatih / Guru:</label>
                <select
                  value={editAssignTeacherId}
                  onChange={(e) => setEditAssignTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                >
                  <option value="">-- Pilih Guru --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Pilih Kelas Binaan:</label>
                <select
                  value={editAssignClassId}
                  onChange={(e) => setEditAssignClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tahun Ajaran:</label>
                <input
                  type="text"
                  value={editAssignAcademicYear}
                  onChange={(e) => setEditAssignAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignmentEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl font-semibold shadow"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header dengan Tombol Kembali (Konsisten) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data"
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-colors"
            title="Kembali ke Master Data"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-slate-900">Manajemen Hak Akses & Penugasan Kelas Guru</h2>
            <p className="text-[11px] text-slate-500">Kelola role akun (Admin / Pelatih) dan pemetaan kelas binaan pelatih</p>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'profiles' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'}`}
          >
            Daftar Pengguna & Role
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${activeTab === 'assignments' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'}`}
          >
            Penugasan Kelas Pelatih
          </button>
        </div>
      </div>

      {/* Konten Tab 1: Profiles */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          {/* Form Tambah Pengguna Baru */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-sky-600" /> Tambah Akun Guru / Pelatih Baru
            </h3>
            <form onSubmit={handleCreateProfile} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Nama Lengkap & Gelar:</label>
                <input
                  type="text"
                  placeholder="Budi, S.Pd"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">NIP Pegawai:</label>
                <input
                  type="text"
                  placeholder="19880520..."
                  value={newNip}
                  onChange={(e) => setNewNip(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Email:</label>
                <input
                  type="email"
                  placeholder="budi@smkn1karawang.sch.id"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Password Awal:</label>
                <input
                  type="text"
                  placeholder="123456"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Role Akses:</label>
                <select
                  value={newProfileRole}
                  onChange={(e) => setNewProfileRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                >
                  <option value="pelatih">Pelatih / Guru</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>
          </div>

          {/* Tabel Daftar Pengguna */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Daftar Seluruh Akun Guru & Admin Terdaftar</div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">NIP</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4 text-center">Role Sistem</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">Belum ada data pengguna. Silakan tambahkan di atas.</td>
                  </tr>
                ) : (
                  profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{p.full_name || 'Tanpa Nama'}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{p.nip ? `NIP. ${p.nip}` : '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{p.email || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          p.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {(p.role || 'pelatih').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors"
                            title="Edit Pengguna"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(p.id, p.full_name)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Hapus Akun"
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
        </div>
      )}

      {/* Konten Tab 2: Teacher Classes Assignments */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3">Tambah Penugasan Kelas ke Pelatih</h3>
            <form onSubmit={handleAssignClass} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Pilih Pelatih / Guru:</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                >
                  <option value="">-- Pilih Guru --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Pilih Kelas Binaan:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Tahun Ajaran:</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Simpan Penugasan
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Daftar Pemetaan Kelas & Pelatih Aktif</div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Nama Pelatih / Guru</th>
                  <th className="py-3 px-4">Kelas Binaan</th>
                  <th className="py-3 px-4">Tahun Ajaran</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">Belum ada penugasan kelas yang tercatat.</td>
                  </tr>
                ) : (
                  assignments.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.profiles?.full_name || 'Guru Tidak Ditemukan'}
                        {item.profiles?.nip && <span className="block text-[10px] text-slate-500 font-normal">NIP. {item.profiles.nip}</span>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-sky-700">{item.classes?.name || 'Kelas Tidak Ditemukan'}</td>
                      <td className="py-3 px-4 text-slate-600">{item.academic_year || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditAssignment(item)}
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-colors"
                            title="Edit Penugasan"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(item.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Hapus Penugasan"
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
        </div>
      )}
    </div>
  );
}