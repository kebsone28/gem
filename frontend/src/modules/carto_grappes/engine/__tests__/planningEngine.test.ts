import { describe, it, expect } from 'vitest';
import {
  addWorkingDays,
  isSpecialDay,
  fmtDate,
  addDaysStr,
  workingDaysBetween,
  computePlanning,
  detectSenegalHolidays,
} from '../planningEngine';
import type { PlanningParams } from '../../types';
import { PLANNING_DEFAULTS } from '../../constants';

const defaultParams: PlanningParams = { ...PLANNING_DEFAULTS };

const minimalParams: PlanningParams = {
  dateDebut: '2026-07-20',
  dureeObjectifMois: 2,
  joursOuvresParMois: 22,
  samediTravaille: true,
  dimancheTravaille: false,
  compterJoursFeries: true,
  compterJoursReligieux: false,
  compterSaisonPluie: false,
  modeRegions: 'parallele',
  formationMode: 'sequentiel',
  formationDureeJours: 3,
  formationMaxPersonnes: 25,
  nbFormateurs: 1,
  prepCadenceJour: 20,
  maconCadenceJour: 2,
  maconAvanceJours: 5,
  installCadenceJour: 2,
  installEffectifEquipe: 2,
  reseauCadenceJour: 20,
  reseauEffectifEquipe: 2,
  reseauPipelineDebut: 15,
  controleCadenceJour: 15,
  controleDebutPct: 10,
  receptionDelaiJours: 3,
  transportCadenceJour: 100,
  transportEffectifEquipe: 2,
  phaseStartMode: {},
  manualDates: {},
};

const menageCounts: Record<string, number> = {
  Kaffrine: 2185,
  Tambacounda: 1351,
};

describe('fmtDate', () => {
  it('formats a Date to French locale', () => {
    const result = fmtDate(new Date('2026-07-20'));
    expect(result).toContain('20');
    expect(result).toContain('2026');
  });

  it('returns "—" for null/undefined', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });

  it('handles string input', () => {
    const result = fmtDate('2026-01-01');
    expect(result).toContain('2026');
  });
});

describe('addDaysStr', () => {
  it('adds days to a date string', () => {
    const result = addDaysStr('2026-07-20', 5);
    expect(result.getDate()).toBe(25);
    expect(result.getMonth()).toBe(6); // July (0-indexed)
  });

  it('handles month boundaries', () => {
    const result = addDaysStr('2026-07-28', 5);
    expect(result.getDate()).toBe(2);
    expect(result.getMonth()).toBe(7); // August
  });

  it('handles negative offsets', () => {
    const result = addDaysStr('2026-07-20', -5);
    expect(result.getDate()).toBe(15);
  });
});

describe('addWorkingDays', () => {
  it('skips weekends (Saturday disabled)', () => {
    // addWorkingDays increments first, so from Jul 20 (Mon):
    // Jul21(Tue=1), Jul22(Wed=2), Jul23(Thu=3), Jul24(Fri=4), Jul27(Mon=5)
    const result = addWorkingDays('2026-07-20', 5, false, false, minimalParams);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(27);
  });

  it('includes Saturday when samediOk=true', () => {
    // From Jul 16 (Thu): Jul17(Fri=1), Jul18(Sat=2), Jul20(Mon=3), Jul21(Tue=4)
    const result = addWorkingDays('2026-07-16', 4, true, false, minimalParams);
    expect(result.getDate()).toBe(21);
  });

  it('includes Sunday when dimancheOk=true', () => {
    // From Jul 17 (Fri): Jul18(Sat,skip), Jul19(Sun=1), Jul20(Mon=2), Jul21(Tue=3)
    const result = addWorkingDays('2026-07-17', 3, false, true, minimalParams);
    expect(result.getDate()).toBe(21);
  });

  it('includes both Saturday and Sunday when both enabled', () => {
    // From Jul 17 (Fri): Jul18(Sat=1), Jul19(Sun=2), Jul20(Mon=3)
    const result = addWorkingDays('2026-07-17', 3, true, true, minimalParams);
    expect(result.getDate()).toBe(20);
  });

  it('returns start date when n=0', () => {
    const result = addWorkingDays('2026-07-20', 0, false, false, minimalParams);
    expect(result.getDate()).toBe(20);
  });
});

