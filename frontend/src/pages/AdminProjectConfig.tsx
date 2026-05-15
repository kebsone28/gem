import React, { useEffect, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';
import toast from 'react-hot-toast';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { Layout, Database, Plus, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface Page {
  id: string;
  title: string;
  slug: string;
  config?: any;
}

interface Module {
  id: string;
  name: string;
  key: string;
  config?: any;
}

export default function AdminProjectConfig() {
  const { project, activeProjectId } = useProject();
  const [pages, setPages] = useState<Page[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    (async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          apiClient.get(`/projects/${activeProjectId}/pages`),
          apiClient.get(`/projects/${activeProjectId}/modules`),
        ]);
        setPages(Array.isArray(pRes.data) ? pRes.data : pRes.data.pages || []);
        setModules(Array.isArray(mRes.data) ? mRes.data : mRes.data.modules || []);
      } catch (err: any) {
        toast.error('Erreur lors du chargement de la configuration du projet');
      } finally {
        setLoading(false);
      }
    })();
  }, [activeProjectId]);

  const createPage = async () => {
    if (!activeProjectId) return toast.error('Aucun projet actif');
    try {
      const res = await apiClient.post(`/projects/${activeProjectId}/pages`, {
        title: 'Nouvelle page',
        slug: `page-${Date.now()}`,
        config: {},
      });
      setPages((prev) => [res.data, ...prev]);
      toast.success('Page créée');
    } catch (err: any) {
      toast.error('Impossible de créer la page');
    }
  };

  const createModule = async () => {
    if (!activeProjectId) return toast.error('Aucun projet actif');
    try {
      const res = await apiClient.post(`/projects/${activeProjectId}/modules`, {
        name: 'Nouveau module',
        key: `module_${Date.now()}`,
        config: {},
      });
      setModules((prev) => [res.data, ...prev]);
      toast.success('Module créé');
    } catch (err: any) {
      toast.error('Impossible de créer le module');
    }
  };

  if (!project) {
    return (
      <PageContainer className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Settings size={48} className="text-slate-700 mx-auto" />
          <h2 className="text-xl font-bold text-white">Aucun projet actif</h2>
          <p className="text-sm text-slate-400">Sélectionnez ou créez un projet pour configurer ses pages et modules.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="Architecture Projet"
        subtitle={`Configuration fine de l'écosystème : ${project.name}`}
        icon={<Layout size={24} className="text-blue-400" />}
      />

      <ContentArea className="mt-8 space-y-10 p-0 bg-transparent border-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PAGES SECTION */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Layout size={20} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Pages Natives</h3>
              </div>
              <button
                onClick={createPage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus size={14} /> Créer
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : pages.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest italic">Aucune page définie</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pages.map((p) => (
                  <motion.li
                    key={p.id}
                    whileHover={{ x: 4 }}
                    className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all"
                  >
                    <div>
                      <div className="font-black text-sm text-white group-hover:text-blue-400 transition-colors">{p.title}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{p.slug}</div>
                    </div>
                    <div className="px-2 py-1 bg-blue-500/10 rounded-lg text-[8px] font-black text-blue-400 uppercase tracking-tighter">PAGE ACTIVE</div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>

          {/* MODULES SECTION */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Modules Core</h3>
              </div>
              <button
                onClick={createModule}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus size={14} /> Créer
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : modules.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest italic">Aucun module défini</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {modules.map((m) => (
                  <motion.li
                    key={m.id}
                    whileHover={{ x: 4 }}
                    className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-all"
                  >
                    <div>
                      <div className="font-black text-sm text-white group-hover:text-emerald-400 transition-colors">{m.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{m.key}</div>
                    </div>
                    <div className="px-2 py-1 bg-emerald-500/10 rounded-lg text-[8px] font-black text-emerald-400 uppercase tracking-tighter">CORE MODULE</div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
