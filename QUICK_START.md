# Quick Start Guide

## Installation

```bash
cd /home/daxrpm/Desktop/EPN/metodos_numericos/apogee
# Dependencies already installed via uv
```

## Run the Simulator

```bash
# Production simulator (recommended)
python scripts/production_simulator.py

# Verify solution quality
python scripts/verify_solution.py

# Find parameters for different altitudes
python scripts/find_working_params.py
```

## Python API

```python
from scripts.production_simulator import simulate_falcon9_to_orbit

# Simulate to 200 km orbit
config, traj = simulate_falcon9_to_orbit(h_target=200_000)

# Extract data
import numpy as np
t = np.array(traj.t)
h = np.array(traj.h) / 1000  # Altitude in km
v = np.array(traj.v)         # Velocity in m/s

# Filter valid points
mask = np.isfinite(t)
t_valid = t[mask]
h_valid = h[mask]
v_valid = v[mask]

print(f"Final altitude: {h_valid[-1]:.1f} km")
print(f"Final velocity: {v_valid[-1]:.1f} m/s")
print(f"Eccentricity: {float(traj.orbit.eccentricity):.6f}")
```

## Expected Output

```
=== Falcon 9 Ascent Simulator ===
Target altitude: 200.0 km
Payload mass: 0.0 kg

Vehicle configuration:
  Gross mass: 549054 kg
  Stage 1 burn: 146.4 s
  Stage 1 propellant: 406935 kg
  Stage 2 propellant: 114119 kg

Guidance parameters:
  Pitch-over angle: 8.0°
  Coast duration: 50.0 s
  Stage 2 burn: 240.0 s

Running simulation...

Final state:
  Time: 447.2 s
  Altitude: 222.422 km (target: 200 km)
  Velocity: 7799.4 m/s (target: 7788.5 m/s)
  FPA: -0.7804° (target: 0°)
  Final mass: 21230.4 kg

Orbit quality:
  Radius error: 0.3412%
  Velocity error: 0.1406%
  FPA error: 0.7804°
  Eccentricity: 0.014979

✓✓ GOOD: Orbit is nearly circular
```

## Troubleshooting

**Issue:** Import errors
**Solution:** Make sure you're in the project directory and uv environment is active

**Issue:** Simulation takes too long
**Solution:** Reduce `max_steps` in NumericsParams or use coarser atmosphere grid

**Issue:** Orbit not circular
**Solution:** Adjust guidance parameters (theta0, t_coast, t_burn2) or use lower altitude

## Next Steps

1. Run `production_simulator.py` to see it working
2. Modify `h_target` to test different altitudes
3. Extract trajectory data for visualization
4. Build your frontend using the trajectory arrays
