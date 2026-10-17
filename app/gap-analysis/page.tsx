'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Award, TrendingUp, Activity, User, Search, CheckCircle2, AlertCircle } from 'lucide-react';

type ClassOption = {
  id: string;
  name: string;
};

type StudentOption = {
  id: string;
  nis: string;
  full_name: string;
  class_id: string;
  className: string;
  gender: string;
  photo_url?: string;
};

type TestSession = {
  sessionNumber: string;
  date: string;
  totalScore: number;
  category: string;
  items: {
    sprint: { raw: number; score: number };
    chinUp: { raw: number; score: number };
    sitUp: { raw: number; score: number };
    vertJump: { raw: number; score: number };
    run: { raw: number; score: number };
  };
};

type StudentDetailCache = {
  info: StudentOption;
  sessions: TestSession[];
};

export default function GapAnalysisPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [filteredStudents, setFilteredStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  const [studentCache, setStudentCache] = useState<Map<string, StudentDetailCache>>(new Map());
  const [loadingClass, setLoadingClass] = useState(false);

  // 1. Load Daftar Kelas berdasarkan Hak Akses (Admin / Pelatih)
  useEffect(() => {
    async function initClasses() {
      try {
        const sessionStr = localStorage.getItem('sagara_user');
        const currentUser = sessionStr ? JSON.parse(sessionStr) : null;
        let allowedClassIds: string[] = [];

        // Jika pelatih, ambil kelas binaannya dari teacher_classes
        if (currentUser && currentUser.role === 'pelatih') {
          const { data: assignments } = await supabase
            .from('teacher_classes')
            .select('class_id')
            .eq('teacher_id', currentUser.id);

          if (assignments) {
            allowedClassIds = assignments.map((item: any) => item.class_id);
          }
        }

        let classQuery = supabase.from('classes').select('id, name').order('name', { ascending: true });
        if (currentUser && currentUser.role === 'pelatih') {
          if (allowedClassIds.length > 0) {
            classQuery = classQuery.in('id', allowedClassIds);
          } else {
            classQuery = classQuery.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }

        const { data: classData } = await classQuery;
        if (classData && classData.length > 0) {
          setClasses(classData);
          setSelectedClassId(classData[0].id);
        } else {
          setClasses([]);
          setSelectedClassId('');
        }
      } catch (err) {
        console.error(err);
      }
    }
    initClasses();
  }, []);

  // 2. Load & Cache semua data siswa beserta skor tesnya saat Kelas dipilih
  useEffect(() => {
    if (!selectedClassId) return;

    async function loadClassStudentsAndScores() {
      setLoadingClass(true);
      try {
        const { data: stuData } = await supabase
          .from('students')
          .select('id, nis, full_name, gender, photo_url, class_id, classes(id, name)')
          .eq('class_id', selectedClassId)
          .order('full_name', { ascending: true });

        if (!stuData || stuData.length === 0) {
          setFilteredStudents([]);
          setSelectedStudentId('');
          setStudentCache(new Map());
          setLoadingClass(false);
          return;
        }

        const studentList: StudentOption[] = stuData.map((s: any) => {
          const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
          return {
            id: s.id,
            nis: s.nis || '-',
            full_name: s.full_name,
            gender: s.gender === 'Perempuan' ? 'P' : 'L',
            class_id: s.class_id || cls?.id || '',
            className: cls?.name || '-',
            photo_url: s.photo_url
          };
        });

        setFilteredStudents(studentList);

        const studentIds = studentList.map(s => s.id);
        const { data: scores } = await supabase
          .from('student_test_scores')
          .select('student_id, score, test_date, test_items (name)')
          .in('student_id', studentIds);

        const newCache = new Map<string, StudentDetailCache>();

        studentList.forEach(stu => {
          const stuScores = scores?.filter((sc: any) => sc.student_id === stu.id) || [];
          
          const sessionMap = new Map<string, any[]>();
          stuScores.forEach((sc: any) => {
            const dateKey = sc.test_date || 'Sesi Tes';
            if (!sessionMap.has(dateKey)) sessionMap.set(dateKey, []);
            sessionMap.get(dateKey)!.push(sc);
          });

          const sessions: TestSession[] = [];
          let idx = 1;

          sessionMap.forEach((items, dateStr) => {
            let tTkji = 0;
            let sItem = { raw: 0, score: 0 };
            let cItem = { raw: 0, score: 0 };
            let suItem = { raw: 0, score: 0 };
            let vjItem = { raw: 0, score: 0 };
            let rItem = { raw: 0, score: 0 };

            items.forEach((sc: any) => {
              const tName = sc.test_items?.name || '';
              const val = Number(sc.score) || 0;
              const lower = tName.toLowerCase();
              const pts = calculateItemScore(tName, val);
              tTkji += pts;

              if (lower.includes('sprint') || lower.includes('60m') || lower.includes('lari cepat')) sItem = { raw: val, score: pts };
              else if (lower.includes('chin') || lower.includes('pull') || lower.includes('gantung')) cItem = { raw: val, score: pts };
              else if (lower.includes('sit up') || lower.includes('baring')) suItem = { raw: val, score: pts };
              else if (lower.includes('jump') || lower.includes('vertical') || lower.includes('loncat')) vjItem = { raw: val, score: pts };
              else if (lower.includes('lari') || lower.includes('run') || lower.includes('1000') || lower.includes('1200') || lower.includes('sedang')) rItem = { raw: val, score: pts };
            });

            const finalScore = Math.min(tTkji, 25);
            let cat = 'Kurang';
            if (finalScore >= 22) cat = 'Sangat Baik';
            else if (finalScore >= 18) cat = 'Baik';
            else if (finalScore >= 14) cat = 'Sedang';

            sessions.push({
              sessionNumber: `Tes ${idx}`,
              date: dateStr,
              totalScore: finalScore,
              category: cat,
              items: { sprint: sItem, chinUp: cItem, sitUp: suItem, vertJump: vjItem, run: rItem }
            });
            idx++;
          });

          newCache.set(stu.id, { info: stu, sessions });
        });

        setStudentCache(newCache);
        if (studentList.length > 0) {
          setSelectedStudentId(studentList[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingClass(false);
      }
    }

    loadClassStudentsAndScores();
  }, [selectedClassId]);

  function calculateItemScore(testName: string, rawValue: number) {
    if (!rawValue || rawValue <= 0) return 0;
    const name = testName.toLowerCase();
    if (name.includes('sprint') || name.includes('60m') || name.includes('lari cepat')) {
      return rawValue <= 7.2 ? 5 : rawValue <= 8.3 ? 4 : rawValue <= 9.6 ? 3 : rawValue <= 11.0 ? 2 : 1;
    }
    if (name.includes('chin') || name.includes('pull') || name.includes('gantung')) {
      return rawValue >= 15 ? 5 : rawValue >= 11 ? 4 : rawValue >= 7 ? 3 : rawValue >= 3 ? 2 : 1;
    }
    if (name.includes('sit up') || name.includes('baring')) {
      return rawValue >= 41 ? 5 : rawValue >= 30 ? 4 : rawValue >= 21 ? 3 : rawValue >= 10 ? 2 : 1;
    }
    if (name.includes('jump') || name.includes('vertical') || name.includes('loncat')) {
      return rawValue >= 73 ? 5 : rawValue >= 60 ? 4 : rawValue >= 50 ? 3 : rawValue >= 39 ? 2 : 1;
    }
    if (name.includes('lari') || name.includes('run') || name.includes('1000') || name.includes('1200') || name.includes('jarak sedang')) {
      return rawValue <= 200 ? 5 : rawValue <= 250 ? 4 : rawValue <= 320 ? 3 : rawValue <= 400 ? 2 : 1;
    }
    return 0;
  }

  function renderRadarPolygon(items: TestSession['items'] | undefined, strokeColor: string, fillColor: string, isDashed: boolean = false) {
    if (!items) return null;
    const getCoord = (val: number, angle: number) => {
      const r = (val / 5) * 32;
      const rad = (angle - 90) * (Math.PI / 180);
      return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
    };
    const p1 = getCoord(items.sprint.score, 0);
    const p2 = getCoord(items.chinUp.score, 72);
    const p3 = getCoord(items.sitUp.score, 144);
    const p4 = getCoord(items.vertJump.score, 216);
    const p5 = getCoord(items.run.score, 288);
    const pts = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y}`;
    
    return (
      <polygon 
        points={pts} 
        fill={fillColor} 
        stroke={strokeColor} 
        strokeWidth={isDashed ? "1.5" : "2"} 
        strokeDasharray={isDashed ? "2" : undefined} 
        style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    );
  }

  const studentData = selectedStudentId ? studentCache.get(selectedStudentId) : null;
  const baseline = studentData?.sessions[0];
  const latest = studentData?.sessions[studentData.sessions.length - 1];
  const deltaScore = latest && baseline ? latest.totalScore - baseline.totalScore : 0;
  const deltaPct = baseline && baseline.totalScore > 0 ? ((deltaScore / baseline.totalScore) * 100).toFixed(1) : '0';
  const gapBenchmark = latest ? latest.totalScore - 18 : 0;

  return (
    <div className="space-y-3 text-xs w-full pb-4">
      {/* Header Halaman & Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Analisis Gap & Progres Evaluasi Fisik Longitudinal</h2>
          <p className="text-[11px] text-gray-500">Perbandingan Selisih Capaian (Gap) Tes 1 s.d Tes Terakhir vs Target Benchmark DUDI</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 mb-0.5">Pilih Kelas:</label>
            <select 
              value={selectedClassId} 
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-sky-500"
            >
              {classes.length === 0 ? (
                <option value="">Tidak ada kelas binaan</option>
              ) : (
                classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-500 mb-0.5">Pilih Siswa:</label>
            <select 
              value={selectedStudentId} 
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-sky-500 transition-all"
              disabled={filteredStudents.length === 0 || loadingClass}
            >
              {loadingClass ? (
                <option value="">Memuat data siswa...</option>
              ) : filteredStudents.length === 0 ? (
                <option value="">Tidak ada siswa</option>
              ) : (
                filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.nis})</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {loadingClass ? (
        <div className="text-center py-20 text-xs text-gray-500 font-medium">Menyiapkan data kelas secara instan...</div>
      ) : classes.length === 0 ? (
        <div className="bg-white p-8 rounded-xl text-center text-gray-500 text-xs border border-gray-100">
          Belum ada penugasan kelas binaan untuk akun Anda. Silakan hubungi Administrator.
        </div>
      ) : !studentData || studentData.sessions.length === 0 ? (
        <div className="bg-white p-8 rounded-xl text-center text-gray-500 text-xs border border-gray-100">
          Belum ada data skor tes fisik untuk siswa ini. Silakan input tes terlebih dahulu.
        </div>
      ) : (
        <div className="space-y-3 transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
          
          {/* Bar Info Siswa & Kartu Ringkasan Metrik */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            <div className="md:col-span-1 border-r border-gray-100 pr-3 flex items-center gap-3">
              <div className="w-12 h-14 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center shrink-0">
                {studentData.info.photo_url ? (
                  <img src={studentData.info.photo_url} alt={studentData.info.full_name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase">Siswa Aktif</span>
                <div className="font-bold text-gray-900 text-xs mt-0.5">{studentData.info.full_name} ({studentData.info.nis})</div>
                <div className="text-[10px] text-sky-700 font-medium">Kelas: {studentData.info.className} | JK: {studentData.info.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}</div>
              </div>
            </div>
            
            <div className="bg-sky-50/50 p-2 rounded-lg border border-sky-100 text-center transition-all duration-300">
              <div className="text-[9px] font-semibold text-sky-800">Tes I (Baseline)</div>
              <div className="text-sm font-bold text-sky-900">{baseline?.totalScore || 0} Pt ({baseline?.category || '-'})</div>
            </div>
            <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 text-center transition-all duration-300">
              <div className="text-[9px] font-semibold text-emerald-800">Tes Terakhir</div>
              <div className="text-sm font-bold text-emerald-900">{latest?.totalScore || 0} Pt ({latest?.category || '-'})</div>
            </div>
            <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 text-center transition-all duration-300">
              <div className="text-[9px] font-semibold text-indigo-800">Gap vs Benchmark DUDI</div>
              <div className={`text-xs font-bold mt-0.5 ${gapBenchmark >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {gapBenchmark >= 0 ? `+${gapBenchmark} Point (Above Target)` : `${gapBenchmark} Point (Under Target)`}
              </div>
            </div>
          </div>

          {/* Grid Grafik & Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* 1. Grafik Batang Progres Skor Total TKJI */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-900">Grafik Progres Skor Total TKJI (Lintas Sesi)</h3>
                  <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">Delta: {deltaScore >= 0 ? `+${deltaScore}` : deltaScore} Pt ({deltaPct}%)</span>
                </div>
                <div className="h-44 flex items-end justify-around gap-3 pt-6 px-2 border-b border-gray-200 relative">
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-rose-500 z-10" style={{ top: '28%' }}>
                    <span className="absolute right-2 -top-3 text-[9px] font-bold text-rose-600 bg-white px-1">Target DUDI (18)</span>
                  </div>

                  {studentData.sessions.map((s, idx) => {
                    const barHeight = Math.max(16, Math.round((s.totalScore / 25) * 120));
                    return (
                      <div key={idx} className="flex flex-col items-center gap-1 z-20 flex-1">
                        <span className="text-[10px] font-extrabold text-sky-800 transition-all duration-300">{s.totalScore}</span>
                        <div 
                          className="w-full max-w-[36px] bg-sky-500 rounded-t-md transition-all duration-500 ease-out" 
                          style={{ height: `${barHeight}px` }}
                        ></div>
                        <span className="text-[9px] font-medium text-gray-600">{s.sessionNumber}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 text-[10px] text-gray-500">
                <span>Evolusi Capaian Fisik & Selisih Poin</span>
                <span className="font-semibold text-emerald-600">Maks: 25 Pt</span>
              </div>
            </div>

            {/* 2. Perbandingan Profil Radar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-between">
              <div className="w-full">
                <h3 className="text-xs font-bold text-gray-900 mb-0.5">2. Perbandingan Profil Radar</h3>
                <p className="text-[10px] text-gray-500">Tes 1 vs Tes Terakhir</p>
              </div>
              <div className="relative w-40 h-40 flex items-center justify-center my-auto">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
                  <polygon points="50,16 88,41 74,78 26,78 12,41" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  <polygon points="50,28 70,45 61,66 39,66 30,45" fill="none" stroke="#e2e8f0" strokeWidth="1" />

                  {renderRadarPolygon(baseline?.items, "#94a3b8", "rgba(148, 163, 184, 0.2)", true)}
                  {renderRadarPolygon(latest?.items, "#0284c7", "rgba(2, 132, 199, 0.35)", false)}

                  <text x="50" y="8" fontSize="6.5" fontWeight="bold" fill="#0369a1" textAnchor="middle">Sprint 60m</text>
                  <text x="93" y="42" fontSize="6.5" fontWeight="bold" fill="#0369a1" textAnchor="start">Chin Up</text>
                  <text x="78" y="90" fontSize="6.5" fontWeight="bold" fill="#0369a1" textAnchor="start">Sit Up</text>
                  <text x="22" y="90" fontSize="6.5" fontWeight="bold" fill="#0369a1" textAnchor="end">Vert. Jump</text>
                  <text x="7" y="42" fontSize="6.5" fontWeight="bold" fill="#0369a1" textAnchor="end">Lari</text>
                </svg>
              </div>
              <div className="flex items-center justify-center gap-3 text-[9px] font-semibold text-gray-600 pt-1 border-t border-gray-100 w-full">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-400 rounded-sm inline-block"></span> Tes 1</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sky-600 rounded-sm inline-block"></span> Tes Terakhir</span>
              </div>
            </div>
          </div>

          {/* 3. Matriks Evaluasi Gap per Butir Tes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900">3. Matriks Evaluasi Gap per Butir Tes (Tes 1 vs Tes Terakhir)</h3>
                <p className="text-[10px] text-gray-500">Analisis pertumbuhan skor per komponen tes fisik kebugaran jasmani</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[9px]">
                    <th className="py-2 px-4">Butir Tes Physical</th>
                    <th className="py-2 px-4 text-center">Tes 1 (Awal)</th>
                    <th className="py-2 px-4 text-center">Tes Terakhir</th>
                    <th className="py-2 px-4 text-center">Gap Delta</th>
                    <th className="py-2 px-4">Status Evaluasi & Progres</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Lari Cepat 60m', key: 'sprint', unit: 's' },
                    { label: 'Chin Up 60s', key: 'chinUp', unit: 'set' },
                    { label: 'Sit Up 60s', key: 'sitUp', unit: 'set' },
                    { label: 'Vertical Jump', key: 'vertJump', unit: 'cm' },
                    { label: 'Lari Jarak Sedang', key: 'run', unit: 's' }
                  ].map((item, idx) => {
                    const bItem = baseline?.items[item.key as keyof typeof baseline.items] || { raw: 0, score: 0 };
                    const lItem = latest?.items[item.key as keyof typeof latest.items] || { raw: 0, score: 0 };
                    const diffScore = lItem.score - bItem.score;
                    const diffPct = bItem.score > 0 ? Math.round((diffScore / bItem.score) * 100) : 0;

                    let statusText = 'Peningkatan Konsisten';
                    if (diffScore > 1) statusText = 'Sangat Signifikan (Optimal)';
                    else if (diffScore === 0) statusText = 'Butuh Latihan Aerobik FITT';
                    else if (diffScore < 0) statusText = 'Penurunan Performa';

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-4 font-semibold text-gray-900">{item.label}</td>
                        <td className="py-2 px-4 text-center text-gray-600">{bItem.raw} {item.unit} ({bItem.score})</td>
                        <td className="py-2 px-4 text-center font-bold text-sky-700">{lItem.raw} {item.unit} ({lItem.score})</td>
                        <td className={`py-2 px-4 text-center font-bold ${diffScore >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {diffScore >= 0 ? `+${diffScore} Skor (+${diffPct}%)` : `${diffScore} Skor`}
                        </td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 ${
                            diffScore > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
                          }`}>
                            {diffScore > 0 ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-amber-600" />}
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}