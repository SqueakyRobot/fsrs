/**
 * FSRS v4.5 Core Algorithm Functions
 *
 * Pure functions implementing the FSRS formulas for spaced repetition.
 * All functions are side-effect free and suitable for edge runtime environments.
 */

import type { Rating, ContinuousRating } from './models.js';
import { DECAY_FACTOR, DECAY_EXPONENT, getDecayExponent } from './parameters.js';

/**
 * Clamps a value between min and max bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates retrievability (probability of recall) using the power-law forgetting curve.
 *
 * Formula (v4.5 - fixed exponent):
 *   R(t, S) = (1 + F * (t/S))^(-0.5)
 *
 * where:
 *   R = Retrievability (probability of recall)
 *   t = Time elapsed since last review (days)
 *   S = Stability (days to 90% retention)
 *   F = 19/81 (scaling factor)
 *
 * @param elapsedDays - Days since last review
 * @param stability - Current stability value
 * @param w - Optional weight vector (for v6 dynamic exponent)
 * @returns Retrievability (0-1)
 */
export function calculateRetrievability(
  elapsedDays: number,
  stability: number,
  w?: readonly number[]
): number {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;

  // For v4.5: exponent = -0.5 (fixed)
  // For v6: exponent = w20 (user-specific, defaults to -0.5)
  const exponent = w ? getDecayExponent(w) : DECAY_EXPONENT;

  return Math.pow(1 + DECAY_FACTOR * (elapsedDays / stability), exponent);
}

/**
 * Calculates the interval to reach a target retrievability.
 *
 * Inverts the forgetting curve formula:
 *   I(S, R_req) = (S/F) * (R_req^(-2) - 1)
 *
 * For R_req = 0.9, this simplifies to approximately I = S.
 *
 * @param stability - Current stability value
 * @param requestRetention - Target retention (default 0.9)
 * @param w - Optional weight vector (for v6 dynamic exponent)
 * @returns Interval in days
 */
export function calculateInterval(
  stability: number,
  requestRetention: number = 0.9,
  w?: readonly number[]
): number {
  if (stability <= 0) return 0;

  // Invert the forgetting curve: R = (1 + F * t/S)^exponent
  // Solve for t: t = S/F * (R^(1/exponent) - 1)
  const exponent = w ? getDecayExponent(w) : DECAY_EXPONENT;
  const power = 1 / exponent;

  return (stability / DECAY_FACTOR) * (Math.pow(requestRetention, power) - 1);
}

/**
 * Calculates initial stability for a new card based on first rating.
 *
 * Formula: S0(G) = w[G-1]
 *
 * @param rating - First review rating (1-4)
 * @param w - Weight vector
 * @returns Initial stability
 */
export function calculateInitialStability(
  rating: Rating,
  w: readonly number[]
): number {
  return w[rating - 1];
}

/**
 * Calculates initial difficulty for a new card based on first rating.
 *
 * Formula: D0(G) = w4 - e^(w5 * (G-1)) + 1
 * Clamped to [1, 10].
 *
 * @param rating - First review rating (1-4)
 * @param w - Weight vector
 * @returns Initial difficulty (1-10)
 */
export function calculateInitialDifficulty(
  rating: Rating,
  w: readonly number[]
): number {
  const difficulty = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return clamp(difficulty, 1, 10);
}

/**
 * Updates difficulty after a review.
 *
 * Formula:
 *   D_next = D_prev - w6 * (G - 3)
 *   D_new = w7 * D0(3) + (1 - w7) * D_next
 *
 * The mean reversion term (w7) pulls difficulty toward the baseline
 * to prevent extreme values over time.
 *
 * @param difficulty - Current difficulty
 * @param rating - Review rating (supports continuous 1.0-4.0)
 * @param w - Weight vector
 * @returns Updated difficulty (1-10)
 */
export function updateDifficulty(
  difficulty: number,
  rating: Rating | ContinuousRating,
  w: readonly number[]
): number {
  if (difficulty == 0) return calculateInitialDifficulty(rating, w);
  
  // D0(3) = baseline difficulty for "Good" rating
  const d0Good = w[4] - Math.exp(w[5] * 2) + 1;
  const clampedD0Good = clamp(d0Good, 1, 10);

  // Direct update based on rating deviation from "Good" (3)
  const dNext = difficulty - w[6] * (rating - 3);

  // Mean reversion toward baseline
  const dNew = w[7] * clampedD0Good + (1 - w[7]) * dNext;

  return clamp(dNew, 1, 10);
}

/**
 * Updates stability after a successful review (rating >= 2).
 *
 * Formula:
 *   GrowthFactor = e^(w8) * (11 - D) * S^(-w9) * (e^(w10*(1-R)) - 1) * h * b
 *   S_new = S_prev * (1 + GrowthFactor)
 *
 * where:
 *   h = w15 if G=2 (Hard penalty), else 1
 *   b = w16 if G=4 (Easy bonus), else 1
 *
 * @param stability - Current stability
 * @param difficulty - Current difficulty
 * @param retrievability - Current retrievability
 * @param rating - Review rating (2, 3, or 4)
 * @param w - Weight vector
 * @returns Updated stability
 */
export function updateStabilityAfterSuccess(
  stability: number,
  difficulty: number,
  retrievability: number,
  rating: Rating,
  w: readonly number[]
): number {
  // Hard penalty: w15 for Hard (2), else 1
  const hardPenalty = rating === 2 ? w[15] : 1;

  // Easy bonus: w16 for Easy (4), else 1
  const easyBonus = rating === 4 ? w[16] : 1;

  // Growth factor calculation
  const growthFactor =
    Math.exp(w[8]) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]) *
    (Math.exp(w[10] * (1 - retrievability)) - 1) *
    hardPenalty *
    easyBonus;

  return stability * (1 + growthFactor);
}

