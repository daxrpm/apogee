---
title: apogee-orbit
description: Orbital mechanics and yaw steering
---

# apogee-orbit

Orbital propagation and attitude control for solar panel optimization.

## Installation

```bash
uv sync --package apogee-orbit
```

## CLI Usage

```bash
# Full simulation (launch + orbit)
uv run apogee-orbit --h-target-km 200 --payload-kg 5000

# With plots
uv run apogee-orbit --h-target-km 200 --payload-kg 5000 --plot

# Standalone (skip launch)
uv run apogee-orbit --r-m 6570000 --nu-initial-deg 15 --plot
```

## Python API

```python
from apogee_orbit import calculate_orbit_yaw

result = calculate_orbit_yaw(
    h_target_km=200,
    payload_kg=5000,
    sun_vector=(1, 0, 0),
)

print(f"Period: {result.orbit_params['period_s']:.0f} s")
```

## Modules

| Module | Purpose |
|--------|---------|
| [core](core.md) | EquatorialOrbit class |
| [attitude](attitude.md) | Yaw steering algorithm |
| simulator | Full orbit simulation |
| plotting | 3D visualization |

## Key Concepts

### Yaw Steering Law

Rotates satellite about nadir axis to keep sun in body X-Z plane:

$$
\psi = \arctan2(s_{y,\text{local}}, s_{x,\text{local}})
$$

### LVLH Frame

- **Z (Nadir)**: Points to Earth center
- **X (Velocity)**: Along velocity vector
- **Y (Cross-track)**: Completes right-hand system
