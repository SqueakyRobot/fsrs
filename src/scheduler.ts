/**
 * FSRS v4.5 Scheduler
 *
 * Main class for spaced repetition scheduling using the FSRS algorithm.
 * Implements immutable API - all methods return new objects without mutation.
 */

import type {
  Card,
  Rating,
  ContinuousRating,
  State,
  FSRSParameters,
  ReviewLog,
  SchedulingResult,
  SchedulingCards,
} from './models.js';
import { Rating as R, State as S } from './models.js';
import {
  createParameters,
  DEFAULT_PARAMETERS,
  isV6Parameters,
} from './parameters.js';
import {
  calculateRetrievability,
  calculateInterval,
  calculateInitialStability,
  calculateInitialDifficulty,
  updateDifficulty,
  updateStabilityAfterSuccess,
  updateStabilityAfterLapse,
  toDiscreteRating,
  autoRating as autoRatingFn,
  fuzzInterval,
  clamp,
} from './algorithm.js';

/**
 * FSRS Scheduler - Implements the Free Spaced Repetition Scheduler algorithm.
 *
 * This class provides methods for scheduling spaced repetition reviews
 * based on the DSR (Difficulty, Stability, Retrievability) model.
 *
 * All methods are pure and return new objects - input is never mutated.
 */
export class FSRS {
  private readonly params: FSRSParameters;

  /**
   * Creates a new FSRS scheduler instance.
   *
   * @param params - Optional partial parameters to override defaults
   * @throws Error if parameters are invalid
   */
  constructor(params?: Partial<FSRSParameters>) {
    this.params = createParameters(params);
  }

  /**
   * Gets the current parameters (read-only copy).
   */
  get parameters(): FSRSParameters {
    return { ...this.params, w: [...this.params.w] };
  }

  /**
   * Creates a new empty card ready for first review.
   *
   * @param now - Optional timestamp (default: current time)
   * @returns New card in "New" state
   */
  createEmptyCard(now: Date = new Date()): Card {
    return {
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: S.New,
      last_review: null,
    };
  }

  /**
   * Calculates scheduling outcomes for all possible ratings.
   * Useful for showing users all 4 button options with predicted intervals.
   *
   * @param card - Current card state
   * @param now - Current timestamp
   * @returns Map of Rating -> { log, card } for all 4 ratings
   */
  repeat(card: Card, now: Date = new Date()): SchedulingCards {
    const ratings: Rating[] = [R.Again, R.Hard, R.Good, R.Easy];
    const result: Partial<SchedulingCards> = {};

    for (const rating of ratings) {
      result[rating] = this.scheduleWithGrade(card, rating, now);
    }

    return result as SchedulingCards;
  }

  /**
   * Schedules a review with a specific grade.
   * Primary method for auto-rating scenarios and manual reviews.
   *
   * @param card - Current card state
   * @param grade - Rating (discrete 1-4) or continuous (1.0-4.0)
   * @param now - Current timestamp (default: current time)
   * @returns Updated card and review log
   */
  scheduleWithGrade(
    card: Card,
    grade: Rating | ContinuousRating,
    now: Date = new Date()
  ): SchedulingResult {
    // Convert continuous grade to discrete if needed
    const rating = toDiscreteRating(grade);

    // Calculate elapsed days since last review
    const elapsedDays = card.last_review
      ? (now.getTime() - card.last_review.getTime()) / (24 * 60 * 60 * 1000)
      : 0;

    // Handle based on current state
    if (card.state === S.New) {
      return this.scheduleNewCard(card, rating, now);
    }

    return this.scheduleReviewCard(card, rating, elapsedDays, now);
  }

  /**
   * Auto-rating utility: converts response time to a continuous grade.
   *
   * @param responseTime - Time taken to respond (milliseconds)
   * @param averageTime - Expected average response time (milliseconds)
   * @param difficulty - Optional card difficulty (1-10) for adjustment
   * @returns Continuous rating (1.0-4.0)
   */
  autoRating(
    responseTime: number,
    averageTime: number,
    difficulty: number = 5.5
  ): ContinuousRating {
    return autoRatingFn(responseTime, averageTime, difficulty);
  }

