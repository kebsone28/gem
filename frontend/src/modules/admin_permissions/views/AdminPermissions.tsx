import { useState, useEffect, useMemo, useCallback } from 'react';
import { Shield, Save, Download, Upload, ArrowLeft, Check, X, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import adminPermissionsService from '@services/adminPermissionsService';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '@core/security/permissions';
import { toast } from 'react-hot-toast';

interface RoleEntry {
  role: string;
  permissions: string[];
}

const CATEGORY_GROUPS: Record<string, { label: string; permissions: string[] }> = {
  'system': {
    label: '⚙️ Administration & Sécurité',
    permissions: ['system.users', 'system.roles', 'system.audit', 'system.sync', 'system.config', 'system.export', 'system.messages'],
  },
  'missions': {
    label: '📋 Missions & Approbations',
    permissions: ['missions.read', 'missions.create', 'missions.update', 'missions.delete', 'missions.validate', 'missions.approve', 'missions.planning'],
  },
  'finance': {
    label: '💰 Finances & Budgets',
    permissions: ['finance.read', 'finance.manage', 'finance.payments', 'finance.export', 'finance.reports'],
  },
  'terrain': {
    label: '🗺️ Terrain & Ménages',
    permissions: ['terrain.read', 'terrain.write', 'terrain.terminal', 'terrain.reject', 'terrain.zones', 'terrain.menages', 'terrain.map'],
  },
  'logistique': {
    label: '📦 Logistique & Stock',
    permissions: ['logistique.read', 'logistique.stock', 'logistique.deliveries', 'logistique.agents', 'logistique.om', 'logistique.atelier', 'logistique.deployment', 'logistique.manage'],
  },
  'ui': {
    label: '🖥️ Interface & Navigation',
    permissions: ['ui.map', 'ui.chat', 'ui.alerts', 'ui.training', 'ui.projects', 'ui.teams', 'ui.dashboard'],
  },
  'dashboard': {
    label: '📈 Dashboards',
    permissions: ['dashboard.admin', 'dashboard.project', 'dashboard.team', 'dashboard.client', 'dashboard.accounting', 'dashboard.assets'],
  },
  'settings': {
    label: '🔧 Paramètres',
    permissions: ['settings.charges', 'settings.kobo', 'settings.data', 'settings.datahub', 'settings.system'],
  },
  'sector': {
    label: '🏢 Secteurs',
    permissions: ['sector.gem', 'sector.mes'],
  },
  'docs': {
    label: '📄 Documents & PV',
    permissions: ['docs.read', 'docs.confidential', 'docs.pv'],
  },
  'cahier': {
    label: '📘 Cahier des Charges',
    permissions: ['cahier.technical', 'cahier.contracts', 'cahier.strategy'],
  },
  'ia': {
    label: '🤖 Intelligence Artificielle',
    permissions: ['ia.use', 'ia.metrics', 'ia.simulation', 'ia.config'],
  },
  'modules': {
    label: '🧩 Gestion des Modules',
    permissions: ['modules.manage'],
  },
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PROQUELEC: 'Super Admin',
  DIRECTEUR: 'Directeur',
  CHEF_PROJET: 'Chef de Projet',
  COMPTABLE: 'Comptable',
  CHEF_EQUIPE: 'Chef d\'Équipe',
  SUPERVISEUR: 'Superviseur',
  CONTROLEUR: 'Contrôleur',
  CLIENT_LSE: 'Client LSE',
};

export default function AdminPermissions() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());

  const ROLE_LABEL_MAP: Record<string, string> = useMemo(() => ({
    ADMIN_PROQUELEC: 'Super Admin',
    DIRECTEUR: 'Directeur',
    CHEF_PROJET: 'Chef de Projet',
    COMPTABLE: 'Comptable',
    CHEF_EQUIPE: 'Chef d\'Équipe',
    SUPERVISEUR: 'Superviseur',
    CONTROLEUR: 'Contrôleur',
    CLIENT_LSE: 'Client LSE',
  }), []);

  useEffect(() => {
    (async () => {
      try {
        const data = await adminPermissionsService.getRolePermissions();
        if (data.roles?.length > 0) {
          setRoles(data.roles);
        } else {
          const fallback = Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
            role,
            permissions: [...perms],
          }));
          setRoles(fallback);
        }
      } catch {
        const fallback = Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
          role,
          permissions: [...perms],
        }));
        setRoles(fallback);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasPermission = useCallback((role: string, perm: string) => {
    const r = roles.find(r => r.role === role);
    return r?.permissions.includes(perm) ?? false;
  }, [roles]);

  const togglePermission = useCallback(async (role: string, perm: string) => {
    setRoles(prev => prev.map(r => {
      if (r.role !== role) return r;
      const set_ = new Set(r.permissions);
      if (set_.has(perm)) set_.delete(perm); else set_.add(perm);
      return { ...r, permissions: [...set_] };
    }));
    setDirtyRoles(prev => { const n = new Set(prev); n.add(role); return n; });
  }, []);

  const saveRole = useCallback(async (role: string) => {
    setSaving(role);
    try {
      const r = roles.find(r => r.role === role);
      if (!r) return;
      await adminPermissionsService.updateRolePermissions(role, r.permissions);
      toast.success(`Permissions mises à jour pour ${ROLE_LABELS[role] || role}`);
      setDirtyRoles(prev => { const n = new Set(prev); n.delete(role); return n; });
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  }, [roles]);

  const exportMatrix = useCallback(async () => {
    try {
      const data = await adminPermissionsService.exportRolePermissions();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'permissions-matrix.json'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Matrice exportée');
    } catch {
      toast.error('Erreur lors de l\'export');
    }
  }, []);

  const importMatrix = useCallback(async () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        await adminPermissionsService.importRolePermissions(payload.roles || payload);
        const data = await adminPermissionsService.getRolePermissions();
        setRoles(data.roles || []);
        toast.success('Matrice importée');
      } catch {
        toast.error('Erreur lors de l\'import');
      }
    };
    input.click();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!search) return Object.entries(CATEGORY_GROUPS);
    const q = search.toLowerCase();
    return Object.entries(CATEGORY_GROUPS).filter(([, group]) =>
      group.label.toLowerCase().includes(q) ||
      group.permissions.some(p => p.toLowerCase().includes(q) || (PERMISSION_LABELS[p] || '').toLowerCase().includes(q))
    );
  }, [search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 size={40} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <Shield size={28} className="text-indigo-400" />
                <h1 className="text-2xl font-black text-white tracking-tight">Matrice des Permissions</h1>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Gérez les permissions atomiques pour chaque rôle
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={importMatrix} className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-semibold transition-all flex items-center gap-2 border border-white/5">
              <Upload size={16} /> Importer
            </button>
            <button onClick={exportMatrix} className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-semibold transition-all flex items-center gap-2 border border-white/5">
              <Download size={16} /> Exporter
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher une permission..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900/80 border border-white/8 text-slate-200 placeholder:text-slate-600 text-sm font-medium focus:outline-none focus:border-indigo-500/40 transition-all"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/8 bg-slate-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="sticky left-0 z-10 bg-slate-900/95 text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 min-w-[220px]">
                  Permission
                </th>
                {roles.map(r => (
                  <th key={r.role} className="px-3 py-3 text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {ROLE_LABELS[r.role] || r.role}
                    </div>
                    {dirtyRoles.has(r.role) && (
                      <div className="mt-1">
                        <button
                          onClick={() => saveRole(r.role)}
                          disabled={saving === r.role}
                          className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500/30 transition-all disabled:opacity-50 flex items-center gap-1 mx-auto"
                        >
                          {saving === r.role ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                          Sauver
                        </button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map(([catKey, group]) => (
                <>
                  <tr key={`cat-${catKey}`} className="border-b border-white/5 bg-slate-800/40">
                    <td colSpan={roles.length + 1} className="px-4 py-2.5">
                      <span className="text-[11px] font-bold text-slate-400">{group.label}</span>
                    </td>
                  </tr>
                  {group.permissions.map(perm => {
                    const label = PERMISSION_LABELS[perm] || perm;
                    return (
                      <tr key={perm} className="border-b border-white/5 hover:bg-slate-800/30 transition-colors">
                        <td className="sticky left-0 z-10 bg-slate-900/95 px-4 py-2.5 text-slate-300 font-medium text-[12px] whitespace-nowrap">
                          <div>{label}</div>
                          <div className="text-[9px] text-slate-600 font-mono mt-0.5">{perm}</div>
                        </td>
                        {roles.map(r => {
                          const on = hasPermission(r.role, perm);
                          return (
                            <td key={`${r.role}-${perm}`} className="px-3 py-2 text-center">
                              <button
                                onClick={() => togglePermission(r.role, perm)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto ${
                                  on
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                    : 'bg-slate-800/60 text-slate-600 hover:bg-slate-700/60 hover:text-slate-400'
                                }`}
                              >
                                {on ? <Check size={14} /> : <X size={14} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-600">
          {roles.length} rôles · {Object.values(CATEGORY_GROUPS).flatMap(g => g.permissions).length} permissions atomiques
        </div>
      </div>
    </div>
  );
}
