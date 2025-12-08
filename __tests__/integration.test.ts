/**
 * Integration Tests for FSRS v4.5
 *
 * These tests validate the complete algorithm against expected test vectors
 * from the FSRS specification.
 */

import { describe, it, expect } from 'vitest';
import { FSRS, isLapse } from '../src/scheduler.js';
import { Rating, State, type Card } from '../src/models.js';
import {
  calculateRetrievability,
  calculateInitialStability,
  calculateInitialDifficulty,
  updateStabilityAfterSuccess,
} from '../src/algorithm.js';
import { DEFAULT_WEIGHTS } from '../src/parameters.js';

describe('Test Vector 1: First Good Review', () => {
  const fsrs = new FSRS({ enable_fuzz: false });
  const w = DEFAULT_WEIGHTS;

  it('produces expected stability S = 2.4 (w2)', () => {
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');
    const result = fsrs.scheduleWithGrade(card, Rating.Good, now);

    expect(result.card.stability).toBe(w[2]); // 2.4
  });

  it('produces expected difficulty D = 1.0 (clamped)', () => {
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');
    const result = fsrs.scheduleWithGrade(card, Rating.Good, now);

    // D0(3) = w4 - e^(w5 * 2) + 1 = 4.93 - e^1.88 + 1 ≈ -0.62 -> clamped to 1.0
    expect(result.card.difficulty).toBe(1.0);
  });

  it('produces expected interval I ≈ 2-3 days', () => {
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');
    const result = fsrs.scheduleWithGrade(card, Rating.Good, now);

    // With S=2.4 and R=0.9, I ≈ S ≈ 2.4, rounded to 2
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(2);
    expect(result.card.scheduled_days).toBeLessThanOrEqual(3);
  });
});

describe('Test Vector 2: Stability Growth', () => {
  const fsrs = new FSRS({ enable_fuzz: false });
  const w = DEFAULT_WEIGHTS;

  it('S_prev = 2.4, D_prev = 1.0, review at optimal time -> S_new ≈ 11.6', () => {
    // Start with card after first Good review
    let card = fsrs.createEmptyCard();
    const firstReview = new Date('2024-01-01T10:00:00Z');
    let result = fsrs.scheduleWithGrade(card, Rating.Good, firstReview);
    card = result.card;

    // Verify starting state
    expect(card.stability).toBe(2.4);
    expect(card.difficulty).toBe(1.0);

    // Review at approximately optimal time (when R ≈ 0.9)
    // With S=2.4, optimal interval is about 2.4 days
    const secondReview = new Date(
      firstReview.getTime() + 2.4 * 24 * 60 * 60 * 1000
    );
    result = fsrs.scheduleWithGrade(card, Rating.Good, secondReview);

    // Calculate expected stability growth
    // GrowthFactor = e^1.49 * 10 * 2.4^(-0.14) * (e^(0.94*0.1) - 1)
    //              ≈ 4.437 * 10 * 0.884 * 0.098
    //              ≈ 3.84
    // S_new = 2.4 * (1 + 3.84) = 11.6

    expect(result.card.stability).toBeGreaterThan(10);
    expect(result.card.stability).toBeLessThan(15);
  });

  it('difficulty stays at 1.0 for Good rating', () => {
    let card = fsrs.createEmptyCard();
    const firstReview = new Date('2024-01-01T10:00:00Z');
    let result = fsrs.scheduleWithGrade(card, Rating.Good, firstReview);
    card = result.card;

    const secondReview = card.due;
    result = fsrs.scheduleWithGrade(card, Rating.Good, secondReview);

    // With mean reversion, difficulty should stay close to minimum
    expect(result.card.difficulty).toBe(1.0);
  });
});

describe('Test Vector 3: Lapse Recovery', () => {
  const fsrs = new FSRS({ enable_fuzz: false });

  it('stability decreases after lapse', () => {
    // Build up some stability
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // First review: Good
    let result = fsrs.scheduleWithGrade(card, Rating.Good, now);
    card = result.card;
    now = card.due;

    // Second review: Good (stability grows)
    result = fsrs.scheduleWithGrade(card, Rating.Good, now);
    card = result.card;
    const stabilityBefore = card.stability;
    expect(stabilityBefore).toBeGreaterThan(10);

    // Third review: Again (lapse after 30 days)
    now = new Date(card.last_review!.getTime() + 30 * 24 * 60 * 60 * 1000);
    result = fsrs.scheduleWithGrade(card, Rating.Again, now);

    expect(result.card.stability).toBeLessThan(stabilityBefore);
    expect(result.card.lapses).toBe(1);
    expect(result.card.state).toBe(State.Relearning);
  });

  it('difficulty increases after lapse', () => {
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // First review: Good
    let result = fsrs.scheduleWithGrade(card, Rating.Good, now);
    card = result.card;
    const difficultyBefore = card.difficulty;
    now = card.due;

    // Lapse
    result = fsrs.scheduleWithGrade(card, Rating.Again, now);

    expect(result.card.difficulty).toBeGreaterThan(difficultyBefore);
  });

  it('retrievability was low before lapse', () => {
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // First review: Good
    let result = fsrs.scheduleWithGrade(card, Rating.Good, now);
    card = result.card;

    // Wait 30 days (much longer than optimal)
    const lapseTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const r = fsrs.getRetrievability(card, lapseTime);

    // Retrievability should be well below 90%
    expect(r).toBeLessThan(0.8);
  });
});

