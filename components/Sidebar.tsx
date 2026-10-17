'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Database, 
  FileEdit, 
  LineChart, 
  FileText, 
  Network, 
  LogOut, 
  ShieldCheck,
  Globe
} from 'lucide-react';

type UserSession = {
  full_name: string;
  email: string;
  role: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    // Ambil data user yang sedang login dari localStorage
    const sessionData = localStorage.getItem('sagara_user');
    if (sessionData) {
      try {
        setUser(JSON.parse(sessionData));
      } catch (e) {
        console.error('Gagal memparsing sesi user');
      }
    }
  }, []);

  function handleLogout() {
    // Hapus data sesi dari localStorage
    localStorage.removeItem('sagara_user');
    
    // Gunakan window.location agar aplikasi melakukan hard refresh & membersihkan state total
    window.location.href = '/login';
  }

  // Daftar menu aplikasi
  const menuItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      adminOnly: false,
    },
    {
      name: 'Data Siswa',
      href: '/students',
      icon: Users,
      adminOnly: false,
    },
    {
      name: 'Master Data',
      href: '/master-data',
      icon: Database,
      adminOnly: true, // Hanya Admin yang bisa akses Master Data & Manajemen Pengguna
    },
    {
      name: 'Input Tes (TKJI)',
      href: '/input-tes',
      icon: FileEdit,
      adminOnly: false,
    },
    {
      name: 'Analisis Gap',
      href: '/gap-analysis',
      icon: LineChart,
      adminOnly: false,
    },
    {
      name: 'Rapor PDF',
      href: '/reports',
      icon: FileText,
      adminOnly: false,
    },
    
    {
      name: 'Portal Siswa (NIS)',
      href: '/student-portal',
      icon: Globe,
      adminOnly: false,
    },
  ];

  // Filter menu jika user adalah pelatih (sembunyikan menu yang adminOnly)
  const filteredMenus = menuItems.filter((item) => {
    if (item.adminOnly && user?.role !== 'admin') {
      return false;
    }
    return true;
  });

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 select-none">
      {/* Bagian Atas: Logo & Navigasi */}
      <div className="p-5 space-y-6">
        {/* Brand / Logo */}
        <div className="space-y-1">
          <h1 className="text-white font-bold text-base tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
            SAGARA
          </h1>
          <p className="text-[10px] text-slate-400">Student Athletic Growth Analytics</p>
        </div>

        {/* Daftar Menu */}
        <nav className="space-y-1 text-xs">
          {filteredMenus.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30 font-semibold'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bagian Bawah: Profil User & Tombol Keluar */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        {user && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white truncate max-w-[130px]" title={user.full_name}>
                {user.full_name}
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                user.role === 'admin' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {user.role}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate" title={user.email}>{user.email}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-semibold border border-rose-900/50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar Akun</span>
        </button>
      </div>
    </aside>
  );
}