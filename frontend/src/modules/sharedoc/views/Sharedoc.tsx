import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder, FolderOpen, FileText, File, Image, Film, Archive,
  Upload, Search, Plus, Download, Trash2, MoreVertical,
  ChevronRight, ChevronDown, Grid, List, Filter, Clock,
  Users, Lock, Globe, Star, Eye, Loader2
} from 'lucide-react';
import { sharedocService } from '../../../services/sharedocService';
import type { SharedDocument } from '../../../services/sharedocService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { filesize } from 'filesize';

const getDocType = (mimeType: string, isFolder: boolean): 'folder' | 'pdf' | 'word' | 'excel' | 'image' | 'video' | 'archive' | 'other' => {
  if (isFolder || mimeType === 'application/vnd.folder') return 'folder';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml')) return 'word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheetml')) return 'excel';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return 'archive';
  return 'other';
};

const typeIcon = (type: string, open = false) => {
  const cls = 'shrink-0';
  switch (type) {
    case 'folder': return open
      ? <FolderOpen size={18} className={`${cls} text-amber-400`} />
      : <Folder size={18} className={`${cls} text-amber-400`} />;
    case 'pdf': return <FileText size={18} className={`${cls} text-rose-400`} />;
    case 'excel': return <File size={18} className={`${cls} text-emerald-400`} />;
    case 'word': return <FileText size={18} className={`${cls} text-blue-400`} />;
    case 'image': return <Image size={18} className={`${cls} text-sky-400`} />;
    case 'video': return <Film size={18} className={`${cls} text-purple-400`} />;
    case 'archive': return <Archive size={18} className={`${cls} text-orange-400`} />;
    default: return <File size={18} className={`${cls} text-slate-400`} />;
  }
};

const accessBadge = (access: string) => {
  if (access === 'ORG') return <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full"><Globe size={9}/> Organisation</span>;
  if (access === 'PROJECT') return <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full"><Users size={9}/> Projet</span>;
  return <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-400/10 border border-slate-400/20 px-2 py-0.5 rounded-full"><Lock size={9}/> Privé</span>;
};

// Build tree from flat list for rendering the sidebar
function buildTree(items: SharedDocument[]): SharedDocument[] {
  const map = new Map<string, SharedDocument>();
  const roots: SharedDocument[] = [];

  // Initialize map and children array
  items.forEach(item => {
    map.set(item.id, { ...item, children: [] });
  });

  items.forEach(item => {
    const node = map.get(item.id);
    if (item.folderId && map.has(item.folderId)) {
      map.get(item.folderId)!.children!.push(node!);
    } else {
      roots.push(node!);
    }
  });

  return roots;
}