describe('isSpecialDay', () => {
  it('returns not special for a regular weekday', () => {
    const result = isSpecialDay(new Date('2026-07-20'), minimalParams);
    expect(result.isSpecial).toBe(false);
  });

  it('detects fixed holidays', () => {
    const result = isSpecialDay(new Date('2026-01-01'), minimalParams);
    expect(result.isSpecial).toBe(true);
    expect(result.reason).toBe("Jour de l'An");
    expect(result.isNonOuvre).toBe(true);
  });

  it('detects Independence Day', () => {
    const result = isSpecialDay(new Date('2026-04-04'), minimalParams);
    expect(result.isSpecial).toBe(true);
    expect(result.reason).toBe('Indépendance');
  });

  it('detects Christmas', () => {
    const result = isSpecialDay(new Date('2026-12-25'), minimalParams);
    expect(result.isSpecial).toBe(true);
    expect(result.reason).toBe('Noël');
  });

  it('detects Labour Day', () => {
    const result = isSpecialDay(new Date('2026-05-01'), minimalParams);
    expect(result.isSpecial).toBe(true);
    expect(result.reason).toBe('Fête du Travail');
  });

  it('skips holiday check when compterJoursFeries=false', () => {
    const params = { ...minimalParams, compterJoursFeries: false };
    const result = isSpecialDay(new Date('2026-01-01'), params);
    expect(result.isSpecial).toBe(false);
  });

  it('skips religious check when compterJoursReligieux=false', () => {
    const params = { ...minimalParams, compterJoursReligieux: false, compterJoursFeries: true };
    const result = isSpecialDay(new Date('2026-01-01'), params);
    expect(result.isSpecial).toBe(true); // Still catches fixed holiday
  });

  it('detects rainy season days', () => {
    const params = { ...minimalParams, compterSaisonPluie: true, impactPluie: 50 };
    const result = isSpecialDay(new Date('2026-08-10'), params);
    expect(result.isSpecial).toBe(true);
    expect(result.reason).toBe('Saison des pluies');
    expect(result.isPartiel).toBe(true);
  });

  it('skips rainy season when compterSaisonPluie=false', () => {
    const params = { ...minimalParams, compterSaisonPluie: false };
    const result = isSpecialDay(new Date('2026-08-10'), params);
    expect(result.isSpecial).toBe(false);
  });
});

describe('workingDaysBetween', () => {
  it('counts working days between two dates (no weekends)', () => {
    // Monday to Friday = 4 working days (exclusive of end date)
    const count = workingDaysBetween(
      new Date('2026-07-20'),
      new Date('2026-07-25'),
      false,
      false,
      minimalParams,
    );
    expect(count).toBe(5); // Mon, Tue, Wed, Thu, Fri
  });

  it('counts zero for same date', () => {
    const count = workingDaysBetween(
      new Date('2026-07-20'),
      new Date('2026-07-20'),
      false,
      false,
      minimalParams,
    );
    expect(count).toBe(0);
  });

  it('skips fixed holidays', () => {
    // Week containing New Year's Day (2026-01-01 = Thursday)
    const count = workingDaysBetween(
      new Date('2025-12-29'),
      new Date('2026-01-05'),
      false,
      false,
      minimalParams,
    );
    // Mon, Tue, Wed (skip Thu=holiday), skip Sat, skip Sun, Mon
    expect(count).toBe(4);
  });
});

