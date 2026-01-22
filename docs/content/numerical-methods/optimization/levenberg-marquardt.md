---
title: Levenberg-Marquardt Algorithm
description: Damped Gauss-Newton method for robust nonlinear optimization
---

# Levenberg-Marquardt Algorithm

The **Levenberg-Marquardt (LM)** algorithm is a hybrid method that combines the reliability of gradient descent with the speed of Gauss-Newton.

!!! note "LaTeX Reference"
    This section corresponds to **Section 8.2** of `nm_final_project.tex` (Equations 24-26).

## Overview

LM solves nonlinear least-squares problems:

$$
\min_{\mathbf{x}} \|\mathbf{F}(\mathbf{x})\|_2^2 = \sum_{i=1}^{m} F_i(\mathbf{x})^2
$$

For our shooting method, $\mathbf{F}$ is the residual vector (3 components) and $\mathbf{x}$ is the control parameters (4 components).

---

## Step 1: The Gauss-Newton Method

### Taylor Expansion

Expand $\mathbf{F}$ to first order:

$$
\mathbf{F}(\mathbf{x} + \Delta\mathbf{x}) \approx \mathbf{F}(\mathbf{x}) + \mathbf{J}\Delta\mathbf{x}
$$

Where $\mathbf{J} = \frac{\partial \mathbf{F}}{\partial \mathbf{x}}$ is the $m \times n$ Jacobian.

### Linearized Least-Squares

Minimize the linear approximation:

$$
\min_{\Delta\mathbf{x}} \|\mathbf{F} + \mathbf{J}\Delta\mathbf{x}\|_2^2
$$

### Normal Equations

Taking the derivative and setting to zero:

$$
\frac{\partial}{\partial\Delta\mathbf{x}}\|\mathbf{F} + \mathbf{J}\Delta\mathbf{x}\|^2 = 2\mathbf{J}^T(\mathbf{F} + \mathbf{J}\Delta\mathbf{x}) = 0
$$

$$
\mathbf{J}^T\mathbf{J}\Delta\mathbf{x} = -\mathbf{J}^T\mathbf{F}
$$

### Problem

When $\mathbf{J}^T\mathbf{J}$ is ill-conditioned or $\mathbf{x}$ is far from the solution, Gauss-Newton steps can be:

- Too large (overshoot)
- In the wrong direction (bad curvature approximation)

---

## Step 2: Damping (Levenberg's Modification)

### The Idea

Add a regularization term to the normal equations:

$$
\boxed{(\mathbf{J}^T\mathbf{J} + \lambda\mathbf{I})\Delta\mathbf{x} = -\mathbf{J}^T\mathbf{F}}
\tag{Eq. 24}
$$

Where $\lambda > 0$ is the **damping parameter**.

### Interpretation

| $\lambda$ | Behavior |
|-----------|----------|
| $\lambda \to 0$ | Pure Gauss-Newton (fast near solution) |
| $\lambda \to \infty$ | Gradient descent: $\Delta\mathbf{x} \approx -\frac{1}{\lambda}\mathbf{J}^T\mathbf{F}$ |

The damping interpolates between the two methods.

### Why It Works

1. **$\mathbf{J}^T\mathbf{J} + \lambda\mathbf{I}$** is always positive definite
2. **Step size decreases** as $\lambda$ increases
3. **Direction approaches** $-\mathbf{J}^T\mathbf{F}$ (steepest descent for least-squares)

---

## Step 3: Adaptive Damping Strategy

### Update Rule

After computing the step $\Delta\mathbf{x}$:

**If step reduces residual** ($\|\mathbf{F}_{\text{new}}\| < \|\mathbf{F}\|$):
$$
\lambda \leftarrow \lambda / 10 \quad \text{(trust Gauss-Newton more)}
$$

**If step increases residual**:
$$
\lambda \leftarrow \lambda \times 10 \quad \text{(be more cautious)}
$$

### Initial Value

$$
\lambda_0 = 10^{-2}
$$

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="200"
def _newton(u0: np.ndarray) -> tuple:
    """Levenberg-Marquardt with line search and Broyden updates."""
    
    lam = 1e-2  # Initial damping
    
    for iteration in range(max_iter):
        # Compute step [Eq. 24]
        JTJ = J.T @ J
        JTF = J.T @ F
        H = JTJ + lam * np.eye(n_x)
        dx = np.linalg.solve(H, -JTF)
        
        # Try step
        x_new = x + dx
        F_new = residuals(x_new)
        
        if np.linalg.norm(F_new) < np.linalg.norm(F):
            x = x_new
            F = F_new
            lam /= 10  # Reduce damping
        else:
            lam *= 10  # Increase damping
```

---

## Step 4: Line Search

Even with damping, full steps may not reduce the residual.

### Backtracking Strategy

Try step lengths $\alpha \in \{1, \frac{1}{2}, \frac{1}{4}, \frac{1}{8}, \ldots\}$:

$$
\mathbf{x}_{\text{new}} = \mathbf{x} + \alpha \cdot \Delta\mathbf{x}
$$

Accept the first $\alpha$ where:

$$
\|\mathbf{F}(\mathbf{x}_{\text{new}})\|_2 < \|\mathbf{F}(\mathbf{x})\|_2
$$

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="220"
# Line search
alpha = 1.0
for _ in range(10):  # Max 10 halvings
    x_trial = x + alpha * dx
    u_trial = _u_from_x(x_trial)
    F_trial, _ = compute_residuals(u_trial, base_config)
    
    if np.linalg.norm(F_trial) < np.linalg.norm(F):
        x = x_trial
        F = F_trial
        break
    
    alpha /= 2
```

