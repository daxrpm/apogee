---
title: Optimization Methods
description: Overview of trajectory optimization algorithms
---

# Optimization Methods

The **shooting method** converts the orbital insertion problem into a nonlinear least-squares problem.

!!! note "LaTeX Reference"
    This section corresponds to **Section 8** of `nm_final_project.tex`.

## The Challenge

We want to find control parameters that achieve a circular orbit:

$$
\text{Find } \mathbf{u} = [\theta_0, t_{\text{coast}}, t_{\text{burn2}}, \alpha_2]^T
$$

Such that the final orbit is:

- At target altitude: $a = R_E + h_{\text{target}}$
- Circular: $e = 0$
- Horizontal insertion: $\gamma = 0$

## Topics

- [Shooting Method](shooting-method.md) - Problem formulation
- [Levenberg-Marquardt](levenberg-marquardt.md) - Optimization algorithm
- [Broyden Update](broyden-update.md) - Jacobian acceleration

## Algorithm Overview

```mermaid
graph TD
    A[Initial Guess u₀] --> B[Simulate Trajectory]
    B --> C[Compute Orbital Elements]
    C --> D[Evaluate Residuals F(u)]
    D --> E{||F|| < tol?}
    E -->|Yes| F[Converged!]
    E -->|No| G[Compute Jacobian J]
    G --> H[LM Step: Δu]
    H --> I[Line Search]
    I --> J[u ← u + α·Δu]
    J --> K[Broyden Update J]
    K --> B
```

## Mathematical Formulation

See [Shooting Method](shooting-method.md) for the complete derivation of:

$$
\mathbf{F}(\mathbf{u}) = \begin{bmatrix}
\frac{a(\mathbf{u}) - r_{\text{target}}}{r_{\text{target}}} \\
e(\mathbf{u}) \\
\gamma(\mathbf{u})
\end{bmatrix} \approx \mathbf{0}
$$
