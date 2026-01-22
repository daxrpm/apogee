---
title: shooting
description: Levenberg-Marquardt optimizer for orbital insertion
---

# shooting

Implements the shooting method with Levenberg-Marquardt optimization.

## Functions

### `compute_residuals`

Evaluate the shooting residual function.

```python
def compute_residuals(
    u: np.ndarray, 
    base_config: AscentConfig
) -> tuple[np.ndarray, Trajectory]:
```

**Control vector** $\mathbf{u}$:
1. $\theta_0$ - Pitchover angle [rad]
2. $t_{\text{coast}}$ - Coast duration [s]
3. $t_{\text{burn2}}$ - Stage 2 burn time [s]
4. $\alpha_2$ - Stage 2 steering [rad]

**Residual vector** $\mathbf{F}$ (Eq. 22):
1. $(a - r_{\text{target}}) / r_{\text{target}}$
2. $e$ (eccentricity)
3. $\gamma$ (flight-path angle)

### `solve_circular_orbit`

Main optimization function.

```python
def solve_circular_orbit(
    base_config: AscentConfig
) -> tuple[np.ndarray, Trajectory]:
```

**Algorithm:**

1. Multistart candidate generation
2. Newton iteration with LM damping
3. Line search
4. Broyden Jacobian updates

**Returns:** `(optimal_u, trajectory)`

## Internal Functions

### `_u_from_x` / `_x_from_u`

Logistic transform for bounded optimization (Eq. 23).

$$
u_i = u_{\min} + (u_{\max} - u_{\min}) \cdot \sigma(x_i)
$$

### `_fd_jacobian_x`

Finite-difference Jacobian approximation (Eq. 25).

### `_broyden_update`

Rank-1 Jacobian update (Eq. 26).

### `_newton`

Main Newton iteration with LM and line search.

## Equation Reference

| Equation | Description | Function |
|----------|-------------|----------|
| Eq. 22 | Residual definition | `compute_residuals` |
| Eq. 23 | Logistic transform | `_u_from_x` |
| Eq. 24 | LM normal equations | `_newton` |
| Eq. 25 | FD Jacobian | `_fd_jacobian_x` |
| Eq. 26 | Broyden update | `_broyden_update` |
