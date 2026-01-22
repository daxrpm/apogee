---
title: Theory
description: Mathematical foundations of the Apogee rocket simulator
---

# Theory

This section presents the complete mathematical formulation underlying the Apogee simulator. All equations are derived from first principles and mapped directly to the implementation.

## Overview

The rocket ascent problem combines:

1. **Classical Mechanics** - Newton's laws in rotating reference frames
2. **Atmospheric Physics** - US Standard Atmosphere 1976
3. **Orbital Mechanics** - Two-body Keplerian dynamics
4. **Hybrid Systems** - Event-driven phase transitions

## Core Topics

### [State Vector](state-vector.md)

Definition of the 5-dimensional state space in planar polar coordinates:

$$
\mathbf{y}(t) = \begin{bmatrix} r \\ \lambda \\ v \\ \gamma \\ m \end{bmatrix}
$$

Covers coordinate system choice, physical interpretation, and state initialization.

### [Equations of Motion](equations-of-motion.md)

Complete derivation of the governing ODEs:

$$
\frac{dv}{dt} = \frac{T}{m}\cos\alpha - \frac{D}{m} - \frac{\mu}{r^2}\sin\gamma
$$

Step-by-step derivation from Newton's Second Law in path coordinates.

### [Atmosphere Model](atmosphere.md)

US Standard Atmosphere 1976 implementation:

$$
\rho(h) = \text{Interp}(h, \text{USSA76}_\rho)
$$

Density and speed of sound as functions of altitude.

### [Orbital Mechanics](orbital-mechanics.md)

Two-body orbital diagnostics at engine cutoff:

$$
e = \sqrt{1 + \frac{2\varepsilon h^2}{\mu^2}}
$$

Derivation of specific energy, angular momentum, and Keplerian elements.

### [Flight Phases](flight-phases.md)

Hybrid dynamical system with event-driven transitions:

1. Vertical Ascent → Pitchover
2. Gravity Turn → Stage Separation
3. Coast → Stage 2 Ignition
4. Stage 2 Burn → Orbit Insertion

## Mathematical Conventions

Throughout this documentation:

| Symbol | Meaning | Units |
|--------|---------|-------|
| $r$ | Geocentric radius | m |
| $\lambda$ | Downrange central angle | rad |
| $v$ | Speed magnitude | m/s |
| $\gamma$ | Flight-path angle | rad |
| $m$ | Vehicle mass | kg |
| $T$ | Thrust | N |
| $D$ | Drag force | N |
| $\alpha$ | Steering angle | rad |
| $\mu$ | Earth gravitational parameter | m³/s² |
| $R_E$ | Earth radius | m |

## LaTeX Source

The complete mathematical formulation is available in the LaTeX source file located at `docs/nm_final_project.tex` in the repository root.

All equation numbers in this documentation reference the corresponding equations in the LaTeX report.

