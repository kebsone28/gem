import React, { useState, useEffect } from 'react';
import { Smartphone, FileText, CheckCircle, Calendar, Loader2 } from 'lucide-react';
import apiClient from '@/api/client';

type Stats = {
  totalUsers: number;
  activeUsers: number;
  assignedForms: number;
  totalSubmissions: number;
  todaySubmissions: number;
};

const GedcollectDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('gedcollect-admin/stats')
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
  );
  if (!stats) return null;

  const cards = [
    { icon: Smartphone, label: 'Utilisateurs totaux', value: stats.totalUsers, color: 'text-blue-100 bg-blue-500/10' },
    { icon: CheckCircle, label: 'Utilisateurs actifs', value: stats.activeUsers, color: 'text-emerald-100 bg-emerald-500/10' },
    { icon: FileText, label: 'Formulaires assignés', value: stats.assignedForms, color: 'text-indigo-100 bg-indigo-500/10' },
    { icon: Calendar, label: 'Aujourd\'hui', value: stats.todaySubmissions, suffix: 'soumission(s)', color: 'text-amber-100 bg-amber-500/10' },
  ];

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">
        GedCollect — Statistiques
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border border-white/5 p-3 ${c.color}`}>
            <c.icon size={18} />
            <p className="mt-2 text-2xl font-black text-white">{c.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500 font-semibold">
        {stats.totalSubmissions} soumission(s) au total
      </p>
    </div>
  );
};

export default GedcollectDashboard;