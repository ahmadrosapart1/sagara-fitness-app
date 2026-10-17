'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Search, Calendar, X, User, Eye } from 'lucide-react';
import Modal from '@/components/Modal';

type SchoolClass = {
  id: string;
  name: string;
};

type GradeSetting = {
  id: string;
  min_score: number;
  max_score: number;
  tkji_label: string;
  dudi_status: string;
  frequency?: string;
  intensity?: string;
  time_duration?: string;
  exercise_type?: string;
  dudi_evaluation?: string;
};

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

type StudentSummary = {
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
  allRawScores: any[];
};

export default function ReportsPage() {
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');

  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [semester, setSemester] = useState('Ganjil');

  const [studentsData, setStudentsData] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'danger' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    fetchAuthorizedClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassRecapData(selectedClassId);
    } else {
      setStudentsData([]);
    }
  }, [selectedClassId, academicYear, semester]);

  // Ambil kelas sesuai hak akses (Admin semua, Pelatih hanya kelas binaan)
  async function fetchAuthorizedClasses() {
    try {
      const sessionStr = localStorage.getItem('sagara_user');
      const currentUser = sessionStr ? JSON.parse(sessionStr) : null;
      let allowedClassIds: string[] = [];

      if (currentUser && currentUser.role === 'pelatih') {
        const { data: assignments } = await supabase
          .from('teacher_classes')
          .select('class_id')
          .eq('teacher_id', currentUser.id);

        if (assignments) {
          allowedClassIds = assignments.map((item: any) => item.class_id);
        }
      }

      let classQuery = supabase.from('classes').select('id, name').order('name');
      if (currentUser && currentUser.role === 'pelatih') {
        if (allowedClassIds.length > 0) {
          classQuery = classQuery.in('id', allowedClassIds);
        } else {
          classQuery = classQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const { data } = await classQuery;
      if (data) {
        setClassesList(data);
        if (data.length > 0) setSelectedClassId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching classes:', error.message);
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

  async function fetchClassRecapData(classId: string) {
    try {
      setLoading(true);

      const { data: gradeSettings } = await supabase
        .from('tkji_grade_settings')
        .select('*')
        .order('min_score', { ascending: false });

      const settingsList: GradeSetting[] = gradeSettings || [];

      function getCategoryAndDudi(score: number) {
        const matched = settingsList.find(g => score >= g.min_score && score <= g.max_score);
        if (matched && matched.dudi_status) {
          return {
            tkjiLabel: matched.tkji_label || 'Kurang',
            dudiStatus: matched.dudi_status
          };
        }
        
        let tkjiLabel = 'Kurang';
        let dudiStatus = 'Kurang Siap Sekali';

        if (score >= 18) {
          tkjiLabel = score >= 22 ? 'Sangat Baik' : 'Baik';
          dudiStatus = 'Siap';
        } else if (score >= 15) {
          tkjiLabel = 'Sedang';
          dudiStatus = 'Belum Siap';
        } else if (score >= 12) {
          tkjiLabel = 'Sedang';
          dudiStatus = 'Kurang Siap';
        } else {
          tkjiLabel = 'Kurang';
          dudiStatus = 'Kurang Siap Sekali';
        }

        return { tkjiLabel, dudiStatus };
      }

      const { data: students, error: studErr } = await supabase
        .from('students')
        .select('id, nis, full_name, gender, birth_place, birth_date, photo_url, classes(name)')
        .eq('class_id', classId)
        .order('full_name');

      if (studErr) throw studErr;
      if (!students || students.length === 0) {
        setStudentsData([]);
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);

      const { data: scores, error: scoreErr } = await supabase
        .from('student_test_scores')
        .select(`
          student_id,
          score,
          test_date,
          academic_year,
          semester,
          test_items (
            name
          )
        `)
        .in('student_id', studentIds);

      if (scoreErr) throw scoreErr;

      const processedData: StudentSummary[] = students.map((stu: any) => {
        const stuScores = scores?.filter((sc: any) => sc.student_id === stu.id) || [];
        
        const sessionMap = new Map<string, any[]>();
        stuScores.forEach((sc: any) => {
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
          const evalResult = getCategoryAndDudi(finalTkji);

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
            categoryTkji: evalResult.tkjiLabel,
            rawPoints: { sprint: pSprint, chinUp: pChin, sitUp: pSit, vertJump: pJump, run: pRun }
          });
          sessionIdx++;
        });

        const latest = historyRecords[historyRecords.length - 1] || {
          weight: 0, height: 0, bmi: 0, bmiStatus: '-', totalTkji: 0, categoryTkji: 'Belum Dinilai'
        };

        const latestEval = getCategoryAndDudi(latest.totalTkji);

        return {
          id: stu.id,
          nis: stu.nis || '-',
          full_name: stu.full_name,
          gender: stu.gender === 'Perempuan' ? 'P' : 'L',
          birth_place: stu.birth_place || '',
          birth_date: stu.birth_date || '',
          photo_url: stu.photo_url,
          className: Array.isArray(stu.classes) ? stu.classes[0]?.name : stu.classes?.name || '-',
          latestWeight: latest.weight,
          latestHeight: latest.height,
          latestBmi: latest.bmi,
          latestBmiStatus: latest.bmiStatus,
          latestTkjiScore: latest.totalTkji,
          latestTkjiLabel: `${latest.totalTkji} (${latest.categoryTkji})`,
          dudiStatus: latestEval.dudiStatus,
          history: historyRecords,
          allRawScores: stuScores,
        };
      });

      setStudentsData(processedData);
    } catch (error: any) {
      showError('Gagal memuat data rapor: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = studentsData.filter(student => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.nis.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'Semua') {
      matchesStatus = student.dudiStatus.toLowerCase() === statusFilter.toLowerCase();
    }

    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

  function handlePrintIndividual(student: StudentSummary) {
    window.open(`/reports/print?id=${student.id}`, '_blank');
  }

  function handleOpenDetail(student: StudentSummary) {
    setSelectedStudent(student);
    setIsDetailModalOpen(true);
  }

  function showError(msg: string) {
    setModalConfig({ isOpen: true, title: 'Peringatan', message: msg, type: 'danger' });
  }

  return (
    <div className="w-full h-[calc(100vh-6rem)] flex flex-col overflow-hidden space-y-4">
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{modalConfig.message}</p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
              className="px-5 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20"
            >
              Mengerti
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL PRATINJAU INTERAKTIF */}
      {isDetailModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-gray-900">Pratinjau Rapor - {selectedStudent.full_name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintIndividual(selectedStudent)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow"
                >
                  <Printer className="w-4 h-4" /> Buka Tab Cetak PDF ({selectedStudent.nis})
                </button>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto flex-1 text-xs text-gray-800 bg-white">
              <div className="text-center pb-2 border-b border-gray-200">
                <h2 className="text-sm font-extrabold text-gray-900 tracking-wide uppercase">
                  RAPOR KEBUGARAN JASMANI & KESIAPAN KERJA (PHYSICAL READINESS DUDI)
                </h2>
                <p className="text-[10px] text-gray-500 mt-0.5">Aplikasi Profiling SAGARA - SMK Negeri 1 Karawang</p>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex gap-4 items-center">
                <div className="w-20 h-24 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 flex items-center justify-center shrink-0">
                  {selectedStudent.photo_url ? (
                    <img src={selectedStudent.photo_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 flex-1 text-xs">
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">Nama Lengkap</span>: <span className="font-bold text-gray-900 ml-1">{selectedStudent.full_name}</span></div>
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">Jenis Kelamin</span>: <span className="font-medium text-gray-800 ml-1">{selectedStudent.gender === 'L' ? 'Laki-Laki (16-19 Tahun)' : 'Perempuan (16-19 Tahun)'}</span></div>
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">NIS / NISN</span>: <span className="font-medium text-gray-800 ml-1">{selectedStudent.nis}</span></div>
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">Tahun Ajaran</span>: <span className="font-medium text-gray-800 ml-1">{academicYear}</span></div>
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">Kelas / Program</span>: <span className="font-medium text-sky-700 ml-1">{selectedStudent.className}</span></div>
                  <div className="flex"><span className="w-28 font-semibold text-gray-500">Status DUDI</span>: <span className="font-bold text-sky-700 ml-1">{selectedStudent.dudiStatus}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-sky-700 mb-2">A. Rekapitulasi Hasil Seluruh Periode Tes TKJI (16-19 Tahun) & Indeks Massa Tubuh (IMT)</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-[#0f172a] text-white">
                      <tr>
                        <th className="p-2.5">Periode Tes</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5 text-center">BB/TB</th>
                        <th className="p-2.5 text-center">IMT</th>
                        <th className="p-2.5 text-center">Sprint 60m</th>
                        <th className="p-2.5 text-center">Chin Up</th>
                        <th className="p-2.5 text-center">Sit Up</th>
                        <th className="p-2.5 text-center">Vert. Jump</th>
                        <th className="p-2.5 text-center">Lari</th>
                        <th className="p-2.5 text-center">Total Skor</th>
                        <th className="p-2.5 text-center">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {selectedStudent.history.map((h, i) => (
                        <tr key={i}>
                          <td className="p-2.5 font-semibold">{h.sessionNumber}</td>
                          <td className="p-2.5">{h.date}</td>
                          <td className="p-2.5 text-center">{h.weight}/{h.height}</td>
                          <td className="p-2.5 text-center">{h.bmiStatus}</td>
                          <td className="p-2.5 text-center">{h.sprint}</td>
                          <td className="p-2.5 text-center">{h.chinUp}</td>
                          <td className="p-2.5 text-center">{h.sitUp}</td>
                          <td className="p-2.5 text-center">{h.vertJump}</td>
                          <td className="p-2.5 text-center">{h.runDist}</td>
                          <td className="p-2.5 text-center font-bold text-sky-700">{h.totalTkji} Point</td>
                          <td className="p-2.5 text-center font-semibold text-emerald-700">{h.categoryTkji}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Modul */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">DIREKTORI DATA SISWA & REKAPITULASI PROFIL KEBUGARAN</h2>
          <p className="text-xs text-gray-500 mt-0.5">Database Siswa Vokasi SMK Negeri 1 Karawang & Status Physical Readiness DUDI</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-xl text-xs font-semibold border border-sky-100">
            <Calendar className="w-3.5 h-3.5" />
            <span>T.A {academicYear} ({semester})</span>
          </div>
        </div>
      </div>

      {/* Filter Kontrol */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari Nama / NIS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Kelas:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500 min-w-[150px]"
            >
              {classesList.length === 0 ? (
                <option value="">Tidak ada kelas binaan</option>
              ) : (
                classesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500 min-w-[150px]"
            >
              <option value="Semua">Semua</option>
              <option value="Siap">Siap</option>
              <option value="Belum Siap">Belum Siap</option>
              <option value="Kurang Siap">Kurang Siap</option>
              <option value="Kurang Siap Sekali">Kurang Siap Sekali</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Total: {filteredStudents.length} siswa
        </div>
      </div>

      {/* Tabel Rekapitulasi Rapor */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {classesList.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-xs">Belum ada penugasan kelas binaan untuk akun Anda.</div>
          ) : loading ? (
            <div className="text-center py-20 text-gray-400 text-xs">Memuat rekapitulasi data siswa...</div>
          ) : currentStudents.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-xs">Belum ada data siswa atau nilai pada kelas dan filter ini.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-gray-50 sticky top-0 z-20 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">NIS</th>
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4 text-center">L/P</th>
                  <th className="py-3.5 px-4">Kelas</th>
                  <th className="py-3.5 px-4">BB/TB</th>
                  <th className="py-3.5 px-4">IMT Status</th>
                  <th className="py-3.5 px-4">Skor TKJI</th>
                  <th className="py-3.5 px-4 text-center">Kesiapan DUDI</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {currentStudents.map((student) => {
                  let badgeColor = 'bg-gray-100 text-gray-700 border border-gray-200';
                  const statusLower = (student.dudiStatus || '').toLowerCase();
                  
                  if (statusLower === 'siap' || (statusLower.includes('siap') && !statusLower.includes('belum') && !statusLower.includes('kurang'))) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold';
                  } else if (statusLower.includes('belum')) {
                    badgeColor = 'bg-amber-50 text-amber-800 border border-amber-200 font-bold';
                  } else if (statusLower.includes('kurang siap sekali')) {
                    badgeColor = 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
                  } else if (statusLower.includes('kurang')) {
                    badgeColor = 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
                  }

                  return (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{student.nis}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{student.full_name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">{student.gender}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-sky-700">{student.className}</td>
                      <td className="py-3 px-4 text-gray-700 font-medium">{student.latestWeight && student.latestHeight ? `${student.latestWeight}/${student.latestHeight}` : '-'}</td>
                      <td className="py-3 px-4 text-gray-700">{student.latestBmiStatus}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{student.latestTkjiLabel}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[11px] ${badgeColor}`}>
                          {student.dudiStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(student)}
                            title="Pratinjau Rapor"
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintIndividual(student)}
                            title="Cetak PDF Rapor"
                            className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50 shrink-0">
          <span>
            Menampilkan {currentStudents.length > 0 ? indexOfFirstItem + 1 : 0} - {Math.min(indexOfLastItem, filteredStudents.length)} dari {filteredStudents.length} siswa {selectedClassId ? `(Kelas ${classesList.find(c => c.id === selectedClassId)?.name || ''})` : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white font-semibold"
            >
              &lt;
            </button>
            <span className="px-3 py-1.5 bg-[#0284c7] text-white rounded-lg font-bold shadow-sm">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white font-semibold"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}