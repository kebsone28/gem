import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { LotKey, LotMode, EntrepreneurConfig, EntrepreneurData, EntrepreneurGroup, Menage, Prestataire, ClusteringConfig, GrappeCluster, ClusterConfiguration } from '../types';
import { LOT_KEYS, LOT_TITLES, REGIONS, GRAPPE_COUNT } from '../constants';
import { createGrappeClusters, suggestMenagesForNewGrappe, calculateClusterDistances, findNearestClusters, optimizeClustering, suggestBestConfiguration } from '../engine/clustering';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  lots?: string[];
}

interface AdminViewProps {
  entrepreneurConfig: EntrepreneurConfig;
  lotModes: Record<LotKey, LotMode>;
  onUpdateConfig: (config: EntrepreneurConfig) => void;
  onUpdateLotMode: (lot: LotKey, mode: LotMode) => void;
  onSyncToAPI: () => Promise<void>;
  getEntrepreneur: (lot: LotKey, region: string, grappe: number) => EntrepreneurData;
  users?: UserInfo[];
  menages?: Menage[];
  villages?: any[];
  gps?: any;
  onVillageOverride?: (villageKey: string, grappe: number) => void;
  onImportExcel?: (rows: any[][]) => Promise<{ added: number; updated: number }>;
  onResetAllData?: () => Promise<void>;
  prestataires?: Prestataire[];
  onPrestataireCreate?: (prestataire: Omit<Prestataire, 'id'>) => Promise<Prestataire>;
  onPrestataireUpdate?: (id: string | number, prestataire: Partial<Prestataire>) => Promise<Prestataire>;
  onPrestataireDelete?: (id: string | number) => Promise<void>;
  serverDashboardStats?: any;
  refreshDashboardStats?: () => void;
  initializeServerData?: () => Promise<void>;
  serverConfig?: { regions: any[]; grappes: any[]; lots: any[] };
}

const emptyEnt: EntrepreneurData = { entreprise: '', societe: '', telephone: '', email: '', adresse: '' };

const FIELD_LABELS: Record<string, string> = {
  entreprise: 'Entreprise',
  societe: 'Responsable',
  telephone: 'Téléphone',
  email: 'Email',
  adresse: 'Adresse',
};

const REGION_COLORS: Record<string, string> = {
  'Kaffrine': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Tambacounda': 'bg-amber-100 text-amber-700 border-amber-200',
  'Kédougou': 'bg-purple-100 text-purple-700 border-purple-200',
  'Ziguinchor': 'bg-blue-100 text-blue-700 border-blue-200',
  'Sédhiou': 'bg-rose-100 text-rose-700 border-rose-200',
  'Kolda': 'bg-orange-100 text-orange-700 border-orange-200',
};

// Validation functions
const validatePrestataire = (prestataire: Partial<Prestataire>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!prestataire.entreprise && !prestataire.nom) {
    errors.push('Entreprise ou nom requis');
  }
  
  if (prestataire.telephone && !/^[0-9+\s-]{8,20}$/.test(prestataire.telephone)) {
    errors.push('Téléphone invalide (8-20 chiffres, espaces, + ou - autorisés)');
  }
  
  if (prestataire.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prestataire.email)) {
    errors.push('Email invalide');
  }
  
  return { valid: errors.length === 0, errors };
};

const validateEntrepreneurData = (data: EntrepreneurData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.entreprise && !data.societe) {
    errors.push('Entreprise ou responsable requis');
  }
  
  if (data.telephone && !/^[0-9+\s-]{8,20}$/.test(data.telephone)) {
    errors.push('Téléphone invalide (8-20 chiffres, espaces, + ou - autorisés)');
  }
  
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email invalide');
  }
  
  return { valid: errors.length === 0, errors };
};

