---
title: Shooting Method
description: Converting the orbital insertion problem to root-finding
---

# Shooting Method

The shooting method transforms the **boundary value problem** of orbital insertion into a sequence of **initial value problems**.

!!! note "LaTeX Reference"
    This section corresponds to **Section 8.1** of `nm_final_project.tex` (Equations 22-23).

## The Problem

### Boundary Conditions

We want the rocket to end up in a specific orbit:

**Initial conditions** (known):
$$
\mathbf{y}(0) = \begin{bmatrix} R_E \\ 0 \\ 0 \\ \pi/2 \\ m_0 \end{bmatrix}
$$

**Terminal conditions** (desired):
$$
\begin{aligned}
a &= R_E + h_{\text{target}} \quad \text{(target altitude)} \\
e &= 0 \quad \text{(circular)} \\
\gamma &= 0 \quad \text{(horizontal)}
\end{aligned}
$$

### The Control Vector

The trajectory is determined by four control parameters:

$$
\boxed{\mathbf{u} = \begin{bmatrix} \theta_0 \\ t_{\text{coast}} \\ t_{\text{burn2}} \\ \alpha_2 \end{bmatrix}}
$$

| Variable | Description | Typical Range |
|----------|-------------|---------------|
| $\theta_0$ | Pitchover angle | 5° - 12° |
| $t_{\text{coast}}$ | Coast duration | 0 - 200 s |
| $t_{\text{burn2}}$ | Stage 2 burn time | 50 - 450 s |
| $\alpha_2$ | Stage 2 steering | -5° - 10° |

---

## Step 1: Forward Simulation

Given a control vector $\mathbf{u}$:

1. Set initial conditions $\mathbf{y}_0$
2. Integrate the equations of motion through all phases
3. Extract terminal state $\mathbf{y}_f$
4. Compute orbital elements $a, e, \gamma$

This is a **single shooting** approach - one simulation from $t_0$ to $t_f$.

---

## Step 2: Residual Function

Define the **residual vector** that measures deviation from desired orbit:

$$
\boxed{
\mathbf{F}(\mathbf{u}) = \begin{bmatrix}
\frac{a(\mathbf{u}) - r_{\text{target}}}{r_{\text{target}}} \\[4pt]
e(\mathbf{u}) \\[4pt]
\gamma(\mathbf{u})
\end{bmatrix}
}
\tag{Eq. 22}
$$

### Design Choices

1. **Normalized altitude error**: Dividing by $r_{\text{target}}$ makes the residual dimensionless
2. **Eccentricity directly**: Already on [0, 1] scale
3. **Flight-path angle**: In radians, small for circular insertion

### Goal

Find $\mathbf{u}^*$ such that:

$$
\mathbf{F}(\mathbf{u}^*) \approx \mathbf{0}
$$

This is a **nonlinear root-finding problem**.

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="21"
def compute_residuals(u: np.ndarray, base_config: AscentConfig):
    """Compute shooting residuals per LaTeX Report (Section 8.1).
    
    Decision Variables u: [theta0, t_coast, t_burn2, alpha2]
    Residuals F(u): [Eq. 22]
      1. (a - r_target) / r_target
      2. eccentricity
      3. flight-path angle gamma
    """
    # Unpack control vector
    theta0, t_coast, t_burn2, alpha2 = u
    
    # Build configuration
    config = replace_numerics(base_config, theta0, t_coast, t_burn2, alpha2)
    
    # Run simulation
    trajectory = simulate_ascent_final(config)
    
    # Extract orbital elements
    eps, h_ang, a, e, r_apo, r_peri = orbit_diagnostics(y=trajectory.y_final, earth=config.earth)
    
    # Compute residuals [Eq. 22]
    r_target = config.earth.r_e + config.mission.h_target
    F = np.array([
        (a - r_target) / r_target,  # Normalized altitude error
        e,                           # Eccentricity
        trajectory.y_final[3]        # Flight-path angle gamma
    ])
    
    return F, trajectory
```

---

## Step 3: Bounded Re-parameterization

### The Problem

Physical constraints require:

$$
\theta_0 \in [\theta_{\min}, \theta_{\max}], \quad
t_{\text{coast}} \in [0, 200], \quad \text{etc.}
$$

Standard Newton methods work in $\mathbb{R}^n$, not bounded domains.

### Solution: Logistic Transform

Introduce **unbounded variables** $\mathbf{x} \in \mathbb{R}^4$:

$$
\boxed{u_i = u_{i,\min} + (u_{i,\max} - u_{i,\min}) \cdot \sigma(x_i)}
\tag{Eq. 23}
$$

Where $\sigma(x)$ is the **logistic function**:

$$
\sigma(x) = \frac{1}{1 + e^{-x}}
$$

### Properties

| $x$ | $\sigma(x)$ | $u$ |
|-----|-------------|-----|
| $-\infty$ | 0 | $u_{\min}$ |
| 0 | 0.5 | midpoint |
| $+\infty$ | 1 | $u_{\max}$ |

The optimizer works with $\mathbf{x}$, automatically satisfying bounds.

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="122"
def _u_from_x(x: np.ndarray) -> np.ndarray:
    """Logistic re-parameterization from unbounded x to bounded u [Eq. 23]."""
    sig = 1.0 / (1.0 + np.exp(-x))
    return lo + (hi - lo) * sig

def _x_from_u(u: np.ndarray) -> np.ndarray:
    """Inverse logistic transform [Eq. 23 inverse]."""
    frac = (u - lo) / (hi - lo)
    frac = np.clip(frac, 1e-9, 1 - 1e-9)  # Avoid log(0)
    return np.log(frac / (1 - frac))
```

