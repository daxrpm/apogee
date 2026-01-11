"""Use the shooting solver to find optimal guidance parameters."""
import sys
sys.path.insert(0, '/home/daxrpm/Desktop/EPN/metodos_numericos/apogee/scripts')
import math
import jax
jax.config.update("jax_enable_x64", True)

from production_simulator import create_falcon9_vehicle
from apogee_core import (
    AscentConfig,
    EarthParams,
    MissionParams,
    NumericsParams,
    solve_circular_orbit,
)

earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)

print("="*70)
print("SHOOTING SOLVER TEST")
print("="*70)

# Test case: 200 km, 0 kg payload
h_target = 200_000.0
payload_mass = 0.0

vehicle, t1_burn, m1_prop, m2_prop = create_falcon9_vehicle(payload_mass)
mission = MissionParams(h_target=h_target, payload_mass=payload_mass)

# Initial guess for guidance parameters
theta0_guess = 8.0 * math.pi / 180.0
t_coast_guess = 50.0
t_burn2_guess = 300.0  # Longer than before

numerics = NumericsParams(
    h_pitch_over=200.0,
    theta0=theta0_guess,
    t_burn2=t_burn2_guess,
    t_coast=t_coast_guess,
    v_eps=1e-3,
    dt0=0.5,
    rtol=1e-6,
    atol=1e-6,
    root_rtol=1e-6,
    root_atol=1e-3,
    t_max=2000.0,
    max_steps=100_000,
)

base_config = AscentConfig(
    earth=earth,
    mission=mission,
    vehicle=vehicle,
    numerics=numerics,
    atmosphere_z_max=300_000.0,
    atmosphere_dz=100.0,
)

print(f"\nTarget: {h_target/1000:.0f} km, Payload: {payload_mass:.0f} kg")
print(f"\nInitial guess:")
print(f"  theta0: {theta0_guess * 180/math.pi:.2f}°")
print(f"  t_coast: {t_coast_guess:.1f} s")
print(f"  t_burn2: {t_burn2_guess:.1f} s")

print(f"\nRunning shooting solver...")
print("(This may take 1-2 minutes...)")

try:
    opt_config, traj = solve_circular_orbit(base_config=base_config)
    
    print(f"\n{'='*70}")
    print("RESULTS:")
    print(f"{'='*70}")
    
    print("✓ Shooting solver CONVERGED")
    
    opt_numerics = opt_config.numerics
    print(f"\nOptimal parameters:")
    print(f"  theta0: {opt_numerics.theta0 * 180/math.pi:.4f}°")
    print(f"  t_coast: {opt_numerics.t_coast:.2f} s")
    print(f"  t_burn2: {opt_numerics.t_burn2:.2f} s")
    
    print(f"\nFinal state:")
    import numpy as np
    t_arr = np.array(traj.t)
    mask = np.isfinite(t_arr)
    idx_final = np.sum(mask) - 1
    
    h_final = float(traj.h[idx_final]) / 1000.0
    v_final = float(traj.v[idx_final])
    gamma_final = float(traj.gamma[idx_final]) * 180 / math.pi
    m_final = float(traj.m[idx_final])
    
    print(f"  Altitude: {h_final:.3f} km (target: {h_target/1000:.0f} km)")
    print(f"  Velocity: {v_final:.1f} m/s")
    print(f"  FPA: {gamma_final:.4f}°")
    print(f"  Final mass: {m_final:.1f} kg")
    print(f"  Eccentricity: {traj.orbit.eccentricity:.6f}")
    
    if traj.orbit.eccentricity < 0.01:
        print(f"\n✓✓ EXCELLENT: Nearly perfect circular orbit!")
    elif traj.orbit.eccentricity < 0.05:
        print(f"\n✓ GOOD: Acceptable circular orbit")
    else:
        print(f"\n⚠ WARNING: Orbit not circular enough")
        
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()

print(f"\n{'='*70}")
