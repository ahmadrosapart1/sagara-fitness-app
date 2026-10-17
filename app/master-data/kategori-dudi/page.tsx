'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit3, Award, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

type GradeSetting = {
  id: string;
  min_score: number;
  max_score: number;
  tkji_label: string;
  dudi_status: string;
  frequency: string;
  intensity: string;
  time_duration: string;
  exercise_type: string;
  dudi_evaluation: string;
};

const CACHE_KEY = 'sagara_grade_settings_cache';

export default function KategoriDudiPage() {
  const [gradeSettings, setGradeSettings] = useState<GradeSetting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [tkjiLabel, setTkjiLabel] = useState('');
  const [dudiStatus, setDudiStatus] = useState('');
  const [frequency, setFrequency] = useState('');
  const [intensity, setIntensity] = useState('');
  const [timeDuration, setTimeDuration] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [dudiEvaluation, setDudiEvaluation] = useState('');

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: undefined as (() => Promise<void>) | undefined });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) { setGradeSettings(JSON.parse(cached)); return; }
    const { data } = await supabase.from('tkji_grade_settings').select('*').order('min_score', { ascending: false });
    if (data) { setGradeSettings(data); sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  }

  function updateCache(newData: GradeSetting[]) {
    setGradeSettings(newData);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(newData));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        min_score: parseFloat(minScore),
        max_score: parseFloat(maxScore),
        tkji_label: tkjiLabel,
        dudi_status: dudiStatus,
        frequency,
        intensity,
        time_duration: timeDuration,
        exercise_type: exerciseType,
        dudi_evaluation: dudiEvaluation,
      };

      if (editingId) {
        const { error } = await supabase.from('tkji_grade_settings').update(payload).eq('id', editingId);
        if (error) throw error;
        updateCache(gradeSettings.map(g => g.id === editingId ? { ...g, ...payload } : g));
        showSuccess('Kategori predikat & preskripsi FITT berhasil diperbarui.');
      } else {
        const { data, error } = await supabase.from('tkji_grade_settings').insert([payload]).select().single();
        if (error) throw error;
        if (data) updateCache([data, ...gradeSettings]);
        showSuccess('Kategori predikat & preskripsi FITT berhasil ditambahkan.');
      }
      resetForm();
    } catch (err: any) { showError(err.message); }
  }

  function confirmDelete(id: string) {
    setModalConfig({
      isOpen: true, title: 'Konfirmasi Hapus', message: 'Hapus kategori predikat ini?', type: 'danger',
      onConfirm: async () => {
        await supabase.from('tkji_grade_settings').delete().eq('id', id);
        updateCache(gradeSettings.filter(g => g.id !== id));
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  function resetForm() {
    setEditingId(null);
    setMinScore('');
    setMaxScore('');
    setTkjiLabel('');
    setDudiStatus('');
    setFrequency('');
    setIntensity('');
    setTimeDuration('');
    setExerciseType('');
    setDudiEvaluation('');
  }

  function handleEdit(item: GradeSetting) {
    setEditingId(item.id);
    setMinScore(String(item.min_score));
    setMaxScore(String(item.max_score));
    setTkjiLabel(item.tkji_label);
    setDudiStatus(item.dudi_status);
    setFrequency(item.frequency || '');
    setIntensity(item.intensity || '');
    setTimeDuration(item.time_duration || '');
    setExerciseType(item.exercise_type || '');
    setDudiEvaluation(item.dudi_evaluation || '');
  }

  function showSuccess(msg: string) { setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success', onConfirm: undefined }); }
  function showError(msg: string) { setModalConfig({ isOpen: true, title: 'Validasi Gagal', message: msg, type: 'danger', onConfirm: undefined }); }

  const filtered = gradeSettings.filter(g => g.tkji_label.toLowerCase().includes(searchQuery.toLowerCase()) || g.dudi_status.toLowerCase().includes(searchQuery.toLowerCase()));

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
            <h2 className="text-xl font-bold text-gray-900">Kategori Grade TKJI, Kesiapan DUDI & Preskripsi FITT</h2>
            <p className="text-sm text-gray-500 mt-0.5">Kelola rentang skor, predikat, status kesiapan kerja, dan rekomendasi latihan</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-semibold border border-emerald-100">
          <Award className="w-4 h-4" /> Total: {gradeSettings.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? 'Edit Kategori & Preskripsi' : 'Tambah Kategori & Preskripsi FITT'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Skor Min</label>
                <input type="number" step="any" placeholder="22" value={minScore} onChange={e => setMinScore(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Skor Max</label>
                <input type="number" step="any" placeholder="25" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Label Predikat TKJI</label>
              <input type="text" placeholder="Contoh: Baik Sekali" value={tkjiLabel} onChange={e => setTkjiLabel(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status Kesiapan DUDI</label>
              <input type="text" placeholder="Contoh: SANGAT SIAP" value={dudiStatus} onChange={e => setDudiStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Frequency (Frekuensi Latihan)</label>
              <input type="text" placeholder="Contoh: 3-4 kali per minggu..." value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Intensity (Intensitas Latihan)</label>
              <input type="text" placeholder="Contoh: Intensitas Sedang - Tinggi..." value={intensity} onChange={e => setIntensity(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Time (Durasi Latihan)</label>
              <input type="text" placeholder="Contoh: 45 - 60 menit per sesi..." value={timeDuration} onChange={e => setTimeDuration(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type (Jenis Olahraga)</label>
              <input type="text" placeholder="Contoh: Aerobic Interval Running..." value={exerciseType} onChange={e => setExerciseType(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Evaluasi Kesiapan Kerja (DUDI)</label>
              <input type="text" placeholder="Contoh: Memenuhi standar fisik prima..." value={dudiEvaluation} onChange={e => setDudiEvaluation(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div className="flex gap-2 pt-2">
              {editingId && <button type="button" onClick={resetForm} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Batal</button>}
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-emerald-600/20"><Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Simpan'}</button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <span className="font-bold text-sm text-gray-800">Daftar Rentang Skor & Preskripsi FITT</span>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input type="text" placeholder="Cari kategori..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">
                  <th className="py-3 px-6 text-center">Skor</th>
                  <th className="py-3 px-6">Predikat & DUDI</th>
                  <th className="py-3 px-6">Preskripsi FITT Ringkas</th>
                  <th className="py-3 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filtered.map((grade) => (
                  <tr key={grade.id} className="hover:bg-gray-50">
                    <td className="py-3 px-6 text-center font-bold text-sky-700 whitespace-nowrap">{grade.min_score} - {grade.max_score}</td>
                    <td className="py-3 px-6">
                      <div className="font-semibold text-gray-900">{grade.tkji_label}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-bold text-[10px] border border-emerald-100">{grade.dudi_status}</span>
                    </td>
                    <td className="py-3 px-6 text-gray-600 space-y-0.5 max-w-xs">
                      <div><strong className="text-gray-800">Freq:</strong> {grade.frequency || '-'}</div>
                      <div><strong className="text-gray-800">Type:</strong> {grade.exercise_type || '-'}</div>
                    </td>
                    <td className="py-3 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(grade)} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(grade.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
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