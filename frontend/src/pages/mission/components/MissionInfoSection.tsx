/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Hash, MapPin, CalendarDays, CalendarCheck, Target, Truck, ArrowRight, ArrowLeft, Calculator, Lock } from 'lucide-react';
import type { MissionOrderData } from '../core/missionTypes';

interface MissionInfoSectionProps {
  formData: Partial<MissionOrderData>;
  isReadOnly?: boolean;
  onUpdateField: (field: keyof MissionOrderData, value: any) => void;
}

/* ── Reusable labelled field ── */
const Field = ({
  label, icon: Icon, children, locked, span = '',
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  locked?: boolean;
  span?: string;
}) => (
  <div className={`group flex flex-col gap-1.5 ${span}`}>
    <label className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-slate-600 ml-0.5">
      <Icon size={9} className="opacity-60" />
      {label}
      {locked && <Lock size={7} className="ml-auto text-slate-700" />}
    </label>
    {children}
  </div>
);

const inputCls = (locked: boolean) =>
  `w-full bg-white/[0.03] border ${
    locked
      ? 'border-white/[0.05] text-slate-500 cursor-not-allowed'
      : 'border-white/[0.07] text-white focus:border-indigo-500/50 focus:bg-indigo-500/[0.04] focus:ring-0'
  } rounded-xl px-3 py-2.5 text-[11px] font-semibold outline-none transition-all placeholder:text-slate-700`;

/**
 * COMPOSANT : Section Informations de Base — v2 redesign
 */
export const MissionInfoSection: React.FC<MissionInfoSectionProps> = ({
  formData,
  isReadOnly = false,
  onUpdateField,
}) => {
  const isLocked = isReadOnly || !!formData.isCertified || !!formData.isSubmitted;

  const officialOrderNumber =
    formData.orderNumber && !String(formData.orderNumber).startsWith('TEMP-')
      ? formData.orderNumber
      : (formData as any).officialNumber || '';

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-[#0d1117] border border-white/[0.07] p-5 sm:p-7 space-y-6">
      {/* Subtle top-left glow */}
      <div className="absolute -top-10 -left-10 w-36 h-36 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Target size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[12px] font-black text-white uppercase tracking-[0.15em]">Configuration Officielle</h2>
            <p className="text-[9px] font-semibold text-slate-600 mt-0.5 tracking-wide">Détails administratifs et logistiques</p>
          </div>
        </div>

        {/* ── Financial exclusion toggle ── */}
        <button
          type="button"
          onClick={() => !isLocked && onUpdateField('excludeFromFinance', !formData.excludeFromFinance)}
          disabled={isLocked}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
            formData.excludeFromFinance
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]'
          } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Calculator size={13} className={formData.excludeFromFinance ? 'text-amber-400' : 'text-slate-600'} />
          <div className="flex flex-col items-start">
            <span className="text-[9px] font-black uppercase tracking-wider text-white/80">Exclusion Financière</span>
            <span className="text-[8px] text-slate-600 font-semibold">Hors budget projet</span>
          </div>
          {/* pill toggle */}
          <div className={`w-9 h-5 rounded-full relative transition-all duration-200 ml-2 ${formData.excludeFromFinance ? 'bg-amber-500 shadow-md shadow-amber-500/30' : 'bg-slate-800'}`}>
            <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200 ${formData.excludeFromFinance ? 'left-[19px]' : 'left-[3px]'}`} />
          </div>
        </button>
      </div>

      {/* ── Row 1: N° Ordre, Destination, Début, Fin ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <Field label="N° Ordre" icon={Hash} locked>
          <input
            id="mission-number"
            type="text"
            readOnly
            value={officialOrderNumber}
            placeholder="Auto-généré"
            className={`${inputCls(true)} font-black text-indigo-400`}
          />
        </Field>

        <Field label="Destination" icon={MapPin} locked={isLocked}>
          <input
            id="mission-region"
            type="text"
            value={formData.region || ''}
            onChange={(e) => onUpdateField('region', e.target.value)}
            readOnly={isLocked}
            placeholder="Région / Ville"
            className={inputCls(isLocked)}
          />
        </Field>

        <Field label="Début" icon={CalendarDays} locked={isLocked}>
          <input
            type="date"
            readOnly={isLocked}
            value={formData.startDate || ''}
            onChange={(e) => onUpdateField('startDate', e.target.value)}
            className={inputCls(isLocked)}
          />
        </Field>

        <Field label="Fin estimée" icon={CalendarCheck} locked={isLocked}>
          <input
            type="date"
            readOnly={isLocked}
            value={formData.endDate || ''}
            onChange={(e) => onUpdateField('endDate', e.target.value)}
            className={inputCls(isLocked)}
          />
        </Field>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.05]" />

      {/* ── Row 2: Purpose ── */}
      <div className="relative z-10">
        <Field label="Objet de la Mission" icon={Target} locked={isLocked}>
          <input
            type="text"
            readOnly={isLocked}
            value={formData.purpose || ''}
            onChange={(e) => onUpdateField('purpose', e.target.value.toUpperCase())}
            placeholder="But de la mission…"
            className={`${inputCls(isLocked)} !py-3.5 text-[13px] font-black !rounded-2xl tracking-tight`}
          />
        </Field>
      </div>

      {/* ── Row 3: Transport + Itineraries ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        <Field label="Moyen de transport" icon={Truck} locked={isLocked}>
          <input
            type="text"
            value={formData.transport || ''}
            onChange={(e) => onUpdateField('transport', e.target.value)}
            readOnly={isLocked}
            placeholder="Véhicule, avion…"
            className={inputCls(isLocked)}
          />
        </Field>

        <Field label="Itinéraire Aller" icon={ArrowRight} locked={isLocked}>
          <input
            type="text"
            value={formData.itineraryAller || ''}
            onChange={(e) => onUpdateField('itineraryAller', e.target.value)}
            readOnly={isLocked}
            placeholder="Dakar → Lieu…"
            className={inputCls(isLocked)}
          />
        </Field>

        <Field label="Itinéraire Retour" icon={ArrowLeft} locked={isLocked}>
          <input
            type="text"
            value={formData.itineraryRetour || ''}
            onChange={(e) => onUpdateField('itineraryRetour', e.target.value)}
            readOnly={isLocked}
            placeholder="Lieu → Dakar…"
            className={inputCls(isLocked)}
          />
        </Field>
      </div>
    </section>
  );
};
