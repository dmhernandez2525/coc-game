import { describe, it, expect } from 'vitest';
import { createSeededRng, hashStringToSeed, randomInt, randomPick } from '../seeded-rng.ts';

describe('createSeededRng', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createSeededRng(1234);
    const b = createSeededRng(1234);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());

    expect(seqA).not.toEqual(seqB);
  });

  it('always returns values in [0, 1)', () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('hashStringToSeed', () => {
  it('is deterministic for the same string', () => {
    expect(hashStringToSeed('campaign_base_5')).toBe(hashStringToSeed('campaign_base_5'));
  });

  it('differs for different strings', () => {
    expect(hashStringToSeed('a')).not.toBe(hashStringToSeed('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const hash = hashStringToSeed('npc_th7_g2');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('randomInt', () => {
  it('stays within the inclusive bounds', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 500; i++) {
      const value = randomInt(rng, 2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('covers both endpoints over many draws', () => {
    const rng = createSeededRng(11);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 0, 3));

    expect(seen.has(0)).toBe(true);
    expect(seen.has(3)).toBe(true);
  });
});

describe('randomPick', () => {
  it('only returns elements from the array', () => {
    const rng = createSeededRng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(randomPick(rng, items));
    }
  });
});
