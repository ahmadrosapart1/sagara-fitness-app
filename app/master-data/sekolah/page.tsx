'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Building2, UserCheck, MapPin, School, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/Modal';

export default function SettingsPage() {
  const [schoolName, setSchoolName] = useState('SMK Negeri 1 Karawang');
  const [city, setCity] = useState('Karawang');
  const [principalName, setPrincipalName] = useState('');
  const [principalNip, setPrincipalNip] = useState('');
  const [recordId, setRecordId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    fetchSchoolSettings();
  }, []);

  async function fetchSchoolSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRecordId(data.id);
        setSchoolName(data.school_name || 'SMK Negeri 1 Karawang');
        setCity(data.city || 'Karawang');
        setPrincipalName(data.principal_name || '');
        setPrincipalNip(data.principal_nip || '');
      }
    } catch (err: any) {
      showError('Gagal memuat pengaturan sekolah: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);

      const payload = {
        school_name: schoolName,
        city: city,
        principal_name: principalName,
        principal_nip: principalNip,
        updated_at: new Date().toISOString(),
      };

      if (recordId) {
        // Update data yang sudah ada
        const { error } = await supabase
          .from('school_settings')
          .update(payload)
          .eq('id', recordId);

        if (error) throw error;
      } else {
        // Insert jika belum ada data sama sekali
        const { data, error } = await supabase
          .from('school_settings')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        if (data) setRecordId(data.id);
      }

      showSuccess('Pengaturan profil sekolah dan kepala sekolah berhasil disimpan!');
    } catch (err: any) {
      showError('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function showSuccess(msg: string) {
    setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success' });
  }
  function showError(msg: string) {
    setModalConfig({ isOpen: true, title: 'Peringatan', message: msg, type: 'danger' });
  }

  if (loading) {
    return <div className="text-center py-20 text-xs text-gray-500 font-medium">Memuat pengaturan sekolah...</div>;
  }

  return (
    <div className="w-full space-y-4 text-xs pb-12">
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{modalConfig.message}</p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
              className="px-5 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20"
            >
              Mengerti
            </button>
          </div>
        </div>
      </Modal>

      {/* Header Halaman dengan Tombol Back (Konsisten seperti Program Keahlian) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/master-data"
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl border border-gray-200 transition-colors"
            title="Kembali ke Master Data"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-gray-900">Pengaturan Profil Sekolah & Pejabat</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Kelola informasi instansi dan Kepala Sekolah yang tercantum pada tanda tangan Rapor PDF</p>
          </div>
        </div>
      </div>

      {/* Form Pengaturan Full Width */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 border-b border-gray-100 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-600" /> Informasi Instansi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-gray-400" /> Nama Sekolah
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: SMK Negeri 1 Karawang"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" /> Kota Lokasi Dokumen
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Contoh: Karawang"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 border-b border-gray-100 pb-2 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-600" /> Pejabat Kepala Sekolah (Penandatangan Rapor)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Lengkap & Gelar Kepala Sekolah</label>
              <input
                type="text"
                required
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                placeholder="Contoh: Drs. H. Mohamad Ali, M.Pd."
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Pastikan penulisan gelar sudah sesuai untuk dokumen resmi.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">NIP Kepala Sekolah</label>
              <input
                type="text"
                required
                value={principalNip}
                onChange={(e) => setPrincipalNip(e.target.value)}
                placeholder="Contoh: 19680214 199103 1 003"
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}