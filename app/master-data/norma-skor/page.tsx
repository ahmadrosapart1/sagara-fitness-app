'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Sliders, Search, ArrowLeft, Filter, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type TestItem = { id: string; name: string; };
type ScoringRule = {
  id: string;
  test_item_id: string;
  gender: string;
  min_val: number;
  max_val: number;
  score_point: number;
  test_items?: { name: string };
};

type SortField = 'test_name' | 'gender' | 'min_val' | 'score_point';
type SortOrder = 'asc' | 'desc';

const CACHE_KEY = 'sagara_norm_rules_cache';

export default function NormaSkorPage() {
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTestFilter, setSelectedTestFilter] = useState('Semua');
  
  // State untuk Sorting per Kolom Header
  const [sortField, setSortField] = useState<SortField>('score_point');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [selectedTestId, setSelectedTestId] = useState('');
  const [normGender, setNormGender] = useState('Semua');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [scorePoint, setScorePoint] = useState('5');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'success';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const cachedTests = sessionStorage.getItem('sagara_test_items_cache');

      if (cached && cachedTests) {
        setScoringRules(JSON.parse(cached));
        setTestItems(JSON.parse(cachedTests));
        return;
      }

      const [normsRes, testsRes] = await Promise.all([
        supabase.from('test_scoring_rules').select('*, test_items(name)').order('score_point', { ascending: false }),
        supabase.from('test_items').select('id, name').order('name'),
      ]);

      if (normsRes.data) {
        setScoringRules(normsRes.data);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(normsRes.data));
      }
      if (testsRes.data) {
        setTestItems(testsRes.data);
        sessionStorage.setItem('sagara_test_items_cache', JSON.stringify(testsRes.data));
      }
    } catch (error: any) {
      console.error('Error:', error.message);
    }
  }

  function updateCache(newData: ScoringRule[]) {
    setScoringRules(newData);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(newData));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTestId) return;

    try {
      const payload = {
        test_item_id: selectedTestId,
        gender: normGender,
        min_val: parseFloat(minVal),
        max_val: parseFloat(maxVal),
        score_point: parseInt(scorePoint),
      };
      
      const selectedTest = testItems.find(t => t.id === selectedTestId);

      if (editingId) {
        const { error } = await supabase.from('test_scoring_rules').update(payload).eq('id', editingId);
        if (error) throw error;
        const updated = scoringRules.map(r => r.id === editingId ? { ...r, ...payload, test_items: { name: selectedTest?.name || '' } } : r);
        updateCache(updated);
        showSuccess('Aturan norma berhasil diperbarui.');
      } else {
        const { data, error } = await supabase.from('test_scoring_rules').insert([payload]).select('*, test_items(name)').single();
        if (error) throw error;
        if (data) {
          const updated = [data, ...scoringRules];
          updateCache(updated);
        }
        showSuccess('Aturan norma berhasil ditambahkan.');
      }
      resetForm();
    } catch (error: any) {
      showError(error.message);
    }
  }

  function confirmDelete(id: string) {
    setModalConfig({
      isOpen: true,
      title: 'Konfirmasi Hapus',
      message: 'Hapus aturan norma konversi skor ini?',
      type: 'danger',
      onConfirm: async () => {
        await supabase.from('test_scoring_rules').delete().eq('id', id);
        const updated = scoringRules.filter(r => r.id !== id);
        updateCache(updated);
        setModalConfig({ isOpen: false, title: '', message: '', type: 'info' });
      }
    });
  }

  function resetForm() {
    setEditingId(null);
    setSelectedTestId('');
    setNormGender('Semua');
    setMinVal('');
    setMaxVal('');
    setScorePoint('5');
  }

  function handleEdit(item: ScoringRule) {
    setEditingId(item.id);
    setSelectedTestId(item.test_item_id);
    setNormGender(item.gender);
    setMinVal(String(item.min_val));
    setMaxVal(String(item.max_val));
    setScorePoint(String(item.score_point));
  }

  // Handler klik header untuk sorting
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc'); // Default ke ascending saat kolom baru diklik
    }
  }

  function showSuccess(msg: string) {
    setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success' });
  }
  function showError(msg: string) {
    setModalConfig({ isOpen: true, title: 'Validasi Gagal', message: msg, type: 'danger' });
  }

  // --- FILTER & DYNAMIC SORTING LOGIC ---
  const filteredRules = scoringRules.filter(r => {
    const matchesSearch = 
      r.test_items?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.gender.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTestFilter = selectedTestFilter === 'Semua' || r.test_item_id === selectedTestFilter;

    return matchesSearch && matchesTestFilter;
  }).sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'test_name') {
      valA = a.test_items?.name || '';
      valB = b.test_items?.name || '';
    } else if (sortField === 'gender') {
      valA = a.gender;
      valB = b.gender;
    } else if (sortField === 'min_val') {
      valA = a.min_val;
      valB = b.min_val;
    } else if (sortField === 'score_point') {
      valA = a.score_point;
      valB = b.score_point;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <Modal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} type={modalConfig.type}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{modalConfig.message}</p>
          <div className="flex justify-end gap-3 pt-2">
            {modalConfig.onConfirm ? (
              <>
                <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold">Batal</button>
                <button onClick={modalConfig.onConfirm} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold">Ya, Hapus</button>
              </>
            ) : (
              <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold">Mengerti</button>
            )}
          </div>
        </div>
      </Modal>

      {/* Header dengan Tombol Kembali */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/master-data" className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Norma Konversi Skor TKJI</h2>
            <p className="text-sm text-gray-500 mt-0.5">Atur konversi nilai mentah ke poin skor 1 - 5</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-xl text-xs font-semibold border border-purple-100">
          <Sliders className="w-4 h-4" /> Total Aturan: {scoringRules.length}
        </div>
      </div>

      {/* Form & Tabel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? 'Edit Aturan Norma' : 'Tambah Aturan Norma'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Butir Tes</label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                required
              >
                <option value="">-- Pilih Tes --</option>
                {testItems.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Target Gender</label>
              <select
                value={normGender}
                onChange={(e) => setNormGender(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
              >
                <option value="Semua">Semua / Umum</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nilai Min (&gt;=)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Contoh: 7.0"
                  value={minVal}
                  onChange={(e) => setMinVal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nilai Max (&lt;=)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Contoh: 8.5"
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Poin Skor (1 - 5)</label>
              <select
                value={scorePoint}
                onChange={(e) => setScorePoint(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-sky-700 focus:outline-none focus:border-sky-500"
              >
                <option value="5">Skor 5 (Sangat Baik)</option>
                <option value="4">Skor 4 (Baik)</option>
                <option value="3">Skor 3 (Sedang)</option>
                <option value="2">Skor 2 (Kurang)</option>
                <option value="1">Skor 1 (Kurang Sekali)</option>
              </select>
            </div>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={resetForm} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Batal</button>
              )}
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-sky-500/20">
                <Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabel Data dengan Klik Header untuk Sorting */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          
          {/* Header Panel Filter & Pencarian */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex items-center gap-2 flex-1">
              {/* Filter Berdasarkan Jenis Tes */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-xl">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedTestFilter}
                  onChange={(e) => setSelectedTestFilter(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="Semua">Semua Jenis Tes</option>
                  {testItems.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Input Search */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari norma / gender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          
          {/* Kontainer Scroll Internal dengan Header Interaktif */}
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase">
                  
                  {/* Header: Jenis Tes */}
                  <th 
                    onClick={() => handleSort('test_name')} 
                    className="py-3 px-6 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Jenis Tes</span>
                      {sortField === 'test_name' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-sky-600" /> : <ChevronDown className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                  </th>

                  {/* Header: Gender */}
                  <th 
                    onClick={() => handleSort('gender')} 
                    className="py-3 px-6 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span>Gender</span>
                      {sortField === 'gender' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-sky-600" /> : <ChevronDown className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                  </th>

                  {/* Header: Rentang Nilai */}
                  <th 
                    onClick={() => handleSort('min_val')} 
                    className="py-3 px-6 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Rentang Nilai</span>
                      {sortField === 'min_val' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-sky-600" /> : <ChevronDown className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                  </th>

                  {/* Header: Poin */}
                  <th 
                    onClick={() => handleSort('score_point')} 
                    className="py-3 px-6 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Poin</span>
                      {sortField === 'score_point' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-sky-600" /> : <ChevronDown className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                  </th>

                  <th className="py-3 px-6 text-center bg-gray-50">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-xs">
                      Tidak ada aturan norma yang cocok dengan filter atau pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="py-3 px-6 font-semibold text-gray-900">{rule.test_items?.name}</td>
                      <td className="py-3 px-6 text-gray-600 text-xs">{rule.gender}</td>
                      <td className="py-3 px-6 text-center font-medium text-sky-700">{rule.min_val} s.d {rule.max_val}</td>
                      <td className="py-3 px-6 text-center font-bold text-emerald-700">Poin {rule.score_point}</td>
                      <td className="py-3 px-6 text-center flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(rule)} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(rule.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}