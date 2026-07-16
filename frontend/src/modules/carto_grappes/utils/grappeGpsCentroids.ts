// Coordonnées GPS des centroïdes de grappes (calculées depuis le fichier Excel)
export const GRAPPE_GPS_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  'KAF_G001': { lat: 14.193452, lon: -15.482235 },
  'KAF_G002': { lat: 14.223507, lon: -15.438862 },
  'KAF_G003': { lat: 14.228686, lon: -15.405225 },
  'KAF_G004': { lat: 14.275439, lon: -15.342173 },
  'KAF_G005': { lat: 14.291424, lon: -15.335124 },
  'KAF_G006': { lat: 14.210866, lon: -15.384051 },
  'TAM_G001': { lat: 13.442218, lon: -13.694104 },
  'TAM_G002': { lat: 13.471670, lon: -13.713139 },
  'TAM_G003': { lat: 13.411199, lon: -13.673952 }
};

// Fonction pour obtenir les coordonnées GPS d'une grappe
export function getGrappeGpsCoordinates(grappeKey: string): { lat: number; lon: number } | null {
  return GRAPPE_GPS_CENTROIDS[grappeKey] || null;
}