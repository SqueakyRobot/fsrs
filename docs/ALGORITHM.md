# FSRS v4.5 Algorithm Reference

Mathematical specifications and theoretical background for the Free Spaced Repetition Scheduler.

## Table of Contents

- [The DSR Model](#the-dsr-model)
- [Core Formulas](#core-formulas)
- [State Updates](#state-updates)
- [Auto-Rating Algorithm](#auto-rating-algorithm)
- [Parameter Reference](#parameter-reference)
- [Performance Benchmarks](#performance-benchmarks)

---

## The DSR Model

FSRS models memory using three distinct variables:

### Difficulty (D)

Inherent complexity of the item.

- **Range:** 1.0 (easiest) to 10.0 (hardest)
- **Purpose:** Influences how quickly stability increases after successful reviews
- **Behavior:** Updates based on user feedback with mean reversion to prevent extremes

### Stability (S)

Storage strength of the memory trace.

- **Definition:** Time interval (days) for retrievability to decay from 100% to 90%
- **Key Property:** At 90% retention target, optimal interval equals stability (I ≈ S)
- **Behavior:** Increases after successful reviews, decreases after lapses

### Retrievability (R)

Instantaneous probability of successful recall.

- **Range:** 0 to 1
- **Decay:** Follows a power-law distribution (not exponential)
- **Purpose:** Determines when a card should be reviewed

---

## Core Formulas

### Forgetting Curve

FSRS uses a power-law forgetting curve, which better models human memory than exponential decay:

```
R(t, S) = (1 + F · (t/S))^(-0.5)

where:
  R = Retrievability (probability of recall)
  t = Time elapsed since last review (days)
  S = Stability (days to 90% retention)
  F = 19/81 ≈ 0.2346 (scaling factor)
```

**Derivation of F:**
The scaling factor ensures R = 0.9 when t = S:
```
0.9 = (1 + F)^(-0.5)
F = 0.9^(-2) - 1 = 1/0.81 - 1 = 19/81
```

### Interval Calculation

Invert the forgetting curve to find when retention reaches the target:

```
I(S, R_req) = (S/F) · (R_req^(-2) - 1)
            = S · (81/19) · (R_req^(-2) - 1)
```

For R_req = 0.9:
```
I = S · (81/19) · (1/0.81 - 1) = S · (81/19) · (19/81) = S
```

This confirms: **at 90% retention, optimal interval equals stability**.

---

## State Updates

### Initial Review (New Card)

**Initial Stability:**
```
S₀(G) = w[G-1]

where G = rating (1-4)
```

Maps directly to the first four weights:
- Again (1): S₀ = w₀ = 0.4 days
- Hard (2): S₀ = w₁ = 0.6 days
- Good (3): S₀ = w₂ = 2.4 days
- Easy (4): S₀ = w₃ = 5.8 days

**Initial Difficulty:**
```
D₀(G) = w₄ - e^(w₅ · (G-1)) + 1
```

Clamped to [1, 10]. Higher ratings yield lower initial difficulty.

### Successful Review (Grade ≥ 2)

**Difficulty Update:**
```
D_next = D_prev - w₆ · (G - 3)
D_new = w₇ · D₀(3) + (1 - w₇) · D_next
```

- Rating > 3 decreases difficulty
- Rating < 3 increases difficulty
- Mean reversion (w₇) prevents extreme values

**Stability Update:**
```
GrowthFactor = e^(w₈) · (11 - D) · S^(-w₉) · (e^(w₁₀·(1-R)) - 1) · h · b

where:
  h = w₁₅ if G=2 (Hard penalty), else 1
  b = w₁₆ if G=4 (Easy bonus), else 1

S_new = S_prev · (1 + GrowthFactor)
```

Key insights:
- Lower difficulty → higher growth factor
- Lower current stability → higher relative growth
- Lower retrievability → higher growth (reviewing earlier provides less benefit)
- Hard penalty reduces growth; Easy bonus increases it

### Lapse (Grade = 1)

**Stability Update:**
```
S_new = w₁₁ · D^(-w₁₂) · ((S_prev + 1)^(w₁₃) - 1) · e^(w₁₄·(1-R))
S_final = min(S_prev, S_new)
```

The `min()` ensures stability never increases after forgetting.

---

## Auto-Rating Algorithm

Converts response time to a continuous grade (1.0-4.0).

### Formula

```
ratio = responseTime / averageTime
adjusted_ratio = ratio · difficultyFactor
grade = 5.0 - 4.0 · sigmoid(adjusted_ratio)

where:
  sigmoid(x) = 1 / (1 + e^(-k · (x - 1)))
  k = 2.0 (steepness parameter)
  difficultyFactor = 1.0 - (difficulty - 5.5) / 6
```

### Difficulty Adjustment

The difficulty factor makes grading more lenient for harder cards:

| Difficulty | Factor | Effect |
|------------|--------|--------|
| D = 1 (easiest) | 1.75 | Strictest grading |
| D = 5.5 (average) | 1.0 | Neutral |
| D = 10 (hardest) | 0.25 | Most lenient |

### Grade Mapping

| Response Speed | Sigmoid | Grade | Discrete |
|----------------|---------|-------|----------|
| Much faster (ratio << 1) | ≈ 0.12 | ≈ 4.0 | Easy |
| Average (ratio = 1) | = 0.5 | = 3.0 | Good |
| Slower (ratio > 1) | > 0.5 | < 3.0 | Hard |
| Much slower (ratio >> 1) | ≈ 1.0 | ≈ 1.0 | Again |

### Continuous to Discrete Conversion

```
1.0 - 1.5 → Rating 1 (Again)
1.5 - 2.5 → Rating 2 (Hard)
2.5 - 3.5 → Rating 3 (Good)
3.5 - 4.0 → Rating 4 (Easy)
```

---

## Parameter Reference

### V4.5 Parameters (17 weights)

| Index | Name | Description | Default |
|-------|------|-------------|---------|
| w₀ | Initial Stability (Again) | First review stability for "Again" | 0.4 |
| w₁ | Initial Stability (Hard) | First review stability for "Hard" | 0.6 |
| w₂ | Initial Stability (Good) | First review stability for "Good" | 2.4 |
| w₃ | Initial Stability (Easy) | First review stability for "Easy" | 5.8 |
| w₄ | Initial Difficulty Base | Intercept for initial difficulty | 4.93 |
| w₅ | Initial Difficulty Decay | Coefficient for initial difficulty | 0.94 |
| w₆ | Difficulty Update Factor | Magnitude of difficulty change | 0.86 |
| w₇ | Difficulty Mean Reversion | Rate of return to baseline | 0.01 |
| w₈ | Stability Update Base | Base factor for stability increase | 1.49 |
| w₉ | Stability Update Exp (S) | Current stability exponent | 0.14 |
| w₁₀ | Stability Update Exp (R) | Retrievability exponent | 0.94 |
| w₁₁ | Stability Fail Base | Base factor after lapse | 2.18 |
| w₁₂ | Stability Fail Exp (D) | Difficulty exponent after lapse | 0.05 |
| w₁₃ | Stability Fail Exp (S) | Pre-lapse stability exponent | 0.34 |
| w₁₄ | Stability Fail Exp (R) | Pre-lapse retrievability exponent | 1.26 |
| w₁₅ | Hard Penalty | Stability multiplier for "Hard" | 0.29 |
| w₁₆ | Easy Bonus | Stability multiplier for "Easy" | 2.61 |

### V6 Extensions (Optional)

| Index | Name | Description | Default |
|-------|------|-------------|---------|
| w₁₇-w₁₉ | Same-Day Review | Short-term memory parameters | - |
| w₂₀ | Decay Exponent | Dynamic curve fitting | -0.5 |

**Note:** V6 parameters require optimization on user-specific data to provide benefit.

---

## Performance Benchmarks

Based on the fsrs-benchmark dataset (1.7B reviews from 20K users):

| Algorithm | Log Loss | RMSE | Improvement vs SM-2 |
|-----------|----------|------|---------------------|
| SM-2 (Anki Default) | 0.7317 | 0.4066 | - |
| FSRS v4.5 | 0.3624 | 0.0764 | ~81% |
| FSRS v6 | 0.3460 | 0.0653 | ~84% |

### Key Insights

1. **V4.5 captures 98% of v6's improvement** with 19% fewer parameters
2. **Power-law decay** more accurately models memory than exponential
3. **Trainable parameters** allow optimization on real user data
4. **Decoupled D and S** provide more nuanced memory modeling

### Why V4.5 as Default?

- **Proven defaults:** Works excellently without parameter optimization
- **Simpler:** No same-day review complexity
- **Stable:** Widely deployed with deterministic behavior
- **Sufficient:** 81% improvement over SM-2 covers most use cases

V6 is recommended only for users who:
- Have substantial review history (1000+ reviews)
- Can run the FSRS optimizer
- Need the marginal 2-3% accuracy improvement

---

## References

1. [FSRS Technical Explanation](https://expertium.github.io/Algorithm.html)
2. [fsrs-benchmark Repository](https://github.com/ankitects/fsrs-benchmark)
3. [FSRS for Anki Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki)
4. [Implementing FSRS in 100 Lines](https://borretti.me/article/implementing-fsrs-in-100-lines)