export default function Sharedoc() {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filterAccess, setFilterAccess] = useState<'all' | 'ORG' | 'PROJECT' | 'PRIVATE'>('all');

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      // In a real app, you might want to fetch based on selectedFolderId or fetch all to build tree.
      // We'll fetch all or root level and their descendants based on backend support.
      // Assuming GET /api/sharedoc returns all accessible docs for now to build tree.
      const res = await sharedocService.getDocuments({ limit: 1000 }); // High limit to get all for tree
      if (res.success) {
        setDocuments(res.data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const toggleFolder = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const treeData = useMemo(() => buildTree(documents).filter(d => d.mimeType === 'application/vnd.folder'), [documents]);
  
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return documents.filter(d => d.mimeType !== 'application/vnd.folder' && d.filename.toLowerCase().includes(q));
  }, [search, documents]);

  // Main list is either search results, or contents of the selected folder
  const mainDocs = useMemo(() => {
    if (search.trim()) return searchResults;
    if (selectedFolderId) {
      return documents.filter(d => d.folderId === selectedFolderId);
    }
    return documents.filter(d => !d.folderId); // Root level items
  }, [search, searchResults, selectedFolderId, documents]);

  const starred = useMemo(() => documents.filter(d => false), [documents]); // No starred field yet

  const handleCreateFolder = async () => {
    const name = prompt('Nom du dossier :');
    if (!name) return;
    try {
      await sharedocService.createFolder(name, selectedFolderId);
      fetchDocuments();
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await sharedocService.uploadDocument(file, selectedFolderId);
      fetchDocuments();
    } catch (e) {
      console.error('Upload failed', e);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await sharedocService.downloadDocument(id);
      if (res.success && res.data.downloadUrl) {
         window.open(res.data.downloadUrl, '_blank');
      }
    } catch (e) {
      console.error('Download failed', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    try {
      await sharedocService.deleteDocument(id);
      fetchDocuments(); // Refresh
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const renderTree = (items: SharedDocument[], depth = 0) => items.map(item => {
    const isOpen = expanded.has(item.id);
    const isSel = selectedFolderId === item.id;
    return (
      <div key={item.id}>
        <div
          onClick={() => { setSelectedFolderId(item.id); toggleFolder(item.id); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm group ${isSel ? 'bg-blue-500/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isOpen ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
          {typeIcon('folder', isOpen)}
          <span className="truncate flex-1 text-[13px]">{item.filename}</span>
        </div>
        {isOpen && item.children && item.children.length > 0 && renderTree(item.children, depth + 1)}
      </div>
    );
  });

  const renderGridCard = (item: SharedDocument) => {
    const type = getDocType(item.mimeType, item.mimeType === 'application/vnd.folder');
    return (
    <div key={item.id} 
         onDoubleClick={() => type === 'folder' ? setSelectedFolderId(item.id) : null}
         className="group relative flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:border-blue-500/30 hover:bg-white/[0.06] transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        {typeIcon(type, false)}
        <button className="opacity-0 group-hover:opacity-100 transition p-1 rounded-lg hover:bg-white/10 text-slate-400"><MoreVertical size={14}/></button>
      </div>
      <p className="text-[13px] font-semibold text-white line-clamp-2 leading-snug">{item.filename}</p>
      <div className="mt-auto flex items-center justify-between gap-2">
        {accessBadge(item.accessLevel)}
        {item.size > 0 && <span className="text-[10px] text-slate-500">{filesize(item.size, { base: 10, round: 1 })}</span>}
      </div>
      <p className="text-[10px] text-slate-500">{item.uploadedBy?.name || 'Inconnu'} · {format(new Date(item.uploadedAt), 'dd MMM yyyy', { locale: fr })}</p>
    </div>
  )};

  const renderListRow = (item: SharedDocument) => {
    const type = getDocType(item.mimeType, item.mimeType === 'application/vnd.folder');
    return (
    <div key={item.id} 
         onDoubleClick={() => type === 'folder' ? setSelectedFolderId(item.id) : null}
         className="group flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/8">
      {typeIcon(type, false)}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white truncate">{item.filename}</p>
        <p className="text-[10px] text-slate-500">{item.uploadedBy?.name || 'Inconnu'}</p>
      </div>
      {accessBadge(item.accessLevel)}
      {item.size > 0 ? <span className="text-[11px] text-slate-500 w-16 text-right">{filesize(item.size, { base: 10, round: 1 })}</span> : <span className="w-16" />}
      <span className="text-[11px] text-slate-500 w-24 text-right">{format(new Date(item.uploadedAt), 'dd MMM yyyy', { locale: fr })}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition w-[100px] justify-end">
        {type !== 'folder' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); handleDownload(item.id); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Eye size={13}/></button>
            <button onClick={(e) => { e.stopPropagation(); handleDownload(item.id); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><Download size={13}/></button>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400"><Trash2 size={13}/></button>
      </div>
    </div>
  )};

  return (
    <div className="flex h-full min-h-screen bg-[radial-gradient(circle_at_top,#0b1531_0%,#070b1f_48%,#030712_100%)] text-white">

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/8 p-4 gap-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Arborescence</h2>
          <button onClick={handleCreateFolder} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition">
            <Plus size={14}/>
          </button>
        </div>
        <div className="rounded-xl border border-white/6 bg-white/[0.025] p-1.5 flex flex-col gap-0.5">
          {renderTree(treeData)}
        </div>

        {starred.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 px-1">Favoris</p>
            <div className="flex flex-col gap-0.5">
              {starred.map(d => (
                <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer text-[12px] text-slate-300 hover:text-white transition">
                  <Star size={11} className="text-amber-400 fill-amber-400 shrink-0"/>
                  <span className="truncate">{d.filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="border-b border-white/8 px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Documents Partagés</h1>
              <p className="text-[12px] text-slate-400 mt-0.5">Gérez, partagez et organisez vos fichiers en équipe</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleUpload}
              />
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
              >
                <Upload size={15}/> Importer
              </label>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un document…"
                className="w-full pl-9 pr-4 py-2 text-[13px] rounded-xl bg-white/[0.05] border border-white/8 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.07] transition"
              />
            </div>
            <div className="flex items-center gap-1 border border-white/8 rounded-xl p-1 bg-white/[0.03]">
              {(['all', 'ORG', 'PROJECT', 'PRIVATE'] as const).map(a => (
                <button key={a} onClick={() => setFilterAccess(a)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${filterAccess === a ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {a === 'all' ? 'Tous' : a === 'ORG' ? 'Organisation' : a === 'PROJECT' ? 'Projet' : 'Privé'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 border border-white/8 rounded-xl p-1 bg-white/[0.03] ml-auto">
              <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition ${view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><List size={14}/></button>
              <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition ${view === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><Grid size={14}/></button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500">
            <button onClick={() => setSelectedFolderId(null)} className="hover:text-white transition">Sharedoc</button>
            {selectedFolderId && (
              <>
                <ChevronRight size={10}/>
                <span className="text-white font-medium truncate max-w-[200px]">
                  {documents.find(d => d.id === selectedFolderId)?.filename || 'Dossier'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-white/8">
          {[
            { label: 'Total fichiers', value: documents.filter(d => d.mimeType !== 'application/vnd.folder').length, icon: File, color: 'blue' },
            { label: 'Dossiers', value: documents.filter(d => d.mimeType === 'application/vnd.folder').length, icon: Folder, color: 'amber' },
            { label: 'Espace utilisé', value: filesize(documents.reduce((acc, d) => acc + (d.size || 0), 0), { base: 10, round: 1 }), icon: Archive, color: 'emerald' },
            { label: 'Récents (7j)', value: documents.filter(d => new Date(d.uploadedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length, icon: Clock, color: 'purple' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${s.color}-500/10 border border-${s.color}-500/20`}>
                <s.icon size={16} className={`text-${s.color}-400`}/>
              </div>
              <div>
                <p className="text-lg font-black text-white leading-none">{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {search.trim() && (
            <p className="text-[12px] text-slate-400 mb-3">{searchResults.length} résultat(s) pour «&nbsp;<span className="text-white font-semibold">{search}</span>&nbsp;»</p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 size={40} className="text-blue-500 animate-spin mb-4"/>
              <p className="text-slate-400 font-semibold">Chargement des documents...</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {mainDocs
                .filter(d => filterAccess === 'all' || d.accessLevel === filterAccess)
                .map(item => renderGridCard(item))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] overflow-hidden">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-white/6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                <span className="w-5"/>
                <span className="flex-1">Nom</span>
                <span className="w-24">Accès</span>
                <span className="w-16 text-right">Taille</span>
                <span className="w-24 text-right">Modifié</span>
                <span className="w-[100px]"/>
              </div>
              <div className="divide-y divide-white/4 p-1.5 flex flex-col gap-0.5">
                {mainDocs
                  .filter(d => filterAccess === 'all' || d.accessLevel === filterAccess)
                  .map(item => renderListRow(item))}
              </div>
            </div>
          )}

          {!loading && mainDocs.filter(d => filterAccess === 'all' || d.accessLevel === filterAccess).length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Folder size={40} className="text-slate-700 mb-4"/>
              <p className="text-slate-400 font-semibold">Aucun document trouvé</p>
              <p className="text-slate-600 text-sm mt-1">Modifiez vos filtres ou importez un fichier</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}