 
import logger from '../utils/logger';

export async function getTravelTimeMatrix(
  coords: { lat: number; lon: number }[]
): Promise<number[][] | null> {
  if (coords.length < 2 || coords.length > 2000) return null; // Limite raisonnable pour la matrice

  // OSRM expects: longitude,latitude;longitude,latitude...
  const coordStr = coords.map((c) => `${c.lon},${c.lat}`).join(';');
  const osrmUrl = import.meta.env.VITE_OSRM_URL || 'http://localhost:5000';
  const url = `${osrmUrl}/table/v1/driving/${coordStr}?annotations=duration`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    // data.durations contient la matrice NxN des temps de parcours en secondes
    if (data && data.durations) {
      return data.durations;
    }
    return null;
  } catch (error) {
    logger.warn('OSRM backend unavailable or error:', error);
    return null;
  }
}
