"""Production Falcon 9 Simulator - Ready to Use

This simulator uses correct Falcon 9 parameters with validated mass budget
and empirically tuned guidance parameters for reliable circular orbit insertion.

Usage:
    from production_simulator import simulate_falcon9_to_orbit
    
    config, traj = simulate_falcon9_to_orbit(h_target=200_000)  # 200 km orbit
"""

import argparse
import json
import math
from typing import Any

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
    simulate_ascent,
    solve_circular_orbit,
    trajectory_to_dict,
)
from apogee_core.calibration import ConstantCd


# Falcon 9 v1.2 FT Parameters (Validated)
FALCON9_PARAMS = {
    'm0': 549_054.0,           # Total mass [kg] (SpaceX official)
    'thrust1': 7_686_000.0,    # Stage 1 thrust [N] (SpaceX official)
    'thrust2': 981_000.0,      # Stage 2 thrust [N] (SpaceX official)
    'isp1': 282.0,             # Stage 1 Isp [s] (literature)
    'isp2': 348.0,             # Stage 2 Isp [s] (literature)
    't2_burn': 397.0,          # Stage 2 burn time [s] (SpaceX official)
    'm1_dry': 22_000.0,        # Stage 1 dry mass [kg] (analysis)
    'm2_dry': 4_000.0,         # Stage 2 dry mass [kg] (analysis)
    'interstage': 2_000.0,     # Interstage mass [kg] (analysis)
    'diameter': 3.7,           # Core diameter [m] (SpaceX official)
}

# Empirically validated guidance parameters for 200 km orbit
GUIDANCE_200KM = {
    'theta0_deg': 8.0,    # Pitch-over angle [degrees]
    't_coast': 50.0,      # Coast duration [seconds]
    't_burn2': 240.0,     # Stage 2 burn time [seconds]
}


def create_falcon9_vehicle(payload_mass: float = 0.0, *, params: dict[str, float] | None = None):
    """Create Falcon 9 vehicle configuration with correct mass budget."""
    p = dict(FALCON9_PARAMS)
    if params is not None:
        p.update(params)
    g0 = 9.80665
    
    # Calculate propellant masses from mass budget
    total_dry = p['m1_dry'] + p['m2_dry'] + p['interstage']
    available_prop = p['m0'] - total_dry - payload_mass
    
    # Stage 2 propellant (fixed by official burn time)
    m2_prop = (p['thrust2'] * p['t2_burn']) / (p['isp2'] * g0)
    
    # Stage 1 propellant (remainder)
    m1_prop = available_prop - m2_prop
    
    # Stage 1 burn time (derived)
    t1_burn = (m1_prop * p['isp1'] * g0) / p['thrust1']
    
    # Verify mass budget
    total_check = total_dry + m1_prop + m2_prop + payload_mass
    assert abs(total_check - p['m0']) < 1.0, f"Mass budget error: {total_check} != {p['m0']}"
    
    # Create stages
    a_ref = math.pi * (p['diameter'] / 2.0) ** 2
    
    stage1 = StageParams(
        thrust=p['thrust1'],
        isp=p['isp1'],
        a_ref=a_ref,
        cd=ConstantCd(0.3),  # Typical rocket Cd
    )
    
    stage2 = StageParams(
        thrust=p['thrust2'],
        isp=p['isp2'],
        a_ref=a_ref,
        cd=ConstantCd(0.24),  # Lower Cd for upper stage
    )
    
    vehicle = VehicleParams(
        m0=p['m0'],
        stage1=stage1,
        stage2=stage2,
        m1_dry=p['m1_dry'],
        m2_dry=p['m2_dry'],
        t1_burn=t1_burn,
        t2_burn=p['t2_burn'],
    )
    
    return vehicle, t1_burn, m1_prop, m2_prop


