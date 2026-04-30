import { utils, writeFile, read } from 'xlsx';

export const exportProjectConfig = async (project: any) => {
  try {
    const wb = utils.book_new();
    const cfg = project?.config || {};
    const devisItems = (cfg.financials as any)?.devisItems ?? [];

    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(
        devisItems.map((i: any) => ({
          ID: i.id,
          Poste_de_Depense: i.label,
          Region: i.region,
          Prevision_Qte: i.qty,
          Prevision_PU: i.unit,
        }))
      ),
      'Devis Items'
    );

    const staffRows: any[] = [];
    Object.entries((cfg.costs as any)?.staffRates || {}).forEach(([rid, teams]: [string, any]) => {
      Object.entries(teams).forEach(([tid, rate]: [string, any]) => {
        staffRows.push({
          Region_ID: rid,
          Team_ID: tid,
          Montant: (rate as any).amount,
          Mode: (rate as any).mode,
        });
      });
    });

    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(staffRows.length ? staffRows : [{ info: 'Aucun tarif' }]),
      'Tarifs Equipes'
    );

    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(
        ((cfg as any).materialCatalog || []).length
          ? (cfg as any).materialCatalog
          : [{ info: 'Catalogue vide' }]
      ),
      'Catalogue Materiel'
    );

    const rates = Object.entries((cfg as any).productionRates || {}).map(([k, v]) => ({
      Metier: k,
      Cadence_F_Jour: v,
    }));
    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(rates.length ? rates : [{ info: 'Aucune cadence' }]),
      'Cadences Production'
    );

    // Onglet Coûts Prévisionnels
    const plannedRows = Object.entries((cfg as any)?.financials?.plannedCosts || {}).map(
      ([id, v]: [string, any]) => ({
        ID: id,
        Prevision_Qte: v.qty ?? '',
        Prevision_PU: v.unit ?? '',
      })
    );
    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(plannedRows.length ? plannedRows : [{ info: 'Aucune donnée' }]),
      'Couts_Previsionnels'
    );

    // Onglet Coûts Réels
    const realRows = Object.entries((cfg as any)?.financials?.realCosts || {}).map(
      ([id, v]: [string, any]) => ({
        ID: id,
        Reel_Qte: v.qty ?? '',
        Reel_PU: v.unit ?? '',
      })
    );
    utils.book_append_sheet(
      wb,
      utils.json_to_sheet(realRows.length ? realRows : [{ info: 'Aucune donnée' }]),
      'Couts_Reels'
    );

    writeFile(wb, `config_projet_${project?.name || 'export'}.xlsx`);
    return { success: true };
  } catch (err: any) {
    console.error('Export error:', err);
    throw new Error('Erreur export configuration.');
  }
};

export const importProjectConfig = async (file: File, currentProjectConfig: any) => {
  try {
    const wb = await read(await file.arrayBuffer(), { type: 'array' });
    const newConfig = { ...(currentProjectConfig || {}) };

    if (wb.SheetNames.includes('Devis Items')) {
      const data: any[] = utils.sheet_to_json(wb.Sheets['Devis Items']);
      if (!newConfig.financials) (newConfig as any).financials = {};
      (newConfig as any).financials.devisItems = data.map((row: any) => ({
        id: row.ID || `import_${Date.now()}`,
        label: row.Poste_de_Depense || 'Sans nom',
        region: row.Region || 'Global',
        qty: Number(row.Prevision_Qte || 1),
        unit: Number(row.Prevision_PU || 0),
      }));
    }

    if (wb.SheetNames.includes('Catalogue Materiel')) {
      const data: any[] = utils.sheet_to_json(wb.Sheets['Catalogue Materiel']);
      if (data.length > 0 && !data[0]?.info) {
        (newConfig as any).materialCatalog = data;
      }
    }

    if (wb.SheetNames.includes('Cadences Production')) {
      const data: any[] = utils.sheet_to_json(wb.Sheets['Cadences Production']);
      const rates: any = {};
      data.forEach((r: any) => {
        if (r.Metier && !r.info) rates[r.Metier] = Number(r.Cadence_F_Jour || 5);
      });
      if (Object.keys(rates).length > 0) {
        (newConfig as any).productionRates = rates;
      }
    }

    return { success: true, newConfig };
  } catch (err: any) {
    console.error('Import error:', err);
    throw new Error('Format invalide');
  }
};
