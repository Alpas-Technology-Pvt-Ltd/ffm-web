"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { LocateFixed, Navigation2, Zap, Target } from 'lucide-react';
import { useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Dashboard() {
  const [activeTechs, setActiveTechs] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!db) return;

    // 1. Stream Active/On-Task Technicians via Firestore
    const techsQuery = query(
      collection(db, 'users'), 
      where('current_status', 'in', ['active', 'on_task'])
    );
    
    const unsubscribeTechs = onSnapshot(techsQuery, (snapshot) => {
      const techs: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Fallback layout map coordinates mapping latitude/longitude logic to the CSS canvas
        techs.push({
          id: doc.id,
          name: data.name || 'Unknown Tech',
          status: data.current_status,
          sla: `${data.sla_score || 0}%`,
          lng: data.last_known_location?.longitude || 85.3240,
          lat: data.last_known_location?.latitude || 27.7172,
          overtimeRisk: data.total_hours >= 8
        });
      });
      // Explicitly set real array without Mock Fallback
      setActiveTechs(techs);
    });

    // 2. Stream unassigned, pending tasks  
    const tasksQuery = query(
      collection(db, 'tasks'), 
      where('status', '==', 'pending')
    );
    
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasks: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        tasks.push({
          id: doc.id,
          title: data.title || 'Task',
          type: data.type || 'opportunistic',
          bonus: `+Rs. ${data.bonus_value || 0}`,
          assignedTo: data.assigned_to,
          lng: data.location?.longitude || 85.3100,
          lat: data.location?.latitude || 27.7100,
        });
      });
      // Explicitly set real array without Mock Fallback
      setActiveTasks(tasks);
    });

    return () => {
      unsubscribeTechs();
      unsubscribeTasks();
    };
  }, []);

  return (
    <AuthGuard>
      <div className="flex h-screen w-full map-bg overflow-hidden relative text-slate-200">
      {/* Dynamic Background Glows */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Persistent Sidebar */}
      <Sidebar />

      {/* Main Map Content Area */}
      <main className="flex-1 relative z-10 m-4 ml-2 flex flex-col h-[calc(100vh-32px)]">
        {/* Top Analytics Bar */}
        <header className="glass-panel w-full p-4 px-6 flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-6">
            <Stat label="Active Techs" value="2" />
            <div className="w-px h-8 bg-slate-700/50" />
            <Stat label="Unclaimed Tasks" value="2" highlight />
            <div className="w-px h-8 bg-slate-700/50" />
            <Stat label="Map Status" value="Live Sync" indicator="bg-emerald-500" />
          </div>
          <div className="flex items-center gap-3">
            <button className="glass-pill px-4 py-2 text-sm font-medium hover:bg-white/10 transition flex items-center gap-2">
              <LocateFixed size={16} /> Locate All
            </button>
          </div>
        </header>

        {/* Map Visualization Viewport */}
        <div className="flex-1 relative overflow-hidden rounded-2xl group border border-slate-700/50 bg-[#0d1527] shadow-2xl">
          <Map
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            initialViewState={{
              longitude: 85.3240, // Kathmandu Nepal Base
              latitude: 27.7172,
              zoom: 12
            }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Render Technicians onto Canvas */}
            {activeTechs.map((tech) => (
              <Marker key={`tech-${tech.id}`} longitude={tech.lng} latitude={tech.lat} anchor="bottom">
                <div className="flex flex-col items-center group/marker hover:z-20 cursor-pointer transition-all duration-300">
                  <div className="absolute -top-12 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-slate-800 border border-slate-600 text-xs py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                    <p className="font-bold text-white tracking-widest uppercase">{tech.name}</p>
                    <p className="text-slate-400">SLA: {tech.sla}</p>
                  </div>
                  <div className="relative">
                    {tech.status === 'on_task' && (
                      <span className="absolute -inset-1.5 rounded-full bg-blue-500/20 animate-ping" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg backdrop-blur-sm relative z-10 box-border
                      ${tech.status === 'on_task' ? 'bg-blue-600 border-blue-400 text-white' : 
                        tech.status === 'active' ? 'bg-emerald-600 border-emerald-400 text-white' : 
                        'bg-slate-700 border-slate-500 text-slate-300'}
                      ${tech.overtimeRisk ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#0d1527]' : ''}
                    `}>
                      <Navigation2 size={14} className="transform rotate-45" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </Marker>
            ))}

            {/* Render Assigned and Opportunistic Tasks */}
            {activeTasks.map((task) => (
              <Marker key={`task-${task.id}`} longitude={task.lng} latitude={task.lat} anchor="center">
                <div className="flex flex-col items-center hover:z-20 group/task cursor-pointer transition-all duration-300">
                  <div className={`absolute py-1 px-2 -top-10 opacity-0 group-hover/task:opacity-100 transition-opacity border text-xs rounded backdrop-blur-md shadow-xl whitespace-nowrap z-30 pointer-events-none
                     ${task.type === 'opportunistic' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-blue-500/10 border-blue-500/30 text-blue-200'}
                  `}>
                    <span className={`font-bold border-r pr-2 mr-2 ${task.type === 'opportunistic' ? 'border-amber-500/30' : 'border-blue-500/30'}`}>{task.title}</span>
                    {task.type === 'opportunistic' ? task.bonus : 'DIRECT ASSIGNMENT'}
                  </div>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 backdrop-blur-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all
                     ${task.type === 'opportunistic' ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:scale-125 hover:bg-amber-500 hover:text-white' : 'bg-blue-500/20 border-blue-400 text-blue-300 hover:scale-125 hover:bg-blue-500 hover:text-white'}
                  `}>
                    {task.type === 'opportunistic' ? <Zap size={14} fill="currentColor" strokeWidth={0} /> : <Target size={14} fill="currentColor" strokeWidth={0} />}
                  </div>
                </div>
              </Marker>
            ))}
          </Map>
          
          {/* Overlay Map Legend */}
          <div className="absolute bottom-6 right-6 glass-panel p-3 px-4 rounded-xl flex items-center gap-6 text-xs font-medium backdrop-blur-xl border border-slate-600/50 shadow-2xl pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> Active
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span> On Task
            </div>
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wide">
              <Zap size={14} fill="currentColor" /> Gamified Route
            </div>
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}

function Stat({ label, value, highlight, indicator }: any) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1 tracking-wide uppercase">
        {indicator && <div className={`w-2 h-2 rounded-full ${indicator} shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse`} />}
        {label}
      </div>
      <div className={`text-xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
