// Utilitaire de débogage pour les couleurs de grappes
import { GRAPPE_COLORS, getGrappeColorKey } from '../constants';

export function debugGrappeColors() {
  console.log('=== Débogage des couleurs de grappes ===');
  
  const testKeys = [
    'KAF_G001', 'KAF_G002', 'KAF_G003', 'KAF_G004', 'KAF_G005', 'KAF_G006',
    'TAM_G001', 'TAM_G002', 'TAM_G003'
  ];
  
  testKeys.forEach(key => {
    const colorKey = getGrappeColorKey(key);
    const color = GRAPPE_COLORS[colorKey];
    console.log(`${key} -> ${colorKey} -> ${color}`);
  });
  
  console.log('=== Toutes les couleurs disponibles ===');
  console.log(GRAPPE_COLORS);
}