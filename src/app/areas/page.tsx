"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { MapPinned, Plus, Trash2, UserPlus, UserMinus, Save, X } from 'lucide-react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const AREA_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// Generate a GeoJSON circle polygon from center + radius
function createCircleGeoJSON(centerLng: number, centerLat: number, radiusKm: number) {
  const points = 64;
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const lat = centerLat + (dy / 111.32);
    const lng = centerLng + (dx / (111.32 * Math.cos(centerLat * (Math.PI / 180))));
    coords.push([lng, lat]);
  }
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
    properties: {},
  };
}

export default function AreasPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [addingTech, setAddingTech] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('27.7172');
  const [lng, setLng] = useState('85.3240');
  const [radius, setRadius] = useState('2.0');
  const [color, setColor] = useState(AREA_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsubAreas = onSnapshot(collection(db, 'service_areas'), (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setAreas(data);
    });
    const techsQuery = query(collection(db, 'users'), where('role', '==', 'technician'));
    const unsubTechs = onSnapshot(techsQuery, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
      setTechnicians(data);
    });
    return () => { unsubAreas(); unsubTechs(); };
  }, []);

  // Keep selectedArea in sync with live snapshot data
  useEffect(() => {
    if (selectedArea) {
      const updated = areas.find(a => a.id === selectedArea.id);
      if (updated) setSelectedArea(updated);
    }
  }, [areas]);

  const getTechName = (uid: string) => {
    const tech = technicians.find(t => t.id === uid);
    return tech?.name || (uid || '').substring(0, 8) + '...';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'service_areas'), {
        name: name.trim(), description: description.trim(),
        center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
        radius_km: parseFloat(radius), color,
        assigned_technicians: [], createdAt: serverTimestamp(),
      });
      setName(''); setDescription(''); setRadius('2.0'); setShowForm(false);
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Delete this service area?')) return;
    try {
      await deleteDoc(doc(db, 'service_areas', areaId));
      if (selectedArea?.id === areaId) setSelectedArea(null);
    } catch (err) { console.error(err); }
  };

  const handleAddTech = async (areaId: string) => {
    if (!addingTech) return;
    try {
      await updateDoc(doc(db, 'service_areas', areaId), { assigned_technicians: arrayUnion(addingTech) });
      await updateDoc(doc(db, 'users', addingTech), { service_area: areaId });
      setAddingTech('');
      const updated = areas.find(a => a.id === areaId);
      if (updated) setSelectedArea({ ...updated, assigned_technicians: [...(updated.assigned_technicians || []), addingTech] });
    } catch (err) { console.error(err); }
  };

  const handleRemoveTech = async (areaId: string, techId: string) => {
    try {
      await updateDoc(doc(db, 'service_areas', areaId), { assigned_technicians: arrayRemove(techId) });
      await updateDoc(doc(db, 'users', techId), { service_area: null });
      if (selectedArea?.id === areaId)
        setSelectedArea({ ...selectedArea, assigned_technicians: (selectedArea.assigned_technicians || []).filter((t: string) => t !== techId) });
    } catch (err) { console.error(err); }
  };

  const availableTechs = (areaId: string) => {
    const area = areas.find(a => a.id === areaId);
    const assigned = area?.assigned_technicians || [];
    return technicians.filter(t => !assigned.includes(t.id) && t.current_status !== 'deactivated');
  };

  // GeoJSON for the form preview circle
  const formCircle = useMemo(() => {
    const cLat = parseFloat(lat) || 27.7172;
    const cLng = parseFloat(lng) || 85.3240;
    const r = parseFloat(radius) || 2.0;
    return { type: 'FeatureCollection' as const, features: [createCircleGeoJSON(cLng, cLat, r)] };
  }, [lat, lng, radius]);

  // GeoJSON for the selected area preview circle
  const areaCircle = useMemo(() => {
    if (!selectedArea) return null;
    const cLat = selectedArea.center?.latitude || 27.7172;
    const cLng = selectedArea.center?.longitude || 85.3240;
    const r = selectedArea.radius_km || 2.0;
    return { type: 'FeatureCollection' as const, features: [createCircleGeoJSON(cLng, cLat, r)] };
  }, [selectedArea]);

  // Zoom level from radius
  const zoomFromRadius = (r: number) => Math.max(8, Math.min(16, 14 - Math.log2(Math.max(0.1, r))));

  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />
        <Sidebar />
        <main className="flex-1 p-8 relative z-10 flex flex-col h-screen overflow-hidden">
          <header className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 glass-pill bg-cyan-500/10 text-cyan-400 border-cyan-500/20"><MapPinned size={28} /></div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase">Service Areas</h1>
                <p className="text-slate-400 mt-1">Define geographic zones and assign technician coverage.</p>
              </div>
            </div>
            <button onClick={() => { setShowForm(!showForm); setSelectedArea(null); }} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-white rounded-xl text-sm font-bold hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20">
              {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New Area</>}
            </button>
          </header>

          <div className="flex gap-8 flex-1 min-h-0">
            {/* Left Pane: Areas List */}
            <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
              {/* Create Form with Map Preview */}
              {showForm && (
                <div className="glass-panel rounded-2xl border border-cyan-500/20 overflow-hidden">
                  {/* Live Map Preview */}
                  <div className="h-52 relative">
                    <Map
                      mapboxAccessToken={MAPBOX_TOKEN}
                      mapStyle="mapbox://styles/mapbox/dark-v11"
                      longitude={parseFloat(lng) || 85.3240}
                      latitude={parseFloat(lat) || 27.7172}
                      zoom={zoomFromRadius(parseFloat(radius) || 2)}
                      interactive={false}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <Source id="form-circle" type="geojson" data={formCircle}>
                        <Layer id="form-circle-fill" type="fill" paint={{ 'fill-color': color, 'fill-opacity': 0.15 }} />
                        <Layer id="form-circle-border" type="line" paint={{ 'line-color': color, 'line-width': 2, 'line-opacity': 0.6 }} />
                      </Source>
                      <Marker longitude={parseFloat(lng) || 85.3240} latitude={parseFloat(lat) || 27.7172}>
                        <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: color }} />
                      </Marker>
                    </Map>
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg font-mono backdrop-blur-sm">
                      {(parseFloat(lat) || 0).toFixed(4)}, {(parseFloat(lng) || 0).toFixed(4)} · {radius} km
                    </div>
                  </div>

                  <form onSubmit={handleCreate} className="p-6 space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase">Create Service Area</h3>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 placeholder:text-slate-600" placeholder="Area Name (e.g. Kathmandu Central)" />
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 placeholder:text-slate-600 h-16 resize-none" placeholder="Description..." />
                    <div className="flex gap-3">
                      <input value={lat} onChange={(e) => setLat(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none font-mono focus:border-cyan-500" placeholder="Center LAT" />
                      <input value={lng} onChange={(e) => setLng(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none font-mono focus:border-cyan-500" placeholder="Center LNG" />
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-1">Radius: {radius} km</p>
                        <input type="range" min="0.5" max="20" step="0.5" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full accent-cyan-500 h-2" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Zone Color</p>
                      <div className="flex gap-2">
                        {AREA_COLORS.map(c => (
                          <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-lg border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-cyan-500 text-white rounded-xl text-sm font-bold hover:bg-cyan-400 transition flex items-center justify-center gap-2 disabled:opacity-50">
                      {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> Create Area</>}
                    </button>
                  </form>
                </div>
              )}

              {/* Areas List */}
              {areas.length === 0 && !showForm ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <MapPinned size={48} className="mb-4 opacity-30" />
                  <p>No service areas defined yet.</p>
                </div>
              ) : (
                areas.map(area => (
                  <div key={area.id} onClick={() => { setSelectedArea(area); setShowForm(false); }} className={`p-5 rounded-2xl border transition cursor-pointer ${selectedArea?.id === area.id ? 'bg-white/10 border-cyan-500/40' : 'bg-white/5 border-white/5 hover:bg-white/8'}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-4 h-4 rounded-full mt-1 shrink-0 shadow-lg" style={{ backgroundColor: area.color || '#3B82F6' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-bold text-lg">{area.name}</h3>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(area.id); }} className="text-slate-600 hover:text-red-400 transition p-1"><Trash2 size={14} /></button>
                        </div>
                        {area.description && <p className="text-slate-400 text-xs mt-1 line-clamp-1">{area.description}</p>}
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                          <span className="font-mono">📍 {area.center?.latitude?.toFixed(4)}, {area.center?.longitude?.toFixed(4)}</span>
                          <span>{area.radius_km} km</span>
                          <span className="text-cyan-400">{(area.assigned_technicians || []).length} techs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Pane: Area Detail with Map */}
            <div className="w-1/2 glass-panel rounded-2xl border border-slate-700/50 bg-[#162032] overflow-hidden flex flex-col">
              {selectedArea ? (
                <>
                  <div className="p-6 border-b border-slate-700/50 bg-[#1a253a] shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full shadow-lg" style={{ backgroundColor: selectedArea.color || '#3B82F6' }} />
                      <h2 className="text-lg font-bold text-white">{selectedArea.name}</h2>
                    </div>
                    {selectedArea.description && <p className="text-sm text-slate-400 mt-2">{selectedArea.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="font-mono">📍 {selectedArea.center?.latitude?.toFixed(4)}, {selectedArea.center?.longitude?.toFixed(4)}</span>
                      <span>Radius: {selectedArea.radius_km} km</span>
                    </div>
                  </div>

                  {/* Interactive Map for selected area */}
                  <div className="h-48 shrink-0">
                    <Map
                      mapboxAccessToken={MAPBOX_TOKEN}
                      mapStyle="mapbox://styles/mapbox/dark-v11"
                      initialViewState={{
                        longitude: selectedArea.center?.longitude || 85.3240,
                        latitude: selectedArea.center?.latitude || 27.7172,
                        zoom: zoomFromRadius(selectedArea.radius_km || 2),
                      }}
                      interactive={false}
                      style={{ width: '100%', height: '100%' }}
                    >
                      {areaCircle && (
                        <Source id="area-circle" type="geojson" data={areaCircle}>
                          <Layer id="area-circle-fill" type="fill" paint={{ 'fill-color': selectedArea.color || '#3B82F6', 'fill-opacity': 0.15 }} />
                          <Layer id="area-circle-border" type="line" paint={{ 'line-color': selectedArea.color || '#3B82F6', 'line-width': 2, 'line-opacity': 0.6 }} />
                        </Source>
                      )}
                      <Marker longitude={selectedArea.center?.longitude || 85.3240} latitude={selectedArea.center?.latitude || 27.7172}>
                        <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: selectedArea.color || '#3B82F6' }} />
                      </Marker>
                    </Map>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Assign Technician */}
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase mb-3 flex items-center gap-2"><UserPlus size={14} /> Assign Technician</h3>
                      <div className="flex gap-2">
                        <select value={addingTech} onChange={(e) => setAddingTech(e.target.value)} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none appearance-none">
                          <option value="" disabled className="bg-slate-800">Select technician...</option>
                          {availableTechs(selectedArea.id).map(t => (
                            <option key={t.id} value={t.id} className="bg-slate-800">{t.name || t.id}</option>
                          ))}
                        </select>
                        <button onClick={() => handleAddTech(selectedArea.id)} disabled={!addingTech} className="px-5 py-3 bg-cyan-500 text-white rounded-xl text-sm font-bold hover:bg-cyan-400 transition disabled:opacity-30 disabled:cursor-not-allowed">Assign</button>
                      </div>
                    </div>

                    {/* Assigned Technicians */}
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase mb-3">Assigned Technicians ({(selectedArea.assigned_technicians || []).length})</h3>
                      {(selectedArea.assigned_technicians || []).length === 0 ? (
                        <p className="text-slate-600 text-sm text-center py-6">No technicians assigned to this area.</p>
                      ) : (
                        <div className="space-y-2">
                          {(selectedArea.assigned_technicians || []).map((uid: string) => {
                            const tech = technicians.find(t => t.id === uid);
                            return (
                              <div key={uid} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-9 h-9 rounded-full bg-slate-700 border-2 flex items-center justify-center shrink-0" style={{ borderColor: selectedArea.color || '#3B82F6' }}>
                                  <span className="text-xs font-bold text-white">{(tech?.name || '?').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium">{tech?.name || uid}</p>
                                  <p className="text-slate-500 text-xs">{tech?.current_status || 'inactive'}</p>
                                </div>
                                <button onClick={() => handleRemoveTech(selectedArea.id, uid)} className="text-slate-600 hover:text-red-400 transition p-2" title="Remove from area"><UserMinus size={16} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <MapPinned size={48} className="mb-4 opacity-30" />
                  <p className="text-sm">Select an area to manage technician assignments.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
