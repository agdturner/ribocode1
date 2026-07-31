/**
 * Utilities for tracking chain-pair realign operations.
 */

export const makeRealignPairKey = (from: string, to: string): string => `${from}::${to}`;

export const hasRealignPair = (pairs: string[], from: string, to: string): boolean => {
  const key = makeRealignPairKey(from, to);
  return pairs.includes(key);
};

export const addRealignPair = (pairs: string[], from: string, to: string): string[] => {
  const key = makeRealignPairKey(from, to);
  return pairs.includes(key) ? pairs : [...pairs, key];
};
