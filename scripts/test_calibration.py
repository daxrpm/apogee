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
    CalibrationInputs,
    CalibrationUnknowns,
    calibrate_vehicle,
)
from apogee_core.simulate import simulate_ascent
from apogee_core.calibration import ConstantCd

def main():
    print("--- Setting up Calibration Test ---")
    
    # 1. Define "True" Vehicle (Hidden Ground Truth)
    # We will generate a synthetic mission using known parameters,
    # then try to recover them (or equivalent ones) using calibration.
    
    earth = EarthParams(
        r_e=6_371_000.0,
        mu=3.986004418e14,
        g0=9.80665,
    )
    
    # Target Orbit
    h_target = 200_000.0
    
    # "True" Parameters (Target for calibration to recover)
    true_isp1 = 282.0
    true_isp2 = 348.0
    true_t1_burn = 162.0
    true_cd = 0.3
    
    # Known Fixed Engineering Data (Official Falcon 9)
    m0 = 549_054.0  # Official SpaceX value
    thrust1_sl = 7_686_000.0
    thrust2_vac = 981_000.0
    t2_burn = 397.0
    diameter = 3.7
    payload_mass = 0.0
    
    print(f"Using official Falcon 9 m0: {m0:.2f} kg")
    
    # Create Calibration Inputs
    inputs = CalibrationInputs(
        m0=m0,
        diameter=diameter,
        stage1_thrust_sl=thrust1_sl,
        stage2_thrust_vac=thrust2_vac,
        stage2_burn_time=t2_burn,
        payload_mass=payload_mass,
        h_target=h_target,
    )
    
    # Initial Guess (Disturbed values)
    initial_guess = CalibrationUnknowns(
        isp1=270.0,        # True: 282
        isp2=340.0,        # True: 348
        t1_burn=155.0,     # True: 162
        cd_value=0.35,     # True: 0.3
    )
    
    # Base Config (Numerics mostly)
    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=4.0 * math.pi / 180.0, # Will be optimized by shooting
        t_burn2=170.0,                # Will be optimized by shooting
        t_coast=50.0,                 # Will be optimized by shooting
        v_eps=1e-3,
        dt0=0.5,
        rtol=1e-5,
        atol=1e-5,
        root_rtol=1e-5,
        root_atol=1e-3,
        t_max=2000.0,
        max_steps=100_000,
    )
    
    # We create a dummy vehicle in base_config, it will be overwritten by calibration
    dummy_stage = StageParams(0.0, 1.0, 1.0, ConstantCd(0.1))
    dummy_vehicle = VehicleParams(m0, dummy_stage, dummy_stage, 0.0, 0.0, 0.0, 0.0)
    
    mission = MissionParams(h_target, payload_mass)
    
    base_config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=dummy_vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=100.0, # Coarser for speed
    )
    
    print("Initial Guess:", initial_guess)
    print("Starting Calibration (this may take a minute)...")
    
    result = calibrate_vehicle(inputs, initial_guess, base_config)
    
    print("\n--- Calibration Results ---")
    print(f"Cost: {result.cost:.6e}")
    print(f"Mass Budget Error: {result.mass_budget_error:.6%}")
    print(f"Orbit Error (Relative): {result.orbit_error:.6%}")
    
    u = result.unknowns
    print("\nCalibrated Parameters:")
    print(f"Isp1: {u.isp1:.2f} s (Target: {true_isp1})")
    print(f"Isp2: {u.isp2:.2f} s (Target: {true_isp2})")
    print(f"t1_burn: {u.t1_burn:.2f} s (Target: {true_t1_burn})")
    print(f"Cd: {u.cd_value:.3f} (Target: {true_cd})")
    print(f"\nDerived masses:")
    print(f"m1_dry: {result.config.vehicle.m1_dry:.2f} kg")
    print(f"m2_dry: {result.config.vehicle.m2_dry:.2f} kg")
    
    # Verify Trajectory
    r_target = earth.r_e + h_target
    
    # Safely extract final radius
    import numpy as np
    t_arr = np.array(result.trajectory.t)
    if np.any(np.isfinite(t_arr)):
        last_idx = np.max(np.where(np.isfinite(t_arr))[0])
        r_final = result.trajectory.r[last_idx]
        print(f"\nFinal Radius: {r_final:.1f} m (Target: {r_target:.1f} m)")
    else:
        print(f"\nFinal Radius: Invalid (No finite steps)")

    if abs(result.mass_budget_error) < 1e-3 and abs(result.orbit_error) < 1e-3:
        print("\nSUCCESS: Calibration converged to physical consistency.")
    else:
        print("\nWARNING: Calibration did not fully converge.")

if __name__ == "__main__":
    main()
