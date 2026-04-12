import React, { useEffect, useRef } from 'react';
import { User, Users, Phone, MapPin } from 'lucide-react';

interface MapTooltipProps {
  data: any;
  x: number;
  y: number;
}

const MapTooltip: React.FC<MapTooltipProps> = ({ data, x, y }) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tooltipRef.current) return;
    tooltipRef.current.style.left = `${x}px`;
    tooltipRef.current.style.top = `${y}px`;
  }, [x, y]);

  if (!data) return null;

  const isCluster = data.cluster;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[5000] pointer-events-none transform -translate-x-1/2 -translate-y-full mb-4"
    >
      <div className="bg-[#050F1F] border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[200px] ring-1 ring-white/5 animate-in fade-in zoom-in duration-200">
        {isCluster ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                Cluster de ménages
              </span>
            </div>
            <div className="text-xl font-black text-white italic">
              {data.point_count}{' '}
              <span className="text-[10px] not-italic font-bold uppercase text-slate-400 opacity-60">
                Points
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter ${
                  data.status === 'Livraison effectuée'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                }`}
              >
                {data.status || 'Ménage'}
              </span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                #{data.numeroordre || data.id?.slice(0, 8)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-white">
                <User size={12} className="text-blue-400 opacity-70" />
                <span className="text-[11px] font-black uppercase tracking-tight truncate max-w-[150px]">
                  {data.name || 'Nom Inconnu'}
                </span>
              </div>
              {data.assignedTeams && data.assignedTeams.length > 0 && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={10} className="text-slate-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px]">
                    {data.assignedTeams.join(', ')}
                  </span>
                </div>
              )}
              {data.koboSync && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[9px] text-slate-300 uppercase tracking-[0.2em]">
                  {[
                    { label: 'Maçon', value: data.koboSync.maconOk },
                    { label: 'Réseau', value: data.koboSync.reseauOk },
                    { label: 'Intérieur', value: data.koboSync.interieurOk },
                    { label: 'Contrôle', value: data.koboSync.controleOk },
                  ].map((item) => (
                    <span
                      key={item.label}
                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 ${
                        item.value === true
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : item.value === false
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            : 'bg-slate-900/70 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
              {data.phone && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone size={10} className="text-slate-500" />
                  <span className="text-[10px] font-bold tracking-widest">{data.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin size={10} className="text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px]">
                  {data.village || data.region || 'Localisation...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Subtle bottom glows */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500/40 blur-sm rounded-full" />
      </div>

      {/* Tooltip Arrow */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#050F1F] border-r border-b border-white/10 rotate-45" />
    </div>
  );
};

export default React.memo(MapTooltip);
