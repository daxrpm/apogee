# Apogee

Apogee is a **two-stage rocket ascent simulator** with a robust **shooting method** that converges to a near-circular LEO orbit for target altitudes in the **160–400 km** range and payloads up to **10,000 kg**.

The implementation is designed to be:

- **Mathematically explicit** (state, forces, events, orbital diagnostics).
- **Numerically strict** (adaptive RK + event root-finding; bounded shooting variables; robust failure modes).
- **Backend/frontend-ready** (JSON-serializable trajectory for FastAPI + Three.js).
- **Modular architecture** (physics engine, launch simulator, orbital mechanics, REST API).

## Repository layout

```text
apogee/
├── packages/
│   ├── apogee-physics/         # Physics engine (JAX/Diffrax)
│   │   └── src/apogee_physics/
│   │       ├── atmosphere.py   # USSA76 table + interpolation
│   │       ├── dynamics.py     # ODE RHS and derived quantities
│   │       ├── simulate.py     # Hybrid simulation + events (Diffrax)
│   │       ├── orbit.py        # Two-body orbit diagnostics
│   │       ├── shooting.py     # LM+Broyden shooting solver
│   │       ├── trajectory.py   # Trajectory dataclass + JSON serializer
│   │       ├── types.py        # Dataclasses (Earth/Mission/Vehicle/Numerics)
│   │       └── calibration.py  # Optional offline calibration (SciPy)
│   │
│   ├── apogee-launch/          # Launch simulator + CLI
│   │   └── src/apogee_launch/
│   │       ├── simulator.py    # High-level launch API
│   │       ├── falcon9.py      # Falcon 9 default parameters
│   │       └── cli.py          # CLI with typer
│   │
│   ├── apogee-orbit/           # Orbital mechanics (future)
│   │   └── src/apogee_orbit/
│   │       └── (propagator, solar, attitude)
│   │
│   └── apogee-api/             # FastAPI backend
│       └── src/apogee_api/
│           ├── main.py         # FastAPI app
│           ├── routers/        # Endpoints (launch, orbit, health)
│           └── schemas/        # Pydantic models
│
└── docs/
    ├── nm_final_project.tex    # Full math report (code-consistent)
    └── nm_final_project.pdf
```

## Mathematical model (high level)

State:

- `y(t) = [r, lambda, v, gamma, m]`

Key physics:

- **Central gravity**: `mu / r^2`
- **Drag**: `D = 0.5 * rho(h) * Cd(M) * A_ref * v^2`
- **Mass flow**: `dm/dt = -T / (Isp * g0)`
- **Atmosphere**: US Standard Atmosphere 1976 via `ussa1976`

Hybrid phases and events:

- Vertical ascent → pitch-over (altitude event)
- Stage-1 gravity turn (burnout mass event) → separation (mass drop)
- Coast (T=0)
- Stage-2 burn with constant steering `alpha2` (fuel depletion + ground events)

Full derivations and a strict mapping **equation ↔ code** are in:

- `docs/nm_final_project.pdf`

## Shooting solver (what it solves)

Decision variables:

- `u = (theta0, t_coast, t_burn2, alpha2)`

Residual (computed at the terminal state):

- `(a - r_target)/r_target` (semi-major axis target)
- `e` (eccentricity)
- `gamma` (flight-path angle)

Numerical method:

- Tsit5 ODE integration (Diffrax) + event root-finding (Optimistix Newton)
- Levenberg–Marquardt-type step on normal equations
- Finite-difference Jacobian in unconstrained variables (logistic mapping to bounds)
- Broyden update + backtracking line search

## Install

Install all packages using uv workspace:

```bash
uv sync
```

This installs all packages in editable mode with proper dependency resolution.

## Usage

### CLI: Launch Simulator

Run single launch simulation:

```bash
# With full trajectory
uv run apogee-launch --h-target-km 213 --payload-kg 4082

# Summary only (no trajectory)
uv run apogee-launch --h-target-km 213 --payload-kg 4082 --no-trajectory

# With custom initial guesses
uv run apogee-launch --h-target-km 200 --payload-kg 5000 \
  --theta0-deg 8.0 --t-coast 50.0 --t-burn2 300.0
```

The JSON output schema is stable and includes:

- `schema_version`
- `inputs` (`h_target_km`, `payload_kg`)
- `optimal_numerics` (`theta0_rad`, `t_coast_s`, `t_burn2_s`, `alpha2_rad`)
- `summary` (`ecc`, `h_err_m`, `v_err_mps`, `gamma_deg`)
- `trajectory` (if enabled) — arrays with explicit unit suffixes

### Python API

Use directly from Python:

```python
from apogee_launch import solve_to_circular_orbit

result = solve_to_circular_orbit(
    h_target_km=213.0,
    payload_kg=4082.0,
    include_trajectory=True,
)

print(f"Eccentricity: {result.summary['ecc']:.6f}")
print(f"Altitude error: {result.summary['h_err_m']:.1f} m")
```

### FastAPI Backend

Start the API server:

```bash
uv run uvicorn apogee_api.main:app --reload
```

Then access:
- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- Launch simulation: `POST http://localhost:8000/launch/simulate`

Example request:

```bash
curl -X POST "http://localhost:8000/launch/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "h_target_km": 213,
    "payload_kg": 4082,
    "include_trajectory": false
  }'
```

## Notes for future FastAPI + Three.js

- The trajectory is already JSON-serializable via `apogee_core.trajectory_to_dict`.
- The planar position exported is `pos_m = {x, y, z}` with `z=0`.
- This is intentionally compatible with adding a **future satellite orbit propagator** and then plotting both rocket ascent and satellite orbit in the same frontend.

## Status

- Simulator and shooting solver are operational.
- Math report (`docs/nm_final_project.tex`) is aligned to the current implementation.
