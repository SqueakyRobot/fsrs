/**
 * Tests for FSRS v4.5 Parameters
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  DEFAULT_PARAMETERS,
  DECAY_FACTOR,
  DECAY_EXPONENT,
  createParameters,
  isV6Parameters,
  getDecayExponent,
} from '../src/parameters.js';

describe('DEFAULT_WEIGHTS', () => {
  it('has 17 weights for v4.5', () => {
    expect(DEFAULT_WEIGHTS).toHaveLength(17);
  });

  it('has positive initial stability values (w0-w3)', () => {
    expect(DEFAULT_WEIGHTS[0]).toBeGreaterThan(0); // Again
    expect(DEFAULT_WEIGHTS[1]).toBeGreaterThan(0); // Hard
    expect(DEFAULT_WEIGHTS[2]).toBeGreaterThan(0); // Good
    expect(DEFAULT_WEIGHTS[3]).toBeGreaterThan(0); // Easy
  });

  it('has increasing initial stability values', () => {
    expect(DEFAULT_WEIGHTS[0]).toBeLessThan(DEFAULT_WEIGHTS[1]);
    expect(DEFAULT_WEIGHTS[1]).toBeLessThan(DEFAULT_WEIGHTS[2]);
    expect(DEFAULT_WEIGHTS[2]).toBeLessThan(DEFAULT_WEIGHTS[3]);
  });

  it('matches spec values', () => {
    expect(DEFAULT_WEIGHTS[0]).toBe(0.4);  // w0: Initial Stability (Again)
    expect(DEFAULT_WEIGHTS[1]).toBe(0.6);  // w1: Initial Stability (Hard)
    expect(DEFAULT_WEIGHTS[2]).toBe(2.4);  // w2: Initial Stability (Good)
    expect(DEFAULT_WEIGHTS[3]).toBe(5.8);  // w3: Initial Stability (Easy)
    expect(DEFAULT_WEIGHTS[4]).toBe(4.93); // w4: Initial Difficulty Base
    expect(DEFAULT_WEIGHTS[5]).toBe(0.94); // w5: Initial Difficulty Decay
    expect(DEFAULT_WEIGHTS[6]).toBe(0.86); // w6: Difficulty Update Factor
    expect(DEFAULT_WEIGHTS[7]).toBe(0.01); // w7: Difficulty Mean Reversion
    expect(DEFAULT_WEIGHTS[8]).toBe(1.49); // w8: Stability Update Base
    expect(DEFAULT_WEIGHTS[9]).toBe(0.14); // w9: Stability Update Exp (S)
    expect(DEFAULT_WEIGHTS[10]).toBe(0.94); // w10: Stability Update Exp (R)
    expect(DEFAULT_WEIGHTS[11]).toBe(2.18); // w11: Stability Fail Base
    expect(DEFAULT_WEIGHTS[12]).toBe(0.05); // w12: Stability Fail Exp (D)
    expect(DEFAULT_WEIGHTS[13]).toBe(0.34); // w13: Stability Fail Exp (S)
    expect(DEFAULT_WEIGHTS[14]).toBe(1.26); // w14: Stability Fail Exp (R)
    expect(DEFAULT_WEIGHTS[15]).toBe(0.29); // w15: Hard Penalty
    expect(DEFAULT_WEIGHTS[16]).toBe(2.61); // w16: Easy Bonus
  });
});

describe('DECAY_FACTOR', () => {
  it('equals 19/81', () => {
    expect(DECAY_FACTOR).toBeCloseTo(19 / 81, 10);
  });
});

describe('DECAY_EXPONENT', () => {
  it('equals -0.5', () => {
    expect(DECAY_EXPONENT).toBe(-0.5);
  });
});

describe('DEFAULT_PARAMETERS', () => {
  it('has request_retention of 0.9', () => {
    expect(DEFAULT_PARAMETERS.request_retention).toBe(0.9);
  });

  it('has maximum_interval of 36500 (100 years)', () => {
    expect(DEFAULT_PARAMETERS.maximum_interval).toBe(36500);
  });

  it('has enable_fuzz enabled by default', () => {
    expect(DEFAULT_PARAMETERS.enable_fuzz).toBe(true);
  });

  it('has enable_short_term disabled by default', () => {
    expect(DEFAULT_PARAMETERS.enable_short_term).toBe(false);
  });

  it('has correct weight vector', () => {
    expect(DEFAULT_PARAMETERS.w).toEqual([...DEFAULT_WEIGHTS]);
  });
});

describe('createParameters', () => {
  it('returns default parameters when called with no arguments', () => {
    const params = createParameters();
    expect(params.request_retention).toBe(0.9);
    expect(params.maximum_interval).toBe(36500);
    expect(params.enable_fuzz).toBe(true);
    expect(params.w).toEqual([...DEFAULT_WEIGHTS]);
  });

  it('overrides specific values', () => {
    const params = createParameters({
      request_retention: 0.85,
      enable_fuzz: false,
    });
    expect(params.request_retention).toBe(0.85);
    expect(params.enable_fuzz).toBe(false);
    expect(params.maximum_interval).toBe(36500); // unchanged
  });

  it('copies weight array to prevent mutation', () => {
    const customWeights = [...DEFAULT_WEIGHTS];
    const params = createParameters({ w: customWeights });
    customWeights[0] = 999;
    expect(params.w[0]).toBe(DEFAULT_WEIGHTS[0]);
  });

  it('throws for retention < 0.7', () => {
    expect(() => createParameters({ request_retention: 0.5 })).toThrow(
      /request_retention must be between 0.7 and 0.99/
    );
  });

  it('throws for retention > 0.99', () => {
    expect(() => createParameters({ request_retention: 1.0 })).toThrow(
      /request_retention must be between 0.7 and 0.99/
    );
  });

  it('throws for maximum_interval < 1', () => {
    expect(() => createParameters({ maximum_interval: 0 })).toThrow(
      /maximum_interval must be at least 1 day/
    );
  });

  it('throws for invalid weight array length', () => {
    expect(() => createParameters({ w: [1, 2, 3] })).toThrow(
      /Weight vector must have 17 \(v4.5\) or 21 \(v6\) elements/
    );
  });

  it('accepts 17-weight array (v4.5)', () => {
    const weights = new Array(17).fill(1);
    const params = createParameters({ w: weights });
    expect(params.w).toHaveLength(17);
  });

  it('accepts 21-weight array (v6)', () => {
    const weights = new Array(21).fill(1);
    const params = createParameters({ w: weights });
    expect(params.w).toHaveLength(21);
  });

  it('throws for NaN weight values', () => {
    const weights = [...DEFAULT_WEIGHTS];
    weights[5] = NaN;
    expect(() => createParameters({ w: weights })).toThrow(
      /Weight w\[5\] must be a finite number/
    );
  });

  it('throws for Infinity weight values', () => {
    const weights = [...DEFAULT_WEIGHTS];
    weights[10] = Infinity;
    expect(() => createParameters({ w: weights })).toThrow(
      /Weight w\[10\] must be a finite number/
    );
  });
});

describe('isV6Parameters', () => {
  it('returns false for 17-weight parameters', () => {
    const params = createParameters();
    expect(isV6Parameters(params)).toBe(false);
  });

  it('returns true for 21-weight parameters', () => {
    const weights = new Array(21).fill(1);
    const params = createParameters({ w: weights });
    expect(isV6Parameters(params)).toBe(true);
  });
});

describe('getDecayExponent', () => {
  it('returns -0.5 for v4.5 (17 weights)', () => {
    expect(getDecayExponent(DEFAULT_WEIGHTS)).toBe(-0.5);
  });

  it('returns w20 for v6 (21 weights)', () => {
    const v6Weights = [...DEFAULT_WEIGHTS, 0, 0, 0, -0.3];
    expect(getDecayExponent(v6Weights)).toBe(-0.3);
  });

  it('returns -0.5 for short weight arrays', () => {
    expect(getDecayExponent([1, 2, 3])).toBe(-0.5);
  });
});
