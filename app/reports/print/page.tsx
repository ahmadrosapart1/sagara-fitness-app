'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from 'lucide-react';

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

type SchoolPrincipal = {
  principal_name: string;
  principal_nip: string;
  school_name: string;
  city: string;
};

type TeacherInfo = {
  full_name: string;
  nip: string;
};

type StudentReportDetail = {
  id: string;
  nis: string;
  full_name: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  photo_url?: string;
  classId: string;
  className: string;
  latestWeight: number;
  latestHeight: number;
  latestBmi: number;
  latestBmiStatus: string;
  latestTkjiScore: number;
  latestTkjiLabel: string;
  dudiStatus: string;
  history: TestPeriodRecord[];
  prescription: Prescription;
};

// Variabel module-level untuk mencegah print terpanggil 2 kali akibat React Strict Mode
const printedStudentsSession = new Set<string>();

function PrintReportContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('id');

  const [student, setStudent] = useState<StudentReportDetail | null>(null);
  const [principal, setPrincipal] = useState<SchoolPrincipal>({
    principal_name: 'Drs. H. Mohamad Ali, M.Pd.',
    principal_nip: '19680214 199103 1 003',
    school_name: 'SMK Negeri 1 Karawang',
    city: 'Karawang'
  });
  const [teacher, setTeacher] = useState<TeacherInfo>({
    full_name: 'DARWIS PRASETYO, S.Pd., Gr',
    nip: '19880520 201503 1 002'
  });
  const [loading, setLoading] = useState(true);
  const [academicYear] = useState('2026/2027');

  useEffect(() => {
    if (studentId) {
      fetchStudentReport(studentId);
      fetchSchoolSettings();
    }
  }, [studentId]);

  async function fetchSchoolSettings() {
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setPrincipal({
          principal_name: data.principal_name || 'Drs. H. Mohamad Ali, M.Pd.',
          principal_nip: data.principal_nip || '19680214 199103 1 003',
          school_name: data.school_name || 'SMK Negeri 1 Karawang',
          city: data.city || 'Karawang'
        });
      }
    } catch (err) {
      console.error('Gagal memuat pengaturan sekolah:', err);
    }
  }

  // Ambil nama dan NIP guru pembina berdasarkan kelas siswa
  async function fetchTeacherForClass(classId: string) {
    try {
      const { data, error } = await supabase
        .from('teacher_classes')
        .select(`
          profiles (
            full_name,
            nip
          )
        `)
        .eq('class_id', classId)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0 && data[0].profiles) {
        const prof = data[0].profiles as any;
        setTeacher({
          full_name: prof.full_name || 'DARWIS PRASETYO, S.Pd., Gr',
          nip: prof.nip || '-'
        });
      }
    } catch (err) {
      console.error('Gagal memuat guru pembina kelas:', err);
    }
  }

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

  async function fetchStudentReport(id: string) {
    try {
      setLoading(true);
      const { data: stu, error: stuErr } = await supabase
        .from('students')
        .select('id, nis, full_name, gender, birth_place, birth_date, photo_url, class_id, classes(name)')
        .eq('id', id)
        .single();

      if (stuErr) throw stuErr;

      if (stu.class_id) {
        fetchTeacherForClass(stu.class_id);
      }

      const { data: scores, error: scoreErr } = await supabase
        .from('student_test_scores')
        .select(`score, test_date, test_items (name)`)
        .eq('student_id', id);

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

      const latest = historyRecords[historyRecords.length - 1] || {
        weight: 0, height: 0, bmi: 0, bmiStatus: '-', totalTkji: 0, categoryTkji: 'Belum Dinilai'
      };

      let dudi = 'BELUM SIAP';
      if (latest.totalTkji >= 22) dudi = 'SANGAT SIAP';
      else if (latest.totalTkji >= 18) dudi = 'SIAP';
      else if (latest.totalTkji >= 14) dudi = 'CUKUP SIAP';
      else if (latest.totalTkji > 0) dudi = 'PERLU PEMBINAAN';

      const { data: settingData } = await supabase
        .from('tkji_grade_settings')
        .select('*')
        .lte('min_score', latest.totalTkji)
        .gte('max_score', latest.totalTkji)
        .maybeSingle();

      const prescription: Prescription = {
        frequency: settingData?.frequency || '3 - 4 kali per minggu secara teratur untuk menjaga ambang daya tahan kardiovaskular.',
        intensity: settingData?.intensity || 'Intensitas Sedang - Tinggi (70% - 85% dari Detak Jantung Maksimal / HRmax).',
        timeDuration: settingData?.time_duration || '45 - 60 menit per sesi latihan, mencakup pemanasan, inti, dan pendinginan.',
        exerciseType: settingData?.exercise_type || 'Aerobic Interval Running, Plyometric Tunggal, & Core Strength Maintenance.',
        dudiEvaluation: settingData?.dudi_evaluation || 'Memenuhi standar fisik prima industri manufaktur/otomotif.'
      };

      const classNameData = stu.classes as any;
      const className = Array.isArray(classNameData) ? classNameData[0]?.name : classNameData?.name || '-';

      const studentObj: StudentReportDetail = {
        id: stu.id,
        nis: stu.nis || '-',
        full_name: stu.full_name,
        gender: stu.gender === 'Perempuan' ? 'P' : 'L',
        birth_place: stu.birth_place || '',
        birth_date: stu.birth_date || '',
        photo_url: stu.photo_url,
        classId: stu.class_id,
        className,
        latestWeight: latest.weight,
        latestHeight: latest.height,
        latestBmi: latest.bmi,
        latestBmiStatus: latest.bmiStatus,
        latestTkjiScore: latest.totalTkji,
        latestTkjiLabel: `${latest.totalTkji} (${latest.categoryTkji})`,
        dudiStatus: settingData?.dudi_status || dudi,
        history: historyRecords,
        prescription,
      };

      setStudent(studentObj);

      const safeName = stu.full_name.replace(/[^a-zA-Z0-9]/g, '_');
      const safeClass = className.replace(/[^a-zA-Z0-9]/g, '_');
      document.title = `${stu.nis}-${safeName}-${safeClass}`;

      if (!printedStudentsSession.has(id)) {
        printedStudentsSession.add(id);
        setTimeout(() => {
          window.print();
        }, 800);
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-xs text-gray-500 font-medium">Menyiapkan Dokumen Rapor Lengkap...</div>;
  }

  if (!student) {
    return <div className="text-center py-20 text-xs text-rose-500 font-medium">Data siswa tidak ditemukan.</div>;
  }

  return (
    <div className="bg-white p-5 max-w-4xl mx-auto space-y-3 text-[10px] text-gray-800" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* Kop Sekolah / Header Rapor */}
      <div className="text-center pb-2 border-b border-gray-900">
        <h2 className="text-xs font-extrabold text-gray-900 tracking-wider uppercase">
          PEMERINTAH DAERAH PROVINSI JAWA BARAT — DINAS PENDIDIKAN
        </h2>
        <h1 className="text-sm font-black text-gray-900 tracking-wide uppercase mt-0.5">
          {principal.school_name}
        </h1>
        <p className="text-[9px] text-gray-600">
          Jalan Pangkal Perjuangan By Pass Teluk Jambe, Karawang 41316
        </p>
        <div className="mt-1.5 pt-1 border-t border-gray-300">
          <h3 className="text-[11px] font-bold text-gray-900 uppercase">
            RAPOR KEBUGARAN JASMANI & KESIAPAN KERJA (PHYSICAL READINESS DUDI)
          </h3>
          <p className="text-[9px] text-gray-500">Sistem Profiling SAGARA (Semantic Web-based Analytics)</p>
        </div>
      </div>

      {/* Biodata Siswa */}
      <div className="border border-gray-300 rounded-lg p-3 bg-gray-50/50 flex gap-3 items-center">
        <div className="w-16 h-20 bg-gray-200 rounded-md overflow-hidden border border-gray-300 flex items-center justify-center shrink-0">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-gray-400" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 flex-1 text-[10px]">
          <div className="flex"><span className="w-24 font-semibold text-gray-500">Nama Lengkap</span>: <span className="font-bold text-gray-900 ml-1">{student.full_name}</span></div>
          <div className="flex"><span className="w-24 font-semibold text-gray-500">Jenis Kelamin</span>: <span className="font-medium text-gray-800 ml-1">{student.gender === 'L' ? 'Laki-Laki (16-19 Thn)' : 'Perempuan (16-19 Thn)'}</span></div>
          <div className="flex"><span className="w-24 font-semibold text-gray-500">NIS / NISN</span>: <span className="font-medium text-gray-800 ml-1">{student.nis}</span></div>
          <div className="flex"><span className="w-24 font-semibold text-gray-500">Tahun Ajaran</span>: <span className="font-medium text-gray-800 ml-1">{academicYear}</span></div>
          <div className="flex"><span className="w-24 font-semibold text-gray-500">Kelas / Program</span>: <span className="font-medium text-sky-700 ml-1">{student.className}</span></div>
          <div className="flex"><span className="w-24 font-semibold text-gray-500">Status DUDI</span>: <span className="font-bold text-sky-700 ml-1">{student.dudiStatus}</span></div>
        </div>
      </div>

      {/* A. Tabel Rekapitulasi Lengkap Seluruh Tes */}
      <div>
        <h4 className="text-[11px] font-bold text-sky-800 mb-1">A. Rekapitulasi Hasil Seluruh Periode Tes TKJI (16-19 Tahun) & Indeks Massa Tubuh (IMT)</h4>
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-[9px]">
            <thead className="bg-[#0f172a] text-white">
              <tr>
                <th className="py-1.5 px-2">Periode Tes</th>
                <th className="py-1.5 px-2">Tanggal</th>
                <th className="py-1.5 px-2 text-center">BB/TB</th>
                <th className="py-1.5 px-2 text-center">IMT (kg/m²)</th>
                <th className="py-1.5 px-2 text-center">Sprint 60m</th>
                <th className="py-1.5 px-2 text-center">Chin Up</th>
                <th className="py-1.5 px-2 text-center">Sit Up</th>
                <th className="py-1.5 px-2 text-center">Vert. Jump</th>
                <th className="py-1.5 px-2 text-center">Lari</th>
                <th className="py-1.5 px-2 text-center">Total Skor</th>
                <th className="py-1.5 px-2 text-center">Kategori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {student.history.map((h, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-1.5 px-2 font-semibold text-gray-900">{h.sessionNumber}</td>
                  <td className="py-1.5 px-2 text-gray-600">{h.date}</td>
                  <td className="py-1.5 px-2 text-center">{h.weight}/{h.height}</td>
                  <td className="py-1.5 px-2 text-center">{h.bmiStatus}</td>
                  <td className="py-1.5 px-2 text-center">{h.sprint}</td>
                  <td className="py-1.5 px-2 text-center">{h.chinUp}</td>
                  <td className="py-1.5 px-2 text-center">{h.sitUp}</td>
                  <td className="py-1.5 px-2 text-center">{h.vertJump}</td>
                  <td className="py-1.5 px-2 text-center">{h.runDist}</td>
                  <td className="py-1.5 px-2 text-center font-bold text-sky-700">{h.totalTkji} Pt</td>
                  <td className="py-1.5 px-2 text-center font-semibold text-emerald-700">{h.categoryTkji}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grafik Batang & Radar Chart */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-300 rounded-lg p-2.5 bg-gray-50/50">
          <div className="text-[10px] font-bold text-gray-700 mb-1">Progres Skor Total TKJI Lintas Sesi</div>
          <div className="h-24 flex items-end justify-around gap-2 pt-2 px-2 border-b border-gray-300">
            {student.history.map((h, idx) => {
              const barHeightPx = Math.max(12, Math.round((h.totalTkji / 25) * 65));
              return (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[9px] font-bold text-sky-700">{h.totalTkji}</span>
                  <div 
                    className="w-full max-w-[28px] bg-sky-600 rounded-t-md" 
                    style={{ height: `${barHeightPx}px`, backgroundColor: '#0284c7' }}
                  ></div>
                  <span className="text-[8px] text-gray-500 font-medium">{h.sessionNumber}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-1.5 text-[8px] text-gray-500">
            <span>Target Minimum DUDI (Skor 18)</span>
            <span className="font-semibold text-emerald-600">Maks: 25</span>
          </div>
        </div>

        <div className="border border-gray-300 rounded-lg p-2.5 bg-gray-50/50 flex flex-col items-center justify-center">
          <div className="text-[10px] font-bold text-gray-700 mb-0.5 w-full text-left">Profil Radar 5 Komponen Fisik (Tes Terbaru)</div>
          <div className="relative w-32 h-28 flex items-center justify-center my-auto">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
              <polygon points="50,14 92,41 76,86 24,86 8,41" fill="none" stroke="#cbd5e1" strokeWidth="1" />
              <polygon points="50,26 73,47 62,72 38,72 27,47" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              
              {(() => {
                const latest = student.history[student.history.length - 1]?.rawPoints || { sprint: 3, chinUp: 3, sitUp: 3, vertJump: 3, run: 3 };
                const getCoord = (val: number, angleDeg: number, max: number = 5) => {
                  const r = (val / max) * 36;
                  const rad = (angleDeg - 90) * (Math.PI / 180);
                  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
                };
                const p1 = getCoord(latest.sprint, 0);
                const p2 = getCoord(latest.chinUp, 72);
                const p3 = getCoord(latest.sitUp, 144);
                const p4 = getCoord(latest.vertJump, 216);
                const p5 = getCoord(latest.run, 288);
                const pts = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y}`;
                return <polygon points={pts} fill="rgba(2, 132, 199, 0.3)" stroke="#0284c7" strokeWidth="2" />;
              })()}

              <text x="50" y="7" fontSize="7.5" fontWeight="bold" fill="#0369a1" textAnchor="middle">Sprint</text>
              <text x="97" y="43" fontSize="7.5" fontWeight="bold" fill="#0369a1" textAnchor="start">Chin Up</text>
              <text x="82" y="95" fontSize="7.5" fontWeight="bold" fill="#0369a1" textAnchor="start">Sit Up</text>
              <text x="18" y="95" fontSize="7.5" fontWeight="bold" fill="#0369a1" textAnchor="end">Vert. Jump</text>
              <text x="3" y="43" fontSize="7.5" fontWeight="bold" fill="#0369a1" textAnchor="end">Lari</text>
            </svg>
          </div>
        </div>
      </div>

      {/* B. Preskripsi FITT Semantik (Dinamis dari Database) */}
      <div className="border border-sky-200 bg-sky-50/40 rounded-lg p-3 space-y-1">
        <h4 className="text-[10px] font-bold text-sky-900 mb-0.5">B. Preskripsi & Rekomendasi Latihan Kebugaran Jasmani (Prinsip FITT Semantik)</h4>
        <div className="space-y-0.5 text-[9.5px] text-gray-700">
          <div className="flex"><span className="w-48 font-semibold">Klasifikasi Kebugaran & Postur</span>: <span className="font-bold text-gray-900 ml-1">{student.latestTkjiLabel} | IMT {student.latestBmiStatus} — Kondisi Fisik Vokasi.</span></div>
          <div className="flex"><span className="w-48 font-semibold">Frequency (Frekuensi Latihan)</span>: <span className="ml-1">{student.prescription.frequency}</span></div>
          <div className="flex"><span className="w-48 font-semibold">Intensity (Intensitas Latihan)</span>: <span className="ml-1">{student.prescription.intensity}</span></div>
          <div className="flex"><span className="w-48 font-semibold">Time (Durasi Latihan)</span>: <span className="ml-1">{student.prescription.timeDuration}</span></div>
          <div className="flex"><span className="w-48 font-semibold">Type (Jenis Olahraga)</span>: <span className="ml-1">{student.prescription.exerciseType}</span></div>
          <div className="flex"><span className="w-48 font-semibold">Evaluasi Kesiapan Kerja (DUDI)</span>: <span className="font-bold text-sky-700 ml-1">{student.prescription.dudiEvaluation} (Readiness Score: {student.latestTkjiScore * 4}%)</span></div>
        </div>
      </div>

      {/* C. Blok Tanda Tangan (Kiri: Kepala Sekolah | Kanan: Guru Pelatih) — Sejajar Sempurna */}
      <div className="pt-4 grid grid-cols-2 text-center text-[10px]">
        {/* Kolom Kiri: Kepala Sekolah */}
        <div className="flex flex-col justify-between h-32">
          <div>
            <p className="text-gray-600 font-medium">{principal.city}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-gray-600 font-medium">Mengesahkan,</p>
            <p className="text-gray-600 font-medium">Kepala {principal.school_name}</p>
          </div>
          <div>
            <p className="underline font-bold text-gray-900">{principal.principal_name}</p>
            <p className="text-[9px] text-gray-500">NIP. {principal.principal_nip}</p>
          </div>
        </div>

        {/* Kolom Kanan: Guru Pembina / Pelatih */}
        <div className="flex flex-col justify-between h-32">
          <div>
            <p className="text-gray-600 font-medium">Mengetahui,</p>
            <p className="text-gray-600 font-medium">Guru Mata Pelajaran PJOK / Pelatih</p>
          </div>
          <div>
            <p className="underline font-bold text-gray-900">{teacher.full_name}</p>
            <p className="text-[9px] text-gray-500">NIP. {teacher.nip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-xs text-gray-500 font-medium">Menyiapkan dokumen PDF rapor...</div>}>
      <PrintReportContent />
    </Suspense>
  );
}