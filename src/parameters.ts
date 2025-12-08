/**
 * FSRS v4.5 Default Parameters
 *
 * These defaults are derived from FSRS v4.5 benchmark averages trained on
 * large-scale review datasets (1.7B+ reviews). They represent robust starting
 * parameters that work well for generic users without requiring optimization.
 */

import type { FSRSParameters } from './models.js';

/**
 * Default v4.5 weight vector (17 parameters).
 *
 * | Index | Name                     | Description                                    |
 * |-------|--------------------------|------------------------------------------------|
 * | w0    | Initial Stability (Again)| First review stability for "Again"             |
 * | w1    | Initial Stability (Hard) | First review stability for "Hard"              |
 * | w2    | Initial Stability (Good) | First review stability for "Good"              |
 * | w3    | Initial Stability (Easy) | First review stability for "Easy"              |
 * | w4    | Initial Difficulty Base  | Intercept for initial difficulty               |
 * | w5    | Initial Difficulty Decay | Coefficient for initial difficulty             |
 * | w6    | Difficulty Update Factor | Magnitude of difficulty change per rating      |
 * | w7    | Difficulty Mean Reversion| Rate of return to baseline difficulty          |
 * | w8    | Stability Update Base    | Base factor for stability increase             |
 * | w9    | Stability Update Exp (S) | Current stability exponent                     |
 * | w10   | Stability Update Exp (R) | Current retrievability exponent                |
 * | w11   | Stability Fail Base      | Base factor after lapse                        |
 * | w12   | Stability Fail Exp (D)   | Difficulty exponent after lapse                |
 * | w13   | Stability Fail Exp (S)   | Pre-lapse stability exponent                   |
 * | w14   | Stability Fail Exp (R)   | Pre-lapse retrievability exponent              |
 * | w15   | Hard Penalty             | Stability multiplier for "Hard" rating         |
 * | w16   | Easy Bonus               | Stability multiplier for "Easy" rating         |
 */
export const DEFAULT_WEIGHTS: readonly number[] = [
  0.4, // w0: Initial Stability (Again)
  0.6, // w1: Initial Stability (Hard)
  2.4, // w2: Initial Stability (Good)
  5.8, // w3: Initial Stability (Easy)
  4.93, // w4: Initial Difficulty Base
  0.94, // w5: Initial Difficulty Decay
  0.86, // w6: Difficulty Update Factor
  0.01, // w7: Difficulty Mean Reversion
  1.49, // w8: Stability Update Base
  0.14, // w9: Stability Update Exp (S)
  0.94, // w10: Stability Update Exp (R)
  2.18, // w11: Stability Fail Base
  0.05, // w12: Stability Fail Exp (D)
  0.34, // w13: Stability Fail Exp (S)
  1.26, // w14: Stability Fail Exp (R)
  0.29, // w15: Hard Penalty
  2.61, // w16: Easy Bonus
];

/**
 * Scaling factor F = 19/81 for the forgetting curve.
 * Derived from the mathematical definition where R(S, S) = 0.9.
 */
export const DECAY_FACTOR = 19 / 81;

/**
 * Fixed exponent for v4.5 forgetting curve.
 */
export const DECAY_EXPONENT = -0.5;

/**
 * Default FSRS parameters.
 */
export const DEFAULT_PARAMETERS: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500, // 100 years
  w: [...DEFAULT_WEIGHTS],
  enable_fuzz: true,
  enable_short_term: false,
};

/**
 * Validates and normalizes FSRS parameters.
 *
 * @param params - Partial parameters to merge with defaults
 * @returns Complete validated parameters
 * @throws Error if parameters are invalid
 */
export function createParameters(
  params?: Partial<FSRSParameters>
): FSRSParameters {
  const result: FSRSParameters = {
    ...DEFAULT_PARAMETERS,
    ...params,
    w: params?.w ? [...params.w] : [...DEFAULT_WEIGHTS],
  };

  // Validate retention range
  if (result.request_retention < 0.7 || result.request_retention > 0.99) {
    throw new Error(
      `request_retention must be between 0.7 and 0.99, got ${result.request_retention}`
    );
  }

  // Validate maximum interval
  if (result.maximum_interval < 1) {
    throw new Error(
      `maximum_interval must be at least 1 day, got ${result.maximum_interval}`
    );
  }

  // Validate weight vector length
  if (result.w.length !== 17 && result.w.length !== 21) {
    throw new Error(
      `Weight vector must have 17 (v4.5) or 21 (v6) elements, got ${result.w.length}`
    );
  }

  // Validate weight values are finite numbers
  for (let i = 0; i < result.w.length; i++) {
    if (!Number.isFinite(result.w[i])) {
      throw new Error(`Weight w[${i}] must be a finite number, got ${result.w[i]}`);
    }
  }

  return result;
}

/**
 * Checks if parameters use v6 extensions.
 *
 * @param params - Parameters to check
 * @returns true if using v6 (21 weights)
 */
export function isV6Parameters(params: FSRSParameters): boolean {
  return params.w.length === 21;
}

/**
 * Gets the decay exponent, using w20 for v6 or default for v4.5.
 *
 * @param w - Weight vector
 * @returns Decay exponent for forgetting curve
 */
export function getDecayExponent(w: readonly number[]): number {
  if (w.length === 21 && w[20] !== undefined) {
    return w[20];
  }
  return DECAY_EXPONENT;
}
