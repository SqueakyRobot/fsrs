# @squeakyrobot/fsrs

A pure TypeScript implementation of the Free Spaced Repetition Scheduler (FSRS) v4.5 algorithm with optional v6 support.

## Overview

FSRS is a modern, evidence-based spaced repetition algorithm that optimizes review intervals based on the DSR (Difficulty, Stability, Retrievability) model of memory. Unlike traditional algorithms like SM-2, FSRS uses trainable parameters optimized on real user data to achieve superior retention prediction.

### Key Features

- **FSRS v4.5 Core**: Proven algorithm with stable defaults (17 parameters)
- **81% Better Than SM-2**: Captures 98% of v6's improvement with fewer parameters
- **Edge Runtime Ready**: Works in Cloudflare Workers, Vercel Edge, Deno Deploy
- **Continuous Grading**: Supports both discrete (1-4) and continuous (1.0-4.0) ratings
- **Auto-Rating**: Built-in response time to grade conversion
- **Optional v6 Support**: Accepts optimized 21-parameter sets for advanced users
- **Type-Safe**: Full TypeScript support with strict typing
- **Zero Dependencies**: Minimal bundle size
- **Pure Functions**: Immutable API, no side effects

## Installation

```bash
npm install @squeakyrobot/fsrs
```

## Quick Start

### Basic Usage with Discrete Ratings

```typescript
import { FSRS, Rating } from '@squeakyrobot/fsrs';

// Initialize with default v4.5 parameters
const fsrs = new FSRS();

// Create a new card
let card = fsrs.createEmptyCard();

// Simulate a review session - get all 4 possible outcomes
const now = new Date();
const reviewResults = fsrs.repeat(card, now);

// User rates the card as "Good"
const { card: updatedCard, log } = reviewResults[Rating.Good];

console.log(`Next review in ${updatedCard.scheduled_days} days`);
console.log(`Current stability: ${updatedCard.stability} days`);
console.log(`Difficulty: ${updatedCard.difficulty}/10`);
```

### Auto-Rating with Continuous Grades

```typescript
import { FSRS } from '@squeakyrobot/fsrs';

const fsrs = new FSRS();
let card = fsrs.createEmptyCard();

// Track response time
const start = Date.now();
// ... user answers flashcard ...
const responseTime = Date.now() - start;

// Convert response time to grade (1.0-4.0)
const averageTime = 2000; // Expected average response time (ms)
const grade = fsrs.autoRating(responseTime, averageTime, card.difficulty);

// Schedule with continuous grade
const { card: updatedCard, log } = fsrs.scheduleWithGrade(card, grade);
```

### Edge Runtime Example (Cloudflare Workers)

```typescript
// worker.ts
import { FSRS } from '@squeakyrobot/fsrs';

const fsrs = new FSRS();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { card, responseTime } = await request.json();

    const grade = fsrs.autoRating(responseTime, 2000);
    const result = fsrs.scheduleWithGrade(card, grade);

    return Response.json(result);
  }
};
```

## Algorithm Background

### The DSR Model

FSRS models memory using three distinct variables:

1. **Difficulty (D)**: Inherent complexity of the item (1.0 = easiest, 10.0 = hardest)
2. **Stability (S)**: Time interval (days) for retrievability to decay from 100% to 90%
3. **Retrievability (R)**: Instantaneous probability of successful recall (0-1)

### Why V4.5?

**V4.5 provides the optimal balance for a minimal implementation:**

- **Proven defaults**: Works excellently without requiring parameter optimization
- **98% of v6's benefit**: Only 3% RMSE difference from v6 on benchmark data
- **Simpler**: No same-day review complexity
- **Stable**: Widely deployed with deterministic behavior

**V6 support is available** for advanced users who:

- Run the FSRS optimizer on their review history
- Need personalized parameters (w0-w20)
- Want the marginal 2-3% accuracy improvement

## API Reference

### FSRS Class

#### Constructor

```typescript
constructor(params?: Partial<FSRSParameters>)
```

Creates a new FSRS scheduler instance with optional parameter overrides.

#### Methods

##### `repeat(card: Card, now?: Date): SchedulingCards`

Calculates scheduling outcomes for all possible ratings. Useful for showing users all 4 button options with predicted intervals.

**Parameters:**
- `card`: Current card state
- `now`: Current timestamp (default: current time)

**Returns:** Map of Rating -> { log, card } for all 4 ratings

##### `scheduleWithGrade(card: Card, grade: Rating | ContinuousRating, now?: Date): SchedulingResult`

Schedules a review with a specific grade. Primary method for auto-rating scenarios and manual reviews.

**Parameters:**
- `card`: Current card state
- `grade`: Rating (discrete 1-4) or continuous (1.0-4.0)
- `now`: Current timestamp (default: current time)

**Returns:** { log, card } with updated card state and review log

##### `autoRating(responseTime: number, averageTime: number, difficulty?: number): ContinuousRating`

Auto-rating utility that converts response time to a continuous grade.

**Parameters:**
- `responseTime`: Time taken to respond (milliseconds)
- `averageTime`: Expected average response time (milliseconds)
- `difficulty`: Optional card difficulty (1-10) for adjustment (default: 5.5)

**Returns:** Continuous rating (1.0-4.0)

