/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { ClipboardList } from 'lucide-react';
import type { MissionOrderData } from '../core/missionTypes';

interface MissionInfoSectionProps {
  formData: Partial<MissionOrderData>;
  isReadOnly?: boolean;
  onUpdateField: (field: keyof MissionOrderData, value: any) => void;
}

/**
 * COMPOSANT : Section Informations de Base
 * Gère le numéro d'ordre, la destination et les dates.
 */
export const MissionInfoSection: React.FC<MissionInfoSectionProps> = ({
  formData,
  isReadOnly = false,
  onUpdateField,
}) => {
  const isLocked = isReadOnly || formData.isCertified || formData.isSubmitted;
  
  const officialOrderNumber =
    formData.orderNumber && !String(formData.orderNumber).startsWith('TEMP-')
      ? formData.orderNumber
      : (formData as any).officialNumber || '';

  const inputClass = (locked: boolean) =>
    `w-full ${locked 
      ? 'bg-slate-900/40 cursor-not-allowed opacity-80 font-black text-slate-400' 
      : 'bg-slate-950/40 text-white dark:text-indigo-100'
    } border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-bold focus:ring-2 ring-indigo-500/20 transition-all outline-none shadow-inner`;

  return (
    <section className="glass-card !p-5 sm:!p-8 !rounded-[2rem] space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-6 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl shadow-inner border border-indigo-500/20">
            <ClipboardList className="text-indigo-400" size={20} />
          </div>
          <div>
            <h2 className="!text-[11px] font-black text-white uppercase tracking-[0.2em] text-clamp-title">
              Configuration Officielle
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
              Détails administratifs et logistiques
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
        {/* N° ORDRE */}
        <div className="relative group">
          <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
            N° Ordre
          </label>
          <div className="relative">
            <input
              id="mission-number"
              type="text"
              readOnly
              value={officialOrderNumber}
              placeholder="Auto-généré à la validation"
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-black text-indigo-400 focus:ring-0 transition-all outline-none cursor-not-allowed group-hover:border-indigo-500/30 shadow-inner"
            />
          </div>
        </div>

        {/* DESTINATION */}
        <div className="relative group">
          <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
            Destination
          </label>
          <input
            id="mission-region"
            type="text"
            value={formData.region || ''}
            onChange={(e) => onUpdateField('region', e.target.value)}
            readOnly={isReadOnly}
            placeholder="Région / Ville"
            className={inputClass(!!isLocked)}
          />
        </div>

        {/* DATES */}
        <div className="relative group">
          <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
            Début
          </label>
          <input
            type="date"
            readOnly={isReadOnly}
            value={formData.startDate || ''}
            onChange={(e) => onUpdateField('startDate', e.target.value)}
            className={inputClass(!!isLocked)}
          />
        </div>

        <div className="relative group">
          <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
            Fin estimée
          </label>
          <input
            type="date"
            readOnly={isReadOnly}
            value={formData.endDate || ''}
            onChange={(e) => onUpdateField('endDate', e.target.value)}
            className={inputClass(!!isLocked)}
          />
        </div>
      </div>

      <div className="space-y-6 pt-4 border-t border-white/5">
        {/* OBJET DE LA MISSION */}
        <div className="relative group z-10">
          <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
            Objet de la mission
          </label>
          <input
            type="text"
            readOnly={isReadOnly}
            value={formData.purpose || ''}
            onChange={(e) => onUpdateField('purpose', e.target.value.toUpperCase())}
            placeholder="But de la mission..."
            className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-4 py-3 text-[12px] font-black text-white placeholder:text-slate-600 focus:border-indigo-500/50 transition-all outline-none shadow-inner"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* MOYEN DE TRANSPORT */}
          <div className="relative group z-10">
            <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
              Moyen de transport
            </label>
            <input
              type="text"
              value={formData.transport || ''}
              onChange={(e) => onUpdateField('transport', e.target.value)}
              readOnly={isReadOnly}
              placeholder="Véhicule, avion, etc."
              className={inputClass(!!isLocked)}
            />
          </div>

          {/* ITINÉRAIRE ALLER */}
          <div className="relative group z-10">
            <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
              Itinéraire Aller
            </label>
            <input
              type="text"
              value={formData.itineraryAller || ''}
              onChange={(e) => onUpdateField('itineraryAller', e.target.value)}
              readOnly={isReadOnly}
              placeholder="Dakar -> Lieu..."
              className={inputClass(!!isLocked)}
            />
          </div>

          {/* ITINÉRAIRE RETOUR */}
          <div className="relative group z-10">
            <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-1 opacity-70">
              Itinéraire Retour
            </label>
            <input
              type="text"
              value={formData.itineraryRetour || ''}
              onChange={(e) => onUpdateField('itineraryRetour', e.target.value)}
              readOnly={isReadOnly}
              placeholder="Lieu -> Dakar..."
              className={inputClass(!!isLocked)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
