'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isPrintPage = pathname?.includes('/print');
  const isLoginPage = pathname === '/login';
  const isStudentPortal = pathname?.startsWith('/student-portal');

  useEffect(() => {
    // Jika halaman login, cetak, atau portal siswa, izinkan akses tanpa cek sesi login admin/pelatih
    if (isPrintPage || isLoginPage || isStudentPortal) {
      setIsAuthorized(true);
      return;
    }

    // Periksa apakah data sesi login ada di localStorage
    const sessionData = localStorage.getItem('sagara_user');
    if (!sessionData) {
      // Jika tidak ada sesi, paksa redirect ke halaman login
      router.replace('/login');
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router, isPrintPage, isLoginPage, isStudentPortal]);

  // Render halaman login, cetak, atau portal siswa secara mandiri tanpa Sidebar admin
  if (isPrintPage || isLoginPage || isStudentPortal) {
    return <main className="w-full bg-slate-900 min-h-screen">{children}</main>;
  }

  // Tampilkan loading sebentar saat verifikasi sesi untuk mencegah konten berkedip
  if (!isAuthorized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-50 text-xs text-gray-500 font-medium">
        Memeriksa sesi keamanan sistem...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}