/**
 * Updates stability after a lapse (rating = 1, Again).
 *
 * Formula:
 *   S_new = w11 * D^(-w12) * ((S+1)^w13 - 1) * e^(w14*(1-R))
 *   S_final = min(S_prev, S_new)
 *
 * The min() ensures stability never increases after a lapse.
 *
 * @param stability - Current stability
 * @param difficulty - Current difficulty
 * @param retrievability - Current retrievability
 * @param w - Weight vector
 * @returns Updated stability (always <= previous stability)
 */
export function updateStabilityAfterLapse(
  stability: number,
  difficulty: number,
  retrievability: number,
  w: readonly number[]
): number {
  const sNew =
    w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - retrievability));

  // Stability cannot increase after a lapse
  return Math.min(stability, sNew);
}

/**
 * Converts a continuous rating to the nearest discrete rating.
 *
 * Mapping:
 *   1.0-1.5 -> 1 (Again)
 *   1.5-2.5 -> 2 (Hard)
 *   2.5-3.5 -> 3 (Good)
 *   3.5-4.0 -> 4 (Easy)
 *
 * @param continuous - Continuous rating (1.0-4.0)
 * @returns Discrete rating (1-4)
 */
export function toDiscreteRating(continuous: ContinuousRating): Rating {
  const clamped = clamp(continuous, 1, 4);
  return Math.round(clamped) as Rating;
}

/**
 * Checks if a grade represents a lapse (failure to recall).
 * Useful for analytics, streak tracking, and UI badges.
 *
 * @param grade - Rating (discrete or continuous)
 * @returns true if grade represents a lapse (Again)
 */
export function isLapse(grade: Rating | ContinuousRating): boolean {
  return grade < 1.5;
}

/**
 * Calculates an auto-rating based on response time.
 *
 * Uses a sigmoid-based formula to map performance metrics to a continuous grade:
 *   ratio = responseTime / averageTime
 *   adjusted_ratio = ratio * difficultyFactor
 *   grade = 5.0 - 4.0 * sigmoid(adjusted_ratio)
 *
 * where:
 *   sigmoid(x) = 1 / (1 + e^(-k * (x - 1)))
 *   k = steepness parameter (default: 2.0)
 *   difficultyFactor = 1.0 - (difficulty - 5.5) / 6
 *
 * The difficulty adjustment makes grading more lenient for harder cards:
 *   - D = 10 (hardest): difficultyFactor ≈ 0.25 (most lenient)
 *   - D = 5.5 (average): difficultyFactor = 1.0 (neutral)
 *   - D = 1 (easiest): difficultyFactor ≈ 1.75 (strictest)
 *
 * @param responseTime - Time taken to respond (milliseconds)
 * @param averageTime - Expected average response time (milliseconds)
 * @param difficulty - Optional card difficulty (1-10) for adjustment
 * @param steepness - Sigmoid steepness parameter (default: 2.0)
 * @returns Continuous rating (1.0-4.0)
 */
export function autoRating(
  responseTime: number,
  averageTime: number,
  difficulty: number = 5.5,
  steepness: number = 2.0
): ContinuousRating {
  if (averageTime <= 0) return 3.0; // Default to "Good" if no average

  const ratio = responseTime / averageTime;

  // Difficulty adjustment: harder cards get more lenient grading
  // For difficult cards (D > 5.5), we reduce the effective ratio to be more lenient
  // For easy cards (D < 5.5), we increase the effective ratio to be stricter
  // The adjustment ranges from 0.25 (D=10) to 1.75 (D=1)
  const difficultyFactor = 1.0 - (difficulty - 5.5) / 6;
  const adjustedRatio = ratio * difficultyFactor;

  // Sigmoid maps the ratio to [0, 1], centered at ratio = 1
  const sigmoid = 1 / (1 + Math.exp(-steepness * (adjustedRatio - 1)));

  // Map sigmoid output to grade: fast -> 4.0, average -> 3.0, slow -> 1.0
  // Using 5.0 - 4.0 * sigmoid gives:
  //   ratio << 1 (fast): sigmoid ≈ 0.12 → grade ≈ 4.5 → clamped to 4.0
  //   ratio = 1 (avg):   sigmoid = 0.5  → grade = 3.0
  //   ratio >> 1 (slow): sigmoid ≈ 1   → grade = 1.0
  const grade = 5.0 - 4.0 * sigmoid;

  return clamp(grade, 1.0, 4.0);
}

/**
 * Applies fuzzing to an interval to prevent clustering of reviews.
 * Uses crypto.getRandomValues() for edge runtime compatibility.
 *
 * @param interval - Base interval in days
 * @param fuzzRange - Range of fuzz factor (default: 0.05 = +/- 5%)
 * @returns Fuzzed interval
 */
export function fuzzInterval(interval: number, fuzzRange: number = 0.05): number {
  // Only fuzz intervals > 4 days
  if (interval <= 4) return interval;

  let random: number;

  // Use crypto.getRandomValues() for edge runtime compatibility
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    random = array[0] / (0xffffffff + 1);
  } else {
    // Fallback for environments without crypto
    random = Math.random();
  }

  // Apply fuzz: interval * (1 - fuzzRange + random * 2 * fuzzRange)
  const fuzzFactor = 1 - fuzzRange + random * 2 * fuzzRange;
  return interval * fuzzFactor;
}