---

## Step 4: Newton's Method (Conceptual)

For root-finding $\mathbf{F}(\mathbf{x}) = \mathbf{0}$, Newton's method:

$$
\mathbf{x}_{k+1} = \mathbf{x}_k - \mathbf{J}^{-1} \mathbf{F}(\mathbf{x}_k)
$$

Where $\mathbf{J} = \partial\mathbf{F}/\partial\mathbf{x}$ is the Jacobian.

### Problem: 4 Unknowns, 3 Equations

Our system is **overdetermined** in the sense of Newton (4 unknowns, 3 equations).

We use [Levenberg-Marquardt](levenberg-marquardt.md) to handle this.

---

## Step 5: Multistart Strategy

### The Problem

Nonlinear solvers need a good initial guess. Bad guesses lead to:

- Non-convergence
- Local minima
- Physical impossibilities (ground impact, fuel depletion)

### Solution: Brute-Force Candidate Search

1. Generate a grid of candidate $\mathbf{u}_0$ values
2. Simulate each candidate (fast, one forward pass)
3. Score by $\|\mathbf{F}(\mathbf{u}_0)\|$
4. Select best candidates for Newton refinement

**Implementation:**

```python title="apogee_physics/shooting.py" linenums="280"
# Grid over control space
theta0_grid = np.linspace(theta0_lo, theta0_hi, 11)
t_coast_grid = np.linspace(0, 100, 11)
t_burn2_grid = np.linspace(100, 400, 11)
alpha2_grid = np.linspace(alpha2_lo, alpha2_hi, 7)

# Evaluate all candidates
candidates = []
for theta0 in theta0_grid:
    for t_coast in t_coast_grid:
        for t_burn2 in t_burn2_grid:
            for alpha2 in alpha2_grid:
                u = np.array([theta0, t_coast, t_burn2, alpha2])
                try:
                    F, _ = compute_residuals(u, base_config)
                    if is_feasible(F):
                        candidates.append((np.linalg.norm(F), u))
                except:
                    pass

# Sort and select best
candidates.sort(key=lambda x: x[0])
```

---

## Algorithm Summary

```
Input: h_target, payload
Output: Optimal control u*, trajectory

1. MULTISTART:
   - Generate grid of initial guesses
   - Evaluate residuals for each
   - Select K best feasible candidates

2. For each candidate u_0:
   a. Transform: x_0 = x_from_u(u_0)
   b. NEWTON ITERATION:
      - Compute Jacobian J (finite differences)
      - Repeat until converged:
        * u = u_from_x(x)
        * F = compute_residuals(u)
        * If ||F|| < tol: CONVERGED
        * dx = LM_step(J, F)
        * Line search for step length α
        * x ← x + α·dx
        * Broyden update of J
   c. If converged: RETURN u*

3. If no candidate converged: FAILURE
```

---

## Convergence Criteria

### Success

$$
\|\mathbf{F}(\mathbf{u})\|_2 < \text{tol} = 10^{-6}
$$

### Typical Residual Values at Convergence

| Component | Value | Meaning |
|-----------|-------|---------|
| $\|F_1\|$ | ~$10^{-4}$ | Altitude error ~700m |
| $\|F_2\|$ | ~$10^{-4}$ | Eccentricity ~0.0001 |
| $\|F_3\|$ | ~$10^{-4}$ | FPA ~0.006° |

---

## References

1. **Stoer, J. & Bulirsch, R.** (2002). *Introduction to Numerical Analysis*. 
   Springer. Chapter 7 - "Topics in the Numerical Treatment of Ordinary 
   Differential Equations", §7.3 "Boundary Value Problems".

2. **Ascher, U.M. & Petzold, L.R.** (1998). *Computer Methods for Ordinary 
   Differential Equations and Differential-Algebraic Equations*. SIAM. Chapter 4.

3. **Betts, J.T.** (2010). *Practical Methods for Optimal Control and Estimation 
   Using Nonlinear Programming*. SIAM.

---

## Next Steps

- [Levenberg-Marquardt](levenberg-marquardt.md) - The optimization algorithm
- [Broyden Update](broyden-update.md) - Jacobian approximation
