/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  Map as MapIcon,
  FileText,
  Settings,
  Users,
  ChevronRight,
  LayoutDashboard,
  Briefcase,
  Home,
  Shield,
  BarChart3,
  Truck,
  ClipboardCheck,
  Activity,
  MessageSquare,
  GraduationCap,
  FolderOpen,
  Database,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Store,
  Wrench,
  Calculator,
  Building2,
  ServerCog,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTerrainData } from '@hooks/useTerrainData';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';

const PAGE_REGISTRY = [
  { title: 'Dashboard', to: '/executive/dashboard', icon: LayoutDashboard, category: 'Pages' },
  { title: 'Projets', to: '/projects', icon: Briefcase, category: 'Pages' },
  { title: 'Terrain', to: '/operations/map', icon: MapIcon, category: 'Pages' },
  { title: 'Planning Missions', to: '/operations/missions', icon: ClipboardCheck, category: 'Pages' },
  { title: 'Collecte Terrain', to: '/operations/collect', icon: Database, category: 'Pages' },
  { title: 'Bordereau', to: '/operations/delivery', icon: Truck, category: 'Pages' },
  { title: 'Communication', to: '/communication', icon: MessageSquare, category: 'Pages' },
  { title: 'Formations', to: '/planning-formation', icon: GraduationCap, category: 'Pages' },
  { title: 'Logistique', to: '/resources/inventory', icon: Store, category: 'Pages' },
  { title: 'Atelier', to: '/resources/workshop', icon: Wrench, category: 'Pages' },
  { title: 'PV Automatisation', to: '/quality/pv', icon: FileText, category: 'Pages' },
  { title: 'Simulation', to: '/finance/simulation', icon: Calculator, category: 'Pages' },
  { title: 'Charges', to: '/finance/budget', icon: BarChart3, category: 'Pages' },
  { title: 'Approbations', to: '/governance/approvals', icon: ShieldCheck, category: 'Pages' },
  { title: 'Documents', to: '/documents/library', icon: FolderOpen, category: 'Pages' },
  { title: 'Cahier de Charge', to: '/documents/specifications', icon: BookOpen, category: 'Pages' },
  { title: 'Administration', to: '/admin/hub', icon: Settings, category: 'Pages' },
  { title: 'Utilisateurs', to: '/admin/users', icon: Users, category: 'Pages' },
  { title: 'Diagnostic Santé', to: '/admin/diagnostic', icon: Activity, category: 'Pages' },
  { title: 'Paramètres', to: '/admin/settings', icon: Settings, category: 'Pages' },
  { title: 'Sécurité', to: '/admin/security', icon: Shield, category: 'Pages' },
  { title: 'Aide', to: '/aide', icon: HelpCircle, category: 'Pages' },
];

const QUICK_ACTIONS = [
  { icon: MapIcon, label: 'Ouvrir la Carte', to: '/operations/map' },
  { icon: Activity, label: 'Diagnostic Santé', to: '/admin/diagnostic' },
  { icon: ServerCog, label: 'Agent Local', to: '/admin/agent-local' },
  { icon: BookOpen, label: 'Cahier de Charge', to: '/documents/specifications' },
  { icon: Settings, label: 'Paramètres', to: '/admin/settings' },
];

interface SearchResult {
  id: string;
  label: string;
  description: string;
  type: 'page' | 'project' | 'household';
  to?: string;
  icon?: any;
  data?: any;
}

