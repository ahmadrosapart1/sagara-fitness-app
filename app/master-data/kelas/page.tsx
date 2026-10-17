'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, GraduationCap, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type KonsentrasiKeahlian = { id: string; name: string; };
type SchoolClass = { id: string; name: string; grade_level: string; academic_year?: string; semester?: string; konsentrasi_id: string; konsentrasi_keahlian?: { name: string }; };
const CACHE_KEY = 'sagara_classes_cache';

export default function KelasPage() {
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);
  const [concentrations, setConcentrations] = useState<KonsentrasiKeahlian[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [className, setClassName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('10');
  const [semester, setSemester] = useState('Ganjil');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [selectedKonsentrasiId, setSelectedKonsentrasiId] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: undefined as (() => Promise<void>) | undefined });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    const cachedKons = sessionStorage.getItem('sagara_concentrations_cache');
    if (cached && cachedKons) {
      setClassesList(JSON.parse(cached));
      setConcentrations(JSON.parse(cachedKons));
      return;
    }
    const [clsRes, konsRes] = await Promise.all([
      supabase.from('classes').select('*, konsentrasi_keahlian(name)').order('grade_level'),
      supabase.from('konsentrasi_keahlian').select('id, name').order('name'),
    ]);
    if (clsRes.data) { setClassesList(clsRes.data); sessionStorage.setItem(CACHE_KEY, JSON.stringify(clsRes.data)); }
    if (konsRes.data) { setConcentrations(konsRes.data); sessionStorage.setItem('sagara_concentrations_cache', JSON.stringify(konsRes.data)); }
  }

  function updateCache(newData: SchoolClass[]) {
    setClassesList(newData);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(newData));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = className.trim();
    if (!trimmed || !selectedKonsentrasiId) return;
    try {
      const payload = { name: trimmed, grade_level: gradeLevel, academic_year: academicYear, semester, konsentrasi_id: selectedKonsentrasiId };
      const selectedKons = concentrations.find(c => c.id === selectedKonsentrasiId);

      if (editingId) {
        const { error } = await supabase.from('classes').update(payload).eq('id', editingId);
        if (error) throw error;
        updateCache(classesList.map(cl => cl.id === editingId ? { ...cl, ...payload, konsentrasi_keahlian: { name: selectedKons?.name || '' } } : cl));
        showSuccess('Kelas diperbarui.');
      } else {
        const { data, error } = await supabase.from('classes').insert([payload]).select('*, konsentrasi_keahlian(name)').single();
        if (error) throw error;
        if (data) updateCache([...classesList, data]);
        showSuccess('Kelas ditambahkan.');
      }
      resetForm();
    } catch (err: any) { showError(err.message); }
  }

  function confirmDelete(id: string, name: string) {
    setModalConfig({
      isOpen: true, title: 'Konfirmasi Hapus', message: `Hapus kelas "${name}"?`, type: 'danger',
      onConfirm: async () => {
        await supabase.from('classes').delete().eq('id', id);
        updateCache(classesList.filter(cl => cl.id !== id));
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  function resetForm() { setEditingId(null); setClassName(''); setGradeLevel('10'); setSelectedKonsentrasiId(''); }
  function showSuccess(msg: string) { setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success', onConfirm: undefined }); }
  function showError(msg: string) { setModalConfig({ isOpen: true, title: 'Validasi Gagal', message: msg, type: 'danger', onConfirm: undefined }); }

  const filtered = classesList.filter(cl => cl.name.toLowerCase().includes(searchQuery.toLowerCase()) || cl.konsentrasi_keahlian?.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      <Modal isOpen={modalConfig.isOpen} onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} title={modalConfig.title} type={modalConfig.type as any}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{modalConfig.message}</p>
          <div className="flex justify-end gap-3 pt-2">
            {modalConfig.onConfirm ? (
              <>
                <button onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold">Batal</button>
                <button onClick={modalConfig.onConfirm} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold">Ya, Hapus</button>
              </>
            ) : (
              <button onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold">Mengerti</button>
            )}
          </div>
        </div>
      </Modal>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/master-data" className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Kelas & Rombel</h2>
            <p className="text-sm text-gray-500 mt-0.5">Kelola tingkat kelas, rombel, dan tahun ajaran</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-semibold border border-emerald-100">
          <GraduationCap className="w-4 h-4" /> Total: {classesList.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? 'Edit Kelas' : 'Tambah Kelas'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tingkat</label>
                <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500">
                  <option value="10">Kelas 10</option>
                  <option value="11">Kelas 11</option>
                  <option value="12">Kelas 12</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500">
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tahun Ajaran</label>
              <input type="text" placeholder="2025/2026" value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Konsentrasi Keahlian</label>
              <select value={selectedKonsentrasiId} onChange={e => setSelectedKonsentrasiId(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required>
                <option value="">-- Pilih Konsentrasi --</option>
                {concentrations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nama Rombel / Kelas</label>
              <input type="text" placeholder="Contoh: X TKR 1" value={className} onChange={e => setClassName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Batal</button>}
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-sky-500/20"><Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Simpan'}</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <span className="font-bold text-sm text-gray-800">Daftar Kelas & Rombel</span>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Cari kelas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-6">Kelas</th>
                  <th className="py-3 px-6">Konsentrasi Keahlian</th>
                  <th className="py-3 px-6">Tahun Ajaran / Semester</th>
                  <th className="py-3 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 font-semibold text-gray-900">{item.name}</td>
                    <td className="py-3 px-6 text-gray-600 text-xs">{item.konsentrasi_keahlian?.name || '-'}</td>
                    <td className="py-3 px-6 text-gray-600 text-xs">{item.academic_year} ({item.semester})</td>
                    <td className="py-3 px-6 text-center flex items-center justify-center gap-2">
                      <button onClick={() => { setEditingId(item.id); setClassName(item.name); setGradeLevel(item.grade_level); setAcademicYear(item.academic_year || '2025/2026'); setSemester(item.semester || 'Ganjil'); setSelectedKonsentrasiId(item.konsentrasi_id); }} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => confirmDelete(item.id, item.name)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}