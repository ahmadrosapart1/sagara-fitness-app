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

  // Logika Auto-Logout Berdasarkan Inaktivitas (Idle Timer)
  useEffect(() => {
    if (isPrintPage || isLoginPage || isStudentPortal) return;

    let inactivityTimer: NodeJS.Timeout;

    const logoutUser = () => {
      localStorage.removeItem('sagara_user');
      alert('Sesi Anda telah berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.');
      window.location.href = '/login';
    };

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // Atur durasi inaktivitas: 30 menit (30 * 60 * 1000 ms)
      // Anda bisa ubah misal jadi (5 * 60 * 1000) untuk uji coba 5 menit
      inactivityTimer = setTimeout(logoutUser, 30 * 60 * 1000);
    };

    // Daftar aktivitas mouse/keyboard yang mendeteksi keaktifan pengguna
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Inisialisasi timer pertama kali
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isPrintPage, isLoginPage, isStudentPortal]);

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