'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Award, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type TestItem = {
  id: string;
  name: string;
  metric_type: string;
  target_gender: string;
  description: string;
};
const CACHE_KEY = 'sagara_test_items_cache';

export default function ButirTesPage() {
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newTestName, setNewTestName] = useState('');
  const [newTestMetric, setNewTestMetric] = useState('count_in_time');
  const [newTestGender, setNewTestGender] = useState('all');
  const [newTestDesc, setNewTestDesc] = useState('');

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: undefined as (() => Promise<void>) | undefined });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) { setTestItems(JSON.parse(cached)); return; }
    const { data } = await supabase.from('test_items').select('*').order('name');
    if (data) { setTestItems(data); sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  }

  function updateCache(newData: TestItem[]) {
    setTestItems(newData);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(newData));
  }

  // Fungsi untuk mengubah kode metrik database menjadi teks satuan yang mudah dibaca
  function formatMetric(type: string) {
    switch (type) {
      case 'time_in_seconds': return 'Waktu (Detik)';
      case 'count_in_time': return 'Frekuensi (Count)';
      case 'distance_in_cm': return 'Jarak (Cm)';
      case 'weight_in_kg': return 'Berat Badan (Kg)';
      case 'height_in_cm': return 'Tinggi Badan (Cm)';
      default: return type || 'Satuan Umum';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTestName.trim();
    if (!trimmed) return;
    try {
      const payload = {
        name: trimmed,
        metric_type: newTestMetric,
        target_gender: newTestGender,
        description: newTestDesc
      };

      if (editingId) {
        const { error } = await supabase.from('test_items').update(payload).eq('id', editingId);
        if (error) throw error;
        updateCache(testItems.map(t => t.id === editingId ? { ...t, ...payload } : t));
        showSuccess('Butir tes berhasil diperbarui.');
      } else {
        const { data, error } = await supabase.from('test_items').insert([payload]).select().single();
        if (error) throw error;
        if (data) updateCache([...testItems, data]);
        showSuccess('Butir tes berhasil ditambahkan.');
      }
      resetForm();
    } catch (err: any) { showError(err.message); }
  }

  function confirmDelete(id: string, name: string) {
    setModalConfig({
      isOpen: true, title: 'Konfirmasi Hapus', message: `Hapus butir tes "${name}"?`, type: 'danger',
      onConfirm: async () => {
        await supabase.from('test_items').delete().eq('id', id);
        updateCache(testItems.filter(t => t.id !== id));
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  function resetForm() {
    setEditingId(null);
    setNewTestName('');
    setNewTestMetric('count_in_time');
    setNewTestGender('all');
    setNewTestDesc('');
  }

  function handleEdit(item: TestItem) {
    setEditingId(item.id);
    setNewTestName(item.name);
    setNewTestMetric(item.metric_type);
    setNewTestGender(item.target_gender || 'all');
    setNewTestDesc(item.description || '');
  }

  function showSuccess(msg: string) { setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success', onConfirm: undefined }); }
  function showError(msg: string) { setModalConfig({ isOpen: true, title: 'Validasi Gagal', message: msg, type: 'danger', onConfirm: undefined }); }

  const filtered = testItems.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || formatMetric(t.metric_type).toLowerCase().includes(searchQuery.toLowerCase()));

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
            <h2 className="text-xl font-bold text-gray-900">Butir Tes & Antropometri (BMI & TKJI)</h2>
            <p className="text-sm text-gray-500 mt-0.5">Kelola instrumen pengujian fisik dan pengukuran tubuh</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-xs font-semibold border border-amber-100">
          <Award className="w-4 h-4" /> Total: {testItems.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? 'Edit Butir Tes' : 'Tambah Butir Tes Baru'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nama Tes / Pengukuran</label>
              <input type="text" placeholder="Contoh: Lari 50 Meter" value={newTestName} onChange={e => setNewTestName(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Satuan / Metrik</label>
                <select value={newTestMetric} onChange={e => setNewTestMetric(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500">
                  <option value="time_in_seconds">Waktu (Detik)</option>
                  <option value="count_in_time">Frekuensi (Count)</option>
                  <option value="distance_in_cm">Jarak (Cm)</option>
                  <option value="weight_in_kg">Berat Badan (Kg)</option>
                  <option value="height_in_cm">Tinggi Badan (Cm)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Gender</label>
                <select value={newTestGender} onChange={e => setNewTestGender(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500">
                  <option value="all">Umum (L/P)</option>
                  <option value="laki_laki">Khusus Laki-laki</option>
                  <option value="perempuan">Khusus Perempuan</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deskripsi / Keterangan</label>
              <textarea placeholder="Keterangan singkat..." value={newTestDesc} onChange={e => setNewTestDesc(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" rows={3}></textarea>
            </div>
            <div className="flex gap-2">
              {editingId && <button type="button" onClick={resetForm} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Batal</button>}
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-sky-500/20"><Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Simpan'}</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <span className="font-bold text-sm text-gray-800">Daftar Instrumen Pengujian & Antropometri</span>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Cari butir tes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-6">Nama Tes / Pengukuran</th>
                  <th className="py-3 px-6">Satuan / Metrik</th>
                  <th className="py-3 px-6">Target Gender</th>
                  <th className="py-3 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 font-semibold text-gray-900">{item.name}</td>
                    <td className="py-3 px-6 text-gray-600 text-xs">
                      <span className="bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg font-medium border border-sky-100">
                        {formatMetric(item.metric_type)}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs">
                      <span className={`px-2.5 py-1 rounded-lg font-medium border ${
                        item.target_gender === 'laki_laki' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        item.target_gender === 'perempuan' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                        'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {item.target_gender === 'laki_laki' ? 'Khusus Laki-laki' : item.target_gender === 'perempuan' ? 'Khusus Perempuan' : 'Umum (L/P)'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(item)} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
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