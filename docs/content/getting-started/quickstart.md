---
title: Quick Start
description: Your first launch simulation in 5 minutes
---

# Quick Start

This guide walks you through running your first launch simulation.

## The Problem

We want to launch a Falcon 9 rocket to a **circular orbit** at altitude $h_{target}$ with payload mass $m_{payload}$.

The challenge: find the optimal control parameters:

- $\theta_0$: Pitch-over angle after vertical ascent
- $t_{coast}$: Coast duration between stages
- $t_{burn2}$: Second stage burn time
- $\alpha_2$: Second stage steering angle

## Running a Simulation

### Basic Launch

```bash
uv run apogee-launch --h-target-km 200 --payload-kg 5000
```

### Verify GPU Execution (JAX)

Run with `--verbose` to print the active backend and devices:

```bash
uv run apogee-launch --h-target-km 200 --payload-kg 5000 --verbose --no-trajectory
```

You should see lines like:

```text
JAX backend: gpu
JAX devices: [CudaDevice(id=0), ...]
```

To observe utilization during the run:

```bash
watch -n 0.5 nvidia-smi
```

This outputs:

```json
{
  "schema_version": 1,
  "inputs": {
    "h_target_km": 200.0,
    "payload_kg": 5000.0
  },
  "optimal_numerics": {
    "theta0_rad": 0.1547,
    "t_coast_s": 5.28,
    "t_burn2_s": 351.42,
    "alpha2_rad": 0.1132
  },
  "summary": {
    "ecc": 0.000498,
    "h_err_m": -1644.6,
    "v_err_mps": 1.83,
    "gamma_deg": -0.026
  }
}
```

### Understanding the Output

| Field | Meaning | Good Value |
|-------|---------|------------|
| `ecc` | Orbital eccentricity | < 0.001 (circular) |
| `h_err_m` | Altitude error from target | < 2000 m |
| `v_err_mps` | Velocity error | < 5 m/s |
| `gamma_deg` | Flight-path angle at insertion | ~0° (horizontal) |

!!! success "Circular Orbit Achieved"
    Eccentricity of 0.0005 means the orbit is nearly perfectly circular!

## With Trajectory Data

To get the full flight path:

```bash
uv run apogee-launch --h-target-km 200 --payload-kg 5000 > result.json
```

The trajectory includes time series for:

- `t_s`: Time [s]
- `h_m`: Altitude [m]
- `v_mps`: Velocity [m/s]
- `gamma_rad`: Flight-path angle [rad]
- `m_kg`: Mass [kg]
- `pos_m`: 3D position `{x, y, z}`

## Generate Plots

```bash
uv run apogee-launch --h-target-km 200 --payload-kg 5000 --plot
```

This creates visualization plots in the `plots/` directory:

- `trajectory.png` - 2D trajectory with Earth
- `time.png` - Time series plots
- `comprehensive.png` - 6-panel overview

## Python API

```python
from apogee_launch import solve_to_circular_orbit

result = solve_to_circular_orbit(
    h_target_km=200,
    payload_kg=5000,
    include_trajectory=True,
)

# Access results
print(f"Eccentricity: {result.summary['ecc']:.6f}")
print(f"Coast time: {result.optimal_numerics['t_coast_s']:.1f} s")

# Plot trajectory
import matplotlib.pyplot as plt
traj = result.trajectory
plt.plot(traj['t_s'], [h/1000 for h in traj['h_m']])
plt.xlabel('Time [s]')
plt.ylabel('Altitude [km]')
plt.show()
```

## Varying Parameters

### Different Altitudes

```bash
# Low orbit (ISS altitude)
uv run apogee-launch --h-target-km 400 --payload-kg 5000

# Minimum insertion altitude
uv run apogee-launch --h-target-km 160 --payload-kg 5000
```

### Payload Sweep

```python
from apogee_launch import solve_to_circular_orbit

for payload in [0, 2500, 5000, 7500, 10000]:
    result = solve_to_circular_orbit(h_target_km=200, payload_kg=payload)
    print(f"Payload: {payload} kg, ecc: {result.summary['ecc']:.4f}")
```

## What's Happening Inside?

The simulator performs these steps:

1. **Vertical Ascent** - Rocket climbs until pitchover altitude
2. **Pitchover** - Instantaneous tilt by $\theta_0$ degrees
3. **Gravity Turn** - Stage 1 burns with thrust along velocity
4. **Stage Separation** - Drop stage 1 dry mass
5. **Coast** - Ballistic flight for $t_{coast}$ seconds
6. **Stage 2 Burn** - Burn at steering angle $\alpha_2$
7. **Orbit Insertion** - Achieve target circular orbit

The **shooting method** iteratively adjusts the control parameters until the orbit is circular.

## Next Steps

- [Theory → State Vector](../theory/state-vector.md) - Mathematical foundations
- [Numerical Methods](../numerical-methods/index.md) - How the solver works
- [Package Reference](../packages/index.md) - API documentation
