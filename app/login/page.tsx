'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shield, Lock, Mail, ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // Cek langsung ke tabel profiles berdasarkan email & password
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !profile) {
        throw new Error('Email atau kata sandi salah. Silakan periksa kembali.');
      }

      // Simpan sesi user ke localStorage agar aplikasi mengenali siapa yang login
      localStorage.setItem('sagara_user', JSON.stringify(profile));

      // Arahkan ke dashboard utama
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal melakukan login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-8">
      <div className="max-w-md w-full space-y-4">
        {/* Kotak Utama Login Admin / Pelatih */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-sky-50 text-sky-600 rounded-2xl mb-1 shadow-sm">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Sagara - SMK Negeri 1 Karawang</h1>
            <p className="text-xs text-slate-500">Sistem Pelacakan Pertumbuhan Atletik & Kebugaran Siswa</p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1.5">Email Pengguna</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="nama@smkn1karawang.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500 text-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1.5">Kata Sandi (Password)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-sky-500 text-slate-800"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Memproses Masuk...' : 'Masuk sebagai Guru / Admin'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Butuh bantuan akses akun? Hubungi Administrator Sekolah.
            </p>
          </div>
        </div>

        {/* Tombol Pintasan Khusus Siswa (Cek Mandiri NIS) */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 text-center space-y-3 backdrop-blur-sm shadow-xl">
          <div className="space-y-1">
            <p className="text-xs font-bold text-white">Anda adalah Siswa SMK Negeri 1 Karawang?</p>
            <p className="text-[11px] text-slate-400">Cek rekam jejak tes kebugaran dan analisis latihan Anda secara mandiri menggunakan NIS.</p>
          </div>
          <Link
            href="/student-portal"
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-sky-400 hover:text-sky-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-xs border border-slate-600"
          >
            <Search className="w-4 h-4" /> Buka Portal Cek Mandiri Siswa (NIS)
          </Link>
        </div>
      </div>
    </div>
  );
}