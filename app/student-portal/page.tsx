'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, User, Award, TrendingUp, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

type TestPeriodRecord = {
  sessionNumber: string;
  date: string;
  weight: number;
  height: number;
  bmi: number;
  bmiStatus: string;
  sprint: string;
  chinUp: string;
  sitUp: string;
  vertJump: string;
  runDist: string;
  totalTkji: number;
  categoryTkji: string;
  rawPoints: {
    sprint: number;
    chinUp: number;
    sitUp: number;
    vertJump: number;
    run: number;
  };
};

type Prescription = {
  frequency: string;
  intensity: string;
  timeDuration: string;
  exerciseType: string;
  dudiEvaluation: string;
};

type TestItemDelta = {
  itemName: string;
  test1Val: string;
  test1Pt: number;
  latestVal: string;
  latestPt: number;
  deltaPt: number;
  status: string;
};

type StudentPortalData = {
  id: string;
  nis: string;
  full_name: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  photo_url?: string;
  className: string;
  latestWeight: number;
  latestHeight: number;
  latestBmi: number;
  latestBmiStatus: string;
  latestTkjiScore: number;
  latestTkjiLabel: string;
  dudiStatus: string;
  history: TestPeriodRecord[];
  baselineLabel: string;
  gapVsBenchmark: number;
  itemDeltas: TestItemDelta[];
  prescription: Prescription;
};

