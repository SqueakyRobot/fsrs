/**
 * FSRS v4.5 Type Definitions
 *
 * Core types for the Free Spaced Repetition Scheduler algorithm
 * based on the DSR (Difficulty, Stability, Retrievability) model.
 */

/**
 * User feedback ratings (discrete).
 * - 1 (Again): Complete failure to recall
 * - 2 (Hard): Recalled with significant difficulty
 * - 3 (Good): Recalled with moderate effort
 * - 4 (Easy): Recalled effortlessly
 */
export type Rating = 1 | 2 | 3 | 4;

/**
 * Rating label constants for readability.
 */
export const Rating = {
  Again: 1 as Rating,
  Hard: 2 as Rating,
  Good: 3 as Rating,
  Easy: 4 as Rating,
} as const;

/**
 * Continuous rating (1.0-4.0) for auto-rating scenarios.
 * Internally converted to nearest discrete Rating for scheduling.
 */
export type ContinuousRating = number;

/**
 * Card learning states.
 * - 0 (New): Never reviewed
 * - 1 (Learning): Initial acquisition phase
 * - 2 (Review): Graduated to spaced review
 * - 3 (Relearning): Failed during review, relearning
 */
export type State = 0 | 1 | 2 | 3;

/**
 * State label constants for readability.
 */
export const State = {
  New: 0 as State,
  Learning: 1 as State,
  Review: 2 as State,
  Relearning: 3 as State,
} as const;

/**
 * Core memory state for a flashcard.
 * All methods return new Card objects; input is never mutated.
 */
export interface Card {
  /** Next scheduled review timestamp */
  due: Date;

  /** Storage strength: days until retention drops to 90% */
  stability: number;

  /** Inherent complexity (1.0 = easiest, 10.0 = hardest) */
  difficulty: number;

  /** Days elapsed since last review */
  elapsed_days: number;

  /** Assigned interval in days */
  scheduled_days: number;

  /** Total review count */
  reps: number;

  /** Failure count (lapses) */
  lapses: number;

  /** Current learning phase */
  state: State;

  /** Previous review timestamp (null for new cards) */
  last_review: Date | null;
}

/**
 * Review history record for logging and analytics.
 */
export interface ReviewLog {
  /** Rating given during this review */
  rating: Rating;

  /** Card state at time of review */
  state: State;

  /** Scheduled due date at time of review */
  due: Date;

  /** Stability at time of review */
  stability: number;

  /** Difficulty at time of review */
  difficulty: number;

  /** Days elapsed since previous review */
  elapsed_days: number;

  /** Previous elapsed_days value (for delta tracking) */
  last_elapsed_days: number;

  /** Interval that was scheduled */
  scheduled_days: number;

  /** Timestamp when review occurred */
  review: Date;
}

/**
 * Algorithm configuration parameters.
 */
export interface FSRSParameters {
  /**
   * Target retention probability (0.7-0.97).
   * Default: 0.9 (90% chance of recall when reviewed at scheduled time)
   */
  request_retention: number;

  /**
   * Maximum interval in days.
   * Default: 36500 (100 years)
   */
  maximum_interval: number;

  /**
   * Weight vector for FSRS formulas.
   * - 17 weights for v4.5
   * - 21 weights for v6 (optional extension)
   */
  w: number[];

  /**
   * Enable random interval jitter to prevent clustering.
   * Default: true
   */
  enable_fuzz: boolean;

  /**
   * Enable v6 same-day review logic (requires 21 weights).
   * Default: false
   */
  enable_short_term?: boolean;
}

/**
 * Result of scheduling a review with a specific rating.
 */
export interface SchedulingResult {
  /** Review log capturing the transition */
  log: ReviewLog;

  /** Updated card state */
  card: Card;
}

/**
 * Map of all possible scheduling outcomes for a card.
 */
export type SchedulingCards = Record<Rating, SchedulingResult>;
