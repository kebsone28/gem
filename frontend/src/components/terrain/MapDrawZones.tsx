 
/**
 * MapDrawZones.tsx
 *
 * Outil de dessin de zones polygonales sur la carte.
 * Permet de délimiter des secteurs d'intervention et d'assigner une équipe.
 * Stockage en safeStorage (zones persistantes).
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PenLine, Trash2, CheckCircle2, XCircle, Users, MapPinned } from 'lucide-react';
import { useProject } from '../../contexts/ProjectContext';
import { useTeams } from '../../hooks/useTeams';
import {
  isTeamAvailableForAllocation,
  sortTeamsByCanonicalPriority,
} from '../../services/planningAllocation';

export interface DrawnZone {
  id: string;
  name: string;
  team: string;
  color: string;
  coordinates: [number, number][];
  createdAt: string;
}

const ZONE_COLORS = [
  { hex: '#6366f1', tw: 'bg-[#6366f1]' },
  { hex: '#f43f5e', tw: 'bg-[#f43f5e]' },
  { hex: '#10b981', tw: 'bg-[#10b981]' },
  { hex: '#f59e0b', tw: 'bg-[#f59e0b]' },
  { hex: '#06b6d4', tw: 'bg-[#06b6d4]' },
  { hex: '#8b5cf6', tw: 'bg-[#8b5cf6]' },
  { hex: '#ec4899', tw: 'bg-[#ec4899]' },
];
// STORAGE handled in terrainUIStore

// Note: zone persistence moved to `terrainUIStore`. The legacy `useDrawnZones` hook
// was removed to keep this file focused on the UI panel and avoid fast-refresh
// issues caused by exporting runtime hooks/constants from the same module.

import { useTerrainUIStore } from '../../store/terrainUIStore';

/**
 * Panneau de gestion des zones dessinées (liste + suppression).
 * Le dessin réel est géré dans MapLibreVectorMap via les events de clic.
 */
export function MapDrawZonesPanel({
  onStartDraw,
  onConfirmZone,
  onCancelDraw,
  isDarkMode = true,
}: {
  onStartDraw: () => void;
  onConfirmZone: (name: string, team: string, color: string) => void;
  onCancelDraw: () => void;
  isDarkMode?: boolean;
}) {
  const { project } = useProject();
  const { teams, fetchTeams } = useTeams(project?.id);

  // Zustand selectors
  const isDrawing = useTerrainUIStore((s) => s.isDrawing);
  const pendingPoints = useTerrainUIStore((s) => s.pendingPoints);
  const zones = useTerrainUIStore((s) => s.drawnZones);
  const deleteZone = useTerrainUIStore((s) => s.deleteZone);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const teamOptions = useMemo(() => {
    const availableTeams = teams.filter(isTeamAvailableForAllocation);
    const sortedTeams = sortTeamsByCanonicalPriority(
      availableTeams,
      new Map<string, number>(),
      new Map<string, number>()
    );

    return [
      ...sortedTeams.map((team) => ({
        value: team.name,
        label: `${team.name}${team.tradeKey ? ` • ${team.tradeKey}` : ''}`,
      })),
      { value: 'Non assigné', label: 'Non assigné' },
    ];
  }, [teams]);

  const [name, setName] = useState('Zone ' + (zones.length + 1));
  const [team, setTeam] = useState('Non assigné');
  const [colorObj, setColorObj] = useState(ZONE_COLORS[zones.length % ZONE_COLORS.length]);

  useEffect(() => {
    const t1 = window.setTimeout(() => setName('Zone ' + (zones.length + 1)), 0);
    const t2 = window.setTimeout(() => setColorObj(ZONE_COLORS[zones.length % ZONE_COLORS.length]), 0);
    const t3 = window.setTimeout(() => setTeam((current) => current || teamOptions[0]?.value || 'Non assigné'), 0);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [zones.length, teamOptions]);

  const bg = isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const sub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`absolute bottom-[132px] left-3 right-3 top-auto z-30 max-h-[calc(100dvh-11rem)] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm md:bottom-auto md:left-auto md:right-4 md:top-20 md:w-72 md:max-h-[calc(100dvh-7rem)] ${bg}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/30 flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-xl">
          <MapPinned size={16} className="text-indigo-400" />
        </div>
        <div>
          <p className={`text-sm font-bold ${text}`}>Zones Personnalisées</p>
          <p className={`text-xs ${sub}`}>
            {zones.length} zone{zones.length !== 1 ? 's' : ''} dessinée
            {zones.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Mode dessin actif */}
      {isDrawing ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 bg-indigo-500/10 rounded-xl p-3">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <p className={`text-xs font-medium ${text}`}>
              {pendingPoints.length === 0
                ? 'Cliquez sur la carte pour ajouter des points...'
                : `${pendingPoints.length} point${pendingPoints.length > 1 ? 's' : ''} — cliquez pour continuer`}
            </p>
          </div>

          {pendingPoints.length >= 3 && (
            <div className="space-y-2">
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de la zone"
              />
              <select
                className={inputCls}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                title="Équipe assignée"
              >
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={`text-[11px] ${sub}`}>
                Affectation basée sur les équipes projet actives, avec fallback manuel possible.
              </p>
              <div className="flex gap-2">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    title={`Couleur ${c.hex}`}
                    onClick={() => setColorObj(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${colorObj.hex === c.hex ? 'border-white scale-125' : 'border-transparent'} ${c.tw}`}
                  />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  aria-label="Confirmer la zone"
                  onClick={() => onConfirmZone(name, team, colorObj.hex)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl py-2 transition-colors"
                >
                  <CheckCircle2 size={14} /> Confirmer
                </button>
                <button
                  aria-label="Annuler le dessin"
                  onClick={onCancelDraw}
                  className={`px-3 rounded-xl text-xs font-bold transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          )}
          {pendingPoints.length < 3 && (
            <button
              aria-label="Annuler le dessin"
              onClick={onCancelDraw}
              className="w-full text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors py-2"
            >
              Annuler
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Bouton démarrer */}
          <button
            aria-label="Dessiner une nouvelle zone"
            onClick={onStartDraw}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl py-2.5 transition-colors"
          >
            <PenLine size={15} /> Dessiner une zone
          </button>

          {/* Liste des zones */}
          {zones.length === 0 ? (
            <p className={`text-xs text-center py-4 ${sub}`}>Aucune zone dessinée</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {zones.map((z) => (
                <div
                  key={z.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 bg-[${z.color}]`}
                    style={{ backgroundColor: z.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${text}`}>{z.name}</p>
                    <p className={`text-xs flex items-center gap-1 ${sub}`}>
                      <Users size={9} /> {z.team} · {z.coordinates.length} pts
                    </p>
                  </div>
                  <button
                    title={`Supprimer ${z.name}`}
                    onClick={() => deleteZone(z.id)}
                    className="text-rose-400 hover:text-rose-300 transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Supprimé: useDrawnZones (maintenant intégré au terrainUIStore)
