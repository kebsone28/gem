/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, User, Settings, MapPin, 
  Trash2, AlertTriangle, Check, ChevronRight,
  Database, Users, Hash, Lock, LockOpen
} from 'lucide-react';
import type { Household } from '../../utils/types';
import { db } from '../../store/db';
import logger from '../../utils/logger';
import { getHouseholdDisplayName, stringifyHouseholdValue } from '../../utils/householdDisplay';

interface AdminControlCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  household: Household;
  onUpdate: (id: string, patch: Partial<Household>) => Promise<void>;
}

export const AdminControlCenterModal: React.FC<AdminControlCenterModalProps> = ({
  isOpen,
  onClose,
  household,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'social' | 'technical' | 'media' | 'logistics' | 'conflits'>('identity');
  const [formData, setFormData] = useState<Partial<Household>>(household);
  const [isSaving, setIsSaving] = useState(false);
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(household);
      loadZones();
    }
  }, [isOpen, household]);

  async function loadZones() {
    const allZones = await db.zones.toArray();
    setZones(allZones);
  }

  const manualOverrideFields = useMemo(
    () => Array.from(new Set(formData.manualOverrides || [])),
    [formData.manualOverrides]
  );

  const formatOverrideLabel = (path: string) => {
    const directLabels: Record<string, string> = {
      name: 'Nom complet',
      phone: 'Téléphone',
      latitude: 'Latitude',
      longitude: 'Longitude',
      numeroordre: "Numéro d'ordre",
      zoneId: 'Zone géographique',
      source: 'Source de données',
      'constructionData.preparateur': 'Préparation',
      'constructionData.livreur': 'Livraison',
      'constructionData.macon': 'Maçonnerie',
      'constructionData.reseau': 'Réseau',
      'constructionData.interieur': 'Installation intérieure',
      'constructionData.audit': 'Audit final',
    };

    if (directLabels[path]) return directLabels[path];

    return path
      .split('.')
      .filter(Boolean)
      .map((segment) =>
        segment
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      )
      .join(' / ');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(household.id, formData);
      onClose();
    } catch (error) {
      logger.error('[AdminControlCenterModal] Failed to update household', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLock = async (fieldName: string) => {
    const isLocked = formData.manualOverrides?.includes(fieldName);
    const newOverrides = isLocked 
      ? formData.manualOverrides?.filter(f => f !== fieldName) 
      : [...(formData.manualOverrides || []), fieldName];
    
    // Optimistic UI update
    setFormData({ ...formData, manualOverrides: newOverrides });
    
    // Persist the lock strategy itself so Kobo knows what may overwrite.
    if (isLocked) {
      await onUpdate(household.id, { manualOverrides: newOverrides, unlockFields: [fieldName] } as any);
    } else {
      await onUpdate(household.id, { manualOverrides: newOverrides } as any);
    }
  };

  const updateNested = (field: string, subField: string, value: any) => {
    const current = (formData as any)[field] || {};
    setFormData({
      ...formData,
      [field]: { ...current, [subField]: value }
    });
  };

  const FieldLock = ({ name, label }: { name: string, label?: string }) => {
    const isLocked = manualOverrideFields.includes(name);
    return (
      <div className="flex items-center gap-2">
        {label && <label className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 italic">{label}</label>}
        <button 
          onClick={() => toggleLock(name)}
          className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${
            isLocked
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.12)]'
              : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-400/30 hover:text-blue-300'
          }`}
          title={isLocked ? 'Verrouillé par admin : Kobo ne peut pas écraser ce champ' : 'Piloté par Kobo : la synchronisation peut mettre ce champ à jour'}
          aria-label={isLocked ? 'Verrouillé par admin : Cliquez pour rendre ce champ piloté par Kobo' : 'Piloté par Kobo : Cliquez pour verrouiller cette valeur côté admin'}
          aria-pressed={isLocked}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
          <span>{isLocked ? 'Verrouillé' : 'Kobo'}</span>
        </button>
      </div>
    );
  };

  const MultiSelectTagGroup = ({ 
    options, 
    value, 
    onChange, 
    fieldName 
  }: { 
    options: {id: string, label: string}[], 
    value: string, 
    onChange: (val: string) => void,
    fieldName: string
  }) => {
    const currentValues = value ? value.split(' ').map(v => v.trim()).filter(Boolean) : [];
    const isLocked = formData.manualOverrides?.includes(fieldName);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[8px] font-black uppercase text-slate-600 tracking-widest">{fieldName.split('.').pop()}</label>
          <FieldLock name={fieldName} />
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map(opt => {
            const isSelected = currentValues.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (isSelected) {
                    onChange(currentValues.filter(v => v !== opt.id).join(' '));
                  } else {
                    onChange([...currentValues, opt.id].join(' '));
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-tight transition-all border ${
                  isSelected 
                    ? 'bg-blue-600/20 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                    : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                }`}
                aria-pressed={isSelected}
                title={opt.label}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const SectionResetButton = ({ fields }: { fields: string[] }) => (
    <button 
      onClick={async () => {
        const nextOverrides = (formData.manualOverrides || []).filter((field) => !fields.includes(field));
        await onUpdate(household.id, { manualOverrides: nextOverrides, unlockFields: fields } as any);
        // On force un re-load ou on notifie l'utilisateur
        window.location.reload(); // Simple pour l'instant, à optimiser si besoin
      }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all"
    >
      <Database size={10} /> Réinitialiser Kobo
    </button>
  );

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="bg-slate-900 border border-white/10 rounded-3xl sm:rounded-[2.5rem] shadow-3xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden mx-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-lg sm:rounded-xl">
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tighter text-white italic truncate">
                  Control Center
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic truncate">
                  {getHouseholdDisplayName(household)}
                </p>
                <div className="w-1 h-1 rounded-full bg-slate-800" />
                <p className="text-[7px] font-bold uppercase text-slate-600 tracking-widest italic">
                  Dernière MàJ : {new Date(household.updatedAt || Date.now()).toLocaleDateString()} {new Date(household.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all active:scale-95"
              title="Fermer le centre de contrôle"
              aria-label="Fermer le centre de contrôle"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300">
                    Verrous admin
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-amber-50">
                    Les champs avec cadenas fermé restent forcés localement. Les autres continuent
                    à être mis à jour par la synchronisation Kobo.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/25 bg-black/20 text-amber-300">
                  <Lock className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-200">
                  <Lock className="h-3.5 w-3.5" />
                  {manualOverrideFields.length} champ(s) verrouillé(s)
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">
                  <LockOpen className="h-3.5 w-3.5" />
                  Kobo peut écraser le reste
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                Champs actuellement forcés
              </p>
              {manualOverrideFields.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {manualOverrideFields.slice(0, 6).map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-200"
                      title={field}
                    >
                      <Lock className="h-3 w-3" />
                      {formatOverrideLabel(field)}
                    </span>
                  ))}
                  {manualOverrideFields.length > 6 ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                      +{manualOverrideFields.length - 6} autres
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-400">
                  Aucun cadenas actif. Ce ménage suit entièrement les mises à jour Kobo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-col shrink-0">
          {household.alerts?.some((a: any) => a.type === 'DOUBLON_DETECTE') && (
            <div className="mx-4 sm:mx-8 mb-4 p-4 bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3 text-rose-500">
                <AlertTriangle size={24} className="shrink-0" />
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest italic">Conflit de Doublon Détecté</h3>
                  <p className="text-[9px] font-bold text-rose-400/80 uppercase">Plusieurs formulaires Kobo utilisent ce N° Ordre {household.numeroordre}.</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-rose-500/20 rounded-xl text-[8px] font-black text-rose-500 uppercase tracking-widest border border-rose-500/20">
                Action Recommandée : Arbitrage
              </div>
            </div>
          )}

          <div className="flex gap-1 bg-black/20 p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar mx-4 mb-4" role="tablist" aria-label="Navigation des onglets du centre de contrôle">
            {[
              { id: 'identity', label: 'Identité', icon: User },
              { id: 'social', label: 'Proprio', icon: Users },
              { id: 'technical', label: 'Audit Chantier', icon: Settings },
              { id: 'media', label: 'Photos & Sign.', icon: Hash },
              { id: 'logistics', label: 'Position GPS', icon: MapPin },
              { id: 'conflits', label: 'Conflits', icon: AlertTriangle, color: 'text-rose-500' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-panel-${tab.id}`}
                id={`tab-btn-${tab.id}`}
                className={`flex items-center gap-2 px-4 py-4 sm:px-6 sm:py-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 shrink-0 ${
                  activeTab === tab.id 
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5' 
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${(tab.id === 'conflits' && (household.alerts || []).some((a: any) => a.type === 'DOUBLON_DETECTE')) ? 'animate-pulse text-rose-500' : ''}`} aria-hidden="true" />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.id === 'conflits' && (household.alerts || []).some((a: any) => a.type === 'DOUBLON_DETECTE') && (
                   <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar">
          {activeTab === 'identity' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="space-y-6"
              role="tabpanel"
              id="tab-panel-identity"
              aria-labelledby="tab-btn-identity"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="identity-name" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 italic">Nom Complet</label>
                    <FieldLock name="name" />
                  </div>
                  <input 
                    id="identity-name"
                    value={stringifyHouseholdValue(formData.name)}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="identity-phone" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 italic">Téléphone</label>
                    <FieldLock name="phone" />
                  </div>
                  <input 
                    id="identity-phone"
                    value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                    placeholder="Ex: 77 123 45 67"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="identity-num-ordre" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Numéro d'Ordre</label>
                  <input 
                    id="identity-num-ordre"
                    value={formData.numeroordre || ''} 
                    onChange={e => setFormData({...formData, numeroordre: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-black italic focus:border-blue-500/50 transition-all outline-none"
                    title="Numéro d'Ordre"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="identity-source" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Source de données</label>
                  <select 
                    id="identity-source"
                    value={formData.source || 'local'} 
                    onChange={e => setFormData({...formData, source: e.target.value as any})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                    title="Source de données"
                  >
                    <option value="kobo">KOBO</option>
                    <option value="local">MANUEL</option>
                    <option value="import">IMPORT</option>
                  </select>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6">
                <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Hiérarchie Administrative</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="identity-region" className="text-[8px] font-black uppercase text-slate-600 ml-1">Région</label>
                    <input 
                      id="identity-region"
                      value={formData.region || ''} 
                      onChange={e => setFormData({...formData, region: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-blue-500/30"
                      title="Région"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="identity-dept" className="text-[8px] font-black uppercase text-slate-600 ml-1">Département</label>
                    <input 
                      id="identity-dept"
                      value={formData.departement || ''} 
                      onChange={e => setFormData({...formData, departement: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-blue-500/30"
                      title="Département"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="identity-village" className="text-[8px] font-black uppercase text-slate-600 ml-1">Village/Quartier</label>
                    <input 
                      id="identity-village"
                      value={formData.village || ''} 
                      onChange={e => setFormData({...formData, village: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-orange-400 font-bold text-xs outline-none focus:border-blue-500/30"
                      title="Village/Quartier"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'social' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="social-owner-nom" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Nom Complet (Propriétaire)</label>
                  <input 
                    id="social-owner-nom"
                    value={(formData.owner as any)?.nom || ''} 
                    onChange={e => updateNested('owner', 'nom', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                    placeholder="Nom du propriétaire"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="social-owner-cin" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Numéro CIN / ID</label>
                    <input 
                      id="social-owner-cin"
                      value={(formData.owner as any)?.cin || ''} 
                      onChange={e => updateNested('owner', 'cin', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-mono focus:border-blue-500/50 transition-all outline-none"
                      placeholder="N° CIN"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="social-owner-phone" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Contact Secondaire</label>
                    <input 
                      id="social-owner-phone"
                      value={(formData.owner as any)?.telephone || ''} 
                      onChange={e => updateNested('owner', 'telephone', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                      placeholder="Téléphone"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'technical' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pb-12">
              {/* ÉTAPE 0: PRÉPARATION (LOGISTIQUE) */}
              <div className="p-4 sm:p-6 bg-slate-900/50 border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center text-slate-400 font-black italic text-xs">0</div>
                    <div>
                       <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">Préparation Logistique</h4>
                       {household.koboSync?.livreurDate && (
                         <p className="text-[6px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Synchro Kobo le {new Date(household.koboSync.livreurDate).toLocaleDateString()}</p>
                       )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SectionResetButton fields={['constructionData.preparateur']} />
                    <FieldLock name="constructionData.preparateur" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="tech-kits-prepares" className="text-[8px] font-black uppercase text-slate-500 px-1">Kits Préparés</label>
                    <input 
                      id="tech-kits-prepares"
                      type="number"
                      value={(formData.constructionData as any)?.preparateur?.kits_prepares || ''}
                      onChange={e => updateNested('constructionData', 'preparateur', { ...(formData.constructionData as any)?.preparateur, kits_prepares: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-[10px]"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="tech-kits-charges" className="text-[8px] font-black uppercase text-slate-500 px-1">Kits Chargés</label>
                    <input 
                      id="tech-kits-charges"
                      type="number"
                      value={(formData.constructionData as any)?.preparateur?.kits_charges || ''}
                      onChange={e => updateNested('constructionData', 'preparateur', { ...(formData.constructionData as any)?.preparateur, kits_charges: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-[10px]"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* ÉTAPE 1: LIVRAISON & LOGISTIQUE */}
              <div className="p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-black italic text-xs">1</div>
                    <div>
                      <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Livraison & Marquage</h4>
                      {household.alerts?.some((a: any) => a.message?.toLowerCase().includes('livraison')) && (
                        <p className="text-[7px] font-black text-rose-500 uppercase tracking-tighter animate-pulse flex items-center gap-1">
                          <AlertTriangle size={8} /> Anomalie signalée
                        </p>
                      )}
                    </div>
                  </div>
                    <div className="flex items-center gap-2">
                      <SectionResetButton fields={['constructionData.livreur']} />
                      <FieldLock name="constructionData.livreur" />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label htmlFor="tech-situation" className="text-[9px] font-black uppercase text-slate-500 px-1">Situation Client</label>
                       <select 
                         id="tech-situation"
                         value={(formData.constructionData as any)?.livreur?.situation || ''} 
                         onChange={e => updateNested('constructionData', 'livreur', { ...(formData.constructionData as any)?.livreur, situation: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs outline-none"
                       >
                         <option value="">Sélectionner...</option>
                         <option value="menage_eligible">Ménage éligible</option>
                         <option value="menage_non_eligible">Ménage non éligible</option>
                         <option value="menage_injoignable">Ménage injoignable</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.livreur.justificatif"
                      value={(formData.constructionData as any)?.livreur?.justificatif || ''}
                      onChange={val => updateNested('constructionData', 'livreur', { ...(formData.constructionData as any)?.livreur, justificatif: val })}
                      options={[
                        { id: 'desistement_du_menage', label: 'Désistement' },
                        { id: 'probleme_technique_d_installation', label: 'Prob. Technique' },
                        { id: 'maison_en_paille', label: 'Maison Paille' },
                        { id: 'probleme_de_fixation_coffret', label: 'Fixation Coffret' },
                      ]}
                    />

                    <div className="space-y-2">
                       <label htmlFor="tech-kit-problems" className="text-[9px] font-black uppercase text-slate-500 px-1">Observation Kit (POURQUOI)</label>
                       <input 
                         id="tech-kit-problems"
                         value={(formData.constructionData as any)?.livreur?.kit_problems || ''}
                         onChange={e => updateNested('constructionData', 'livreur', { ...(formData.constructionData as any)?.livreur, kit_problems: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-[10px] italic outline-none"
                         placeholder="Ex: Manque un potelet..."
                       />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase text-slate-500 px-1">Confirmations Terrain</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { k: 'marquage_mur_coffret', l: 'Marquage Mur/Coffrets OK' },
                        { k: 'marquage_emplacement', l: 'Emplacement Electrique OK' },
                        { k: 'materiel_remis', l: 'Remise Matériel ménage OK' },
                      ].map(check => (
                        <label key={check.k} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all border border-white/5">
                          <input 
                            type="checkbox"
                            checked={(formData.constructionData as any)?.livreur?.[check.k] || false}
                            onChange={e => updateNested('constructionData', 'livreur', { ...(formData.constructionData as any)?.livreur, [check.k]: e.target.checked })}
                            className="w-4 h-4 rounded border-white/10 bg-slate-800 text-orange-500"
                          />
                          <span className="text-[9px] font-bold uppercase text-slate-300">{check.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { f: 'câble_2_5', l: '2.5mm', id: 'tech-cable-2-5' },
                    { f: 'câble_1_5', l: '1.5mm', id: 'tech-cable-1-5' },
                    { f: 'tranchee_4', l: '4mm Armé', id: 'tech-cable-4-arme' },
                    { f: 'tranchee_1_5', l: '1.5mm Armé', id: 'tech-cable-1-5-arme' },
                  ].map(c => (
                    <div key={c.f} className="space-y-1">
                      <label htmlFor={c.id} className="text-[7px] font-black uppercase text-slate-600 px-1">{c.l} (m)</label>
                      <input 
                        id={c.id}
                        type="number"
                        value={(formData.constructionData as any)?.livreur?.[c.f] || ''}
                        onChange={e => updateNested('constructionData', 'livreur', { ...(formData.constructionData as any)?.livreur, [c.f]: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* ÉTAPE 2: MAÇONNERIE */}
              <div className="p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black italic text-xs">2</div>
                    <div>
                      <h4 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Maçonnerie</h4>
                      {household.alerts?.some((a: any) => a.message?.toLowerCase().includes('maçon')) && (
                        <p className="text-[7px] font-black text-rose-500 uppercase tracking-tighter animate-pulse flex items-center gap-1">
                          <AlertTriangle size={8} /> Problème maçonnerie
                        </p>
                      )}
                    </div>
                  </div>
                    <div className="flex items-center gap-2">
                      <SectionResetButton fields={['constructionData.macon']} />
                      <FieldLock name="constructionData.macon" />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label htmlFor="tech-kit-disponible" className="text-[9px] font-black uppercase text-slate-500 px-1">Disponibilité Kit</label>
                       <select 
                         id="tech-kit-disponible"
                         value={(formData.constructionData as any)?.macon?.kit_disponible || ''} 
                         onChange={e => updateNested('constructionData', 'macon', { ...(formData.constructionData as any)?.macon, kit_disponible: e.target.value })}
                         className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-blue-500/50"
                       >
                         <option className="bg-slate-950 text-white" value="oui">Oui - Kit complet</option>
                         <option className="bg-slate-950 text-white" value="non">Non - Problème kit</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.macon.problemes_kit"
                      value={(formData.constructionData as any)?.macon?.problemes_kit || ''}
                      onChange={val => updateNested('constructionData', 'macon', { ...(formData.constructionData as any)?.macon, problemes_kit: val })}
                      options={[
                        { id: 'pas_de_kit', label: 'Kit non livré' },
                        { id: 'kit_incomplet', label: 'Kit incomplet' },
                        { id: 'pas_de_potelet', label: 'Pas de potelet' },
                        { id: 'autres_problemes_kit', label: 'Autre' },
                      ]}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label htmlFor="tech-type-mur" className="text-[9px] font-black uppercase text-slate-500 px-1">Type de Mur</label>
                       <select 
                         id="tech-type-mur"
                         value={(formData.constructionData as any)?.macon?.type_mur || ''} 
                         onChange={e => updateNested('constructionData', 'macon', { ...(formData.constructionData as any)?.macon, type_mur: e.target.value })}
                         className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs outline-none focus:border-blue-500/50"
                       >
                         <option className="bg-slate-950 text-white" value="mur-standard">Mur standard (2 poteaux)</option>
                         <option className="bg-slate-950 text-white" value="mur_en_chemine">Mur en cheminée</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.macon.problemes"
                      value={(formData.constructionData as any)?.macon?.problemes || ''}
                      onChange={val => updateNested('constructionData', 'macon', { ...(formData.constructionData as any)?.macon, problemes: val })}
                      options={[
                        { id: 'terrain_probleme', label: 'Problème Terrain' },
                        { id: 'meteo_probleme', label: 'Météo' },
                        { id: 'materiel_manquant', label: 'Matériel manquant' },
                        { id: 'autres_problemes_travail', label: 'Autre' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* ÉTAPE 3 & 4: RÉSEAU & INTÉRIEUR (RÉSUMÉ) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-black uppercase text-blue-400 tracking-widest">3. Branchement Réseau</h4>
                    <div className="flex items-center gap-2">
                       <SectionResetButton fields={['constructionData.reseau']} />
                       <FieldLock name="constructionData.reseau" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                       <label htmlFor="tech-verif-mur" className="text-[8px] font-black text-slate-500 uppercase px-1">Conformité Mur (Réseau)</label>
                       <select 
                         id="tech-verif-mur"
                         value={(formData.constructionData as any)?.reseau?.verif_mur || ''} 
                         onChange={e => updateNested('constructionData', 'reseau', { ...(formData.constructionData as any)?.reseau, verif_mur: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px]"
                       >
                         <option value="oui">✅ Mur conforme (OK pour branchement)</option>
                         <option value="non">❌ Mur non conforme</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.reseau.problemes_mur"
                      value={(formData.constructionData as any)?.reseau?.problemes_mur || ''}
                      onChange={val => updateNested('constructionData', 'reseau', { ...(formData.constructionData as any)?.reseau, problemes_mur: val })}
                      options={[
                        { id: 'mur_non_realise', label: 'Mur non réalisé' },
                        { id: 'mur_non_conforme', label: 'Mur non conforme' },
                        { id: 'autre_probleme_mur', label: 'Autre' },
                      ]}
                    />

                    <div className="pt-2">
                       <label className="text-[8px] font-black text-slate-500 uppercase px-1 italic">Observations Tech. Réseau</label>
                       <MultiSelectTagGroup 
                         fieldName="constructionData.reseau.observations_techniques"
                         value={(formData.constructionData as any)?.reseau?.observations_techniques || ''}
                         onChange={val => updateNested('constructionData', 'reseau', { ...(formData.constructionData as any)?.reseau, observations_techniques: val })}
                         options={[
                           { id: 'plus_de_2_positions__zone_urbaine', label: 'Pos. > 2 (Urbain)' },
                           { id: 'plus_de_3_positions__zone_rurale', label: 'Pos. > 3 (Rural)' },
                           { id: 'longueur_branchement_sup_rieure___40m__z', label: 'L > 40m (Urbain)' },
                           { id: 'longueur_branchement_sup_rieure___50m__z', label: 'L > 50m (Rural)' },
                           { id: 'necessite_une_extension', label: 'Besoin Extension' },
                         ]}
                       />
                    </div>

                    <div className="pt-2 border-t border-white/5 mt-2">
                       <label htmlFor="tech-etat-branchement" className="text-[8px] font-black text-slate-500 uppercase px-1">État Branchement</label>
                       <select 
                         id="tech-etat-branchement"
                         value={(formData.constructionData as any)?.reseau?.etat || ''} 
                         onChange={e => updateNested('constructionData', 'reseau', { ...(formData.constructionData as any)?.reseau, etat: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] mt-1"
                       >
                         <option value="">Sélectionner...</option>
                         <option value="termine">✅ Branchement terminé</option>
                         <option value="probleme">❌ Problème lors du branchement</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.reseau.problemes_branchement"
                      value={(formData.constructionData as any)?.reseau?.problemes_branchement || ''}
                      onChange={val => updateNested('constructionData', 'reseau', { ...(formData.constructionData as any)?.reseau, problemes_branchement: val })}
                      options={[
                        { id: 'pas_de_materiel_reseau', label: 'Pas de matériel' },
                        { id: 'probleme_technique_reseau', label: 'Prob. technique' },
                        { id: 'autres_problemes_reseau', label: 'Autre' },
                      ]}
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-black uppercase text-purple-400 tracking-widest">4. Install. Intérieure</h4>
                    <div className="flex items-center gap-2">
                       <SectionResetButton fields={['constructionData.interieur']} />
                       <FieldLock name="constructionData.interieur" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                       <label htmlFor="tech-verif-branchement" className="text-[8px] font-black text-slate-500 uppercase px-1">Conformité Branchement (Interieur)</label>
                       <select 
                         id="tech-verif-branchement"
                         value={(formData.constructionData as any)?.interieur?.verif_branchement || ''} 
                         onChange={e => updateNested('constructionData', 'interieur', { ...(formData.constructionData as any)?.interieur, verif_branchement: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px]"
                       >
                         <option value="oui">✅ Branchement OK (Prêt pour installation)</option>
                         <option value="non">❌ Branchement non conforme</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.interieur.problemes_branchement"
                      value={(formData.constructionData as any)?.interieur?.problemes_branchement || ''}
                      onChange={val => updateNested('constructionData', 'interieur', { ...(formData.constructionData as any)?.interieur, problemes_branchement: val })}
                      options={[
                        { id: 'branchement_non_realise', label: 'Branchement non réalisé' },
                        { id: 'branchement_non_conforme', label: 'Branchement non conforme' },
                        { id: 'autre_probleme_branchement', label: 'Autre' },
                      ]}
                    />

                    <div className="pt-2">
                       <label htmlFor="tech-etat-installation" className="text-[8px] font-black text-slate-500 uppercase px-1">État Installation</label>
                       <select 
                         id="tech-etat-installation"
                         value={(formData.constructionData as any)?.interieur?.etat || ''} 
                         onChange={e => updateNested('constructionData', 'interieur', { ...(formData.constructionData as any)?.interieur, etat: e.target.value })}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] mt-1"
                       >
                         <option value="termine">✅ Install. terminée</option>
                         <option value="probleme">❌ Problème à signaler</option>
                       </select>
                    </div>

                    <MultiSelectTagGroup 
                      fieldName="constructionData.interieur.problemes_installation"
                      value={(formData.constructionData as any)?.interieur?.problemes_installation || ''}
                      onChange={val => updateNested('constructionData', 'interieur', { ...(formData.constructionData as any)?.interieur, problemes_installation: val })}
                      options={[
                        { id: 'pas_de_materiel_interieur', label: 'Pas de matériel' },
                        { id: 'probleme_technique_interieur', label: 'Prob. technique' },
                        { id: 'autres_problemes_interieur', label: 'Autre' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* ÉTAPE 5: AUDIT DE CONFORMITÉ (DÉTAILLÉ) */}
              <div className="p-4 sm:p-8 bg-slate-950/40 border border-blue-500/20 rounded-3xl sm:rounded-[2.5rem] space-y-6 sm:space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Audit de Conformité Finale</h4>
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Rapport détaillé de l'inspecteur</p>
                    </div>
                  </div>
                  <FieldLock name="constructionData.audit" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* TGBT & Sécurité */}
                  <div className="space-y-6">
                    <h5 className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.2em] border-b border-white/5 pb-2">TGBT & Sécurité</h5>
                    {[
                      { f: 'disjoncteur_tete', l: 'Disjoncteur en tête' },
                      { f: 'protection_ddr_30ma', l: 'Protection DDR 30mA' },
                      { f: 'protection_origine', l: 'Protec. origine circuits' },
                      { f: 'contact_direct', l: 'Protec. contact direct' },
                    ].map(audit => (
                      <div key={audit.f} className="flex items-center justify-between gap-4">
                        <label htmlFor={`audit-${audit.f}`} className="text-[10px] font-bold text-slate-300 uppercase shrink-0">{audit.l}</label>
                        <select 
                          id={`audit-${audit.f}`}
                          value={(formData.constructionData as any)?.audit?.[audit.f] || ''}
                          onChange={e => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, [audit.f]: e.target.value })}
                          className={`bg-white/5 border rounded-lg px-2 py-1 text-[9px] outline-none ${(formData.constructionData as any)?.audit?.[audit.f] === 'non_conforme' ? 'border-rose-500/50 text-rose-400' : 'border-white/10 text-emerald-400'}`}
                        >
                          <option value="conforme">C</option>
                          <option value="non_conforme">NC</option>
                        </select>
                      </div>
                    ))}
                    <div className="pt-4">
                        <label className="text-[8px] font-black text-slate-500 uppercase px-1 italic">Anomalies Protection (DDR / CC)</label>
                        <MultiSelectTagGroup 
                          fieldName="constructionData.audit.anomalies_protection"
                          value={(formData.constructionData as any)?.audit?.anomalies_protection || ''}
                          onChange={val => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, anomalies_protection: val })}
                          options={[
                            { id: 'pas_de_coupe_circuit__cc', label: 'Pas de CC' },
                            { id: 'calibre_fusible_superieur_25a', label: 'Calibre CC > 25A' },
                            { id: 'pas_de_differentiel_30ma', label: 'Pas de DDR 30mA' },
                            { id: 'differentiel_30ma_d_t_rior', label: 'DDR Détérioré' },
                          ]}
                        />
                    </div>
                  </div>

                  {/* Branchement & Terre */}
                  <div className="space-y-6">
                    <h5 className="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.2em] border-b border-white/5 pb-2">Branchement & Terre</h5>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-300 uppercase">Résistance de Terre</label>
                         <div className="flex items-center gap-2">
                           <input 
                             type="number"
                             value={(formData.constructionData as any)?.audit?.resistance_terre || ''}
                             onChange={e => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, resistance_terre: e.target.value })}
                             className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] w-20 text-right font-mono"
                             title="Résistance de Terre"
                           />
                           <span className="text-[10px] text-slate-600">Ω</span>
                         </div>
                      </div>
                      <div className="pt-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase px-1 italic">Anomalies Terre</label>
                        <MultiSelectTagGroup 
                          fieldName="constructionData.audit.anomalies_terre"
                          value={(formData.constructionData as any)?.audit?.anomalies_terre || ''}
                          onChange={val => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, anomalies_terre: val })}
                          options={[
                            { id: 'absence_de_piquet_de_terre', label: 'Pas de piquet' },
                            { id: 'terre_non_raccord__sur_boite_de_d_rivati', label: 'Pas raccordé boîte' },
                            { id: 'piquet_de_terre_d_connect', label: 'Piquet déconnecté' },
                            { id: 'pas_de_barrette_de_terre', label: 'Pas de barrette' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                    <label className="text-[9px] font-black text-slate-500 uppercase px-1 italic">Détails de l'Installation</label>
                    <MultiSelectTagGroup 
                      fieldName="constructionData.audit.anomalies_installation"
                      value={(formData.constructionData as any)?.audit?.anomalies_installation || ''}
                      onChange={val => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, anomalies_installation: val })}
                      options={[
                        { id: 'cable_1_5mm__jonctionn__par__pissure', label: 'Épissure 1.5' },
                        { id: 'cable_2_5mm__jonctionn__par__pissure', label: 'Épissure 2.5' },
                        { id: 'c_ble_arm__non_enterr', label: 'Alim non enterrée' },
                        { id: 'profondeur_tranch_e_non_ad_quate__minimu', label: 'Tranchée NC' },
                        { id: 'douille_mal_fix', label: 'Douille mal fixée' },
                        { id: 'interrupteur_mal_fix', label: 'Interrupteur mal fixé' },
                        { id: 'boite_de_derivation_sans_couvercle', label: 'Boîte sans couvercle' },
                      ]}
                    />
                </div>

                <div className="pt-4 space-y-4">
                    <label htmlFor="audit-notes-generales" className="text-[9px] font-black text-slate-500 uppercase px-1">Observations Générales de l'Audit</label>
                    <textarea 
                      id="audit-notes-generales"
                      value={(formData.constructionData as any)?.audit?.notes_generales || ''}
                      onChange={e => updateNested('constructionData', 'audit', { ...(formData.constructionData as any)?.audit, notes_generales: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-xs min-h-[100px] outline-none focus:border-blue-500/50"
                      placeholder="Saisissez les observations détaillées du contrôleur..."
                      title="Observations Générales"
                    />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'media' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 pb-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                 {[
                   { key: 'photo_macon', label: 'Photo Maçonnerie' },
                   { key: 'photo_reseau', label: 'Photo Branchement' },
                   { key: 'photo_interieur', label: 'Photo Installation' },
                   { key: 'photo_compteur', label: 'Photo Compteur' },
                   { key: 'signature_client', label: 'Signature Client', isSign: true },
                   { key: 'signature_controleur', label: 'Signature Contrôleur', isSign: true },
                 ].map(item => (
                   <div key={item.key} className="p-4 sm:p-5 bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                         <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.label}</label>
                         <FieldLock name={`constructionData.media.${item.key}`} />
                      </div>
                      <div className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between text-[10px] font-mono text-blue-400">
                         <span className="truncate max-w-[120px] sm:max-w-[150px]">{(formData.constructionData as any)?.media?.[item.key] || 'AUCUN FICHIER'}</span>
                         {(formData.constructionData as any)?.media?.[item.key] && (
                           <button className="text-[9px] text-slate-500 hover:text-white uppercase font-bold ml-2">Voir</button>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'logistics' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="logistics-zone" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 ml-1">Zone Géographique</label>
                  <select 
                    id="logistics-zone"
                    value={formData.zoneId || ''} 
                    onChange={e => setFormData({...formData, zoneId: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-medium focus:border-blue-500/50 transition-all outline-none"
                    title="Zone Géographique"
                  >
                    <option value="">Sélectionner une zone...</option>
                    {zones.map(z => <option key={z.id} className="bg-slate-900 text-white" value={z.id}>{z.name}</option>)}
                  </select>
                  {household.alerts?.some((a: any) => a.type === 'MISMATCH_GPS') && (
                    <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                       <AlertTriangle size={10} className="text-amber-500" />
                       <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest">Incohérence GPS/Région détectée</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label htmlFor="logistics-lat" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Latitude</label>
                    <FieldLock name="latitude" />
                  </div>
                  <input 
                    id="logistics-lat"
                    type="number"
                    step="0.0000000001"
                    value={formData.latitude || ''} 
                    onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-mono text-xs focus:border-blue-500/50 transition-all outline-none"
                    title="Latitude"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label htmlFor="logistics-lon" className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Longitude</label>
                    <FieldLock name="longitude" />
                  </div>
                  <input 
                    id="logistics-lon"
                    type="number"
                    step="0.0000000001"
                    value={formData.longitude || ''} 
                    onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-mono text-xs focus:border-blue-500/50 transition-all outline-none"
                    title="Longitude"
                  />
                </div>
              </div>

              <div className="space-y-4 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl">
                <div className="flex gap-3 text-amber-500">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider leading-relaxed">
                    Attention : La modification directe des coordonnées impacte la position sur la carte et le calcul des grappes.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'conflits' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 pb-20">
               <div className="p-8 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                     <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={24} />
                     </div>
                     <div>
                        <h4 className="text-lg font-black text-rose-500 uppercase italic tracking-widest">Résolution de Conflit</h4>
                        <p className="text-xs text-rose-400/60 font-medium tracking-tight">ID collision détecté sur KoboToolbox</p>
                     </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed mb-8">
                    Ce dossier (ID N°{household.numeroordre}) possède plusieurs soumissions actives sur le serveur Kobo. 
                    <br /><br />
                    En cliquant sur le bouton ci-dessous, vous confirmez que les données affichées dans ce panneau administratif sont les données définitives. L'alerte sera levée et la génération du PV sera débloquée.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                     <button 
                       onClick={async () => {
                         if (!onUpdate) return;
                         try {
                           const updatedAlerts = (household.alerts || []).filter((a: any) => a.type !== 'DOUBLON_DETECTE');
                           await onUpdate(household.id, { alerts: updatedAlerts as any });
                           setFormData({ ...formData, alerts: updatedAlerts as any });
                           toast.success("Conflit résolu ✓");
                           setActiveTab('technical');
                         } catch (err) {
                           toast.error("Échec de la résolution");
                         }
                       }}
                       className="flex-1 py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-rose-900/40 active:scale-95"
                     >
                       Valider cette version
                     </button>
                     <button 
                       onClick={() => setActiveTab('technical')}
                       className="flex-1 py-5 bg-slate-800 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/5"
                     >
                       Inspecter les données
                     </button>
                  </div>
               </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-8 border-t border-white/5 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 sm:py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-all order-2 sm:order-1"
          >
            Annuler
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-2xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 order-1 sm:order-2"
          >
            {isSaving ? <Database className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Synchronisation...' : 'Enregistrer tout'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
