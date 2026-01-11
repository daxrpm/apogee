"""Production-ready rocket simulator with fixed Falcon 9 parameters.

This simulator uses realistic Falcon 9 parameters from literature and
solves the 3x3 shooting problem to achieve circular orbit insertion.
"""
from __future__ import annotations

import math
import jax
jax.config.update("jax_enable_x64", True)
import numpy as np

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


def create_falcon9_config(h_target: float, payload_mass: float = 0.0) -> AscentConfig:
    """Create Falcon 9 configuration with realistic parameters.
    
    Parameters from:
    - SpaceX official website (m0, thrusts, geometry)
    - Literature values (Isp, structural fractions)
    
    Args:
        h_target: Target circular orbit altitude [m]
        payload_mass: Payload mass [kg]
    
    Returns:
        AscentConfig ready for simulation
    """
    earth = EarthParams(
        r_e=6_371_000.0,
        mu=3.986004418e14,
        g0=9.80665,
    )
    
    # Official Falcon 9 parameters (SpaceX data)
    m0 = 549_054.0  # Total mass [kg]
    thrust1 = 7_686_000.0  # Stage 1 thrust at sea level [N]
    thrust2 = 981_000.0    # Stage 2 thrust in vacuum [N]
    diameter = 3.7  # Core diameter [m]
    t2_burn = 397.0  # Stage 2 burn time [s] (official)
    
    # Performance parameters (from literature)
    isp1 = 282.0  # Merlin 1D Isp at sea level [s]
    isp2 = 348.0  # Merlin Vac Isp [s]
    
    # Known dry masses (from Falcon 9 v1.2 FT analysis)
    m1_dry = 22_000.0  # Stage 1 dry mass [kg]
    m2_dry = 4_000.0   # Stage 2 dry mass [kg]
    interstage = 2_000.0  # Interstage adapter [kg]
    
    # Calculate propellant masses from mass budget
    g0 = earth.g0
    total_dry = m1_dry + m2_dry + interstage
    available_prop = m0 - total_dry - payload_mass
    
    # Stage 2 propellant (fixed by official t2_burn)
    m2_prop = (thrust2 * t2_burn) / (isp2 * g0)
    
    # Stage 1 propellant (remainder)
    m1_prop = available_prop - m2_prop
    
    # Stage 1 burn time (derived from propellant mass)
    t1_burn = (m1_prop * isp1 * g0) / thrust1
    
    # Geometry
    a_ref = math.pi * (diameter / 2.0) ** 2
    
    # Stages
    stage1 = StageParams(
        thrust=thrust1,
        isp=isp1,
        a_ref=a_ref,
        cd=ConstantCd(0.3),  # Typical rocket Cd
    )
    
    stage2 = StageParams(
        thrust=thrust2,
        isp=isp2,
        a_ref=a_ref,
        cd=ConstantCd(0.24),  # Lower Cd for upper stage
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
        payload_mass=payload_mass,
    )
    
    # Numerics tuned for robustness
    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=5.0 * math.pi / 180.0,  # Initial guess
        t_burn2=170.0,  # Initial guess
        t_coast=50.0,   # Initial guess
        v_eps=1e-3,
        dt0=0.5,
        rtol=1e-6,
        atol=1e-6,
        root_rtol=1e-6,
        root_atol=1e-3,
        t_max=2000.0,
        max_steps=100_000,
    )
    
    return AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=100.0,
    )


def simulate_to_orbit(h_target: float, payload_mass: float = 0.0, verbose: bool = True):
    """Simulate Falcon 9 ascent to circular orbit.
    
    Args:
        h_target: Target altitude [m] (e.g., 200_000 for 200 km)
        payload_mass: Payload mass [kg]
        verbose: Print detailed results
    
    Returns:
        (config, trajectory) tuple
    """
    if verbose:
        print(f"=== Falcon 9 Ascent Simulator ===")
        print(f"Target altitude: {h_target/1000:.1f} km")
        print(f"Payload mass: {payload_mass:.1f} kg")
        print()
    
    config = create_falcon9_config(h_target, payload_mass)
    
    if verbose:
        print("Vehicle configuration:")
        print(f"  Gross mass: {config.vehicle.m0:.1f} kg")
        print(f"  Stage 1 dry: {config.vehicle.m1_dry:.1f} kg")
        print(f"  Stage 2 dry: {config.vehicle.m2_dry:.1f} kg")
        print(f"  Stage 1 Isp: {config.vehicle.stage1.isp:.1f} s")
        print(f"  Stage 2 Isp: {config.vehicle.stage2.isp:.1f} s")
        print()
        print("Solving shooting problem...")
    
    try:
        opt_config, traj = solve_circular_orbit(config)
        
        if verbose:
            print("✓ Converged!")
            print()
            print("Optimal guidance:")
            print(f"  Pitch-over angle: {opt_config.numerics.theta0 * 180.0 / math.pi:.3f}°")
            print(f"  Coast duration: {opt_config.numerics.t_coast:.1f} s")
            print(f"  Stage 2 burn: {opt_config.numerics.t_burn2:.1f} s")
            print()
            
            # Extract final state
            t_arr = np.array(traj.t)
            mask = np.isfinite(t_arr)
            if np.any(mask):
                last_idx = np.max(np.where(mask)[0])
                
                r_final = float(traj.r[last_idx])
                v_final = float(traj.v[last_idx])
                gamma_final = float(traj.gamma[last_idx])
                m_final = float(traj.m[last_idx])
                t_final = float(traj.t[last_idx])
                
                r_target = config.earth.r_e + h_target
                v_circ = math.sqrt(config.earth.mu / r_target)
                
                print("Final state:")
                print(f"  Time: {t_final:.1f} s")
                print(f"  Altitude: {(r_final - config.earth.r_e)/1000:.3f} km")
                print(f"  Velocity: {v_final:.1f} m/s")
                print(f"  Flight path angle: {gamma_final * 180.0 / math.pi:.4f}°")
                print(f"  Final mass: {m_final:.1f} kg")
                print()
                
                print("Orbit quality:")
                r_err = abs(r_final - r_target)
                v_err = abs(v_final - v_circ)
                gamma_err = abs(gamma_final) * 180.0 / math.pi
                ecc = float(traj.orbit.eccentricity)
                
                print(f"  Radius error: {r_err:.1f} m ({r_err/r_target*100:.6f}%)")
                print(f"  Velocity error: {v_err:.2f} m/s ({v_err/v_circ*100:.4f}%)")
                print(f"  FPA error: {gamma_err:.4f}°")
                print(f"  Eccentricity: {ecc:.6f}")
                print()
                
                if ecc < 0.001:
                    print("✓✓✓ SUCCESS: Circular orbit achieved! ✓✓✓")
                else:
                    print("⚠ Warning: Orbit is not perfectly circular")
        
        return opt_config, traj
        
    except Exception as e:
        if verbose:
            print(f"✗ Simulation failed: {e}")
        raise


def main():
    """Run example simulations."""
    print("=" * 60)
    print("APOGEE: Two-Stage Rocket Ascent Simulator")
    print("=" * 60)
    print()
    
    # Test different altitudes
    altitudes = [200_000, 300_000, 400_000]  # 200, 300, 400 km
    
    for h in altitudes:
        try:
            config, traj = simulate_to_orbit(h, payload_mass=0.0, verbose=True)
            print()
            print("-" * 60)
            print()
        except Exception as e:
            print(f"Failed for h={h/1000:.0f} km: {e}")
            print()


if __name__ == "__main__":
    main()
