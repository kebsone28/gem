/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { create } from 'zustand';
import * as safeStorage from '../utils/safeStorage';

export const ALL_STATUSES = [
  'Contrôle conforme',
  'Non conforme',
  'Intérieur terminé',
  'Réseau terminé',
  'Murs terminés',
  'Livraison effectuée',
  'Eligible',
  'Non encore installée',
  'Non débuté',
  'Non commencé',
  'En attente',
  'Refusé',
  'Non éligible',
  'Désistement',
];

export type PanelType =
  | 'none'
  | 'routing'
  | 'draw'
  | 'layers'
  | 'grappe'
  | 'region'
  | 'datahub'
  | 'grappe_allocation';

interface TerrainUIState {
  // Panel Management
  activePanel: PanelType;
  setPanel: (panel: PanelType) => void;
  closePanel: () => void;

  // View Modes
  viewMode: 'map' | 'list';
  setViewMode: (mode: 'map' | 'list') => void;
  mapMode: 'vector' | 'raster' | 'auto';
  setMapMode: (mode: 'vector' | 'raster' | 'auto') => void;

  // Map Overlays / Toggles
  showHeatmap: boolean;
  showZones: boolean;
  showWarehouses: boolean;
  isMeasuring: boolean;
  isSelecting: boolean;
  showDatabaseStats: boolean;
  showLegend: boolean;
  mapStyle: 'dark' | 'light' | 'satellite';

  toggleHeatmap: () => void;
  toggleZones: () => void;
  toggleWarehouses: () => void;
  toggleMeasuring: () => void;
  toggleSelecting: () => void;
  toggleDatabaseStats: () => void;
  toggleLegend: () => void;
  toggleMapStyle: () => void;

  // Selection
  selectedHouseholdId: string | null;
  setSelectedHouseholdId: (id: string | null) => void;

  // --- NEW: Filters State ---
  selectedPhases: string[];
  selectedTeam: string;
  setSelectedPhases: (phases: string[]) => void;
  togglePhase: (phase: string) => void;
  setSelectedTeam: (team: string) => void;

  // --- NEW: Search State ---
  searchQuery: string;
  searchResults: Record<string, unknown>[];
  isSearching: boolean;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Record<string, unknown>[]) => void;
  setIsSearching: (isSearching: boolean) => void;

  // --- NEW: Routing State ---
  routingStart: [number, number] | null;
  routingDest: [number, number] | null;
  routeStats: { distance: number; duration: number } | null;
  turnByTurnInstructions: Record<string, unknown>[];
  isRoutingLoading: boolean;

  setRoutingStart: (start: [number, number] | null) => void;
  setRoutingDest: (dest: [number, number] | null) => void;
  setRouteStats: (stats: { distance: number; duration: number } | null) => void;
  setInstructions: (instructions: Record<string, unknown>[]) => void;
  setIsRoutingLoading: (loading: boolean) => void;
  clearRouting: () => void;

  // --- NEW: Drawing State ---
  isDrawing: boolean;
  pendingPoints: [number, number][];
  setIsDrawing: (drawing: boolean) => void;
  setPendingPoints: (points: [number, number][]) => void;
  addPendingPoint: (point: [number, number]) => void;
  clearDrawing: () => void;

  // --- NEW: Map Commands (Programmatic moves) ---
  mapCommand: { center: [number, number]; zoom: number; timestamp: number } | null;
  setMapCommand: (
    cmd: { center: [number, number]; zoom: number; timestamp: number } | null
  ) => void;

  // --- NEW: Layers & High-Level UI ---
  externalLayers: { id: string; name: string; data: unknown }[];
  setExternalLayers: (layers: { id: string; name: string; data: unknown }[]) => void;
  activeGrappeId: string | null;
  setActiveGrappeId: (id: string | null) => void;

  isDownloadingOffline: boolean;
  setIsDownloadingOffline: (loading: boolean) => void;

  // Zones
  drawnZones: { id: string; coordinates: [number, number][]; name?: string }[];
  setDrawnZones: (zones: { id: string; coordinates: [number, number][]; name?: string }[]) => void;
  addZone: (zone: { id: string; coordinates: [number, number][]; name?: string }) => void;
  deleteZone: (id: string) => void;

  // Lightbox
  lightboxPhotos: { url: string; label: string }[];
  lightboxIndex: number;
  openLightbox: (photos: { url: string; label: string }[], index: number) => void;
  closeLightbox: () => void;

  // Toolbar Visibility
  showToolbar: boolean;
  toggleToolbar: () => void;
}

