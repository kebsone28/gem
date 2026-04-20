/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useEffect } from 'react';
import { CloudDownload, Save, RefreshCw, Zap, Database, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';

export function KoboSettingsSection({ project, onUpdate }: { project: any; onUpdate: any }) {
  const defaultKoboConfig = {
    token: '',
    assetUid: '',
  };

  const [config, setConfig] = useState(project?.config?.kobo || defaultKoboConfig);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project?.config?.kobo) {
      setConfig(project.config.kobo);
    } else {
      setConfig(defaultKoboConfig);
    }
  }, [project?.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        config: {
          ...project.config,
          kobo: config,
        },
      });
      toast.success('Configuration KoBo enregistrée !');
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-xl shadow-indigo-500/10">
            <CloudDownload className="text-indigo-400" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight italic flex items-center gap-3">
              Synchronisation KoBoToolbox
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] text-indigo-400 font-bold tracking-[0.2em]">
                MULTI-TENANT ISOLÉ
              </div>
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              Isolation totale par espace de travail
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
        >
          {isSaving ? (
            <RefreshCw className="animate-spin" size={16} />
          ) : (
            <Save size={16} className="group-hover:translate-y-[-2px] transition-transform" />
          )}
          {isSaving ? 'Enregistrement...' : 'Appliquer les identifiants'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] pointer-events-none rounded-full" />

            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                  <Zap className="text-indigo-400" size={20} />
                </div>
                <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest">
                  Configuration des Identifiants (API Token)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Kobo API Token
                  </label>
                  <div className="relative group">
                    <input
                      type="password"
                      value={config.token}
                      onChange={(e) => setConfig({ ...config, token: e.target.value })}
                      placeholder="Ex: 7a83b..."
                      className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-indigo-100 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 font-medium italic">
                    Ce token permet d'accéder à vos formulaires KoBoToolbox de manière sécurisée.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Kobo Asset UID (Form ID)
                  </label>
                  <input
                    type="text"
                    value={config.assetUid}
                    onChange={(e) => setConfig({ ...config, assetUid: e.target.value })}
                    placeholder="Ex: aEYZwPuj..."
                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-4 text-sm text-indigo-100 placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                  />
                  <p className="text-[9px] text-slate-600 font-medium italic">
                    L'identifiant unique du formulaire source pour ce projet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-[2.5rem] p-8 flex items-start gap-6">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <Database className="text-indigo-400" size={24} />
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-black text-white uppercase tracking-widest">
                Validation de connexion
              </h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase">
                Testez la validité de vos identifiants avant l'enregistrement final.
              </p>
              <button
                onClick={async () => {
                  if (!config.token || !config.assetUid)
                    return toast.error('Veuillez remplir les deux champs.');
                  toast.loading('Test de connexion en cours...', { id: 'kobo-test' });
                  try {
                    const res = await apiClient.post('kobo/test-connection', config);
                    if (res.data.success) {
                      toast.success(`Connexion réussie ! Formulaire: ${res.data.formName}`, {
                        id: 'kobo-test',
                      });
                    } else {
                      toast.error('Échec de la connexion.', { id: 'kobo-test' });
                    }
                  } catch (err) {
                    toast.error('Erreur serveur lors du test.', { id: 'kobo-test' });
                  }
                }}
                className="mt-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] transition-colors"
              >
                <RefreshCw size={14} />
                Lancer un test de connexion
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div className="flex items-center gap-3">
              <CloudDownload className="text-indigo-500" size={18} />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                Guide d isolation
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase">
              Chaque projet (Tenant) possède sa propre clé API. Cela garantit que les données d'un
              projet ne sont jamais mélangées avec celles d'un autre.
            </p>
            <div className="pt-4 space-y-4">
              <div className="flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase italic">
                <ChevronRight size={14} className="text-indigo-600 shrink-0" />
                Ces identifiants sont spécifiques au projet{' '}
                <span className="text-indigo-400">"{project?.name}"</span>.
              </div>
              <div className="flex items-start gap-3 text-[10px] font-bold text-slate-500 uppercase italic">
                <ChevronRight size={14} className="text-indigo-600 shrink-0" />
                Si laissés vides, le système utilisera les paramètres globaux (.env) comme secours.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
