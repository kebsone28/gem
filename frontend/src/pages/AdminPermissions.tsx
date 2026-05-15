import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { PERMISSIONS, PERMISSION_LABELS, resolvePermissionDependencies } from '../utils/permissions';
import adminPermissionsService from '../services/adminPermissionsService';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Save, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const permissions = Object.values(PERMISSIONS);

export default function AdminPermissions() {
  useAuth();
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminPermissionsService.getRolePermissions();
        const map: Record<string, Set<string>> = {};
        data.roles.forEach((r: any) => {
          map[r.role] = new Set(r.permissions || []);
        });
        setRolePerms(map);
        setRoles(data.roles.map((r: any) => r.role));
      } catch {
        setError('Impossible de charger les permissions. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const toggle = (role: string, p: string) => {
    setRolePerms((prev) => {
      const copy = { ...prev };
      const currentSet = new Set(copy[role] || []);
      
      if (currentSet.has(p)) {
        currentSet.delete(p);
        // Optionnel: On pourrait aussi décocher ce qui dépend de p, 
        // mais c'est plus sûr de laisser l'admin décider.
      } else {
        currentSet.add(p);
        // Ajouter automatiquement les dépendances
        const deps = resolvePermissionDependencies(p);
        deps.forEach((dep: string) => currentSet.add(dep));
      }
      
      copy[role] = currentSet;
      return copy;
    });
  };

  const saveRole = async (role: string) => {
    try {
      setSavingRole(role);
      setError(null);
      setNotice(null);
      const perms = Array.from(rolePerms[role] || []);
      await adminPermissionsService.updateRolePermissions(role, perms);
      // simple reload
      const data = await adminPermissionsService.getRolePermissions();
      const map: Record<string, Set<string>> = {};
      data.roles.forEach((r: any) => {
        map[r.role] = new Set(r.permissions || []);
      });
      setRolePerms(map);
      setNotice(`Permissions mises à jour pour ${role}.`);
    } catch {
      setError(`Échec de l’enregistrement pour ${role}.`);
    } finally {
      setSavingRole(null);
    }
  };

  if (loading)
    return (
      <PageContainer className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Matrices de sécurité...</p>
        </div>
      </PageContainer>
    );

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="Matrice de Sécurité"
        subtitle="Contrôle d'accès granulaire RBAC pour tous les rôles du système"
        icon={<Shield size={24} className="text-indigo-400" />}
      />

      <ContentArea className="mt-8 p-0 bg-transparent border-none">
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-4">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold"
                >
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}
              {notice && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold"
                >
                  <Check size={14} /> {notice}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-700"
              onClick={async () => {
                try {
                  const data = await adminPermissionsService.exportRolePermissions();
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `role-permissions-export-${new Date().toISOString()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  setNotice('Export téléchargé.');
                  setError(null);
                } catch {
                  setError("Échec de l'export.");
                }
              }}
            >
              <Download size={14} /> Exporter
            </button>

            <label className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-700 cursor-pointer">
              <Upload size={14} /> Importer
              <input
                type="file"
                accept="application/json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const txt = await f.text();
                    const json = JSON.parse(txt);
                    await adminPermissionsService.importRolePermissions(json);
                    setNotice('Import réussi.');
                    setError(null);
                    const data = await adminPermissionsService.getRolePermissions();
                    const map: Record<string, Set<string>> = {};
                    data.roles.forEach((r: any) => {
                      map[r.role] = new Set(r.permissions || []);
                    });
                    setRolePerms(map);
                    setRoles(data.roles.map((r: any) => r.role));
                  } catch (err) {
                    setError('Import échoué: ' + (err as any).message);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl shadow-2xl overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-white/5">
                <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sticky left-0 bg-slate-900/60 backdrop-blur-md z-10">Permission & Clé</th>
                {roles.map((r) => (
                  <th key={r} className="p-8 text-center min-w-[200px]">
                    <div className="text-sm font-black text-white uppercase tracking-wider mb-4">{r}</div>
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-30 disabled:grayscale"
                      onClick={() => saveRole(r)}
                      disabled={savingRole === r}
                    >
                      {savingRole === r ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                      Sauvegarder
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {permissions.map((p, idx) => (
                <motion.tr
                  key={p}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.5, idx * 0.02) }}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-8 sticky left-0 bg-slate-950/40 backdrop-blur-md group-hover:bg-slate-900/60 transition-colors z-10">
                    <div className="font-black text-sm text-white group-hover:text-indigo-400 transition-colors">
                      {PERMISSION_LABELS[p] || p}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-50">{p}</div>
                  </td>
                  {roles.map((r) => (
                    <td key={r + p} className="p-8 text-center border-l border-white/[0.03]">
                      <div className="flex justify-center">
                        <label className="relative flex items-center justify-center w-10 h-10 cursor-pointer group/cb">
                          <input
                            type="checkbox"
                            checked={!!(rolePerms[r] && rolePerms[r].has(p))}
                            onChange={() => toggle(r, p)}
                            className="peer hidden"
                            aria-label={`${r}:${p}`}
                          />
                          <div className="w-6 h-6 border-2 border-slate-700 rounded-lg bg-slate-800 transition-all peer-checked:bg-indigo-600 peer-checked:border-indigo-500 peer-checked:shadow-[0_0_15px_rgba(79,70,229,0.4)] flex items-center justify-center group-hover/cb:border-indigo-500/50">
                            <Check size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                        </label>
                      </div>
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
