import type {
  PlanningParams, PlanningResult, GanttItem, PlanningAlert,
  FormationSession, PhaseDetail, RegionPlanning, PlanningSynthese,
  GrappePhaseDetail, GrappeTransportDetail,
} from '../types';
import { REGIONS, GRAPPE_COUNT } from '../constants';

/* ── Calendar Helpers ── */

const JOURS_FERIES_SENEGAL: Record<string, string> = {
  '01-01': "Jour de l'An",
  '04-04': 'Indépendance',
  '05-01': 'Fête du Travail',
  '08-15': 'Assomption',
  '11-01': 'Toussaint',
  '12-25': 'Noël',
};

function formatDateMMDD(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function isRainySeason(date: Date, params: PlanningParams): boolean {
  const mois = date.getMonth() + 1;
  const debut = params.saisonPluieDebut || '07-01';
  const fin = params.saisonPluieFin || '10-15';
  const debutMois = parseInt(debut.split('-')[0]);
  const debutJour = parseInt(debut.split('-')[1]);
  const finMois = parseInt(fin.split('-')[0]);
  const finJour = parseInt(fin.split('-')[1]);
  if (debutMois < finMois) {
    return (mois > debutMois || (mois === debutMois && date.getDate() >= debutJour)) &&
      (mois < finMois || (mois === finMois && date.getDate() <= finJour));
  }
  return (mois >= debutMois && date.getDate() >= debutJour) ||
    (mois <= finMois && date.getDate() <= finJour);
}

interface MobileHoliday {
  date: Date;
  name: string;
  impact: number;
  isNonOuvre: boolean; // Nouveau: jour complètement non ouvré
  isPartiel: boolean; // Nouveau: jour partiellement ouvré
  reductionJours: number; // Nouveau: réduction en jours équivalents
}

function calculateMobileHolidays(year: number, params: PlanningParams): MobileHoliday[] {
  const holidays: MobileHoliday[] = [];
  const eventConfig = params.eventCalendrier || {};
  const lunarYear = 354.37;
  const refs = [
    { 
      base: '2024-02-12', 
      name: 'Magal de Touba', 
      avantKey: 'magalAvantJours', 
      apresKey: 'magalApresJours', 
      overrideKey: 'magalDateOverride',
      nonOuvreKey: 'magalNonOuvre',
      avantPartielKey: 'magalAvantPartiel',
      apresPartielKey: 'magalApresPartiel',
      avantReductionKey: 'magalAvantReduction',
      apresReductionKey: 'magalApresReduction'
    },
    { 
      base: '2024-03-11', 
      name: 'Gamou (Mawlid)', 
      avantKey: 'gamouAvantJours', 
      apresKey: 'gamouApresJours', 
      impactKey: 'gamouImpact', 
      overrideKey: 'gamouDateOverride',
      nonOuvreKey: 'gamouNonOuvre',
      avantPartielKey: 'gamouAvantPartiel',
      apresPartielKey: 'gamouApresPartiel',
      avantReductionKey: 'gamouAvantReduction',
      apresReductionKey: 'gamouApresReduction'
    },
    { 
      base: '2024-04-10', 
      name: 'Korité (Eid al-Fitr)', 
      avantKey: 'koriteAvantJours', 
      apresKey: 'koriteApresJours', 
      impactKey: 'koriteImpact', 
      overrideKey: 'koriteDateOverride',
      nonOuvreKey: 'koriteNonOuvre',
      avantPartielKey: 'koriteAvantPartiel',
      apresPartielKey: 'koriteApresPartiel',
      avantReductionKey: 'koriteAvantReduction',
      apresReductionKey: 'koriteApresReduction'
    },
    { 
      base: '2024-06-17', 
      name: 'Tabaski (Eid al-Adha)', 
      avantKey: 'tabaskiAvantJours', 
      apresKey: 'tabaskiApresJours', 
      impactKey: 'tabaskiImpact', 
      overrideKey: 'tabaskiDateOverride',
      nonOuvreKey: 'tabaskiNonOuvre',
      avantPartielKey: 'tabaskiAvantPartiel',
      apresPartielKey: 'tabaskiApresPartiel',
      avantReductionKey: 'tabaskiAvantReduction',
      apresReductionKey: 'tabaskiApresReduction'
    },
  ];
  
  refs.forEach(h => {
    const overrideVal = params[h.overrideKey as keyof PlanningParams] as string | undefined;
    const hDate = overrideVal ? new Date(overrideVal) : (() => {
      const baseDate = new Date(h.base);
      const offset = Math.floor((year - 2024) * lunarYear);
      const d = new Date(baseDate);
      d.setDate(d.getDate() + offset);
      return d;
    })();
    
    const avant = (params[h.avantKey] != null) ? (params[h.avantKey] as number) : 5;
    const apres = (params[h.apresKey] != null) ? (params[h.apresKey] as number) : 3;
    
    // Nouvelle logique binaire
    const isNonOuvre = (eventConfig[h.nonOuvreKey as keyof EventCalendrierConfig] as boolean) ?? false;
    const isAvantPartiel = (eventConfig[h.avantPartielKey as keyof EventCalendrierConfig] as boolean) ?? false;
    const isApresPartiel = (eventConfig[h.apresPartielKey as keyof EventCalendrierConfig] as boolean) ?? false;
    const avantReduction = (eventConfig[h.avantReductionKey as keyof EventCalendrierConfig] as number) ?? 0.5;
    const apresReduction = (eventConfig[h.apresReductionKey as keyof EventCalendrierConfig] as number) ?? 0.5;
    
    // Fallback sur l'ancien système si la nouvelle config n'est pas définie
    const useLegacy = !isNonOuvre && !isAvantPartiel && !isApresPartiel;
    const impactCoeff = useLegacy ? (1 - ((params[h.impactKey] as number || 0) / 100)) : 1;
    
    for (let i = -avant; i <= apres; i++) {
      const extDate = new Date(hDate);
      extDate.setDate(extDate.getDate() + i);
      
      if (i === 0) {
        // Jour principal de l'événement
        if (isNonOuvre) {
          holidays.push({ 
            date: extDate, 
            name: h.name, 
            impact: 1, 
            isNonOuvre: true, 
            isPartiel: false, 
            reductionJours: 1 
          });
        } else {
          holidays.push({ 
            date: extDate, 
            name: h.name, 
            impact: useLegacy ? 1 : 0.5, 
            isNonOuvre: false, 
            isPartiel: !useLegacy, 
            reductionJours: useLegacy ? 1 : 0.5 
          });
        }
      } else {
        // Jours avant/après
        const isAvant = i < 0;
        const isPartiel = isAvant ? isAvantPartiel : isApresPartiel;
        const reduction = isAvant ? avantReduction : apresReduction;
        
        if (isPartiel) {
          holidays.push({ 
            date: extDate, 
            name: h.name, 
            impact: useLegacy ? impactCoeff : 0.5, 
            isNonOuvre: false, 
            isPartiel: true, 
            reductionJours: reduction 
          });
        } else {
          holidays.push({ 
            date: extDate, 
            name: h.name, 
            impact: useLegacy ? impactCoeff : 0, 
            isNonOuvre: false, 
            isPartiel: false, 
            reductionJours: 0 
          });
        }
      }
    }
  });
  return holidays;
}

interface SpecialDayResult {
  isSpecial: boolean;
  reason?: string;
  impact?: number;
  isNonOuvre?: boolean;
  isPartiel?: boolean;
  reductionJours?: number;
}

export function isSpecialDay(date: Date, params: PlanningParams): SpecialDayResult {
  const dk = formatDateMMDD(date);
  if (params.compterJoursFeries !== false && JOURS_FERIES_SENEGAL[dk]) {
    return { isSpecial: true, reason: JOURS_FERIES_SENEGAL[dk], impact: 1, isNonOuvre: true, isPartiel: false, reductionJours: 1 };
  }
  if (params.compterJoursReligieux !== false) {
    const year = date.getFullYear();
    const hols = calculateMobileHolidays(year, params);
    for (const h of hols) {
      if (Math.abs(h.date.getTime() - date.getTime()) < 86400000) {
        return { 
          isSpecial: true, 
          reason: h.name, 
          impact: h.impact,
          isNonOuvre: h.isNonOuvre,
          isPartiel: h.isPartiel,
          reductionJours: h.reductionJours
        };
      }
    }
  }
  if (params.compterSaisonPluie !== false && isRainySeason(date, params)) {
    return { 
      isSpecial: true, 
      reason: 'Saison des pluies', 
      impact: (params.impactPluie || 50) / 100,
      isNonOuvre: false,
      isPartiel: true,
      reductionJours: (params.impactPluie || 50) / 100
    };
  }
  return { isSpecial: false };
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addDaysStr(dateStr: string, n: number): Date {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d;
}

export function addWorkingDays(dateStr: string, n: number, samediOk: boolean, dimancheOk: boolean, params?: PlanningParams): Date {
  let d = new Date(dateStr);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 && !dimancheOk) continue;
    if (day === 6 && !samediOk) continue;
    if (params) {
      const sp = isSpecialDay(d, params);
      if (sp.isSpecial && sp.isNonOuvre) continue;
      if (sp.isSpecial && sp.isPartiel) {
        // Jour partiel: on compte 0.5 jour
        added += 0.5;
        continue;
      }
    }
    added++;
  }
  return d;
}

