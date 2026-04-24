import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Palette,
  Mail,
  GitBranch,
  Save,
  Upload,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ShieldCheck,
  BellRing,
  Box,
  Globe,
  Users,
  Briefcase,
  Award,
  Zap,
  Check,
  ArrowRight,
  Camera,
  BarChart2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { toast } from 'react-hot-toast';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TERRAIN_FEATURE_DEFS,
  type TerrainFeatureConfig,
  type TerrainFeatureKey,
} from '../constants/terrainFeatures';

interface WorkflowStep {
  role: string;
  label: string;
  sequence: number;
}
interface OrgConfig {
  branding?: {
    logo?: string;
    primaryColor?: string;
    footerText?: string;
    organizationName?: string;
  };
  notifications?: { auditEmails?: string[]; workflowAlerts?: boolean };
  workflow?: { missionSteps?: WorkflowStep[] };
  labels?: {
    household?: { singular: string; plural: string };
    zone?: { singular: string; plural: string };
  };
  features?: { koboTerminal?: boolean };
  terrainFeatures?: TerrainFeatureConfig;
}

type TabId = 'branding' | 'notifications' | 'workflow' | 'labels' | 'features';

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'branding', label: 'Identité', icon: Palette, color: 'blue' },
  { id: 'notifications', label: 'Notifications', icon: BellRing, color: 'emerald' },
  { id: 'workflow', label: 'Workflow', icon: GitBranch, color: 'amber' },
  { id: 'labels', label: 'Glossaire', icon: Box, color: 'indigo' },
  { id: 'features', label: 'Modules', icon: Zap, color: 'violet' },
];

// COLOR_MAP removed (unused)

function Toggle({
  checked,
  onChange,
  color = 'blue',
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-600',
  };
  return (
    <button
      onClick={onChange}
      title={checked ? 'Désactiver' : 'Activer'}
      aria-label={checked ? 'Désactiver' : 'Activer'}
      className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none ${checked ? colors[color] || colors.blue : 'bg-slate-700'}`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${checked ? 'translate-x-7' : 'translate-x-0'}`}
      />
    </button>
  );
}

