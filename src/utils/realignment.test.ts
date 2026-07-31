import { describe, expect, it } from 'vitest';
import { addRealignPair, hasRealignPair, makeRealignPairKey } from './realignment';

describe('realignment pair tracking', () => {
  it('creates deterministic pair keys', () => {
    expect(makeRealignPairKey('A', 'B')).toBe('A::B');
    expect(makeRealignPairKey('L22', 'S7')).toBe('L22::S7');
  });

  it('detects whether a pair is already tracked', () => {
    const pairs = ['A::B', 'X::Y'];
    expect(hasRealignPair(pairs, 'A', 'B')).toBe(true);
    expect(hasRealignPair(pairs, 'B', 'A')).toBe(false);
  });

  it('adds a new pair once and deduplicates repeats', () => {
    const first = addRealignPair([], 'A', 'B');
    expect(first).toEqual(['A::B']);

    const second = addRealignPair(first, 'A', 'B');
    expect(second).toEqual(['A::B']);

    const third = addRealignPair(second, 'C', 'D');
    expect(third).toEqual(['A::B', 'C::D']);
  });
});
