import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Edit3,
  Trash2,
  Save,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { templateService, type ProjectTemplate } from '@services/templateService';
import { getAllModules } from '@core/kernel/registry';

export const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProjectTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await templateService.list();
      setTemplates(data);
    } catch {
      toast.error('Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleSave = async (form: Partial<ProjectTemplate>) => {
    try {
      if (isNew) {
        await templateService.create({
          key: form.key || form.name?.toLowerCase().replace(/\s+/g, '_') || '',
          name: form.name || '',
          description: form.description,
          config: { client: form.client, defaultSettings: form.defaultSettings, icon: form.icon, category: form.category, defaultUsers: form.defaultUsers },
          modules: form.defaultModules,
        });
        toast.success('Template créé');
      } else if (editing?.id) {
        await templateService.update(editing.id, form);
        toast.success('Template mis à jour');
      }
      setEditing(null);
      setIsNew(false);
      loadTemplates();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce template définitivement ?')) return;
    try {
      await templateService.remove(id);
      toast.success('Template supprimé');
      loadTemplates();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const allModules = getAllModules();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Gestion des Templates</h2>
          <p className="text-sm text-slate-400 mt-1">Créez et gérez les modèles de projets réutilisables</p>
        </div>
        <button
          onClick={() => { setEditing({ id: '', key: '', name: '', description: '', client: '', defaultModules: [], defaultUsers: [], defaultSettings: {}, icon: 'FileText', category: 'energy' }); setIsNew(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all"
        >
          <Plus size={16} /> Nouveau Template
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 opacity-40">
          <FileText size={48} className="mx-auto mb-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-500">Aucun template. Créez-en un !</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">{tpl.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing({ ...tpl }); setIsNew(false); }} className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-white/5 transition-all">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(tpl.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(tpl.defaultModules || []).map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-[9px] font-bold uppercase tracking-wider">{m}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Client: {tpl.client || 'Générique'}</span>
                <span>{tpl.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <TemplateForm
            template={editing}
            isNew={isNew}
            allModules={allModules}
            onSave={handleSave}
            onClose={() => { setEditing(null); setIsNew(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TemplateForm: React.FC<{
  template: Partial<ProjectTemplate>;
  isNew: boolean;
  allModules: any[];
  onSave: (tpl: Partial<ProjectTemplate>) => void;
  onClose: () => void;
}> = ({ template, isNew, allModules, onSave, onClose }) => {
  const [form, setForm] = useState({ ...template });
  const [selectedModules, setSelectedModules] = useState<string[]>(template.defaultModules || []);

  const toggleModule = (key: string) => {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, defaultModules: selectedModules });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed inset-0 z-[101] flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isNew ? 'Nouveau Template' : 'Modifier le Template'}
            </h3>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nom</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Ex: GEM Électrification"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full mt-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Client</label>
                <input
                  type="text"
                  value={form.client || ''}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  className="w-full mt-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Catégorie</label>
                <select
                  value={form.category || 'energy'}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full mt-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="energy">Énergie</option>
                  <option value="consulting">Consulting</option>
                  <option value="construction">Construction</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Modules activés</label>
              <div className="grid grid-cols-3 gap-2">
                {allModules
                  .filter((m) => m.category !== 'ADMIN' && m.category !== 'PROJECTS' && m.category !== 'UTILITAIRE')
                  .filter((m) => m.key !== 'home' && m.key !== 'help')
                  .map((mod) => (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => toggleModule(mod.key)}
                      className={`p-3 rounded-xl border text-left text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        selectedModules.includes(mod.key)
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                          : 'bg-white/[0.03] border-white/5 text-slate-500 hover:border-white/10'
                      }`}
                    >
                      {mod.name}
                    </button>
                  ))}
              </div>
            </div>
          </form>

          <div className="flex gap-3 p-6 border-t border-white/5">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              className="flex-[2] py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
            >
              <Save size={14} /> {isNew ? 'Créer le Template' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