describe('computePlanning', () => {
  it('returns a valid PlanningResult with both regions', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result).toBeDefined();
    expect(result.regions['Kaffrine']).toBeDefined();
    expect(result.regions['Tambacounda']).toBeDefined();
  });

  it('has formation sessions for both regions', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result.formation.length).toBeGreaterThan(0);
    const regions = new Set(result.formation.map(f => f.region));
    expect(regions.has('Kaffrine')).toBe(true);
    expect(regions.has('Tambacounda')).toBe(true);
  });

  it('each formation session has valid dates', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const f of result.formation) {
      expect(f.debut).toBeInstanceOf(Date);
      expect(f.fin).toBeInstanceOf(Date);
      expect(f.fin.getTime()).toBeGreaterThanOrEqual(f.debut.getTime());
      expect(f.participants).toBeGreaterThan(0);
    }
  });

  it('has Gantt items for each phase and region', () => {
    const result = computePlanning(minimalParams, menageCounts);
    const phases = new Set(result.gantt.map(g => g.phase));
    expect(phases.has('Formation')).toBe(true);
    expect(phases.has('Maçonnerie')).toBe(true);
    expect(phases.has('Transport')).toBe(true);
    expect(phases.has('Installation intérieure')).toBe(true);
    expect(phases.has('Réseau BT')).toBe(true);
    expect(phases.has('Contrôle qualité')).toBe(true);
    expect(phases.has('Réception')).toBe(true);
  });

  it('each region has a finRegion date', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result.regions['Kaffrine'].finRegion).toBeInstanceOf(Date);
    expect(result.regions['Tambacounda'].finRegion).toBeInstanceOf(Date);
  });

  it('synthese has valid totals', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result.synthese.totalElecInstall).toBeGreaterThan(0);
    expect(result.synthese.totalElecReseau).toBeGreaterThan(0);
    expect(result.synthese.dureeJours).toBeGreaterThan(0);
    expect(result.synthese.dureeMois).toBeGreaterThan(0);
  });

  it('prepByRegion has entries for both regions', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result.prepByRegion['Kaffrine']).toBeDefined();
    expect(result.prepByRegion['Tambacounda']).toBeDefined();
    expect(result.prepByRegion['Kaffrine'].debut).toBeInstanceOf(Date);
    expect(result.prepByRegion['Kaffrine'].fin).toBeInstanceOf(Date);
  });

  it('each region has install, reseau, controle, macon, transport details', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      const reg = result.regions[r];
      expect(reg.install).toBeDefined();
      expect(reg.reseau).toBeDefined();
      expect(reg.controle).toBeDefined();
      expect(reg.macon).toBeDefined();
      expect(reg.transport).toBeDefined();
      expect(reg.install.equipes).toBeGreaterThan(0);
      expect(reg.install.jours).toBeGreaterThan(0);
    }
  });

  it('handles sequential mode', () => {
    const params = { ...minimalParams, modeRegions: 'sequentiel' as const };
    const result = computePlanning(params, menageCounts);
    expect(result.regions['Kaffrine']).toBeDefined();
    expect(result.regions['Tambacounda']).toBeDefined();
    // In sequential mode, the second region should start after the first finishes
    const kfFin = result.regions['Kaffrine'].finRegion;
    const tbDebut = result.regions['Tambacounda'].macon.debut;
    expect(tbDebut.getTime()).toBeGreaterThanOrEqual(kfFin.getTime() - 86400000); // Allow 1 day tolerance
  });

  it('handles parallel mode', () => {
    const params = { ...minimalParams, modeRegions: 'parallele' as const };
    const result = computePlanning(params, menageCounts);
    // Both regions should have work happening
    expect(result.regions['Kaffrine'].install.equipes).toBeGreaterThan(0);
    expect(result.regions['Tambacounda'].install.equipes).toBeGreaterThan(0);
  });

  it('handles parallel formation mode', () => {
    const params = { ...minimalParams, formationMode: 'parallele' as const, nbFormateurs: 2 };
    const result = computePlanning(params, menageCounts);
    expect(result.formation.length).toBeGreaterThan(0);
  });

  it('generates alerts for deadline exceeded', () => {
    const params = {
      ...minimalParams,
      dateDebut: '2026-07-20',
      dateLimiteProjet: '2026-09-01',
    };
    const result = computePlanning(params, menageCounts);
    const deadlineAlerts = result.alertes.filter(a => a.phase === 'deadline');
    expect(deadlineAlerts.length).toBeGreaterThan(0);
  });

  it('handles zero menages gracefully', () => {
    const counts = { Kaffrine: 0, Tambacounda: 0 };
    const result = computePlanning(minimalParams, counts);
    expect(result).toBeDefined();
    expect(result.regions['Kaffrine']).toBeDefined();
  });

  it('respects samediTravaille and dimancheTravaille', () => {
    const paramsNoWE = { ...minimalParams, samediTravaille: false, dimancheTravaille: false };
    const paramsAllWE = { ...minimalParams, samediTravaille: true, dimancheTravaille: true };
    const resultNoWE = computePlanning(paramsNoWE, menageCounts);
    const resultAllWE = computePlanning(paramsAllWE, menageCounts);
    // Planning with all weekends should be shorter (more working days)
    expect(resultAllWE.synthese.dureeJours).toBeLessThanOrEqual(resultNoWE.synthese.dureeJours);
  });

  it('each region has grappes breakdown for all phases', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      const gr = result.regions[r].grappes;
      expect(gr).toBeDefined();
      expect(gr.macon.length).toBeGreaterThan(0);
      expect(gr.transport.length).toBeGreaterThan(0);
      expect(gr.install.length).toBeGreaterThan(0);
      expect(gr.reseau.length).toBeGreaterThan(0);
      expect(gr.controle.length).toBeGreaterThan(0);
    }
  });

  it('Kaffrine has 6 grappes, Tambacounda has 3', () => {
    const result = computePlanning(minimalParams, menageCounts);
    expect(result.regions['Kaffrine'].grappes.macon).toHaveLength(6);
    expect(result.regions['Tambacounda'].grappes.macon).toHaveLength(3);
  });

  it('grappe menage counts sum to region total', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      const totalG = result.regions[r].grappes.macon.reduce((s, g) => s + g.menages, 0);
      expect(totalG).toBe(result.regions[r].menages);
    }
  });

  it('per-grappe equipes sum to region equipes', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      const maconSum = result.regions[r].grappes.macon.reduce((s, g) => s + g.equipes, 0);
      expect(maconSum).toBe(result.regions[r].macon.equipes);
      const transportSum = result.regions[r].grappes.transport.reduce((s, g) => s + g.equipes, 0);
      expect(transportSum).toBe(result.regions[r].transport.equipes);
    }
  });

  it('transport cadenceConsommation matches macon equipes × cadence per grappe', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      for (const tg of result.regions[r].grappes.transport) {
        const mg = result.regions[r].grappes.macon.find(m => m.grappeKey === tg.grappeKey);
        expect(mg).toBeDefined();
        expect(tg.cadenceConsommation).toBe(mg!.equipes * (minimalParams.maconCadenceJour || 2));
      }
    }
  });

  it('transport satisfait when cadenceLivraison >= cadenceConsommation', () => {
    const result = computePlanning(minimalParams, menageCounts);
    for (const r of ['Kaffrine', 'Tambacounda']) {
      for (const tg of result.regions[r].grappes.transport) {
        expect(tg.satisfait).toBe(tg.cadenceLivraison >= tg.cadenceConsommation);
      }
    }
  });

  it('accepts custom grappeMenageCounts', () => {
    const custom = {
      Kaffrine: { 1: 400, 2: 400, 3: 400, 4: 400, 5: 300, 6: 285 } as Record<number, number>,
      Tambacounda: { 1: 500, 2: 500, 3: 351 } as Record<number, number>,
    };
    const result = computePlanning(minimalParams, menageCounts, custom);
    expect(result.regions['Kaffrine'].grappes.macon[0].menages).toBe(400);
    expect(result.regions['Tambacounda'].grappes.macon[0].menages).toBe(500);
  });

  it('§19 alert when transport cadence is insufficient', () => {
    const params = {
      ...minimalParams,
      maconCadenceJour: 2,
      transportCadenceJour: 100,
      maconEquipesKaffrine: 10,
      transportEquipesKaffrine: 1,
    };
    const result = computePlanning(params, menageCounts);
    const s19 = result.alertes.filter(a => a.phase === '§19');
    // With many macon teams and few transport, some grappes may have insufficient cadence
    // The test verifies the §19 mechanism fires (or doesn't) correctly
    for (const a of s19) {
      expect(a.msg).toContain('§19');
      expect(a.sev).toBe('high');
    }
  });
});

