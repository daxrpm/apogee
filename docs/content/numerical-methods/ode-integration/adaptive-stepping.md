---
title: Adaptive Stepping
description: Error control and automatic step size adjustment
---

# Adaptive Stepping

Adaptive step size control ensures accuracy while maximizing efficiency.

## The Problem

Fixed step sizes face a dilemma:

- **Too large**: Accuracy suffers
- **Too small**: Computation wasted

**Solution**: Adjust step size based on local error estimate.

---

## Step 1: Local Error Estimation

### Embedded Methods

Using a $(p, p-1)$ embedded pair (e.g., Tsit5):

$$
\begin{aligned}
\hat{y}_{n+1} &= y_n + h\sum_i b_i k_i \quad (\text{order } p) \\
y_{n+1} &= y_n + h\sum_i \hat{b}_i k_i \quad (\text{order } p-1)
\end{aligned}
$$

### Error Estimate

$$
\text{err} = \|y_{n+1} - \hat{y}_{n+1}\| = h\left\|\sum_i (b_i - \hat{b}_i) k_i\right\|
$$

This estimates the **local truncation error** without extra function evaluations.

---

## Step 2: Error Norm

For systems of equations, we use a **weighted norm**:

$$
\text{err} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \left(\frac{y_i - \hat{y}_i}{\text{sc}_i}\right)^2}
$$

Where the **scale factor** is:

$$
\text{sc}_i = \text{atol} + \text{rtol} \cdot \max(|y_i|, |\hat{y}_i|)
$$

| Parameter | Meaning | Typical Value |
|-----------|---------|---------------|
| `atol` | Absolute tolerance | $10^{-6}$ |
| `rtol` | Relative tolerance | $10^{-6}$ |

---

## Step 3: Step Size Control

### Accept/Reject Decision

$$
\text{If } \text{err} \leq 1: \quad \text{Accept step, advance } t \to t + h
$$

$$
\text{If } \text{err} > 1: \quad \text{Reject step, retry with smaller } h
$$

### Optimal Step Size

The "optimal" next step size:

$$
h_{\text{new}} = h \cdot \left(\frac{1}{\text{err}}\right)^{1/(p+1)}
$$

Where $p$ is the order of the lower-order formula.

---

## Step 4: Safety Factors

### Practical Formula

$$
h_{\text{new}} = h \cdot \min\left(\text{fac}_{\max}, \max\left(\text{fac}_{\min}, \text{fac} \cdot \left(\frac{1}{\text{err}}\right)^{1/(p+1)}\right)\right)
$$

| Factor | Value | Purpose |
|--------|-------|---------|
| `fac` | 0.9 | Safety margin |
| `fac_min` | 0.2 | Prevent drastic decrease |
| `fac_max` | 10.0 | Prevent drastic increase |

---

## Step 5: PID Controller

The Apogee simulator uses a **PID controller** for smoother step adaptation.

### The Idea

Instead of using only the current error, we incorporate history:

$$
h_{\text{new}} = h \cdot \text{err}_n^{-\beta_1} \cdot \text{err}_{n-1}^{\beta_2} \cdot \text{err}_{n-2}^{-\beta_3}
$$

### Gains

For Tsit5 (order 5):

$$
\beta_1 = \frac{1}{5 \cdot 0.7}, \quad \beta_2 = 0, \quad \beta_3 = 0
$$

**Implementation:**

```python title="apogee_physics/simulate.py"
stepsize_controller = diffrax.PIDController(rtol=1e-6, atol=1e-6)
```

---

## Configuration in Apogee

### Default Parameters

```python title="apogee_physics/types.py" linenums="48"
@dataclass(frozen=True, slots=True)
class NumericsParams:
    # ...
    dt0: float        # Initial step size [s]
    rtol: float       # Relative tolerance
    atol: float       # Absolute tolerance
    # ...
```

### Typical Values

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `dt0` | 0.5 s | Initial step size |
| `rtol` | $10^{-6}$ | Relative tolerance |
| `atol` | $10^{-6}$ | Absolute tolerance |
| `max_steps` | 100,000 | Safety limit |

---

## Step Size Evolution

During a typical Falcon 9 simulation:

| Phase | Typical Step Size |
|-------|-------------------|
| Liftoff | ~0.1 s (rapid changes) |
| Max-Q | ~0.5 s |
| Coast | ~5-10 s (slow dynamics) |
| Final burn | ~1 s |

The solver automatically adapts to the dynamics.

---

## References

1. **Hairer, E., Nørsett, S.P., & Wanner, G.** (1993). 
   *Solving Ordinary Differential Equations I*. Springer. Chapter II.4.

2. **Söderlind, G.** (2002). "Automatic control and adaptive time-stepping."
   *Numerical Algorithms*, 31, 281-310.

3. **Diffrax Documentation**: [Step Size Controllers](https://docs.kidger.site/diffrax/api/stepsize_controller/)

---

## Next Steps

- [Shooting Method](../optimization/shooting-method.md) - Using ODE solvers for optimization
- [Singularity Guards](../stability/singularity-guards.md) - Numerical stability
