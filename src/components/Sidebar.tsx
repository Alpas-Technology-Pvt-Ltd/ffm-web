"use client";
import { AlertCircle, Clock, Map as MapIcon, Users, CheckCircle, LogOut, FileText, History, MapPinned, UserCog, MessageSquareWarning, CalendarCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <aside className="w-72 h-screen glass-panel relative left-0 top-0 z-20 flex flex-col p-6 m-4 mr-0 rounded-2xl flex-shrink-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <MapIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
            FFM Sync
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide">COMMAND CENTER</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        <NavItem href="/" icon={<Users size={20} />} label="Active Field Force" active={pathname === '/'} />
        <NavItem href="/overtime" icon={<Clock size={20} />} label="Overtime Approvals" badge="3" active={pathname === '/overtime'} />
        <NavItem href="/tasks" icon={<CheckCircle size={20} />} label="Task Gamification" active={pathname === '/tasks'} />
        <NavItem href="/history" icon={<History size={20} />} label="Task History" active={pathname === '/history'} />
        <NavItem href="/reports" icon={<FileText size={20} />} label="Daily Reports" active={pathname === '/reports'} />
        <NavItem href="/areas" icon={<MapPinned size={20} />} label="Service Areas" active={pathname === '/areas'} />
        <NavItem href="/technicians" icon={<UserCog size={20} />} label="Technicians" active={pathname === '/technicians'} />
        <NavItem href="/anomalies" icon={<AlertCircle size={20} />} label="Anomalies" active={pathname === '/anomalies'} />
        <div className="my-3 border-t border-slate-700/30" />
        <NavItem href="/complaints" icon={<MessageSquareWarning size={20} />} label="Complaints" badge="NEW" active={pathname === '/complaints'} />
        <NavItem href="/attendance" icon={<CalendarCheck size={20} />} label="Attendance" active={pathname === '/attendance'} />
        <NavItem href="/feedback" icon={<Star size={20} />} label="Feedback" active={pathname === '/feedback'} />
      </nav>

      <div className="mt-auto space-y-4">
        {/* User Profile display */}
        <div className="glass-pill p-4 flex items-center gap-3 border border-slate-700/50">
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">HR</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">Command Node</p>
            <p className="text-xs text-slate-400">Regional Supervisor</p>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)] group font-medium"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          Terminate Session
        </button>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, badge, href }: any) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-blue-500/10 text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]' 
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={`${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`}>
        {icon}
      </span>
      <span className="font-medium text-sm">{label}</span>
      {badge && (
        <span className={`${active ? 'bg-blue-500/20 ring-blue-500/30 text-blue-300' : 'bg-indigo-500/20 ring-indigo-500/30 text-indigo-300'} ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ring-1 ring-inset`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