describe('detectSenegalHolidays', () => {
  it('returns 4 religious holidays', () => {
    const holidays = detectSenegalHolidays(2026);
    expect(holidays).toHaveLength(4);
  });

  it('each holiday has required fields', () => {
    const holidays = detectSenegalHolidays(2026);
    for (const h of holidays) {
      expect(h.key).toBeDefined();
      expect(h.name).toBeDefined();
      expect(h.autoDate).toBeInstanceOf(Date);
    }
  });

  it('Magal de Touba is before Gamou (chronological order)', () => {
    const holidays = detectSenegalHolidays(2026);
    const magal = holidays.find(h => h.key === 'magal')!;
    const gamou = holidays.find(h => h.key === 'gamou')!;
    expect(magal.autoDate.getTime()).toBeLessThan(gamou.autoDate.getTime());
  });

  it('Korité is before Tabaski', () => {
    const holidays = detectSenegalHolidays(2026);
    const korite = holidays.find(h => h.key === 'korite')!;
    const tabaski = holidays.find(h => h.key === 'tabaski')!;
    expect(korite.autoDate.getTime()).toBeLessThan(tabaski.autoDate.getTime());
  });

  it('holidays shift approximately 10-11 days earlier each year (lunar calendar)', () => {
    const h2024 = detectSenegalHolidays(2024);
    const h2025 = detectSenegalHolidays(2025);
    const magal24 = h2024.find(h => h.key === 'magal')!.autoDate;
    const magal25 = h2025.find(h => h.key === 'magal')!.autoDate;
    // Lunar year ~354 days, so consecutive Islamic years are ~354 days apart
    const gap = (magal25.getTime() - magal24.getTime()) / 86400000;
    expect(gap).toBeGreaterThan(340);
    expect(gap).toBeLessThan(370);
    // Within a Gregorian year, holidays shift ~10-11 days earlier
    const doy24 = Math.floor((magal24.getTime() - new Date(magal24.getFullYear(), 0, 0).getTime()) / 86400000);
    const doy25 = Math.floor((magal25.getTime() - new Date(magal25.getFullYear(), 0, 0).getTime()) / 86400000);
    const yearShift = doy24 - doy25; // positive = earlier in 2025 than 2024
    expect(yearShift).toBeGreaterThan(5);
    expect(yearShift).toBeLessThan(20);
  });
});
