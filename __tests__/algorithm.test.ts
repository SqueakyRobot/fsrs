/**
 * Tests for FSRS v4.5 Core Algorithm Functions
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  calculateRetrievability,
  calculateInterval,
  calculateInitialStability,
  calculateInitialDifficulty,
  updateDifficulty,
  updateStabilityAfterSuccess,
  updateStabilityAfterLapse,
  toDiscreteRating,
  isLapse,
  autoRating,
  fuzzInterval,
} from '../src/algorithm.js';
import { DEFAULT_WEIGHTS, DECAY_FACTOR } from '../src/parameters.js';
import type { Rating } from '../src/models.js';

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  it('returns min when value is below', () => {
    expect(clamp(-5, 1, 10)).toBe(1);
  });

  it('returns max when value is above', () => {
    expect(clamp(15, 1, 10)).toBe(10);
  });

  it('handles boundary values', () => {
    expect(clamp(1, 1, 10)).toBe(1);
    expect(clamp(10, 1, 10)).toBe(10);
  });
});

describe('calculateRetrievability', () => {
  const w = DEFAULT_WEIGHTS;

  it('returns 1 when elapsed_days is 0', () => {
    expect(calculateRetrievability(0, 10, w)).toBe(1);
  });

  it('returns 0 when stability is 0', () => {
    expect(calculateRetrievability(5, 0, w)).toBe(0);
  });

  it('returns approximately 0.9 when t = S', () => {
    const stability = 10;
    const result = calculateRetrievability(stability, stability, w);
    expect(result).toBeCloseTo(0.9, 2);
  });

  it('returns lower values as time increases', () => {
    const stability = 10;
    const r1 = calculateRetrievability(5, stability, w);
    const r2 = calculateRetrievability(10, stability, w);
    const r3 = calculateRetrievability(20, stability, w);

    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
  });

  it('returns higher values with higher stability', () => {
    const days = 10;
    const r1 = calculateRetrievability(days, 5, w);
    const r2 = calculateRetrievability(days, 10, w);
    const r3 = calculateRetrievability(days, 20, w);

    expect(r1).toBeLessThan(r2);
    expect(r2).toBeLessThan(r3);
  });

  it('follows power-law decay (not exponential)', () => {
    // Power-law decay is slower than exponential for large t
    const stability = 10;
    const r = calculateRetrievability(100, stability, w);
    // At t=100, S=10, exponential would give ~0, but power-law gives higher value
    expect(r).toBeGreaterThan(0.1);
  });
});

describe('calculateInterval', () => {
  const w = DEFAULT_WEIGHTS;

  it('returns approximately S when R = 0.9', () => {
    const stability = 10;
    const interval = calculateInterval(stability, 0.9, w);
    expect(interval).toBeCloseTo(stability, 1);
  });

  it('returns shorter interval for higher retention', () => {
    const stability = 10;
    const i1 = calculateInterval(stability, 0.85, w);
    const i2 = calculateInterval(stability, 0.9, w);
    const i3 = calculateInterval(stability, 0.95, w);

    expect(i1).toBeGreaterThan(i2);
    expect(i2).toBeGreaterThan(i3);
  });

  it('returns 0 for zero stability', () => {
    expect(calculateInterval(0, 0.9, w)).toBe(0);
  });

  it('scales linearly with stability', () => {
    const i1 = calculateInterval(10, 0.9, w);
    const i2 = calculateInterval(20, 0.9, w);
    expect(i2 / i1).toBeCloseTo(2, 1);
  });
});

describe('calculateInitialStability', () => {
  const w = DEFAULT_WEIGHTS;

  it('returns w[0] for Again (1)', () => {
    expect(calculateInitialStability(1, w)).toBe(w[0]);
  });

  it('returns w[1] for Hard (2)', () => {
    expect(calculateInitialStability(2, w)).toBe(w[1]);
  });

  it('returns w[2] for Good (3)', () => {
    expect(calculateInitialStability(3, w)).toBe(w[2]);
  });

  it('returns w[3] for Easy (4)', () => {
    expect(calculateInitialStability(4, w)).toBe(w[3]);
  });

  it('increases with better ratings', () => {
    const s1 = calculateInitialStability(1, w);
    const s2 = calculateInitialStability(2, w);
    const s3 = calculateInitialStability(3, w);
    const s4 = calculateInitialStability(4, w);

    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
    expect(s3).toBeLessThan(s4);
  });
});

describe('calculateInitialDifficulty', () => {
  const w = DEFAULT_WEIGHTS;

  it('returns difficulty within [1, 10]', () => {
    for (let rating = 1; rating <= 4; rating++) {
      const d = calculateInitialDifficulty(rating as Rating, w);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    }
  });

  it('decreases with better ratings (until clamped at minimum)', () => {
    const d1 = calculateInitialDifficulty(1, w);
    const d2 = calculateInitialDifficulty(2, w);
    const d3 = calculateInitialDifficulty(3, w);
    const d4 = calculateInitialDifficulty(4, w);

    // Difficulty decreases with better ratings
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d3);
    // d3 and d4 are both clamped to 1.0 with default weights
    expect(d3).toBe(1);
    expect(d4).toBe(1);
  });

  it('produces expected values with default weights', () => {
    // D0(G) = w4 - e^(w5 * (G-1)) + 1
    const d3 = calculateInitialDifficulty(3, w);
    // For Good: D0(3) = 4.93 - e^(0.94 * 2) + 1 = 4.93 - 6.55 + 1 ≈ -0.62 -> clamped to 1
    expect(d3).toBe(1);
  });
});

describe('updateDifficulty', () => {
  const w = DEFAULT_WEIGHTS;

  it('returns difficulty within [1, 10]', () => {
    for (let rating = 1; rating <= 4; rating++) {
      const d = updateDifficulty(5, rating, w);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    }
  });

  it('stays approximately same for Good (3)', () => {
    const d = updateDifficulty(5, 3, w);
    // With mean reversion, it should be close but not exactly 5
    expect(d).toBeCloseTo(5, 0);
  });

  it('increases for Again (1)', () => {
    const d = updateDifficulty(5, 1, w);
    expect(d).toBeGreaterThan(5);
  });

  it('decreases for Easy (4)', () => {
    const d = updateDifficulty(5, 4, w);
    expect(d).toBeLessThan(5);
  });

  it('supports continuous ratings', () => {
    const d1 = updateDifficulty(5, 2.5, w);
    const d2 = updateDifficulty(5, 3, w);
    const d3 = updateDifficulty(5, 3.5, w);

    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d3);
  });
});

describe('updateStabilityAfterSuccess', () => {
  const w = DEFAULT_WEIGHTS;

  it('increases stability for Good rating', () => {
    const sNew = updateStabilityAfterSuccess(10, 5, 0.9, 3, w);
    expect(sNew).toBeGreaterThan(10);
  });

  it('applies hard penalty for Hard rating', () => {
    const sHard = updateStabilityAfterSuccess(10, 5, 0.9, 2, w);
    const sGood = updateStabilityAfterSuccess(10, 5, 0.9, 3, w);
    expect(sHard).toBeLessThan(sGood);
  });

  it('applies easy bonus for Easy rating', () => {
    const sGood = updateStabilityAfterSuccess(10, 5, 0.9, 3, w);
    const sEasy = updateStabilityAfterSuccess(10, 5, 0.9, 4, w);
    expect(sEasy).toBeGreaterThan(sGood);
  });

  it('grows more for lower difficulty', () => {
    const sLowD = updateStabilityAfterSuccess(10, 2, 0.9, 3, w);
    const sHighD = updateStabilityAfterSuccess(10, 8, 0.9, 3, w);
    expect(sLowD).toBeGreaterThan(sHighD);
  });

  it('grows more when reviewed at lower retrievability', () => {
    const sHighR = updateStabilityAfterSuccess(10, 5, 0.95, 3, w);
    const sLowR = updateStabilityAfterSuccess(10, 5, 0.7, 3, w);
    expect(sLowR).toBeGreaterThan(sHighR);
  });
});

describe('updateStabilityAfterLapse', () => {
  const w = DEFAULT_WEIGHTS;

  it('decreases stability', () => {
    const sNew = updateStabilityAfterLapse(10, 5, 0.9, w);
    expect(sNew).toBeLessThan(10);
  });

  it('never increases stability (uses min)', () => {
    const sNew = updateStabilityAfterLapse(1, 5, 0.5, w);
    expect(sNew).toBeLessThanOrEqual(1);
  });

  it('produces positive stability', () => {
    const sNew = updateStabilityAfterLapse(10, 5, 0.5, w);
    expect(sNew).toBeGreaterThan(0);
  });

  it('produces smaller stability for harder items', () => {
    const sLowD = updateStabilityAfterLapse(10, 2, 0.7, w);
    const sHighD = updateStabilityAfterLapse(10, 8, 0.7, w);
    expect(sHighD).toBeLessThan(sLowD);
  });
});

describe('toDiscreteRating', () => {
  it('rounds 1.0-1.49 to 1 (Again)', () => {
    expect(toDiscreteRating(1.0)).toBe(1);
    expect(toDiscreteRating(1.2)).toBe(1);
    expect(toDiscreteRating(1.49)).toBe(1);
  });

  it('rounds 1.5-2.49 to 2 (Hard)', () => {
    expect(toDiscreteRating(1.5)).toBe(2);
    expect(toDiscreteRating(2.0)).toBe(2);
    expect(toDiscreteRating(2.49)).toBe(2);
  });

  it('rounds 2.5-3.49 to 3 (Good)', () => {
    expect(toDiscreteRating(2.5)).toBe(3);
    expect(toDiscreteRating(3.0)).toBe(3);
    expect(toDiscreteRating(3.49)).toBe(3);
  });

  it('rounds 3.5-4.0 to 4 (Easy)', () => {
    expect(toDiscreteRating(3.5)).toBe(4);
    expect(toDiscreteRating(3.8)).toBe(4);
    expect(toDiscreteRating(4.0)).toBe(4);
  });

  it('clamps values outside 1-4 range', () => {
    expect(toDiscreteRating(0.5)).toBe(1);
    expect(toDiscreteRating(4.5)).toBe(4);
  });
});

describe('isLapse', () => {
  it('returns true for Again (1)', () => {
    expect(isLapse(1)).toBe(true);
  });

  it('returns true for continuous ratings < 1.5', () => {
    expect(isLapse(1.0)).toBe(true);
    expect(isLapse(1.2)).toBe(true);
    expect(isLapse(1.49)).toBe(true);
  });

  it('returns false for ratings >= 1.5', () => {
    expect(isLapse(1.5)).toBe(false);
    expect(isLapse(2)).toBe(false);
    expect(isLapse(3)).toBe(false);
    expect(isLapse(4)).toBe(false);
  });
});

describe('autoRating', () => {
  it('returns grade near 4.0 for very fast responses', () => {
    const grade = autoRating(500, 2000, 5.5);
    expect(grade).toBeGreaterThan(3.5);
    expect(grade).toBeLessThanOrEqual(4.0);
  });

  it('returns grade near 3.0 for average responses', () => {
    const grade = autoRating(2000, 2000, 5.5);
    expect(grade).toBeGreaterThan(2.5);
    expect(grade).toBeLessThan(3.5);
  });

  it('returns grade near 1.0 for very slow responses', () => {
    const grade = autoRating(10000, 2000, 5.5);
    expect(grade).toBeGreaterThanOrEqual(1.0);
    expect(grade).toBeLessThan(2.0);
  });

  it('adjusts for difficulty (harder = more lenient)', () => {
    const gradeEasy = autoRating(4000, 2000, 2); // Easy card
    const gradeHard = autoRating(4000, 2000, 9); // Hard card
    // Harder card should get higher grade for same response time
    expect(gradeHard).toBeGreaterThan(gradeEasy);
  });

  it('returns 3.0 for zero average time', () => {
    expect(autoRating(1000, 0, 5.5)).toBe(3.0);
  });

  it('clamps grade to [1.0, 4.0]', () => {
    const grade1 = autoRating(0, 2000, 5.5);
    const grade2 = autoRating(100000, 2000, 5.5);
    expect(grade1).toBeLessThanOrEqual(4.0);
    expect(grade2).toBeGreaterThanOrEqual(1.0);
  });

  // Test vectors from spec
  it('Test Vector 5: Fast Response (500ms / 2000ms avg)', () => {
    const grade = autoRating(500, 2000, 5.5);
    expect(grade).toBeGreaterThan(3.5);
    expect(toDiscreteRating(grade)).toBe(4);
  });

  it('Test Vector 6: Average Response (2000ms / 2000ms avg)', () => {
    const grade = autoRating(2000, 2000, 5.5);
    expect(grade).toBeGreaterThan(2.5);
    expect(grade).toBeLessThan(3.5);
    expect(toDiscreteRating(grade)).toBe(3);
  });

  it('Test Vector 7: Slow Response with Difficult Card (8000ms / 2000ms avg, D=9)', () => {
    const grade = autoRating(8000, 2000, 9.0);
    // Should be more lenient due to difficulty
    expect(grade).toBeGreaterThanOrEqual(1.5);
    expect(grade).toBeLessThan(2.5);
    expect(toDiscreteRating(grade)).toBe(2);
  });
});

describe('fuzzInterval', () => {
  it('does not fuzz intervals <= 4 days', () => {
    expect(fuzzInterval(1)).toBe(1);
    expect(fuzzInterval(4)).toBe(4);
  });

  it('fuzzes intervals > 4 days', () => {
    // Run multiple times to verify randomness
    const results = new Set<number>();
    for (let i = 0; i < 100; i++) {
      results.add(fuzzInterval(10));
    }
    // Should have some variation (not all identical)
    expect(results.size).toBeGreaterThan(1);
  });

  it('stays within fuzz range', () => {
    for (let i = 0; i < 100; i++) {
      const fuzzed = fuzzInterval(10, 0.05);
      expect(fuzzed).toBeGreaterThanOrEqual(9.5);
      expect(fuzzed).toBeLessThanOrEqual(10.5);
    }
  });

  it('respects custom fuzz range', () => {
    for (let i = 0; i < 100; i++) {
      const fuzzed = fuzzInterval(10, 0.1);
      expect(fuzzed).toBeGreaterThanOrEqual(9);
      expect(fuzzed).toBeLessThanOrEqual(11);
    }
  });
});
