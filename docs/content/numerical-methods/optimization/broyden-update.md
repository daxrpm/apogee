---
title: Broyden Update
description: Quasi-Newton rank-1 Jacobian updates for efficiency
---

# Broyden Update

The **Broyden update** is a quasi-Newton method that approximates the Jacobian using only function evaluations, avoiding expensive finite-difference recomputation.

!!! note "LaTeX Reference"
    This section corresponds to **Section 8.2.4** of `nm_final_project.tex` (Equation 26).

## The Problem

Computing the Jacobian via finite differences requires $n$ additional function evaluations per iteration.

For our 4-variable problem:
- Each Jacobian: 4 simulations
- 15 iterations: **60+ simulations** just for Jacobians!

This is expensive since each simulation takes ~0.5 seconds.

---

## Step 1: The Secant Condition

### Idea

After a step from $\mathbf{x}_k$ to $\mathbf{x}_{k+1}$, we have new information:

$$
\mathbf{s} = \mathbf{x}_{k+1} - \mathbf{x}_k \quad \text{(step)}
$$
$$
\mathbf{y} = \mathbf{F}_{k+1} - \mathbf{F}_k \quad \text{(residual change)}
$$

### Secant Equation

A good Jacobian approximation should satisfy:

$$
\mathbf{J}_{k+1} \mathbf{s} = \mathbf{y}
$$

This is the **secant condition** - the Jacobian should predict the observed change.

---

## Step 2: Broyden's Formula

### Derivation

We want $\mathbf{J}_{k+1}$ to:

1. Satisfy the secant condition: $\mathbf{J}_{k+1}\mathbf{s} = \mathbf{y}$
2. Change minimally from $\mathbf{J}_k$: minimize $\|\mathbf{J}_{k+1} - \mathbf{J}_k\|_F$

### Solution

The unique solution to this constrained optimization is:

$$
\boxed{\mathbf{J}_{k+1} = \mathbf{J}_k + \frac{(\mathbf{y} - \mathbf{J}_k\mathbf{s})\mathbf{s}^T}{\mathbf{s}^T\mathbf{s}}}
\tag{Eq. 26}
$$

### Interpretation

- **Correction term**: $(\mathbf{y} - \mathbf{J}_k\mathbf{s})$ is the prediction error
- **Direction**: Updates only affect the $\mathbf{s}$ direction
- **Rank-1**: Only changes $\mathbf{J}$ by a rank-1 matrix

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="156"
def _broyden_update(J: np.ndarray, s: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Broyden rank-1 update [Eq. 26]."""
    Js = J @ s
    denominator = s @ s
    
    if denominator < 1e-14:
        return J  # Skip update if step too small
    
    correction = np.outer(y - Js, s) / denominator
    return J + correction
```

---

## Step 3: When to Recompute

### Broyden-Only Strategy

Some implementations never recompute the Jacobian after the initial estimate.

**Risk**: Accumulated errors can cause divergence.

### Hybrid Strategy (Apogee)

Recompute the full Jacobian when:

1. **Every $K$ iterations** (e.g., $K = 5$)
2. **After step rejection**
3. **When $\|\mathbf{J}_k\mathbf{s} - \mathbf{y}\| / \|\mathbf{y}\|$ is large**

---

## Step 4: Complete Update Cycle

After an accepted step:

```python
# 1. Compute step and residual change
s = x_new - x
y = F_new - F

# 2. Update Jacobian with Broyden
J = _broyden_update(J, s, y)

# 3. Log update magnitude
logger.debug(f"Broyden update: ||s||={np.linalg.norm(s):.3e}, ||y||={np.linalg.norm(y):.3e}")
```

---

## Convergence Properties

### Theoretical

!!! info "Theorem (Dennis & Moré, 1974)"
    If the initial Jacobian approximation is sufficiently accurate,
    Broyden's method converges **superlinearly**.

Superlinear: faster than linear, but not quite quadratic.

### Practical Benefit

| Method | Jacobian Evaluations | Total Simulations |
|--------|---------------------|-------------------|
| Full FD every iteration | ~15 × 4 = 60 | ~75 |
| Broyden with recompute | ~3 × 4 = 12 | ~27 |

~2.5× fewer simulations!

---

## Example

### Initial Jacobian (Finite Differences)

$$
\mathbf{J}_0 = \begin{bmatrix}
0.12 & 0.003 & 0.008 & -0.02 \\
0.05 & 0.001 & 0.002 & 0.04 \\
0.08 & -0.002 & 0.001 & 0.03
\end{bmatrix}
$$

### After Step

$$
\mathbf{s} = \begin{bmatrix} 0.1 \\ -0.05 \\ 0.2 \\ 0.01 \end{bmatrix}, \quad
\mathbf{y} = \begin{bmatrix} 0.015 \\ 0.003 \\ 0.008 \end{bmatrix}
$$

### Prediction Error

$$
\mathbf{J}_0\mathbf{s} = \begin{bmatrix} 0.0136 \\ 0.0028 \\ 0.0076 \end{bmatrix}, \quad
\mathbf{y} - \mathbf{J}_0\mathbf{s} = \begin{bmatrix} 0.0014 \\ 0.0002 \\ 0.0004 \end{bmatrix}
$$

### Updated Jacobian

$$
\mathbf{J}_1 = \mathbf{J}_0 + \frac{1}{\|\mathbf{s}\|^2}\begin{bmatrix} 0.0014 \\ 0.0002 \\ 0.0004 \end{bmatrix} \begin{bmatrix} 0.1 & -0.05 & 0.2 & 0.01 \end{bmatrix}
$$

Small corrections that improve accuracy without re-evaluation.

---

## Alternative: Sherman-Morrison

For inverse Jacobian updates (useful in some formulations):

$$
(\mathbf{J} + \mathbf{u}\mathbf{v}^T)^{-1} = \mathbf{J}^{-1} - \frac{\mathbf{J}^{-1}\mathbf{u}\mathbf{v}^T\mathbf{J}^{-1}}{1 + \mathbf{v}^T\mathbf{J}^{-1}\mathbf{u}}
$$

This allows updating $\mathbf{J}^{-1}$ directly without re-solving.

---

## References

1. **Broyden, C.G.** (1965). "A class of methods for solving nonlinear 
   simultaneous equations." *Mathematics of Computation*, 19, 577-593.
   DOI: [10.1090/S0025-5718-1965-0198670-6](https://doi.org/10.1090/S0025-5718-1965-0198670-6)

2. **Dennis, J.E. & Moré, J.J.** (1974). "A characterization of superlinear 
   convergence and its application to quasi-Newton methods." 
   *Mathematics of Computation*, 28, 549-560.

3. **Dennis, J.E. & Schnabel, R.B.** (1996). *Numerical Methods for 
   Unconstrained Optimization and Nonlinear Equations*. SIAM.
   Chapter 8 - "Quasi-Newton Methods".

4. **Nocedal, J. & Wright, S.** (2006). *Numerical Optimization*. Springer.
   Chapter 6 - "Quasi-Newton Methods".

---

## Next Steps

- [Levenberg-Marquardt](levenberg-marquardt.md) - Where Broyden is used
- [Shooting Method](shooting-method.md) - The complete algorithm
