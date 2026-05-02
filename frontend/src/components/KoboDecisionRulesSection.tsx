
import { useState } from 'react';
import { Plus, Trash2, AlertTriangle, Settings2, Info } from 'lucide-react';
import { KOBO_TECHNICAL_QUESTIONS } from '../utils/koboFormCatalog';
import toast from 'react-hot-toast';

export function KoboDecisionRulesSection({ project, onUpdate }: { project: any; onUpdate: any }) {
  const [rules, setRules] = useState<any[]>(project?.config?.kobo_decision_rules || []);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddRule = () => {
    const newRule = {
      id: Math.random().toString(36).substring(7),
      field: KOBO_TECHNICAL_QUESTIONS[0].id,
      operator: 'contains',
      value: KOBO_TECHNICAL_QUESTIONS[0].options[0].id,
      action: 'SET_STATUS',
      status: 'Non conforme',
      alert: 'Défaut technique détecté via Kobo',
      severity: 'HIGH'
    };
    setRules([...rules, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleUpdateRule = (id: string, updates: any) => {
    setRules(rules.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleSaveRules = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        config: {
          ...project.config,
          kobo_decision_rules: rules
        }
      });
      toast.success('Règles de conclusion enregistrées !');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 mt-16 pt-16 border-t border-white/5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-600/20 rounded-2xl flex items-center justify-center border border-amber-500/30 shadow-xl shadow-amber-500/10">
            <Settings2 className="text-amber-400" size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight italic flex items-center gap-3">
              Moteur de Conclusion Automatique
              <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] text-amber-400 font-bold tracking-[0.2em]">
                BETA
              </div>
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              Définir la logique métier basée sur les réponses Kobo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button
                onClick={handleAddRule}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all"
            >
                <Plus size={16} />
                Ajouter une règle
            </button>
            <button
                onClick={handleSaveRules}
                disabled={isSaving}
                className="flex items-center gap-3 px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl shadow-amber-600/20 disabled:opacity-50"
            >
                {isSaving ? 'Calcul...' : 'Enregistrer les règles'}
            </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="p-16 rounded-[3rem] border-2 border-dashed border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 opacity-40">
                <Info size={40} className="text-slate-500" />
            </div>
            <h4 className="text-slate-400 font-black uppercase tracking-widest text-sm mb-2">Aucune règle active</h4>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest max-w-sm leading-relaxed">
                Le système se contente d'importer les données sans modifier le statut automatiquement.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {rules.map((rule) => {
            const selectedQuestion = KOBO_TECHNICAL_QUESTIONS.find(q => q.id === rule.field);
            
            return (
              <div key={rule.id} className="relative p-8 rounded-[2.5rem] bg-slate-900/40 border border-white/5 hover:border-amber-500/20 transition-all group overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[60px] pointer-events-none rounded-full" />
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-end relative z-10">
                  {/* Condition */}
                  <div className="xl:col-span-4 space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Si la question :
                    </label>
                    <select
                      title="Sélectionner une question Kobo"
                      value={rule.field}
                      onChange={(e) => {
                        const qId = e.target.value;
                        const firstOpt = KOBO_TECHNICAL_QUESTIONS.find(q => q.id === qId)?.options[0].id;
                        handleUpdateRule(rule.id, { field: qId, value: firstOpt });
                      }}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-[11px] font-bold text-white focus:border-amber-500/50 outline-none"
                    >
                      {KOBO_TECHNICAL_QUESTIONS.map(q => (
                        <option key={q.id} value={q.id}>{q.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Value */}
                  <div className="xl:col-span-3 space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Contient la réponse :
                    </label>
                    <select
                      title="Valeur de la réponse attendue"
                      value={rule.value}
                      onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-[11px] font-bold text-amber-400 focus:border-amber-500/50 outline-none"
                    >
                      {selectedQuestion?.options.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action */}
                  <div className="xl:col-span-4 space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Alors Conclusion Finale :
                    </label>
                    <div className="flex gap-2">
                        <select
                        title="Statut de conclusion final"
                        value={rule.status}
                        onChange={(e) => handleUpdateRule(rule.id, { status: e.target.value })}
                        className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 text-[11px] font-black text-amber-300 uppercase outline-none"
                        >
                            <option value="Non conforme">Non conforme</option>
                            <option value="Non éligible">Non éligible</option>
                            <option value="En attente">En attente</option>
                            <option value="Conforme">Conforme</option>
                        </select>
                        <input
                            type="text"
                            value={rule.alert || ''}
                            onChange={(e) => handleUpdateRule(rule.id, { alert: e.target.value })}
                            placeholder="Message d'alerte..."
                            className="flex-[2] bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-[11px] font-bold text-slate-300 focus:border-amber-500/50 outline-none"
                        />
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="xl:col-span-1 pb-1">
                    <button
                      title="Supprimer cette règle"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-5">
        <Info className="text-indigo-400 mt-1" size={20} />
        <div className="space-y-1">
            <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Fonctionnement du moteur</h5>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">
                Les règles sont appliquées séquentiellement lors de chaque synchronisation. Si plusieurs règles s'appliquent, la dernière règle dans la liste aura le dernier mot sur le statut final.
            </p>
        </div>
      </div>
    </div>
  );
}
