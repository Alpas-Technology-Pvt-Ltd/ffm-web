"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { History, Search, User, MapPin, Filter, ChevronDown } from 'lucide-react';

export default function TaskHistoryPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [filterTech, setFilterTech] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!db) return;

    // Fetch technicians for filter dropdown
    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTechnicians(data);
    });

    // Fetch ALL tasks (no status filter = full history)
    const tasksRef = collection(db, 'tasks');
    const unsubTasks = onSnapshot(tasksRef, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      // Sort by createdAt descending client-side
      data.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setTasks(data);
    });

    return () => { unsubTechs(); unsubTasks(); };
  }, []);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech?.name || (uid || '').substring(0, 8) + '...';
  };

  // Apply filters
  const filteredTasks = tasks.filter(t => {
    if (filterTech && t.assigned_to !== filterTech) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.customer?.name?.toLowerCase().includes(q) || t.customer?.address?.toLowerCase().includes(q));
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const styles: any = {
      pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      pending_approval: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return styles[status] || styles.pending;
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-indigo-500/10 text-indigo-400 border-indigo-500/20"><History size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Task History</h1>
                <p className="text-slate-400 mt-1">Full audit trail of all dispatched field operations.</p>
              </div>
            </div>
            <div className="text-sm text-slate-500">{filteredTasks.length} of {tasks.length} tasks</div>
          </header>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-indigo-500" placeholder="Search by title, description, customer..." />
            </div>
            <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[180px]">
              <option value="" className="bg-slate-800">All Technicians</option>
              {technicians.map(t => <option key={t.id} value={t.id} className="bg-slate-800">{t.name || t.id}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[160px]">
              <option value="" className="bg-slate-800">All Statuses</option>
              <option value="pending" className="bg-slate-800">Pending</option>
              <option value="in_progress" className="bg-slate-800">In Progress</option>
              <option value="pending_approval" className="bg-slate-800">Pending Approval</option>
              <option value="completed" className="bg-slate-800">Completed</option>
            </select>
          </div>

          {/* Table */}
          <div className="flex-1 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032]/80 overflow-hidden">
            <div className="overflow-x-auto h-full overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/50 bg-[#1a253a]">
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Task</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Technician</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Customer</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Location</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Type</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Status</th>
                    <th className="p-4 font-medium text-slate-400 uppercase text-xs tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredTasks.length === 0 ? (
                    <tr><td colSpan={7} className="p-12 text-center text-slate-500">No tasks match your filters.</td></tr>
                  ) : (
                    filteredTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white text-sm">{t.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{t.description}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-300">{t.assigned_to ? getTechName(t.assigned_to) : <span className="text-slate-600">Unassigned</span>}</td>
                        <td className="p-4 text-sm text-slate-300">{t.customer?.name || <span className="text-slate-600">—</span>}</td>
                        <td className="p-4 text-xs text-slate-500 font-mono">{t.location?.latitude?.toFixed(4)}, {t.location?.longitude?.toFixed(4)}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded border ${t.type === 'opportunistic' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>
                            {t.type === 'opportunistic' ? 'Gamified' : 'Assigned'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded border uppercase ${getStatusBadge(t.status)}`}>{t.status?.replace('_', ' ')}</span>
                        </td>
                        <td className="p-4 text-xs text-slate-500">{t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
