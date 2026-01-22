---
title: Singularity Guards
description: Regularization techniques for 1/v and 1/r singularities
---

# Singularity Guards

The equations of motion contain singular terms that require careful handling.

!!! note "LaTeX Reference"
    This section corresponds to **Section 3.5** of `nm_final_project.tex` (Equations 12-13).

## The $1/v$ Singularity

### Problem

At liftoff, velocity is zero: $v(0) = 0$.

The flight-path angle equation contains:

$$
\frac{T}{mv}\sin\alpha \quad \text{and} \quad \frac{\mu}{r^2 v}
$$

Both terms $\to \infty$ as $v \to 0$.

### Solution: Regularized Inverse

Replace $1/v$ with a smooth approximation:

$$
\boxed{\left(\frac{1}{v}\right)_{\text{reg}} = \frac{v}{v^2 + v_\epsilon^2}}
\tag{Eq. 12}
$$

### Properties

**Asymptotic behavior:**

$$
\lim_{v \to \infty} \frac{v}{v^2 + v_\epsilon^2} = \frac{1}{v}
$$

**At zero:**

$$
\lim_{v \to 0} \frac{v}{v^2 + v_\epsilon^2} = 0
$$

**At $v = v_\epsilon$:**

$$
\frac{v_\epsilon}{v_\epsilon^2 + v_\epsilon^2} = \frac{1}{2v_\epsilon}
$$

### Choice of $v_\epsilon$

$$
v_\epsilon = 1.0 \text{ m/s}
$$

This is small enough to not affect the physics ($v > 100$ m/s for most of flight) but large enough to provide stability at liftoff.

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="76"
# Guard the 1/v terms near v -> 0 to avoid numerical singularity.
# For v >> v_eps this is exactly the standard equation.
# [Eq. 12] Regularized inverse velocity
inv_v = v / (v * v + v_eps * v_eps)
```

---

## The $1/r$ Singularity

### Problem

If numerical error pushes $r < R_E$ (rocket underground), terms like $\mu/r^2$ explode.

### Solution: Safe Radius

$$
\boxed{r_{\text{safe}} = \max(r, 0.99 \cdot R_E)}
\tag{Eq. 13}
$$

### Implementation

```python title="apogee_physics/dynamics.py" linenums="66"
# Guard r to avoid singularity at r=0 [Eq. 13]
r_safe = jnp.maximum(r, earth.r_e * 0.99)
```

### Event Detection

Additionally, ground impact is detected as a termination event:

```python title="apogee_physics/simulate.py" linenums="30"
def _cond_ground(t, y, args, **kwargs):
    """Event: ground impact (failure)."""
    return y[_R] - args["earth"].r_e
```

---

## Time Monotonicity

### Problem

Adaptive ODE solvers with event detection can produce non-monotonic time samples:

- Step rejected and retried
- Event interpolation
- Floating-point accumulation

### Solution: Filtering

```python title="apogee_physics/simulate.py" linenums="111"
def _strictly_increasing_mask(ts: Array) -> Array:
    """Create mask for strictly increasing time samples."""
    n = len(ts)
    mask = np.ones(n, dtype=bool)
    last_t = -np.inf
    
    for i in range(n):
        if ts[i] > last_t:
            last_t = ts[i]
        else:
            mask[i] = False
    
    return mask
```

Apply mask to all trajectory arrays.

---

## Summary

| Issue | Solution | Implementation |
|-------|----------|----------------|
| $1/v$ at liftoff | Regularized inverse | `dynamics.py:77` |
| $1/r$ underground | Safe radius clamp | `dynamics.py:66` |
| Ground impact | Event detection | `simulate.py:30` |
| Non-monotonic time | Filtering mask | `simulate.py:111` |

---

## References

1. **Hairer, E. et al.** (1993). *Solving ODEs I*. Springer.
   Section II.8 - "Numerical Difficulties".

2. **Ascher, U.M. & Petzold, L.R.** (1998). *Computer Methods for ODEs and DAEs*.
   SIAM. Chapter 3 - "Basic Methods".
