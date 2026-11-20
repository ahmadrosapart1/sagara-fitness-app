'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { ShieldAlert, Menu, X } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isIdleModalOpen, setIsIdleModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Tutup drawer mobile otomatis saat berpindah halaman
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Logika Auto-Logout Berdasarkan Inaktivitas (Idle Timer) dengan Modal Modern
  useEffect(() => {
    if (isPrintPage || isLoginPage || isStudentPortal) return;

    let inactivityTimer: NodeJS.Timeout;

    const triggerIdleModal = () => {
      localStorage.removeItem('sagara_user');
      setIsIdleModalOpen(true);
    };

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // Atur durasi inaktivitas: 30 menit (30 * 60 * 1000 ms)
      inactivityTimer = setTimeout(triggerIdleModal, 30 * 60 * 1000);
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

  function handleConfirmLogout() {
    setIsIdleModalOpen(false);
    window.location.href = '/login';
  }

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
    <div className="flex min-h-screen md:h-screen bg-gray-50 md:overflow-hidden relative">
      {/* Modal Modern Inaktivitas */}
      {isIdleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-center border border-slate-100">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-base">Sesi Berakhir Otomatis</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sesi Anda telah berakhir karena tidak ada aktivitas apa pun selama <strong className="text-slate-700">30 menit</strong> demi keamanan data instansi.
              </p>
            </div>
            <button
              onClick={handleConfirmLogout}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-600/30 cursor-pointer"
            >
              Masuk Kembali ke Akun
            </button>
          </div>
        </div>
      )}

      {/* Backdrop Gelap saat Sidebar Mobile Terbuka */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Responsif (Drawer di Mobile, Statis di Desktop) */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Area Konten Utama */}
      <div className="flex-1 min-w-0 flex flex-col md:overflow-hidden">
        {/* Header Bar Khusus Mobile / Tablet Kecil */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between bg-slate-900 text-white px-4 py-3 border-b border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
            <span className="font-bold text-sm tracking-wider truncate">SAGARA</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-5 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}