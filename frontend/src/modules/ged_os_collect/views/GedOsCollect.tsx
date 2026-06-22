import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  FileText,
  ArrowLeft,
  ChevronRight,
  CloudOff,
  RefreshCcw,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { InternalKoboForm } from '@modules/terrain/components/InternalKoboForm';
import { PageContainer, PageHeader, ContentArea } from '@components/layout';
import {
  clearInternalKoboLocalDraft,
  deleteInternalKoboFormDefinition,
  fetchInternalKoboFormDefinitions,
  loadInternalKoboLocalDraft,
  queueInternalKoboSubmission,
  type InternalKoboImportedFormSummary,
  type InternalKoboLocalDraft,
} from '@services/internalKoboSubmissionService';
// Import service to fetch households for auto‑remplissage
import { householdService } from '@services/householdService';
import toast from 'react-hot-toast';

const GedOsCollectPage: React.FC = () => {
  const [availableForms, setAvailableForms] = useState<InternalKoboImportedFormSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFormKey, setSelectedFormKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [households, setHouseholds] = useState<any[]>([]);
  const [deletingFormKey, setDeletingFormKey] = useState('');
  const [drafts, setDrafts] = useState<InternalKoboLocalDraft[]>([]);

  useEffect(() => {
    loadForms();
    loadDrafts();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Charger les ménages pour l'auto‑remplissage par numéro d'ordre
  useEffect(() => {
    if (!isOnline) return;
    const loadHouseholds = async () => {
      try {
        const data = await householdService.getHouseholds();
        setHouseholds(data || []);
      } catch (error) {
        console.warn('Erreur chargement ménages pour auto‑remplissage:', error);
      }
    };
    loadHouseholds();
  }, [isOnline]);

  const loadForms = async () => {
    setIsLoading(true);
    try {
      const forms = await fetchInternalKoboFormDefinitions();
      setAvailableForms(forms.filter((f) => f.active !== false));
    } catch {
      toast.error('Erreur lors du chargement des formulaires');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDrafts = () => {
    const allDrafts: InternalKoboLocalDraft[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('ged-os-draft:')) {
        try {
          const draft = JSON.parse(window.localStorage.getItem(key) || '') as InternalKoboLocalDraft;
          if (draft?.values && typeof draft.values === 'object') {
            allDrafts.push(draft);
          }
        } catch {
          // Ignore invalid drafts
        }
      }
    }
    setDrafts(allDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  };

  const handleRestoreDraft = (draft: InternalKoboLocalDraft) => {
    if (draft.formKey) {
      setSelectedFormKey(draft.formKey);
      setValues(draft.values);
      toast.success('Brouillon restauré');
    }
  };

  const handleDeleteDraft = (draft: InternalKoboLocalDraft) => {
    if (window.confirm('Supprimer ce brouillon ?')) {
      clearInternalKoboLocalDraft({
        householdId: draft.householdId,
        numeroOrdre: draft.numeroOrdre,
        formKey: draft.formKey,
        role: draft.role,
      });
      loadDrafts();
      toast.success('Brouillon supprimé');
    }
  };

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const selectedForm = availableForms.find((f) => f.formKey === selectedFormKey);
      await queueInternalKoboSubmission({
        clientSubmissionId: `${selectedFormKey}-${Date.now()}`,
        formKey: selectedFormKey,
        formVersion: (selectedForm?.formVersion || '1.0') as string,
        status: 'submitted',
        values,
        requiredMissing: [],
        metadata: {
          deviceId: 'ged-os-collect',
          submittedAt: new Date().toISOString(),
        },
      });
      toast.success('Formulaire mis en attente de synchronisation');
      setValues({});
      setSelectedFormKey(null); // Return to list after successful save
      loadDrafts(); // Reload drafts after saving
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  }, [selectedFormKey, values, availableForms]);

  const handleClose = () => {
    if (Object.keys(values).length > 0) {
      if (
        window.confirm(
          'Voulez-vous vraiment quitter ? Les modifications non enregistrées seront perdues.'
        )
      ) {
        setValues({});
        setSelectedFormKey(null);
      }
    } else {
      setValues({});
      setSelectedFormKey(null);
    }
  };

  const handleDeleteForm = async (
    event: React.MouseEvent<HTMLButtonElement>,
    form: InternalKoboImportedFormSummary
  ) => {
    event.stopPropagation();
    const label = form.title || form.formKey;
    const confirmed = window.confirm(
      `Supprimer le formulaire "${label}" du catalogue ? Les anciennes soumissions resteront conservees.`
    );
    if (!confirmed) return;

    setDeletingFormKey(form.formKey);
    try {
      await deleteInternalKoboFormDefinition(form.formKey);
      setAvailableForms((current) => current.filter((entry) => entry.formKey !== form.formKey));
      if (selectedFormKey === form.formKey) {
        setSelectedFormKey(null);
        setValues({});
      }
      toast.success(`Formulaire "${label}" supprime du catalogue`);
    } catch {
      toast.error('Suppression du formulaire impossible');
    } finally {
      setDeletingFormKey('');
    }
  };

  const filteredForms = availableForms.filter((form) =>
    (form.title || form.formKey).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedForm = availableForms.find((f) => f.formKey === selectedFormKey);

  if (selectedFormKey && selectedForm) {
    return (
      <PageContainer className="min-h-screen bg-slate-950 flex flex-col">
        <div className="max-w-6xl mx-auto px-4 py-6 flex-1 flex flex-col w-full h-full">
          <button
            onClick={handleClose}
            className="group mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-black uppercase tracking-[0.1em]">
              Retour au catalogue
            </span>
          </button>

          <div className="flex-1 w-full bg-slate-900/50 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md relative min-h-[750px]">
            <InternalKoboForm
              initialFormKey={selectedFormKey}
              hideFormSelector={true}
              values={values}
              onChange={handleChange}
              onSave={handleSave}
              onClose={handleClose}
              isSaving={isSaving}
              isOnline={isOnline}
              inline={true}
              resolveHouseholdByNumero={(numeroOrdre: string) => {
                const found = households.find((h) => {
                  const num = String(h.numeroordre || '').trim();
                  return num.toLowerCase() === numeroOrdre.toLowerCase();
                });
                return found || null;
              }}
            />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen bg-slate-950">
      <PageHeader
        title="GED OS Collect"
        subtitle="Catalogue universel des formulaires de collecte terrain"
        icon={<ClipboardList size={24} />}
      />

      <ContentArea className="max-w-6xl mx-auto">
        {/* Search and Filters */}
        <div className="mb-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors"
              size={18}
            />
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
              aria-label="Vue en grille"
              title="Vue en grille"
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="Vue en liste"
              title="Vue en liste"
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <ListIcon size={20} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button
              onClick={loadForms}
              aria-label="Rafraîchir la liste"
              title="Rafraîchir la liste"
              className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-white/5"
            >
              <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Drafts Section */}
        {drafts.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Brouillons enregistrés</h2>
                  <p className="text-xs font-semibold text-slate-400">{drafts.length} brouillon(s) disponible(s)</p>
                </div>
              </div>
              <button
                onClick={loadDrafts}
                aria-label="Rafraîchir les brouillons"
                title="Rafraîchir les brouillons"
                className="p-2.5 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-white/5"
              >
                <RefreshCcw size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.key}
                  className="bg-gradient-to-br from-amber-900/20 to-slate-900/40 border border-amber-500/20 rounded-2xl p-5 hover:border-amber-500/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate">
                        {draft.formKey || 'Formulaire inconnu'}
                      </p>
                      <p className="text-xs font-semibold text-slate-400 mt-1">
                        {draft.numeroOrdre ? `Numéro: ${draft.numeroOrdre}` : draft.householdId ? `ID: ${draft.householdId}` : 'Sans référence'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleRestoreDraft(draft)}
                        aria-label="Restaurer ce brouillon"
                        title="Restaurer"
                        className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                      >
                        <RefreshCcw size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft)}
                        aria-label="Supprimer ce brouillon"
                        title="Supprimer"
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500">
                    Dernière modification: {new Date(draft.updatedAt).toLocaleString('fr-FR')}
                  </p>
                  {draft.role && (
                    <span className="inline-block mt-2 px-2 py-1 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-wider text-slate-400 border border-white/5">
                      Rôle: {draft.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">
              Synchronisation du catalogue...
            </p>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-[3rem] border border-white/5">
            <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-600">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Aucun formulaire trouvé</h3>
            <p className="text-slate-400 max-w-md mx-auto font-medium">
              Nous n'avons trouvé aucun formulaire correspondant à votre recherche ou aucun projet
              n'est actuellement déployé.
            </p>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'flex flex-col gap-4'
            }
          >
            {filteredForms.map((form) => (
              <div
                key={form.formKey}
                role="button"
                tabIndex={0}
                aria-label={`Ouvrir ${form.title || form.formKey}`}
                onClick={() => setSelectedFormKey(form.formKey)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedFormKey(form.formKey);
                  }
                }}
                className={`group relative cursor-pointer text-left transition-all active:scale-[0.98] ${
                  viewMode === 'grid'
                    ? 'bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-white/10 rounded-[2.5rem] p-8 hover:border-blue-500/40 hover:from-slate-900/90 hover:to-blue-900/10 shadow-xl'
                    : 'bg-slate-900/50 border border-white/10 rounded-3xl p-5 pr-16 flex items-center gap-6 hover:border-blue-500/40'
                }`}
              >
                <button
                  type="button"
                  onClick={(event) => handleDeleteForm(event, form)}
                  disabled={deletingFormKey === form.formKey}
                  aria-label={`Supprimer ${form.title || form.formKey}`}
                  title="Supprimer le formulaire"
                  className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-300 transition-all hover:border-rose-300/40 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
                >
                  {deletingFormKey === form.formKey ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
                <div
                  className={`shrink-0 flex items-center justify-center rounded-3xl transition-transform group-hover:scale-110 ${
                    viewMode === 'grid'
                      ? 'w-16 h-16 bg-blue-500/10 text-blue-400 mb-6'
                      : 'w-14 h-14 bg-blue-500/10 text-blue-400'
                  }`}
                >
                  <FileText size={viewMode === 'grid' ? 32 : 28} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-black text-white truncate group-hover:text-blue-200 transition-colors">
                      {form.title || form.formKey}
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-slate-500 mb-4 line-clamp-2">
                    {form.formKey} • Version {form.formVersion ?? 'N/A'}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-wider text-slate-400 border border-white/5">
                      {form.engine === 'ged-os-xlsform-universal'
                        ? 'Moteur Universel'
                        : 'Moteur Natif'}
                    </span>
                    <div className="p-2 rounded-full bg-blue-500/0 text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <div className="mt-12 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl">
              <CloudOff size={24} />
            </div>
            <div>
              <h4 className="text-amber-100 font-black uppercase tracking-wider text-sm">
                Mode Hors-ligne Actif
              </h4>
              <p className="text-amber-200/60 text-sm font-medium">
                Vous travaillez actuellement sur les formulaires mis en cache. Les soumissions
                seront synchronisées dès le retour de la connexion.
              </p>
            </div>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
};

export default GedOsCollectPage;
