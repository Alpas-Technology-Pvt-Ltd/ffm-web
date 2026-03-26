"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Star, Plus, Send, Search, User, MessageSquare, TrendingUp, Award, X, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTech, setFilterTech] = useState('');

  // Form state
  const [formComplaint, setFormComplaint] = useState('');
  const [formTech, setFormTech] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (!db) return;

    const unsubFeedback = onSnapshot(collection(db, 'feedback'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setFeedbacks(data);
    });

    const unsubComplaints = onSnapshot(collection(db, 'complaints'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setComplaints(data);
    });

    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTechnicians(data);
    });

    return () => { unsubFeedback(); unsubComplaints(); unsubTechs(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech?.name || (uid || '').substring(0, 8) + '...';
  };

  const getComplaintTitle = (cid: string) => {
    const c = complaints.find(x => x.id === cid);
    return c?.title || 'Unknown Complaint';
  };

  // Calculate average rating per technician
  const techRatings = technicians.map(tech => {
    const techFeedbacks = feedbacks.filter(f => f.technician_id === tech.id);
    const avg = techFeedbacks.length > 0 ? techFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / techFeedbacks.length : 0;
    return { ...tech, avgRating: avg, totalFeedbacks: techFeedbacks.length };
  }).filter(t => t.totalFeedbacks > 0).sort((a, b) => b.avgRating - a.avgRating);

  // Overall stats
  const avgOverall = feedbacks.length > 0 ? feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / feedbacks.length : 0;

    // Submit feedback
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formTech) { setFormError('Please select a technician.'); return; }
      setIsSubmitting(true); setFormError(''); setFormSuccess('');
      try {
        // 1. Add feedback doc
        const newFeedback = {
          complaint_id: formComplaint || null,
          technician_id: formTech,
          rating: formRating,
          comment: formComment.trim() || null,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'feedback'), newFeedback);

        // 2. Recalculate and Sync to Technician's User Document
        // We calculate including the NEW rating
        const techFeedbacks = feedbacks.filter(f => f.technician_id === formTech);
        const newTotal = techFeedbacks.length + 1;
        const newSum = techFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) + formRating;
        const newAvg = newSum / newTotal;

        await updateDoc(doc(db, 'users', formTech), {
          average_rating: newAvg,
          total_reviews: newTotal,
          last_feedback_at: serverTimestamp(),
        });

        setFormSuccess('Feedback submitted & synced to profile!');
        setFormComment(''); setFormRating(5); setFormComplaint(''); setFormTech('');
        setTimeout(() => { setShowForm(false); setFormSuccess(''); }, 1200);
      } catch (err: any) { setFormError(err.message || 'Failed to submit.'); }
      finally { setIsSubmitting(false); }
    };

  // Filter feedbacks
  const filtered = feedbacks.filter(f => {
    if (filterTech && f.technician_id !== filterTech) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (f.comment?.toLowerCase().includes(q) || getTechName(f.technician_id).toLowerCase().includes(q));
    }
    return true;
  });

  const StarDisplay = ({ rating, size = 14 }: { rating: number; size?: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
      ))}
    </div>
  );

  const StarInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(i)}
          className="p-1 hover:scale-125 transition-transform">
          <Star size={24} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-amber-300'} />
        </button>
      ))}
    </div>
  );

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-20 left-1/3 w-[500px] h-[500px] bg-yellow-600/10 rounded-full blur-[120px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <header className="mb-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Star size={28} className="fill-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Feedback</h1>
                <p className="text-slate-400 mt-1">Quality ratings, technician performance & service feedback.</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-400 transition shadow-lg shadow-amber-500/20">
              {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Feedback</>}
            </button>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><Star size={18} className="text-amber-400 fill-amber-400" /></div>
              <div><p className="text-xs text-amber-400/60 uppercase font-medium">Avg Rating</p><p className="text-xl font-bold text-white">{avgOverall.toFixed(1)} / 5</p></div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/10"><MessageSquare size={18} className="text-slate-400" /></div>
              <div><p className="text-xs text-slate-500 uppercase font-medium">Total Feedback</p><p className="text-xl font-bold text-white">{feedbacks.length}</p></div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10"><TrendingUp size={18} className="text-emerald-400" /></div>
              <div><p className="text-xs text-emerald-400/60 uppercase font-medium">5★ Reviews</p><p className="text-xl font-bold text-white">{feedbacks.filter(f => f.rating === 5).length}</p></div>
            </div>
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10"><Award size={18} className="text-violet-400" /></div>
              <div><p className="text-xs text-violet-400/60 uppercase font-medium">Top Performer</p><p className="text-lg font-bold text-white truncate">{techRatings.length > 0 ? techRatings[0].name : '—'}</p></div>
            </div>
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            {/* Left: Feedback List */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filters */}
              <div className="flex gap-3 mb-4 shrink-0">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-amber-500" placeholder="Search feedback..." />
                </div>
                <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none min-w-[180px]">
                  <option value="" className="bg-slate-800">All Technicians</option>
                  {technicians.map(t => <option key={t.id} value={t.id} className="bg-slate-800">{t.name || t.id}</option>)}
                </select>
              </div>

              {/* New Feedback Form */}
              {showForm && (
                <div className="glass-panel rounded-2xl border border-amber-500/20 p-6 space-y-4 mb-4 shrink-0">
                  <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Plus size={14} className="text-amber-400" /> Submit Feedback</h3>
                  {formError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"><AlertCircle size={14} /> {formError}</div>}
                  {formSuccess && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2"><CheckCircle2 size={14} /> {formSuccess}</div>}
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-3">
                      <select value={formTech} onChange={(e) => setFormTech(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                        <option value="" disabled className="bg-slate-800">Select Technician *</option>
                        {technicians.filter(t => t.current_status !== 'deactivated').map(t => <option key={t.id} value={t.id} className="bg-slate-800">{t.name || t.id}</option>)}
                      </select>
                      <select value={formComplaint} onChange={(e) => setFormComplaint(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                        <option value="" className="bg-slate-800">Link to Complaint (optional)</option>
                        {complaints.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.title}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Rating:</p>
                      <StarInput value={formRating} onChange={setFormRating} />
                      <span className="text-amber-400 font-bold text-lg">{formRating}/5</span>
                    </div>
                    <textarea value={formComment} onChange={(e) => setFormComment(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-amber-500 placeholder:text-slate-600 h-16 resize-none" placeholder="Additional comments..." />
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-400 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/20">
                      {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={16} /> Submit Feedback</>}
                    </button>
                  </form>
                </div>
              )}

              {/* Feedback Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {filtered.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                    <Star size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">{feedbacks.length === 0 ? 'No feedback submitted yet.' : 'No feedback matches your filters.'}</p>
                  </div>
                ) : (
                  filtered.map(f => (
                    <div key={f.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/8 transition">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
                          {(getTechName(f.technician_id) || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-bold text-sm">{getTechName(f.technician_id)}</span>
                            <span className="text-[10px] text-slate-600">{f.createdAt?.toDate ? new Date(f.createdAt.toDate()).toLocaleDateString() : ''}</span>
                          </div>
                          <StarDisplay rating={f.rating || 0} />
                          {f.comment && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{f.comment}</p>}
                          {f.complaint_id && (
                            <p className="text-[10px] text-slate-600 mt-2 flex items-center gap-1">
                              <MessageSquare size={10} /> Linked: {getComplaintTitle(f.complaint_id)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Technician Leaderboard */}
            <div className="w-80 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032] overflow-hidden flex flex-col shrink-0">
              <div className="p-5 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2"><Award size={14} className="text-amber-400" /> Performance Board</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {techRatings.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Award size={36} className="mb-3 opacity-20" />
                    <p className="text-xs">No ratings data yet.</p>
                  </div>
                ) : (
                  techRatings.map((tech, i) => (
                    <div key={tech.id} className={`p-4 rounded-xl border transition ${i === 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/40' : 'bg-slate-700 text-slate-400 border-2 border-slate-600'}`}>
                          {i === 0 ? '🏆' : `#${i + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{tech.name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <StarDisplay rating={Math.round(tech.avgRating)} size={11} />
                            <span className="text-xs text-slate-500">{tech.avgRating.toFixed(1)} ({tech.totalFeedbacks})</span>
                          </div>
                        </div>
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
