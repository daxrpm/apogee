---
title: Apogee
description: Two-stage rocket ascent simulator with shooting-method optimization for circular LEO insertion
---

# Apogee

**A two-stage rocket ascent simulator with shooting-method optimization for circular Low Earth Orbit (LEO) insertion.**

<p align="center">
  <img src="assets/images/falcon9Rocket.jpg" alt="Falcon 9 Launch" width="600"/>
</p>

## Overview

Apogee is a comprehensive space mission simulator designed to model the complete lifecycle of a satellite deployment mission. It combines **rigorous mathematical modeling** with **modern numerical methods** to achieve highly accurate circular orbit insertions.

!!! success "Key Capabilities"
    - **Target altitudes**: 160–400 km LEO
    - **Payload capacity**: 0–10,000 kg
    - **Orbital accuracy**: Eccentricity < 0.001
    - **Velocity error**: < 2 m/s

## Mission Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **1. Rocket Launch & Ascent** | ✅ Complete | Two-stage Falcon 9 simulation with gravity turn |
| **2. Orbital Insertion** | ✅ Complete | Shooting method optimization for circular orbits |
| **3. Orbital Propagation** | ✅ Complete | Yaw steering for solar panel optimization |
| **4. 3D Visualization** | 🚧 In Progress | Real-time trajectory rendering |

## Mathematical Foundation

The simulator is built on first-principles physics:

$$
\mathbf{y}(t) = \begin{bmatrix} r(t) \\ \lambda(t) \\ v(t) \\ \gamma(t) \\ m(t) \end{bmatrix}
$$

Where:

- $r(t)$: Geocentric radius [m]
- $\lambda(t)$: Downrange central angle [rad]  
- $v(t)$: Speed magnitude [m/s]
- $\gamma(t)$: Flight-path angle [rad]
- $m(t)$: Vehicle mass [kg]

See [Theory → State Vector](theory/state-vector.md) for complete derivation.

## Design Principles

The implementation follows these core principles:

- **Mathematically rigorous**: Every equation explicitly derived and mapped to code
- **Numerically robust**: Adaptive RK integration, event root-finding, bounded optimization
- **Physically accurate**: USSA76 atmosphere, variable mass dynamics, non-constant gravity
- **Production-ready**: JSON-serializable output, FastAPI backend, modular architecture

## Quick Start

=== "CLI"

    ```bash
    # Install
    git clone https://github.com/daxrpm/apogee.git
    cd apogee && uv sync
    
    # Run simulation
    uv run apogee-launch --h-target-km 200 --payload-kg 5000
    ```

=== "Python API"

    ```python
    from apogee_launch import solve_to_circular_orbit
    
    result = solve_to_circular_orbit(
        h_target_km=200,
        payload_kg=5000,
    )
    
    print(f"Eccentricity: {result.summary['ecc']:.6f}")
    print(f"Altitude error: {result.summary['h_err_m']:.1f} m")
    ```

=== "REST API"

    ```bash
    # Start server
    uv run uvicorn apogee_api.main:app --reload
    
    # Simulate launch
    curl -X POST "http://localhost:8000/launch/simulate" \
      -H "Content-Type: application/json" \
      -d '{"h_target_km": 200, "payload_kg": 5000}'
    ```

## Package Architecture

```
apogee/
├── packages/
│   ├── apogee-physics/     # Core numerical engine (JAX/Diffrax)
│   ├── apogee-launch/      # Launch simulator + CLI
│   ├── apogee-orbit/       # Orbital mechanics & yaw steering
│   └── apogee-api/         # FastAPI REST backend
└── frontend/               # React Three Fiber 3D visualization
```

## Documentation Sections

<div class="grid cards" markdown>

-   :material-book-open-variant:{ .lg .middle } **Theory**

    ---

    Mathematical derivations for rocket dynamics, orbital mechanics, and atmospheric models.

    [:octicons-arrow-right-24: Explore Theory](theory/index.md)

-   :material-function:{ .lg .middle } **Numerical Methods**

    ---

    Step-by-step explanations of ODE integration, shooting method, and optimization algorithms.

    [:octicons-arrow-right-24: Numerical Methods](numerical-methods/index.md)

-   :material-package-variant:{ .lg .middle } **Package Reference**

    ---

    API documentation for all Python packages with code-to-equation mapping.

    [:octicons-arrow-right-24: Packages](packages/index.md)

-   :material-rocket-launch:{ .lg .middle } **Getting Started**

    ---

    Installation guide and your first launch simulation in 5 minutes.

    [:octicons-arrow-right-24: Get Started](getting-started/index.md)

</div>

## Academic References

This documentation includes proper citations to foundational texts:

- Battin, R.H. (1999). *An Introduction to the Mathematics and Methods of Astrodynamics*
- Curtis, H.D. (2013). *Orbital Mechanics for Engineering Students*
- Stoer & Bulirsch (2002). *Introduction to Numerical Analysis*

See [Reference → Bibliography](reference/bibliography.md) for complete citations.
