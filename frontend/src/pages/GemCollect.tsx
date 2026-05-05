
import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  ArrowLeft, 
  ChevronRight,
  Database,
  RefreshCcw,
  Cloud,
  CloudOff,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { InternalKoboForm } from '../components/terrain/InternalKoboForm';
import { PageContainer, PageHeader, ContentArea } from '../components/layout';
import { 
  fetchInternalKoboFormDefinitions, 
  queueInternalKoboSubmission,
  type InternalKoboImportedFormSummary
} from '../services/internalKoboSubmissionService';
import toast from 'react-hot-toast';

const GemCollectPage: React.FC = () => {
  const [availableForms, setAvailableForms] = useState<InternalKoboImportedFormSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFormKey, setSelectedFormKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    setIsLoading(true);
    try {
      const forms = await fetchInternalKoboFormDefinitions();
      setAvailableForms(forms.filter(f => f.active !== false));
    } catch (error) {
      toast.error('Erreur lors du chargement des formulaires');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await queueInternalKoboSubmission(values as any);
      toast.success('Formulaire mis en attente de synchronisation');
      setValues({});
      setSelectedFormKey(null); // Return to list after successful save
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (Object.keys(values).length > 0) {
      if (window.confirm('Voulez-vous vraiment quitter ? Les modifications non enregistrées seront perdues.')) {
        setValues({});
        setSelectedFormKey(null);
      }
    } else {
      setValues({});
      setSelectedFormKey(null);
    }
  };

  const filteredForms = availableForms.filter(form => 
    (form.title || form.formKey).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedForm = availableForms.find(f => f.formKey === selectedFormKey);

  if (selectedFormKey && selectedForm) {
    return (
      <PageContainer className="min-h-screen bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button 
            onClick={handleClose}
            className="group mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-black uppercase tracking-[0.1em]">Retour au catalogue</span>
          </button>

          <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="p-1 sm:p-4">
              <InternalKoboForm
                initialFormKey={selectedFormKey}
                hideFormSelector={true}
                values={values}
                onChange={handleChange}
                onSave={handleSave}
                onClose={handleClose}
                isSaving={isSaving}
                isOnline={navigator.onLine}
              />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen bg-slate-950">
      <PageHeader
        title="GEM Collect"
        subtitle="Catalogue universel des formulaires de collecte terrain"
        icon={<ClipboardList size={24} />}
      />

      <ContentArea className="max-w-6xl mx-auto">
        {/* Search and Filters */}
        <div className="mb-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Rechercher un formulaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all font-semibold"
            />
          </div>

          <div className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl border border-white/10">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <ListIcon size={20} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button 
              onClick={loadForms}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-white/5"
              title="Rafraîchir la liste"
            >
              <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">Synchronisation du catalogue...</p>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-[3rem] border border-white/5">
            <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-600">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Aucun formulaire trouvé</h3>
            <p className="text-slate-400 max-w-md mx-auto font-medium">
              Nous n'avons trouvé aucun formulaire correspondant à votre recherche ou aucun projet n'est actuellement déployé.
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "flex flex-col gap-4"
          }>
            {filteredForms.map((form) => (
              <button
                key={form.formKey}
                onClick={() => setSelectedFormKey(form.formKey)}
                className={`group text-left transition-all active:scale-[0.98] ${
                  viewMode === 'grid'
                  ? "bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-white/10 rounded-[2.5rem] p-8 hover:border-blue-500/40 hover:from-slate-900/90 hover:to-blue-900/10 shadow-xl"
                  : "bg-slate-900/50 border border-white/10 rounded-3xl p-5 flex items-center gap-6 hover:border-blue-500/40"
                }`}
              >
                <div className={`shrink-0 flex items-center justify-center rounded-3xl transition-transform group-hover:scale-110 ${
                  viewMode === 'grid' 
                  ? "w-16 h-16 bg-blue-500/10 text-blue-400 mb-6" 
                  : "w-14 h-14 bg-blue-500/10 text-blue-400"
                }`}>
                  <FileText size={viewMode === 'grid' ? 32 : 28} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-black text-white truncate group-hover:text-blue-200 transition-colors">
                      {form.title || form.formKey}
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-slate-500 mb-4 line-clamp-2">
                    {form.formKey} • Version {form.formVersion}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-400 border border-white/5">
                      {form.engine === 'gem-xlsform-universal' ? 'Moteur Universel' : 'Moteur Natif'}
                    </span>
                    <div className="p-2 rounded-full bg-blue-500/0 text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Offline Notice */}
        {!navigator.onLine && (
          <div className="mt-12 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl">
              <CloudOff size={24} />
            </div>
            <div>
              <h4 className="text-amber-100 font-black uppercase tracking-wider text-sm">Mode Hors-ligne Actif</h4>
              <p className="text-amber-200/60 text-sm font-medium">
                Vous travaillez actuellement sur les formulaires mis en cache. Les soumissions seront synchronisées dès le retour de la connexion.
              </p>
            </div>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
};

export default GemCollectPage;
