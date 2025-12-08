# FSRS Future Enhancements Specification

**Status**: 📋 Planned
**Created**: 2025-12-07
**Target Version**: v1.1+
**Priority**: Medium
**Dependencies**: v1.0 Core Implementation

## Overview

This specification outlines planned enhancements for @squeakyrobot/fsrs beyond the v1.0 release. These features provide additional flexibility and power-user capabilities while maintaining the library's minimal footprint and edge runtime compatibility.

## Rationale

The v1.0 implementation focuses on delivering a production-ready, minimal FSRS v4.5 library with essential features. However, real-world usage may reveal needs for:
- **Configurability**: Different use cases (games vs. serious study) may benefit from tunable auto-rating parameters
- **Advanced utilities**: Power users building analytics dashboards or gamified experiences
- **Parameter optimization**: Self-contained optimizer for training custom weights

These enhancements are deferred to post-v1.0 to:
1. Gather real-world usage data to inform API design
2. Avoid premature abstraction and over-engineering
3. Keep v1.0 scope focused and shippable

## Proposed Enhancements

### 1. AutoRatingConfig (Priority: High)

**Target**: v1.1

**Problem**: Different practice modes require different auto-rating sensitivity:
- **Gamified learning**: More forgiving grading to maintain engagement
- **Exam prep**: Stricter grading to match test conditions
- **Quick drills**: Faster response time thresholds

**Solution**: Configurable auto-rating parameters

```typescript
interface AutoRatingConfig {
  /**
   * Steepness of sigmoid curve (default: 2.0)
   * Higher = sharper transitions between grades
   * Lower = more gradual transitions
   */
  steepness?: number;

  /**
   * Center point of sigmoid (default: 1.0)
   * Point where responseTime/averageTime = centerPoint → grade = 3.0
   */
  centerPoint?: number;

  /**
   * Difficulty adjustment weight (default: 1/20)
   * How much card difficulty affects grading leniency
   * 0 = no adjustment, higher = more lenient for hard cards
   */
  difficultyWeight?: number;

  /**
   * Optional thresholds for discrete conversion
   * Defaults: [1.5, 2.5, 3.5]
   */
  thresholds?: [number, number, number];
}

// Updated autoRating signature
autoRating(
  responseTime: number,
  averageTime: number,
  difficulty?: number,
  config?: AutoRatingConfig
): ContinuousRating;
```

**API Design Considerations**:
- Optional parameter (backward compatible)
- Presets for common scenarios: `AutoRatingConfig.LENIENT`, `AutoRatingConfig.STRICT`
- Validation: ensure thresholds are monotonically increasing

**Implementation Notes**:
- Keep default behavior unchanged (no breaking changes)
- Add unit tests for edge cases (extreme steepness, invalid thresholds)
- Document presets in README

### 2. Advanced Analytics Utilities (Priority: Medium)

**Target**: v1.2

**Utilities for tracking learning progress and debugging**:

```typescript
/**
 * Calculate projected retention at a future date
 */
export function projectRetention(
  card: Card,
  futureDate: Date,
  params: FSRSParameters
): number;

/**
 * Estimate total review workload for a deck
 */
export function estimateWorkload(
  cards: Card[],
  days: number,
  params: FSRSParameters
): { total: number; perDay: number[] };

/**
 * Analyze difficulty distribution across deck
 */
export function analyzeDifficulty(
  cards: Card[]
): { mean: number; median: number; distribution: number[] };

/**
 * Get human-readable card state description
 */
export function describeCard(card: Card): string;
// Example: "Mature (S=45.2d, D=3.1, R=92%)"
```

**Use Cases**:
- Admin dashboards showing deck statistics
- User progress reports
- Debugging card scheduling issues
- A/B testing different parameters

### 3. Parameter Optimizer (Priority: High)

**Target**: v2.0

**Goal**: TypeScript port of the Python FSRS optimizer for training custom weights.

**Challenges**:
- Requires optimization library (scipy equivalent)
- Heavy computation (not suitable for edge runtime)
- Large dataset handling (millions of review logs)

**Approach**:
- Separate package: `@squeakyrobot/fsrs-optimizer`
- Node.js only (not edge-compatible)
- Dependency on optimization library acceptable
- Export optimizer as CLI tool and programmatic API