export default function StudentPortalPage() {
  const [nisInput, setNisInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<StudentPortalData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  function calculateItemScore(testName: string, rawValue: number) {
    if (!rawValue || rawValue <= 0) return 0;
    const name = testName.toLowerCase();
    if (name.includes('sprint') || name.includes('60m')) {
      return rawValue <= 7.2 ? 5 : rawValue <= 8.3 ? 4 : rawValue <= 9.6 ? 3 : rawValue <= 11.0 ? 2 : 1;
    }
    if (name.includes('chin') || name.includes('pull')) {
      return rawValue >= 15 ? 5 : rawValue >= 11 ? 4 : rawValue >= 7 ? 3 : rawValue >= 3 ? 2 : 1;
    }
    if (name.includes('sit up')) {
      return rawValue >= 41 ? 5 : rawValue >= 30 ? 4 : rawValue >= 21 ? 3 : rawValue >= 10 ? 2 : 1;
    }
    if (name.includes('jump') || name.includes('vertical')) {
      return rawValue >= 73 ? 5 : rawValue >= 60 ? 4 : rawValue >= 50 ? 3 : rawValue >= 39 ? 2 : 1;
    }
    if (name.includes('lari') || name.includes('run') || name.includes('1000') || name.includes('1200')) {
      return rawValue <= 200 ? 5 : rawValue <= 250 ? 4 : rawValue <= 320 ? 3 : rawValue <= 400 ? 2 : 1;
    }
    return 0;
  }

  async function handleSearchStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!nisInput.trim()) {
      setErrorMessage('Silakan masukkan NIS Anda terlebih dahulu.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setStudentData(null);

      // Cari siswa berdasarkan NIS
      const { data: stu, error: stuErr } = await supabase
        .from('students')
        .select('id, nis, full_name, gender, birth_place, birth_date, photo_url, class_id, classes(name)')
        .eq('nis', nisInput.trim())
        .maybeSingle();

      if (stuErr) throw stuErr;
      if (!stu) {
        setErrorMessage('NIS tidak ditemukan dalam database SMK Negeri 1 Karawang. Pastikan nomor induk benar.');
        setLoading(false);
        return;
      }

      // Ambil nilai tes siswa
      const { data: scores, error: scoreErr } = await supabase
        .from('student_test_scores')
        .select(`score, test_date, test_items (name)`)
        .eq('student_id', stu.id);

      if (scoreErr) throw scoreErr;

      const sessionMap = new Map<string, any[]>();
      scores?.forEach((sc: any) => {
        const dateKey = sc.test_date || '2026-10-14';
        if (!sessionMap.has(dateKey)) sessionMap.set(dateKey, []);
        sessionMap.get(dateKey)!.push(sc);
      });

      const historyRecords: TestPeriodRecord[] = [];
      let sessionIdx = 1;

      sessionMap.forEach((items, dateStr) => {
        let w = 0, h = 0, tTkji = 0;
        let sVal = '-', cVal = '-', suVal = '-', vjVal = '-', rVal = '-';
        let pSprint = 0, pChin = 0, pSit = 0, pJump = 0, pRun = 0;

        items.forEach((sc: any) => {
          const tName = sc.test_items?.name || '';
          const val = Number(sc.score) || 0;
          const lower = tName.toLowerCase();

          if (lower.includes('berat') || lower.includes('bb') || lower.includes('weight')) {
            w = val;
          } else if (lower.includes('tinggi') || lower.includes('tb') || lower.includes('height')) {
            h = val;
          } else {
            const pts = calculateItemScore(tName, val);
            tTkji += pts;
            if (lower.includes('sprint') || lower.includes('60m')) { sVal = `${val}s (${pts})`; pSprint = pts; }
            else if (lower.includes('chin') || lower.includes('pull')) { cVal = `${val}x (${pts})`; pChin = pts; }
            else if (lower.includes('sit up')) { suVal = `${val}x (${pts})`; pSit = pts; }
            else if (lower.includes('jump') || lower.includes('vertical')) { vjVal = `${val}cm (${pts})`; pJump = pts; }
            else if (lower.includes('lari') || lower.includes('run')) { rVal = `${val}s (${pts})`; pRun = pts; }
          }
        });

        const finalTkji = Math.min(tTkji, 25);
        let cat = 'Kurang';
        if (finalTkji >= 22) cat = 'Sangat Baik';
        else if (finalTkji >= 18) cat = 'Baik';
        else if (finalTkji >= 14) cat = 'Sedang';

        let bmiVal = 0;
        let bmiStat = '-';
        if (w > 0 && h > 0) {
          const hm = h / 100;
          bmiVal = Number((w / (hm * hm)).toFixed(1));
          bmiStat = bmiVal < 18.5 ? `Kurus (${bmiVal})` : bmiVal <= 24.9 ? `Normal (${bmiVal})` : `Obesitas (${bmiVal})`;
        }

        historyRecords.push({
          sessionNumber: `Tes ${sessionIdx}`,
          date: dateStr,
          weight: w,
          height: h,
          bmi: bmiVal,
          bmiStatus: bmiStat,
          sprint: sVal,
          chinUp: cVal,
          sitUp: suVal,
          vertJump: vjVal,
          runDist: rVal,
          totalTkji: finalTkji,
          categoryTkji: cat,
          rawPoints: { sprint: pSprint, chinUp: pChin, sitUp: pSit, vertJump: pJump, run: pRun }
        });
        sessionIdx++;
      });

      const baseline = historyRecords[0] || { totalTkji: 0, categoryTkji: 'Belum Dinilai' };
      const latest = historyRecords[historyRecords.length - 1] || {
        weight: 0, height: 0, bmi: 0, bmiStatus: '-', totalTkji: 0, categoryTkji: 'Belum Dinilai',
        rawPoints: { sprint: 0, chinUp: 0, sitUp: 0, vertJump: 0, run: 0 }
      };

      let dudi = 'BELUM SIAP';
      if (latest.totalTkji >= 22) dudi = 'SANGAT SIAP';
      else if (latest.totalTkji >= 18) dudi = 'SIAP';
      else if (latest.totalTkji >= 14) dudi = 'CUKUP SIAP';
      else if (latest.totalTkji > 0) dudi = 'PERLU PEMBINAAN';

      const gapVsBenchmark = latest.totalTkji - 18;

      const { data: settingData } = await supabase
        .from('tkji_grade_settings')
        .select('*')
        .lte('min_score', latest.totalTkji)
        .gte('max_score', latest.totalTkji)
        .maybeSingle();

      const itemKeys = [
        { key: 'sprint', name: 'Lari Cepat 60m' },
        { key: 'chinUp', name: 'Chin Up / Pull Up' },
        { key: 'sitUp', name: 'Sit Up 60 Detik' },
        { key: 'vertJump', name: 'Vertical Jump' },
        { key: 'run', name: 'Lari Jarak Sedang' }
      ];

      const itemDeltas: TestItemDelta[] = itemKeys.map(item => {
        const t1Val = baseline ? (baseline as any)[item.key === 'sprint' ? 'sprint' : item.key === 'chinUp' ? 'chinUp' : item.key === 'sitUp' ? 'sitUp' : item.key === 'vertJump' ? 'vertJump' : 'runDist'] : '-';
        const t1Pt = baseline?.rawPoints ? (baseline.rawPoints as any)[item.key] || 0 : 0;
        const latestVal = latest ? (latest as any)[item.key === 'sprint' ? 'sprint' : item.key === 'chinUp' ? 'chinUp' : item.key === 'sitUp' ? 'sitUp' : item.key === 'vertJump' ? 'vertJump' : 'runDist'] : '-';
        const latestPt = latest?.rawPoints ? (latest.rawPoints as any)[item.key] || 0 : 0;
        const delta = latestPt - t1Pt;

        let status = 'Stabil / Konsisten';
        if (delta >= 2) status = 'Sangat Signifikan (Optimal)';
        else if (delta === 1) status = 'Peningkatan Positif';
        else if (delta < 0) status = 'Perlu Perhatian / Latihan Intensif';

        return {
          itemName: item.name,
          test1Val: t1Val,
          test1Pt: t1Pt,
          latestVal: latestVal,
          latestPt: latestPt,
          deltaPt: delta,
          status
        };
      });

      const prescription: Prescription = {
        frequency: settingData?.frequency || '3 - 4 kali per minggu secara teratur untuk menjaga ambang daya tahan kardiovaskular.',
        intensity: settingData?.intensity || 'Intensitas Sedang - Tinggi (70% - 85% dari Detak Jantung Maksimal / HRmax).',
        timeDuration: settingData?.time_duration || '45 - 60 menit per sesi latihan, mencakup pemanasan, inti, dan pendinginan.',
        exerciseType: settingData?.exercise_type || 'Aerobic Interval Running, Plyometric Tunggal, & Core Strength Maintenance.',
        dudiEvaluation: settingData?.dudi_evaluation || 'Memenuhi standar fisik prima industri manufaktur/otomotif.'
      };

      const classNameData = stu.classes as any;
      const className = Array.isArray(classNameData) ? classNameData[0]?.name : classNameData?.name || '-';

      setStudentData({
        id: stu.id,
        nis: stu.nis || '-',
        full_name: stu.full_name,
        gender: stu.gender === 'Perempuan' ? 'P' : 'L',
        birth_place: stu.birth_place || '',
        birth_date: stu.birth_date || '',
        photo_url: stu.photo_url,
        className,
        latestWeight: latest.weight,
        latestHeight: latest.height,
        latestBmi: latest.bmi,
        latestBmiStatus: latest.bmiStatus,
        latestTkjiScore: latest.totalTkji,
        latestTkjiLabel: `${latest.totalTkji} (${latest.categoryTkji})`,
        dudiStatus: settingData?.dudi_status || dudi,
        history: historyRecords,
        baselineLabel: `${baseline.totalTkji || 0} (${baseline.categoryTkji || 'Kurang'})`,
        gapVsBenchmark,
        itemDeltas,
        prescription
      });
    } catch (err: any) {
      setErrorMessage('Terjadi kesalahan saat mengambil data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-black text-white shadow-lg shadow-sky-500/30 shrink-0">
            SG
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-wide text-white truncate">
              PORTAL MANDIRI SISWA — SAGARA
            </h1>
            <p className="text-[10px] text-slate-400 leading-snug">
              SMK Negeri 1 Karawang • Cek Profil Kebugaran & Analisis Gap
            </p>
          </div>
        </div>
        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-600 shrink-0 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Kembali ke Login Utama</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
        {/* Form Pencarian NIS */}
        {!studentData && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-xl text-center max-w-xl mx-auto my-6 sm:my-12 space-y-6">
            <div className="w-16 h-16 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                Cek Rekam Jejak Kebugaran & Latihan
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Masukkan Nomor Induk Siswa (NIS) Anda untuk melihat grafik progres latihan, analisis gap, dan rekomendasi FITT secara mandiri.
              </p>
            </div>

            <form onSubmit={handleSearchStudent} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Masukkan Nomor NIS Anda (contoh: 24251144)..."
                  value={nisInput}
                  onChange={(e) => setNisInput(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-medium"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium text-left">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-600/30 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Memuat Data Siswa...' : 'Tampilkan Analisis Rapor & Latihan'}
              </button>
            </form>
          </div>
        )}

        {/* Hasil Analisis Siswa */}
        {studentData && (
          <div className="space-y-5 sm:space-y-6 animate-fadeIn min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800 border border-slate-700 p-4 rounded-xl">
              <div className="text-xs text-slate-300">
                Menampilkan Data atas NIS: <strong className="text-white">{studentData.nis}</strong>
              </div>
              <button
                type="button"
                onClick={() => setStudentData(null)}
                className="w-full sm:w-auto px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
              >
                Cek NIS Lain
              </button>
            </div>

            {/* Profil Ringkas */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row gap-5 lg:items-center lg:justify-between min-w-0">
              <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left min-w-0">
                <div className="w-16 h-20 bg-slate-700 rounded-xl overflow-hidden border border-slate-600 flex items-center justify-center shrink-0">
                  {studentData.photo_url ? (
                    <img
                      src={studentData.photo_url}
                      alt={studentData.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-base text-white break-words">
                    {studentData.full_name}
                  </h3>
                  <p className="text-xs text-slate-400 break-words">
                    NIS: <span className="font-semibold text-slate-200">{studentData.nis}</span> | Kelas:{' '}
                    <span className="font-bold text-sky-400">{studentData.className}</span>
                  </p>
                  <p className="text-xs text-slate-400 break-words">
                    Status DUDI: <span className="font-bold text-emerald-400">{studentData.dudiStatus}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-center">
                  <span className="block text-[10px] text-sky-400 font-semibold uppercase mb-0.5">
                    Baseline (Tes 1)
                  </span>
                  <span className="text-xs font-bold text-white">{studentData.baselineLabel}</span>
                </div>
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-center">
                  <span className="block text-[10px] text-emerald-400 font-semibold uppercase mb-0.5">
                    Tes Terakhir
                  </span>
                  <span className="text-xs font-bold text-white">{studentData.latestTkjiLabel}</span>
                </div>
                <div
                  className={`border p-3 rounded-xl text-center ${
                    studentData.gapVsBenchmark >= 0
                      ? 'bg-indigo-950/40 border-indigo-800/50 text-indigo-200'
                      : 'bg-amber-950/40 border-amber-800/50 text-amber-200'
                  }`}
                >
                  <span className="block text-[10px] font-semibold uppercase opacity-80 mb-0.5">
                    Gap vs Benchmark
                  </span>
                  <span className="text-xs font-bold">
                    {studentData.gapVsBenchmark >= 0
                      ? `+${studentData.gapVsBenchmark} Pt (Above Target)`
                      : `${studentData.gapVsBenchmark} Pt`}
                  </span>
                </div>
              </div>
            </div>

            {/* Matriks Evaluasi Gap per Butir Tes */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 min-w-0">
              <h4 className="font-bold text-sky-400 text-xs flex items-center gap-2 uppercase tracking-wide leading-snug">
                <Award className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Matriks Evaluasi Gap per Butir Tes (Tes Awal vs Tes Terakhir)</span>
              </h4>
              <div className="overflow-x-auto border border-slate-700 rounded-xl">
                <table className="w-full text-left border-collapse text-xs min-w-[680px]">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="p-3 whitespace-nowrap">Butir Tes Physical</th>
                      <th className="p-3 text-center whitespace-nowrap">Tes 1 (Baseline)</th>
                      <th className="p-3 text-center whitespace-nowrap">Tes Terakhir</th>
                      <th className="p-3 text-center whitespace-nowrap">Gap Delta</th>
                      <th className="p-3 whitespace-nowrap">Status Evaluasi & Progres</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-slate-200">
                    {studentData.itemDeltas.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="p-3 font-semibold text-white whitespace-nowrap">{item.itemName}</td>
                        <td className="p-3 text-center text-slate-400 whitespace-nowrap">
                          {item.test1Val} ({item.test1Pt} Pt)
                        </td>
                        <td className="p-3 text-center font-bold text-sky-400 whitespace-nowrap">
                          {item.latestVal} ({item.latestPt} Pt)
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-400 whitespace-nowrap">
                          {item.deltaPt > 0 ? `+${item.deltaPt} Pt` : `${item.deltaPt} Pt`}
                        </td>
                        <td className="p-3 font-medium whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              item.deltaPt >= 2
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.deltaPt === 1
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Preskripsi Latihan FITT Semantik */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 min-w-0">
              <h4 className="font-bold text-sky-400 text-xs flex items-center gap-2 uppercase tracking-wide leading-snug">
                <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Detail Preskripsi & Rekomendasi Latihan (Prinsip FITT Semantik)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700 space-y-1">
                  <span className="font-semibold text-slate-400 block">Frequency (Frekuensi Latihan):</span>
                  <p className="font-medium text-white leading-relaxed">{studentData.prescription.frequency}</p>
                </div>
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700 space-y-1">
                  <span className="font-semibold text-slate-400 block">Intensity (Intensitas Latihan):</span>
                  <p className="font-medium text-white leading-relaxed">{studentData.prescription.intensity}</p>
                </div>
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700 space-y-1">
                  <span className="font-semibold text-slate-400 block">Time (Durasi Sesi):</span>
                  <p className="font-medium text-white leading-relaxed">{studentData.prescription.timeDuration}</p>
                </div>
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700 space-y-1">
                  <span className="font-semibold text-slate-400 block">Type (Jenis Olahraga):</span>
                  <p className="font-medium text-white leading-relaxed">{studentData.prescription.exerciseType}</p>
                </div>
              </div>
              <div className="p-3.5 bg-emerald-950/30 rounded-xl border border-emerald-800/40 text-emerald-300 text-xs font-medium leading-relaxed">
                <span className="font-bold text-emerald-400">Evaluasi Industri (DUDI):</span> {studentData.prescription.dudiEvaluation}
              </div>
            </div>

            {/* Riwayat Historis Lintas Sesi */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 min-w-0">
              <h4 className="font-bold text-sky-400 text-xs uppercase tracking-wide">
                Rekapitulasi Riwayat Seluruh Periode Tes
              </h4>
              <div className="overflow-x-auto border border-slate-700 rounded-xl">
                <table className="w-full text-left border-collapse text-xs min-w-[820px]">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="p-3 whitespace-nowrap">Periode Tes</th>
                      <th className="p-3 whitespace-nowrap">Tanggal</th>
                      <th className="p-3 text-center whitespace-nowrap">BB/TB</th>
                      <th className="p-3 text-center whitespace-nowrap">IMT</th>
                      <th className="p-3 text-center whitespace-nowrap">Sprint 60m</th>
                      <th className="p-3 text-center whitespace-nowrap">Chin Up</th>
                      <th className="p-3 text-center whitespace-nowrap">Sit Up</th>
                      <th className="p-3 text-center whitespace-nowrap">Vert. Jump</th>
                      <th className="p-3 text-center whitespace-nowrap">Lari</th>
                      <th className="p-3 text-center whitespace-nowrap">Total Skor</th>
                      <th className="p-3 text-center whitespace-nowrap">Kategori</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-slate-200">
                    {studentData.history.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-4 text-center text-slate-400">
                          Belum ada riwayat tes tercatat.
                        </td>
                      </tr>
                    ) : (
                      studentData.history.map((h, i) => (
                        <tr key={i} className="hover:bg-slate-700/30">
                          <td className="p-3 font-semibold text-white whitespace-nowrap">{h.sessionNumber}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{h.date}</td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {h.weight}/{h.height}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">{h.bmiStatus}</td>
                          <td className="p-3 text-center whitespace-nowrap">{h.sprint}</td>
                          <td className="p-3 text-center whitespace-nowrap">{h.chinUp}</td>
                          <td className="p-3 text-center whitespace-nowrap">{h.sitUp}</td>
                          <td className="p-3 text-center whitespace-nowrap">{h.vertJump}</td>
                          <td className="p-3 text-center whitespace-nowrap">{h.runDist}</td>
                          <td className="p-3 text-center font-bold text-sky-400 whitespace-nowrap">
                            {h.totalTkji} Point
                          </td>
                          <td className="p-3 text-center font-semibold text-emerald-400 whitespace-nowrap">
                            {h.categoryTkji}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}