export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, projects } = useProject();
  const { households } = useTerrainData({ enabled: Boolean(user) });
  const searchWorkerRef = useRef<Worker | null>(null);

  const [workerResults, setWorkerResults] = useState<any[]>([]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for external open event (from TopBar search button)
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('ged-os:open-command-palette', handler);
    return () => window.removeEventListener('ged-os:open-command-palette', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Initialize search worker and index households
  useEffect(() => {
    const worker = new Worker(new URL('@/workers/searchWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'SEARCH_RESULTS') {
        setWorkerResults(Array.isArray(e.data.results) ? e.data.results : []);
      }
    };

    searchWorkerRef.current = worker;

    // Index households once loaded
    if (households && households.length > 0) {
      worker.postMessage({ type: 'INDEX', payload: households });
    }

    return () => worker.terminate();
  }, []);

  // Re-index when households change
  useEffect(() => {
    if (searchWorkerRef.current && households && households.length > 0) {
      searchWorkerRef.current.postMessage({ type: 'INDEX', payload: households });
    }
  }, [households]);

  // Merge results
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const combined: SearchResult[] = [];

    // 1. Pages
    const pageResults = PAGE_REGISTRY.filter(
      (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    ).map((p) => ({
      id: `page-${p.to}`,
      label: p.title,
      description: p.category,
      type: 'page' as const,
      to: p.to,
      icon: p.icon,
    }));
    combined.push(...pageResults);

    // 2. Projects (from context)
    if (projects && projects.length > 0) {
      const projectResults = projects
        .filter((p: any) => p.name?.toLowerCase().includes(q))
        .map((p: any) => ({
          id: `project-${p.id}`,
          label: p.name,
          description: p.client ? `Projet • ${p.client}` : 'Projet',
          type: 'project' as const,
          to: `/projects/edit/${p.id}`,
          icon: Briefcase,
        }));
      combined.push(...projectResults);
    }

    // 3. Current project detail
    if (project && project.name?.toLowerCase().includes(q)) {
      combined.push({
        id: 'project-current',
        label: project.name,
        description: 'Projet actif',
        type: 'project',
        to: `/projects/edit/${project.id}`,
        icon: Briefcase,
      });
    }

    // 4. Households from worker
    const householdResults = (workerResults || []).map((h: any) => ({
      id: `household-${h.id}`,
      label: h.name || h.numeroordre || `Ménage #${h.id}`,
      description: `Ménage • ${h.data?.village || 'Village inconnu'}`,
      type: 'household' as const,
      to: `/operations/map?id=${h.id}`,
      icon: Home,
      data: h,
    }));
    combined.push(...householdResults);

    setResults(combined);
    setSelectedIndex(0);
  }, [query, workerResults, projects, project]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setWorkerResults([]);
      return;
    }
    searchWorkerRef.current?.postMessage({ type: 'SEARCH', payload: { query: q } });
  };

  const handleSelect = (item: SearchResult) => {
    if (item.to) navigate(item.to);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    }
  };

  // Group results by type for display
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const key = r.type === 'page' ? 'Pages' : r.type === 'project' ? 'Projets' : 'Ménages';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [results]);

  // Flatten groups for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: { group: string; result: SearchResult }[] = [];
    for (const [group, items] of Object.entries(groupedResults)) {
      for (const item of items) {
        flat.push({ group, result: item });
      }
    }
    return flat;
  }, [groupedResults]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'page': return FileText;
      case 'project': return Briefcase;
      case 'household': return Home;
      default: return Search;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[10000] bg-slate-950/40 backdrop-blur-md"
          />

          <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto"
            >
              {/* Search Input */}
              <div className="relative flex items-center p-6 border-b border-white/5">
                <Search className="absolute left-8 text-slate-400" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Rechercher une page, un projet, un ménage... (CTRL+K)"
                  className="w-full pl-12 pr-4 bg-transparent border-none text-white text-lg font-medium placeholder:text-slate-500 focus:ring-0 outline-none"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  ESC
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {query === '' ? (
                  <div className="p-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Actions Rapides</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.to}
                          onClick={() => { navigate(action.to); setIsOpen(false); }}
                          className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group text-left"
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
                            <action.icon size={18} />
                          </div>
                          <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : flatResults.length > 0 ? (
                  (() => {
                    let globalIdx = 0;
                    return Object.entries(groupedResults).map(([group, items]) => (
                      <div key={group} className="mb-4 last:mb-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-1">
                          {group}
                          <span className="ml-2 text-white/30">({items.length})</span>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => {
                            const idx = globalIdx++;
                            const Icon = getIconForType(item.type);
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                                  idx === selectedIndex
                                    ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white'
                                    : 'text-slate-400 hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    idx === selectedIndex ? 'bg-white/20' : 'bg-slate-800'
                                  }`}>
                                    <Icon size={18} />
                                  </div>
                                  <div className="text-left">
                                    <p className={`text-sm font-black ${idx === selectedIndex ? 'text-white' : 'text-slate-200'}`}>{item.label}</p>
                                    <p className={`text-[10px] uppercase tracking-widest ${idx === selectedIndex ? 'text-blue-100/70' : 'text-slate-500'}`}>{item.description}</p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={idx === selectedIndex ? 'opacity-100' : 'opacity-0'} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  <div className="py-12 text-center opacity-30">
                    <Search size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Aucun résultat trouvé pour "{query}"</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><Command size={10} /> + K : Toggle</span>
                  <span className="flex items-center gap-1.5">↑↓ : Naviguer</span>
                  <span className="flex items-center gap-1.5">Enter : Sélectionner</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
