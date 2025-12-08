# @squeakyrobot/fsrs API Reference

Complete API documentation for the FSRS v4.5 spaced repetition scheduler.

## Table of Contents

- [FSRS Class](#fsrs-class)
- [Types](#types)
- [Utility Functions](#utility-functions)
- [Constants](#constants)

---

## FSRS Class

The main scheduler class that implements the FSRS v4.5 algorithm.

### Constructor

```typescript
constructor(params?: Partial<FSRSParameters>)
```

Creates a new FSRS scheduler instance.

**Parameters:**
- `params` (optional): Partial configuration to override defaults

**Example:**
```typescript
import { FSRS } from '@squeakyrobot/fsrs';

// Default v4.5 parameters
const fsrs = new FSRS();

// Custom configuration
const fsrs = new FSRS({
  request_retention: 0.85,
  maximum_interval: 365,
  enable_fuzz: false
});
```

---

### Methods

#### `repeat(card, now?)`

Calculates scheduling outcomes for all four possible ratings. Use this when displaying all rating buttons to the user.

```typescript
repeat(card: Card, now?: Date): SchedulingCards
```

**Parameters:**
- `card`: Current card state
- `now` (optional): Current timestamp (defaults to `new Date()`)

**Returns:** `SchedulingCards` - Map of Rating to `{ card, log }` for all 4 ratings

**Example:**
```typescript
const card = fsrs.createEmptyCard();
const results = fsrs.repeat(card);

// Show user all options
console.log(`Again: ${results[1].card.scheduled_days} days`);
console.log(`Hard: ${results[2].card.scheduled_days} days`);
console.log(`Good: ${results[3].card.scheduled_days} days`);
console.log(`Easy: ${results[4].card.scheduled_days} days`);

// User selects "Good"
const { card: updatedCard, log } = results[Rating.Good];
```

---

#### `scheduleWithGrade(card, grade, now?)`

Schedules a review with a specific grade. More efficient than `repeat()` when the grade is already known. Primary method for auto-rating scenarios.

```typescript
scheduleWithGrade(
  card: Card,
  grade: Rating | ContinuousRating,
  now?: Date
): SchedulingResult
```

**Parameters:**
- `card`: Current card state
- `grade`: Discrete rating (1-4) or continuous rating (1.0-4.0)
- `now` (optional): Current timestamp (defaults to `new Date()`)

**Returns:** `SchedulingResult` - `{ card, log }` with updated state

**Example:**
```typescript
// Discrete rating
const { card, log } = fsrs.scheduleWithGrade(card, Rating.Good);

// Continuous rating (auto-rating)
const grade = fsrs.autoRating(responseTime, averageTime);
const { card, log } = fsrs.scheduleWithGrade(card, grade);
```

---

#### `autoRating(responseTime, averageTime, difficulty?)`

Converts response time to a continuous grade (1.0-4.0) using a sigmoid-based formula.

```typescript
autoRating(
  responseTime: number,
  averageTime: number,
  difficulty?: number
): ContinuousRating
```

**Parameters:**
- `responseTime`: Time taken to respond (milliseconds)
- `averageTime`: Expected average response time (milliseconds)
- `difficulty` (optional): Card difficulty 1-10 (default: 5.5)

**Returns:** `ContinuousRating` - Value between 1.0 and 4.0

**Behavior:**
| Response Speed | Grade Range | Discrete Equivalent |
|----------------|-------------|---------------------|
| Much faster than average | 3.5 - 4.0 | Easy |
| Around average | 2.5 - 3.5 | Good |
| Slower than average | 1.5 - 2.5 | Hard |
| Much slower | 1.0 - 1.5 | Again |

**Example:**
```typescript
const start = Date.now();
// ... user answers ...
const responseTime = Date.now() - start;

const grade = fsrs.autoRating(responseTime, 2000, card.difficulty);
const { card: updated } = fsrs.scheduleWithGrade(card, grade);
```

---

#### `getRetrievability(card, now?)`

Calculates current retrievability (probability of successful recall).

```typescript
getRetrievability(card: Card, now?: Date): number
```

**Parameters:**
- `card`: Card to evaluate
- `now` (optional): Current timestamp (defaults to `new Date()`)

**Returns:** `number` - Retrievability between 0 and 1

**Example:**
```typescript
const retention = fsrs.getRetrievability(card);
console.log(`Current retention: ${(retention * 100).toFixed(1)}%`);
```

---

#### `createEmptyCard(now?)`

Creates a new card ready for its first review.

```typescript
createEmptyCard(now?: Date): Card
```

**Parameters:**
- `now` (optional): Initial timestamp (defaults to `new Date()`)

**Returns:** `Card` - New card in "New" state

**Example:**
```typescript
const card = fsrs.createEmptyCard();
// card.state === State.New
// card.stability === 0
// card.difficulty === 0
```

---

#### `getNextInterval(card, rating, now?)`

Previews the interval for a given rating without modifying the card.

```typescript
getNextInterval(card: Card, rating: Rating, now?: Date): number
```

**Parameters:**
- `card`: Card to evaluate
- `rating`: Rating to preview (1-4)
- `now` (optional): Current timestamp

**Returns:** `number` - Interval in days

**Example:**
```typescript
const intervals = [1, 2, 3, 4].map(r =>
  fsrs.getNextInterval(card, r as Rating)
);
console.log(`Intervals: ${intervals.join(', ')} days`);
```

---

## Types

### Rating

User feedback ratings (discrete).

```typescript
type Rating = 1 | 2 | 3 | 4;

const Rating = {
  Again: 1,  // Complete failure to recall
  Hard: 2,   // Recalled with significant difficulty
  Good: 3,   // Recalled with some effort
  Easy: 4,   // Recalled effortlessly
} as const;
```

---

### ContinuousRating

Continuous rating for auto-rating scenarios.

```typescript
type ContinuousRating = number; // 1.0 to 4.0
```

Continuous ratings are internally rounded to discrete ratings:
- 1.0 - 1.5 → Again (1)
- 1.5 - 2.5 → Hard (2)
- 2.5 - 3.5 → Good (3)
- 3.5 - 4.0 → Easy (4)

---

### State

Card learning states.

```typescript
type State = 0 | 1 | 2 | 3;

const State = {
  New: 0,        // Never reviewed
  Learning: 1,   // Initial learning phase
  Review: 2,     // Regular review phase
  Relearning: 3, // Re-learning after a lapse
} as const;
```

---

### Card

Core memory state for a flashcard.

```typescript
interface Card {
  due: Date;              // Next scheduled review timestamp
  stability: number;      // Days until retention drops to 90%
  difficulty: number;     // Inherent complexity (1-10)
  elapsed_days: number;   // Days since last review
  scheduled_days: number; // Assigned interval for current review
  reps: number;           // Total review count
  lapses: number;         // Number of times forgotten (Again)
  state: State;           // Current learning phase
  last_review: Date | null; // Previous review timestamp
}
```

**JSON Serialization:**
Cards serialize cleanly to JSON. When deserializing, convert date strings back to Date objects:

```typescript
const json = JSON.stringify(card);
const parsed = JSON.parse(json);
parsed.due = new Date(parsed.due);
parsed.last_review = parsed.last_review ? new Date(parsed.last_review) : null;
```

---

### ReviewLog

Record of a single review event.

```typescript
interface ReviewLog {
  rating: Rating;           // User's rating
  state: State;             // Card state before review
  due: Date;                // When review was due
  stability: number;        // Stability before review
  difficulty: number;       // Difficulty before review
  elapsed_days: number;     // Days since last review
  last_elapsed_days: number; // Previous elapsed_days value
  scheduled_days: number;   // Interval that was assigned
  review: Date;             // When review occurred
}
```

---

### FSRSParameters

Algorithm configuration.

```typescript
interface FSRSParameters {
  request_retention: number;   // Target retention (0.7-0.99, default: 0.9)
  maximum_interval: number;    // Maximum interval in days (default: 36500)
  w: number[];                 // Weight vector (17 for v4.5, 21 for v6)
  enable_fuzz: boolean;        // Add random jitter to intervals (default: true)
  enable_short_term?: boolean; // V6 same-day logic (default: false)
}
```

---

### SchedulingResult

Result of scheduling a single review.

```typescript
interface SchedulingResult {
  card: Card;      // Updated card state
  log: ReviewLog;  // Review record
}
```

---

### SchedulingCards

Results for all possible ratings.

```typescript
type SchedulingCards = Record<Rating, SchedulingResult>;
```

---

## Utility Functions

### `isLapse(grade)`

Checks if a grade represents a lapse (failure to recall).

```typescript
function isLapse(grade: Rating | ContinuousRating): boolean
```

**Parameters:**
- `grade`: Rating to check (discrete or continuous)

**Returns:** `true` if grade < 1.5 (Again)

**Example:**
```typescript
import { isLapse, Rating } from '@squeakyrobot/fsrs';

isLapse(Rating.Again);  // true
isLapse(Rating.Hard);   // false
isLapse(1.4);           // true (continuous)
isLapse(1.6);           // false (continuous)
```

---

## Constants

### DEFAULT_WEIGHTS

Default v4.5 weight vector (17 parameters).

```typescript
const DEFAULT_WEIGHTS: readonly number[] = [
  0.4,   // w0: Initial Stability (Again)
  0.6,   // w1: Initial Stability (Hard)
  2.4,   // w2: Initial Stability (Good)
  5.8,   // w3: Initial Stability (Easy)
  4.93,  // w4: Initial Difficulty Base
  0.94,  // w5: Initial Difficulty Decay
  0.86,  // w6: Difficulty Update Factor
  0.01,  // w7: Difficulty Mean Reversion
  1.49,  // w8: Stability Update Base
  0.14,  // w9: Stability Update Exp (S)
  0.94,  // w10: Stability Update Exp (R)
  2.18,  // w11: Stability Fail Base
  0.05,  // w12: Stability Fail Exp (D)
  0.34,  // w13: Stability Fail Exp (S)
  1.26,  // w14: Stability Fail Exp (R)
  0.29,  // w15: Hard Penalty
  2.61,  // w16: Easy Bonus
];
```

### DEFAULT_PARAMETERS

Default algorithm configuration.

```typescript
const DEFAULT_PARAMETERS: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [...DEFAULT_WEIGHTS],
  enable_fuzz: true,
  enable_short_term: false,
};
```

---

## V6 Compatibility

The library accepts v6 parameter sets (21 weights) for advanced users with optimized parameters:

```typescript
const fsrs = new FSRS({
  w: [
    // 17 standard weights...
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
    1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26,
    0.29, 2.61,
    // 4 additional v6 weights
    0.48,  // w17: Same-day parameter 1
    1.05,  // w18: Same-day parameter 2
    0.36,  // w19: Same-day parameter 3
    -0.54  // w20: Dynamic decay exponent
  ]
});
```

**Note:** V6 parameters only provide meaningful benefit when optimized on user-specific review data using the FSRS optimizer.