export default function OrganizationSettings() {
  const { user, login } = useAuth();
  const [config, setConfig] = useState<OrgConfig>({});
  const [stats, setStats] = useState({ households: 0, teams: 0, users: 0, zones: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [newEmail, setNewEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [cfgRes, hhRes, teamsRes, usersRes, zonesRes] = await Promise.allSettled([
          apiClient.get('/organization/config'),
          apiClient.get('/households/count'),
          apiClient.get('/teams'),
          apiClient.get('/users'),
          apiClient.get('/zones'),
        ]);
        if (cfgRes.status === 'fulfilled') setConfig(cfgRes.value.data.config || {});
        setStats({
          households:
            hhRes.status === 'fulfilled'
              ? hhRes.value.data.total || hhRes.value.data.count || 0
              : 0,
          teams: teamsRes.status === 'fulfilled' ? teamsRes.value.data.teams?.length || 0 : 0,
          users:
            usersRes.status === 'fulfilled'
              ? usersRes.value.data.users?.length || usersRes.value.data.data?.length || 0
              : 0,
          zones: zonesRes.status === 'fulfilled' ? zonesRes.value.data.zones?.length || 0 : 0,
        });
      } catch {
        toast.error('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch('/organization/config', { config });
      toast.success('Configuration sauvegardée ✓');
      if (user)
        login(user.email, user.role, user.name, user.organization, user.id, undefined, config);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const updateBranding = (field: string, value: string) =>
    setConfig((prev) => ({ ...prev, branding: { ...(prev.branding || {}), [field]: value } }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Fichier trop lourd (max 2 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => updateBranding('logo', reader.result as string);
    reader.readAsDataURL(file);
  };

  const updateLabel = (type: 'household' | 'zone', field: 'singular' | 'plural', value: string) =>
    setConfig((prev) => ({
      ...prev,
      labels: {
        ...(prev.labels || {}),
        [type]: { ...(prev.labels?.[type] || { singular: '', plural: '' }), [field]: value },
      },
    }));

  const toggleFeature = (feature: keyof NonNullable<OrgConfig['features']>) =>
    setConfig((prev) => ({
      ...prev,
      features: { ...(prev.features || {}), [feature]: !prev.features?.[feature] },
    }));

  const toggleTerrainFeature = (feature: TerrainFeatureKey) =>
    setConfig((prev) => ({
      ...prev,
      terrainFeatures: {
        ...(prev.terrainFeatures || {}),
        [feature]: !prev.terrainFeatures?.[feature],
      },
    }));

  const addAuditEmail = () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Email invalide');
      return;
    }
    setConfig((prev) => {
      const n = prev.notifications || {};
      return {
        ...prev,
        notifications: { ...n, auditEmails: [...(n.auditEmails || []), newEmail] },
      };
    });
    setNewEmail('');
  };

  const removeAuditEmail = (email: string) =>
    setConfig((prev) => ({
      ...prev,
      notifications: {
        ...(prev.notifications || {}),
        auditEmails: (prev.notifications?.auditEmails || []).filter((e) => e !== email),
      },
    }));

  const addWorkflowStep = () => {
    const role = prompt('Rôle (ex: COMPTABLE) :');
    const label = prompt('Nom (ex: Validation Comptable) :');
    if (role && label) {
      setConfig((prev) => {
        const wf = prev.workflow || {};
        const steps = wf.missionSteps || [];
        return {
          ...prev,
          workflow: {
            ...wf,
            missionSteps: [
              ...steps,
              { role: role.toUpperCase(), label, sequence: steps.length + 1 },
            ],
          },
        };
      });
    }
  };

  const removeWorkflowStep = (i: number) =>
    setConfig((prev) => ({
      ...prev,
      workflow: {
        ...(prev.workflow || {}),
        missionSteps: (prev.workflow?.missionSteps || [])
          .filter((_, idx) => idx !== i)
          .map((s, idx) => ({ ...s, sequence: idx + 1 })),
      },
    }));

  const moveStep = (i: number, dir: 'up' | 'down') =>
    setConfig((prev) => {
      const steps = [...(prev.workflow?.missionSteps || [])];
      if (dir === 'up' && i > 0) [steps[i], steps[i - 1]] = [steps[i - 1], steps[i]];
      else if (dir === 'down' && i < steps.length - 1)
        [steps[i], steps[i + 1]] = [steps[i + 1], steps[i]];
      return {
        ...prev,
        workflow: {
          ...(prev.workflow || {}),
          missionSteps: steps.map((s, idx) => ({ ...s, sequence: idx + 1 })),
        },
      };
    });

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );

  const orgName = config.branding?.organizationName || user?.organization || 'Organisation';
  const primaryColor = config.branding?.primaryColor || '#1e90ff';

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-4 sm:py-8">
      <PageHeader
        title={orgName}
        subtitle="Personnalisez l'identité et les processus de votre espace de travail"
        icon={<Building2 size={24} className="text-blue-500" />}
        actions={
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 sm:px-6 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] sm:text-xs rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95 uppercase tracking-[0.08em]"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? 'SAUVEGARDE...' : 'ENREGISTRER'}
          </button>
        }
      />

      <ContentArea className="mt-6 sm:mt-8 !p-0 !bg-transparent border-none space-y-6 sm:space-y-8">
        {/* ══ ORG PROFILE CARD ══ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[1.6rem] sm:rounded-[2rem] border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950"
        >
          {/* Background gradient blob */}
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10 blur-3xl org-blob"
            data-primary-color={primaryColor}
          />

            <div className="relative p-4 sm:p-8 flex flex-col lg:flex-row gap-6 sm:gap-8 items-start lg:items-center">
            {/* Logo / Avatar */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.25rem] sm:rounded-[1.5rem] border-2 border-white/10 bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xl">
                {config.branding?.logo ? (
                  <img
                    src={config.branding.logo}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Building2 size={36} className="text-slate-500" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Changer le logo"
                aria-label="Changer le logo"
                className="absolute inset-0 rounded-[1.25rem] sm:rounded-[1.5rem] bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
              >
                <Camera size={20} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                title="Uploader un logo"
                aria-label="Uploader un logo"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {/* Online dot */}
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 shadow" />
            </div>

            {/* Org Info */}
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={config.branding?.organizationName || ''}
                onChange={(e) => updateBranding('organizationName', e.target.value)}
                placeholder="Nom de l'organisation"
                className="text-xl sm:text-2xl font-black text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-blue-500 outline-none transition-all w-full max-w-md pb-1"
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Globe size={12} /> <span>{user?.organization || "Afrique de l'Ouest"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  <Briefcase size={12} /> <span>Plan Enterprise</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-full text-[10px] sm:text-xs font-black text-blue-400 border border-blue-500/20 uppercase tracking-[0.06em]">
                  <Award size={10} /> GEM Premium
                </span>
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:flex-shrink-0 w-full lg:w-auto">
              {[
                {
                  label: 'Ménages',
                  value: stats.households.toLocaleString(),
                  icon: Users,
                  color: 'blue',
                },
                { label: 'Équipes', value: stats.teams, icon: Briefcase, color: 'emerald' },
                { label: 'Utilisateurs', value: stats.users, icon: Lock, color: 'violet' },
                { label: 'Zones', value: stats.zones, icon: BarChart2, color: 'amber' },
              ].map((s) => (
                <div
                  key={s.label}
                    className="flex flex-col items-center p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/5 min-w-[80px] hover:bg-white/8 transition-all"
                  >
                  <s.icon size={16} className={`text-${s.color}-400 mb-1`} />
                  <div className="text-lg sm:text-xl font-black text-white">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em] sm:tracking-widest text-center">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Color strip at bottom */}
          <div
            className="h-1 w-full bg-gradient-to-r from-[var(--org-primary)] to-transparent color-strip"
            data-primary-color={primaryColor}
          />
        </motion.div>

        {/* ══ MAIN PANEL ══ */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Sidebar Tabs */}
            <div className="lg:col-span-1 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:sticky lg:top-[6.5rem]">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 min-h-[48px] rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-widest transition-all border ${
                      active
                      ? `bg-white/10 text-white border-white/10 shadow-xl`
                      : 'bg-white/3 text-slate-400 border-transparent hover:bg-white/7 hover:text-white'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg ${active ? `bg-${tab.color}-500/20 text-${tab.color}-400` : 'bg-white/5 text-slate-500'}`}
                  >
                    <tab.icon size={14} />
                  </div>
                  <span className="flex-1 text-left">{tab.label}</span>
                  {active && <ArrowRight size={12} className="opacity-50" />}
                  </button>
                );
              })}
              </div>

              {/* Quick save shortcut */}
              <div className="pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] bg-blue-600/20 hover:bg-blue-600 border border-blue-600/30 text-blue-400 hover:text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.08em] sm:tracking-widest rounded-2xl transition-all disabled:opacity-50"
                >
                  <Save size={14} />
                  Enregistrer
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="bg-slate-900/60 backdrop-blur border border-white/5 rounded-[1.6rem] sm:rounded-[2rem] p-4 sm:p-8 min-h-[500px]"
              >
                {/* ── BRANDING ── */}
                {activeTab === 'branding' && (
                  <div className="space-y-8">
                    <SectionHeader
                      icon={<Palette className="text-blue-400" />}
                      title="Identité Visuelle"
                      color="blue"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                      {/* Logo */}
                      <div className="space-y-3">
                        <FieldLabel>Logo (max 2 Mo)</FieldLabel>
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="h-32 sm:h-36 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group relative overflow-hidden"
                        >
                          {config.branding?.logo ? (
                            <img
                              src={config.branding.logo}
                              alt="Logo"
                              className="absolute inset-0 w-full h-full object-contain p-4"
                            />
                          ) : (
                            <>
                              <Upload
                                size={24}
                                className="text-slate-600 group-hover:text-blue-400 transition-colors"
                              />
                              <span className="text-xs font-bold text-slate-500 group-hover:text-blue-400">
                                Cliquer pour importer
                              </span>
                            </>
                          )}
                        </div>
                        {config.branding?.logo && (
                          <button
                            onClick={() => updateBranding('logo', '')}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest"
                          >
                            Supprimer le logo
                          </button>
                        )}
                      </div>

                      {/* Color */}
                      <div className="space-y-3">
                        <FieldLabel>Couleur Primaire</FieldLabel>
                        <div className="flex gap-3 items-center">
                          <input
                            type="color"
                            title="Couleur primaire"
                            value={config.branding?.primaryColor || '#1e90ff'}
                            onChange={(e) => updateBranding('primaryColor', e.target.value)}
                          className="w-12 h-12 sm:w-14 sm:h-14 cursor-pointer rounded-2xl border-none bg-transparent overflow-hidden flex-shrink-0"
                          />
                          <input
                            type="text"
                            title="Code hexadécimal"
                            placeholder="#1e90ff"
                            value={config.branding?.primaryColor || '#1e90ff'}
                            onChange={(e) => updateBranding('primaryColor', e.target.value)}
                          className="flex-1 bg-slate-800 border border-white/5 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-white font-mono text-sm uppercase focus:ring-2 focus:ring-blue-500/30 outline-none"
                          />
                        </div>

                        {/* Color Palette presets */}
                        <div className="flex gap-2 pt-1 flex-wrap">
                          {['#1e90ff', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'].map(
                            (c) => (
                              <button
                                key={c}
                                title={c}
                                onClick={() => updateBranding('primaryColor', c)}
                                data-color-preset={c}
                                className={`w-7 h-7 rounded-full border-2 transition-all color-preset-btn ${config.branding?.primaryColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                              />
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer text */}
                    <div className="space-y-3">
                      <FieldLabel>Pied de Page (PDF & Factures)</FieldLabel>
                      <textarea
                        value={config.branding?.footerText || ''}
                        onChange={(e) => updateBranding('footerText', e.target.value)}
                        rows={3}
                        placeholder="Ex: PROQUELEC S.A - Dakar, Sénégal - RCCM SN-DKR-..."
                        className="w-full bg-slate-800 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-blue-500/30 outline-none resize-none"
                      />
                    </div>

                    <InfoBox color="blue" icon={<ShieldCheck size={18} />}>
                      Ces réglages remplacent le branding GEM SAAS par défaut pour tous vos
                      collaborateurs.
                    </InfoBox>
                  </div>
                )}

                {/* ── NOTIFICATIONS ── */}
                {activeTab === 'notifications' && (
                  <div className="space-y-8">
                    <SectionHeader
                      icon={<Mail className="text-emerald-400" />}
                      title="Audit & Notifications"
                      color="emerald"
                    />

                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <FieldLabel>Emails en Copie (Audit)</FieldLabel>
                        <span className="text-xs text-slate-500">
                          {config.notifications?.auditEmails?.length || 0} adresse(s)
                        </span>
                      </div>

                      {/* Add email inline */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addAuditEmail()}
                          placeholder="email@organisation.com"
                          className="flex-1 min-h-[48px] bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-emerald-500/30 outline-none"
                        />
                        <button
                          onClick={addAuditEmail}
                          className="px-4 py-3 min-h-[48px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <AnimatePresence>
                          {config.notifications?.auditEmails?.map((email) => (
                            <motion.div
                              key={email}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                  <Mail size={12} className="text-emerald-400" />
                                </div>
                                <span className="text-sm font-bold text-white truncate">
                                  {email}
                                </span>
                              </div>
                              <button
                                onClick={() => removeAuditEmail(email)}
                                title="Supprimer cet email"
                                className="text-slate-600 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {(!config.notifications?.auditEmails ||
                          config.notifications.auditEmails.length === 0) && (
                          <div className="col-span-full py-10 text-center border-2 border-dashed border-white/5 rounded-2xl text-slate-600 text-xs font-bold uppercase italic">
                            Aucun email d'audit configuré
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white/3 rounded-2xl border border-white/5">
                        <div>
                          <h4 className="text-sm font-black text-white">
                            Alertes Workflow Temps Réel
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Notifier les valideurs dès qu'une action est requise.
                          </p>
                        </div>
                        <Toggle
                          checked={config.notifications?.workflowAlerts !== false}
                          onChange={() =>
                            setConfig((prev) => ({
                              ...prev,
                              notifications: {
                                ...(prev.notifications || {}),
                                workflowAlerts: config.notifications?.workflowAlerts === false,
                              },
                            }))
                          }
                          color="emerald"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── WORKFLOW ── */}
                {activeTab === 'workflow' && (
                  <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <SectionHeader
                        icon={<GitBranch className="text-amber-400" />}
                        title="Processus de Validation"
                        color="amber"
                      />
                      <button
                        onClick={addWorkflowStep}
                        className="px-4 py-3 min-h-[48px] bg-amber-500 hover:bg-amber-400 text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Plus size={14} /> Étape
                      </button>
                    </div>

                    <div className="relative space-y-3">
                      {/* Vertical connector */}
                      {(config.workflow?.missionSteps?.length || 0) > 1 && (
                        <div className="absolute left-[1.85rem] top-10 bottom-10 w-0.5 bg-amber-500/20 z-0" />
                      )}
                      <AnimatePresence>
                        {config.workflow?.missionSteps?.map((step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="relative z-10 flex items-center gap-4 p-5 bg-slate-800/60 rounded-2xl border border-white/5 group hover:border-amber-500/40 transition-all"
                          >
                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                              {step.sequence}
                            </div>
                            <div className="flex-1">
                              <div className="font-black text-sm text-white">{step.label}</div>
                              <div className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest mt-0.5">
                                {step.role}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => moveStep(i, 'up')}
                                disabled={i === 0}
                                title="Monter"
                                className="p-1.5 text-slate-500 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5"
                              >
                                <MoveUp size={14} />
                              </button>
                              <button
                                onClick={() => moveStep(i, 'down')}
                                disabled={i === (config.workflow?.missionSteps?.length || 0) - 1}
                                title="Descendre"
                                className="p-1.5 text-slate-500 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5"
                              >
                                <MoveDown size={14} />
                              </button>
                              <button
                                onClick={() => removeWorkflowStep(i)}
                                title="Supprimer"
                                className="p-1.5 text-slate-500 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 ml-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {(!config.workflow?.missionSteps ||
                        config.workflow.missionSteps.length === 0) && (
                        <div className="py-14 text-center border-2 border-dashed border-white/5 rounded-2xl space-y-3">
                          <GitBranch size={36} className="text-white/5 mx-auto" />
                          <p className="text-slate-500 text-xs font-bold uppercase italic">
                            Workflow par défaut (Chef → Comptable → DG)
                          </p>
                        </div>
                      )}
                    </div>

                    <InfoBox color="amber" icon={<BellRing size={16} />}>
                      Les changements s'appliquent aux nouvelles missions uniquement.
                    </InfoBox>
                  </div>
                )}

                {/* ── LABELS ── */}
                {activeTab === 'labels' && (
                  <div className="space-y-8">
                    <SectionHeader
                      icon={<Box className="text-indigo-400" />}
                      title="Glossaire Métier"
                      color="indigo"
                    />

                    <InfoBox color="indigo" icon={<ShieldCheck size={16} />}>
                      Adaptez GEM à votre secteur. Remplacez "Ménage" par "Pylône", "Site", "École"
                      ou "Client".
                    </InfoBox>

                    {[
                      {
                        key: 'household' as const,
                        label: 'Entité Opérationnelle (ex: Ménage)',
                        singular: 'Ménage',
                        plural: 'Ménages',
                      },
                      {
                        key: 'zone' as const,
                        label: 'Unité de Secteur (ex: Zone)',
                        singular: 'Zone',
                        plural: 'Zones',
                      },
                    ].map((item) => (
                      <div key={item.key} className="space-y-4">
                        <h4 className="text-[11px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.08em] sm:tracking-widest border-b border-white/5 pb-3">
                          {item.label}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(['singular', 'plural'] as const).map((field) => (
                            <div key={field} className="space-y-2">
                              <FieldLabel>
                                {field === 'singular' ? 'Singulier' : 'Pluriel'}
                              </FieldLabel>
                              <input
                                type="text"
                                placeholder={`Ex: ${field === 'singular' ? item.singular : item.plural}`}
                                value={config.labels?.[item.key]?.[field] || ''}
                                onChange={(e) => updateLabel(item.key, field, e.target.value)}
                                className="w-full bg-slate-800 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── FEATURES ── */}
                {activeTab === 'features' && (
                  <div className="space-y-8">
                    <SectionHeader
                      icon={<Zap className="text-violet-400" />}
                      title="Activation des Modules"
                      color="violet"
                    />

                    <div className="space-y-4">
                      {[
                        {
                          key: 'koboTerminal' as const,
                          title: 'Terminal KoboToolbox',
                          desc: 'Accès au terminal de synchronisation brute pour les agents habilités.',
                          color: 'blue',
                          icon: <Globe size={18} className="text-blue-400" />,
                        },
                      ].map((feat) => (
                        <div
                          key={feat.key}
                          className="flex items-start gap-5 p-6 bg-slate-800/50 rounded-2xl border border-white/5 hover:border-violet-500/20 transition-all"
                        >
                          <div className="p-3 bg-white/5 rounded-xl flex-shrink-0">{feat.icon}</div>
                          <div className="flex-1">
                            <h4 className="font-black text-sm text-white">{feat.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {feat.desc}
                            </p>
                          </div>
                          <Toggle
                            checked={!!config.features?.[feat.key]}
                            onChange={() => toggleFeature(feat.key)}
                            color={feat.color}
                          />
                        </div>
                      ))}

                      <div className="mt-8 space-y-4">
                        <h4 className="text-[11px] sm:text-xs font-black text-violet-400 uppercase tracking-[0.08em] sm:tracking-widest">
                          Console Terrain
                        </h4>
                        <InfoBox color="violet" icon={<Lock size={16} />}>
                          Ces interrupteurs pilotent surtout la visibilité des fonctions terrain pour
                          les utilisateurs non administrateurs. Les admins conservent leurs outils
                          avancés pour support et contrôle.
                        </InfoBox>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {TERRAIN_FEATURE_DEFS.map((feature) => (
                            <div
                              key={feature.key}
                              className="flex items-start gap-5 p-5 bg-slate-800/50 rounded-2xl border border-white/5 hover:border-violet-500/20 transition-all"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-sm text-white">{feature.title}</h4>
                                  {feature.adminOnly ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-black uppercase tracking-[0.08em] text-amber-300 border border-amber-500/20">
                                      Admin
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  {feature.desc}
                                </p>
                              </div>
                              <Toggle
                                checked={!!config.terrainFeatures?.[feature.key]}
                                onChange={() => toggleTerrainFeature(feature.key)}
                                color="violet"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Placeholder for future modules */}
                      <div className="flex items-center gap-4 p-6 bg-white/3 rounded-2xl border border-dashed border-white/5">
                        <div className="p-3 bg-white/5 rounded-xl">
                          <Plus size={18} className="text-slate-600" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-600">Nouveaux modules</h4>
                          <p className="text-xs text-slate-700 mt-1">
                            D'autres fonctionnalités seront disponibles prochainement.
                          </p>
                        </div>
                      </div>

                      {/* Status Board */}
                      <div className="mt-6 p-6 bg-violet-500/5 border border-violet-500/10 rounded-2xl">
                        <h4 className="text-[11px] sm:text-xs font-black text-violet-400 uppercase tracking-[0.08em] sm:tracking-widest mb-4">
                          État des Modules
                        </h4>
                        <div className="space-y-2">
                          {[
                            { name: 'Simulation Financière', active: true },
                            {
                              name: 'Synchronisation Kobo',
                              active: !!config.features?.koboTerminal,
                            },
                            { name: 'Bordereau de Paiement', active: true },
                            { name: 'Ordres de Mission', active: true },
                          ].map((m) => (
                            <div
                              key={m.name}
                              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                            >
                              <span className="text-xs font-bold text-slate-400">{m.name}</span>
                              <div
                                className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${m.active ? 'text-emerald-400' : 'text-slate-600'}`}
                              >
                                {m.active ? (
                                  <>
                                    <Check size={10} /> Actif
                                  </>
                                ) : (
                                  <>
                                    <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />{' '}
                                    Inactif
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}

// ── Shared micro-components ──

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2.5 bg-white/5 rounded-xl">{icon}</div>
      <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {children}
    </label>
  );
}

function InfoBox({
  icon,
  children,
  color,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/5 border-blue-500/10 text-blue-400',
    amber: 'bg-amber-500/5 border-amber-500/10 text-amber-400/80',
    indigo: 'bg-indigo-500/5 border-indigo-500/10 text-indigo-400',
    violet: 'bg-violet-500/5 border-violet-500/10 text-violet-400',
  };
  return (
    <div
      className={`flex items-start gap-3 p-5 rounded-2xl border ${colors[color] || colors.blue}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <p className="text-xs leading-relaxed font-medium opacity-80">{children}</p>
    </div>
  );
}
