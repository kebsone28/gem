// Utilitaire de vérification de synchronisation des données de carte
export function verifyCarteSync(
  regionGrappes: any[],
  entrepreneurConfig: any,
  selectedRegion: string
): { status: 'ok' | 'error'; message: string; details: any } {
  const details = {
    totalGrappes: regionGrappes.length,
    kaffrineGrappes: 0,
    tambacoundaGrappes: 0,
    entrepreneursByLot: {},
    selectedGrappe: selectedRegion
  };

  // Compter les grappes par région
  regionGrappes.forEach(grappe => {
    if (grappe.key.startsWith('KAF')) {
      details.kaffrineGrappes++;
    } else if (grappe.key.startsWith('TAM')) {
      details.tambacoundaGrappes++;
    }
  });

  // Compter les entrepreneurs par lot
  ['A', 'B', 'C'].forEach(lot => {
    const lotConfig = entrepreneurConfig[lot] || {};
    let count = 0;
    Object.keys(lotConfig).forEach(key => {
      if (!key.startsWith('__')) {
        count++;
      }
    });
    details.entrepreneursByLot[lot] = count;
  });

  // Vérifications
  const errors = [];

  if (details.kaffrineGrappes !== 6) {
    errors.push(`Kaffrine: ${details.kaffrineGrappes}/6 grappes attendues`);
  }

  if (details.tambacoundaGrappes !== 3) {
    errors.push(`Tambacounda: ${details.tambacoundaGrappes}/3 grappes attendues`);
  }

  if (details.totalGrappes !== 9) {
    errors.push(`Total: ${details.totalGrappes}/9 grappes attendues`);
  }

  // Vérifier BAMBA NDOA
  let bambaCount = 0;
  let bambaKaffrine = 0;
  let bambaTambacounda = 0;

  ['A', 'B', 'C'].forEach(lot => {
    const lotConfig = entrepreneurConfig[lot] || {};
    Object.keys(lotConfig).forEach(key => {
      if (!key.startsWith('__')) {
        const ent = lotConfig[key];
        if (ent?.entreprise === 'BAMBA NDOA') {
          bambaCount++;
          if (key.startsWith('KAF')) bambaKaffrine++;
          if (key.startsWith('TAM')) bambaTambacounda++;
        }
      }
    });
  });

  if (bambaCount !== 2) {
    errors.push(`BAMBA NDOA: ${bambaCount}/2 assignations attendues`);
  }

  if (bambaKaffrine !== 1) {
    errors.push(`BAMBA NDOA Kaffrine: ${bambaKaffrine}/1 assignation attendue`);
  }

  if (bambaTambacounda !== 1) {
    errors.push(`BAMBA NDOA Tambacounda: ${bambaTambacounda}/1 assignation attendue`);
  }

  details.bambaAssignments = {
    total: bambaCount,
    kaffrine: bambaKaffrine,
    tambacounda: bambaTambacounda
  };

  return {
    status: errors.length === 0 ? 'ok' : 'error',
    message: errors.length === 0 ? 'Synchronisation correcte' : errors.join(', '),
    details
  };
}