---
title: apogee-physics
description: Core numerical engine for rocket dynamics
---

# apogee-physics

The core physics engine implementing all equations of motion and optimization.

## Installation

```bash
uv sync --package apogee-physics
```

## Dependencies

```toml
dependencies = [
    "jax",       # Automatic differentiation
    "diffrax",   # ODE solvers
    "ussa1976",  # Atmosphere model
]
```

## Modules

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| [dynamics](dynamics.md) | Equations of motion | `rhs_general`, `compute_derived` |
| [atmosphere](atmosphere.md) | USSA76 model | `AtmosphereTable`, `build_atmosphere_table` |
| [simulate](simulate.md) | Hybrid simulation | `simulate_ascent` |
| [shooting](shooting.md) | Optimization | `solve_circular_orbit` |
| [orbit](orbit.md) | Orbital diagnostics | `orbit_diagnostics` |

## Architecture

```
apogee_physics/
├── __init__.py
├── atmosphere.py    # USSA76 interpolation
├── dynamics.py      # ODE right-hand sides
├── simulate.py      # Hybrid system integration
├── shooting.py      # Levenberg-Marquardt solver
├── orbit.py         # Keplerian elements
├── trajectory.py    # Data serialization
├── types.py         # Dataclass definitions
└── calibration.py   # Drag models
```

## Basic Usage

```python
from apogee_physics import (
    AscentConfig,
    EarthParams,
    MissionParams,
    VehicleParams,
    NumericsParams,
    simulate_ascent,
    solve_circular_orbit,
)

# Configure simulation
config = AscentConfig(
    earth=EarthParams(r_e=6.371e6, mu=3.986e14, g0=9.80665),
    mission=MissionParams(h_target=200_000, payload_mass=5000),
    vehicle=vehicle_params,
    numerics=numerics_params,
)

# Run simulation
trajectory = simulate_ascent(config)
```

## Equation References

| Module | Equations |
|--------|-----------|
| dynamics.py | Eq. 5-14 (EOM + regularization) |
| atmosphere.py | Eq. 15-16 (USSA76, drag) |
| orbit.py | Eq. 18-21 (orbital elements) |
| shooting.py | Eq. 22-26 (residuals, LM) |
