# Apogee

Apogee is a **two-stage rocket ascent simulator** with a robust **shooting method** that converges to a near-circular LEO orbit for target altitudes typically in the **160–400 km** range and payloads up to **10,000 kg**.

The implementation is designed to be:

- **Mathematically explicit** (state, forces, events, orbital diagnostics).
- **Numerically strict** (adaptive RK + event root-finding; bounded shooting variables; robust failure modes).
- **Backend/frontend-ready** (JSON-serializable trajectory for FastAPI + Three.js).

## Repository layout (current)

```text
apogee/
├── packages/
│   └── apogee-core/
│       └── src/apogee_core/
│           ├── atmosphere.py   # USSA76 table + interpolation
│           ├── dynamics.py     # ODE RHS and derived quantities
│           ├── simulate.py     # Hybrid simulation + events (Diffrax)
│           ├── orbit.py        # Two-body orbit diagnostics
│           ├── shooting.py     # LM+Broyden shooting solver
│           ├── trajectory.py   # Trajectory dataclass + JSON serializer
│           ├── types.py        # Dataclasses (Earth/Mission/Vehicle/Numerics)
│           └── calibration.py  # Optional offline calibration (SciPy)
├── scripts/
│   ├── production_simulator.py # Single-case runner + JSON result
│   └── run_simulator.py        # Sweep runner (timeout + continuation)
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

Core package:

```bash
pip install -e packages/apogee-core
```

## Run: single case (JSON output)

This is the **backend-ready** entry point.

### Print full JSON (includes full trajectory arrays)

```bash
python -u scripts/production_simulator.py --h-target-km 200 --payload-kg 5000
```

### Print only summary (no trajectory)

```bash
python -u scripts/production_simulator.py --h-target-km 200 --payload-kg 5000 --no-trajectory
```

The JSON schema is stable and includes:

- `schema_version`
- `inputs` (`h_target_km`, `payload_kg`)
- `optimal_numerics` (`theta0_rad`, `t_coast_s`, `t_burn2_s`, `alpha2_rad`)
- `summary` (`ecc`, `h_err_m`, `v_err_mps`, `gamma_deg`)
- `trajectory` (if enabled) — arrays with explicit unit suffixes

## Run: sweep with timeout + continuation

```bash
python -u scripts/run_simulator.py
```

This runs a grid sweep of altitudes/payloads with:

- per-case timeout
- continuation (warm-starting numerics from the previous converged case)

## Notes for future FastAPI + Three.js

- The trajectory is already JSON-serializable via `apogee_core.trajectory_to_dict`.
- The planar position exported is `pos_m = {x, y, z}` with `z=0`.
- This is intentionally compatible with adding a **future satellite orbit propagator** and then plotting both rocket ascent and satellite orbit in the same frontend.

## Status

- Simulator and shooting solver are operational.
- Math report (`docs/nm_final_project.tex`) is aligned to the current implementation.