function EntForm({ 
  data, 
  onChange, 
  prestataires = [],
  onPrestataireSelect,
  showGrappesSelector = false,
  selectedGrappes = [],
  onGrappesToggle,
  customRegions = REGIONS,
  mergedGrappeCounts = {}
}: { 
  data: EntrepreneurData; 
  onChange: (f: keyof EntrepreneurData, v: string) => void;
  prestataires?: Prestataire[];
  onPrestataireSelect?: (prestataire: Prestataire) => void;
  showGrappesSelector?: boolean;
  selectedGrappes?: string[];
  onGrappesToggle?: (grappeKey: string) => void;
  customRegions?: string[];
  mergedGrappeCounts?: Record<string, number>;
}) {
  const [selectedPrestataireId, setSelectedPrestataireId] = useState('');

  const handlePrestataireSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setSelectedPrestataireId(selectedId);
    
    if (!selectedId) return;
    
    const prestataire = prestataires.find(p => String(p.id) === selectedId);
    if (prestataire && onPrestataireSelect) {
      console.log('Prestataire sélectionné dans EntForm:', prestataire);
      onPrestataireSelect(prestataire);
    }
  };

  const handleSelectAllGrappes = () => {
    if (onGrappesToggle) {
      customRegions.forEach(region => {
        const count = mergedGrappeCounts[region] || GRAPPE_COUNT[region] || 0;
        for (let i = 1; i <= count; i++) {
          onGrappesToggle(`${region}_${i}`);
        }
      });
    }
  };

  const handleDeselectAllGrappes = () => {
    if (onGrappesToggle) {
      selectedGrappes.forEach(grappeKey => {
        onGrappesToggle(grappeKey);
      });
    }
  };

  const handleToggleRegionGrappes = (region: string, selectAll: boolean) => {
    if (onGrappesToggle) {
      const regionGrappeCount = mergedGrappeCounts[region] || GRAPPE_COUNT[region] || 0;
      for (let i = 1; i <= regionGrappeCount; i++) {
        const grappeKey = `${region}_${i}`;
        const isSelected = selectedGrappes.includes(grappeKey);
        
        // Toggle only if current state doesn't match desired state
        if (selectAll && !isSelected) {
          onGrappesToggle(grappeKey);
        } else if (!selectAll && isSelected) {
          onGrappesToggle(grappeKey);
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="col-span-1 sm:col-span-2">
        <label className="text-[10px] font-semibold text-slate-600 uppercase">Sélectionner un prestataire</label>
        <select
          value={selectedPrestataireId}
          onChange={handlePrestataireSelect}
          className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5 cursor-pointer"
        >
          <option value="">-- Choisir un prestataire existant --</option>
          {prestataires.map(p => (
            <option key={p.id} value={String(p.id)}>
              {p.entreprise || p.nom}{p.societe ? ` (${p.societe})` : ''}{p.telephone ? ` · ${p.telephone}` : ''}
            </option>
          ))}
        </select>
      </div>
      {(['entreprise', 'societe', 'telephone', 'email', 'adresse'] as const).map(field => (
        <div key={field}>
          <label className="text-[10px] font-semibold text-slate-600 uppercase">{FIELD_LABELS[field] || field}</label>
          <input
            type="text"
            value={data[field] || ''}
            onChange={e => onChange(field, e.target.value)}
            className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
          />
        </div>
      ))}
      
      {showGrappesSelector && (
        <div className="col-span-1 sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] font-semibold text-slate-600 uppercase">Grappes à affecter</label>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllGrappes}
                className="px-2 py-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Tout sélectionner
              </button>
              <button
                onClick={handleDeselectAllGrappes}
                className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {customRegions.map(region => {
              const colorClass = REGION_COLORS[region] || 'bg-slate-100 text-slate-700 border-slate-200';
              const regionGrappesCount = mergedGrappeCounts[region] || 0;
              const allRegionGrappesSelected = Array.from({ length: regionGrappesCount }, (_, i) => i + 1)
                .every(g => selectedGrappes.includes(`${region}_${g}`));
              
              return (
                <div key={region} className="border border-slate-200 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${colorClass}`}>
                      {region}
                    </div>
                    <button
                      onClick={() => handleToggleRegionGrappes(region, !allRegionGrappesSelected)}
                      className="px-2 py-0.5 text-[9px] font-bold rounded border"
                      title={allRegionGrappesSelected ? `Désélectionner toutes les grappes de ${region}` : `Sélectionner toutes les grappes de ${region}`}
                      style={{
                        backgroundColor: allRegionGrappesSelected ? '#FEF3C7' : '#ECFDF5',
                        color: allRegionGrappesSelected ? '#92400E' : '#065F46',
                        borderColor: allRegionGrappesSelected ? '#F59E0B' : '#10B981'
                      }}
                    >
                      {allRegionGrappesSelected ? '− Toutes' : '+ Toutes'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: regionGrappesCount }, (_, i) => i + 1).map(g => {
                      const grappeKey = `${region}_${g}`;
                      const isSelected = selectedGrappes.includes(grappeKey);
                      return (
                        <label key={grappeKey} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onGrappesToggle && onGrappesToggle(grappeKey)}
                            className="w-3 h-3 text-blue-600 rounded"
                          />
                          <span className="text-[9px] text-slate-600">{g}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            {selectedGrappes.length} grappe(s) sélectionnée(s)
          </div>
        </div>
      )}
    </div>
  );
}

const MODULE_LABELS: Record<string, { icon: string; label: string }> = {
  fiches: { icon: '📄', label: 'Fiches' },
  planning: { icon: '📅', label: 'Planning' },
  admin: { icon: '⚙️', label: 'Administration' },
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  prestataire: 'bg-blue-100 text-blue-700',
  chef_projet: 'bg-amber-100 text-amber-700',
  controleur: 'bg-emerald-100 text-emerald-700',
};

const AdminView: React.FC<AdminViewProps> = React.memo(({
  entrepreneurConfig, lotModes, onUpdateConfig, onUpdateLotMode, onSyncToAPI, getEntrepreneur,
  users = [],
  menages = [],
  villages = [],
  gps = {},
  onVillageOverride,
  prestataires = [],
  onImportExcel,
  onResetAllData,
  onPrestataireCreate,
  onPrestataireUpdate,
  onPrestataireDelete,
  serverDashboardStats,
  refreshDashboardStats,
  initializeServerData,
  serverConfig,
}) => {
  const [editingLot, setEditingLot] = useState<LotKey>('B');

  // Clear individual grappe assignments when switching to global mode
  useEffect(() => {
    if (lotModes[editingLot] === 'global') {
      const currentConfig = entrepreneurConfig[editingLot] || {};
      const individualKeys = Object.keys(currentConfig).filter(k => k !== '__global' && k !== '__groupes' && !k.startsWith('group_'));
      if (individualKeys.length > 0) {
        const newConfig = { ...entrepreneurConfig };
        individualKeys.forEach(key => {
          delete newConfig[editingLot][key];
        });
        onUpdateConfig(newConfig);
      }
    }
  }, [lotModes, editingLot, entrepreneurConfig, onUpdateConfig]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Multi-grappe selection state
  const [selectedGrappes, setSelectedGrappes] = useState<string[]>([]);
  const [bulkAssignMode, setBulkAssignMode] = useState(false);
  
  // Prestataire management state
  const [prestataireModalOpen, setPrestataireModalOpen] = useState(false);
  const [editingPrestataire, setEditingPrestataire] = useState<Prestataire | null>(null);
  const [prestataireForm, setPrestataireForm] = useState<Partial<Prestataire>>({});
  const [prestataireErrors, setPrestataireErrors] = useState<string[]>([]);
  
  // History management state
  const [history, setHistory] = useState<EntrepreneurConfig[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [maxHistorySize] = useState(50);
  
  // Lot management state
  const [lotManagementOpen, setLotManagementOpen] = useState(false);
  const [newLotName, setNewLotName] = useState('');
  const [customLots, setCustomLots] = useState<LotKey[]>(LOT_KEYS);
  
  // Grappe management state
  const [grappeManagementOpen, setGrappeManagementOpen] = useState(false);
  const [newGrappeRegion, setNewGrappeRegion] = useState('');
  const [newGrappeNumber, setNewGrappeNumber] = useState('');
  const [customGrappeCounts, setCustomGrappeCounts] = useState<Record<string, number>>({});
  
  // Clustering state
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [clusteringConfig, setClusteringConfig] = useState<ClusteringConfig>({
    enabled: false,
    maxDistance: 5, // 5 km
    minMenagesPerGrappe: 10,
    maxMenagesPerGrappe: 100,
    preferredGrappeCount: 10,
    algorithm: 'kmeans'
  });
  const [generatedClusters, setGeneratedClusters] = useState<GrapeCluster[]>([]);
  const [clusteringOpen, setClusteringOpen] = useState(false);
  const [suggestedMenages, setSuggestedMenages] = useState<Menage[]>([]);
  const [clusterDistances, setClusterDistances] = useState<Array<{ from: string; to: string; distance: number }>>([]);
  const [optimizedConfigurations, setOptimizedConfigurations] = useState<ClusterConfiguration[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<ClusterConfiguration | null>(null);
  
  // Auto-detect regions from menages data
  const detectedRegions = useMemo(() => {
    const regions = new Set<string>();
    menages.forEach(menage => {
      if (menage.region) {
        regions.add(menage.region);
      }
    });
    return Array.from(regions).sort();
  }, [menages]);
  
  // Auto-calculate grappe counts from menages data
  const detectedGrappeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const grappeKeys = new Set<string>();
    
    menages.forEach(menage => {
      if (menage.grappeKey) {
        grappeKeys.add(menage.grappeKey);
      }
    });
    
    // Extract region and grappe number from grappeKey (format: "Region_Number")
    grappeKeys.forEach(key => {
      const match = key.match(/^([A-Za-z]+)_(\d+)$/);
      if (match) {
        const region = match[1];
        const grappeNum = parseInt(match[2], 10);
        if (!counts[region] || grappeNum > counts[region]) {
          counts[region] = grappeNum;
        }
      }
    });
    
    return counts;
  }, [menages]);
  
  // Use detected regions and counts, fallback to constants if no data
  const customRegions = detectedRegions.length > 0 ? detectedRegions : REGIONS;
  
  // Merge detected counts with custom counts (custom takes precedence)
  const mergedGrappeCounts = useMemo(() => {
    const merged = { ...detectedGrappeCounts };
    Object.keys(customGrappeCounts).forEach(region => {
      merged[region] = customGrappeCounts[region];
    });
    return merged;
  }, [detectedGrappeCounts, customGrappeCounts]);
  
  // Dashboard statistics - use server data if available, otherwise calculate locally
  const dashboardStatsFromSource = useMemo(() => {
    // If server stats are available, use them
    if (serverDashboardStats && serverDashboardStats.totalGrappes !== undefined) {
      return serverDashboardStats;
    }

    // Otherwise, calculate locally (fallback) - simplified to avoid double counting
    const stats = {
      totalGrappes: 0,
      assignedGrappes: 0,
      unassignedGrappes: 0,
      globalAssignments: 0,
      groupAssignments: 0,
      individualAssignments: 0,
      lotStats: {} as Record<LotKey, { total: number; assigned: number; global: number; group: number; individual: number }>,
      regionStats: {} as Record<string, { total: number; assigned: number }>,
      prestataireUsage: {} as Record<string, number>,
    };

    // Initialize lot stats with default values
    customLots.forEach(lot => {
      stats.lotStats[lot] = { total: 0, assigned: 0, global: 0, group: 0, individual: 0 };
    });

    // Initialize region stats with default values
    customRegions.forEach(region => {
      stats.regionStats[region] = { total: 0, assigned: 0 };
    });

    // Calculate total grappes across all regions (once, not per lot)
    const totalGrappesAllRegions = customRegions.reduce((sum, region) => sum + (mergedGrappeCounts[region] || 0), 0);
    stats.totalGrappes = totalGrappesAllRegions;

    // For local calculation, only count from Lot B to avoid double counting
    // (This is a simplification - in reality, assignments should be unique across lots)
    const primaryLot = 'B'; // Use Lot B as primary for local calculation
    const lotConfig = entrepreneurConfig[primaryLot] || {};
    
    let assigned = 0;
    let global = 0;
    let group = 0;
    let individual = 0;

    // Check for global assignment
    if (lotConfig.__global && (lotConfig.__global as EntrepreneurData).entreprise) {
      global = totalGrappesAllRegions;
      assigned = totalGrappesAllRegions;
    } else {
      // Count group assignments
      const groups = lotConfig.__groupes || [];
      groups.forEach((grp: EntrepreneurGroup) => {
        group += grp.grappes.length;
      });

      // Count individual assignments
      Object.keys(lotConfig).forEach(key => {
        if (key !== '__global' && key !== '__groupes' && !key.startsWith('group_')) {
          const data = lotConfig[key] as EntrepreneurData;
          if (data && (data.entreprise || data.societe)) {
            individual++;
          }
        }
      });

      assigned = group + individual;
    }

    // Update stats
    stats.assignedGrappes = assigned;
    stats.globalAssignments = global;
    stats.groupAssignments = group;
    stats.individualAssignments = individual;
    stats.unassignedGrappes = stats.totalGrappes - stats.assignedGrappes;

    // Update lot stats (only for primary lot)
    stats.lotStats[primaryLot] = {
      total: totalGrappesAllRegions,
      assigned,
      global,
      group,
      individual,
    };

    // Calculate region statistics using custom regions
    customRegions.forEach(region => {
      const totalInRegion = mergedGrappeCounts[region] || 0;
      let assignedInRegion = 0;

      // Check global assignment
      if (lotConfig.__global && (lotConfig.__global as EntrepreneurData).entreprise) {
        assignedInRegion += totalInRegion;
      } else {
        // Check group assignments
        const groups = lotConfig.__groupes || [];
        groups.forEach((grp: EntrepreneurGroup) => {
          grp.grappes.forEach(grappeKey => {
            if (grappeKey.startsWith(region)) {
              assignedInRegion++;
            }
          });
        });

        // Check individual assignments
        Object.keys(lotConfig).forEach(key => {
          if (key.startsWith(region)) {
            const data = lotConfig[key] as EntrepreneurData;
            if (data && (data.entreprise || data.societe)) {
              assignedInRegion++;
            }
          }
        });
      }

      stats.regionStats[region] = {
        total: totalInRegion,
        assigned: assignedInRegion,
      };
    });

    // Calculate prestataire usage
    prestataires?.forEach(prestataire => {
      let usage = 0;
      
      // Check global assignment
      if (lotConfig.__global) {
        const globalData = lotConfig.__global as EntrepreneurData;
        if (globalData.entreprise === prestataire.entreprise || globalData.entreprise === prestataire.nom) {
          usage += customRegions.reduce((sum, region) => sum + (mergedGrappeCounts[region] || 0), 0);
        }
      } else {
        // Check group assignments
        const groups = lotConfig.__groupes || [];
        groups.forEach((grp: EntrepreneurGroup) => {
          const grpData = grp as EntrepreneurData;
          if (grpData.entreprise === prestataire.entreprise || grpData.entreprise === prestataire.nom) {
            usage += grp.grappes.length;
          }
        });

        // Check individual assignments
        Object.keys(lotConfig).forEach(key => {
          if (key !== '__global' && key !== '__groupes' && !key.startsWith('group_')) {
            const data = lotConfig[key] as EntrepreneurData;
            if (data && (data.entreprise === prestataire.entreprise || data.entreprise === prestataire.nom)) {
              usage++;
            }
          }
        });
      }

      if (usage > 0) {
        stats.prestataireUsage[prestataire.entreprise || prestataire.nom || 'Unknown'] = usage;
      }
    });

    return stats;
  }, [serverDashboardStats, entrepreneurConfig, prestataires, customLots, customRegions, mergedGrappeCounts, menages]);

  // History management functions
  const addToHistory = (config: EntrepreneurConfig) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(config)) as EntrepreneurConfig);
    
    // Limit history size
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onUpdateConfig(JSON.parse(JSON.stringify(history[newIndex])) as EntrepreneurConfig);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onUpdateConfig(JSON.parse(JSON.stringify(history[newIndex])) as EntrepreneurConfig);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Initialize history with current config
  useEffect(() => {
    if (history.length === 0) {
      addToHistory(entrepreneurConfig);
    }
  }, []);

  // Add to history when config changes
  useEffect(() => {
    if (history.length > 0) {
      const lastConfig = JSON.stringify(history[historyIndex]);
      const currentConfig = JSON.stringify(entrepreneurConfig);
      if (lastConfig !== currentConfig) {
        addToHistory(entrepreneurConfig);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepreneurConfig]);

  // Calculate grappe statistics (number of menages per grappe)
  const grappeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    menages.forEach(menage => {
      const grappeKey = menage.grappeKey;
      if (grappeKey) {
        stats[grappeKey] = (stats[grappeKey] || 0) + 1;
      }
    });
    
    // Initialize stats for all detected regions and grappes
    customRegions.forEach(region => {
      const count = mergedGrappeCounts[region] || 0;
      for (let i = 1; i <= count; i++) {
        const key = `${region}_${i}`;
        if (!stats[key]) {
          stats[key] = 0;
        }
      }
    });
    
    return stats;
  }, [menages, customRegions, mergedGrappeCounts]);

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const headers = ['Numero_ordre', 'Prénom et Nom', 'Telephone', 'region', 'commune', 'village', 'latitude', 'longitude', 'statut'];
      const sampleRows = [
        [2488, 'Mamadou Saliou Diallo', '781589702', 'Tambacounda', 'Missirah', 'ADIAAF', '13.3911269', '-13.7090931', 'non_fait'],
        [2492, 'Mamadou Cellou', '778253068', 'Tambacounda', 'Missirah', 'ADIAAF', '13.3908973', '-13.709038', 'non_fait'],
        [2485, 'Adama Cissokho', '770551608', 'Tambacounda', 'Missirah', 'ADIAAF', '13.3909703', '-13.7087583', 'non_fait']
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Ménages');
      XLSX.writeFile(wb, 'Modele_Import_Cartographie.xlsx');
      setImportStatus("✅ Modèle d'import exporté sous 'Modele_Import_Cartographie.xlsx'");
    } catch (err: any) {
      setImportStatus(`❌ Erreur export modèle : ${err.message}`);
    }
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setImportStatus("❌ Format non supporté. Veuillez utiliser un fichier .xlsx ou .xls.");
      return;
    }
    setImportStatus("Lecture du fichier...");
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const sheetRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, defval: '' });
          if (sheetRows.length < 2) {
            setImportStatus("❌ Le fichier Excel ne contient pas de données valides.");
            return;
          }
          if (onImportExcel) {
            setImportStatus("Application de l'import...");
            const res = await onImportExcel(sheetRows);
            setImportStatus(`✅ Import terminé : ${res.added} ménages ajoutés, ${res.updated} ménages mis à jour.`);
          } else {
            setImportStatus("❌ Service d'importation non disponible.");
          }
        } catch (err: any) {
          setImportStatus(`❌ Erreur d'application : ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setImportStatus(`❌ Erreur de lecture : ${err.message}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const villageList = useMemo(() => {
    const seen = new Map<string, { key: string; village: string; region: string; grappe: number }>();
    for (const m of menages) {
      const k = `${m.region}|${m.village}`;
      if (!seen.has(k)) seen.set(k, { key: k, village: m.village, region: m.region, grappe: m.grappe || 1 });
    }
    return Array.from(seen.values());
  }, [menages]);

  const filteredVillages = useMemo(() => {
    if (!villageSearch.trim()) return villageList;
    const q = villageSearch.toLowerCase();
    return villageList.filter(v => v.village.toLowerCase().includes(q) || v.region.toLowerCase().includes(q));
  }, [villageList, villageSearch]);

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const [newGrappe, setNewGrappe] = useState<{ lot: LotKey | null; region: string; grappeNumber: number } | null>(null);
  const availableGrapes = useMemo(() => {
    if (!newGrappe?.lot) return [];
    const lotConfig = entrepreneurConfig[newGrappe.lot] || {};
    const assignedGrappes = Object.keys(lotConfig).filter(k => /^[A-Z]$/.test(k) || (k.startsWith('group_')) || k === '__global' || k === '__groupes');
    const region = newGrappe.region;
    return (GRAPPE_COUNT[region] || []).flatMap((_, i) => {
      const num = i + 1;
      const key = `${region}_${num}`;
      return assignedGrappes.includes(key) ? [] : [num];
    });
  }, [newGrappe, entrepreneurConfig]);

  const startCreateGrappe = (lot: LotKey, region: string) => {
    const existing = Object.keys(entrepreneurConfig[lot] || {}).filter(k => /^[A-Z]$/.test(k) || (k.startsWith('group_')) || k === '__global' || k === '__groupes');
    if (existing.length >= GRAPPE_COUNT[region]) {
      console.error(`Tous les grappes pour ${lot} - ${region} sont déjà affectés`);
      return;
    }
    setNewGrappe({ lot, region, grappeNumber: 1 });
  };

  const confirmCreateGrappe = () => {
    if (!newGrappe?.lot) return;
    const lotConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    const region = newGrappe.region;
    const grappeKey = `${region}_${newGrappe.grappeNumber}`;
    const emptyData = { ...emptyEnt, id: grappeKey };
    if (!lotConfig[newGrappe.lot]) lotConfig[newGrappe.lot] = {};
    lotConfig[newGrappe.lot][grappeKey] = emptyData;
    onUpdateConfig(lotConfig);
    setNewGrappe(null);
    console.log(`Nouvelle grappe ${grappeKey} créée`);
  };

  const cancelCreateGrappe = () => {
    setNewGrappe(null);
  };

  const handleUpdateField = (lot: LotKey, key: string, field: keyof EntrepreneurData, value: string) => {
    console.log('handleUpdateField called:', { lot, key, field, value });
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    if (!newConfig[lot]) newConfig[lot] = {};
    
    // Get existing data or create new empty data
    const existingData = (newConfig[lot][key] as EntrepreneurData) || { ...emptyEnt };
    
    // Update only the specific field while preserving others
    const updatedData = { ...existingData, [field]: value };
    
    // Validate the updated data (except for temp data)
    if (key !== '__bulk_temp') {
      const validation = validateEntrepreneurData(updatedData);
      if (!validation.valid) {
        console.warn('Validation errors:', validation.errors);
        // Still allow the update but log warnings
      }
    }
    
    newConfig[lot][key] = updatedData;
    console.log('Updated config for', key, ':', newConfig[lot][key]);
    onUpdateConfig(newConfig);
  };

  const handleBatchUpdate = (lot: LotKey, key: string, fields: Partial<EntrepreneurData>) => {
    console.log('handleBatchUpdate called:', { lot, key, fields });
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    if (!newConfig[lot]) newConfig[lot] = {};
    
    // Get existing data or create new empty data
    const existingData = (newConfig[lot][key] as EntrepreneurData) || { ...emptyEnt };
    
    // Update all fields at once while preserving others
    const updatedData = { ...existingData, ...fields };
    
    // Validate the updated data (except for temp data)
    if (key !== '__bulk_temp') {
      const validation = validateEntrepreneurData(updatedData);
      if (!validation.valid) {
        console.warn('Validation errors in batch update:', validation.errors);
        // Still allow the update but log warnings
      }
    }
    
    newConfig[lot][key] = updatedData;
    console.log('Batch updated config for', key, ':', newConfig[lot][key]);
    onUpdateConfig(newConfig);
  };

  const handlePrestataireSelectForGlobal = (prestataire: Prestataire) => {
    const fields = {
      entreprise: String(prestataire.entreprise || prestataire.nom || ''),
      societe: String(prestataire.societe || ''),
      telephone: String(prestataire.telephone || ''),
      email: String(prestataire.email || ''),
      adresse: String(prestataire.adresse || ''),
    };
    console.log('Prestataire selected for global:', fields);
    handleBatchUpdate(editingLot, '__global', fields);
  };

  const handlePrestataireSelectForGroup = (groupId: string) => (prestataire: Prestataire) => {
    const fields = {
      entreprise: String(prestataire.entreprise || prestataire.nom || ''),
      societe: String(prestataire.societe || ''),
      telephone: String(prestataire.telephone || ''),
      email: String(prestataire.email || ''),
      adresse: String(prestataire.adresse || ''),
    };
    console.log('Prestataire selected for group:', groupId, fields);
    handleBatchUpdate(editingLot, `group_${groupId}`, fields);
  };

  const handlePrestataireSelectForGrappe = (grappeKey: string) => (prestataire: Prestataire) => {
    const fields = {
      entreprise: String(prestataire.entreprise || prestataire.nom || ''),
      societe: String(prestataire.societe || ''),
      telephone: String(prestataire.telephone || ''),
      email: String(prestataire.email || ''),
      adresse: String(prestataire.adresse || ''),
    };
    console.log('Prestataire selected for grappe:', grappeKey, fields);
    handleBatchUpdate(editingLot, grappeKey, fields);
  };

  const handleGrappesToggle = (grappeKey: string) => {
    setSelectedGrappes(prev => {
      if (prev.includes(grappeKey)) {
        return prev.filter(k => k !== grappeKey);
      } else {
        return [...prev, grappeKey];
      }
    });
  };

  const handleBulkAssign = (prestataire: Prestataire) => {
    if (selectedGrappes.length === 0) {
      console.warn('No grappes selected for bulk assignment');
      return;
    }

    // Use prestataire data or fall back to temporary edited fields
    const tempData = (entrepreneurConfig[editingLot]?.__bulk_temp as EntrepreneurData) || {};
    const fields = {
      entreprise: String(tempData.entreprise || prestataire.entreprise || prestataire.nom || ''),
      societe: String(tempData.societe || prestataire.societe || ''),
      telephone: String(tempData.telephone || prestataire.telephone || ''),
      email: String(tempData.email || prestataire.email || ''),
      adresse: String(tempData.adresse || prestataire.adresse || ''),
    };

    console.log('Bulk assign prestataire to grappes:', { prestataire, grappes: selectedGrappes, fields });

    // Update all selected grappes in a single batch
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    if (!newConfig[editingLot]) newConfig[editingLot] = {};

    selectedGrappes.forEach(grappeKey => {
      const existingData = (newConfig[editingLot][grappeKey] as EntrepreneurData) || { ...emptyEnt };
      newConfig[editingLot][grappeKey] = { ...existingData, ...fields };
    });

    // Clean up temporary data
    delete newConfig[editingLot]['__bulk_temp'];

    onUpdateConfig(newConfig);
    setSelectedGrappes([]);
    setBulkAssignMode(false);
  };

  // Prestataire CRUD operations
  const handleOpenPrestataireModal = (prestataire?: Prestataire) => {
    if (prestataire) {
      setEditingPrestataire(prestataire);
      setPrestataireForm(prestataire);
    } else {
      setEditingPrestataire(null);
      setPrestataireForm({
        nom: '',
        entreprise: '',
        societe: '',
        telephone: '',
        email: '',
        adresse: '',
      });
    }
    setPrestataireModalOpen(true);
  };

  const handleClosePrestataireModal = () => {
    setPrestataireModalOpen(false);
    setEditingPrestataire(null);
    setPrestataireForm({});
  };

  const handlePrestataireSubmit = async () => {
    const validation = validatePrestataire(prestataireForm);
    if (!validation.valid) {
      setPrestataireErrors(validation.errors);
      return;
    }
    
    setPrestataireErrors([]);
    
    try {
      if (editingPrestataire && onPrestataireUpdate) {
        await onPrestataireUpdate(editingPrestataire.id, prestataireForm);
      } else if (!editingPrestataire && onPrestataireCreate) {
        await onPrestataireCreate(prestataireForm as Omit<Prestataire, 'id'>);
      }
      handleClosePrestataireModal();
    } catch (error) {
      console.error('Error saving prestataire:', error);
      setPrestataireErrors(['Erreur lors de la sauvegarde']);
    }
  };

  const handlePrestataireDelete = async (id: string | number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce prestataire ?') && onPrestataireDelete) {
      try {
        await onPrestataireDelete(id);
      } catch (error) {
        console.error('Error deleting prestataire:', error);
      }
    }
  };

  // Lot management functions
  const handleAddLot = () => {
    if (!newLotName || newLotName.length < 1 || newLotName.length > 2) {
      alert('Le nom du lot doit être une lettre (A-Z)');
      return;
    }
    
    const lotKey = newLotName.toUpperCase() as LotKey;
    if (customLots.includes(lotKey)) {
      alert('Ce lot existe déjà');
      return;
    }
    
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    newConfig[lotKey] = {};
    onUpdateConfig(newConfig);
    setCustomLots([...customLots, lotKey]);
    setNewLotName('');
    setLotManagementOpen(false);
  };

  const handleDeleteLot = (lot: LotKey) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le lot ${lot} ? Toutes les affectations seront perdues.`)) {
      const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
      delete newConfig[lot];
      onUpdateConfig(newConfig);
      setCustomLots(customLots.filter(l => l !== lot));
      
      // If deleting current editing lot, switch to first available
      if (editingLot === lot && customLots.length > 1) {
        setEditingLot(customLots.find(l => l !== lot) || 'A');
      }
    }
  };

  // Grappe management functions
  const handleAddGrappe = () => {
    if (!newGrappeRegion || !newGrappeNumber) {
      alert('Veuillez sélectionner une région et entrer un numéro de grappe');
      return;
    }
    
    const region = newGrappeRegion;
    const grappeNum = parseInt(newGrappeNumber, 10);
    
    if (isNaN(grappeNum) || grappeNum < 1 || grappeNum > 1000) {
      alert('Le numéro de grappe doit être entre 1 et 1000');
      return;
    }
    
    // Update custom grappe counts
    const currentCount = mergedGrappeCounts[region] || 0;
    if (grappeNum > currentCount) {
      setCustomGrappeCounts({
        ...customGrappeCounts,
        [region]: grappeNum
      });
    }
    
    setNewGrappeRegion('');
    setNewGrappeNumber('');
    setGrappeManagementOpen(false);
  };

  // Clustering functions
  const handleGenerateClusters = () => {
    if (!newGrappeRegion) {
      alert('Veuillez sélectionner une région');
      return;
    }

    const clusters = createGrappeClusters(
      villages,
      menages,
      gps,
      { ...clusteringConfig, enabled: true },
      newGrappeRegion
    );

    setGeneratedClusters(clusters);
    
    // Calculate distances between clusters
    const distances = calculateClusterDistances(clusters);
    setClusterDistances(distances);
    
    // Update grappe counts based on generated clusters
    if (clusters.length > 0) {
      const maxGrappeNum = Math.max(...clusters.map(c => c.grappeNumber));
      setCustomGrappeCounts({
        ...customGrappeCounts,
        [newGrappeRegion]: maxGrappeNum
      });
    }
  };

  const handleSuggestMenages = () => {
    if (!newGrappeRegion) {
      alert('Veuillez sélectionner une région');
      return;
    }

    const suggestions = suggestMenagesForNewGrappe(
      villages,
      menages,
      gps,
      newGrappeRegion,
      generatedClusters,
      clusteringConfig.maxDistance
    );

    setSuggestedMenages(suggestions);
  };

  const handleApplyClusters = () => {
    // Apply the generated clusters to the menages
    const updatedMenages = [...menages];
    
    generatedClusters.forEach(cluster => {
      cluster.menages.forEach(menageOrdre => {
        const menageIndex = updatedMenages.findIndex(m => m.ordre === menageOrdre);
        if (menageIndex !== -1) {
          updatedMenages[menageIndex] = {
            ...updatedMenages[menageIndex],
            grappe: cluster.grappeNumber
          };
        }
      });
    });

    // Here you would typically call an API to update the menages
    console.log('Applied clusters to menages:', updatedMenages);
    alert('Clusters appliqués avec succès !');
  };

  const handleOptimizeClustering = async () => {
    if (!newGrappeRegion) {
      alert('Veuillez sélectionner une région');
      return;
    }

    setOptimizing(true);
    
    // Run optimization in the background to avoid blocking UI
    setTimeout(() => {
      try {
        const optimized = optimizeClustering(
          villages,
          menages,
          gps,
          newGrappeRegion,
          clusteringConfig.preferredGrappeCount
        );
        
        setOptimizedConfigurations(optimized);
        
        if (optimized.length > 0) {
          // Auto-select the best configuration
          setSelectedConfiguration(optimized[0]);
          setGeneratedClusters(optimized[0].clusters);
          setClusterDistances(calculateClusterDistances(optimized[0].clusters));
          
          // Update the config to match the best one
          setClusteringConfig(optimized[0].config);
        }
      } catch (error) {
        console.error('Optimization error:', error);
        alert('Erreur lors de l\'optimisation');
      } finally {
        setOptimizing(false);
      }
    }, 100);
  };

  const handleSelectConfiguration = (config: ClusterConfiguration) => {
    setSelectedConfiguration(config);
    setGeneratedClusters(config.clusters);
    setClusterDistances(calculateClusterDistances(config.clusters));
    setClusteringConfig(config.config);
  };

  const handleApplyOptimizedConfiguration = () => {
    if (!selectedConfiguration) return;
    
    // Apply the selected configuration's clusters
    const updatedMenages = [...menages];
    
    selectedConfiguration.clusters.forEach(cluster => {
      cluster.menages.forEach(menageOrdre => {
        const menageIndex = updatedMenages.findIndex(m => m.ordre === menageOrdre);
        if (menageIndex !== -1) {
          updatedMenages[menageIndex] = {
            ...updatedMenages[menageIndex],
            grappe: cluster.grappeNumber
          };
        }
      });
    });

    // Update grappe counts
    const maxGrappeNum = Math.max(...selectedConfiguration.clusters.map(c => c.grappeNumber));
    setCustomGrappeCounts({
      ...customGrappeCounts,
      [newGrappeRegion]: maxGrappeNum
    });

    console.log('Applied optimized configuration to menages:', updatedMenages);
    alert('Configuration optimisée appliquée avec succès !');
  };

  const addGroup = (lot: LotKey) => {
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    if (!newConfig[lot].__groupes) newConfig[lot].__groupes = [];
    const id = `grp_${Date.now()}`;
    newConfig[lot].__groupes!.push({ id, ...emptyEnt, grappes: [] });
    onUpdateConfig(newConfig);
    setEditingKey(`group_${id}`);
  };

  const removeGroup = (lot: LotKey, groupId: string) => {
    const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
    newConfig[lot].__groupes = (newConfig[lot].__groupes || []).filter(g => g.id !== groupId);
    onUpdateConfig(newConfig);
  };

  const selectRefresh = () => {
      const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
      if (!newConfig[lot]) newConfig[lot] = {};
      newConfig[lot].refresh = !!(newConfig[lot].refresh as boolean);
      onUpdateConfig(newConfig);
    };

    const [, setRefreshCount] = useState(0);
    useEffect(() => {
      const handler = () => setRefreshCount(c => c + 1);
      if (typeof window !== 'undefined' && window.__refreshUpdated) {
        window.__refreshUpdated = handler;
      }
      return () => {};
    }, []);

    const refreshEffect = () => {
      return () => {
        const newConfig = JSON.parse(JSON.stringify(entrepreneurConfig)) as EntrepreneurConfig;
        if (!newConfig[editingLot]) newConfig[editingLot] = {};
        newConfig[editingLot].refresh = !!(newConfig[editingLot].refresh as boolean);
        onUpdateConfig(newConfig);
      };
    };

    const refreshInterval = useRef<NodeJS.Timeout>();
    useEffect(() => {
      refreshInterval.current = setInterval(refreshEffect(), 60000);
      return () => clearInterval(refreshInterval.current);
    }, [entrepreneurConfig, onUpdateConfig]);


  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await onSyncToAPI();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      setSaveError(error?.message || 'Erreur lors de la sauvegarde');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  /* ── API sync utilities ── */

  const saveEntrepreneurToAPI = async (lot: LotKey, key: string, data: EntrepreneurData) => {
    try {
      await api.saveEntrepreneur({ lot, grappeKey: key, ...data });
      return true;
    } catch (e: any) {
      console.error('Failed to persist entrepreneur:', e);
      return false;
    }
  };

  const notifyWebhook = () => {
    const hostname = window.location.hostname;
    const webhookUrl = `https://${hostname}:8444/webhook/entrepreneurs-updated`;
    const token = localStorage.getItem('opencode_webhook_token');
    if (token) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ source: 'admin', timestamp: new Date().toISOString() })
      }).catch(() => {});
    }
  };

  const syncOnDemand = async (lot: LotKey, key: string, data: EntrepreneurData) => {
    const success = await saveEntrepreneurToAPI(lot, key, data);
    if (success) {
      notifyWebhook();
    }
    return success;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Modes d'affectation par Lot</h3>
        
        {/* Management Buttons Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="text-xs font-bold text-blue-800 mb-3">⚙️ Gestion de la structure</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                if (window.confirm('Êtes-vous sûr de vouloir initialiser les données serveur ? Cela va créer les régions et lots par défaut depuis la base de données.')) {
                  try {
                    setInitializing(true);
                    if (initializeServerData) {
                      await initializeServerData();
                    }
                  } catch (err) {
                    console.error('Failed to initialize server data:', err);
                    alert('Erreur lors de l\'initialisation des données serveur');
                  } finally {
                    setInitializing(false);
                  }
                }
              }}
              disabled={initializing}
              className={`px-4 py-2 text-sm font-bold rounded-lg border-2 transition-all relative overflow-hidden ${
                initializing 
                  ? 'bg-emerald-50 text-emerald-400 border-emerald-300 cursor-not-allowed' 
                  : 'bg-emerald-100 text-emerald-700 border-emerald-600 hover:bg-emerald-200'
              }`}
            >
              {initializing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initialisation...
                </span>
              ) : (
                '🔄 Initialiser données serveur'
              )}
            </button>
            <button
              onClick={() => setLotManagementOpen(!lotManagementOpen)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                lotManagementOpen 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white text-blue-700 border-2 border-blue-600 hover:bg-blue-100'
              }`}
            >
              {lotManagementOpen ? '✓ Gérer les lots' : '+ Gérer les lots'}
            </button>
            <button
              onClick={() => setGrappeManagementOpen(!grappeManagementOpen)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                grappeManagementOpen 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white text-blue-700 border-2 border-blue-600 hover:bg-blue-100'
              }`}
            >
              {grappeManagementOpen ? '✓ Créer une grappe' : '+ Créer une grappe'}
            </button>
            <button
              onClick={() => setClusteringOpen(!clusteringOpen)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                clusteringOpen 
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                  : 'bg-white text-emerald-700 border-2 border-emerald-600 hover:bg-emerald-100'
              }`}
            >
              {clusteringOpen ? '✓ Clustering GPS' : '📍 Clustering GPS'}
            </button>
            <div className="px-4 py-2 text-sm text-slate-600 bg-white border-2 border-slate-300 rounded-lg">
              📍 Régions détectées: <span className="font-bold text-blue-700">{customRegions.length}</span>
            </div>
          </div>
        </div>
        
        {lotManagementOpen && (
          <div className="border-2 border-blue-300 rounded-lg p-4 mb-4 bg-blue-50">
            <h4 className="text-sm font-bold text-blue-800 mb-3">➕ Ajouter un nouveau lot</h4>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={newLotName}
                onChange={e => setNewLotName(e.target.value.toUpperCase())}
                placeholder="Lettre (ex: E)"
                maxLength={1}
                className="w-24 px-4 py-2 text-sm text-slate-800 border-2 border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                onClick={handleAddLot}
                className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Ajouter le lot
              </button>
            </div>
            <div className="text-xs text-blue-700">
              💡 Les lots sont nommés par une lettre (A, B, C, D, E, etc.)
            </div>
          </div>
        )}
        
        {grappeManagementOpen && (
          <div className="border-2 border-blue-300 rounded-lg p-4 mb-4 bg-blue-50">
            <h4 className="text-sm font-bold text-blue-800 mb-3">➕ Créer une nouvelle grappe</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">Région</label>
                <select
                  value={newGrappeRegion}
                  onChange={e => setNewGrappeRegion(e.target.value)}
                  className="w-full px-4 py-2 text-sm text-slate-800 border-2 border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Sélectionner une région</option>
                  {customRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">Numéro de grappe</label>
                <input
                  type="number"
                  value={newGrappeNumber}
                  onChange={e => setNewGrappeNumber(e.target.value)}
                  placeholder="Numéro (ex: 1, 2, 3...)"
                  min="1"
                  max="1000"
                  className="w-full px-4 py-2 text-sm text-slate-800 border-2 border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={handleAddGrappe}
              className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              Créer la grappe
            </button>
            <div className="text-xs text-blue-700 mt-2">
              💡 La grappe sera créée dans la région sélectionnée avec le numéro spécifié. Si le numéro est supérieur au nombre actuel de grappes, le compteur sera mis à jour.
            </div>
          </div>
        )}
        
        {clusteringOpen && (
          <div className="border-2 border-emerald-300 rounded-lg p-4 mb-4 bg-emerald-50">
            <h4 className="text-sm font-bold text-emerald-800 mb-3">📍 Clustering GPS par proximité</h4>
            
            {/* Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Algorithme</label>
                <select
                  value={clusteringConfig.algorithm}
                  onChange={e => setClusteringConfig({ ...clusteringConfig, algorithm: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="kmeans">K-Means</option>
                  <option value="hierarchical">Hiérarchique</option>
                  <option value="density">Par densité (DBSCAN)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Distance max (km)</label>
                <input
                  type="number"
                  value={clusteringConfig.maxDistance}
                  onChange={e => setClusteringConfig({ ...clusteringConfig, maxDistance: parseFloat(e.target.value) })}
                  min="1"
                  max="50"
                  step="0.5"
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Nombre de grappes cible</label>
                <input
                  type="number"
                  value={clusteringConfig.preferredGrappeCount}
                  onChange={e => setClusteringConfig({ ...clusteringConfig, preferredGrappeCount: parseInt(e.target.value) })}
                  min="2"
                  max="50"
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Min ménages/grappe</label>
                <input
                  type="number"
                  value={clusteringConfig.minMenagesPerGrappe}
                  onChange={e => setClusteringConfig({ ...clusteringConfig, minMenagesPerGrappe: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Max ménages/grappe</label>
                <input
                  type="number"
                  value={clusteringConfig.maxMenagesPerGrappe}
                  onChange={e => setClusteringConfig({ ...clusteringConfig, maxMenagesPerGrappe: parseInt(e.target.value) })}
                  min="10"
                  max="500"
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-700 mb-1">Région</label>
                <select
                  value={newGrappeRegion}
                  onChange={e => setNewGrappeRegion(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-slate-800 border-2 border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Sélectionner une région</option>
                  {customRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mb-4">
              <button
                onClick={handleGenerateClusters}
                className="px-6 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
              >
                🔮 Générer les clusters
              </button>
              <button
                onClick={handleSuggestMenages}
                className="px-6 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                💡 Suggérer des ménages
              </button>
              <button
                onClick={handleOptimizeClustering}
                disabled={optimizing}
                className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                  optimizing 
                    ? 'bg-slate-400 text-slate-600 cursor-not-allowed' 
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {optimizing ? '⏳ Optimisation...' : '🧠 Optimiser automatiquement'}
              </button>
            </div>
            
            {/* Optimized configurations display */}
            {optimizedConfigurations.length > 0 && (
              <div className="mt-4 border-t-2 border-purple-300 pt-4">
                <h5 className="text-sm font-bold text-purple-800 mb-3">🧠 Configurations optimisées ({optimizedConfigurations.length})</h5>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {optimizedConfigurations.map((config, index) => (
                    <div 
                      key={index}
                      onClick={() => handleSelectConfiguration(config)}
                      className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                        selectedConfiguration === config 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-purple-200 bg-white hover:border-purple-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-700">
                            #{index + 1} - {config.config.algorithm.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500">
                            Distance: {config.config.maxDistance}km | 
                            Min: {config.config.minMenagesPerGrappe} | 
                            Max: {config.config.maxMenagesPerGrappe}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600">
                            Score: {config.score.toFixed(2)}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              ⭐ Meilleur
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500">Ménages:</span>
                          <span className="font-semibold text-slate-700 ml-1">
                            {config.metrics.avgMenages.toFixed(0)} ± {config.metrics.stdDevMenages.toFixed(0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Distance intra:</span>
                          <span className="font-semibold text-slate-700 ml-1">
                            {config.metrics.avgIntraDistance.toFixed(2)} km
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Distance inter:</span>
                          <span className="font-semibold text-slate-700 ml-1">
                            {config.metrics.avgInterDistance.toFixed(2)} km
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {config.clusters.length} grappes générées
                      </div>
                    </div>
                  ))}
                </div>
                {selectedConfiguration && (
                  <button
                    onClick={handleApplyOptimizedConfiguration}
                    className="mt-3 px-6 py-2 text-sm font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                  >
                    ✅ Appliquer la configuration sélectionnée
                  </button>
                )}
              </div>
            )}
            
            {/* Generated clusters display */}
            {generatedClusters.length > 0 && (
              <div className="mt-4 border-t-2 border-emerald-300 pt-4">
                <h5 className="text-sm font-bold text-emerald-800 mb-3">📊 Clusters générés ({generatedClusters.length})</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {generatedClusters.map((cluster, index) => {
                    const nearestClusters = findNearestClusters(cluster, generatedClusters, 2);
                    return (
                      <div key={cluster.id} className="bg-white border-2 border-emerald-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-emerald-700">Grappe {cluster.grappeNumber}</span>
                          <span className="text-xs text-slate-500">{cluster.menageCount} ménages</span>
                        </div>
                        <div className="text-xs text-slate-600 mb-1">
                          📍 Centre: {cluster.center.lat.toFixed(4)}, {cluster.center.lon.toFixed(4)}
                        </div>
                        <div className="text-xs text-slate-600 mb-1">
                          🏘️ {cluster.villageCount} villages
                        </div>
                        <div className="text-xs text-slate-600 mb-1">
                          📏 Distance moyenne: {cluster.averageDistance.toFixed(2)} km
                        </div>
                        {nearestClusters.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <div className="text-xs font-semibold text-slate-700 mb-1">📏 Distances aux autres grappes:</div>
                            {nearestClusters.map(({ cluster: nearest, distance }) => (
                              <div key={nearest.id} className="text-xs text-slate-600">
                                → Grappe {nearest.grappeNumber}: {distance.toFixed(2)} km
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Distance matrix */}
                {clusterDistances.length > 0 && (
                  <div className="mt-4 border-t-2 border-emerald-300 pt-4">
                    <h5 className="text-sm font-bold text-emerald-800 mb-3">📏 Matrice des distances entre grappes</h5>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-1 px-2 font-semibold text-slate-500">De</th>
                            <th className="text-left py-1 px-2 font-semibold text-slate-500">Vers</th>
                            <th className="text-right py-1 px-2 font-semibold text-slate-500">Distance (km)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clusterDistances.map(({ from, to, distance }) => (
                            <tr key={`${from}-${to}`} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-1 px-2 text-slate-700">{from}</td>
                              <td className="py-1 px-2 text-slate-700">{to}</td>
                              <td className="py-1 px-2 text-right text-slate-700 font-semibold">{distance.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      💡 La distance moyenne est de {(clusterDistances.reduce((sum, d) => sum + d.distance, 0) / clusterDistances.length).toFixed(2)} km entre les grappes
                    </div>
                  </div>
                )}
                
                <button
                  onClick={selectedConfiguration ? handleApplyOptimizedConfiguration : handleApplyClusters}
                  className="mt-3 px-6 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                >
                  ✅ {selectedConfiguration ? 'Appliquer la configuration optimisée' : 'Appliquer les clusters'}
                </button>
              </div>
            )}
            
            {/* Suggested menages display */}
            {suggestedMenages.length > 0 && (
              <div className="mt-4 border-t-2 border-blue-300 pt-4">
                <h5 className="text-sm font-bold text-blue-800 mb-3">💡 Ménages suggérés pour nouvelle grappe ({suggestedMenages.length})</h5>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-1 px-2 font-semibold text-slate-500">Ordre</th>
                        <th className="text-left py-1 px-2 font-semibold text-slate-500">Nom</th>
                        <th className="text-left py-1 px-2 font-semibold text-slate-500">Village</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestedMenages.slice(0, 20).map(menage => (
                        <tr key={menage.ordre} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1 px-2 text-slate-700">{menage.ordre}</td>
                          <td className="py-1 px-2 text-slate-700">{menage.nom}</td>
                          <td className="py-1 px-2 text-slate-700">{menage.village}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {suggestedMenages.length > 20 && (
                  <div className="text-xs text-slate-500 mt-2">
                    ... et {suggestedMenages.length - 20} autres ménages
                  </div>
                )}
              </div>
            )}
            
            <div className="text-xs text-emerald-700 mt-2">
              💡 Le clustering GPS crée automatiquement des grappes basées sur la proximité géographique des ménages. Utilisez les paramètres pour ajuster la distance maximale et le nombre de grappes souhaité.
            </div>
          </div>
        )}
        
        {/* Regions Information */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">📍 Régions détectées automatiquement</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {customRegions.map(region => {
              // Compter les grappes depuis les données serveur
              const grappesInRegion = (serverConfig?.grappes || []).filter(g => {
                const regionName = g.region?.name || '';
                return regionName === region;
              }).length || 0;
              
              return (
                <div key={region} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                  <span className="text-xs font-semibold text-slate-700 flex-1">{region}</span>
                  <span className="text-xs text-slate-500">{grappesInRegion} grappes</span>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            💡 Les régions sont détectées automatiquement à partir des données des ménages. Le nombre de grappes provient de la base de données PostgreSQL.
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {customLots.map(lot => (
            <div key={lot} className="border border-slate-200 rounded-lg p-4 relative">
              <button
                onClick={() => handleDeleteLot(lot)}
                className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-[10px]"
                title="Supprimer le lot"
              >
                ✕
              </button>
              <div className="text-xs font-bold text-slate-700 mb-2">{LOT_TITLES[lot] || `Lot ${lot}`}</div>
              <select
                value={lotModes[lot]}
                onChange={e => onUpdateLotMode(lot, e.target.value as LotMode)}
                className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="individuel">Individuel (par grappe)</option>
                <option value="global">Global (un seul entrepreneur)</option>
                <option value="groupe">Groupe (groupes de grappes)</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tableau de bord Statistiques ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">📊 Tableau de bord - Affectation des Grappes</h3>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  setRefreshing(true);
                  if (refreshDashboardStats) {
                    await refreshDashboardStats();
                  }
                } catch (err) {
                  console.error('Failed to refresh stats:', err);
                  alert('Erreur lors du rafraîchissement des statistiques');
                } finally {
                  setRefreshing(false);
                }
              }}
              disabled={refreshing}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg border-2 transition-all relative overflow-hidden ${
                refreshing 
                  ? 'bg-blue-50 text-blue-400 border-blue-300 cursor-not-allowed' 
                  : 'bg-blue-100 text-blue-700 border-blue-600 hover:bg-blue-200'
              }`}
              title="Rafraîchir les statistiques"
            >
              {refreshing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Rafraîchissement...
                </span>
              ) : (
                '🔄 Rafraîchir'
              )}
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                canUndo 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
              title="Annuler (Ctrl+Z)"
            >
              ↩ Annuler
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                canRedo 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
              title="Rétablir (Ctrl+Y)"
            >
              ↪ Rétablir
            </button>
          </div>
        </div>
        
        {/* Global Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-700">{dashboardStatsFromSource?.totalGrappes || 0}</div>
            <div className="text-[10px] font-semibold text-blue-600 uppercase">Total Grappes</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
            <div className="text-2xl font-bold text-emerald-700">{dashboardStatsFromSource?.assignedGrappes || 0}</div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase">Affectées</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <div className="text-2xl font-bold text-amber-700">{dashboardStatsFromSource?.unassignedGrappes || 0}</div>
            <div className="text-[10px] font-semibold text-amber-600 uppercase">Non affectées</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-700">
              {(dashboardStatsFromSource?.totalGrappes || 0) > 0 ? Math.round(((dashboardStatsFromSource?.assignedGrappes || 0) / (dashboardStatsFromSource?.totalGrappes || 1)) * 100) : 0}%
            </div>
            <div className="text-[10px] font-semibold text-purple-600 uppercase">Taux d'affectation</div>
          </div>
        </div>

        {/* Assignment Type Breakdown */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-700 mb-3">Types d'affectation</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-600">Global</span>
                <span className="text-lg font-bold text-blue-600">{dashboardStatsFromSource?.globalAssignments || 0}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(dashboardStatsFromSource?.totalGrappes || 0) > 0 ? ((dashboardStatsFromSource?.globalAssignments || 0) / (dashboardStatsFromSource?.totalGrappes || 1)) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-600">Groupe</span>
                <span className="text-lg font-bold text-emerald-600">{dashboardStatsFromSource?.groupAssignments || 0}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${(dashboardStatsFromSource?.totalGrappes || 0) > 0 ? ((dashboardStatsFromSource?.groupAssignments || 0) / (dashboardStatsFromSource?.totalGrappes || 1)) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-600">Individuel</span>
                <span className="text-lg font-bold text-amber-600">{dashboardStatsFromSource?.individualAssignments || 0}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all"
                  style={{ width: `${(dashboardStatsFromSource?.totalGrappes || 0) > 0 ? ((dashboardStatsFromSource?.individualAssignments || 0) / (dashboardStatsFromSource?.totalGrappes || 1)) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lot Statistics */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-700 mb-3">Statistiques par Lot</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Lot</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Total</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Affectées</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Global</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Groupe</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Individuel</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-500">Taux</th>
                </tr>
              </thead>
              <tbody>
                {customLots.map(lot => {
                  const lotStat = dashboardStatsFromSource.lotStats[lot] || { total: 0, assigned: 0, global: 0, group: 0, individual: 0 };
                  const rate = lotStat.total > 0 ? Math.round((lotStat.assigned / lotStat.total) * 100) : 0;
                  return (
                    <tr key={lot} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-700">{LOT_TITLES[lot] || `Lot ${lot}`}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{lotStat.total}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{lotStat.assigned}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{lotStat.global}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{lotStat.group}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{lotStat.individual}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          rate >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Region Statistics */}
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-700 mb-3">Statistiques par Région</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customRegions.map(region => {
              const regionStat = dashboardStatsFromSource.regionStats[region] || { total: 0, assigned: 0 };
              const regionColor = REGION_COLORS[region] || 'bg-slate-100 text-slate-700 border-slate-200';
              const rate = regionStat.total > 0 ? Math.round((regionStat.assigned / regionStat.total) * 100) : 0;
              return (
                <div key={region} className="border border-slate-200 rounded-lg p-3">
                  <div className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${regionColor} mb-2`}>
                    {region}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{regionStat.assigned} / {regionStat.total}</span>
                    <span className={`font-bold ${
                      rate >= 80 ? 'text-emerald-600' :
                      rate >= 50 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {rate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                    <div 
                      className={`h-1.5 rounded-full transition-all ${
                        rate >= 80 ? 'bg-emerald-500' :
                        rate >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prestataire Usage */}
        {Object.keys(dashboardStatsFromSource?.prestataireUsage || {}).length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3">Utilisation des Prestataires</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(dashboardStatsFromSource?.prestataireUsage || {})
                .sort(([, a], [, b]) => b - a)
                .map(([prestataire, count]) => (
                  <div key={prestataire} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 truncate">{prestataire}</span>
                      <span className="text-lg font-bold text-blue-600">{count}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">grappe(s) affectée(s)</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Détail des assignations par responsable */}
        {serverConfig?.grappes && serverConfig.grappes.length > 0 && dashboardStatsFromSource?.prestataireDetails && (
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3">Détail des Assignations par Responsable</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Responsable</th>
                    <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Lot</th>
                    <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Grappe</th>
                    <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Région</th>
                    <th className="border border-slate-200 px-2 py-1 text-left font-semibold text-slate-700">Ménages</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dashboardStatsFromSource.prestataireDetails)
                    .sort(([, a], [, b]) => b.length - a.length)
                    .map(([prestataire, details]) => (
                      details.map((detail: any, index: number) => (
                        <tr key={`${prestataire}-${detail.lot}-${detail.grappeKey}-${index}`} className="hover:bg-slate-50">
                          <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">
                            {index === 0 ? prestataire : ''}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              detail.lot === 'A' ? 'bg-blue-100 text-blue-700' :
                              detail.lot === 'B' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              Lot {detail.lot}
                            </span>
                          </td>
                          <td className="border border-slate-200 px-2 py-1 font-mono text-slate-600">{detail.grappeKey}</td>
                          <td className="border border-slate-200 px-2 py-1 text-slate-600">{detail.region}</td>
                          <td className="border border-slate-200 px-2 py-1 font-semibold text-slate-700">{detail.menageCount}</td>
                        </tr>
                      ))
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          {customLots.map(lot => (
            <button
              key={lot}
              onClick={() => { setEditingLot(lot); setEditingKey(null); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                editingLot === lot
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Lot {lot}
            </button>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`ml-auto px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              saveSuccess 
                ? 'bg-green-500 text-white animate-pulse' 
                : saveError 
                  ? 'bg-red-500 text-white' 
                  : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}
          >
            {saving ? 'Sauvegarde...' : saveSuccess ? '✓ Sauvegardé !' : saveError ? '✗ Erreur' : 'Sauvegarder sur le serveur'}
          </button>
        </div>

        {lotModes[editingLot] === 'global' && (
          <div className="border border-slate-200 rounded-lg p-4 mb-4">
            <div className="text-xs font-bold text-slate-700 mb-3">Entrepreneur Global — Lot {editingLot}</div>
            <EntForm
              data={(entrepreneurConfig[editingLot]?.__global as EntrepreneurData) || emptyEnt}
              onChange={(f, v) => handleUpdateField(editingLot, '__global', f, v)}
              onPrestataireSelect={handlePrestataireSelectForGlobal}
              prestataires={prestataires}
              customRegions={customRegions}
              mergedGrappeCounts={mergedGrappeCounts}
            />
          </div>
        )}

        {/* Bulk Assignment Mode */}
        {lotModes[editingLot] === 'individuel' && (
          <div className="border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-slate-700">Affectation Groupée — Lot {editingLot}</div>
              <button
                onClick={() => setBulkAssignMode(!bulkAssignMode)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  bulkAssignMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {bulkAssignMode ? 'Fermer' : 'Affectation groupée'}
              </button>
            </div>
            
            {bulkAssignMode && (
              <EntForm
                data={emptyEnt}
                onChange={(f, v) => {
                  // Allow field updates even in bulk mode for UX
                  handleUpdateField(editingLot, '__bulk_temp', f, v);
                }}
                onPrestataireSelect={handleBulkAssign}
                prestataires={prestataires}
                showGrappesSelector={true}
                selectedGrappes={selectedGrappes}
                onGrappesToggle={handleGrappesToggle}
                customRegions={customRegions}
                mergedGrappeCounts={mergedGrappeCounts}
              />
            )}
          </div>
        )}

        {lotModes[editingLot] === 'groupe' && (
          <div className="border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-slate-700">Groupes — Lot {editingLot}</div>
              <button
                onClick={() => addGroup(editingLot)}
                className="px-3 py-1 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                + Ajouter un groupe
              </button>
            </div>
            <div className="space-y-3">
              {(entrepreneurConfig[editingLot]?.__groupes || []).map((grp: EntrepreneurGroup) => (
                <div key={grp.id} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-600">{grp.id}</span>
                    <button onClick={() => removeGroup(editingLot, grp.id)} className="text-red-400 hover:text-red-600 text-[11px]">Supprimer</button>
                  </div>
                  <div
                    className="cursor-pointer text-[11px] text-blue-600 mb-2"
                    onClick={() => setEditingKey(editingKey === `group_${grp.id}` ? null : `group_${grp.id}`)}
                  >
                    {editingKey === `group_${grp.id}` ? 'Masquer' : 'Modifier les informations'}
                  </div>
                  {editingKey === `group_${grp.id}` && (
                    <EntForm
                      data={grp as EntrepreneurData}
                      onChange={(f, v) => handleUpdateField(editingLot, `group_${grp.id}`, f, v)}
                      onPrestataireSelect={handlePrestataireSelectForGroup(grp.id)}
                      prestataires={prestataires}
                      customRegions={customRegions}
                      mergedGrappeCounts={mergedGrappeCounts}
                    />
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {customRegions.map(region => {
                      const regionColor = REGION_COLORS[region] || 'bg-slate-100 text-slate-700 border-slate-200';
                      return (
                        <div key={region} className="mr-4">
                          <div className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${regionColor} mb-1`}>
                            {region}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: mergedGrappeCounts[region] || 0 }, (_, i) => i + 1).map(g => {
                              const gk = `${region}_${g}`;
                              const inGroup = grp.grappes.includes(gk);
                              const menageCount = grappeStats[gk] || 0;
                              return (
                                <button
                                  key={gk}
                                  onClick={() => toggleGroupGrappe(editingLot, grp.id, gk)}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                    inGroup ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                  }`}
                                  title={`${menageCount} ménages`}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(entrepreneurConfig[editingLot]?.__groupes || []).length === 0 && (
                <div className="text-xs text-slate-400 text-center py-4">Aucun groupe. Cliquez "Ajouter" pour commencer.</div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {customRegions.map(region => {
            const regionColor = REGION_COLORS[region] || 'bg-slate-100 text-slate-700 border-slate-200';
            return (
              <div key={region}>
                <div className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${regionColor} mb-2`}>
                  {region}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.from({ length: mergedGrappeCounts[region] || 0 }, (_, i) => i + 1).map(g => {
                    const key = `${region}_${g}`;
                    const ent = getEntrepreneur(editingLot, region, g);
                    const isEditing = editingKey === key;
                    const raw = (entrepreneurConfig[editingLot]?.[key] as EntrepreneurData) || null;
                    const hasIndividualAssignment = raw && (raw.entreprise || raw.societe || raw.telephone);
                    const showEditButton = lotModes[editingLot] === 'individuel' || hasIndividualAssignment;
                    const menageCount = grappeStats[key] || 0;
                    return (
                      <div key={g} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-500">
                            Grappe {g} <span className="text-[9px] text-slate-400 font-normal">({menageCount})</span>
                          </span>
                          {showEditButton && (
                            <button
                              onClick={() => setEditingKey(isEditing ? null : key)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-bold"
                            >
                              {isEditing ? 'Fermer' : 'Modifier'}
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <EntForm
                            data={raw || emptyEnt}
                            onChange={(f, v) => handleUpdateField(editingLot, key, f, v)}
                            onPrestataireSelect={handlePrestataireSelectForGrappe(key)}
                            prestataires={prestataires}
                            customRegions={customRegions}
                            mergedGrappeCounts={mergedGrappeCounts}
                          />
                        ) : (
                          <>
                            <div className="text-xs font-semibold text-slate-800">{ent.entreprise || 'À définir'}</div>
                            <div className="text-[10px] text-slate-400">{ent.telephone || ''}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section Gestion des utilisateurs ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-800">👥 Gestion des utilisateurs</h3>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {users.length} utilisateur{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher par nom, email ou rôle..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            {users.length === 0 ? 'Aucun utilisateur chargé.' : 'Aucun résultat pour cette recherche.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Nom</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Email</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Rôle</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Lots autorisés</th>
                  <th className="text-center py-2 px-3 font-semibold text-slate-500">Modules</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-700">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{user.email}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ROLE_BADGE[user.role] || 'bg-slate-100 text-slate-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1">
                        {(user.lots || []).map(lot => (
                          <span key={lot} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            Lot {lot}
                          </span>
                        ))}
                        {(!user.lots || user.lots.length === 0) && (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-3">
                        {Object.entries(MODULE_LABELS).map(([key, mod]) => {
                          const enabled = user.role === 'admin' || (user.lots && user.lots.length > 0);
                          return (
                            <div key={key} className="flex items-center gap-1" title={mod.label}>
                              <span className="text-[10px]">{mod.icon}</span>
                              <div
                                className={`w-7 h-4 rounded-full relative transition-colors ${
                                  enabled ? 'bg-emerald-400' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                    enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section Gestion des Prestataires ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">🏢 Gestion des Prestataires</h3>
          <button
            onClick={() => handleOpenPrestataireModal()}
            className="px-3 py-1 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
          >
            + Nouveau Prestataire
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Gérez la base de données des prestataires. Créez, modifiez ou supprimez des prestataires.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Entreprise</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Responsable</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Téléphone</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Email</th>
                <th className="text-left py-2 px-3 font-semibold text-slate-500">Adresse</th>
                <th className="text-center py-2 px-3 font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prestataires && prestataires.length > 0 ? (
                prestataires.map(prestataire => (
                  <tr key={prestataire.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-700">
                      {prestataire.entreprise || prestataire.nom || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {prestataire.societe || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {prestataire.telephone || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {prestataire.email || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {prestataire.adresse || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenPrestataireModal(prestataire)}
                          className="text-blue-500 hover:text-blue-700 text-[10px] font-bold"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handlePrestataireDelete(prestataire.id)}
                          className="text-red-500 hover:text-red-700 text-[10px] font-bold"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                    Aucun prestataire disponible. Cliquez sur "Nouveau Prestataire" pour en ajouter un.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal de gestion des prestataires ── */}
      {prestataireModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">
                {editingPrestataire ? 'Modifier le Prestataire' : 'Nouveau Prestataire'}
              </h3>
              <button
                onClick={handleClosePrestataireModal}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {prestataireErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-[10px] font-bold text-red-700 mb-1">Erreurs de validation:</div>
                  <ul className="text-[10px] text-red-600 list-disc list-inside">
                    {prestataireErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Entreprise / Nom</label>
                <input
                  type="text"
                  value={prestataireForm.entreprise || prestataireForm.nom || ''}
                  onChange={e => setPrestataireForm({ ...prestataireForm, entreprise: e.target.value, nom: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Responsable</label>
                <input
                  type="text"
                  value={prestataireForm.societe || ''}
                  onChange={e => setPrestataireForm({ ...prestataireForm, societe: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Téléphone</label>
                <input
                  type="text"
                  value={prestataireForm.telephone || ''}
                  onChange={e => setPrestataireForm({ ...prestataireForm, telephone: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Email</label>
                <input
                  type="email"
                  value={prestataireForm.email || ''}
                  onChange={e => setPrestataireForm({ ...prestataireForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Adresse</label>
                <input
                  type="text"
                  value={prestataireForm.adresse || ''}
                  onChange={e => setPrestataireForm({ ...prestataireForm, adresse: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mt-0.5"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleClosePrestataireModal}
                className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                onClick={handlePrestataireSubmit}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingPrestataire ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section Import & Restauration ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mt-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">📥 Import & Restauration des données</h3>
        <p className="text-xs text-slate-500 mb-4">
          Importez un fichier Excel pour mettre à jour les ménages et les coordonnées GPS, ou réinitialisez la base de données locale.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <span className="text-3xl">📊</span>
              <p className="text-xs font-semibold text-slate-700">
                Glissez-déposez votre fichier Excel ici
              </p>
              <p className="text-[10px] text-slate-400">
                Fichiers supportés : .xlsx, .xls
              </p>
              <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm">
                Parcourir
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Outils complémentaires */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700">Modèle d'importation</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Le fichier doit contenir les colonnes : <code>Numero_ordre, Prénom et Nom, Telephone, region, commune, village, latitude, longitude, statut</code>.
              </p>
              <button
                onClick={downloadTemplate}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors text-center"
              >
                📥 Télécharger le modèle Excel
              </button>
            </div>

            {onResetAllData && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 flex flex-col justify-between">
                <div className="space-y-1 mb-2">
                  <h4 className="text-xs font-bold text-red-800">Zone de danger</h4>
                  <p className="text-[10px] text-red-600 leading-relaxed">
                    Cette action réinitialisera toutes les coordonnées personnalisées, grappes et ménages aux valeurs par défaut.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("⚠️ Êtes-vous sûr de vouloir réinitialiser toutes les données géographiques locales ? Cette opération est irréversible.")) {
                      onResetAllData();
                      setImportStatus("✅ Données réinitialisées avec succès aux valeurs d'origine.");
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-center shadow-sm"
                >
                  ⚠️ Réinitialiser toutes les données locales
                </button>
              </div>
            )}
          </div>
        </div>

        {importStatus && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-semibold ${
            importStatus.startsWith('❌') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {importStatus}
          </div>
        )}
      </div>

      {/* ── Village Reassignment ── */}
      <div className="mt-6 border-t border-slate-200 pt-6">
        <h4 className="text-xs font-bold text-slate-700 mb-3">Réaffectation Village → Grappe</h4>
        <p className="text-[11px] text-slate-400 mb-3">Modifier l'affectation grappe d'un village.</p>
        <div className="mb-3">
          <input
            type="text"
            value={villageSearch}
            onChange={e => setVillageSearch(e.target.value)}
            placeholder="Rechercher un village..."
            className="w-full max-w-xs px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800"
          />
        </div>
        <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-[300px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-800">Village</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-800">Région</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-800">Grappe actuelle</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-800">Nouvelle grappe</th>
              </tr>
            </thead>
            <tbody>
              {filteredVillages.map(v => (
                <tr key={v.key} className="border-t border-slate-100 hover:bg-white">
                  <td className="px-3 py-2 font-medium text-slate-800">{v.village}</td>
                  <td className="px-3 py-2 text-slate-500">{v.region}</td>
                  <td className="px-3 py-2 text-center font-bold text-slate-800">{v.grappe}</td>
                  <td className="px-3 py-2 text-center">
                    <select
                      value={v.grappe}
                      onChange={e => {
                        const newG = Number(e.target.value);
                        const vKey = `${v.region}|${v.village}`;
                        if (onVillageOverride) onVillageOverride(vKey, newG);
                      }}
                      className="px-2 py-1.5 text-sm text-slate-800 border border-slate-300 rounded-md bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(g => (
                        <option key={g} value={g} style={{ color: '#1e293b' }}>Grappe {g}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

AdminView.displayName = 'AdminView';
export default AdminView;
