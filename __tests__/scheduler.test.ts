/**
 * Tests for FSRS v4.5 Scheduler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FSRS, isLapse } from '../src/scheduler.js';
import { Rating, State, type Card } from '../src/models.js';
import { DEFAULT_WEIGHTS } from '../src/parameters.js';

describe('FSRS', () => {
  let fsrs: FSRS;

  beforeEach(() => {
    // Use fuzz disabled for deterministic tests
    fsrs = new FSRS({ enable_fuzz: false });
  });

  describe('constructor', () => {
    it('creates instance with default parameters', () => {
      const scheduler = new FSRS();
      const params = scheduler.parameters;
      expect(params.request_retention).toBe(0.9);
      expect(params.maximum_interval).toBe(36500);
      expect(params.w).toEqual([...DEFAULT_WEIGHTS]);
    });

    it('accepts custom parameters', () => {
      const scheduler = new FSRS({
        request_retention: 0.85,
        maximum_interval: 365,
      });
      const params = scheduler.parameters;
      expect(params.request_retention).toBe(0.85);
      expect(params.maximum_interval).toBe(365);
    });

    it('throws for invalid parameters', () => {
      expect(() => new FSRS({ request_retention: 0.5 })).toThrow();
    });

    it('returns a copy of parameters (immutable)', () => {
      const scheduler = new FSRS();
      const params1 = scheduler.parameters;
      const params2 = scheduler.parameters;
      params1.request_retention = 0.5;
      expect(params2.request_retention).toBe(0.9);
    });
  });

  describe('createEmptyCard', () => {
    it('creates card in New state', () => {
      const card = fsrs.createEmptyCard();
      expect(card.state).toBe(State.New);
    });

    it('has zero stability and difficulty', () => {
      const card = fsrs.createEmptyCard();
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
    });

    it('has zero reps and lapses', () => {
      const card = fsrs.createEmptyCard();
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
    });

    it('has due date at current time', () => {
      const now = new Date('2024-01-01T10:00:00Z');
      const card = fsrs.createEmptyCard(now);
      expect(card.due.getTime()).toBe(now.getTime());
    });

    it('has null last_review', () => {
      const card = fsrs.createEmptyCard();
      expect(card.last_review).toBeNull();
    });
  });

  describe('repeat', () => {
    it('returns results for all 4 ratings', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const results = fsrs.repeat(card, now);

      expect(results[Rating.Again]).toBeDefined();
      expect(results[Rating.Hard]).toBeDefined();
      expect(results[Rating.Good]).toBeDefined();
      expect(results[Rating.Easy]).toBeDefined();
    });

    it('returns different intervals for different ratings', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const results = fsrs.repeat(card, now);

      const intervals = [
        results[Rating.Again].card.scheduled_days,
        results[Rating.Hard].card.scheduled_days,
        results[Rating.Good].card.scheduled_days,
        results[Rating.Easy].card.scheduled_days,
      ];

      // Intervals should generally increase with rating
      // Note: Again might have different behavior
      expect(intervals[1]).toBeLessThanOrEqual(intervals[2]);
      expect(intervals[2]).toBeLessThanOrEqual(intervals[3]);
    });

    it('does not mutate input card', () => {
      const card = fsrs.createEmptyCard();
      const originalDue = card.due.getTime();
      const originalState = card.state;

      fsrs.repeat(card, new Date());

      expect(card.due.getTime()).toBe(originalDue);
      expect(card.state).toBe(originalState);
    });
  });

  describe('scheduleWithGrade', () => {
    it('transitions New card to Learning on Again', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, Rating.Again);
      expect(result.card.state).toBe(State.Learning);
    });

    it('transitions New card to Review on Good', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, Rating.Good);
      expect(result.card.state).toBe(State.Review);
    });

    it('increments reps counter', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, Rating.Good);
      expect(result.card.reps).toBe(1);
    });

    it('increments lapses on Again', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, Rating.Again);
      expect(result.card.lapses).toBe(1);
    });

    it('does not increment lapses on Good', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, Rating.Good);
      expect(result.card.lapses).toBe(0);
    });

    it('sets last_review to now', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      expect(result.card.last_review?.getTime()).toBe(now.getTime());
    });

    it('supports continuous ratings', () => {
      const card = fsrs.createEmptyCard();
      const result = fsrs.scheduleWithGrade(card, 3.5);
      expect(result.card.state).toBe(State.Review);
    });

    it('rounds continuous rating to discrete', () => {
      const card = fsrs.createEmptyCard();
      const result1 = fsrs.scheduleWithGrade(card, 2.4);
      const result2 = fsrs.scheduleWithGrade(card, 2.6);

      // 2.4 rounds to 2, 2.6 rounds to 3
      expect(result1.log.rating).toBe(2);
      expect(result2.log.rating).toBe(3);
    });

    it('returns correct review log', () => {
      const card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);

      expect(result.log.rating).toBe(Rating.Good);
      expect(result.log.state).toBe(State.New);
      expect(result.log.review.getTime()).toBe(now.getTime());
    });
  });

  describe('autoRating', () => {
    it('returns high grade for fast response', () => {
      const grade = fsrs.autoRating(500, 2000);
      expect(grade).toBeGreaterThan(3.5);
    });

    it('returns medium grade for average response', () => {
      const grade = fsrs.autoRating(2000, 2000);
      expect(grade).toBeGreaterThan(2.5);
      expect(grade).toBeLessThan(3.5);
    });

    it('returns low grade for slow response', () => {
      const grade = fsrs.autoRating(6000, 2000);
      expect(grade).toBeLessThan(2.5);
    });
  });

  describe('getRetrievability', () => {
    it('returns 0 for New card', () => {
      const card = fsrs.createEmptyCard();
      expect(fsrs.getRetrievability(card)).toBe(0);
    });

    it('returns value close to 1 right after review', () => {
      let card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      card = result.card;

      // Check retrievability immediately after
      const r = fsrs.getRetrievability(card, now);
      expect(r).toBeCloseTo(1, 1);
    });

    it('returns approximately 0.9 at scheduled time', () => {
      let card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      card = result.card;

      // Check retrievability at due date
      const r = fsrs.getRetrievability(card, card.due);
      expect(r).toBeCloseTo(0.9, 1);
    });

    it('decreases over time', () => {
      let card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');
      const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      card = result.card;

      const r1 = fsrs.getRetrievability(
        card,
        new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
      );
      const r2 = fsrs.getRetrievability(
        card,
        new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
      );
      const r3 = fsrs.getRetrievability(
        card,
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      );

      expect(r1).toBeGreaterThan(r2);
      expect(r2).toBeGreaterThan(r3);
    });
  });

  describe('getNextInterval', () => {
    it('returns different intervals for different ratings', () => {
      const card = fsrs.createEmptyCard();

      const i1 = fsrs.getNextInterval(card, Rating.Again);
      const i2 = fsrs.getNextInterval(card, Rating.Hard);
      const i3 = fsrs.getNextInterval(card, Rating.Good);
      const i4 = fsrs.getNextInterval(card, Rating.Easy);

      expect(i2).toBeGreaterThanOrEqual(i1);
      expect(i3).toBeGreaterThanOrEqual(i2);
      expect(i4).toBeGreaterThanOrEqual(i3);
    });

    it('returns positive intervals', () => {
      const card = fsrs.createEmptyCard();

      for (let r = 1; r <= 4; r++) {
        const interval = fsrs.getNextInterval(card, r as Rating);
        expect(interval).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('review card flow', () => {
    it('transitions Review -> Relearning on lapse', () => {
      let card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');

      // First review: Good
      let result = fsrs.scheduleWithGrade(card, Rating.Good, now);
      card = result.card;
      expect(card.state).toBe(State.Review);

      // Second review: Again (lapse)
      const later = new Date(card.due.getTime());
      result = fsrs.scheduleWithGrade(card, Rating.Again, later);
      card = result.card;
      expect(card.state).toBe(State.Relearning);
      expect(card.lapses).toBe(1);
    });

    it('transitions Relearning -> Review on success', () => {
      let card = fsrs.createEmptyCard();
      const now = new Date('2024-01-01T10:00:00Z');

      // First review: Again -> Learning
      let result = fsrs.scheduleWithGrade(card, Rating.Again, now);
      card = result.card;
      expect(card.state).toBe(State.Learning);

      // Second review: Good -> Review
      const later = new Date(card.due.getTime());
      result = fsrs.scheduleWithGrade(card, Rating.Good, later);
      card = result.card;
      expect(card.state).toBe(State.Review);
    });

    it('grows stability over successful reviews', () => {
      let card = fsrs.createEmptyCard();
      let now = new Date('2024-01-01T10:00:00Z');
      const stabilities: number[] = [];

      // Simulate 5 successful reviews
      for (let i = 0; i < 5; i++) {
        const result = fsrs.scheduleWithGrade(card, Rating.Good, now);
        card = result.card;
        stabilities.push(card.stability);
        now = card.due;
      }

      // Stability should increase with each review
      for (let i = 1; i < stabilities.length; i++) {
        expect(stabilities[i]).toBeGreaterThan(stabilities[i - 1]);
      }
    });

    it('respects maximum_interval', () => {
      const scheduler = new FSRS({
        enable_fuzz: false,
        maximum_interval: 30,
      });

      let card = scheduler.createEmptyCard();
      let now = new Date('2024-01-01T10:00:00Z');

      // Many successful reviews
      for (let i = 0; i < 10; i++) {
        const result = scheduler.scheduleWithGrade(card, Rating.Easy, now);
        card = result.card;
        expect(card.scheduled_days).toBeLessThanOrEqual(30);
        now = card.due;
      }
    });
  });
});

describe('isLapse (exported)', () => {
  it('is exported from scheduler', () => {
    expect(typeof isLapse).toBe('function');
  });

  it('returns true for Again', () => {
    expect(isLapse(1)).toBe(true);
  });

  it('returns false for Good', () => {
    expect(isLapse(3)).toBe(false);
  });
});
