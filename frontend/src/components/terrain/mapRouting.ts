/**
 * mapRouting.ts
 * 
 * OSRM routing service integration
 * - Fetch routes with turn-by-turn instructions
 * - Handle routing state and errors
 */

import logger from '../../utils/logger';
import toast from 'react-hot-toast';

export interface TurnByTurnInstruction {
    distance: number;
    duration: number;
    instruction: string;
    name: string;
    type: string;
    modifier: string;
}

export interface RouteResult {
    distance: number;
    duration: number;
    instructions: TurnByTurnInstruction[];
    geometry: any; // GeoJSON LineString geometry
}

export interface RouteCoordinates {
    start: [number, number];
    destination: [number, number];
}

/**
 * Fetch route from OSRM with turn-by-turn instructions
 */
export const fetchOSRMRoute = async (
    coords: RouteCoordinates
): Promise<RouteResult | null> => {
    // OSRM expects {lon},{lat}
    const startStr = `${coords.start[0]},${coords.start[1]}`; 
    const destStr = `${coords.destination[0]},${coords.destination[1]}`;

    try {
        // Use env var for OSRM URL (fixes hardcoding issue for production)
        const osrmUrl = import.meta.env.VITE_OSRM_URL || 'http://localhost:5000';
        const response = await fetch(
            `${osrmUrl}/route/v1/driving/${startStr};${destStr}?overview=full&geometries=geojson&steps=true&annotations=distance,duration,speed`
        );

        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const instructions: TurnByTurnInstruction[] = [];

            // Extract turn-by-turn instructions from OSRM response
            if (data.routes[0].legs && Array.isArray(data.routes[0].legs)) {
                for (const leg of data.routes[0].legs) {
                    if (leg.steps && Array.isArray(leg.steps)) {
                        for (const step of leg.steps) {
                            const maneuver = step.maneuver || {};
                            instructions.push({
                                distance: step.distance,
                                duration: step.duration,
                                instruction: maneuver.instruction || 'Continuer',
                                name: step.name || '',
                                type: maneuver.type || '',
                                modifier: maneuver.modifier || ''
                            });
                        }
                    }
                }
            }

            return {
                distance: data.routes[0].distance,
                duration: data.routes[0].duration,
                geometry: data.routes[0].geometry,
                instructions
            };
        } else {
            logger.warn('OSRM returned no valid route');
            return null;
        }
    } catch (error) {
        logger.error('OSRM routing error:', error);
        toast.error('Le service de calcul d\'itinéraire est inaccessible.');
        return null;
    }
};

/**
 * Build GeoJSON feature for route geometry
 */
export const buildRouteGeoJSON = (geometry: any) => ({
    type: 'Feature',
    geometry,
    properties: {}
});
