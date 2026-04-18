import React from 'react';
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
  const inputClass = (locked: boolean) =>
    `w-full ${locked ? 'bg-slate-100 dark:bg-white/5 cursor-not-allowed opacity-80 font-black text-slate-400' : 'bg-slate-50 dark:bg-white/5 text-indigo-900 dark:text-indigo-100'} border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold focus:ring-2 ring-indigo-500/20 transition-all outline-none`;
  return (
    <section className="glass-card !p-5 !rounded-[2rem] space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* N° Ordre */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-number"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            N° Ordre
          </label>
          <div className="relative group">
            <input
              id="mission-number"
              type="text"
              readOnly
              value={formData.orderNumber && !formData.orderNumber.startsWith('TEMP-') ? formData.orderNumber : (formData.orderNumber && (formData as any).workflowStatus === 'approved' ? formData.orderNumber : (formData as any).officialNumber || formData.orderNumber || '')}
              placeholder="Génération après validation..."
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-[11px] font-black text-indigo-600 dark:text-indigo-400 focus:ring-0 transition-all outline-none cursor-not-allowed group-hover:border-indigo-500/30"
            />
            {!formData.orderNumber && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase tracking-wider animate-pulse">
                En attente
              </span>
            )}
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-region"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
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

        {/* Date Début */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-start"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Début
          </label>
          <input
            id="mission-start"
            type="text"
            value={formData.startDate || ''}
            onChange={(e) => onUpdateField('startDate', e.target.value)}
            readOnly={isReadOnly}
            placeholder="JJ/MM/AAAA"
            className={inputClass(!!isLocked)}
          />
        </div>

        {/* Date Fin */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-end"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Fin Estimée
          </label>
          <input
            id="mission-end"
            type="text"
            value={formData.endDate || ''}
            onChange={(e) => onUpdateField('endDate', e.target.value)}
            readOnly={isReadOnly}
            placeholder="JJ/MM/AAAA"
            className={inputClass(!!isLocked)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-white/5">
        {/* Objet de la mission */}
        <div className="space-y-1.5 md:col-span-2">
          <label
            htmlFor="mission-purpose"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Objet de la mission
          </label>
          <input
            id="mission-purpose"
            type="text"
            value={formData.purpose || ''}
            onChange={(e) => onUpdateField('purpose', e.target.value)}
            readOnly={isReadOnly}
            placeholder="But de la mission..."
            className={inputClass(!!isLocked)}
          />
        </div>

        {/* Moyen de transport */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-transport"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Moyen de transport
          </label>
          <input
            id="mission-transport"
            type="text"
            value={formData.transport || ''}
            onChange={(e) => onUpdateField('transport', e.target.value)}
            readOnly={isReadOnly}
            placeholder="Véhicule, avion, etc."
            className={inputClass(!!isLocked)}
          />
        </div>

        {/* Placeholder pour alignement */}
        <div className="hidden md:block" />

        {/* Itinéraire Aller */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-itinerary-aller"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Itinéraire Aller
          </label>
          <input
            id="mission-itinerary-aller"
            type="text"
            value={formData.itineraryAller || ''}
            onChange={(e) => onUpdateField('itineraryAller', e.target.value)}
            readOnly={isReadOnly}
            placeholder="Dakar -> Lieu..."
            className={inputClass(!!isLocked)}
          />
        </div>

        {/* Itinéraire Retour */}
        <div className="space-y-1.5">
          <label
            htmlFor="mission-itinerary-retour"
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1"
          >
            Itinéraire Retour
          </label>
          <input
            id="mission-itinerary-retour"
            type="text"
            value={formData.itineraryRetour || ''}
            onChange={(e) => onUpdateField('itineraryRetour', e.target.value)}
            readOnly={isReadOnly}
            placeholder="Lieu -> Dakar..."
            className={inputClass(!!isLocked)}
          />
        </div>
      </div>
    </section>
  );
};
