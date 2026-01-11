"""Test shooting solver with fixed, realistic vehicle parameters."""
from __future__ import annotations

import math
import jax
jax.config.update("jax_enable_x64", True)
import jax.numpy as jnp

from apogee_core import (
    AscentConfig,
    EarthParams,
    MissionParams,
    NumericsParams,
    StageParams,
    VehicleParams,
    solve_circular_orbit,
)
from apogee_core.calibration import ConstantCd

def main():
    print("--- Testing Shooting Solver with Realistic Parameters ---")
    
    earth = EarthParams(
        r_e=6_371_000.0,
        mu=3.986004418e14,
        g0=9.80665,
    )
    
    # Target orbit
    h_target = 200_000.0
    
    # Correct Falcon 9 parameters (mass budget satisfied)
    m0 = 549_054.0
    thrust1 = 7_686_000.0
    thrust2 = 981_000.0
    isp1 = 282.0
    isp2 = 348.0
    t2_burn = 397.0  # Official
    
    # Known dry masses
    m1_dry = 22_000.0
    m2_dry = 4_000.0
    interstage = 2_000.0
    
    # Calculate propellant from mass budget
    g0 = earth.g0
    total_dry = m1_dry + m2_dry + interstage
    available_prop = m0 - total_dry
    m2_prop = (thrust2 * t2_burn) / (isp2 * g0)
    m1_prop = available_prop - m2_prop
    t1_burn = (m1_prop * isp1 * g0) / thrust1
    
    print(f"m1_prop = {m1_prop:.2f} kg")
    print(f"m2_prop = {m2_prop:.2f} kg")
    print(f"Total prop = {m1_prop + m2_prop:.2f} kg")
    print(f"t1_burn = {t1_burn:.2f} s")
    
    print(f"m1_dry = {m1_dry:.2f} kg")
    print(f"m2_dry = {m2_dry:.2f} kg")
    print(f"interstage = {interstage:.2f} kg")
    print(f"Total dry = {total_dry:.2f} kg")
    print(f"Mass check: {total_dry + m1_prop + m2_prop:.2f} kg (should be {m0:.2f})")
    
    diameter = 3.7
    a_ref = math.pi * (diameter / 2.0) ** 2
    
    stage1 = StageParams(
        thrust=thrust1,
        isp=isp1,
        a_ref=a_ref,
        cd=ConstantCd(0.3),
    )
    
    stage2 = StageParams(
        thrust=thrust2,
        isp=isp2,
        a_ref=a_ref,
        cd=ConstantCd(0.24),  # Lower Cd for stage 2
    )
    
    vehicle = VehicleParams(
        m0=m0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=m1_dry,
        m2_dry=m2_dry,
        t1_burn=t1_burn,
        t2_burn=t2_burn,
    )
    
    mission = MissionParams(
        h_target=h_target,
        payload_mass=0.0,
    )
    
    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=5.0 * math.pi / 180.0,
        t_burn2=170.0,
        t_coast=50.0,
        v_eps=1e-3,
        dt0=0.5,
        rtol=1e-6,
        atol=1e-6,
        root_rtol=1e-6,
        root_atol=1e-3,
        t_max=2000.0,
        max_steps=100_000,
    )
    
    config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=100.0,
    )
    
    print("\n--- Running Shooting Solver ---")
    try:
        opt_config, traj = solve_circular_orbit(config)
        
        print("\n✓ Shooting solver converged!")
        print(f"theta0* = {opt_config.numerics.theta0 * 180.0 / math.pi:.3f} deg")
        print(f"t_coast* = {opt_config.numerics.t_coast:.3f} s")
        print(f"t_burn2* = {opt_config.numerics.t_burn2:.3f} s")
        
        # Extract final state
        import numpy as np
        t_arr = np.array(traj.t)
        mask = np.isfinite(t_arr)
        if np.any(mask):
            last_idx = np.max(np.where(mask)[0])
            
            r_final = float(traj.r[last_idx])
            v_final = float(traj.v[last_idx])
            gamma_final = float(traj.gamma[last_idx])
            m_final = float(traj.m[last_idx])
            
            r_target = earth.r_e + h_target
            v_circ = math.sqrt(earth.mu / r_target)
            
            print(f"\n--- Final State ---")
            print(f"r_final = {r_final:.1f} m (target: {r_target:.1f} m)")
            print(f"v_final = {v_final:.1f} m/s (target: {v_circ:.1f} m/s)")
            print(f"gamma_final = {gamma_final * 180.0 / math.pi:.4f} deg (target: 0)")
            print(f"m_final = {m_final:.1f} kg")
            
            print(f"\n--- Orbit Quality ---")
            print(f"Radius error: {abs(r_final - r_target):.1f} m ({abs(r_final - r_target) / r_target * 100:.4f}%)")
            print(f"Velocity error: {abs(v_final - v_circ):.1f} m/s ({abs(v_final - v_circ) / v_circ * 100:.4f}%)")
            print(f"Flight path angle: {abs(gamma_final) * 180.0 / math.pi:.4f} deg")
            print(f"Eccentricity: {float(traj.orbit.eccentricity):.6f}")
            
            # Check if orbit is circular
            if float(traj.orbit.eccentricity) < 0.01:
                print("\n✓✓✓ SUCCESS: Circular orbit achieved! ✓✓✓")
            else:
                print("\n⚠ Warning: Orbit is not circular")
        else:
            print("\n✗ No valid trajectory points")
            
    except Exception as e:
        print(f"\n✗ Shooting solver failed: {e}")

if __name__ == "__main__":
    main()
