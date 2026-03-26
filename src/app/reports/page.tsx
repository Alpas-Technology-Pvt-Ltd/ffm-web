"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { FileText, Download, Calendar, CheckCircle2, Clock, AlertTriangle, Users, Zap } from 'lucide-react';

export default function ReportsPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!db) return;

    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTechnicians(data);
    });

    // Fetch ALL tasks
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTasks(data);
    });

    // Fetch ALL attendance logs
    const unsubLogs = onSnapshot(collection(db, 'attendance_logs'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setAttendanceLogs(data);
    });

    return () => { unsubTechs(); unsubTasks(); unsubLogs(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech?.name || (uid || '').substring(0, 8) + '...';
  };

  // Filter tasks by selected date
  const dayTasks = tasks.filter(t => {
    if (!t.createdAt?.toDate) return false;
    const d = t.createdAt.toDate();
    const taskDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return taskDate === selectedDate;
  });

  const dayLogs = attendanceLogs.filter(l => l.date === selectedDate);

  // Stats
  const completed = dayTasks.filter(t => t.status === 'completed').length;
  const pending = dayTasks.filter(t => t.status === 'pending').length;
  const inProgress = dayTasks.filter(t => t.status === 'in_progress').length;
  const pendingApproval = dayTasks.filter(t => t.status === 'pending_approval').length;
  const gamified = dayTasks.filter(t => t.type === 'opportunistic').length;
  const totalBonus = dayTasks.filter(t => t.type === 'opportunistic' && t.status === 'completed').reduce((acc, t) => acc + (t.bonus_value || 0), 0);
  const totalHours = dayLogs.reduce((acc, l) => acc + (l.total_hours || 0), 0);
  const overtimeLogs = dayLogs.filter(l => (l.total_hours || 0) > 8);

  const handleExport = () => {
    const lines = [
      `FFM Daily Report — ${selectedDate}`,
      '',
      `SUMMARY`,
      `Total Tasks: ${dayTasks.length}`,
      `Completed: ${completed}`,
      `Pending: ${pending}`,
      `In Progress: ${inProgress}`,
      `Pending Approval: ${pendingApproval}`,
      `Gamified Tasks: ${gamified}`,
      `Total Bonus Paid: Rs. ${totalBonus}`,
      `Total Hours Logged: ${totalHours.toFixed(1)}`,
      `Overtime Flags: ${overtimeLogs.length}`,
      '',
      `TASK DETAILS`,
      'Title | Technician | Type | Status',
      '------|-----------|------|-------',
      ...dayTasks.map(t => `${t.title} | ${t.assigned_to ? getTechName(t.assigned_to) : 'Unassigned'} | ${t.type} | ${t.status}`),
      '',
      `ATTENDANCE LOGS`,
      'Technician | Total Hours | Status',
      '-----------|------------|-------',
      ...dayLogs.map(l => `${getTechName(l.user_id)} | ${l.total_hours?.toFixed(1) || 0}h | ${l.status}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ffm-report-${selectedDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><FileText size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Daily Reports</h1>
                <p className="text-slate-400 mt-1">Generate operational summaries and export field data.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 [color-scheme:dark]" />
              <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20">
                <Download size={16} /> Export Report
              </button>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={completed} color="emerald" />
            <StatCard icon={<Clock size={20} />} label="In Progress" value={inProgress + pendingApproval} color="blue" />
            <StatCard icon={<Zap size={20} />} label="Bonus Paid" value={`Rs. ${totalBonus}`} color="amber" />
            <StatCard icon={<Users size={20} />} label="Hours Logged" value={`${totalHours.toFixed(1)}h`} color="indigo" />
          </div>

          {/* Main Content */}
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left: Tasks */}
            <div className="flex-1 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032]/80 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                <h2 className="text-sm font-bold text-white uppercase">Tasks on {selectedDate} <span className="text-slate-500 font-normal ml-2">({dayTasks.length} total)</span></h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {dayTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Calendar size={36} className="mb-3 opacity-30" />
                    <p className="text-sm">No tasks on this date.</p>
                  </div>
                ) : (
                  dayTasks.map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4 text-sm">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'completed' ? 'bg-emerald-400' : t.status === 'pending_approval' ? 'bg-orange-400' : 'bg-slate-500'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-medium">{t.title}</span>
                        {t.assigned_to && <span className="text-slate-500 ml-2">→ {getTechName(t.assigned_to)}</span>}
                      </div>
                      {t.type === 'opportunistic' && t.bonus_value > 0 && (
                        <span className="text-amber-400 text-xs font-bold">+Rs. {t.bonus_value}</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        t.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                        t.status === 'pending_approval' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                        'text-slate-400 bg-slate-500/10 border-slate-500/20'
                      }`}>{t.status?.replace('_', ' ')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Attendance */}
            <div className="w-80 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032]/80 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                <h2 className="text-sm font-bold text-white uppercase">Attendance Logs</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {dayLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Clock size={36} className="mb-3 opacity-30" />
                    <p className="text-sm">No logs on this date.</p>
                  </div>
                ) : (
                  dayLogs.map(l => (
                    <div key={l.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{getTechName(l.user_id)}</span>
                        <span className={`text-xs font-bold ${(l.total_hours || 0) > 8 ? 'text-red-400' : 'text-emerald-400'}`}>{l.total_hours?.toFixed(1)}h</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{l.status}</span>
                        {(l.total_hours || 0) > 8 && <span className="text-orange-400 flex items-center gap-1"><AlertTriangle size={10} /> Overtime</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
  const colorMap: any = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  return (
    <div className={`p-5 rounded-2xl border ${colorMap[color]} flex items-center gap-4`}>
      <div className="p-2.5 rounded-xl bg-white/5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}
