/**
 * @squeakyrobot/fsrs - FSRS v4.5 Spaced Repetition Scheduler
 *
 * A pure TypeScript implementation of the Free Spaced Repetition Scheduler (FSRS) v4.5
 * algorithm with optional v6 support. Designed for edge runtime environments with zero
 * dependencies.
 *
 * @example Basic usage
 * ```typescript
 * import { FSRS, Rating } from '@squeakyrobot/fsrs';
 *
 * const fsrs = new FSRS();
 * let card = fsrs.createEmptyCard();
 *
 * // User reviews and rates the card as "Good"
 * const result = fsrs.scheduleWithGrade(card, Rating.Good);
 * card = result.card;
 *
 * console.log(`Next review in ${card.scheduled_days} days`);
 * ```
 *
 * @example Auto-rating with response time
 * ```typescript
 * const grade = fsrs.autoRating(1500, 2000); // 1.5s response, 2s average
 * const result = fsrs.scheduleWithGrade(card, grade);
 * ```
 *
 * @packageDocumentation
 */

// Main scheduler class
export { FSRS, isLapse } from './scheduler.js';

// Types and constants from models
// Note: Rating and State are both types and const objects (declaration merging)
export {
  Rating,
  State,
} from './models.js';

export type {
  ContinuousRating,
  Card,
  ReviewLog,
  FSRSParameters,
  SchedulingResult,
  SchedulingCards,
} from './models.js';

// Re-export types for Rating and State explicitly
export type { Rating as RatingType, State as StateType } from './models.js';

// Parameter utilities
export {
  DEFAULT_WEIGHTS,
  DEFAULT_PARAMETERS,
  DECAY_FACTOR,
  DECAY_EXPONENT,
  createParameters,
  isV6Parameters,
  getDecayExponent,
} from './parameters.js';

// Algorithm utilities (for advanced users)
export {
  calculateRetrievability,
  calculateInterval,
  calculateInitialStability,
  calculateInitialDifficulty,
  updateDifficulty,
  updateStabilityAfterSuccess,
  updateStabilityAfterLapse,
  toDiscreteRating,
  autoRating,
  fuzzInterval,
  clamp,
} from './algorithm.js';
