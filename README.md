# APOGEE: Falcon 9 Ascent Simulator

**High-fidelity two-stage rocket trajectory simulation with optimal guidance parameter computation.**

## 🚀 Overview

APOGEE simulates Falcon 9 v1.2 FT ascent to circular orbit using:

- **Rigorous physics**: 2D polar coordinates, gravity turn, atmospheric drag
- **Numerical methods**: Tsit5 (5th-order Runge-Kutta) with adaptive step-size
- **Shooting solver**: Optimal guidance parameters (θ₀, t_coast, t_burn2) for any altitude
- **JAX-powered**: GPU acceleration for fast parameter table generation

## 📁 Repository Structure

```text
apogee/
├── packages/apogee-core/          # Core simulation engine
│   └── src/apogee_core/
│       ├── simulate.py            # Main simulator
│       ├── shooting.py            # Shooting solver
│       ├── dynamics.py            # Equations of motion
│       └── ...
├── scripts/
│   ├── production_simulator.py   # Ready-to-use simulator
│   ├── run_simulator.py          # Example usage
│   └── use_shooting_solver.py    # Shooting solver example
├── docs/                          # Technical documentation
├── COLAB_PARAMETER_GENERATOR.py  # GPU-optimized parameter table generation
└── apogee_core_standalone.zip    # Standalone package for Colab
```

## 🎯 Quick Start

### Option 1: Use Pre-configured Simulator (Fastest)

```python
from scripts.production_simulator import simulate_falcon9_to_orbit

# Simulate 200 km circular orbit
config, traj = simulate_falcon9_to_orbit(
    h_target=200_000,  # meters
    payload_mass=0.0,  # kg
    verbose=True
)

# Results: eccentricity < 0.02 (nearly circular)
```

### Option 2: Generate Optimal Parameters for Any Altitude

For altitudes other than 200 km, use the shooting solver:

```python
from apogee_core.shooting import solve_circular_orbit

# Automatically finds optimal θ₀, t_coast, t_burn2
optimal_config, traj = solve_circular_orbit(base_config)

# Runtime: ~30-120 seconds per altitude
```

### Option 3: GPU-Accelerated Parameter Table (Recommended)

**For generating parameter tables (200-400 km in 10 km steps):**

1. Upload `apogee_core_standalone.zip` to Google Colab
2. Copy `COLAB_PARAMETER_GENERATOR.py` into a Colab cell
3. Select GPU runtime (Runtime → Change runtime type → T4 GPU)
4. Run the script

**Expected runtime**: 15-45 minutes on Colab GPU (vs. 3-6 hours on CPU)

## 📊 Results

The simulator achieves:

- **200 km orbit**: e = 0.015 (excellent)
- **250 km orbit**: e = 0.215 (requires shooting solver)
- **300 km orbit**: Fails with empirical parameters (requires shooting solver)

**Conclusion**: Empirical scaling only works near 200 km. For arbitrary altitudes, use the shooting solver.

## 🔬 Mathematical Correctness

All physics and numerical methods have been rigorously verified:

- ✓ Equations of motion (polar coordinates)
- ✓ Gravity model (μ/r²)
- ✓ Drag model (½ρCdAv²)
- ✓ Tsiolkovsky rocket equation
- ✓ Orbit diagnostics (energy, eccentricity)
- ✓ Shooting solver (3×3 boundary value problem)

## 🛠️ Installation

```bash
# Install core package
cd packages/apogee-core
pip install -e .

# Or install dependencies manually
pip install jax diffrax optimistix scipy numpy
```

## 📖 Usage Examples

### Example 1: Single Altitude Simulation

```python
from scripts.production_simulator import simulate_falcon9_to_orbit

config, traj = simulate_falcon9_to_orbit(
    h_target=250_000,  # 250 km
    payload_mass=5000.0,  # 5 ton payload
    verbose=True
)
```

### Example 2: Shooting Solver for Optimal Parameters

```python
from apogee_core.shooting import solve_circular_orbit
from scripts.production_simulator import create_falcon9_vehicle
from apogee_core import AscentConfig, EarthParams, MissionParams, NumericsParams

vehicle = create_falcon9_vehicle(payload_mass=0.0)
earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
mission = MissionParams(h_target=300_000, payload_mass=0.0)
numerics = NumericsParams(
    h_pitch_over=200.0, theta0=0.0, t_burn2=0.0, t_coast=0.0,
    v_eps=1e-3, dt0=0.5, rtol=1e-6, atol=1e-6,
    root_rtol=1e-6, root_atol=1e-3, t_max=2000.0, max_steps=100_000
)

config = AscentConfig(earth=earth, mission=mission, vehicle=vehicle, numerics=numerics)
optimal_config, traj = solve_circular_orbit(config)

print(f"Optimal θ₀: {optimal_config.numerics.theta0 * 180/3.14159:.2f}°")
print(f"Optimal t_coast: {optimal_config.numerics.t_coast:.1f} s")
print(f"Optimal t_burn2: {optimal_config.numerics.t_burn2:.1f} s")
```

## 🎓 Technical Details

### Vehicle Configuration (Falcon 9 v1.2 FT)

- Gross mass: 549,054 kg
- Stage 1: 7,686 kN thrust, 282s Isp
- Stage 2: 981 kN thrust, 348s Isp
- Diameter: 3.7 m

### Simulation Phases

1. **Vertical ascent**: Until 200m altitude
2. **Gravity turn (Stage 1)**: Pitch-over at angle θ₀
3. **Coast phase**: Duration t_coast (ballistic flight)
4. **Stage 2 burn**: Duration t_burn2 (circularization)

### Shooting Solver

Solves 3×3 boundary value problem:

- **Controls**: θ₀, t_coast, t_burn2
- **Targets**: r_final = r_target, v_final = v_circ, γ_final = 0°
- **Method**: L-BFGS-B with finite difference Jacobian

## 📚 Documentation

- `docs/final_project_nm.pdf`: Complete mathematical formulation
- `docs/`: Trajectory plots and technical figures

## 🧹 Repository Cleanup

Unnecessary debug/test scripts have been moved to `archive/old_scripts/` and `archive/old_docs/` to maintain a clean production codebase.

## 📄 License

Educational project for numerical methods course (EPN).

## 👤 Author

David Ramos (daxrpm) - Computer Science Student & Backend Developer
