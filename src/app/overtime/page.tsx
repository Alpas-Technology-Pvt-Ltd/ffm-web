"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OvertimePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;

    // 1. Fetch Techs to resolve names
    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTechnicians(data);
    });

    // 2. Fetch Pending Attendance Logs representing Overtime Requests
    const logsQuery = query(collection(db, 'attendance_logs'), where('status', '==', 'pending'));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      // Sort manually client side if index missing (descending by date)
      data.sort((a, b) => {
         const dateA = a.date ? new Date(a.date).getTime() : 0;
         const dateB = b.date ? new Date(b.date).getTime() : 0;
         return dateB - dateA;
      });
      setLogs(data);
    });

    return () => {
      unsubTechs();
      unsubLogs();
    };
  }, []);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech && tech.name ? tech.name : (uid || '').substring(0,8) + '...';
  };

  const handleApprove = async (logId: string) => {
    setActionLoading(logId);
    try {
      const logRef = doc(db, 'attendance_logs', logId);
      // Because we are authenticated as a supervisor via AuthGuard, firestore.rules will accept this write!
      await updateDoc(logRef, {
        status: 'approved'
      });
    } catch (err) {
      console.error("Approval failed:", err);
      alert("Permission denied. Verify Supervisor clearance.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
        
        <Sidebar />

        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-red-500/10 text-red-400 border-red-500/20">
                <Clock size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Overtime Approvals</h1>
                <p className="text-slate-400 mt-1">Audit and authorize field technician &gt;8hr extension requests.</p>
              </div>
            </div>
            {logs.length > 0 && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide animate-pulse">
                  <AlertCircle size={16} /> {logs.length} Pending
                </div>
            )}
          </header>

          <div className="flex-1 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032]/80 overflow-hidden flex flex-col">
             {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <CheckCircle2 size={48} className="mb-4 opacity-30" />
                    <p className="text-lg">All shifts authorized. No pending overtime requests.</p>
                </div>
             ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-[#1a253a]">
                        <th className="p-5 font-medium text-slate-400 uppercase text-xs tracking-wider">Field Technician</th>
                        <th className="p-5 font-medium text-slate-400 uppercase text-xs tracking-wider">Date Logged</th>
                        <th className="p-5 font-medium text-slate-400 uppercase text-xs tracking-wider">Total Hours</th>
                        <th className="p-5 font-medium text-slate-400 uppercase text-xs tracking-wider">Justification</th>
                        <th className="p-5 font-medium text-slate-400 uppercase text-xs tracking-wider text-right">Action Gateway</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-5 font-bold text-white">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 uppercase">
                                  {getTechName(log.user_id).charAt(0)}
                               </div>
                               {getTechName(log.user_id)}
                             </div>
                          </td>
                          <td className="p-5 text-slate-300">{log.date || 'Unknown Date'}</td>
                          <td className="p-5">
                             <span className={`inline-flex px-2 py-1 rounded text-xs font-bold border ${log.total_hours > 8 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                               {log.total_hours?.toFixed(1) || 0} HRS
                             </span>
                          </td>
                          <td className="p-5 text-sm text-slate-400 max-w-xs truncate">
                             {log.notes || 'Automated System Flag (Shift Exceeded Target)'}
                          </td>
                          <td className="p-5 text-right">
                             <button
                               onClick={() => handleApprove(log.id)}
                               disabled={actionLoading === log.id}
                               className="glass-pill px-4 py-2 text-sm font-bold uppercase tracking-wide text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all flex items-center gap-2 ml-auto disabled:opacity-50"
                             >
                               {actionLoading === log.id ? "Authorizing..." : <><CheckCircle2 size={16} /> Approve Overtime</>}
                             </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
