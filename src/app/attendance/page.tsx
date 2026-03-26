"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CalendarCheck, Clock, Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function AttendancePage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
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
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTechnicians(data);
    });

    const unsubLogs = onSnapshot(collection(db, 'attendance_logs'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setAttendanceLogs(data);
    });

    return () => { unsubTechs(); unsubLogs(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: extract date string (YYYY-MM-DD) from various formats
  const getDateFromLog = (log: any): string => {
    // 1. Direct "date" string field
    if (log.date && typeof log.date === 'string') return log.date;
    // 2. "date" as Firestore Timestamp
    if (log.date?.toDate) {
      const d = log.date.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    // 3. Extract from check_in timestamp
    const ts = log.check_in || log.checkIn || log.timestamp || log.created_at || log.createdAt;
    if (ts?.toDate) {
      const d = ts.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (ts?.seconds) {
      const d = new Date(ts.seconds * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  };

  // Helper: get user ID from log (handles different field names)
  const getUserIdFromLog = (log: any): string => {
    return log.user_id || log.uid || log.userId || log.technician_id || log.technicianId || '';
  };

  // Filter logs by selected date
  const dayLogs = attendanceLogs.filter(l => getDateFromLog(l) === selectedDate);

  // Build attendance map: tech_id -> merged log
  const logMap = new Map<string, any>();
  
  dayLogs.forEach(l => {
    const uid = getUserIdFromLog(l);
    if (!uid) return;
    
    if (!logMap.has(uid)) {
      logMap.set(uid, { ...l });
    } else {
      // Merge logs: take earliest check_in and latest check_out
      const existing = logMap.get(uid);
      const currentIn = l.check_in || l.checkIn || l.punch_in || l.punchIn || l.timestamp || l.created_at;
      const existingIn = existing.check_in || existing.checkIn || existing.punch_in || existing.punchIn || existing.timestamp || existing.created_at;
      
      const currentOut = l.check_out || l.checkOut || l.punch_out || l.punchOut;
      const existingOut = existing.check_out || existing.checkOut || existing.punch_out || existing.punchOut;

      // Update check_in if current is earlier
      if (currentIn) {
        const currentSecs = currentIn.seconds ?? (currentIn.toDate ? currentIn.toDate().getTime()/1000 : 0);
        const existingSecs = existingIn?.seconds ?? (existingIn?.toDate ? existingIn.toDate().getTime()/1000 : Infinity);
        if (currentSecs < existingSecs) {
          existing.check_in = currentIn;
        }
      }
      
      // Update check_out if current is later
      if (currentOut) {
        const currentSecs = currentOut.seconds ?? (currentOut.toDate ? currentOut.toDate().getTime()/1000 : 0);
        const existingSecs = existingOut?.seconds ?? (existingOut?.toDate ? existingOut.toDate().getTime()/1000 : 0);
        if (currentSecs > existingSecs) {
          existing.check_out = currentOut;
        }
      } else if (!existingOut && currentIn) {
        // If no explicit checkout, but we have a second check_in/timestamp later, count it as check_out
        const currentSecs = currentIn.seconds ?? (currentIn.toDate ? currentIn.toDate().getTime()/1000 : 0);
        const existingInSecs = existingIn?.seconds ?? (existingIn?.toDate ? existingIn.toDate().getTime()/1000 : 0);
        if (currentSecs > existingInSecs) {
          existing.check_out = currentIn;
        }
      }
      
      // Merge other fields
      if (l.notes && !existing.notes?.includes(l.notes)) existing.notes = (existing.notes ? existing.notes + "; " : "") + l.notes;
      if (l.status && l.status !== 'pending') existing.status = l.status;
      if (l.total_hours) existing.total_hours = (existing.total_hours || 0) + l.total_hours;
    }
  });

  // Calculate total hours if check_in and check_out exist but total_hours doesn't
  logMap.forEach(log => {
    if (!log.total_hours && log.check_in && log.check_out) {
      const start = log.check_in.toDate?.() || new Date((log.check_in.seconds || 0) * 1000);
      const end = log.check_out.toDate?.() || new Date((log.check_out.seconds || 0) * 1000);
      log.total_hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }
  });

  // Stats
  const activeTechs = technicians.filter(t => t.current_status !== 'deactivated');
  const presentCount = activeTechs.filter(t => logMap.has(t.id)).length;
  const absentCount = activeTechs.length - presentCount;
  const overtimeCount = Array.from(logMap.values()).filter(l => (l.total_hours || 0) > 8).length;
  const totalHours = Array.from(logMap.values()).reduce((acc, l) => acc + (l.total_hours || 0), 0);
  const avgHours = logMap.size > 0 ? totalHours / logMap.size : 0;

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '—';
    if (timestamp.toDate) return new Date(timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (typeof timestamp === 'string') return timestamp;
    if (typeof timestamp === 'number') return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '—';
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 right-1/3 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="mb-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
                <CalendarCheck size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Attendance</h1>
                <p className="text-slate-400 mt-1">Daily check-in/check-out tracking for field technicians.</p>
              </div>
            </div>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-teal-500 [color-scheme:dark]" />
          </header>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-6 shrink-0">
            <StatCard icon={<Users size={18} />} label="Total Active" value={activeTechs.length} color="teal" />
            <StatCard icon={<CheckCircle2 size={18} />} label="Present" value={presentCount} color="emerald" />
            <StatCard icon={<XCircle size={18} />} label="Absent" value={absentCount} color="slate" />
            <StatCard icon={<AlertTriangle size={18} />} label="Overtime" value={overtimeCount} color="amber" />
            <StatCard icon={<Clock size={18} />} label="Avg Hours" value={`${avgHours.toFixed(1)}h`} color="blue" />
          </div>

          {/* Attendance Table */}
          <div className="flex-1 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032]/80 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-700/50 bg-[#1a253a] shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase">
                Attendance for {selectedDate}
                <span className="text-slate-500 font-normal ml-2">({dayLogs.length} logs)</span>
              </h2>
            </div>
            <div className="overflow-x-auto flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/50 bg-[#1a253a]">
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Technician</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Status</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Check In</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Check Out</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Total Hours</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Approval</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {activeTechs.map(tech => {
                    const log = logMap.get(tech.id);
                    const isPresent = !!log;
                    const isOvertime = (log?.total_hours || 0) > 8;
                    return (
                      <tr key={tech.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isPresent ? 'bg-teal-500/20 text-teal-400 border-2 border-teal-500/30' : 'bg-slate-700/50 text-slate-500 border-2 border-slate-600/30'}`}>
                              {(tech.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{tech.name || 'Unknown'}</p>
                              {tech.phone && <p className="text-[10px] text-slate-500">{tech.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {isPresent ? (
                            log.check_out ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Complete</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">Punched In</span>
                            )
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-500/10 text-slate-500 border border-slate-500/20">Absent</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-slate-300 font-mono">{formatTime(log?.check_in || log?.checkIn || log?.punch_in || log?.punchIn)}</td>
                        <td className="p-4 text-sm text-slate-300 font-mono">{formatTime(log?.check_out || log?.checkOut || log?.punch_out || log?.punchOut)}</td>
                        <td className="p-4">
                          {isPresent ? (
                            <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${isOvertime ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600/50'}`}>
                              {log.total_hours?.toFixed(1) || '0.0'} hrs
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="p-4">
                          {log?.status ? (
                            <span className={`text-xs font-bold uppercase ${log.status === 'approved' ? 'text-emerald-400' : log.status === 'pending' ? 'text-amber-400' : 'text-slate-500'}`}>
                              {log.status}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate">{log?.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {activeTechs.length === 0 && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                  <Users size={36} className="mb-3 opacity-30" />
                  <p className="text-sm">No active technicians found.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color]} flex items-center gap-3`}>
      <div className="p-2 rounded-lg bg-white/5">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-xl font-bold text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
