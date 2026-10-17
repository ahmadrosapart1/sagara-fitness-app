'use client';

import Link from 'next/link';
import { BookOpen, Layers, GraduationCap, Award, Sliders, Database, Shield, ArrowRight, School } from 'lucide-react';

const masterMenus = [
  {
    title: 'Profil Sekolah & Pejabat',
    description: 'Kelola informasi instansi dan Kepala Sekolah penandatangan rapor',
    icon: School,
    href: '/master-data/sekolah',
    color: 'bg-sky-50 text-sky-600 border-sky-100',
  },
  {
    title: 'Program Keahlian',
    description: 'Kelola daftar program keahlian SMK Negeri 1 Karawang',
    icon: BookOpen,
    href: '/master-data/program-keahlian',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Konsentrasi Keahlian',
    description: 'Kelola konsentrasi keahlian per program keahlian',
    icon: Layers,
    href: '/master-data/konsentrasi',
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title: 'Kelas & Rombel',
    description: 'Kelola tingkat kelas, rombel, tahun ajaran, dan semester',
    icon: GraduationCap,
    href: '/master-data/kelas',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Butir Tes & BMI',
    description: 'Kelola instrumen pengujian TKJI dan antropometri',
    icon: Award,
    href: '/master-data/butir-tes',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    title: 'Norma Konversi Skor',
    description: 'Atur rentang nilai mentah ke poin skor 1 sampai 5 per tes',
    icon: Sliders,
    href: '/master-data/norma-skor',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    title: 'Kategori Grade & DUDI',
    description: 'Atur predikat akhir TKJI dan status kesiapan kerja DUDI',
    icon: Database,
    href: '/master-data/kategori-dudi',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
  },
  {
    title: 'Manajemen Pengguna & Role',
    description: 'Kelola akun guru, hak akses admin/pelatih, dan penugasan kelas',
    icon: Shield,
    href: '/master-data/profiles',
    color: 'bg-teal-50 text-teal-600 border-teal-100',
  },
];

export default function MasterDataHubPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manajemen Master Data & Parameter</h2>
          <p className="text-sm text-gray-500 mt-0.5">Pilih modul di bawah untuk mengelola data referensi sistem SAGARA</p>
        </div>
        <div className="flex items-center gap-2 bg-sky-50 text-sky-700 px-4 py-2 rounded-xl text-xs font-semibold border border-sky-100">
          <Database className="w-4 h-4" /> Master Data Center
        </div>
      </div>

      {/* Grid Menu Kartu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masterMenus.map((menu, index) => {
          const Icon = menu.icon;
          return (
            <Link
              key={index}
              href={menu.href}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${menu.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-sky-600 transition-colors">
                    {menu.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {menu.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 pt-4 mt-4 border-t border-gray-50">
                <span>Kelola Modul</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}