"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { UserCog, Plus, Edit3, Save, X, Search, UserMinus, UserCheck, Phone, Mail, MapPin, Shield, Star } from 'lucide-react';

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [serviceAreas, setServiceAreas] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'deactivated'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formArea, setFormArea] = useState('');

  useEffect(() => {
    if (!db) return;
    // All technicians (including deactivated)
    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsub = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTechnicians(data);
    });
    const unsubAreas = onSnapshot(collection(db, 'service_areas'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setServiceAreas(data);
    });
    return () => { unsub(); unsubAreas(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAreaName = (areaId: string) => serviceAreas.find(a => a.id === areaId)?.name || '';

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormAddress(''); setFormArea('');
    setShowAdd(false); setEditingId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        role: 'technician',
        current_status: 'inactive',
        sla_score: 0,
        service_area: formArea || null,
        createdAt: serverTimestamp(),
      });
      resetForm();
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const startEdit = (tech: any) => {
    setEditingId(tech.id);
    setFormName(tech.name || '');
    setFormEmail(tech.email || '');
    setFormPhone(tech.phone || '');
    setFormAddress(tech.address || '');
    setFormArea(tech.service_area || '');
    setShowAdd(false);
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', editingId), {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        service_area: formArea || null,
      });
      resetForm();
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async (techId: string, currentlyDeactivated: boolean) => {
    try {
      await updateDoc(doc(db, 'users', techId), {
        current_status: currentlyDeactivated ? 'inactive' : 'deactivated',
      });
    } catch (err) { console.error(err); }
  };

  const filtered = technicians.filter(t => {
    if (filterStatus === 'active' && t.current_status === 'deactivated') return false;
    if (filterStatus === 'deactivated' && t.current_status !== 'deactivated') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) || t.phone?.includes(q));
    }
    return true;
  });

  const activeCount = technicians.filter(t => t.current_status !== 'deactivated').length;
  const deactivatedCount = technicians.filter(t => t.current_status === 'deactivated').length;

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-violet-500/10 text-violet-400 border-violet-500/20"><UserCog size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Technicians</h1>
                <p className="text-slate-400 mt-1">{activeCount} active · {deactivatedCount} deactivated</p>
              </div>
            </div>
            <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); resetForm(); if (!showAdd) setShowAdd(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-400 transition shadow-lg shadow-violet-500/20">
              {showAdd ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Technician</>}
            </button>
          </header>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500" placeholder="Search by name, email, phone..." />
            </div>
            <div className="flex bg-slate-800/50 p-1 rounded-xl">
              {(['all', 'active', 'deactivated'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg transition ${filterStatus === s ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-8 flex-1 min-h-0">
            {/* Left: Add / Edit Form */}
            {(showAdd || editingId) && (
              <div className="w-80 shrink-0 glass-panel p-6 rounded-2xl border border-violet-500/20 h-fit space-y-4">
                <h3 className="text-sm font-bold text-white uppercase">{editingId ? 'Edit Technician' : 'Add Technician'}</h3>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500 placeholder:text-slate-600" placeholder="Full Name *" />
                <input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500 placeholder:text-slate-600" placeholder="Email" />
                <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500 placeholder:text-slate-600" placeholder="Phone" />
                <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500 placeholder:text-slate-600" placeholder="Address" />
                <select value={formArea} onChange={(e) => setFormArea(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                  <option value="" className="bg-slate-800">No Service Area</option>
                  {serviceAreas.map(a => <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>)}
                </select>
                <div className="flex gap-2 pt-2">
                  <button onClick={editingId ? handleEdit : (handleAdd as any)} disabled={isSubmitting || !formName.trim()} className="flex-1 py-3 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-400 transition flex items-center justify-center gap-2 disabled:opacity-40">
                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={14} /> {editingId ? 'Update' : 'Create'}</>}
                  </button>
                  <button onClick={resetForm} className="px-4 py-3 bg-slate-700 text-slate-300 rounded-xl text-sm font-bold"><X size={14} /></button>
                </div>
              </div>
            )}

            {/* Right: Technician Grid */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {filtered.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                  <UserCog size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">No technicians match your filters.</p>
                </div>
              ) : (
                filtered.map(t => {
                  const isDeactivated = t.current_status === 'deactivated';
                  const areaName = getAreaName(t.service_area);
                  return (
                    <div key={t.id} className={`p-5 rounded-2xl border transition ${isDeactivated ? 'bg-red-500/5 border-red-500/10 opacity-60' : 'bg-white/5 border-white/5 hover:bg-white/8'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${isDeactivated ? 'bg-red-500/20 text-red-400 border-2 border-red-500/30' : 'bg-violet-500/20 text-violet-400 border-2 border-violet-500/30'}`}>
                          {(t.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-bold text-base">{t.name || 'Unnamed'}</h3>
                            {isDeactivated && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase">Deactivated</span>}
                            {!isDeactivated && t.current_status === 'active' && <span className="w-2 h-2 rounded-full bg-green-400" title="Online" />}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                            {t.email && <span className="flex items-center gap-1"><Mail size={11} /> {t.email}</span>}
                            {t.phone && <span className="flex items-center gap-1"><Phone size={11} /> {t.phone}</span>}
                            {t.address && <span className="flex items-center gap-1"><MapPin size={11} /> {t.address}</span>}
                            {areaName && <span className="flex items-center gap-1 text-cyan-400"><Shield size={11} /> {areaName}</span>}
                            <span className="text-slate-600">SLA: {t.sla_score || 0}%</span>
                            {(t.average_rating !== undefined) && (
                              <span className="flex items-center gap-1 text-amber-400 font-bold">
                                <Star size={11} className="fill-amber-400" /> {t.average_rating.toFixed(1)} ({t.total_reviews || 0})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEdit(t)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white" title="Edit"><Edit3 size={16} /></button>
                          <button onClick={() => handleToggleStatus(t.id, isDeactivated)} className={`p-2 rounded-lg transition ${isDeactivated ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'}`} title={isDeactivated ? 'Reactivate' : 'Deactivate'}>
                            {isDeactivated ? <UserCheck size={16} /> : <UserMinus size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
