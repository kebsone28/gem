/**
 * planningCriticalPath.ts
 * Moteur pur (zéro React) — Directed Acyclic Graph (DAG) pour le calcul du chemin critique.
 * Résolution topologique des dépendances de phases, détection de cycles.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanningPhaseNode {
  id: string;
  label: string;
  /** Durée estimée en jours calendaires */
  durationDays: number;
  /** IDs des phases qui doivent être terminées avant de démarrer */
  dependsOn: string[];
  /** Facteur de chevauchement autorisé (0 = strict, 0.5 = 50% de chevauchement) */
  overlapFactor?: number;
  isCritical?: boolean;
}

export interface ResolvedPhase extends PlanningPhaseNode {
  startDay: number;
  endDay: number;
  /** Marge flottante : 0 = chemin critique */
  float: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  resolved: ResolvedPhase[];
  criticalPath: string[];
  totalDurationDays: number;
  hasCycle: boolean;
  cycleNodes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Topological sort (Kahn's algorithm)
// ─────────────────────────────────────────────────────────────────────────────

function topologicalSort(nodes: PlanningPhaseNode[]): {
  order: string[];
  hasCycle: boolean;
  cycleNodes: string[];
} {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0);
    if (!adj.has(node.id)) adj.set(node.id, []);
    for (const dep of node.dependsOn) {
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep)!.push(node.id);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const neighbour of adj.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDegree);
      if (newDegree === 0) queue.push(neighbour);
    }
  }

  const cycleNodes =
    order.length < nodes.length
      ? nodes.filter((n) => !order.includes(n.id)).map((n) => n.id)
      : [];

  return { order, hasCycle: cycleNodes.length > 0, cycleNodes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Forward pass (Earliest Start / End)
// ─────────────────────────────────────────────────────────────────────────────

function forwardPass(
  nodes: PlanningPhaseNode[],
  order: string[]
): Map<string, { es: number; ef: number }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const timing = new Map<string, { es: number; ef: number }>();

  for (const id of order) {
    const node = nodeMap.get(id)!;
    const es =
      node.dependsOn.length === 0
        ? 0
        : Math.max(
            ...node.dependsOn.map((dep) => {
              const depTiming = timing.get(dep);
              const depNode = nodeMap.get(dep);
              const overlap = node.overlapFactor ?? 0;
              const depDuration = depNode?.durationDays ?? 0;
              // earliest start = earliest end of dep minus allowed overlap
              return (depTiming?.ef ?? 0) - Math.round(depDuration * overlap);
            })
          );
    timing.set(id, { es: Math.max(0, es), ef: Math.max(0, es) + node.durationDays });
  }

  return timing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward pass (Latest Start / End) → float calculation
// ─────────────────────────────────────────────────────────────────────────────

function backwardPass(
  nodes: PlanningPhaseNode[],
  order: string[],
  forward: Map<string, { es: number; ef: number }>,
  projectEnd: number
): Map<string, { ls: number; lf: number }> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const timing = new Map<string, { ls: number; lf: number }>();
  const successors = new Map<string, string[]>();

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!successors.has(dep)) successors.set(dep, []);
      successors.get(dep)!.push(node.id);
    }
  }

  for (const id of [...order].reverse()) {
    const node = nodeMap.get(id)!;
    const succs = successors.get(id) ?? [];
    const lf =
      succs.length === 0
        ? projectEnd
        : Math.min(...succs.map((s) => timing.get(s)?.ls ?? projectEnd));
    timing.set(id, { ls: lf - node.durationDays, lf });
  }

  return timing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le chemin critique d'un ensemble de phases.
 * @param phases - Nœuds du DAG de planning
 * @returns Résultat complet avec timing résolu et chemin critique
 */
export function computeCriticalPath(phases: PlanningPhaseNode[]): CriticalPathResult {
  if (phases.length === 0) {
    return { resolved: [], criticalPath: [], totalDurationDays: 0, hasCycle: false, cycleNodes: [] };
  }

  const { order, hasCycle, cycleNodes } = topologicalSort(phases);

  if (hasCycle) {
    return {
      resolved: phases.map((p) => ({ ...p, startDay: 0, endDay: 0, float: 0, isCritical: false })),
      criticalPath: [],
      totalDurationDays: 0,
      hasCycle: true,
      cycleNodes,
    };
  }

  const forward = forwardPass(phases, order);
  const projectEnd = Math.max(...[...forward.values()].map((t) => t.ef));
  const backward = backwardPass(phases, order, forward, projectEnd);

  const resolved: ResolvedPhase[] = phases.map((phase) => {
    const fwd = forward.get(phase.id) ?? { es: 0, ef: 0 };
    const bwd = backward.get(phase.id) ?? { ls: 0, lf: 0 };
    const float = Math.max(0, bwd.ls - fwd.es);
    return {
      ...phase,
      startDay: fwd.es,
      endDay: fwd.ef,
      float,
      isCritical: float === 0,
    };
  });

  const criticalPath = resolved.filter((r) => r.isCritical).map((r) => r.id);

  return { resolved, criticalPath, totalDurationDays: projectEnd, hasCycle: false, cycleNodes: [] };
}