function workingDaysBetween(d1: Date, d2: Date, samediOk: boolean, dimancheOk: boolean, params?: PlanningParams): number {
  let count = 0;
  const cur = new Date(d1);
  while (cur < d2) {
    const day = cur.getDay();
    if (day === 0 && !dimancheOk) { cur.setDate(cur.getDate() + 1); continue; }
    if (day === 6 && !samediOk) { cur.setDate(cur.getDate() + 1); continue; }
    if (params) {
      const sp = isSpecialDay(cur, params);
      if (sp.isSpecial && sp.isNonOuvre) { cur.setDate(cur.getDate() + 1); continue; }
      if (sp.isSpecial && sp.isPartiel) {
        // Jour partiel: on compte 0.5 jour
        count += 0.5;
        cur.setDate(cur.getDate() + 1);
        continue;
      }
    }
    count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function isJourOuvrable(d: Date, params: PlanningParams): boolean {
  const day = d.getDay();
  if (day === 0 && !params.dimancheTravaille) return false;
  if (day === 6 && !params.samediTravaille) return false;
  const sp = isSpecialDay(d, params);
  if (sp.isSpecial && sp.isNonOuvre) return false;
  // Les jours partiels sont toujours considérés comme ouvrables
  return true;
}

function resolveDate(
  manualObj: Record<string, string> | undefined,
  region: string,
  fallback: Date,
  params: PlanningParams,
  phaseKey?: string,
): Date {
  const mode = phaseKey ? (params.phaseStartMode?.[phaseKey] ?? 'auto') : 'manual';
  if (mode === 'manual' && manualObj && manualObj[region]) {
    const md = new Date(manualObj[region]);
    while (!isJourOuvrable(md, params)) md.setDate(md.getDate() + 1);
    return md;
  }
  const fd = new Date(fallback);
  while (!isJourOuvrable(fd, params)) fd.setDate(fd.getDate() + 1);
  return fd;
}

/* ── Team Distribution Helper ── */

function distributeTeamsToGrappe(
  regionTeams: number,
  grappeMenages: number,
  totalRegionMenages: number,
  cadencePerTeam: number,
  daysObj: number,
): { equipes: number; equipesMin: number } {
  const equipesMin = Math.ceil(grappeMenages / (cadencePerTeam * daysObj));
  if (regionTeams <= 0) return { equipes: Math.max(equipesMin, 1), equipesMin };
  const equipes = Math.max(Math.round(regionTeams * grappeMenages / totalRegionMenages), equipesMin);
  return { equipes, equipesMin };
}

/* ── Main Planning Engine ── */

export function computePlanning(
  p: PlanningParams,
  menageCounts: Record<string, number>,
  grappeMenageCounts?: Record<string, Record<number, number>>,
): PlanningResult {
  const result: PlanningResult = {
    regions: {},
    formation: [],
    prepByRegion: {},
    gantt: [],
    alertes: [],
    synthese: {
      finGlobal: new Date(), debutTravaux: new Date(),
      dureeJours: 0, dureeMois: 0, dureeProjetJours: 0, dureeProjetMois: 0,
      totalElecInstall: 0, totalElecReseau: 0, totalElec: 0,
      elecDisponibles: 0, surplus: 0, bottleneck: null, totalEquipes: {},
    },
  };

  const jpm = p.joursOuvresParMois ?? 22;

  const elecKeys: Record<string, string> = { Kaffrine: 'elecKaffrine', Tambacounda: 'elecTamba' };
  const REGION_DATA: Record<string, { menages: number; elec: number; chefs: number }> = {};
  for (const r of REGIONS) {
    const cnt = menageCounts[r] || 0;
    const nbElec = (p[elecKeys[r]] as number) || Math.ceil(cnt / 37);
    REGION_DATA[r] = { menages: cnt, elec: nbElec, chefs: Math.max(1, Math.ceil(nbElec / 20)) };
  }

  const totalMenagesAll = Object.values(REGION_DATA).reduce((s, r) => s + r.menages, 0);

  let totalElectriciens = p.totalElectriciens || 0;
  if (!totalElectriciens) {
    totalElectriciens = Object.values(REGION_DATA).reduce((s, r) => s + r.elec, 0);
  }

  let maconsKF = p.maconsKaffrine || 0;
  let maconsTB = p.maconsTamba || 0;
  if (!maconsKF && !maconsTB) {
    const autoMacons = Math.ceil(totalMenagesAll / 37);
    maconsKF = Math.round(autoMacons * 0.62);
    maconsTB = autoMacons - maconsKF;
  }

  let prepKF = p.preparateursKaffrine || 0;
  let prepTB = p.preparateursTamba || 0;
  if (!prepKF && !prepTB) {
    const autoPrep = Math.ceil(totalMenagesAll / ((p.prepCadenceJour || 20) * (p.dureeObjectifMois || 2) * jpm)) * 2;
    prepKF = Math.round(autoPrep * 0.62);
    prepTB = autoPrep - prepKF;
  }

  const regions_order = [...(p.regionsOrdre || [])];
  for (const r of REGIONS) { if (!regions_order.includes(r)) regions_order.push(r); }

  const daysObj = (p.dureeObjectifMois || 2) * jpm;

  /* ── Formation ── */
  let formDate = new Date(p.dateDebut || '2026-07-13');
  while (!isJourOuvrable(formDate, p)) formDate.setDate(formDate.getDate() + 1);

  const formation: FormationSession[] = [];
  let formCursor = new Date(formDate);
  const nbFormateurs = p.nbFormateurs || 1;
  const isParallel = p.formationMode === 'parallele' && nbFormateurs >= 2;

  if (isParallel) {
    for (let rIdx = 0; rIdx < regions_order.length; rIdx++) {
      const region = regions_order[rIdx];
      const elec = REGION_DATA[region]?.elec || 0;
      const sessions = Math.ceil(elec / (p.formationMaxPersonnes ?? 25));
      const baseParSession = Math.floor(elec / sessions);
      const reste = elec - baseParSession * sessions;
      let regionCursor = resolveDate(undefined, region, new Date(formDate), p);

      for (let s = 0; s < sessions; s++) {
        const debut = new Date(regionCursor);
        const cursor = new Date(debut);
        let ouvres = 0;
        while (ouvres < (p.formationDureeJours ?? 3)) {
          const sp = isSpecialDay(cursor, p);
          if (isJourOuvrable(cursor, p)) {
            if (sp.isSpecial && sp.isPartiel) {
              ouvres += 0.5;
            } else {
              ouvres++;
            }
          }
          if (ouvres < (p.formationDureeJours ?? 3)) cursor.setDate(cursor.getDate() + 1);
        }
        const fin = new Date(cursor);
        formation.push({
          region, session: s + 1, debut, fin,
          participants: baseParSession + (s < reste ? 1 : 0),
          formateur: rIdx + 1,
          label: `Formation ${region} — Session ${s + 1} (Formateur ${rIdx + 1})`,
        });
        regionCursor = new Date(fin);
        regionCursor.setDate(regionCursor.getDate() + 1);
        while (!isJourOuvrable(regionCursor, p)) regionCursor.setDate(regionCursor.getDate() + 1);
        for (let p2 = 0; p2 < (p.pauseEntreSessions ?? 0); p2++) {
          regionCursor.setDate(regionCursor.getDate() + 1);
          while (!isJourOuvrable(regionCursor, p)) regionCursor.setDate(regionCursor.getDate() + 1);
        }
      }
    }
  } else {
    for (const region of regions_order) {
      const elec = REGION_DATA[region]?.elec || 0;
      const sessions = Math.ceil(elec / (p.formationMaxPersonnes ?? 25));
      const baseParSession = Math.floor(elec / sessions);
      const reste = elec - baseParSession * sessions;

      if (formation.length === 0) {
        formCursor = resolveDate(p.manualDates?.formation, region, new Date(formDate), p, 'formation');
      } else {
        const prevFin = formation[formation.length - 1].fin;
        const autoStart = addDaysStr(prevFin.toISOString().slice(0, 10), 1);
        formCursor = resolveDate(p.manualDates?.formation, region, autoStart, p, 'formation');
      }

      for (let s = 0; s < sessions; s++) {
        const debut = new Date(formCursor);
        const cursor = new Date(debut);
        let ouvres = 0;
        while (ouvres < (p.formationDureeJours ?? 3)) {
          const sp = isSpecialDay(cursor, p);
          if (isJourOuvrable(cursor, p)) {
            if (sp.isSpecial && sp.isPartiel) {
              ouvres += 0.5;
            } else {
              ouvres++;
            }
          }
          if (ouvres < (p.formationDureeJours ?? 3)) cursor.setDate(cursor.getDate() + 1);
        }
        const fin = new Date(cursor);
        formation.push({
          region, session: s + 1, debut, fin,
          participants: baseParSession + (s < reste ? 1 : 0),
          formateur: 1,
          label: `Formation ${region} — Session ${s + 1}`,
        });
        formCursor = new Date(fin);
        formCursor.setDate(formCursor.getDate() + 1);
        while (!isJourOuvrable(formCursor, p)) formCursor.setDate(formCursor.getDate() + 1);
        for (let p2 = 0; p2 < (p.pauseEntreSessions ?? 0); p2++) {
          formCursor.setDate(formCursor.getDate() + 1);
          while (!isJourOuvrable(formCursor, p)) formCursor.setDate(formCursor.getDate() + 1);
        }
      }
    }
  }

  result.formation = formation;

  /* ── Formation bars in Gantt ── */
  for (const f of formation) {
    result.gantt.push({
      phase: 'Formation', region: f.region, debut: f.debut, fin: f.fin,
      color: '#667eea', detail: `Session ${f.session} — ${f.participants} élec. (Formateur ${f.formateur})`,
    });
  }

  /* ── Présparation kits per region ── */
  for (const region of regions_order) {
    const firstSession = formation.find(f => f.region === region);
    const debutPrepAuto = firstSession ? addDaysStr(firstSession.fin.toISOString().slice(0, 10), 1) : new Date(formDate);
    const debutPrep = resolveDate(p.manualDates?.preparation, region, debutPrepAuto, p, 'preparation');
    const menagesCnt = REGION_DATA[region]?.menages || 0;
    const prepCount = prepKF + prepTB;
    const prepEquipesRegion = region === 'Kaffrine' ? prepKF : prepTB;
    const prepEquipes = prepEquipesRegion > 0 ? Math.max(1, Math.ceil(prepEquipesRegion / 2)) : Math.max(1, Math.ceil(prepCount / 2));
    const joursNecessaires = Math.ceil(menagesCnt / (prepEquipes * (p.prepCadenceJour || 20)));
    const finPrep = addWorkingDays(debutPrep.toISOString().slice(0, 10), joursNecessaires, !!p.samediTravaille, !!p.dimancheTravaille, p);
    result.prepByRegion[region] = { debut: debutPrep, fin: finPrep, jours: joursNecessaires };
    result.gantt.push({
      phase: 'Préparation kits', region, debut: debutPrep, fin: finPrep,
      color: '#F2CC8F', detail: `${prepEquipes} préparateurs × ${p.prepCadenceJour || 20} = ${prepEquipes * (p.prepCadenceJour || 20)} kits/j`,
    });
  }

  /* ── Per-region: Maçonnerie, Transport, Installation, Réseau, Contrôle — via grappes ── */
  const isModeParallele = p.modeRegions !== 'sequentiel';
  let regionCursorSeq: Date | null = null;

  for (const region of regions_order) {
    const menagesCnt = REGION_DATA[region]?.menages || 0;
    const elec = REGION_DATA[region]?.elec || 0;
    const prep = result.prepByRegion[region];

    /* ── Resolve grappes for this region ── */
    const nbGrappeCount = GRAPPE_COUNT[region] || 1;
    const regionGrappeCounts = grappeMenageCounts?.[region];
    const grappeKeys: string[] = [];
    const grappeMenagesArr: number[] = [];
    if (regionGrappeCounts) {
      for (let g = 1; g <= nbGrappeCount; g++) {
        grappeKeys.push(`${region}_${g}`);
        grappeMenagesArr.push(regionGrappeCounts[g] ?? 0);
      }
    } else {
      const base = Math.floor(menagesCnt / nbGrappeCount);
      const remainder = menagesCnt - base * nbGrappeCount;
      for (let g = 1; g <= nbGrappeCount; g++) {
        grappeKeys.push(`${region}_${g}`);
        grappeMenagesArr.push(base + (g <= remainder ? 1 : 0));
      }
    }

    /* ── Region-level team pools ── */
    const maconUserR = region === 'Kaffrine' ? (p.maconEquipesKaffrine || 0) : (p.maconEquipesTamba || 0);
    const transportUserR = region === 'Kaffrine' ? (p.transportEquipesKaffrine || 0) : (p.transportEquipesTamba || 0);
    const installUserR = region === 'Kaffrine' ? (p.installEquipesKaffrine || 0) : (p.installEquipesTamba || 0);
    const reseauUserR = region === 'Kaffrine' ? (p.reseauEquipesKaffrine || 0) : (p.reseauEquipesTamba || 0);
    const ctrlUserR = region === 'Kaffrine' ? (p.controleursEquipesKaffrine || 0) : (p.controleursEquipesTamba || 0);

    /* ── Per-grappe calculation ── */
    const maconGrappes: GrappePhaseDetail[] = [];
    const transportGrappes: GrappeTransportDetail[] = [];
    const installGrappes: GrappePhaseDetail[] = [];
    const reseauGrappes: GrappePhaseDetail[] = [];
    const controleGrappes: GrappePhaseDetail[] = [];

    for (let gi = 0; gi < nbGrappeCount; gi++) {
      const gKey = grappeKeys[gi];
      const gMenages = grappeMenagesArr[gi];

      /* Maçonnerie par grappe */
      const maconCadence = p.maconCadenceJour || 2;
      const mResult = distributeTeamsToGrappe(maconUserR, gMenages, menagesCnt, maconCadence, daysObj);
      const maconJoursG = Math.ceil(gMenages / (mResult.equipes * maconCadence));

      let debutMaconAutoG: Date;
      if (isModeParallele) {
        debutMaconAutoG = new Date(prep?.debut || formDate);
      } else {
        debutMaconAutoG = regionCursorSeq ? new Date(regionCursorSeq) : new Date(prep?.debut || formDate);
      }
      while (!isJourOuvrable(debutMaconAutoG, p)) debutMaconAutoG.setDate(debutMaconAutoG.getDate() + 1);
      const debutMaconG = resolveDate(p.manualDates?.maconnerie, region, debutMaconAutoG, p, 'maconnerie');
      const finMaconG = addWorkingDays(debutMaconG.toISOString().slice(0, 10), maconJoursG, !!p.samediTravaille, !!p.dimancheTravaille, p);
      maconGrappes.push({ grappeKey: gKey, equipes: mResult.equipes, equipesMin: mResult.equipesMin, jours: maconJoursG, debut: debutMaconG, fin: finMaconG, cadence: mResult.equipes * maconCadence, menages: gMenages });

      /* Transport par grappe — cadence liée à la maçonnerie de CETTE grappe */
      const cadenceConsommationG = mResult.equipes * maconCadence;
      const transportCadence = p.transportCadenceJour || 100;
      const transportEquipesMinG = Math.ceil(cadenceConsommationG / transportCadence);
      const tResult = distributeTeamsToGrappe(transportUserR, gMenages, menagesCnt, transportCadence, daysObj);
      const transportEquipesG = Math.max(tResult.equipes, transportEquipesMinG);
      const transportJoursG = Math.ceil(gMenages / (transportEquipesG * transportCadence));
      const debutTransportAutoG = new Date(debutMaconG);
      while (!isJourOuvrable(debutTransportAutoG, p)) debutTransportAutoG.setDate(debutTransportAutoG.getDate() + 1);
      const debutTransportG = resolveDate(p.manualDates?.transport, region, debutTransportAutoG, p, 'transport');
      const finTransportG = addWorkingDays(debutTransportG.toISOString().slice(0, 10), transportJoursG, !!p.samediTravaille, !!p.dimancheTravaille, p);
      const cadenceLivraisonG = transportEquipesG * transportCadence;
      transportGrappes.push({ grappeKey: gKey, equipes: transportEquipesG, equipesMin: transportEquipesMinG, jours: transportJoursG, debut: debutTransportG, fin: finTransportG, cadence: cadenceLivraisonG, menages: gMenages, cadenceConsommation: cadenceConsommationG, cadenceLivraison: cadenceLivraisonG, satisfait: cadenceLivraisonG >= cadenceConsommationG });

      /* Installation par grappe */
      const installCadence = p.installCadenceJour || 2;
      const iResult = distributeTeamsToGrappe(installUserR, gMenages, menagesCnt, installCadence, daysObj);
      const installJoursG = Math.ceil(gMenages / (iResult.equipes * installCadence));
      const debutInstallAutoG = addWorkingDays(debutMaconG.toISOString().slice(0, 10), p.maconAvanceJours || 5, !!p.samediTravaille, !!p.dimancheTravaille, p);
      while (!isJourOuvrable(debutInstallAutoG, p)) debutInstallAutoG.setDate(debutInstallAutoG.getDate() + 1);
      const debutInstallG = resolveDate(p.manualDates?.installation, region, debutInstallAutoG, p, 'installation');
      const finInstallG = addWorkingDays(debutInstallG.toISOString().slice(0, 10), installJoursG, !!p.samediTravaille, !!p.dimancheTravaille, p);
      installGrappes.push({ grappeKey: gKey, equipes: iResult.equipes, equipesMin: iResult.equipesMin, jours: installJoursG, debut: debutInstallG, fin: finInstallG, cadence: iResult.equipes * installCadence, menages: gMenages });

      /* Réseau BT par grappe */
      const reseauCadence = p.reseauCadenceJour || 20;
      const rResult = distributeTeamsToGrappe(reseauUserR, gMenages, menagesCnt, reseauCadence, daysObj);
      const reseauJoursG = Math.ceil(gMenages / (rResult.equipes * reseauCadence));
      const reseauDebutJ = Math.max(1, Math.ceil(installJoursG * ((p.reseauPipelineDebut || 15) / 100)));
      const debutReseauAutoG = addWorkingDays(debutInstallG.toISOString().slice(0, 10), reseauDebutJ, !!p.samediTravaille, !!p.dimancheTravaille, p);
      while (!isJourOuvrable(debutReseauAutoG, p)) debutReseauAutoG.setDate(debutReseauAutoG.getDate() + 1);
      const debutReseauG = resolveDate(p.manualDates?.reseau, region, debutReseauAutoG, p, 'reseau');
      const finReseauG = addWorkingDays(debutReseauG.toISOString().slice(0, 10), reseauJoursG, !!p.samediTravaille, !!p.dimancheTravaille, p);
      reseauGrappes.push({ grappeKey: gKey, equipes: rResult.equipes, equipesMin: rResult.equipesMin, jours: reseauJoursG, debut: debutReseauG, fin: finReseauG, cadence: rResult.equipes * reseauCadence, menages: gMenages });

      /* Contrôle par grappe */
      const ctrlCadence = p.controleCadenceJour || 15;
      const cResult = distributeTeamsToGrappe(ctrlUserR, gMenages, menagesCnt, ctrlCadence, daysObj);
      const ctrlJoursG = Math.ceil(gMenages / (cResult.equipes * ctrlCadence));
      const controleDebutJ = Math.max(1, Math.ceil(installJoursG * ((p.controleDebutPct || 10) / 100)));
      const debutControlAutoG = addWorkingDays(debutInstallG.toISOString().slice(0, 10), controleDebutJ, !!p.samediTravaille, !!p.dimancheTravaille, p);
      while (!isJourOuvrable(debutControlAutoG, p)) debutControlAutoG.setDate(debutControlAutoG.getDate() + 1);
      const debutControlG = resolveDate(p.manualDates?.controle, region, debutControlAutoG, p, 'controle');
      const finControlG = addWorkingDays(debutControlG.toISOString().slice(0, 10), ctrlJoursG, !!p.samediTravaille, !!p.dimancheTravaille, p);
      controleGrappes.push({ grappeKey: gKey, equipes: cResult.equipes, equipesMin: cResult.equipesMin, jours: ctrlJoursG, debut: debutControlG, fin: finControlG, cadence: cResult.equipes * ctrlCadence, menages: gMenages });
    }

    /* ── Aggregate grappes → region ── */
    const maconEquipes = maconGrappes.reduce((s, g) => s + g.equipes, 0);
    const maconEquipesMin = maconGrappes.reduce((s, g) => s + g.equipesMin, 0);
    const debutMacon = maconGrappes.reduce((mn, g) => g.debut < mn ? g.debut : mn, new Date('2099-01-01'));
    const finMacon = maconGrappes.reduce((mx, g) => g.fin > mx ? g.fin : mx, new Date(0));
    const maconJours = Math.ceil(menagesCnt / (maconEquipes * (p.maconCadenceJour || 2)));

    const transportEquipes = transportGrappes.reduce((s, g) => s + g.equipes, 0);
    const transportEquipesMin = transportGrappes.reduce((s, g) => s + g.equipesMin, 0);
    const debutTransport = transportGrappes.reduce((mn, g) => g.debut < mn ? g.debut : mn, new Date('2099-01-01'));
    const finTransport = transportGrappes.reduce((mx, g) => g.fin > mx ? g.fin : mx, new Date(0));
    const transportJours = Math.ceil(menagesCnt / (transportEquipes * (p.transportCadenceJour || 100)));

    const installEquipes = installGrappes.reduce((s, g) => s + g.equipes, 0);
    const installEquipesMin = installGrappes.reduce((s, g) => s + g.equipesMin, 0);
    const debutInstall = installGrappes.reduce((mn, g) => g.debut < mn ? g.debut : mn, new Date('2099-01-01'));
    const finInstall = installGrappes.reduce((mx, g) => g.fin > mx ? g.fin : mx, new Date(0));
    const installJours = Math.ceil(menagesCnt / (installEquipes * (p.installCadenceJour || 2)));

    const reseauEquipes = reseauGrappes.reduce((s, g) => s + g.equipes, 0);
    const reseauEquipesMin = reseauGrappes.reduce((s, g) => s + g.equipesMin, 0);
    const debutReseau = reseauGrappes.reduce((mn, g) => g.debut < mn ? g.debut : mn, new Date('2099-01-01'));
    const finReseau = reseauGrappes.reduce((mx, g) => g.fin > mx ? g.fin : mx, new Date(0));
    const reseauJours = Math.ceil(menagesCnt / (reseauEquipes * (p.reseauCadenceJour || 20)));

    const nbControleurs = controleGrappes.reduce((s, g) => s + g.equipes, 0);
    const controleursMin = controleGrappes.reduce((s, g) => s + g.equipesMin, 0);
    const debutControl = controleGrappes.reduce((mn, g) => g.debut < mn ? g.debut : mn, new Date('2099-01-01'));
    const finControl = controleGrappes.reduce((mx, g) => g.fin > mx ? g.fin : mx, new Date(0));
    const controlJours = Math.ceil(menagesCnt / (nbControleurs * (p.controleCadenceJour || 15)));

    /* Réception */
    const debutReception = addWorkingDays(finControl.toISOString().slice(0, 10), p.receptionDelaiJours || 3, !!p.samediTravaille, !!p.dimancheTravaille, p);
    while (!isJourOuvrable(debutReception, p)) debutReception.setDate(debutReception.getDate() + 1);
    const finReception = addWorkingDays(debutReception.toISOString().slice(0, 10), 2, !!p.samediTravaille, !!p.dimancheTravaille, p);

    const finRegion = [finInstall, finReseau, finControl, finReception, finTransport].reduce(
      (mx, d) => d > mx ? d : mx, new Date(0),
    );

    if (!isModeParallele) regionCursorSeq = finRegion;

    /* ── Gantt bars ── */
    result.gantt.push({ phase: 'Maçonnerie', region, debut: debutMacon, fin: finMacon, color: '#9C6644', detail: `${maconEquipes} éq. × ${p.maconCadenceJour || 2} murs/j — ${nbGrappeCount} grappes` });
    result.gantt.push({ phase: 'Transport', region, debut: debutTransport, fin: finTransport, color: '#D4A03C', detail: `${transportEquipes} véhic. × ${p.transportCadenceJour || 100} kits/j — ${nbGrappeCount} grappes` });
    result.gantt.push({ phase: 'Installation intérieure', region, debut: debutInstall, fin: finInstall, color: '#2E86AB', detail: `${installEquipes} éq. (min:${installEquipesMin}) × ${p.installEffectifEquipe || 2} élec. — ${installEquipes * (p.installCadenceJour || 2)} mén/j` });
    result.gantt.push({ phase: 'Réseau BT', region, debut: debutReseau, fin: finReseau, color: '#1E3A5F', detail: `${reseauEquipes} éq. (min:${reseauEquipesMin}) — ${reseauEquipes * (p.reseauCadenceJour || 20)} mén/j` });
    result.gantt.push({ phase: 'Contrôle qualité', region, debut: debutControl, fin: finControl, color: '#22863a', detail: `${nbControleurs} contr. (min:${controleursMin}) × ${p.controleCadenceJour || 15} = ${nbControleurs * (p.controleCadenceJour || 15)} mén/j` });
    result.gantt.push({ phase: 'Réception', region, debut: debutReception, fin: finReception, color: '#6D597A', detail: `Réception par grappe — ${p.receptionDelaiJours || 3} j après fin contrôle` });

    /* ── Build PhaseDetails ── */
    const install: PhaseDetail = { equipes: installEquipes, equipesMin: installEquipesMin, equipesDispo: isModeParallele ? elec / (p.installEffectifEquipe || 2) : totalElectriciens / (p.installEffectifEquipe || 2), jours: installJours, debut: debutInstall, fin: finInstall, cadence: installEquipes * (p.installCadenceJour || 2) };
    const reseau: PhaseDetail = { equipes: reseauEquipes, equipesMin: reseauEquipesMin, equipesDispo: REGION_DATA[region]?.chefs || 0, jours: reseauJours, debut: debutReseau, fin: finReseau, cadence: reseauEquipes * (p.reseauCadenceJour || 20) };
    const ctrl: PhaseDetail = { equipes: nbControleurs, equipesMin: controleursMin, jours: controlJours, debut: debutControl, fin: finControl };
    const rec: PhaseDetail = { equipes: 0, debut: debutReception, fin: finReception, jours: 2 };
    const macon: PhaseDetail = { equipes: maconEquipes, equipesMin: maconEquipesMin, jours: maconJours, debut: debutMacon, fin: finMacon };
    const transport: PhaseDetail = { equipes: transportEquipes, equipesMin: transportEquipesMin, jours: transportJours, debut: debutTransport, fin: finTransport, cadence: transportEquipes * (p.transportCadenceJour || 100) };

    result.regions[region] = {
      menages: menagesCnt, elec,
      install, reseau, controle: ctrl, reception: rec, macon, transport,
      finRegion,
      grappes: { macon: maconGrappes, transport: transportGrappes, install: installGrappes, reseau: reseauGrappes, controle: controleGrappes },
    };

    /* ── §19 — Contrôle invariants transport ── */
    for (const tg of transportGrappes) {
      if (tg.fin > debutMacon) {
        result.alertes.push({ region, msg: `§19 — Transport ${tg.grappeKey} termine le ${fmtDate(tg.fin)} mais maçonnerie commence le ${fmtDate(debutMacon)}`, sev: 'high', phase: '§19' });
      }
      if (!tg.satisfait) {
        result.alertes.push({ region, msg: `§19 — Transport ${tg.grappeKey} : ${tg.cadenceLivraison} kits/j < ${tg.cadenceConsommation} ménages/j nécessaires`, sev: 'high', phase: '§19' });
      }
    }

    /* ── Alertes dates manuelles incohérentes ── */
    if (p.phaseStartMode?.maconnerie === 'manual' && debutMacon < debutPrep) {
      result.alertes.push({ region, msg: `Maçonnerie (${fmtDate(debutMacon)}) commence avant Préparation (${fmtDate(debutPrep)})`, sev: 'high', phase: 'maconnerie' });
    }
    if (p.phaseStartMode?.installation === 'manual' && debutInstall < debutMacon) {
      result.alertes.push({ region, msg: `Installation (${fmtDate(debutInstall)}) commence avant Maçonnerie (${fmtDate(debutMacon)})`, sev: 'high', phase: 'installation' });
    }
    if (p.phaseStartMode?.transport === 'manual' && debutTransport < debutMacon) {
      result.alertes.push({ region, msg: `Transport (${fmtDate(debutTransport)}) commence avant Maçonnerie (${fmtDate(debutMacon)})`, sev: 'high', phase: 'transport' });
    }
    if (p.phaseStartMode?.reseau === 'manual' && debutReseau < debutInstall) {
      result.alertes.push({ region, msg: `Réseau (${fmtDate(debutReseau)}) commence avant Installation (${fmtDate(debutInstall)})`, sev: 'high', phase: 'reseau' });
    }
    if (p.phaseStartMode?.controle === 'manual' && debutControl < debutInstall) {
      result.alertes.push({ region, msg: `Contrôle (${fmtDate(debutControl)}) commence avant Installation (${fmtDate(debutInstall)})`, sev: 'high', phase: 'controle' });
    }
    if (debutReception < finControl) {
      result.alertes.push({ region, msg: `Réception (${fmtDate(debutReception)}) avant fin Contrôle (${fmtDate(finControl)})`, sev: 'high', phase: 'reception' });
    }

    /* ── Alertes ressources ── */
    const dureeReelle = workingDaysBetween(debutInstall, finRegion, !!p.samediTravaille, !!p.dimancheTravaille, p);
    if (dureeReelle > daysObj * 1.05)
      result.alertes.push({ region, msg: `Durée travaux (${Math.round(dureeReelle / jpm * 10) / 10} mois) > objectif (${p.dureeObjectifMois || 2} mois)`, sev: dureeReelle > daysObj * 1.2 ? 'high' : 'medium', phase: 'global' });
    if (installEquipes < installEquipesMin)
      result.alertes.push({ region, msg: `Installation : ${installEquipes} éq. < ${installEquipesMin} nécessaires`, sev: 'high', phase: 'installation' });
    if (reseauEquipes < reseauEquipesMin)
      result.alertes.push({ region, msg: `Réseau : ${reseauEquipes} éq. < ${reseauEquipesMin} nécessaires`, sev: 'medium', phase: 'reseau' });
    if (maconEquipes < maconEquipesMin)
      result.alertes.push({ region, msg: `Maçonnerie : ${maconEquipes} éq. < ${maconEquipesMin} nécessaires`, sev: 'medium', phase: 'macon' });
    if (nbControleurs < controleursMin)
      result.alertes.push({ region, msg: `Contrôle : ${nbControleurs} agents < ${controleursMin} nécessaires`, sev: 'medium', phase: 'controle' });
    if (transportEquipes < transportEquipesMin)
      result.alertes.push({ region, msg: `Transport : ${transportEquipes} véhic. < ${transportEquipesMin} nécessaires`, sev: 'medium', phase: 'transport' });

    /* ── Alerte saison des pluies ── */
    if (p.compterSaisonPluie !== false && (p.impactPluie ?? 50) > 0) {
      const rainyPhases: { label: string; debut: Date; fin: Date }[] = [
        { label: 'Maçonnerie', debut: debutMacon, fin: finMacon },
        { label: 'Installation', debut: debutInstall, fin: finInstall },
        { label: 'Réseau BT', debut: debutReseau, fin: finReseau },
        { label: 'Contrôle', debut: debutControl, fin: finControl },
      ];
      for (const ph of rainyPhases) {
        let joursPluie = 0;
        const cur = new Date(ph.debut);
        while (cur <= ph.fin) {
          if (isRainySeason(cur, p)) joursPluie++;
          cur.setDate(cur.getDate() + 1);
        }
        if (joursPluie > 0) {
          const pctImpact = Math.round((p.impactPluie ?? 50) * joursPluie / 100);
          result.alertes.push({
            region,
            msg: `${ph.label} : ${joursPluie} j en saison des pluies — perte estimée ${pctImpact}% productivité`,
            sev: joursPluie > 10 ? 'medium' : 'low',
            phase: ph.label.toLowerCase(),
          });
        }
      }
    }

    /* ── Alertes fériés / événements religieux ── */
    if (p.compterJoursReligieux !== false || p.compterJoursFeries !== false) {
      const startYear = new Date(p.dateDebut || '2026-07-20').getFullYear();
      const endYear = finRegion.getFullYear();
      const holidays: MobileHoliday[] = [];
      for (let y = startYear; y <= endYear; y++) holidays.push(...calculateMobileHolidays(y, p));
      const phaseRanges: { label: string; debut: Date; fin: Date }[] = [
        { label: 'Maçonnerie', debut: debutMacon, fin: finMacon },
        { label: 'Transport', debut: debutTransport, fin: finTransport },
        { label: 'Installation', debut: debutInstall, fin: finInstall },
        { label: 'Réseau BT', debut: debutReseau, fin: finReseau },
        { label: 'Contrôle qualité', debut: debutControl, fin: finControl },
      ];
      for (const ph of phaseRanges) {
        for (const h of holidays) {
          const hTime = h.date.getTime();
          const debutTime = ph.debut.getTime();
          const finTime = ph.fin.getTime();
          if (hTime >= debutTime && hTime <= finTime && h.isNonOuvre) {
            result.alertes.push({
              region,
              msg: `${ph.label} : jour bloqué ${h.name} le ${fmtDate(h.date)} — pas de travail possible`,
              sev: 'high',
              phase: ph.label.toLowerCase(),
            });
          } else if (hTime >= debutTime && hTime <= finTime && h.isPartiel) {
            const reduction = Math.round(h.reductionJours * 100);
            result.alertes.push({
              region,
              msg: `${ph.label} : jour partiel ${h.name} le ${fmtDate(h.date)} — perte ${reduction}% journée`,
              sev: 'medium',
              phase: ph.label.toLowerCase(),
            });
          }
        }
      }
      /* Formation sessions */
      for (const f of formation) {
        if (f.region !== region) continue;
        for (const h of holidays) {
          const hTime = h.date.getTime();
          if (hTime >= f.debut.getTime() && hTime <= f.fin.getTime()) {
            if (h.isNonOuvre) {
              result.alertes.push({
                region,
                msg: `Formation S${f.session} : ${h.name} le ${fmtDate(h.date)} — session reportée`,
                sev: 'high',
                phase: 'formation',
              });
            } else if (h.isPartiel) {
              const reduction = Math.round(h.reductionJours * 100);
              result.alertes.push({
                region,
                msg: `Formation S${f.session} : ${h.name} le ${fmtDate(h.date)} — perte ${reduction}% journée`,
                sev: 'medium',
                phase: 'formation',
              });
            }
          }
        }
      }
    }
  }

  /* ── Synthèse ── */
  const allFins = Object.values(result.regions).map(r => r.finRegion);
  const finGlobal = allFins.reduce((mx, d) => d > mx ? d : mx, new Date(0));
  const debutTravaux = Object.values(result.regions).reduce(
    (mn, r) => r.install.debut < mn ? r.install.debut : mn, new Date('2099-01-01'),
  );
  const totalElecInstall = Object.values(result.regions).reduce((s, r) => s + r.install.equipes * (p.installEffectifEquipe || 2), 0);
  const totalElecReseau = Object.values(result.regions).reduce((s, r) => s + r.reseau.equipes * (p.reseauEffectifEquipe || 2), 0);
  const dureeProjetJours = workingDaysBetween(new Date(p.dateDebut || '2026-07-13'), finGlobal, !!p.samediTravaille, !!p.dimancheTravaille, p);
  const dureeTravaux = workingDaysBetween(debutTravaux, finGlobal, !!p.samediTravaille, !!p.dimancheTravaille, p);

  if (p.dateLimiteProjet) {
    const dlDate = new Date(p.dateLimiteProjet);
    if (finGlobal > dlDate) {
      const retardJ = Math.ceil((finGlobal.getTime() - dlDate.getTime()) / 86400000);
      result.alertes.push({ region: 'GLOBAL', msg: `Date limite dépassée de ${retardJ} j — fin: ${fmtDate(finGlobal)} vs deadline: ${fmtDate(dlDate)}`, sev: 'high', phase: 'deadline' });
    }
  }

  result.synthese = {
    finGlobal, debutTravaux,
    dureeJours: dureeTravaux,
    dureeMois: Math.round(dureeTravaux / jpm * 10) / 10,
    dureeProjetJours,
    dureeProjetMois: Math.round(dureeProjetJours / jpm * 10) / 10,
    totalElecInstall, totalElecReseau, totalElec: totalElecInstall + totalElecReseau,
    elecDisponibles: totalElectriciens,
    surplus: totalElectriciens - totalElecInstall - totalElecReseau,
    bottleneck: (() => {
      let maxFin: Date | null = null;
      let maxPhase = '';
      for (const [r, d] of Object.entries(result.regions)) {
        if (!maxFin || d.install.fin > maxFin) { maxFin = d.install.fin; maxPhase = `Installation ${r}`; }
        if (d.reseau.fin > (maxFin || new Date())) { maxFin = d.reseau.fin; maxPhase = `Réseau ${r}`; }
        if (d.macon.fin > (maxFin || new Date())) { maxFin = d.macon.fin; maxPhase = `Maçonnerie ${r}`; }
        if (d.controle.fin > (maxFin || new Date())) { maxFin = d.controle.fin; maxPhase = `Contrôle ${r}`; }
      }
      return { phase: maxPhase, date: maxFin || new Date() };
    })(),
    totalEquipes: {
      macon: Object.values(result.regions).reduce((s, r) => s + r.macon.equipes, 0),
      install: Object.values(result.regions).reduce((s, r) => s + r.install.equipes, 0),
      reseau: Object.values(result.regions).reduce((s, r) => s + r.reseau.equipes, 0),
      controle: Object.values(result.regions).reduce((s, r) => s + r.controle.equipes, 0),
      transport: Object.values(result.regions).reduce((s, r) => s + r.transport.equipes, 0),
    },
  };

  /* ── Alerte globale fériés ── */
  if (p.compterJoursReligieux !== false) {
    const projStart = new Date(p.dateDebut || '2026-07-20');
    const startYear = projStart.getFullYear();
    const endYear = finGlobal.getFullYear();
    const allHols: { key: string; name: string; autoDate: Date }[] = [];
    for (let y = startYear; y <= endYear; y++) allHols.push(...detectSenegalHolidays(y));
    const activeHols = allHols.filter(h => {
      const hTime = h.autoDate.getTime();
      return hTime >= projStart.getTime() && hTime <= finGlobal.getTime();
    });
    if (activeHols.length > 0) {
      const list = activeHols.map(h => `${h.name} le ${fmtDate(h.autoDate)}`).join(', ');
      result.alertes.push({ region: 'GLOBAL', msg: `Événements religieux pendant le projet : ${list}`, sev: 'low', phase: 'calendrier' });
    }
  }
  if (p.compterJoursFeries !== false) {
    const projStart = new Date(p.dateDebut || '2026-07-20');
    const projEnd = finGlobal;
    const feriesInProject: string[] = [];
    for (const [dk, label] of Object.entries(JOURS_FERIES_SENEGAL)) {
      const [m, d] = dk.split('-').map(Number);
      for (let y = projStart.getFullYear(); y <= projEnd.getFullYear(); y++) {
        const ferie = new Date(y, m - 1, d);
        if (ferie >= projStart && ferie <= projEnd) feriesInProject.push(`${label} le ${fmtDate(ferie)}`);
      }
    }
    if (feriesInProject.length > 0) {
      result.alertes.push({ region: 'GLOBAL', msg: `Jours fériés Sénégal pendant le projet : ${feriesInProject.join(', ')}`, sev: 'low', phase: 'calendrier' });
    }
  }

  return result;
}

export { fmtDate, addDaysStr, workingDaysBetween };

/* ── Holiday auto-detection for Wizard display ── */

export interface HolidayDetected {
  key: string;
  name: string;
  autoDate: Date;
  overrideKey: string;
  avantKey: string;
  apresKey: string;
  impactKey: string;
}

export function detectSenegalHolidays(year: number): HolidayDetected[] {
  const lunarYear = 354.37;
  const refs = [
    { key: 'magal', name: 'Magal de Touba', base: '2024-02-12', overrideKey: 'magalDateOverride', avantKey: 'magalAvantJours', apresKey: 'magalApresJours', impactKey: 'magalImpact' },
    { key: 'gamou', name: 'Gamou (Mawlid)', base: '2024-03-11', overrideKey: 'gamouDateOverride', avantKey: 'gamouAvantJours', apresKey: 'gamouApresJours', impactKey: 'gamouImpact' },
    { key: 'korite', name: 'Korité (Eid al-Fitr)', base: '2024-04-10', overrideKey: 'koriteDateOverride', avantKey: 'koriteAvantJours', apresKey: 'koriteApresJours', impactKey: 'koriteImpact' },
    { key: 'tabaski', name: 'Tabaski (Eid al-Adha)', base: '2024-06-17', overrideKey: 'tabaskiDateOverride', avantKey: 'tabaskiAvantJours', apresKey: 'tabaskiApresJours', impactKey: 'tabaskiImpact' },
  ];
  return refs.map(h => {
    const baseDate = new Date(h.base);
    const offset = Math.floor((year - 2024) * lunarYear);
    const autoDate = new Date(baseDate);
    autoDate.setDate(autoDate.getDate() + offset);
    return { ...h, autoDate };
  });
}
