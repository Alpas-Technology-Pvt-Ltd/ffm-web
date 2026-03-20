"use client";
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { AlertCircle } from 'lucide-react';

export default function AnomaliesPage() {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full bg-[#0d1527] relative text-slate-200 overflow-hidden">
        {/* Abstract Gradient Blob Background */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] pointer-events-none" />

        <Sidebar />

        <main className="flex-1 relative z-10 p-8 flex flex-col h-screen overflow-y-auto">
          <header className="mb-8 flex items-center gap-4">
            <div className="p-3 glass-pill bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <AlertCircle size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-widest uppercase">System Anomalies</h1>
              <p className="text-slate-400 mt-1">Review flagged geofence breaches, delayed SLA records, and unauthorized pings.</p>
            </div>
          </header>

          <div className="glass-panel p-10 flex flex-col items-center justify-center flex-1 rounded-2xl border-solid border-slate-700/50 bg-white/5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
                 <div className="w-8 h-8 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-white">Network Secure</h2>
              <p className="text-slate-400 text-center max-w-sm mt-3">
                No active anomalies detected across the regional Field Force grid. All technician coordinates verify correctly.
              </p>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
