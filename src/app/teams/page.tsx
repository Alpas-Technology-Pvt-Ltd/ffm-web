"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { Users, Plus, Edit3, Save, X, Search, Trash2, UserPlus, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;

    // Fetch Teams
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      console.log("Teams Snapshot:", snapshot.size, "documents");
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTeams(data);
    }, (error) => {
      console.error("Teams Snapshot Error:", error);
      setErrorMsg("Failed to load teams. Please check Firestore rules.");
      alert("Firestore Error (Snapshot): " + error.message);
    });

    // Fetch Technicians for assignment
    const unsubTechs = onSnapshot(collection(db, 'users'), (snapshot) => {
      console.log("Users Snapshot (Techs):", snapshot.size, "documents");
      const data: any[] = [];
      snapshot.forEach(d => {
        const u = d.data();
        if (u.role === 'technician') {
          data.push({ id: d.id, ...u });
        }
      });
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTechnicians(data);
    }, (error) => {
      console.error("Users Snapshot Error:", error);
      alert("Firestore Error (Users): " + error.message);
    });

    return () => { unsubTeams(); unsubTechs(); };
  }, []);

  const manualRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const snapshot = await getDocs(collection(db, 'teams'));
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTeams(data);
    } catch (err: any) {
      console.error("Manual Refresh Error:", err);
      setErrorMsg("Manual refresh failed: " + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setSelectedMembers([]);
    setShowAdd(false);
    setEditingId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      const newTeam = {
        name: formName.trim(),
        members: selectedMembers,
        status: 'available',
        load_status: 'non-loaded',
        createdAt: serverTimestamp(),
      };
      console.log("Attempting to add team:", newTeam);
      const docRef = await addDoc(collection(db, 'teams'), newTeam);
      console.log("Team added with ID:", docRef.id);
      resetForm();
    } catch (err: any) {
      console.error("Creation Error:", err);
      alert("Failed to create team: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (team: any) => {
    setEditingId(team.id);
    setFormName(team.name || '');
    setSelectedMembers(team.members || []);
    setShowAdd(false);
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'teams', editingId), {
        name: formName.trim(),
        members: selectedMembers,
      });
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      await deleteDoc(doc(db, 'teams', id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (teamId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'available' ? 'busy' : 'available';
    try {
      await updateDoc(doc(db, 'teams', teamId), { status: nextStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLoad = async (teamId: string, currentLoad: string) => {
    const nextLoad = currentLoad === 'loaded' ? 'non-loaded' : 'loaded';
    try {
      await updateDoc(doc(db, 'teams', teamId), { load_status: nextLoad });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMember = (techId: string) => {
    setSelectedMembers(prev => 
      prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]
    );
  };

  const filteredTeams = teams.filter(t => 
    t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-blue-500/10 text-blue-400 border-blue-500/20"><Users size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase text-glow">Teams</h1>
                <p className="text-slate-400 mt-1">{teams.length} active teams in deployment</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={manualRefresh}
                className={`p-3 rounded-xl border border-white/10 hover:bg-white/5 transition h-fit ${isRefreshing ? 'animate-spin' : ''}`}
                title="Manual Refresh"
              >
                <RefreshCw size={20} className="text-slate-400" />
              </button>
              <button 
                onClick={() => { setShowAdd(!showAdd); setEditingId(null); resetForm(); if (!showAdd) setShowAdd(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition shadow-lg shadow-blue-500/20 active:scale-95 h-fit"
              >
                {showAdd ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Create Team</>}
              </button>
            </div>
          </header>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle size={18} />
              {errorMsg}
            </div>
          )}

          <div className="flex gap-8 flex-1 min-h-0">
            {/* Left: Teams List */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="relative mb-6">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600" 
                  placeholder="Filter teams by name..." 
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {filteredTeams.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-50">
                    <Users size={64} />
                    <p>No teams found. Create one to get started.</p>
                  </div>
                ) : (
                  filteredTeams.map(team => (
                    <div key={team.id} className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all group relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <Users size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">{team.name}</h3>
                            <p className="text-sm text-slate-400">{team.members?.length || 0} Technicians Assigned</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(team)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"><Edit3 size={18} /></button>
                          <button onClick={() => handleDelete(team.id)} className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/20 text-red-500 transition"><Trash2 size={18} /></button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Toggle */}
                        <button 
                          onClick={() => toggleStatus(team.id, team.status)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                            team.status === 'available' 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20'
                          }`}
                        >
                          {team.status === 'available' ? <><CheckCircle2 size={14} /> Available</> : <><AlertCircle size={14} /> Busy</>}
                        </button>

                        {/* Load Toggle */}
                        <button 
                          onClick={() => toggleLoad(team.id, team.load_status)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                            team.load_status === 'loaded' 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' 
                            : 'bg-slate-700/30 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                          }`}
                        >
                          {team.load_status === 'loaded' ? 'LOADED' : 'NON-LOADED'}
                        </button>
                      </div>

                      {/* Member Avatars Preview */}
                      <div className="mt-4 flex -space-x-2 overflow-hidden">
                        {(team.members || []).slice(0, 5).map((uid: string) => {
                          const tech = technicians.find(t => t.id === uid);
                          return (
                            <div key={uid} className="inline-block h-8 w-8 rounded-full ring-2 ring-[#0d1527] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white border border-white/10" title={tech?.name}>
                              {tech?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          );
                        })}
                        {team.members?.length > 5 && (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-[#0d1527] bg-slate-900 text-[10px] font-bold text-slate-400 border border-white/10">
                            +{team.members.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Add/Edit Panel */}
            {(showAdd || editingId) && (
              <div className="w-96 shrink-0 flex flex-col min-h-0 bg-[#161f33] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">{editingId ? 'Edit Team' : 'Create New Team'}</h2>
                  <button onClick={resetForm} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition"><X size={20} /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Team Name</label>
                    <input 
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500/50 transition-all" 
                      placeholder="e.g. Rapid Response Alpha" 
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assign Members</label>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">{selectedMembers.length} selected</span>
                    </div>
                    
                    <div className="space-y-2">
                      {technicians.length === 0 ? (
                        <p className="text-sm text-slate-600 italic">No technicians available.</p>
                      ) : (
                        technicians.map(tech => (
                          <button 
                            key={tech.id}
                            onClick={() => toggleMember(tech.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              selectedMembers.includes(tech.id) 
                              ? 'bg-blue-500/10 border-blue-500/30' 
                              : 'bg-white/5 border-transparent hover:border-white/10'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              selectedMembers.includes(tech.id) ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {tech.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 text-left">
                              <p className={`text-sm font-semibold ${selectedMembers.includes(tech.id) ? 'text-white' : 'text-slate-300'}`}>{tech.name}</p>
                              <p className="text-[10px] text-slate-500">{tech.email || 'No email'}</p>
                            </div>
                            {selectedMembers.includes(tech.id) && <UserPlus size={16} className="text-blue-400" />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-[#1a253a] border-t border-white/5">
                  <button 
                    onClick={editingId ? handleEdit : (handleAdd as any)}
                    disabled={isSubmitting || !formName.trim()}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Save size={18} /> {editingId ? 'Save Changes' : 'Launch Team'}</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        .text-glow {
          text-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </AuthGuard>
  );
}