describe('Test Vector 4: V6 Curve Difference', () => {
  it('v6 with different w20 produces different intervals', () => {
    const v45 = new FSRS({ enable_fuzz: false });

    // V6 with flatter curve (w20 = -0.3 instead of -0.5)
    const v6Weights = [...DEFAULT_WEIGHTS, 0, 0, 0, -0.3];
    const v6 = new FSRS({ enable_fuzz: false, w: v6Weights });

    let card45 = v45.createEmptyCard();
    let card6 = v6.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    // First review
    let result45 = v45.scheduleWithGrade(card45, Rating.Good, now);
    let result6 = v6.scheduleWithGrade(card6, Rating.Good, now);
    card45 = result45.card;
    card6 = result6.card;

    // Second review
    result45 = v45.scheduleWithGrade(card45, Rating.Good, card45.due);
    result6 = v6.scheduleWithGrade(card6, Rating.Good, card6.due);

    // Intervals should differ due to different curve shape
    // Flatter curve (-0.3) means slower forgetting, longer intervals
    expect(result6.card.scheduled_days).not.toBe(result45.card.scheduled_days);
  });
});

describe('Simulation Test: Convergence', () => {
  it('100 reviews with random grades produces stable values', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // Seed for reproducibility (using fixed pattern)
    const grades: Rating[] = [];
    for (let i = 0; i < 100; i++) {
      grades.push(((i % 4) + 1) as Rating);
    }

    for (const grade of grades) {
      const result = fsrs.scheduleWithGrade(card, grade, now);
      card = result.card;
      now = card.due;

      // Verify no NaN or negative values
      expect(Number.isFinite(card.stability)).toBe(true);
      expect(Number.isFinite(card.difficulty)).toBe(true);
      expect(card.stability).toBeGreaterThan(0);
      expect(card.difficulty).toBeGreaterThanOrEqual(1);
      expect(card.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('all Good ratings lead to growing stability', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');
    const stabilities: number[] = [];

    for (let i = 0; i < 20; i++) {
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      card = result.card;
      stabilities.push(card.stability);
      now = card.due;
    }

    // Stability should grow consistently
    for (let i = 1; i < stabilities.length; i++) {
      expect(stabilities[i]).toBeGreaterThan(stabilities[i - 1]);
    }
  });

  it('mixed ratings produce bounded difficulty', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // Alternate between Again and Easy (extreme pattern)
    for (let i = 0; i < 50; i++) {
      const grade = i % 2 === 0 ? Rating.Again : Rating.Easy;
      const result = fsrs.scheduleWithGrade(card, grade, now);
      card = result.card;
      now = card.due;

      // Difficulty should stay within bounds
      expect(card.difficulty).toBeGreaterThanOrEqual(1);
      expect(card.difficulty).toBeLessThanOrEqual(10);
    }
  });
});

describe('Auto-Rating Integration', () => {
  const fsrs = new FSRS({ enable_fuzz: false });

  it('fast response leads to longer interval', () => {
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    const fastGrade = fsrs.autoRating(500, 2000);
    const slowGrade = fsrs.autoRating(5000, 2000);

    const fastResult = fsrs.scheduleWithGrade(card, fastGrade, now);
    const slowResult = fsrs.scheduleWithGrade(card, slowGrade, now);

    expect(fastResult.card.scheduled_days).toBeGreaterThan(
      slowResult.card.scheduled_days
    );
  });

  it('complete workflow: response time -> grade -> schedule', () => {
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // Simulate user answering in 1.5 seconds with 2 second average
    const grade = fsrs.autoRating(1500, 2000, card.difficulty || 5.5);
    expect(grade).toBeGreaterThan(3); // Should be Good or Easy

    const result = fsrs.scheduleWithGrade(card, grade, now);
    card = result.card;

    expect(card.state).toBe(State.Review);
    expect(card.scheduled_days).toBeGreaterThan(1);
  });
});

describe('Immutability Guarantee', () => {
  it('scheduleWithGrade does not mutate input card', () => {
    const fsrs = new FSRS();
    const card = fsrs.createEmptyCard();
    const originalJSON = JSON.stringify(card);

    fsrs.scheduleWithGrade(card, Rating.Good);

    expect(JSON.stringify(card)).toBe(originalJSON);
  });

  it('repeat does not mutate input card', () => {
    const fsrs = new FSRS();
    const card = fsrs.createEmptyCard();
    const originalJSON = JSON.stringify(card);

    fsrs.repeat(card);

    expect(JSON.stringify(card)).toBe(originalJSON);
  });

  it('returned cards are independent', () => {
    const fsrs = new FSRS();
    const card = fsrs.createEmptyCard();

    const result1 = fsrs.scheduleWithGrade(card, Rating.Good);
    const result2 = fsrs.scheduleWithGrade(card, Rating.Easy);

    result1.card.stability = 999;
    expect(result2.card.stability).not.toBe(999);
  });
});

describe('Edge Cases', () => {
  it('handles very long intervals gracefully', () => {
    const fsrs = new FSRS({ enable_fuzz: false, maximum_interval: 36500 });
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // Build up very high stability
    for (let i = 0; i < 50; i++) {
      const result = fsrs.scheduleWithGrade(card, Rating.Easy, now);
      card = result.card;
      now = card.due;
    }

    // Interval should be capped at maximum
    expect(card.scheduled_days).toBeLessThanOrEqual(36500);
  });

  it('handles minimum intervals', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    // Even Again should produce at least 1 day interval
    const result = fsrs.scheduleWithGrade(card, Rating.Again, now);
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('handles repeated lapses', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    let card = fsrs.createEmptyCard();
    let now = new Date('2024-01-01T10:00:00Z');

    // 10 consecutive lapses
    for (let i = 0; i < 10; i++) {
      const result = fsrs.scheduleWithGrade(card, Rating.Again, now);
      card = result.card;
      now = card.due;
    }

    expect(card.lapses).toBe(10);
    expect(card.stability).toBeGreaterThan(0);
    expect(card.difficulty).toBe(10); // Clamped at max
  });

  it('handles Date at epoch', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    const card = fsrs.createEmptyCard(new Date(0));

    expect(card.due.getTime()).toBe(0);

    const result = fsrs.scheduleWithGrade(card, Rating.Good, new Date(0));
    expect(result.card.last_review?.getTime()).toBe(0);
  });

  it('handles future dates', () => {
    const fsrs = new FSRS({ enable_fuzz: false });
    const future = new Date('2100-01-01T00:00:00Z');
    const card = fsrs.createEmptyCard(future);

    const result = fsrs.scheduleWithGrade(card, Rating.Good, future);
    expect(result.card.due.getTime()).toBeGreaterThan(future.getTime());
  });
});

