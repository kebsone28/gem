import { useMemo } from 'react';
import { Map as MapIcon, Maximize2 } from 'lucide-react';
import MapLibreVectorMap from '../terrain/MapLibreVectorMap';
import { senegalRegions } from '../../data/senegal-regions';

interface MissionMiniMapProps {
    region: string;
    households?: any[];
}

export function MissionMiniMap({ region, households = [] }: MissionMiniMapProps) {
    // Center the map based on the selected region
    const mapCommand = useMemo(() => {
        const regionFeature = senegalRegions.features.find(
            f => f.properties.REGION.toLowerCase() === region.toLowerCase()
        );

        if (regionFeature) {
            // Get the first coordinate of the polygon as a fallback center
            const coords = regionFeature.geometry.coordinates[0][0];
            return {
                type: 'center',
                center: [coords[0], coords[1]],
                zoom: 9
            };
        }
        return { type: 'center', center: [-14.45, 14.45], zoom: 6 }; // Default Senegal center
    }, [region]);

    return (
        <section className="glass-card !p-0 !rounded-[2.5rem] overflow-hidden border border-slate-200/50 dark:border-white/5 h-[400px] relative group">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
                <div className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/50 dark:border-white/10">
                    <MapIcon size={18} className="text-indigo-500" />
                </div>
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-xl border border-slate-200/50 dark:border-white/10">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Aperçu SIG : {region}</h3>
                </div>
            </div>

            <button 
                title="Agrandir la carte"
                className="absolute top-6 right-6 z-10 p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/50 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                onClick={() => window.location.href = '/terrain'}
            >
                <Maximize2 size={18} />
            </button>

            <div className="w-full h-full pointer-events-none">
                <MapLibreVectorMap 
                    households={households}
                    mapCommand={mapCommand}
                    readOnly={true}
                    isDarkMode={document.documentElement.classList.contains('dark')}
                    projectId="mission-preview"
                />
            </div>

            <div className="absolute bottom-6 left-6 right-6 z-10 flex justify-center">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    Ceci est un aperçu statique. Utilisez l'onglet « Terrain » pour la navigation interactive.
                </div>
            </div>
        </section>
    );
}
