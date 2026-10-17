'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Filter, FileSpreadsheet, Calendar, Layers, Plus, Download, Upload } from 'lucide-react';
import Modal from '@/components/Modal';
import * as XLSX from 'xlsx';

type SchoolClass = {
  id: string;
  name: string;
};

type TestItem = {
  id: string;
  name: string;
  metric_type: string;
  target_gender: string;
  description: string;
};

type Student = {
  id: string;
  nis: string;
  full_name: string;
  gender: string;
};

export default function InputTesPage() {
  const [classesList, setClassesList] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [semester, setSemester] = useState('Ganjil');
  
  // State untuk Tanggal & Riwayat Tanggal Tes
  const [testDate, setTestDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isNewDateMode, setIsNewDateMode] = useState(false);

  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [scores, setScores] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fetchAuthorizedClassesAndTests();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchStudentsAndDates(selectedClassId);
    } else {
      setStudents([]);
      setAvailableDates([]);
      setScores({});
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedClassId && testDate && students.length > 0 && testItems.length > 0) {
      fetchScoresForDate(testDate);
    } else if (!testDate) {
      setScores({});
    }
  }, [selectedClassId, testDate, students, testItems]);

  async function fetchAuthorizedClassesAndTests() {
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

      const { data: cls } = await classQuery;
      const { data: tests } = await supabase.from('test_items').select('*').order('name');

      if (cls && cls.length > 0) {
        setClassesList(cls);
        setSelectedClassId(cls[0].id);
      } else {
        setClassesList([]);
        setSelectedClassId('');
      }

      if (tests) setTestItems(tests);
    } catch (error: any) {
      console.error('Error loading initial data:', error.message);
    }
  }

  async function fetchStudentsAndDates(classId: string) {
    try {
      setLoading(true);
      const { data: studData, error: studErr } = await supabase
        .from('students')
        .select('id, nis, full_name, gender')
        .eq('class_id', classId)
        .order('full_name');

      if (studErr) throw studErr;
      const stuList = studData || [];
      setStudents(stuList);

      if (stuList.length > 0) {
        const studentIds = stuList.map(s => s.id);
        
        const { data: dateData } = await supabase
          .from('student_test_scores')
          .select('test_date')
          .in('student_id', studentIds);

        const uniqueDates = Array.from(new Set(dateData?.map((d: any) => d.test_date)))
          .filter(Boolean)
          .sort()
          .reverse() as string[];

        setAvailableDates(uniqueDates);

        if (uniqueDates.length > 0) {
          setTestDate(uniqueDates[0]);
          setIsNewDateMode(false);
        } else {
          const today = new Date().toISOString().split('T')[0];
          setTestDate(today);
          setIsNewDateMode(true);
        }
      } else {
        setAvailableDates([]);
        setScores({});
      }
    } catch (error: any) {
      showError('Gagal memuat data siswa: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Fungsi helper untuk mendeteksi apakah butir tes adalah tes lari jarak jauh (1000m/1200m)
  function isRunningTest(testName: string) {
    const lower = testName.toLowerCase();
    return lower.includes('lari') || lower.includes('run') || lower.includes('1000') || lower.includes('1200');
  }

  async function fetchScoresForDate(date: string) {
    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return;

      const { data: scoreData, error: scoreErr } = await supabase
        .from('student_test_scores')
        .select('student_id, test_item_id, score, academic_year, semester')
        .in('student_id', studentIds)
        .eq('test_date', date);

      if (scoreErr) throw scoreErr;

      if (scoreData && scoreData.length > 0 && scoreData[0].academic_year) {
        setAcademicYear(scoreData[0].academic_year);
      }
      if (scoreData && scoreData.length > 0 && scoreData[0].semester) {
        setSemester(scoreData[0].semester);
      }

      const scoreMap: { [key: string]: string } = {};
      scoreData?.forEach((item) => {
        const testItem = testItems.find(t => t.id === item.test_item_id);
        const isRun = testItem ? isRunningTest(testItem.name) : false;

        // Jika tes lari, nilai di DB disimpan dalam detik, konversi balik ke menit untuk ditampilkan
        const rawVal = Number(item.score) || 0;
        const displayVal = isRun && rawVal > 0 ? Number((rawVal / 60).toFixed(2)) : rawVal;

        scoreMap[`${item.student_id}_${item.test_item_id}`] = displayVal > 0 ? String(displayVal) : '';
      });
      setScores(scoreMap);
    } catch (error: any) {
      console.error('Gagal memuat nilai:', error.message);
    }
  }

  function handleScoreChange(studentId: string, testId: string, val: string) {
    setScores(prev => ({
      ...prev,
      [`${studentId}_${testId}`]: val
    }));
  }

  // Unduh Template Excel Kelas Aktif
  function handleDownloadTemplate() {
    if (!students || students.length === 0) {
      showError('Tidak ada data siswa pada kelas ini untuk diunduh templatenya.');
      return;
    }

    const templateData = students.map((stu, index) => {
      const row: any = {
        'No': index + 1,
        'NIS': stu.nis,
        'Nama Siswa': stu.full_name,
        'L/P': stu.gender === 'Laki-laki' ? 'L' : 'P',
      };
      testItems.forEach(test => {
        row[test.name] = ''; 
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Input Nilai Tes');
    
    const currentClassName = classesList.find(c => c.id === selectedClassId)?.name || 'Kelas';
    XLSX.writeFile(workbook, `Template_Nilai_Tes_${currentClassName}_${testDate || 'Sesi'}.xlsx`);
  }

  // Impor Nilai dari File Excel
  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const excelData = XLSX.utils.sheet_to_json(sheet) as any[];

        const newScores = { ...scores };
        let updatedCount = 0;

        excelData.forEach((row) => {
          const rowNis = String(row['NIS'] || '').trim();
          const student = students.find(s => String(s.nis).trim() === rowNis);

          if (student) {
            testItems.forEach(test => {
              const val = row[test.name];
              if (val !== undefined && val !== null && val !== '') {
                newScores[`${student.id}_${test.id}`] = String(val);
                updatedCount++;
              }
            });
          }
        });

        setScores(newScores);
        showSuccess(`Berhasil mengimpor ${updatedCount} sel nilai dari file Excel! Klik tombol "Simpan Semua Nilai" di atas untuk menyimpan ke database.`);
      } catch (err: any) {
        showError('Gagal memproses file Excel: ' + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleSaveAllScores() {
    if (!selectedClassId || students.length === 0 || !testDate) return;

    try {
      setSaving(true);
      const payload: any[] = [];

      Object.entries(scores).forEach(([key, val]) => {
        if (val !== undefined && val !== '') {
          const [student_id, test_item_id] = key.split('_');
          const testItem = testItems.find(t => t.id === test_item_id);
          const isRun = testItem ? isRunningTest(testItem.name) : false;

          const numericVal = parseFloat(val);
          if (!isNaN(numericVal)) {
            // Jika tes lari, input dalam menit dikonversi otomatis ke detik (menit * 60) untuk database
            const finalScore = isRun ? Number((numericVal * 60).toFixed(1)) : numericVal;

            payload.push({
              student_id,
              test_item_id,
              score: finalScore,
              academic_year: academicYear,
              semester: semester,
              test_date: testDate
            });
          }
        }
      });

      if (payload.length === 0) {
        showError('Belum ada nilai yang diisi untuk disimpan.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('student_test_scores')
        .upsert(payload, { onConflict: 'student_id,test_item_id,academic_year,semester,test_date' });

      if (error) throw error;

      showSuccess(`Berhasil menyimpan ${payload.length} data nilai untuk Tanggal Tes ${testDate}!`);
      fetchStudentsAndDates(selectedClassId);
      setIsNewDateMode(false);
    } catch (error: any) {
      showError('Gagal menyimpan nilai: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function showSuccess(msg: string) {
    setModalConfig({ isOpen: true, title: 'Berhasil!', message: msg, type: 'success' });
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".xlsx, .xls"
        className="hidden"
      />

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Input Tes Kebugaran & Antropometri (BMI)</h2>
          <p className="text-xs text-gray-500 mt-0.5">Catat hasil tes fisik (khusus lari 1000/1200m diinput dalam satuan Menit)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            disabled={!selectedClassId || students.length === 0}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            title="Unduh format Excel untuk kelas ini"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Template</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedClassId || students.length === 0}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            title="Impor nilai dari file Excel yang sudah diisi"
          >
            <Upload className="w-4 h-4" />
            <span>Impor Excel</span>
          </button>

          <button
            onClick={handleSaveAllScores}
            disabled={saving || !selectedClassId || students.length === 0}
            className="flex items-center justify-center gap-2 bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <Filter className="w-4 h-4 text-sky-600" /> Kelas:
          </div>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500 min-w-[160px]"
          >
            {classesList.length === 0 ? (
              <option value="">Tidak ada kelas binaan</option>
            ) : (
              classesList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 ml-2">
            <Calendar className="w-4 h-4 text-sky-600" /> Sesi Tanggal Tes:
          </div>

          {isNewDateMode || availableDates.length === 0 ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-center focus:outline-none focus:border-sky-500"
              />
              {availableDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewDateMode(false);
                    setTestDate(availableDates[0]);
                  }}
                  className="text-[11px] text-sky-600 hover:underline font-semibold"
                >
                  Pilih Tanggal Ada
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-sky-500 min-w-[150px]"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === availableDates[0] ? '(Terbaru)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsNewDateMode(true);
                  setTestDate(new Date().toISOString().split('T')[0]);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-[11px] font-semibold transition-colors"
                title="Buat Sesi Tanggal Tes Baru"
              >
                <Plus className="w-3.5 h-3.5" /> Tanggal Baru
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 ml-2">
            <Layers className="w-4 h-4 text-sky-600" /> T.A / Semester:
          </div>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2025/2026"
            className="w-24 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-center focus:outline-none focus:border-sky-500"
          />
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-sky-500"
          >
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </div>

        {selectedClassId && (
          <span className="text-xs text-gray-500 font-medium">
            Total Siswa: {students.length} orang
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          {classesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 py-16">
              <FileSpreadsheet className="w-12 h-12 text-gray-300" />
              <p className="text-sm font-medium">Belum ada penugasan kelas binaan untuk akun Anda.</p>
            </div>
          ) : !selectedClassId ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 py-16">
              <FileSpreadsheet className="w-12 h-12 text-gray-300" />
              <p className="text-sm font-medium">Silakan pilih kelas dan tentukan tanggal tes untuk mulai mengisi nilai.</p>
            </div>
          ) : loading ? (
            <div className="text-center py-20 text-gray-400 text-xs">Memuat data nilai tanggal {testDate}...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-xs">Belum ada data siswa di kelas ini. Silakan tambahkan siswa di menu Data Siswa.</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-gray-50 sticky top-0 z-20 border-b border-gray-200 text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 sticky left-0 bg-gray-50 z-30 border-r border-gray-200">No</th>
                  <th className="py-3 px-4 sticky left-[45px] bg-gray-50 z-30 border-r border-gray-200">NIS</th>
                  <th className="py-3 px-4 sticky left-[125px] bg-gray-50 z-30 border-r border-gray-200 min-w-[200px]">Nama Siswa</th>
                  <th className="py-3 px-4 sticky left-[325px] bg-gray-50 z-30 border-r border-gray-200">L/P</th>
                  {testItems.map((test) => {
                    const isRun = isRunningTest(test.name);
                    return (
                      <th key={test.id} className="py-3 px-4 border-r border-gray-200 text-center min-w-[140px]">
                        <div className="font-bold text-gray-900">{test.name}</div>
                        <div className="text-[10px] text-sky-600 font-normal lowercase">
                          {isRun ? '(dalam Menit, cth: 5.5)' : `(${test.metric_type.replace(/_/g, ' ')})`}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {students.map((student, index) => {
                  return (
                    <tr key={student.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-2.5 px-4 sticky left-0 bg-white z-10 border-r border-gray-100 font-medium text-gray-500">{index + 1}</td>
                      <td className="py-2.5 px-4 sticky left-[45px] bg-white z-10 border-r border-gray-100 font-medium text-gray-800">{student.nis}</td>
                      <td className="py-2.5 px-4 sticky left-[125px] bg-white z-10 border-r border-gray-100 font-semibold text-gray-900">{student.full_name}</td>
                      <td className="py-2.5 px-4 sticky left-[325px] bg-white z-10 border-r border-gray-100">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          student.gender === 'Laki-laki' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {student.gender === 'Laki-laki' ? 'L' : 'P'}
                        </span>
                      </td>
                      {testItems.map((test) => {
                        const isNotApplicable = 
                          (test.target_gender === 'laki_laki' && student.gender !== 'Laki-laki') ||
                          (test.target_gender === 'perempuan' && student.gender !== 'Perempuan');

                        const isRun = isRunningTest(test.name);
                        const cellKey = `${student.id}_${test.id}`;

                        return (
                          <td key={test.id} className="py-2 px-3 border-r border-gray-100 text-center">
                            {isNotApplicable ? (
                              <span className="text-gray-300 italic text-[10px]">Khusus {test.target_gender}</span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                placeholder={isRun ? "Cth: 5.5" : "0"}
                                value={scores[cellKey] || ''}
                                onChange={(e) => handleScoreChange(student.id, test.id, e.target.value)}
                                className="w-24 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-sky-500 font-medium"
                                title={isRun ? "Masukkan dalam satuan menit (misal: 5.5 untuk 5.5 menit)" : ""}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>📅 Tanggal Pelaksanaan Tes Terpilih: <b>{testDate || 'Belum dipilih'}</b> | Periode: {academicYear} ({semester})</span>
          <span className="font-semibold text-sky-700">Sagara Enterprise Fitness Tracker</span>
        </div>
      </div>
    </div>
  );
}