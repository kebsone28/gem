import React, { useEffect, useState } from 'react';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { PERMISSIONS, PERMISSION_LABELS } from '../utils/permissions';
import adminPermissionsService from '../services/adminPermissionsService';
import { useAuth } from '../contexts/AuthContext';

const permissions = Object.values(PERMISSIONS);

export default function AdminPermissions() {
  const { user } = useAuth();
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await adminPermissionsService.getRolePermissions();
        const map: Record<string, Set<string>> = {};
        data.roles.forEach((r: any) => {
          map[r.role] = new Set(r.permissions || []);
        });
        setRolePerms(map);
        setRoles(data.roles.map((r: any) => r.role));
      } catch (err) {
        // noop
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (role: string, p: string) => {
    setRolePerms((prev) => {
      const copy = { ...prev };
      if (!copy[role]) copy[role] = new Set();
      if (copy[role].has(p)) copy[role].delete(p);
      else copy[role].add(p);
      return copy;
    });
  };

  const saveRole = async (role: string) => {
    const perms = Array.from(rolePerms[role] || []);
    await adminPermissionsService.updateRolePermissions(role, perms);
    // simple reload
    const data = await adminPermissionsService.getRolePermissions();
    const map: Record<string, Set<string>> = {};
    data.roles.forEach((r: any) => {
      map[r.role] = new Set(r.permissions || []);
    });
    setRolePerms(map);
  };

  if (loading) return <PageContainer><PageHeader title="Permissions" subtitle="Chargement..." /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader title="Gestion des permissions" subtitle="Modifier la matrice roles × permissions" />
      <ContentArea>
        <div className="flex items-center justify-between mb-4">
          <div />
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={async () => {
                try {
                  const data = await adminPermissionsService.exportRolePermissions();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `role-permissions-export-${new Date().toISOString()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  alert('Export téléchargé');
                } catch (err) {
                  alert('Export failed');
                }
              }}
            >
              Exporter
            </button>

            <label className="px-3 py-1 bg-slate-200 text-slate-800 rounded cursor-pointer">
              Importer
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
                    alert('Import réussi');
                    const data = await adminPermissionsService.getRolePermissions();
                    const map: Record<string, Set<string>> = {};
                    data.roles.forEach((r: any) => {
                      map[r.role] = new Set(r.permissions || []);
                    });
                    setRolePerms(map);
                    setRoles(data.roles.map((r: any) => r.role));
                  } catch (err) {
                    alert('Import failed: ' + (err as any).message);
                  }
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Permission</th>
                {roles.map((r) => (
                  <th key={r} className="p-2 text-center">
                    <div className="font-medium">{r}</div>
                    <button
                      className="mt-2 px-2 py-1 text-xs bg-blue-600 text-white rounded"
                      onClick={() => saveRole(r)}
                    >
                      Enregistrer
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p} className="align-top border-b">
                  <td className="p-2 align-top">
                    <div className="font-medium">{PERMISSION_LABELS[p] || p}</div>
                    <div className="text-xs text-slate-400">{p}</div>
                  </td>
                  {roles.map((r) => (
                    <td key={r + p} className="p-2 border text-center">
                      <input
                        type="checkbox"
                        checked={!!(rolePerms[r] && rolePerms[r].has(p))}
                        onChange={() => toggle(r, p)}
                        aria-label={`${r}:${p}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
