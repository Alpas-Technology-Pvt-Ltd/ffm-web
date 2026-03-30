"use client";
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getSLAThreshold } from '@/lib/slaConfig';
import { Zap, Target, Plus, Send, AlertCircle, Edit3, Check, X, MessageSquare, RefreshCcw, User, Phone, MapPin, Clock, Image as ImageIcon, Link2 } from 'lucide-react';
import { calculateHaversineDistance } from '@/lib/geoUtils';

export default function TasksPage() {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [showReassign, setShowReassign] = useState(false);
  
  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskType, setTaskType] = useState<'assigned' | 'opportunistic'>('assigned');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('27.7172');
  const [lng, setLng] = useState('85.3240');
  const [assignedTo, setAssignedTo] = useState('');
  const [bonusValue, setBonusValue] = useState('25');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [linkedComplaint, setLinkedComplaint] = useState('');

  useEffect(() => {
    if (!db) return;

    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setTechnicians(data);
    });

    // Fetch ALL non-completed tasks
    const tasksQuery = query(collection(db, 'tasks'), where('status', 'in', ['pending', 'in_progress', 'pending_approval']));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setLiveTasks(data);
    });

    // Fetch open complaints for linking
    const complaintsQuery = query(collection(db, 'complaints'), where('status', 'in', ['open', 'in_progress']));
    const unsubComplaints = onSnapshot(complaintsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    });

    // Fetch service areas
    const unsubAreas = onSnapshot(collection(db, 'service_areas'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setAreas(data);
    });

    return () => {
      unsubTechs();
      unsubTasks();
      unsubComplaints();
      unsubAreas();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to comments when a task is selected
  useEffect(() => {
    if (!selectedTask || !db) { setTaskComments([]); return; }
    const commentsQuery = query(
      collection(db, 'tasks', selectedTask.id, 'comments'),
      orderBy('created_at', 'asc')
    );
    const unsub = onSnapshot(commentsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setTaskComments(data);
    }, (error) => {
      console.warn('Comments query error (index may be needed):', error.message);
      setTaskComments([]);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.id]);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech && tech.name ? tech.name : (uid || '').substring(0,8) + '...';
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !lat || !lng) { setErrorMsg('Please fill all root tracking bounds.'); return; }
    if (taskType === 'assigned' && !assignedTo) { setErrorMsg('Please select a technician.'); return; }
    if (taskType === 'opportunistic' && !bonusValue) { setErrorMsg('Please enter a bonus amount.'); return; }

    setIsSubmitting(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addDoc(collection(db, 'tasks'), {
        title, description, type: taskType, status: 'pending',
        location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        assigned_to: taskType === 'assigned' ? assignedTo : null,
        bonus_value: taskType === 'opportunistic' ? parseInt(bonusValue) : 0,
        customer: { name: customerName || null, phone: customerPhone || null, address: customerAddress || null },
        complaint_id: linkedComplaint || null,
        createdAt: serverTimestamp()
      });
      setSuccessMsg('Signal dispatched successfully.');
      setTitle(''); setDescription(''); setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setLinkedComplaint('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Transmission failed.');
    } finally { setIsSubmitting(false); }
  };

  const handleEditSave = async () => {
    if (!editingTask) return;
    try {
      const updatedFields = {
        title: editingTask.title,
        description: editingTask.description,
        'location.latitude': parseFloat(editingTask.location?.latitude || 0),
        'location.longitude': parseFloat(editingTask.location?.longitude || 0),
        'customer.name': editingTask.customer?.name || null,
        'customer.phone': editingTask.customer?.phone || null,
        'customer.address': editingTask.customer?.address || null,
      };
      await updateDoc(doc(db, 'tasks', editingTask.id), updatedFields);
      // Refresh selected task with edited values
      setSelectedTask({
        ...selectedTask,
        title: editingTask.title,
        description: editingTask.description,
        location: { latitude: parseFloat(editingTask.location?.latitude || 0), longitude: parseFloat(editingTask.location?.longitude || 0) },
        customer: { name: editingTask.customer?.name || null, phone: editingTask.customer?.phone || null, address: editingTask.customer?.address || null },
      });
      setEditingTask(null);
    } catch (err) { console.error(err); }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      // 1. Complete the task
      await updateDoc(doc(db, 'tasks', taskId), { 
        status: 'completed',
        completedAt: serverTimestamp()
      });

      // 2. Auto-resolve the linked complaint (if any)
      const task = liveTasks.find(t => t.id === taskId);
      if (task?.complaint_id) {
        await updateDoc(doc(db, 'complaints', task.complaint_id), {
          status: 'resolved',
          resolved_at: serverTimestamp(),
        });
      }

      setSelectedTask(null);
    } catch (err) { console.error(err); }
  };

  const handleReassignTask = async (taskId: string, forceAssignTo?: string) => {
    const targetTech = forceAssignTo || reassignTo;
    if (!targetTech) return;
    try {
      // 1. Reassign the task
      await updateDoc(doc(db, 'tasks', taskId), { assigned_to: targetTech, status: 'pending', completion_proof: null });

      // 2. Update linked complaint assignment (if any)
      const task = liveTasks.find(t => t.id === taskId);
      if (task?.complaint_id) {
        await updateDoc(doc(db, 'complaints', task.complaint_id), {
          assigned_to: targetTech,
          status: 'in_progress',
        });
      }

      setShowReassign(false); setReassignTo(''); setSelectedTask(null);
    } catch (err) { console.error(err); }
  };

  const handleAutoReassign = async (task: any) => {
    if (!task.location?.latitude || !task.location?.longitude) {
      setErrorMsg('Cannot auto-reassign: Task missing location');
      return;
    }
    
    const taskLat = parseFloat(task.location.latitude);
    const taskLng = parseFloat(task.location.longitude);
    
    // Find nearest eligible tech
    const eligibleTechs = technicians.filter(t => {
      if (t.current_status === 'deactivated' || t.current_status === 'on_task' || !t.last_known_location) return false;
      if (t.id === task.assigned_to) return false; // Don't reassign to same person
      
      // Check Area Coverage
      if (t.service_area) {
        const area = areas.find(a => a.id === t.service_area);
        if (area && area.center && !isNaN(taskLat) && !isNaN(taskLng)) {
          const distToCenter = calculateHaversineDistance(
            { latitude: area.center.latitude, longitude: area.center.longitude },
            { latitude: taskLat, longitude: taskLng }
          );
          if (distToCenter > (area.radius_km || 2.0)) {
            return false;
          }
        }
      }
      return true;
    });

    if (eligibleTechs.length === 0) {
      alert('No eligible technicians available for auto-reassignment in this area.');
      return;
    }

    const nearestTech = eligibleTechs.sort((a, b) => {
      const distA = calculateHaversineDistance(
        { latitude: a.last_known_location.latitude, longitude: a.last_known_location.longitude },
        { latitude: taskLat, longitude: taskLng }
      );
      const distB = calculateHaversineDistance(
        { latitude: b.last_known_location.latitude, longitude: b.last_known_location.longitude },
        { latitude: taskLat, longitude: taskLng }
      );
      return distA - distB;
    })[0];

    if (confirm(`Auto-assign to nearest tech: ${nearestTech.name || nearestTech.id}?`)) {
      await handleReassignTask(task.id, nearestTech.id);
    }
  };

  const handleSendComment = async (taskId: string) => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      await addDoc(collection(db, 'tasks', taskId, 'comments'), {
        author_id: 'supervisor',
        author_name: 'Supervisor',
        text,
        created_at: serverTimestamp(),
      });
    } catch (err) { console.error('Comment failed:', err); }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      case 'en_route': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'on_site': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'pending_approval': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'completed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 relative z-10 p-8 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-amber-500/10 text-amber-400 border-amber-500/20"><Target size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Command Router</h1>
                <p className="text-slate-400 mt-1">Dispatch, track, approve, and manage field tasks.</p>
              </div>
            </div>
          </header>

          <div className="flex gap-8 flex-1 min-h-0">
            {/* Left Pane: Dispatch Form */}
            <div className="w-1/2 glass-panel p-8 rounded-2xl flex flex-col h-full overflow-y-auto">
              <h2 className="text-lg font-bold text-white mb-6 uppercase flex items-center gap-2">
                <Plus size={18} className="text-amber-400" /> New Task Order
              </h2>

              {errorMsg && (<div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-medium flex items-center gap-2"><AlertCircle size={16} /> {errorMsg}</div>)}
              {successMsg && (<div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium flex items-center gap-2"><Target size={16} /> {successMsg}</div>)}

              <form onSubmit={handleCreateTask} className="space-y-6 flex-1 flex flex-col">
                <div className="flex bg-slate-800/50 p-1 rounded-xl">
                  <button type="button" onClick={() => setTaskType('assigned')} className={`flex-1 py-3 text-sm font-bold uppercase rounded-lg transition-all ${taskType === 'assigned' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Direct Assignment</button>
                  <button type="button" onClick={() => setTaskType('opportunistic')} className={`flex-1 py-3 text-sm font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${taskType === 'opportunistic' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-amber-200'}`}><Zap size={16} /> Gamified Route</button>
                </div>

                <div className="space-y-4">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600 font-medium text-white" placeholder="Mission Title" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none placeholder:text-slate-600 font-medium text-white h-24 resize-none" placeholder="Technical Parameters..." />
                  <div className="flex gap-4">
                    <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-1/2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-mono text-sm" placeholder="LAT" />
                    <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-1/2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-mono text-sm" placeholder="LNG" />
                  </div>

                  {/* Link to Complaint */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium flex items-center gap-1"><Link2 size={11} /> Link Complaint (Optional)</p>
                    <select value={linkedComplaint} onChange={(e) => {
                      setLinkedComplaint(e.target.value);
                      if (e.target.value) {
                        const c = complaints.find(x => x.id === e.target.value);
                        if (c) {
                          if (!title) setTitle(`Resolve: ${c.title}`);
                          if (c.location?.latitude) setLat(String(c.location.latitude));
                          if (c.location?.longitude) setLng(String(c.location.longitude));
                          if (c.reporter_name) setCustomerName(c.reporter_name);
                          if (c.reporter_phone) setCustomerPhone(c.reporter_phone);
                        }
                      }
                    }} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-medium appearance-none text-sm mb-3">
                      <option value="" className="bg-slate-800 text-slate-400">No linked complaint</option>
                      {complaints.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.title} — {c.category} [{c.priority}]</option>)}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Customer / Report Info</p>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-medium placeholder:text-slate-600 mb-3" placeholder="Customer Name" />
                    <div className="flex gap-3">
                      <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-1/2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-medium placeholder:text-slate-600" placeholder="Phone Number" />
                      <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-1/2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-amber-500 outline-none text-white font-medium placeholder:text-slate-600" placeholder="Address" />
                    </div>
                  </div>

                  {taskType === 'assigned' ? (
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none text-white font-medium appearance-none">
                      <option value="" disabled className="bg-slate-800 text-slate-400">Select Field Technician (Sorted by Proximity)</option>
                      {(() => {
                        const taskLat = parseFloat(lat);
                        const taskLng = parseFloat(lng);
                        const sortedTechs = [...technicians]
                          .filter(t => {
                            if (t.current_status === 'deactivated') return false;
                            
                            // Check Area Coverage
                            if (t.service_area) {
                              const area = areas.find(a => a.id === t.service_area);
                              if (area && area.center && !isNaN(taskLat) && !isNaN(taskLng)) {
                                const distToCenter = calculateHaversineDistance(
                                  { latitude: area.center.latitude, longitude: area.center.longitude },
                                  { latitude: taskLat, longitude: taskLng }
                                );
                                if (distToCenter > (area.radius_km || 2.0)) {
                                  return false; // Task is outside technician's assigned area
                                }
                              }
                            }
                            return true;
                          })
                          .sort((a, b) => {
                            if (isNaN(taskLat) || isNaN(taskLng)) return 0;
                            const distA = calculateHaversineDistance(
                              { latitude: a.last_known_location?.latitude || 0, longitude: a.last_known_location?.longitude || 0 },
                              { latitude: taskLat, longitude: taskLng }
                            );
                            const distB = calculateHaversineDistance(
                              { latitude: b.last_known_location?.latitude || 0, longitude: b.last_known_location?.longitude || 0 },
                              { latitude: taskLat, longitude: taskLng }
                            );
                            return distA - distB;
                          });
                        return sortedTechs.map((tech) => {
                          const dist = (!isNaN(taskLat) && !isNaN(taskLng) && tech.last_known_location) 
                            ? calculateHaversineDistance(
                                { latitude: tech.last_known_location.latitude, longitude: tech.last_known_location.longitude },
                                { latitude: taskLat, longitude: taskLng }
                              ).toFixed(1)
                            : null;
                          return (
                            <option key={tech.id} value={tech.id} className="bg-slate-800">
                              {tech.name || tech.id} — {tech.current_status?.replace('_', ' ')}
                              {dist ? ` (~${dist} km away)` : ''}
                            </option>
                          );
                        });
                      })()}
                    </select>
                  ) : (
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-amber-500 font-bold">Rs.</div>
                      <input type="number" value={bonusValue} onChange={(e) => setBonusValue(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-amber-500/5 border border-amber-500/30 rounded-xl focus:border-amber-500 outline-none text-amber-100 font-bold" placeholder="Bonus Value" />
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-xl text-white font-bold tracking-widest uppercase text-sm transition-all flex items-center justify-center gap-2 ${taskType === 'assigned' ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={18} /> Transmit Orders</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Pane: Directives / Detail */}
            <div className="w-1/2 flex flex-col rounded-2xl border border-slate-700/50 bg-[#162032] overflow-hidden">
              {selectedTask ? (
                // ── Task Detail / Approval View ──
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b border-slate-700/50 bg-[#1a253a] shrink-0 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2">Task Detail</h2>
                    <button onClick={() => { setSelectedTask(null); setEditingTask(null); setShowReassign(false); }} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Title + Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          {selectedTask.title}
                          {selectedTask.status === 'pending' && selectedTask.createdAt && (
                            (() => {
                              const hoursPending = (Date.now() - selectedTask.createdAt.toDate().getTime()) / (1000 * 60 * 60);
                              if (hoursPending > getSLAThreshold('RESPONSE_HOURS')) { 
                                return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-red-400 bg-red-500/10 border border-red-500/20 animate-pulse">Delayed</span>;
                              }
                              return null;
                            })()
                          )}
                          {selectedTask.status === 'pending_approval' && selectedTask.completion_proof && (
                            (() => {
                              // Use submitted_at if available, otherwise fallback to task creation (though less accurate)
                              const submittedAt = selectedTask.completion_proof.submitted_at?.toDate() || selectedTask.createdAt?.toDate();
                              if (submittedAt) {
                                const minsSinceSubmission = (Date.now() - submittedAt.getTime()) / (1000 * 60);
                                if (minsSinceSubmission > getSLAThreshold('VALIDATION_MINUTES')) {
                                  return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold text-red-400 bg-red-500/10 border border-red-500/20 animate-pulse">Validation Delayed</span>;
                                }
                              }
                              return null;
                            })()
                          )}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">{selectedTask.description}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${getStatusColor(selectedTask.status)}`}>{selectedTask.status?.replace('_', ' ')}</span>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin size={14} /> {selectedTask.location?.latitude}, {selectedTask.location?.longitude}
                    </div>

                    {/* Customer Info */}
                    {(selectedTask.customer?.name || selectedTask.customer?.phone) && (
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Customer</p>
                        {selectedTask.customer?.name && <div className="flex items-center gap-2 text-sm"><User size={14} className="text-slate-500" /> <span className="text-white">{selectedTask.customer.name}</span></div>}
                        {selectedTask.customer?.phone && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-slate-500" /> <span className="text-white">{selectedTask.customer.phone}</span></div>}
                        {selectedTask.customer?.address && <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-slate-500" /> <span className="text-white">{selectedTask.customer.address}</span></div>}
                      </div>
                    )}

                    {/* Assigned Tech */}
                    {selectedTask.assigned_to && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Assigned:</span>
                        <span className="text-blue-400 font-medium">{getTechName(selectedTask.assigned_to)}</span>
                      </div>
                    )}

                    {/* Edit Button */}
                    {selectedTask.status !== 'completed' && !editingTask && (
                      <div className="flex items-center gap-4">
                        <button onClick={() => setEditingTask({...selectedTask})} className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition">
                          <Edit3 size={14} /> Edit Task Details
                        </button>
                        {selectedTask.status === 'pending' && (
                          <button onClick={() => handleAutoReassign(selectedTask)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition">
                            <Zap size={14} /> Auto-Reassign (Nearest)
                          </button>
                        )}
                      </div>
                    )}

                    {/* Inline Edit Form */}
                    {editingTask && (
                      <div className="p-4 rounded-xl bg-white/5 border border-amber-500/20 space-y-3">
                        <input value={editingTask.title} onChange={(e) => setEditingTask({...editingTask, title: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-amber-500" placeholder="Title" />
                        <textarea value={editingTask.description} onChange={(e) => setEditingTask({...editingTask, description: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-amber-500 h-16 resize-none" placeholder="Description" />
                        <div className="flex gap-2">
                          <input value={editingTask.location?.latitude || ''} onChange={(e) => setEditingTask({...editingTask, location: {...editingTask.location, latitude: e.target.value}})} className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none font-mono" placeholder="LAT" />
                          <input value={editingTask.location?.longitude || ''} onChange={(e) => setEditingTask({...editingTask, location: {...editingTask.location, longitude: e.target.value}})} className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none font-mono" placeholder="LNG" />
                        </div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Customer Info</p>
                        <input value={editingTask.customer?.name || ''} onChange={(e) => setEditingTask({...editingTask, customer: {...editingTask.customer, name: e.target.value}})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none" placeholder="Customer Name" />
                        <div className="flex gap-2">
                          <input value={editingTask.customer?.phone || ''} onChange={(e) => setEditingTask({...editingTask, customer: {...editingTask.customer, phone: e.target.value}})} className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none" placeholder="Phone" />
                          <input value={editingTask.customer?.address || ''} onChange={(e) => setEditingTask({...editingTask, customer: {...editingTask.customer, address: e.target.value}})} className="w-1/2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none" placeholder="Address" />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={handleEditSave} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Check size={14} /> Save</button>
                          <button onClick={() => setEditingTask(null)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><X size={14} /> Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Pending Approval Section */}
                    {selectedTask.status === 'pending_approval' && (
                      <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-4">
                        <h4 className="text-sm font-bold text-orange-400 uppercase flex items-center gap-2"><Clock size={14} /> Completion Proof Submitted</h4>
                        
                        {/* Proof Image */}
                        {selectedTask.completion_proof?.image_base64 && (
                          <div className="rounded-xl overflow-hidden border border-slate-700">
                            <img src={`data:image/jpeg;base64,${selectedTask.completion_proof.image_base64}`} alt="Proof" className="w-full max-h-48 object-cover" />
                          </div>
                        )}
                        
                        {/* Proof Notes */}
                        {selectedTask.completion_proof?.notes && (
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Technician Notes:</p>
                            <p className="text-sm text-white">{selectedTask.completion_proof.notes}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveTask(selectedTask.id)} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-400 transition">
                            <Check size={16} /> Approve & Complete
                          </button>
                          <button onClick={() => setShowReassign(!showReassign)} className="flex-1 py-3 bg-slate-700 text-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-600 transition">
                            <RefreshCcw size={16} /> Reassign
                          </button>
                        </div>

                        {/* Reassign Dropdown */}
                        {showReassign && (
                          <div className="flex gap-2">
                            <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none appearance-none">
                              <option value="" disabled className="bg-slate-800">Select Technician</option>
                              {technicians.filter(t => t.current_status !== 'deactivated').map((tech) => (<option key={tech.id} value={tech.id} className="bg-slate-800">{tech.name || tech.id}</option>))}
                            </select>
                            <button onClick={() => handleReassignTask(selectedTask.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Assign</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comments */}
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2 mb-3"><MessageSquare size={14} /> Comments</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                        {taskComments.length === 0 ? (
                          <p className="text-xs text-slate-600 text-center py-4">No comments yet.</p>
                        ) : (
                          taskComments.map((c) => (
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
                        <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendComment(selectedTask.id)} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-blue-500" placeholder="Write a comment..." />
                        <button onClick={() => handleSendComment(selectedTask.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition"><Send size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // ── Task List View ──
                <>
                  <div className="p-6 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                    <h2 className="text-lg font-bold text-white uppercase flex items-center gap-2">
                      Active Map Directives <span className="text-xs bg-slate-800 py-1 px-2 rounded-full text-slate-400">{liveTasks.length} active</span>
                    </h2>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    {liveTasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Target size={48} className="mb-4 opacity-50" />
                        <p>Grid is empty. No active tasks.</p>
                      </div>
                    ) : (
                      liveTasks.map((t) => (
                        <div key={t.id} onClick={() => setSelectedTask(t)} className="p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer flex gap-4 pr-6 relative overflow-hidden">
                          {t.type === 'opportunistic' && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-xl pointer-events-none" />}
                          {t.status === 'pending_approval' && <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 blur-xl pointer-events-none" />}
                          <div className="shrink-0">
                            {t.status === 'pending_approval'
                              ? <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400"><Clock size={18}/></div>
                              : t.type === 'assigned'
                                ? <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400"><Target size={18}/></div>
                                : <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400"><Zap size={18}/></div>
                            }
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-white mb-1">{t.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed mb-2">{t.description}</p>
                            <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                              <span className="text-slate-500 flex items-center gap-1">📍 {t.location?.latitude || '?'}, {t.location?.longitude || '?'}</span>
                              {t.customer?.name && <span className="text-slate-400 flex items-center gap-1"><User size={11} /> {t.customer.name}</span>}
                              {t.customer?.phone && <span className="text-slate-400 flex items-center gap-1"><Phone size={11} /> {t.customer.phone}</span>}
                              {t.type === 'opportunistic' ? (
                                <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">+Rs. {t.bonus_value}</span>
                              ) : t.assigned_to ? (
                                <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{getTechName(t.assigned_to)}</span>
                              ) : null}
                              <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold ${getStatusColor(t.status)}`}>{t.status?.replace('_',' ')}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