describe('JSON Serialization', () => {
  it('Card serializes and deserializes correctly', () => {
    const fsrs = new FSRS();
    let card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
    card = result.card;

    const json = JSON.stringify(card);
    const parsed = JSON.parse(json);

    // Dates become strings in JSON
    expect(new Date(parsed.due).getTime()).toBe(card.due.getTime());
    expect(new Date(parsed.last_review).getTime()).toBe(
      card.last_review!.getTime()
    );
    expect(parsed.stability).toBe(card.stability);
    expect(parsed.difficulty).toBe(card.difficulty);
  });

  it('ReviewLog serializes correctly', () => {
    const fsrs = new FSRS();
    const card = fsrs.createEmptyCard();
    const result = fsrs.scheduleWithGrade(card, Rating.Good);

    const json = JSON.stringify(result.log);
    const parsed = JSON.parse(json);

    expect(parsed.rating).toBe(Rating.Good);
    expect(parsed.state).toBe(State.New);
  });
});

describe('Custom Parameters', () => {
  it('higher retention produces shorter intervals', () => {
    const lowRetention = new FSRS({
      enable_fuzz: false,
      request_retention: 0.8,
    });
    const highRetention = new FSRS({
      enable_fuzz: false,
      request_retention: 0.95,
    });

    const cardLow = lowRetention.createEmptyCard();
    const cardHigh = highRetention.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    const resultLow = lowRetention.scheduleWithGrade(cardLow, Rating.Good, now);
    const resultHigh = highRetention.scheduleWithGrade(
      cardHigh,
      Rating.Good,
      now
    );

    expect(resultHigh.card.scheduled_days).toBeLessThan(
      resultLow.card.scheduled_days
    );
  });

  it('custom weights change scheduling behavior', () => {
    // Create weights with higher initial stability
    const customWeights = [...DEFAULT_WEIGHTS];
    customWeights[2] = 10; // w2: Initial Stability (Good) = 10 instead of 2.4

    const fsrs = new FSRS({ enable_fuzz: false, w: customWeights });
    const card = fsrs.createEmptyCard();
    const now = new Date('2024-01-01T10:00:00Z');

    const result = fsrs.scheduleWithGrade(card, Rating.Good, now);

    // Should have much higher stability
    expect(result.card.stability).toBe(10);
  });
});
