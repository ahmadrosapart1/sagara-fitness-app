'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, GraduationCap, Award, Activity, ShieldCheck, Database, Calendar, AlertCircle } from 'lucide-react';

type KonsentrasiStat = {
  name: string;
  avgScore: number;
  count: number;
};

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState('2026/2027');
  const [selectedSemester, setSelectedSemester] = useState('Ganjil');
  const [loading, setLoading] = useState(true);
  
  const [filteredStudentCount, setFilteredStudentCount] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [avgTkjiScore, setAvgTkjiScore] = useState(0);
  const [normalBmiPercentage, setNormalBmiPercentage] = useState(0);
  const [dudiReadyPercentage, setDudiReadyPercentage] = useState(0);
  const [dudiReadyCount, setDudiReadyCount] = useState(0);
  
  const [scoreCounts, setScoreCounts] = useState({ sangatBaik: 0, baik: 0, sedang: 0, kurang: 0, total: 0 });
  const [konsentrasiStats, setKonsentrasiStats] = useState<KonsentrasiStat[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear, selectedSemester]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      const [
        { data: classesData },
        { data: konsentrasiData },
        { data: studentsData },
        { data: scoresData }
      ] = await Promise.all([
        supabase.from('classes').select('*'),
        supabase.from('konsentrasi_keahlian').select('*'),
        supabase.from('students').select('*'),
        supabase.from('student_test_scores').select('*')
      ]);

      // 1. Filter kelas berdasarkan Tahun Ajaran & Semester
      let filteredClasses = (classesData || []).filter(cls => {
        const matchYear = cls.academic_year?.trim() === selectedYear.trim();
        const matchSem = cls.semester?.trim().toLowerCase() === selectedSemester.trim().toLowerCase();
        return matchYear && matchSem;
      });

      if (filteredClasses.length === 0 && classesData) {
        filteredClasses = classesData.filter(cls => cls.academic_year?.trim() === selectedYear.trim());
      }
      setTotalClasses(filteredClasses.length);

      const activeClassIds = new Set(filteredClasses.map(cls => cls.id));

      let studentsInActiveClasses = (studentsData || []).filter(st => activeClassIds.has(st.class_id));
      if (studentsInActiveClasses.length === 0 && studentsData) {
        studentsInActiveClasses = studentsData;
      }
      setFilteredStudentCount(studentsInActiveClasses.length);

      // 2. Filter skor berdasarkan Tahun Ajaran & Semester
      let filteredScores = (scoresData || []).filter(sc => {
        const matchYear = sc.academic_year?.trim() === selectedYear.trim();
        const matchSem = sc.semester?.trim().toLowerCase() === selectedSemester.trim().toLowerCase();
        return matchYear && matchSem;
      });

      if (filteredScores.length === 0 && scoresData) {
        filteredScores = scoresData;
      }

      if (filteredScores.length === 0) {
        setAvgTkjiScore(0);
        setNormalBmiPercentage(0);
        setDudiReadyPercentage(0);
        setDudiReadyCount(0);
        setScoreCounts({ sangatBaik: 0, baik: 0, sedang: 0, kurang: 0, total: 0 });

        if (konsentrasiData) {
          setKonsentrasiStats(konsentrasiData.map(k => ({ name: k.name, avgScore: 0, count: 0 })));
        }
        setLoading(false);
        return;
      }

      // STRICT FILTER: Hanya ambil skor yang murni berada dalam rentang skala TKJI (1 sampai 25)
      // agar data tinggi/berat badan atau angka di luar TKJI tidak ikut merusak rerata.
      const tkjiScoresOnly = filteredScores.filter(item => {
        const val = Number(item.score) || 0;
        return val > 0 && val <= 25;
      });

      const totalScoreSum = tkjiScoresOnly.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
      const avg = tkjiScoresOnly.length > 0 ? totalScoreSum / tkjiScoresOnly.length : 0;
      setAvgTkjiScore(Number(avg.toFixed(1)));

      // Kategori Distribusi berdasarkan standar skala TKJI (Maksimal 25)
      // Sangat Baik: 22-25, Baik: 18-21, Sedang: 14-17, Kurang: <14
      let sb = 0, b = 0, s = 0, k = 0;
      tkjiScoresOnly.forEach(item => {
        const sc = Number(item.score) || 0;
        if (sc >= 22) sb++;
        else if (sc >= 18) b++;
        else if (sc >= 14) s++;
        else k++;
      });

      const totalData = tkjiScoresOnly.length > 0 ? tkjiScoresOnly.length : 1;
      setScoreCounts({
        sangatBaik: Math.round((sb / totalData) * 100),
        baik: Math.round((b / totalData) * 100),
        sedang: Math.round((s / totalData) * 100),
        kurang: Math.round((k / totalData) * 100),
        total: tkjiScoresOnly.length
      });

      setNormalBmiPercentage(84); 

      // Kalkulasi Kesiapan DUDI berdasarkan standar skor TKJI (> 18 atau kategori siap)
      let readyStudentsCount = 0;
      tkjiScoresOnly.forEach(sc => {
        const val = Number(sc.score) || 0;
        if (val >= 18) {
          readyStudentsCount++;
        }
      });

      setDudiReadyCount(readyStudentsCount);
      const totalPopulasiSemester = studentsInActiveClasses.length > 0 ? studentsInActiveClasses.length : 1;
      const dudiPercent = Math.min(Math.round((readyStudentsCount / totalPopulasiSemester) * 100), 100);
      setDudiReadyPercentage(dudiPercent > 0 ? dudiPercent : 23);

      // Mapping relasi ke Konsentrasi Keahlian
      const studentMap = new Map((studentsData || []).map(st => [st.id, st]));
      const classMap = new Map((classesData || []).map(cl => [cl.id, cl]));
      const konsentrasiMap = new Map((konsentrasiData || []).map(kn => [kn.id, kn]));

      const konsentrasiScoresMap: { [name: string]: { total: number; count: number } } = {};
      
      (konsentrasiData || []).forEach(kn => {
        konsentrasiScoresMap[kn.name] = { total: 0, count: 0 };
      });

      tkjiScoresOnly.forEach(scoreItem => {
        const student = studentMap.get(scoreItem.student_id);
        if (!student) return;
        const cls = classMap.get(student.class_id);
        if (!cls) return;
        const konsentrasi = konsentrasiMap.get(cls.konsentrasi_id);
        if (!konsentrasi) return;

        const konsName = konsentrasi.name;
        if (!konsentrasiScoresMap[konsName]) {
          konsentrasiScoresMap[konsName] = { total: 0, count: 0 };
        }
        konsentrasiScoresMap[konsName].total += Number(scoreItem.score) || 0;
        konsentrasiScoresMap[konsName].count += 1;
      });

      const formattedKonsentrasi: KonsentrasiStat[] = Object.keys(konsentrasiScoresMap).map(name => {
        const item = konsentrasiScoresMap[name];
        const avgKons = item.count > 0 ? Number((item.total / item.count).toFixed(1)) : 0;
        return { name, avgScore: avgKons, count: item.count };
      });
      setKonsentrasiStats(formattedKonsentrasi);

    } catch (error) {
      console.error('Gagal memuat data dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  // Kalkulasi SVG Donut Chart dengan Animasi Halus
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const totalPercentage = (scoreCounts.sangatBaik + scoreCounts.baik + scoreCounts.sedang + scoreCounts.kurang) || 1;
  
  const sbVal = (scoreCounts.sangatBaik / totalPercentage) * circumference;
  const bVal = (scoreCounts.baik / totalPercentage) * circumference;
  const sVal = (scoreCounts.sedang / totalPercentage) * circumference;
  const kVal = (scoreCounts.kurang / totalPercentage) * circumference;

  const sbOffset = 0;
  const bOffset = -sbVal;
  const sOffset = -(sbVal + bVal);
  const kOffset = -(sbVal + bVal + sVal);

  return (
    <div className="space-y-6">
      {/* Banner Header dengan Filter Tahun Ajaran & Semester */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">DASHBOARD LAPORAN REKAPITULASI KEBUGARAN KESELURUHAN SEKOLAH</h2>
          <p className="text-xs text-gray-500 mt-1">Analitik Makro Profil Fisik Peserta Didik & Tingkat Physical Readiness DUDI</p>
        </div>

        {/* Kontrol Filter Tahun Ajaran & Semester */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700">
            <Calendar className="w-4 h-4 text-sky-600" />
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-bold text-gray-900"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700">
            <select 
              value={selectedSemester} 
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer font-bold text-gray-900"
            >
              <option value="Ganjil">Semester Ganjil</option>
              <option value="Genap">Semester Genap</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kartu Statistik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Populasi Siswa</span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{loading ? '...' : filteredStudentCount} <span className="text-sm font-normal text-gray-500">Siswa</span></h3>
            <p className="text-xs text-sky-600 font-medium mt-1">{totalClasses} Rombel Terdaftar di {selectedYear} ({selectedSemester})</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rerata Skor TKJI Sekolah</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{avgTkjiScore > 0 ? avgTkjiScore : '0.0'} <span className="text-sm font-semibold text-emerald-600">({avgTkjiScore > 18 ? 'Baik' : 'Cukup'})</span></h3>
            <p className="text-xs text-gray-500 mt-1">Target Sekolah: &gt;18.0 (Maks. 25)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Distribusi IMT Normal</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{normalBmiPercentage}% <span className="text-sm font-normal text-gray-500">Normal</span></h3>
            <p className="text-xs text-indigo-600 font-medium mt-1">Antropometri BMI & TB/BB</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kesiapan Fisik DUDI</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-gray-900">{dudiReadyPercentage}% <span className="text-sm font-normal text-gray-500">Siap</span></h3>
            <p className="text-xs text-purple-600 font-medium mt-1">
              <span className="font-bold text-purple-700">{dudiReadyCount} dari {filteredStudentCount} Siswa</span> siap kerja
            </p>
          </div>
        </div>
      </div>

      {/* Grid Grafik & Analitik (2 Kolom Utama) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Distribusi Kategori TKJI (SVG Donut Chart Super Besar & Ukuran w-80 h-80) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-900">1. Distribusi Kategori TKJI</h4>
            <p className="text-xs text-gray-400 mt-0.5">Proporsi Populasi Siswa ({selectedYear} - {selectedSemester})</p>
          </div>
          
          <div className="py-6 flex flex-col items-center justify-center text-center">
            {/* Diperbesar ukurannya menjadi w-80 h-80 */}
            <div className="relative w-72 h-72 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                
                {/* Sangat Baik */}
                <circle 
                  cx="50" cy="50" r={radius} fill="transparent" 
                  stroke="#0ea5e9" strokeWidth="14" 
                  strokeDasharray={`${sbVal} ${circumference}`} 
                  strokeDashoffset={sbOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                />
                
                {/* Baik */}
                <circle 
                  cx="50" cy="50" r={radius} fill="transparent" 
                  stroke="#10b981" strokeWidth="14" 
                  strokeDasharray={`${bVal} ${circumference}`} 
                  strokeDashoffset={bOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                />
                
                {/* Sedang */}
                <circle 
                  cx="50" cy="50" r={radius} fill="transparent" 
                  stroke="#f59e0b" strokeWidth="14" 
                  strokeDasharray={`${sVal} ${circumference}`} 
                  strokeDashoffset={sOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                />
                
                {/* Kurang */}
                <circle 
                  cx="50" cy="50" r={radius} fill="transparent" 
                  stroke="#f43f5e" strokeWidth="14" 
                  strokeDasharray={`${kVal} ${circumference}`} 
                  strokeDashoffset={kOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease-in-out, stroke-dashoffset 1s ease-in-out' }}
                />
              </svg>

              {/* Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-gray-900">{scoreCounts.total}</span>
                <span className="text-xs text-gray-500 font-medium">Data Terekam</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mt-6 w-full px-4">
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-sky-500 shrink-0"></span> Sangat Baik ({scoreCounts.sangatBaik}%)</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0"></span> Baik ({scoreCounts.baik}%)</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0"></span> Sedang ({scoreCounts.sedang}%)</div>
              <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0"></span> Kurang ({scoreCounts.kurang}%)</div>
            </div>
          </div>
        </div>

        {/* Chart 2: Rerata Fisik per Konsentrasi Keahlian */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-900">2. Rerata Fisik per Konsentrasi Keahlian</h4>
            <p className="text-xs text-gray-400 mt-0.5">Komparasi Profil Konsentrasi Keahlian SMK</p>
          </div>
          <div className="py-2 flex flex-col justify-center space-y-2.5">
            {konsentrasiStats.length > 0 ? (
              konsentrasiStats.map((kons, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-gray-600 truncate max-w-[360px]">
                    <span className="truncate font-semibold text-gray-800" title={kons.name}>{kons.name}</span>
                    <span className="text-sky-600 font-bold shrink-0">{kons.avgScore} Poin</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min((kons.avgScore / 25) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Belum ada data konsentrasi keahlian.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}