export const useTerrainUIStore = create<TerrainUIState>((set) => ({
  // Panel Management
  activePanel: 'none',
  setPanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? 'none' : panel,
    })),
  closePanel: () => set({ activePanel: 'none' }),

  // View Modes
  viewMode: 'map',
  setViewMode: (mode) => set({ viewMode: mode }),
  mapMode: 'auto',
  setMapMode: (mode) => set({ mapMode: mode }),

  // Map Overlays / Toggles
  showHeatmap: false,
  showZones: true, // Enabled by default to show created Grappes polygons
  showWarehouses: true,
  isMeasuring: false,
  isSelecting: false,
  showDatabaseStats: false,
  showLegend: true,
  mapStyle: (safeStorage.getItem('gem-map-theme') as string | null) || 'light',

  toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),
  toggleZones: () => set((state) => ({ showZones: !state.showZones })),
  toggleWarehouses: () => set((state) => ({ showWarehouses: !state.showWarehouses })),
  toggleMeasuring: () => set((state) => ({ isMeasuring: !state.isMeasuring })),
  toggleSelecting: () => set((state) => ({ isSelecting: !state.isSelecting })),
  toggleDatabaseStats: () => set((state) => ({ showDatabaseStats: !state.showDatabaseStats })),
  toggleLegend: () => set((state) => ({ showLegend: !state.showLegend })),
  toggleMapStyle: () =>
    set((state) => {
      const styles: ('dark' | 'light' | 'satellite')[] = ['dark', 'light', 'satellite'];
      const next = styles[(styles.indexOf(state.mapStyle) + 1) % styles.length];
      safeStorage.setItem('gem-map-theme', next);
      return { mapStyle: next };
    }),

  // Selection
  selectedHouseholdId: null,
  setSelectedHouseholdId: (id) => set({ selectedHouseholdId: id }),

  // Filters
  selectedPhases: ALL_STATUSES,
  selectedTeam: 'all',
  setSelectedPhases: (phases) => set({ selectedPhases: phases }),
  togglePhase: (phase) =>
    set((state) => {
      if (phase === 'all') {
        return {
          selectedPhases: state.selectedPhases.length === ALL_STATUSES.length ? [] : ALL_STATUSES,
        };
      }
      return {
        selectedPhases: state.selectedPhases.includes(phase)
          ? state.selectedPhases.filter((p) => p !== phase)
          : [...state.selectedPhases, phase],
      };
    }),
  setSelectedTeam: (team) => set({ selectedTeam: team }),

  // Search
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setIsSearching: (isSearching) => set({ isSearching }),

  // Routing
  routingStart: null,
  routingDest: null,
  routeStats: null,
  turnByTurnInstructions: [],
  isRoutingLoading: false,
  setRoutingStart: (start) => set({ routingStart: start }),
  setRoutingDest: (dest) => set({ routingDest: dest }),
  setRouteStats: (stats) => set({ routeStats: stats }),
  setInstructions: (instructions) => set({ turnByTurnInstructions: instructions }),
  setIsRoutingLoading: (loading) => set({ isRoutingLoading: loading }),
  clearRouting: () =>
    set({
      routingStart: null,
      routingDest: null,
      routeStats: null,
      turnByTurnInstructions: [],
    }),

  // Drawing
  isDrawing: false,
  pendingPoints: [],
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setPendingPoints: (pendingPoints) => set({ pendingPoints }),
  addPendingPoint: (point) => set((state) => ({ pendingPoints: [...state.pendingPoints, point] })),
  clearDrawing: () => set({ isDrawing: false, pendingPoints: [] }),

  // Map Commands
  mapCommand: null,
  setMapCommand: (mapCommand) => set({ mapCommand }),

  // Layers & Grappes
  externalLayers: [],
  setExternalLayers: (externalLayers) => set({ externalLayers }),
  activeGrappeId: null,
  setActiveGrappeId: (id) => set({ activeGrappeId: id }),
  isDownloadingOffline: false,
  setIsDownloadingOffline: (isDownloadingOffline) => set({ isDownloadingOffline }),

  // Zones
  drawnZones: (() => {
    try {
      return JSON.parse(safeStorage.getItem('gem_drawn_zones') || '[]');
    } catch {
      return [];
    }
  })(),
  setDrawnZones: (drawnZones) => {
    set({ drawnZones });
    safeStorage.setItem('gem_drawn_zones', JSON.stringify(drawnZones));
  },
  addZone: (zone) =>
    set((state) => {
      const next = [...state.drawnZones, zone];
      safeStorage.setItem('gem_drawn_zones', JSON.stringify(next));
      return { drawnZones: next };
    }),
  deleteZone: (id) =>
    set((state) => {
      const next = state.drawnZones.filter((z) => z.id !== id);
      safeStorage.setItem('gem_drawn_zones', JSON.stringify(next));
      return { drawnZones: next };
    }),

  // Lightbox
  lightboxPhotos: [],
  lightboxIndex: 0,
  openLightbox: (photos, index) => set({ lightboxPhotos: photos, lightboxIndex: index }),
  closeLightbox: () => set({ lightboxPhotos: [] }),

  // Toolbar Visibility
  showToolbar: true,
  toggleToolbar: () => set((state) => ({ showToolbar: !state.showToolbar })),
}));
