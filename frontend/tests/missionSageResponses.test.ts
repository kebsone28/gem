import { describe, expect, it } from 'vitest';
import { findUniversalQR } from '../src/services/ai/missionSageResponses';

function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

const noFuzzy = () => false;

describe('missionSageResponses findUniversalQR', () => {
  it('returns sober daily responses', () => {
    expect(findUniversalQR('bonjour', normalizeWord, noFuzzy)).toBe(
      'Bonjour. Dites-moi ce dont vous avez besoin.'
    );
    expect(findUniversalQR('tu es humain', normalizeWord, noFuzzy)).toBe(
      'Non, je suis un assistant IA.'
    );
  });

  it('returns null when no universal response matches', () => {
    expect(findUniversalQR('xylophone inconnu', normalizeWord, noFuzzy)).toBeNull();
  });
});
