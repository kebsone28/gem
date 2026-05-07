import type { ProjectConfig, Team } from '../utils/types';

export type PlanningPhase =
  | 'PREPARATION'
  | 'LIVRAISON'
  | 'MACONNERIE'
  | 'RESEAU'
  | 'INTERIEUR'
  | 'CONTROLE'
  | 'TERMINE';

export type PlanningAllocationSource = 'manual' | 'configured' | 'balanced' | 'unassigned';

export const PHASE_TRADE_KEYS: Partial<Record<PlanningPhase, string>> = {
  LIVRAISON: 'logistique',
  MACONNERIE: 'macons',
  RESEAU: 'reseau',
  INTERIEUR: 'interieur_type1',
  CONTROLE: 'controle',
};

export const normalizePlanningText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const isTeamAvailableForAllocation = (team: Team) =>
  team.status === 'active' || normalizePlanningText(String(team.status)) === 'disponible';

const isTradeMatch = (value: string | undefined, ...candidates: string[]) => {
  const normalizedValue = normalizePlanningText(value);
  return candidates.some((candidate) => normalizedValue === normalizePlanningText(candidate));
};

export const isLogisticsPlanningTeam = (team: Team) =>
  team.role === 'LOGISTICS' || isTradeMatch(team.tradeKey, 'logistique', 'logistics', 'livraison');

export const isPreparationPlanningTeam = (team: Team) =>
  team.role === 'PREPARATION' || isTradeMatch(team.tradeKey, 'preparation', 'preparateur', 'kits');

export const teamMatchesPlanningRegion = (team: Team, regionName?: string | null) => {
  const normalizedRegion = normalizePlanningText(regionName);
  if (!normalizedRegion) return true;

  const teamRegionName = normalizePlanningText(team.region?.name);
  const teamRegionId = normalizePlanningText(team.regionId);

  return (
    (!!teamRegionName && teamRegionName === normalizedRegion) ||
    (!!teamRegionId && teamRegionId === normalizedRegion)
  );
};

export const getRegionPreferredTeamOrder = (
  projectConfig: ProjectConfig | undefined,
  regionName?: string | null
) => {
  const regionConfigs = (projectConfig as ProjectConfig & {
    regionsConfig?: Record<string, { teamAllocations?: Array<{ subTeamId?: string; priority?: number }> }>;
  })?.regionsConfig;

  const allocations = regionConfigs?.[regionName || '']?.teamAllocations || [];
  return new Map<string, number>(
    allocations
      .filter((alloc) => alloc?.subTeamId)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))
      .map((alloc, index) => [alloc.subTeamId as string, index])
  );
};

export const sortTeamsByCanonicalPriority = (
  candidates: Team[],
  loadByTeamId: Map<string, number>,
  preferredOrder: Map<string, number>
) =>
  [...candidates].sort((a, b) => {
    const rankA = preferredOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rankB = preferredOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;

    const capacityA = Math.max(a.capacity || 1, 1);
    const capacityB = Math.max(b.capacity || 1, 1);
    const ratioA = (loadByTeamId.get(a.id) || 0) / capacityA;
    const ratioB = (loadByTeamId.get(b.id) || 0) / capacityB;
    if (ratioA !== ratioB) return ratioA - ratioB;

    const loadA = loadByTeamId.get(a.id) || 0;
    const loadB = loadByTeamId.get(b.id) || 0;
    if (loadA !== loadB) return loadA - loadB;

    return a.name.localeCompare(b.name, 'fr');
  });

export const recommendTeamForPlanningTask = ({
  phase,
  regionName,
  teams,
  projectConfig,
  manualTeamId,
  currentLoadByTeamId,
}: {
  phase: PlanningPhase;
  regionName?: string | null;
  teams: Team[];
  projectConfig?: ProjectConfig;
  manualTeamId?: string | null;
  currentLoadByTeamId: Map<string, number>;
}): { team?: Team; source: PlanningAllocationSource } => {
  const activeTeams = teams.filter(isTeamAvailableForAllocation);
  const teamsById = new Map(activeTeams.map((team) => [team.id, team]));

  if (manualTeamId) {
    const manualTeam = teamsById.get(manualTeamId);
    return {
      team: manualTeam,
      source: manualTeam ? 'manual' : 'unassigned',
    };
  }

  if (phase === 'TERMINE') {
    return { source: 'unassigned' };
  }

  const eligibleTeams = activeTeams.filter((team) => {
    if (phase === 'PREPARATION') {
      return isPreparationPlanningTeam(team);
    }

    if (phase === 'LIVRAISON') {
      return isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team);
    }

    const requiredTradeKey = PHASE_TRADE_KEYS[phase];
    return !!requiredTradeKey && team.tradeKey === requiredTradeKey;
  });

  const regionMatchedTeams = eligibleTeams.filter((team) =>
    teamMatchesPlanningRegion(team, regionName)
  );
  const candidatePool = regionMatchedTeams.length > 0 ? regionMatchedTeams : eligibleTeams;

  if (candidatePool.length === 0) {
    return { source: 'unassigned' };
  }

  const preferredOrder = getRegionPreferredTeamOrder(projectConfig, regionName);
  const configuredCandidates = candidatePool.filter((team) => preferredOrder.has(team.id));
  const rankedCandidates = sortTeamsByCanonicalPriority(
    configuredCandidates.length > 0 ? configuredCandidates : candidatePool,
    currentLoadByTeamId,
    preferredOrder
  );

  return {
    team: rankedCandidates[0],
    source: configuredCandidates.length > 0 ? 'configured' : 'balanced',
  };
};

export const recommendTeamsForGrappe = ({
  teams,
  regionName,
  projectConfig,
  requirements,
}: {
  teams: Team[];
  regionName?: string | null;
  projectConfig?: ProjectConfig;
  requirements: Array<{
    key: string;
    matchTeam: (team: Team) => boolean;
  }>;
}) => {
  const activeTeams = teams.filter(isTeamAvailableForAllocation);
  const loadByTeamId = new Map<string, number>();
  const preferredOrder = getRegionPreferredTeamOrder(projectConfig, regionName);
  const recommendations: Record<string, { team?: Team; source: PlanningAllocationSource }> = {};

  for (const requirement of requirements) {
    const eligibleTeams = activeTeams.filter(requirement.matchTeam);
    const regionMatchedTeams = eligibleTeams.filter((team) =>
      teamMatchesPlanningRegion(team, regionName)
    );
    const candidatePool = regionMatchedTeams.length > 0 ? regionMatchedTeams : eligibleTeams;

    if (candidatePool.length === 0) {
      recommendations[requirement.key] = { source: 'unassigned' };
      continue;
    }

    const configuredCandidates = candidatePool.filter((team) => preferredOrder.has(team.id));
    const rankedCandidates = sortTeamsByCanonicalPriority(
      configuredCandidates.length > 0 ? configuredCandidates : candidatePool,
      loadByTeamId,
      preferredOrder
    );
    const selectedTeam = rankedCandidates[0];

    recommendations[requirement.key] = {
      team: selectedTeam,
      source: configuredCandidates.length > 0 ? 'configured' : 'balanced',
    };
    loadByTeamId.set(selectedTeam.id, (loadByTeamId.get(selectedTeam.id) || 0) + 1);
  }

  return recommendations;
};