---

## Step 5: Computing the Jacobian

### Finite Differences

We approximate $\mathbf{J}$ numerically:

$$
\boxed{J_{ij} \approx \frac{F_i(\mathbf{x} + \Delta x_j \mathbf{e}_j) - F_i(\mathbf{x})}{\Delta x_j}}
\tag{Eq. 25}
$$

Where $\mathbf{e}_j$ is the $j$-th unit vector and $\Delta x_j$ is the step size.

### Step Size Choice

$$
\Delta x_j = \epsilon \cdot \max(1, |x_j|)
$$

Typically $\epsilon = 10^{-7}$.

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="142"
def _fd_jacobian_x(x: np.ndarray, f0: np.ndarray, eval_budget: list[int]) -> np.ndarray:
    """Finite-difference Jacobian in x-space [Eq. 25]."""
    n_x = len(x)
    n_f = len(f0)
    J = np.zeros((n_f, n_x))
    
    eps = 1e-7
    for j in range(n_x):
        dx = np.zeros(n_x)
        dx[j] = eps * max(1.0, abs(x[j]))
        
        u_pert = _u_from_x(x + dx)
        F_pert, _ = compute_residuals(u_pert, base_config)
        
        J[:, j] = (F_pert - f0) / dx[j]
        eval_budget[0] += 1
    
    return J
```

### Cost

Each Jacobian evaluation requires $n$ additional residual evaluations (expensive!).

This motivates [Broyden Updates](broyden-update.md).

---

## Step 6: Convergence Check

### Tolerance

$$
\|\mathbf{F}(\mathbf{x})\|_2 < \text{tol} = 10^{-6}
$$

### Iteration Limits

- Maximum iterations: 30
- Maximum function evaluations: 200

---

## Complete Algorithm

```
Input: Initial guess u₀, tolerance tol, max_iter
Output: Optimal control u*

1. x ← x_from_u(u₀)
2. F ← compute_residuals(u_from_x(x))
3. J ← finite_difference_jacobian(x, F)
4. λ ← 0.01

5. For k = 1, 2, ..., max_iter:
   a. Solve: (JᵀJ + λI)Δx = -JᵀF
   b. Line search for step length α
   c. x_new ← x + α·Δx
   d. F_new ← compute_residuals(u_from_x(x_new))
   
   e. If ||F_new|| < ||F||:
      - Accept step: x ← x_new, F ← F_new
      - Decrease damping: λ ← λ/10
      - Broyden update: J ← J + (F_new - F - J·Δx)·Δxᵀ / (Δxᵀ·Δx)
   f. Else:
      - Reject step
      - Increase damping: λ ← λ×10
   
   g. If ||F|| < tol: CONVERGED

6. Return u* = u_from_x(x)
```

---

## Convergence Properties

### Theoretical

!!! success "Theorem (Moré, 1978)"
    Under standard regularity conditions:
    
    - LM converges **globally** (from any starting point)
    - Near the solution, it converges **quadratically** (like Gauss-Newton)

### Practical (Apogee)

| Metric | Typical Value |
|--------|---------------|
| Iterations to converge | 5-15 |
| Function evaluations | 20-50 |
| Final $\|\mathbf{F}\|$ | $< 10^{-6}$ |

---

## Example Iteration Log

```
INFO - Iter 1: ||F||=2.456e-02, λ=1.0e-02
INFO - Step accepted: α=1.000, ||F||=1.234e-02 (reduced 50%)
INFO - Iter 2: ||F||=1.234e-02, λ=1.0e-03
INFO - Step accepted: α=1.000, ||F||=4.567e-03 (reduced 63%)
...
INFO - Iter 8: ||F||=8.901e-07, λ=1.0e-06
INFO - Converged in 8 iterations, 34 evaluations
```

---

## References

1. **Moré, J.J.** (1978). "The Levenberg-Marquardt Algorithm: Implementation and Theory."
   *Lecture Notes in Mathematics*, 630, 105-116. 
   DOI: [10.1007/BFb0067700](https://doi.org/10.1007/BFb0067700)

2. **Nocedal, J. & Wright, S.** (2006). *Numerical Optimization*. Springer.
   Chapter 10 - "Least-Squares Problems".

3. **Levenberg, K.** (1944). "A method for the solution of certain non-linear 
   problems in least squares." *Quarterly of Applied Mathematics*, 2(2), 164-168.

4. **Marquardt, D.** (1963). "An algorithm for least-squares estimation of 
   nonlinear parameters." *SIAM Journal*, 11(2), 431-441.

---

## Next Steps

- [Broyden Update](broyden-update.md) - Reducing Jacobian computation cost
- [Shooting Method](shooting-method.md) - The complete optimization framework