**Formula:**
- Much faster than average: approaches 4.0 (Easy)
- Around average: approaches 3.0 (Good)
- Slower than average: approaches 2.0 (Hard) or 1.0 (Again)

##### `getRetrievability(card: Card, now?: Date): number`

Calculates current retrievability (probability of recall).

**Parameters:**
- `card`: Card to evaluate
- `now`: Current timestamp (default: current time)

**Returns:** Retrievability (0-1)

##### `createEmptyCard(now?: Date): Card`

Creates a new empty card ready for first review.

**Parameters:**
- `now`: Optional timestamp (default: current time)

**Returns:** New card in "New" state

##### `getNextInterval(card: Card, rating: Rating, now?: Date): number`

Gets the next interval for a given rating (preview mode).

**Parameters:**
- `card`: Card to evaluate
- `rating`: Rating to preview
- `now`: Current timestamp (default: current time)

**Returns:** Interval in days

### Types

#### Rating

```typescript
type Rating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const;
```

#### State

```typescript
type State = 0 | 1 | 2 | 3; // New | Learning | Review | Relearning

const State = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const;
```

#### Card

```typescript
interface Card {
  due: Date;              // Next scheduled review timestamp
  stability: number;      // Days to 90% retention
  difficulty: number;     // Complexity (1-10)
  elapsed_days: number;   // Days since last review
  scheduled_days: number; // Assigned interval
  reps: number;           // Total review count
  lapses: number;         // Failure count
  state: State;           // Current learning phase
  last_review: Date | null; // Previous review timestamp
}
```

#### FSRSParameters

```typescript
interface FSRSParameters {
  request_retention: number;  // 0.7-0.97, default 0.9
  maximum_interval: number;   // Default 36500 days
  w: number[];                // 17 (v4.5) or 21 (v6) weights
  enable_fuzz: boolean;       // Random interval jitter
  enable_short_term?: boolean; // V6 same-day logic
}
```

### Utility Functions

#### `isLapse(grade: Rating | ContinuousRating): boolean`

Checks if a grade represents a lapse (failure to recall). Useful for analytics, streak tracking, and UI badges.

**Parameters:**
- `grade`: Rating (discrete or continuous)

**Returns:** `true` if grade < 1.5 (Again)

## Configuration

### Default v4.5 Parameters

```typescript
const fsrs = new FSRS({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true
});
```

### Custom V6 Parameters (Advanced)

For users with optimized parameters from the FSRS optimizer:

```typescript
const fsrs = new FSRS({
  request_retention: 0.9,
  w: [
    // Your 21 optimized parameters from FSRS optimizer
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
    1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26,
    0.29, 2.61, 0.48, 1.05, 0.36, -0.54
  ]
});
```

**Note**: V6 parameters only provide benefit when optimized on your specific review data. Generic v6 defaults offer minimal improvement over v4.5.

## Integration Examples

### React + Zustand

```typescript
import create from 'zustand';
import { FSRS, Card, Rating } from '@squeakyrobot/fsrs';

const fsrs = new FSRS();

interface FlashcardStore {
  cards: Map<string, Card>;
  reviewCard: (id: string, rating: Rating) => void;
}

const useFlashcards = create<FlashcardStore>((set) => ({
  cards: new Map(),
  reviewCard: (id, rating) => set((state) => {
    const card = state.cards.get(id);
    if (!card) return state;

    const result = fsrs.repeat(card, new Date());
    const updatedCard = result[rating].card;

    return {
      cards: new Map(state.cards).set(id, updatedCard)
    };
  })
}));
```

### Next.js API Route

```typescript
import { FSRS, Rating } from '@squeakyrobot/fsrs';
import { NextRequest, NextResponse } from 'next/server';

const fsrs = new FSRS();

export async function POST(req: NextRequest) {
  const { card, rating } = await req.json();

  const result = fsrs.repeat(card, new Date());
  const updated = result[rating as Rating];

  return NextResponse.json({
    card: updated.card,
    log: updated.log
  });
}
```

## Performance Benchmarks

Based on the fsrs-benchmark dataset (1.7B reviews from 20K users):

| Algorithm | Log Loss | RMSE | Improvement vs SM-2 |
|-----------|----------|------|---------------------|
| SM-2 (Anki Default) | 0.7317 | 0.4066 | - |
| FSRS v4.5 | 0.3624 | 0.0764 | ~81% |
| FSRS v6 | 0.3460 | 0.0653 | ~84% |

**Key Insight**: FSRS v4.5 captures 98% of v6's improvement with 19% fewer parameters, making it ideal for applications that don't have user-specific optimization.

## Contributing

Contributions are welcome! See the [CONTRIBUTING guide](https://github.com/squeakyrobot/fsrs/blob/main/CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## References

- [FSRS Official Documentation](https://github.com/open-spaced-repetition/fsrs4anki/wiki)
- [Technical Explanation of FSRS](https://expertium.github.io/Algorithm.html)
- [FSRS Benchmark Results](https://github.com/ankitects/fsrs-benchmark)
- [Original TypeScript Implementation](https://github.com/open-spaced-repetition/ts-fsrs)

## Related Projects

- [Anki](https://apps.ankiweb.net/) - Popular flashcard application that uses FSRS
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) - Reference TypeScript implementation
- [fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki) - FSRS for Anki add-on
