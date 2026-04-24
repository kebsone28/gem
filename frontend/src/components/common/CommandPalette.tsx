/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Command, 
  Map as MapIcon, 
  FileText, 
  Settings, 
  Users, 
  Bell, 
  ChevronRight,
  ArrowRight,
  Calculator,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTerrainData } from '../../hooks/useTerrainData';
import { useAuth } from '../../contexts/AuthContext';

/**
 * CommandPalette (Axe 4 — Plan d'Amélioration Continue GEM-SAAS)
 * Interface de recherche globale ultra-rapide (CTRL+K / CMD+K).
 * Style Premium : Glassmorphism, animations fluides, indexation par worker.
 */
export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { households } = useTerrainData({ enabled: Boolean(user) });
  const searchWorkerRef = useRef<Worker | null>(null);

  // 1️⃣ Initialisation du Search Worker
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/searchWorker.ts', import.meta.url), {
      type: 'module'
    });
    
    worker.onmessage = (e) => {
      if (e.data.type === 'SEARCH_RESULTS') {
        setResults(Array.isArray(e.data.results) ? e.data.results : []);
      }
    };
    
    searchWorkerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // 2️⃣ Indexation des données quand elles changent
  useEffect(() => {
    if (searchWorkerRef.current && Array.isArray(households) && households.length > 0) {
      searchWorkerRef.current.postMessage({ type: 'INDEX', payload: { households } });
    }
  }, [households]);

  // 3️⃣ Keyboard Shortcuts (CTRL+K / CMD+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus Input on Open
  useEffect(() => {
    let handle: number | null = null;
    if (isOpen) {
      handle = window.setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        setTimeout(() => inputRef.current?.focus(), 100);
      }, 0);
    }
    return () => {
      if (handle) clearTimeout(handle);
    };
  }, [isOpen]);

  // 4️⃣ Recherche Multi-Sources
  const handleSearch = (q: string) => {
    setQuery(q);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    // Recherche dans le worker (Ménages)
    searchWorkerRef.current?.postMessage({ type: 'SEARCH', payload: { query: q } });
    
    // TODO: Ajouter recherche dans les pages statiques ici
  };

  const handleSelect = (item: any) => {
    if (item.type === 'household') {
      navigate(`/terrain?id=${item.id}`);
    } else if (item.type === 'page') {
      navigate(item.to);
    }
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
              {/* Header / Search Input */}
              <div className="relative flex items-center p-6 border-b border-white/5">
                <Search className="absolute left-8 text-slate-400" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Rechercher un ménage, une page, une action... (CTRL+K)"
                  className="w-full pl-12 pr-4 bg-transparent border-none text-white text-lg font-medium placeholder:text-slate-500 focus:ring-0 outline-none"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  ESC
                </div>
              </div>

              {/* Results Area */}
              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {query === '' ? (
                  <div className="p-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Actions Rapides</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: MapIcon, label: 'Ouvrir la Carte', to: '/terrain' },
                        { icon: Activity, label: 'Diagnostic Santé', to: '/admin/diagnostic' },
                        { icon: FileText, label: 'Cahier de Charge', to: '/cahier' },
                        { icon: Settings, label: 'Paramètres', to: '/settings' },
                      ].map((action) => (
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
                ) : (
                  <div className="space-y-1">
                    {Array.isArray(results) && results.length > 0 ? (
                      results.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                            idx === selectedIndex ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white' : 'text-slate-400 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${idx === selectedIndex ? 'bg-white/20' : 'bg-slate-800'}`}>
                              {item.type === 'household' ? <Users size={18} /> : <FileText size={18} />}
                            </div>
                            <div className="text-left">
                              <p className={`text-sm font-black ${idx === selectedIndex ? 'text-white' : 'text-slate-200'}`}>{item.label}</p>
                              <p className={`text-[10px] uppercase tracking-widest ${idx === selectedIndex ? 'text-blue-100/70' : 'text-slate-500'}`}>
                                {item.type === 'household' ? `MENAGE • ${item.data.village || 'Village Inconnu'}` : 'PAGE SYSTEME'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={16} className={idx === selectedIndex ? 'opacity-100' : 'opacity-0'} />
                        </button>
                      ))
                    ) : (
                      <div className="py-12 text-center opacity-30">
                        <Search size={48} className="mx-auto mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Aucun résultat trouvé pour "{query}"</p>
                      </div>
                    )}
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
                <div className="flex items-center gap-1 text-blue-500/50">
                  GEM AI ENGINE <ArrowRight size={10} />
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
