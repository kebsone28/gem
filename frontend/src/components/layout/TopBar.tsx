import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { Shield, Activity } from 'lucide-react';
import { normalizeRole } from '@core/security/permissions';
import { AppRole } from '@core/security/types';

export function TopBar() {
  const { user } = useAuth();
  const { project } = useProject();

  const nRole = user ? normalizeRole(user.role) : null;
  const roleDisplay = user ? (nRole === AppRole.ADMIN ? 'Admin' : user.role) : '';

  return (
    <header className="relative z-30 flex h-14 w-full items-center justify-between border-b border-white/8 bg-slate-950/40 px-6 backdrop-blur-md">
      {/* Left Section: Breadcrumbs */}
      <div className="flex items-center gap-4">
        <Breadcrumbs />
      </div>

      {/* Right Section: Badges & Profile Capsule */}
      <div className="flex items-center gap-3">
        {/* Project Capsule */}
        {project && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-500/15 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Projet: {project.name}</span>
          </div>
        )}

        {/* User Capsule */}
        {user && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/6 bg-white/[0.03] px-3.5 py-1 text-[11px] font-bold text-slate-300">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Shield className="w-3 h-3 text-blue-300" />
            </div>
            <span className="truncate max-w-[120px]">{user.name}</span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-widest border-l border-white/8 pl-2">
              {roleDisplay}
            </span>
          </div>
        )}

        {/* Online Status Dot */}
        <div 
          className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            navigator.onLine 
              ? 'border-emerald-500/15 bg-emerald-500/10 text-emerald-300' 
              : 'border-rose-500/15 bg-rose-500/10 text-rose-300'
          }`}
          title={navigator.onLine ? 'En ligne' : 'Hors ligne'}
        >
          <Activity size={10} className={navigator.onLine ? 'animate-pulse' : ''} />
        </div>
      </div>
    </header>
  );
}
