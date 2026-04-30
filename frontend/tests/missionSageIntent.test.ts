import { describe, expect, it } from 'vitest';
import { detectIntent } from '../src/services/ai/missionSageIntent';

const noFuzzy = () => false;

describe('missionSageIntent detectIntent', () => {
  it('detects core business intents without broad substring matches', () => {
    expect(detectIntent('comment créer une mission', noFuzzy).mission).toBe(true);
    expect(detectIntent('audit financier global budget', noFuzzy).finance).toBe(true);
    expect(detectIntent('synchronisation kobo terrain', noFuzzy).kobo).toBe(true);
    expect(detectIntent('hauteur branchement senelec', noFuzzy).branchement).toBe(true);
  });

  it('does not match short words inside unrelated words', () => {
    const result = detectIntent('automobile ordinaire et commentaire', noFuzzy);
    expect(result.mission).toBe(false);
    expect(result.finance).toBe(false);
  });

  it('keeps work fatigue separate from sleep jokes', () => {
    const result = detectIntent('je suis fatigue', noFuzzy);
    expect(result.dailyTired).toBe(true);
    expect(result.dailySleep).toBe(false);
  });

  it('keeps fuzzy technical fallback injectable and testable', () => {
    const result = detectIntent('disjonctuer', (query, keywords) =>
      keywords.includes('disjoncteur') && query.includes('disjonctuer')
    );
    expect(result.tech).toBe(true);
  });
});
