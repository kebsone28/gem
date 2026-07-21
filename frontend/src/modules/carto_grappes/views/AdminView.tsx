import React, { useState } from 'react';
import type { LotKey, LotMode } from '../types';
import { LOT_KEYS, REGIONS } from '../constants';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  lots?: string[];
}

interface AdminViewProps {
  entrepreneurConfig: Record<string, any>;
  lotModes: Record<LotKey, LotMode>;
  onUpdateConfig: (config: Record<string, any>) => void;
  onUpdateLotMode: (lot: LotKey, mode: LotMode) => void;
  onSyncToAPI: () => Promise<void>;
  getEntrepreneur: (lot: LotKey, region: string, grappe: number) => any;
  users?: UserInfo[];
  prestataires?: any[];
  serverDashboardStats?: any;
  refreshDashboardStats?: () => void;
  initializeServerData?: () => Promise<void>;
  serverConfig?: { regions: any[]; grappes: any[]; lots: any[] };
}

const REGION_COLORS: Record<string, string> = {
  Kaffrine: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Tambacounda: 'bg-amber-100 text-amber-700 border-amber-200',
  Kedougou: 'bg-purple-100 text-purple-700 border-purple-200',
  Ziguinchor: 'bg-blue-100 text-blue-700 border-blue-200',
  Sedhiou: 'bg-rose-100 text-rose-700 border-rose-200',
  Kolda: 'bg-orange-100 text-orange-700 border-orange-200',
};

const AdminView: React.FC<AdminViewProps> = ({
  entrepreneurConfig,
  lotModes,
  onUpdateConfig,
  onUpdateLotMode,
  onSyncToAPI,
  getEntrepreneur,
  users = [],
  prestataires = [],
  serverDashboardStats,
  refreshDashboardStats,
  initializeServerData,
  serverConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'assign' | 'users' | 'server'>('assign');

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(['assign', 'users', 'server'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition ${
              activeTab === t
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {t === 'assign'
              ? 'Affectation prestataires'
              : t === 'users'
                ? 'Utilisateurs'
                : 'Serveur'}
          </button>
        ))}
      </div>

      {activeTab === 'assign' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-800 mb-1">Gestion des prestataires déplacée</p>
            <p className="text-blue-700">
              La gestion complète des prestataires (CRUD, import Excel) se fait maintenant dans le
              module <strong>Prestataires</strong> (menu Opérations → Prestataires). Ce panneau sert
              uniquement à l'affectation graphique par grappe/lot via la Carte.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="font-medium text-slate-800 mb-3">Pour affecter des prestataires :</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
              <li>
                Allez dans l&apos;onglet <strong>Carte</strong>
              </li>
              <li>Cliquez sur une bulle de village/grappe</li>
              <li>
                Le panneau <strong>Affecter prestataires</strong> s&apos;ouvre à droite
              </li>
              <li>Sélectionnez le lot (A, B ou C) et remplissez les informations</li>
              <li>Sauvegardez — la config est envoyée à l&apos;API unifiée</li>
            </ol>
          </div>

          {prestataires.length > 0 && (
            <details className="border border-slate-200 rounded-lg bg-white">
              <summary className="p-3 font-semibold text-slate-800 cursor-pointer">
                Prestataires existants ({prestataires.length})
              </summary>
              <div className="p-3 space-y-2 text-sm">
                {prestataires.slice(0, 20).map((p: any, i: number) => (
                  <div
                    key={p.id || i}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100"
                  >
                    <span className="font-mono text-xs text-slate-500 w-8">{i + 1}</span>
                    <span className="font-medium text-slate-800">
                      {p.entreprise || p.nom || '—'}
                    </span>
                    <span className="text-slate-500 text-xs">({p.lot || '—'})</span>
                    <span className="text-slate-400 text-xs ml-auto">{p.region || '—'}</span>
                  </div>
                ))}
                {prestataires.length > 20 && (
                  <p className="text-slate-500 text-xs">... et {prestataires.length - 20} autres</p>
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <h3 className="font-medium text-slate-800">Utilisateurs (lecture seule)</h3>
          <p className="text-sm text-slate-500">
            La gestion des comptes se fait dans le module Administration → Utilisateurs.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="p-2 border-b border-slate-200 text-left">Nom</th>
                  <th className="p-2 border-b border-slate-200 text-left">Email</th>
                  <th className="p-2 border-b border-slate-200 text-left">Rôle</th>
                  <th className="p-2 border-b border-slate-200 text-left">Lots</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id || i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-2">{u.lots?.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'server' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={initializeServerData}
              disabled={!initializeServerData}
              className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Initialiser données serveur
            </button>
            <button
              type="button"
              onClick={onSyncToAPI}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              Synchroniser config → API
            </button>
          </div>

          {serverDashboardStats && (
            <details className="border border-slate-200 rounded-lg bg-white">
              <summary className="p-3 font-semibold text-slate-800 cursor-pointer">
                Statistiques serveur
              </summary>
              <div className="p-3 grid gap-2 md:grid-cols-4 text-sm">
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500">Total grappes</div>
                  <div className="font-bold text-lg">{serverDashboardStats.totalGrappes}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500">Total régions</div>
                  <div className="font-bold text-lg">{serverDashboardStats.totalRegions}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500">Grappes assignées</div>
                  <div className="font-bold text-lg">{serverDashboardStats.assignedGrappes}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500">Total lots</div>
                  <div className="font-bold text-lg">{serverDashboardStats.totalLots}</div>
                </div>
              </div>
            </details>
          )}

          {serverConfig && (
            <details className="border border-slate-200 rounded-lg bg-white">
              <summary className="p-3 font-semibold text-slate-800 cursor-pointer">
                Configuration serveur
              </summary>
              <div className="p-3 space-y-4 text-sm">
                <div>
                  <div className="font-medium mb-1">
                    Régions ({serverConfig.regions?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {serverConfig.regions?.map((r: any) => (
                      <span
                        key={r.id}
                        className={REGION_COLORS[r.name] + ' px-2 py-0.5 rounded text-xs'}
                      >
                        {r.name} ({r.code})
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">
                    Grappes ({serverConfig.grappes?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {serverConfig.grappes?.map((g: any) => (
                      <span
                        key={g.id}
                        className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200"
                      >
                        {g.region?.name || g.regionId} - G{g.grappeNumber} ({g.menageCount} m)
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">Lots ({serverConfig.lots?.length || 0})</div>
                  <div className="flex flex-wrap gap-1">
                    {serverConfig.lots?.map((l: any) => (
                      <span
                        key={l.id}
                        className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200"
                      >
                        {l.lotKey}: {l.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminView;
