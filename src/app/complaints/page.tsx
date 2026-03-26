"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { MessageSquareWarning, Plus, Search, Send, AlertCircle, MapPin, Phone, User, Clock, CheckCircle2, X, ChevronRight, Flame, ArrowUpCircle, ArrowDownCircle, MinusCircle, Image as ImageIcon, Tag, ShieldCheck, ClipboardCheck } from 'lucide-react';

// Default categories (will be seeded into Firestore if needed)
const DEFAULT_CATEGORIES = [
  { name: 'Technical', priority_weight: 3, color: '#3B82F6' },
  { name: 'Service', priority_weight: 2, color: '#F59E0B' },
  { name: 'Grievance', priority_weight: 4, color: '#EF4444' },
  { name: 'Billing', priority_weight: 1, color: '#10B981' },
  { name: 'Infrastructure', priority_weight: 3, color: '#8B5CF6' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open: { label: 'Open', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  pending_approval: { label: 'Awaiting Verification', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  resolved: { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  closed: { label: 'Closed', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
};

// Map task status → complaint status for auto-sync
const TASK_TO_COMPLAINT_STATUS: Record<string, string> = {
  pending: 'in_progress',
  en_route: 'in_progress',
  on_site: 'in_progress',
  pending_approval: 'pending_approval',
  completed: 'resolved',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  low: { label: 'Low', color: 'text-slate-400', icon: ArrowDownCircle },
  medium: { label: 'Medium', color: 'text-amber-400', icon: MinusCircle },
  high: { label: 'High', color: 'text-orange-400', icon: ArrowUpCircle },
  critical: { label: 'Critical', color: 'text-red-400', icon: Flame },
};

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(DEFAULT_CATEGORIES);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Technical');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [formReporterName, setFormReporterName] = useState('');
  const [formReporterPhone, setFormReporterPhone] = useState('');
  const [formLat, setFormLat] = useState('27.7172');
  const [formLng, setFormLng] = useState('85.3240');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Real-time streams
  useEffect(() => {
    if (!db) return;

    const unsubComplaints = onSnapshot(collection(db, 'complaints'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setComplaints(data);
    });

    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTechnicians(data);
    });

    const unsubCats = onSnapshot(collection(db, 'complaint_categories'), (snapshot) => {
      if (!snapshot.empty) {
        const data: any[] = [];
        snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
        setCategories(data);
      }
    });

    // Stream tasks that are linked to complaints for real-time status sync
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => {
        const taskData = { id: d.id, ...d.data() };
        if ((taskData as any).complaint_id) data.push(taskData);
      });
      setLinkedTasks(data);

      // Auto-sync: update complaint status based on task status changes
      data.forEach(async (task: any) => {
        const newComplaintStatus = TASK_TO_COMPLAINT_STATUS[task.status];
        if (!newComplaintStatus || !task.complaint_id) return;
        try {
          // Only update if the complaint status needs to change
          const updates: any = { status: newComplaintStatus };
          if (newComplaintStatus === 'resolved') updates.resolved_at = serverTimestamp();
          await updateDoc(doc(db, 'complaints', task.complaint_id), updates);
        } catch (err) {
          // Silently ignore — complaint may already be in correct state
        }
      });
    });

    return () => { unsubComplaints(); unsubTechs(); unsubCats(); unsubTasks(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Comments stream for selected complaint
  useEffect(() => {
    if (!selectedComplaint || !db) { setComments([]); return; }
    const commentsQuery = query(
      collection(db, 'complaints', selectedComplaint.id, 'comments'),
      orderBy('created_at', 'asc')
    );
    const unsub = onSnapshot(commentsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setComments(data);
    }, (error) => {
      console.warn('Comments query error (index may be needed):', error.message);
      setComments([]);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedComplaint?.id]);

  // Keep selected complaint in sync
  useEffect(() => {
    if (selectedComplaint) {
      const updated = complaints.find(c => c.id === selectedComplaint.id);
      if (updated) setSelectedComplaint(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints]);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech?.name || (uid || '').substring(0, 8) + '...';
  };

  // Create complaint
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim()) { setFormError('Title and description are required.'); return; }
    setIsSubmitting(true); setFormError(''); setFormSuccess('');
    try {
      await addDoc(collection(db, 'complaints'), {
        title: formTitle.trim(),
        description: formDesc.trim(),
        category: formCategory,
        priority: formPriority,
        status: 'open',
        reporter_name: formReporterName.trim() || null,
        reporter_phone: formReporterPhone.trim() || null,
        location: { latitude: parseFloat(formLat) || 27.7172, longitude: parseFloat(formLng) || 85.3240 },
        images: formImageUrl.trim() ? [formImageUrl.trim()] : [],
        assigned_to: null,
        resolved_at: null,
        createdAt: serverTimestamp(),
      });
      setFormSuccess('Complaint registered successfully.');
      setFormTitle(''); setFormDesc(''); setFormReporterName(''); setFormReporterPhone('');
      setFormImageUrl(''); setFormPriority('medium');
      setTimeout(() => { setShowNewForm(false); setFormSuccess(''); }, 1500);
    } catch (err: any) { setFormError(err.message || 'Failed to submit.'); }
    finally { setIsSubmitting(false); }
  };

  // Update status — also syncs linked tasks
  const handleStatusChange = async (complaintId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'resolved') updates.resolved_at = serverTimestamp();
      await updateDoc(doc(db, 'complaints', complaintId), updates);

      // Sync linked tasks: if complaint is resolved/closed, complete the linked tasks
      if (newStatus === 'resolved' || newStatus === 'closed') {
        // Find tasks linked to this complaint
        const linkedTasksQuery = query(collection(db, 'tasks'), where('complaint_id', '==', complaintId));
        const unsubLinked = onSnapshot(linkedTasksQuery, async (snapshot) => {
          snapshot.forEach(async (taskDoc) => {
            if (taskDoc.data().status !== 'completed') {
              await updateDoc(doc(db, 'tasks', taskDoc.id), { status: 'completed' });
            }
          });
          unsubLinked(); // Unsubscribe immediately — we only need one read
        });
      }
    } catch (err) { console.error(err); }
  };

  // Assign technician — also creates a linked task so it appears in the technician's app
  const handleAssign = async (complaintId: string, techId: string) => {
    try {
      // Find the complaint data to populate the task
      const complaint = complaints.find(c => c.id === complaintId);

      // 1. Update the complaint
      await updateDoc(doc(db, 'complaints', complaintId), {
        assigned_to: techId,
        status: 'in_progress',
      });

      // 2. Create a linked task for the technician's app
      await addDoc(collection(db, 'tasks'), {
        title: `Resolve: ${complaint?.title || 'Complaint'}`,
        description: complaint?.description || '',
        type: 'assigned',
        status: 'pending',
        location: complaint?.location || { latitude: 27.7172, longitude: 85.3240 },
        assigned_to: techId,
        bonus_value: 0,
        customer: {
          name: complaint?.reporter_name || null,
          phone: complaint?.reporter_phone || null,
          address: null,
        },
        complaint_id: complaintId,
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
  };

  // Send comment
  const handleSendComment = async (complaintId: string) => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      await addDoc(collection(db, 'complaints', complaintId, 'comments'), {
        author_id: 'supervisor',
        author_name: 'Supervisor',
        text,
        created_at: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
  };

  // Filters
  const filtered = complaints.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.reporter_name?.toLowerCase().includes(q));
    }
    return true;
  });

  // Stats
  const openCount = complaints.filter(c => c.status === 'open').length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedToday = complaints.filter(c => {
    if (c.status !== 'resolved' || !c.resolved_at?.toDate) return false;
    const d = c.resolved_at.toDate();
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const PriorityIcon = ({ priority }: { priority: string }) => {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
    const Icon = config.icon;
    return <Icon size={14} className={config.color} />;
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 relative z-10 p-8 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="mb-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <MessageSquareWarning size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Complaints</h1>
                <p className="text-slate-400 mt-1">Centralized complaint intake, tracking & resolution.</p>
              </div>
            </div>
            <button onClick={() => { setShowNewForm(!showNewForm); setSelectedComplaint(null); }} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-400 transition shadow-lg shadow-rose-500/20">
              {showNewForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Complaint</>}
            </button>
          </header>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/10"><MessageSquareWarning size={18} className="text-slate-400" /></div>
              <div><p className="text-xs text-slate-500 uppercase font-medium">Total</p><p className="text-xl font-bold text-white">{complaints.length}</p></div>
            </div>
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10"><AlertCircle size={18} className="text-red-400" /></div>
              <div><p className="text-xs text-red-400/60 uppercase font-medium">Open</p><p className="text-xl font-bold text-red-400">{openCount}</p></div>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Clock size={18} className="text-blue-400" /></div>
              <div><p className="text-xs text-blue-400/60 uppercase font-medium">In Progress</p><p className="text-xl font-bold text-blue-400">{inProgressCount}</p></div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle2 size={18} className="text-emerald-400" /></div>
              <div><p className="text-xs text-emerald-400/60 uppercase font-medium">Resolved Today</p><p className="text-xl font-bold text-emerald-400">{resolvedToday}</p></div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-6 shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-rose-500" placeholder="Search complaints..." />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[140px]">
              <option value="" className="bg-slate-800">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k} className="bg-slate-800">{v.label}</option>)}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[140px]">
              <option value="" className="bg-slate-800">All Categories</option>
              {categories.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.name}</option>)}
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[140px]">
              <option value="" className="bg-slate-800">All Priority</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k} className="bg-slate-800">{v.label}</option>)}
            </select>
          </div>

          {/* Main Content */}
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left: Complaint List */}
            <div className="w-1/2 flex flex-col overflow-y-auto space-y-3 pr-2">
              {/* New Complaint Form */}
              {showNewForm && (
                <div className="glass-panel rounded-2xl border border-rose-500/20 p-6 space-y-4 shrink-0">
                  <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Plus size={14} className="text-rose-400" /> Register New Complaint</h3>
                  {formError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2"><AlertCircle size={14} /> {formError}</div>}
                  {formSuccess && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2"><CheckCircle2 size={14} /> {formSuccess}</div>}
                  <form onSubmit={handleCreate} className="space-y-3">
                    <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-rose-500 placeholder:text-slate-600 font-medium" placeholder="Complaint Title *" />
                    <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-rose-500 placeholder:text-slate-600 h-20 resize-none" placeholder="Detailed description *" />
                    <div className="flex gap-3">
                      <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                        {categories.map(c => <option key={c.name} value={c.name} className="bg-slate-800">{c.name}</option>)}
                      </select>
                      <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as any)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                        <option value="low" className="bg-slate-800">Low Priority</option>
                        <option value="medium" className="bg-slate-800">Medium Priority</option>
                        <option value="high" className="bg-slate-800">High Priority</option>
                        <option value="critical" className="bg-slate-800">Critical Priority</option>
                      </select>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Reporter Info</p>
                      <div className="flex gap-3">
                        <input value={formReporterName} onChange={(e) => setFormReporterName(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none placeholder:text-slate-600" placeholder="Reporter Name" />
                        <input value={formReporterPhone} onChange={(e) => setFormReporterPhone(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none placeholder:text-slate-600" placeholder="Phone" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <input value={formLat} onChange={(e) => setFormLat(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none font-mono" placeholder="LAT" />
                      <input value={formLng} onChange={(e) => setFormLng(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none font-mono" placeholder="LNG" />
                    </div>
                    <input value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none placeholder:text-slate-600" placeholder="Image URL (optional)" />
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-400 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-rose-500/20">
                      {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={16} /> Submit Complaint</>}
                    </button>
                  </form>
                </div>
              )}

              {/* Complaint Cards */}
              {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <MessageSquareWarning size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">{complaints.length === 0 ? 'No complaints registered yet.' : 'No complaints match your filters.'}</p>
                </div>
              ) : (
                filtered.map(c => {
                  const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
                  const priority = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;
                  const PIcon = priority.icon;
                  return (
                    <div key={c.id} onClick={() => { setSelectedComplaint(c); setShowNewForm(false); }}
                      className={`p-5 rounded-2xl border transition cursor-pointer group relative overflow-hidden ${selectedComplaint?.id === c.id ? 'bg-white/10 border-rose-500/40' : 'bg-white/5 border-white/5 hover:bg-white/8'}`}>
                      {c.priority === 'critical' && <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-xl pointer-events-none" />}
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.bg} border ${status.border}`}>
                          <MessageSquareWarning size={18} className={status.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-white font-bold text-sm truncate pr-4">{c.title}</h3>
                            <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition shrink-0" />
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1 mb-3">{c.description}</p>
                          <div className="flex items-center gap-3 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded border font-bold uppercase text-[10px] ${status.bg} ${status.color} ${status.border}`}>{status.label}</span>
                            <span className={`flex items-center gap-1 ${priority.color}`}><PIcon size={12} /> {priority.label}</span>
                            <span className="text-slate-500 flex items-center gap-1"><Tag size={11} /> {c.category}</span>
                            {c.reporter_name && <span className="text-slate-500 flex items-center gap-1"><User size={11} /> {c.reporter_name}</span>}
                            {c.assigned_to && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[10px] font-bold">{getTechName(c.assigned_to)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Detail Panel */}
            <div className="w-1/2 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032] overflow-hidden flex flex-col">
              {selectedComplaint ? (
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white uppercase">Complaint Detail</h2>
                      <button onClick={() => setSelectedComplaint(null)} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
                    </div>
                  </div>

                  {/* Detail Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Title + Status + Priority */}
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-bold text-white">{selectedComplaint.title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityIcon priority={selectedComplaint.priority} />
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${STATUS_CONFIG[selectedComplaint.status]?.bg} ${STATUS_CONFIG[selectedComplaint.status]?.color} ${STATUS_CONFIG[selectedComplaint.status]?.border}`}>
                            {STATUS_CONFIG[selectedComplaint.status]?.label || selectedComplaint.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{selectedComplaint.description}</p>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase mb-1">Category</p>
                        <p className="text-sm text-white font-medium flex items-center gap-2"><Tag size={13} className="text-slate-500" /> {selectedComplaint.category}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] text-slate-500 uppercase mb-1">Priority</p>
                        <p className={`text-sm font-medium flex items-center gap-2 ${PRIORITY_CONFIG[selectedComplaint.priority]?.color}`}>
                          <PriorityIcon priority={selectedComplaint.priority} /> {PRIORITY_CONFIG[selectedComplaint.priority]?.label}
                        </p>
                      </div>
                    </div>

                    {/* Linked Task Status Tracker */}
                    {(() => {
                      const task = linkedTasks.find((t: any) => t.complaint_id === selectedComplaint.id);
                      if (!task) return null;
                      const TASK_STEPS = [
                        { key: 'pending', label: 'Assigned', icon: ClipboardCheck },
                        { key: 'pending_approval', label: 'Proof Submitted', icon: ShieldCheck },
                        { key: 'completed', label: 'Verified', icon: CheckCircle2 },
                      ];
                      const currentIdx = TASK_STEPS.findIndex(s => s.key === task.status);
                      return (
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-4">
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-2">
                            <ClipboardCheck size={13} /> Linked Task Progress
                          </p>
                          {/* Progress Steps */}
                          <div className="flex items-center gap-1">
                            {TASK_STEPS.map((step, i) => {
                              const StepIcon = step.icon;
                              const isActive = i <= currentIdx;
                              const isCurrent = i === currentIdx;
                              return (
                                <div key={step.key} className="flex items-center gap-1 flex-1">
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 text-xs font-bold transition ${isCurrent ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-600 border border-white/5'}`}>
                                    <StepIcon size={14} />
                                    {step.label}
                                  </div>
                                  {i < TASK_STEPS.length - 1 && (
                                    <div className={`w-4 h-0.5 shrink-0 ${isActive ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Show proof if task is pending_approval */}
                          {task.status === 'pending_approval' && task.completion_proof && (
                            <div className="space-y-2 border-t border-slate-700/50 pt-3">
                              <p className="text-xs font-bold text-orange-400 uppercase">Technician Submitted Proof</p>
                              {task.completion_proof.image_base64 && (
                                <div className="rounded-xl overflow-hidden border border-slate-700 max-h-40">
                                  <img src={`data:image/jpeg;base64,${task.completion_proof.image_base64}`} alt="Proof" className="w-full object-cover" />
                                </div>
                              )}
                              {task.completion_proof.notes && (
                                <p className="text-xs text-slate-400 bg-white/5 rounded-lg p-2">"{task.completion_proof.notes}"</p>
                              )}
                            </div>
                          )}

                          {/* Task info */}
                          <div className="flex items-center justify-between text-[10px] text-slate-600">
                            <span>Task: {task.title}</span>
                            <span>Assigned to: {getTechName(task.assigned_to)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Reporter Info */}
                    {(selectedComplaint.reporter_name || selectedComplaint.reporter_phone) && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Reporter</p>
                        {selectedComplaint.reporter_name && <div className="flex items-center gap-2 text-sm"><User size={14} className="text-slate-500" /> <span className="text-white">{selectedComplaint.reporter_name}</span></div>}
                        {selectedComplaint.reporter_phone && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-slate-500" /> <span className="text-white">{selectedComplaint.reporter_phone}</span></div>}
                      </div>
                    )}

                    {/* Location */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin size={14} /> {selectedComplaint.location?.latitude?.toFixed(4)}, {selectedComplaint.location?.longitude?.toFixed(4)}
                    </div>

                    {/* Images */}
                    {selectedComplaint.images?.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Attachments</p>
                        <div className="flex gap-2 flex-wrap">
                          {selectedComplaint.images.map((img: string, i: number) => (
                            <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden hover:border-rose-500/50 transition flex items-center justify-center">
                              <img src={img} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                              <ImageIcon size={20} className="text-slate-600 absolute" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions: Status Change + Assignment */}
                    {selectedComplaint.status !== 'closed' && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Actions</p>
                        <div className="flex gap-2">
                          <select value="" onChange={(e) => handleStatusChange(selectedComplaint.id, e.target.value)}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                            <option value="" disabled className="bg-slate-800">Change Status...</option>
                            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== selectedComplaint.status).map(([k, v]) => (
                              <option key={k} value={k} className="bg-slate-800">{v.label}</option>
                            ))}
                          </select>
                          <select value="" onChange={(e) => handleAssign(selectedComplaint.id, e.target.value)}
                            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                            <option value="" disabled className="bg-slate-800">Assign Technician...</option>
                            {technicians.filter(t => t.current_status !== 'deactivated').map(t => (
                              <option key={t.id} value={t.id} className="bg-slate-800">{t.name || t.id}</option>
                            ))}
                          </select>
                        </div>
                        {selectedComplaint.assigned_to && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">Assigned to:</span>
                            <span className="text-blue-400 font-medium">{getTechName(selectedComplaint.assigned_to)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comments */}
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2 mb-3">Comments ({comments.length})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                        {comments.length === 0 ? (
                          <p className="text-xs text-slate-600 text-center py-4">No comments yet.</p>
                        ) : (
                          comments.map(c => (
                            <div key={c.id} className={`p-3 rounded-lg text-sm ${c.author_id === 'supervisor' ? 'bg-blue-500/10 border border-blue-500/10' : 'bg-white/5 border border-white/5'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${c.author_id === 'supervisor' ? 'text-blue-400' : 'text-slate-400'}`}>{c.author_name}</span>
                                <span className="text-[10px] text-slate-600">{c.created_at?.toDate ? new Date(c.created_at.toDate()).toLocaleString() : ''}</span>
                              </div>
                              <p className="text-white">{c.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendComment(selectedComplaint.id)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-rose-500" placeholder="Add a comment..." />
                        <button onClick={() => handleSendComment(selectedComplaint.id)} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-400 transition"><Send size={14} /></button>
                      </div>
                    </div>

                    {/* Created date */}
                    <div className="text-[10px] text-slate-600 pt-2 border-t border-white/5">
                      Created: {selectedComplaint.createdAt?.toDate ? new Date(selectedComplaint.createdAt.toDate()).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <MessageSquareWarning size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">Select a complaint to view details</p>
                  <p className="text-xs text-slate-600 mt-1">or create a new one</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
