'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Layers, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type ProgramKeahlian = { id: string; name: string; };
type KonsentrasiKeahlian = { id: string; name: string; program_id: string; program_keahlian?: { name: string }; };
const CACHE_KEY = 'sagara_concentrations_cache';

export default function KonsentrasiPage() {
  const [concentrations, setConcentrations] = useState<KonsentrasiKeahlian[]>([]);
  const [programs, setPrograms] = useState<ProgramKeahlian[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: undefined as (() => Promise<void>) | undefined });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    const cachedProg = sessionStorage.getItem('sagara_programs_cache');
    if (cached && cachedProg) {
      setConcentrations(JSON.parse(cached));
      setPrograms(JSON.parse(cachedProg));
      return;
    }
    const [kkRes, pkRes] = await Promise.all([
      supabase.from('konsentrasi_keahlian').select('*, program_keahlian(name)').order('name'),
      supabase.from('program_keahlian').select('*').order('name'),
    ]);
    if (kkRes.data) { setConcentrations(kkRes.data); sessionStorage.setItem(CACHE_KEY, JSON.stringify(kkRes.data)); }
    if (pkRes.data) { setPrograms(pkRes.data); sessionStorage.setItem('sagara_programs_cache', JSON.stringify(pkRes.data)); }
  }

  function updateCache(newData: KonsentrasiKeahlian[]) {
    setConcentrations(newData);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(newData));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || !selectedProgramId) return;
    try {
      const selectedProg = programs.find(p => p.id === selectedProgramId);
      if (editingId) {
        const { error } = await supabase.from('konsentrasi_keahlian').update({ name: trimmed, program_id: selectedProgramId }).eq('id', editingId);
        if (error) throw error;
        updateCache(concentrations.map(c => c.id === editingId ? { ...c, name: trimmed, program_id: selectedProgramId, program_keahlian: { name: selectedProg?.name || '' } } : c));
        showSuccess('Konsentrasi diperbarui.');
      } else {
        const { data, error } = await supabase.from('konsentrasi_keahlian').insert([{ name: trimmed, program_id: selectedProgramId }]).select('*, program_keahlian(name)').single();
        if (error) throw error;
        if (data) updateCache([...concentrations, data]);
        showSuccess('Konsentrasi ditambahkan.');
      }
      resetForm();
    } catch (err: any) { showError(err.message); }
  }

  function confirmDelete(id: string, name: string) {
    setModalConfig({
      isOpen: true, title: 'Konfirmasi Hapus', message: `Hapus konsentrasi "${name}"?`, type: 'danger',
      onConfirm: async () => {
        await supabase.from('konsentrasi_keahlian').delete().eq('id', id);
        updateCache(concentrations.filter(c => c.id !== id));
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  function resetForm() { setEditingId(null); setNewName(''); setSelectedProgramId(''); }
  function showSuccess(msg: string) { setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success', onConfirm: undefined }); }
  function showError(msg: string) { setModalConfig({ isOpen: true, title: 'Validasi Gagal', message: msg, type: 'danger', onConfirm: undefined }); }

  const filtered = concentrations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.program_keahlian?.name?.toLowerCase().includes(searchQuery.toLowerCase()));

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
            <h2 className="text-xl font-bold text-gray-900">Konsentrasi Keahlian</h2>
            <p className="text-sm text-gray-500 mt-0.5">Kelola konsentrasi keahlian per program</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-semibold border border-indigo-100">
          <Layers className="w-4 h-4" /> Total: {concentrations.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? 'Edit Konsentrasi' : 'Tambah Konsentrasi'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Program Keahlian</label>
              <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required>
                <option value="">-- Pilih Program --</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nama Konsentrasi Keahlian</label>
              <input type="text" placeholder="Contoh: Teknik Pemesinan" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Batal</button>}
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-sky-500/20"><Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Simpan'}</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <span className="font-bold text-sm text-gray-800">Daftar Konsentrasi Keahlian</span>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Cari konsentrasi..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-6">No</th>
                  <th className="py-3 px-6">Nama Konsentrasi</th>
                  <th className="py-3 px-6">Program Keahlian</th>
                  <th className="py-3 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 font-medium text-gray-600">{index + 1}</td>
                    <td className="py-3 px-6 font-semibold text-gray-900">{item.name}</td>
                    <td className="py-3 px-6 text-gray-600 text-xs">{item.program_keahlian?.name || '-'}</td>
                    <td className="py-3 px-6 text-center flex items-center justify-center gap-2">
                      <button onClick={() => { setEditingId(item.id); setNewName(item.name); setSelectedProgramId(item.program_id); }} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
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