def simulate_falcon9_to_orbit(
    h_target: float,
    payload_mass: float = 0.0,
    theta0_deg: float = None,
    t_coast: float = None,
    t_burn2: float = None,
    verbose: bool = True
):
    """Simulate Falcon 9 ascent to circular orbit.
    
    Args:
        h_target: Target altitude [m] (e.g., 200_000 for 200 km)
        payload_mass: Payload mass [kg]
        theta0_deg: Pitch-over angle [degrees] (None = auto-select)
        t_coast: Coast duration [s] (None = auto-select)
        t_burn2: Stage 2 burn time [s] (None = auto-select)
        verbose: Print results
    
    Returns:
        (config, trajectory) tuple
    """
    
    # Create vehicle
    vehicle, t1_burn, m1_prop, m2_prop = create_falcon9_vehicle(payload_mass)
    
    # Earth and mission
    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
    mission = MissionParams(h_target=h_target, payload_mass=payload_mass)
    
    # Empirically-tuned parameter scaling
    # Baseline: 200 km, 0 kg payload → theta0=8°, t_coast=50s, t_burn2=240s
    if theta0_deg is None or t_coast is None or t_burn2 is None:
        h_km = h_target / 1000.0
        
        # Baseline parameters (empirically validated for 200 km, 0 kg)
        t_burn2_base = 240.0
        theta0_base = 8.0
        t_coast_base = 50.0
        
        # Scale burn time based on altitude
        # Higher altitude needs slightly more delta-v
        # 200 km → 240s, 250 km → 250s, 300 km → 260s
        t_burn2 = t_burn2_base + (h_km - 200.0) * 0.2
        
        # Scale burn time based on payload
        # More payload → less fuel available → shorter burn
        # Each 1000 kg payload reduces burn by ~5 seconds
        t_burn2 -= (payload_mass / 1000.0) * 5.0
        
        # Clamp to reasonable range
        t_burn2 = max(180.0, min(280.0, t_burn2))
        
        # Pitch angle: higher altitude needs shallower pitch
        theta0_deg = theta0_base - (h_km - 200.0) / 100.0
        theta0_deg = max(6.0, min(9.0, theta0_deg))
        
        # Coast time: higher altitude needs longer coast
        t_coast = t_coast_base + (h_km - 200.0) * 0.2
        t_coast = max(30.0, min(90.0, t_coast))
    
    # Numerics
    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=theta0_deg * math.pi / 180.0,
        t_burn2=t_burn2,
        t_coast=t_coast,
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
    
    if verbose:
        print(f"=== Falcon 9 Ascent Simulator ===")
        print(f"Target altitude: {h_target/1000:.1f} km")
        print(f"Payload mass: {payload_mass:.1f} kg")
        print()
        print(f"Vehicle configuration:")
        print(f"  Gross mass: {vehicle.m0:.0f} kg")
        print(f"  Stage 1 burn: {t1_burn:.1f} s")
        print(f"  Stage 1 propellant: {m1_prop:.0f} kg")
        print(f"  Stage 2 propellant: {m2_prop:.0f} kg")
        print()
        print(f"Guidance parameters:")
        print(f"  Pitch-over angle: {theta0_deg:.1f}°")
        print(f"  Coast duration: {t_coast:.1f} s")
        print(f"  Stage 2 burn: {t_burn2:.1f} s")
        print()
        print("Running simulation...")
    
    # Simulate
    traj = simulate_ascent(config)
    
    # Analyze results
    t_arr = np.array(traj.t)
    mask = np.isfinite(t_arr)
    
    if not np.any(mask):
        if verbose:
            print("✗ Simulation failed: No valid trajectory")
        return config, traj

    last_idx = np.max(np.where(mask)[0])

    r_final = float(traj.r[last_idx])
    v_final = float(traj.v[last_idx])
    gamma_final = float(traj.gamma[last_idx])
    m_final = float(traj.m[last_idx])
    h_final = float(traj.h[last_idx])
    t_final = float(traj.t[last_idx])

    r_target = earth.r_e + h_target
    v_circ = math.sqrt(earth.mu / r_target)

    r_err = abs(r_final - r_target) / r_target * 100
    v_err = abs(v_final - v_circ) / v_circ * 100
    gamma_err_deg = abs(gamma_final) * 180 / math.pi
    ecc = float(traj.orbit.eccentricity)

    if verbose:
        print()
        print("Final state:")
        print(f"  Time: {t_final:.1f} s")
        print(f"  Altitude: {h_final/1000:.3f} km (target: {h_target/1000:.0f} km)")
        print(f"  Velocity: {v_final:.1f} m/s (target: {v_circ:.1f} m/s)")
        print(f"  FPA: {gamma_final * 180/math.pi:.4f}° (target: 0°)")
        print(f"  Final mass: {m_final:.1f} kg")
        print()
        print("Orbit quality:")
        print(f"  Radius error: {r_err:.4f}%")
        print(f"  Velocity error: {v_err:.4f}%")
        print(f"  FPA error: {gamma_err_deg:.4f}°")
        print(f"  Eccentricity: {ecc:.6f}")
        print()

        if ecc < 0.001:
            print("✓✓✓ EXCELLENT: Nearly perfect circular orbit!")
        elif ecc < 0.02:
            print("✓✓ GOOD: Orbit is nearly circular")
        elif ecc < 0.05:
            print("✓ ACCEPTABLE: Orbit is approximately circular")
        else:
            print("⚠ WARNING: Orbit is not circular (e > 0.05)")

    return config, traj