**API Sketch**:
```typescript
interface OptimizerConfig {
  iterations?: number;
  learningRate?: number;
  targetRetention?: number;
}

export async function optimizeParameters(
  reviewLogs: ReviewLog[],
  config?: OptimizerConfig
): Promise<{ weights: number[]; loss: number; iterations: number }>;
```

**Scope**:
- Train v4.5 parameters (17 weights)
- Optionally train v6 parameters (21 weights)
- Cross-validation to prevent overfitting
- Progress callback for long-running optimizations

### 4. Migration Utilities (Priority: Low)

**Target**: v1.3

**Problem**: Users migrating from Anki/SuperMemo need to convert existing card data.

**Utilities**:
```typescript
/**
 * Convert SM-2 card data to FSRS card
 */
export function fromSM2(sm2Card: {
  easeFactor: number;
  interval: number;
  repetitions: number;
}): Card;

/**
 * Import Anki collection (requires parsing .anki2 SQLite)
 * Returns cards grouped by deck
 */
export function importAnkiCollection(
  ankiDbPath: string
): Promise<Map<string, Card[]>>;
```

**Considerations**:
- SM-2 → FSRS mapping is lossy (no difficulty/stability in SM-2)
- Use heuristics: `difficulty = f(easeFactor)`, `stability ≈ interval`
- Anki import requires SQLite parser (heavy dependency - separate package?)

### 5. Same-Day Review Logic (Priority: Low)

**Target**: v2.0+

**FSRS v6 Feature**: Short-term memory adjustments for multiple reviews within 24 hours.

**Why Deferred**:
- Adds complexity (tracking intraday review timestamps)
- Benefits only realized with v6 optimization
- Minimal impact for typical daily review schedules

**Implementation When Ready**:
- Add `intraday_reviews` to Card interface
- Implement w₁₇-w₁₉ formulas
- Update `enable_short_term` flag logic

### 6. Alternative Auto-Rating Algorithms (Priority: Low)

**Target**: v1.2+

**Problem**: Sigmoid may not fit all use cases.

**Alternatives**:
```typescript
type AutoRatingAlgorithm = 'sigmoid' | 'linear' | 'piecewise' | 'custom';

interface LinearAutoRatingConfig {
  algorithm: 'linear';
  thresholds: [number, number, number]; // time ratios for [Hard, Good, Easy]
}

interface CustomAutoRatingConfig {
  algorithm: 'custom';
  fn: (responseTime: number, averageTime: number, difficulty: number) => number;
}
```

**Use Cases**:
- Linear: Simpler, more predictable
- Piecewise: Different rules for very fast/slow responses
- Custom: Domain-specific logic (e.g., typing speed, audio recognition)

## Non-Goals (Explicitly Deferred)

These features are **not** planned for the foreseeable future:

1. **UI Components**: This library is algorithm-only. UI is the responsibility of consuming applications.
2. **Database Integration**: Storage is the consumer's responsibility. Library only provides serializable types.
3. **Multi-tenancy**: Deck management, user accounts, etc. are application concerns.
4. **Real-time Sync**: Not in scope for a scheduling algorithm library.

## Implementation Strategy

**Incremental Releases**:
- v1.1: AutoRatingConfig (high-impact, low-risk)
- v1.2: Analytics utilities + Alternative auto-rating
- v1.3: Migration utilities (if demand exists)
- v2.0: Parameter optimizer + Same-day logic

**Backward Compatibility**:
- All enhancements must be **additive** (no breaking changes)
- Optional parameters with sensible defaults
- Separate packages for heavy dependencies (optimizer, Anki import)

**Community Input**:
- Gather feedback from v1.0 users before finalizing APIs
- Create GitHub issues for feature requests
- Prioritize based on actual usage patterns

## Success Metrics

For each enhancement, success is measured by:
- **Adoption**: % of users enabling the feature
- **API Stability**: No breaking changes required post-release
- **Performance**: No degradation to core algorithm performance
- **Bundle Size**: Enhancements do not bloat core library (use tree-shaking)

## Related Specifications

- [FSRS v4.5 Implementation](../in-progress/2025-12-07_fsrs-v4.5-implementation.md) - Core v1.0 spec
- Parameter Optimization Guide *(to be created)*
- Migration Guide *(to be created)*