  /**
   * Calculates current retrievability (probability of recall).
   *
   * @param card - Card to evaluate
   * @param now - Current timestamp
   * @returns Retrievability (0-1)
   */
  getRetrievability(card: Card, now: Date = new Date()): number {
    if (card.state === S.New || card.stability <= 0) {
      return 0;
    }

    const elapsedDays = card.last_review
      ? (now.getTime() - card.last_review.getTime()) / (24 * 60 * 60 * 1000)
      : 0;

    return calculateRetrievability(elapsedDays, card.stability, this.params.w);
  }

  /**
   * Gets the next interval for a given rating (preview mode).
   *
   * @param card - Card to evaluate
   * @param rating - Rating to preview
   * @param now - Current timestamp
   * @returns Interval in days
   */
  getNextInterval(card: Card, rating: Rating, now: Date = new Date()): number {
    const result = this.scheduleWithGrade(card, rating, now);
    return result.card.scheduled_days;
  }

  /**
   * Schedules a new card's first review.
   */
  private scheduleNewCard(
    card: Card,
    rating: Rating,
    now: Date
  ): SchedulingResult {
    const w = this.params.w;

    // Calculate initial stability and difficulty
    const stability = calculateInitialStability(rating, w);
    const difficulty = calculateInitialDifficulty(rating, w);

    // Calculate interval
    let interval = calculateInterval(
      stability,
      this.params.request_retention,
      w
    );

    // Apply fuzz if enabled
    if (this.params.enable_fuzz) {
      interval = fuzzInterval(interval);
    }

    // Cap interval
    interval = Math.min(Math.round(interval), this.params.maximum_interval);
    interval = Math.max(interval, 1);

    // Calculate due date
    const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    // Determine new state
    const newState: State = rating === R.Again ? S.Learning : S.Review;

    // Build updated card
    const newCard: Card = {
      due,
      stability,
      difficulty,
      elapsed_days: 0,
      scheduled_days: interval,
      reps: 1,
      lapses: rating === R.Again ? 1 : 0,
      state: newState,
      last_review: now,
    };

    // Build review log
    const log: ReviewLog = {
      rating,
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: 0,
      last_elapsed_days: card.elapsed_days,
      scheduled_days: interval,
      review: now,
    };

    return { card: newCard, log };
  }

  /**
   * Schedules a review for an existing card (Learning, Review, or Relearning).
   */
  private scheduleReviewCard(
    card: Card,
    rating: Rating,
    elapsedDays: number,
    now: Date
  ): SchedulingResult {
    const w = this.params.w;

    // Calculate current retrievability
    const retrievability = calculateRetrievability(
      elapsedDays,
      card.stability,
      w
    );

    // Update difficulty (applies to all ratings)
    const newDifficulty = updateDifficulty(card.difficulty, rating, w);

    // Update stability based on rating
    let newStability: number;
    let newLapses = card.lapses;
    let newState: State;

    if (rating === R.Again) {
      // Lapse: failed recall
      newStability = updateStabilityAfterLapse(
        card.stability,
        newDifficulty,
        retrievability,
        w
      );
      newLapses = card.lapses + 1;
      newState = S.Relearning;
    } else {
      // Success: Hard, Good, or Easy
      newStability = updateStabilityAfterSuccess(
        card.stability,
        newDifficulty,
        retrievability,
        rating,
        w
      );
      newState = S.Review;
    }

    // Calculate interval
    let interval = calculateInterval(
      newStability,
      this.params.request_retention,
      w
    );

    // Apply fuzz if enabled
    if (this.params.enable_fuzz) {
      interval = fuzzInterval(interval);
    }

    // Cap and round interval
    interval = Math.min(Math.round(interval), this.params.maximum_interval);
    interval = Math.max(interval, 1);

    // Calculate due date
    const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    // Build updated card
    const newCard: Card = {
      due,
      stability: newStability,
      difficulty: newDifficulty,
      elapsed_days: elapsedDays,
      scheduled_days: interval,
      reps: card.reps + 1,
      lapses: newLapses,
      state: newState,
      last_review: now,
    };

    // Build review log
    const log: ReviewLog = {
      rating,
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: elapsedDays,
      last_elapsed_days: card.elapsed_days,
      scheduled_days: interval,
      review: now,
    };

    return { card: newCard, log };
  }
}

// Re-export utility function
export { isLapse } from './algorithm.js';