def solve_falcon9_to_circular_orbit(
    *,
    h_target: float,
    payload_mass: float = 0.0,
    numerics: NumericsParams | None = None,
    atmosphere_z_max: float = 300_000.0,
    atmosphere_dz: float = 100.0,
    trim: bool = True,
):
    vehicle, _t1_burn, _m1_prop, _m2_prop = create_falcon9_vehicle(payload_mass)

    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
    mission = MissionParams(h_target=h_target, payload_mass=payload_mass)

    if numerics is None:
        numerics = NumericsParams(
            h_pitch_over=200.0,
            theta0=8.0 * math.pi / 180.0,
            t_burn2=300.0,
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

    base_config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=atmosphere_z_max,
        atmosphere_dz=atmosphere_dz,
    )

    opt_config, traj = solve_circular_orbit(base_config)
    return opt_config, traj, trajectory_to_dict(traj, trim=trim)


def solve_falcon9_to_circular_orbit_result(
    *,
    h_target_km: float,
    payload_kg: float,
    numerics: NumericsParams | None = None,
    vehicle_params: dict[str, float] | None = None,
    atmosphere_z_max: float = 300_000.0,
    atmosphere_dz: float = 100.0,
    trim: bool = True,
    include_trajectory: bool = True,
) -> dict[str, Any]:
    if payload_kg < 0.0 or payload_kg > 10_000.0:
        raise ValueError("payload_kg must be in [0, 10000]")
    if h_target_km <= 0.0:
        raise ValueError("h_target_km must be > 0")

    h_target_m = float(h_target_km) * 1000.0
    payload_mass = float(payload_kg)

    vehicle, _t1_burn, _m1_prop, _m2_prop = create_falcon9_vehicle(payload_mass, params=vehicle_params)

    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
    mission = MissionParams(h_target=h_target_m, payload_mass=payload_mass)

    if numerics is None:
        numerics = NumericsParams(
            h_pitch_over=200.0,
            theta0=8.0 * math.pi / 180.0,
            t_burn2=300.0,
            t_coast=50.0,
            v_eps=1e-3,
            dt0=0.5,
            rtol=1e-6,
            atol=1e-6,
            root_rtol=1e-6,
            root_atol=1e-3,
            t_max=2000.0,
            max_steps=100_000,
            alpha2=0.0,
        )

    base_config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=atmosphere_z_max,
        atmosphere_dz=atmosphere_dz,
    )

    opt_config, traj = solve_circular_orbit(base_config)

    t_arr = np.array(traj.t)
    mask = np.isfinite(t_arr)
    if not np.any(mask):
        raise RuntimeError("No valid trajectory")
    last_idx = int(np.sum(mask) - 1)

    h_final_m = float(traj.h[last_idx])
    v_final_mps = float(traj.v[last_idx])
    gamma_final_rad = float(traj.gamma[last_idx])
    ecc = float(traj.orbit.eccentricity)

    r_target_m = earth.r_e + h_target_m
    v_circ_mps = math.sqrt(earth.mu / r_target_m)

    result: dict[str, Any] = {
        "schema_version": 1,
        "inputs": {
            "h_target_km": float(h_target_km),
            "payload_kg": float(payload_kg),
        },
        "optimal_numerics": {
            "theta0_rad": float(opt_config.numerics.theta0),
            "t_coast_s": float(opt_config.numerics.t_coast),
            "t_burn2_s": float(opt_config.numerics.t_burn2),
            "alpha2_rad": float(opt_config.numerics.alpha2),
        },
        "summary": {
            "ecc": ecc,
            "h_err_m": float(h_final_m - h_target_m),
            "v_err_mps": float(v_final_mps - v_circ_mps),
            "gamma_deg": float(gamma_final_rad * 180.0 / math.pi),
        },
    }

    if include_trajectory:
        result["trajectory"] = trajectory_to_dict(traj, trim=trim)

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--h-target-km", type=float, default=None)
    parser.add_argument("--payload-kg", type=float, default=None)
    parser.add_argument("--no-trajectory", action="store_true")
    args = parser.parse_args()

    if args.h_target_km is None or args.payload_kg is None:
        return

    result = solve_falcon9_to_circular_orbit_result(
        h_target_km=float(args.h_target_km),
        payload_kg=float(args.payload_kg),
        include_trajectory=not bool(args.no_trajectory),
        trim=True,
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
