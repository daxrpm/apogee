
import jax
import jax.numpy as jnp
import math
import numpy as np
from dataclasses import replace
from apogee_core import (
    AscentConfig,
    EarthParams,
    MissionParams,
    NumericsParams,
    StageParams,
    VehicleParams,
    shooting
)
from apogee_core.calibration import ConstantCd

def main():
    print("Checking 'True' Vehicle Performance...")
    
    # 1. Define True Parameters
    true_isp1 = 300.0 # Boosted from 280
    true_isp2 = 360.0 
    true_t1_burn = 160.0
    true_m1_dry = 25_000.0 # Reduced from 28000
    true_m2_dry = 4_000.0
    true_cd = 0.3
    
    # Fixed Data
    thrust1_sl = 7_686_000.0
    thrust2_vac = 981_000.0
    t2_burn = 397.0
    diameter = 3.7
    payload_mass = 0.0
    h_target = 200_000.0
    
    earth = EarthParams(
        r_e=6_371_000.0,
        mu=3.986004418e14,
        g0=9.80665,
    )
    
    # Calculate Masses
    g0 = earth.g0
    m1_prop = (thrust1_sl * true_t1_burn) / (true_isp1 * g0)
    m2_prop = (thrust2_vac * t2_burn) / (true_isp2 * g0)
    m0 = true_m1_dry + true_m2_dry + m1_prop + m2_prop + payload_mass
    
    print(f"True GLOW (m0): {m0:.2f} kg")
    
    # Setup Vehicle
    radius = diameter / 2.0
    a_ref = math.pi * radius * radius
    
    stage1 = StageParams(
        thrust=thrust1_sl,
        isp=true_isp1,
        a_ref=float(a_ref),
        cd=ConstantCd(true_cd),
    )
    
    stage2 = StageParams(
        thrust=thrust2_vac,
        isp=true_isp2,
        a_ref=float(a_ref),
        cd=ConstantCd(true_cd),
    )
    
    vehicle = VehicleParams(
        m0=m0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=true_m1_dry,
        m2_dry=true_m2_dry,
        t1_burn=true_t1_burn,
        t2_burn=t2_burn,
    )
    
    # Setup Config
    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=4.0 * math.pi / 180.0,
        t_burn2=t2_burn, # Start with full burn? Or allow optimization?
                         # The shooting solver optimizes t_burn2.
                         # But physically, the stage 2 burn is LIMITED by propellant.
                         # In shooting.py, t_burn2 is a control variable.
        t_coast=50.0,
        v_eps=1e-3,
        dt0=0.1,
        rtol=1e-6,
        atol=1e-6,
        root_rtol=1e-5,
        root_atol=1e-5,
        t_max=2000.0,
        max_steps=100_000,
    )
    
    mission = MissionParams(h_target, payload_mass)
    
    config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=100.0,
    )
    
    # Sweep theta0 to find a valid trajectory
    print("\n--- Sweeping theta0 ---")
    best_theta = 0.0
    max_r = 0.0
    
    for theta_deg in np.linspace(0.5, 6.0, 12):
        numerics_new = replace(numerics, theta0=theta_deg * math.pi / 180.0)
        
        # Reset numerics in config
        config_new = replace(config, numerics=numerics_new)
        
        try:
            # We run simulate_ascent directly first to avoid Newton crash
            traj = shooting.simulate_ascent(config_new)
            
            # Check apogee
            # Convert to numpy to avoid JIT array issues if any
            t_np = np.array(traj.t)
            if np.any(np.isfinite(t_np)):
                r_vals = np.array(traj.r)
                r_max_reach = float(np.max(r_vals[np.isfinite(t_np)]))
            else:
                r_max_reach = 0.0
            
            print(f"Theta0: {theta_deg:.2f} deg -> Max Radius: {r_max_reach:.1f} m")
            
            if r_max_reach > max_r:
                max_r = r_max_reach
                best_theta = theta_deg
                
        except Exception as e:
            print(f"Theta0: {theta_deg:.2f} deg -> Error: {e}")

    print(f"\nBest Theta0 found: {best_theta:.2f} deg (Max R: {max_r:.1f} m)")
    
    # Run Solver with Best Theta
    print(f"Running Shooting Solver with theta0={best_theta:.2f} deg...")
    numerics_best = replace(numerics, theta0=best_theta * math.pi / 180.0)
    config = replace(config, numerics=numerics_best)

    # Try to solve for orbit
    try:
        opt_config, traj = shooting.solve_circular_orbit(config)
        
        # Check results
        r_final = float(traj.r[-1]) if len(traj.r) > 0 else 0.0
        # Use safe extraction
        t_arr = np.array(traj.t)
        if np.any(np.isfinite(t_arr)):
            last_idx = np.max(np.where(np.isfinite(t_arr))[0])
            r_final = float(traj.r[last_idx])
            v_final = float(traj.v[last_idx])
        
        r_target = earth.r_e + h_target
        print(f"Final Radius: {r_final:.1f} m (Target: {r_target:.1f} m)")
        print(f"Final Velocity: {v_final:.1f} m/s")
        print(f"Optimized theta0: {opt_config.numerics.theta0 * 180 / math.pi:.2f} deg")
        print(f"Optimized t_burn2: {opt_config.numerics.t_burn2:.2f} s (Max: {t2_burn:.2f} s)")
        
        if opt_config.numerics.t_burn2 > t2_burn + 1.0:
            print("FAILURE: Required t_burn2 exceeds available propellant duration!")
        elif abs(r_final - r_target) > 1000.0:
            print(f"FAILURE: Did not reach target altitude. Diff: {r_final - r_target:.1f} m")
        else:
            print("SUCCESS: True vehicle is capable of reaching orbit.")
            
    except Exception as e:
        print(f"Simulation Failed: {e}")

if __name__ == "__main__":
    main()
