export interface GeneratedMissionSageOverride {
  question: string;
  domain: string;
  message: string;
  smartReplies?: string[];
  verdict?: 'Conforme' | 'Conforme sous réserve' | 'Non conforme' | 'A verifier';
  severity?: 'critique' | 'majeure' | 'mineure' | 'information';
  recommendedAction?: string;
  referenceScore: number;
  aiScore: number;
}

export const GENERATED_MISSION_SAGE_OVERRIDES: Record<string, GeneratedMissionSageOverride> = {};

export function findGeneratedMissionSageOverride(
  normalizedQuery: string
): GeneratedMissionSageOverride | null {
  return GENERATED_MISSION_SAGE_OVERRIDES[normalizedQuery] || null;
}
