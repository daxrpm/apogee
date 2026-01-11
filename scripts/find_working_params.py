"""Find working control parameters through systematic search."""
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
    simulate_ascent,
)
from apogee_core.calibration import ConstantCd

# Correct Falcon 9 parameters
m0 = 549_054.0
thrust1 = 7_686_000.0
thrust2 = 981_000.0
isp1 = 282.0
isp2 = 348.0
t2_burn = 397.0

m1_dry = 22_000.0
m2_dry = 4_000.0
interstage = 2_000.0

g0 = 9.80665
total_dry = m1_dry + m2_dry + interstage
available_prop = m0 - total_dry
m2_prop = (thrust2 * t2_burn) / (isp2 * g0)
m1_prop = available_prop - m2_prop
t1_burn = (m1_prop * isp1 * g0) / thrust1

earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
mission = MissionParams(h_target=200_000.0, payload_mass=0.0)

diameter = 3.7
a_ref = math.pi * (diameter / 2.0) ** 2

stage1 = StageParams(thrust=thrust1, isp=isp1, a_ref=a_ref, cd=ConstantCd(0.3))
stage2 = StageParams(thrust=thrust2, isp=isp2, a_ref=a_ref, cd=ConstantCd(0.24))

vehicle = VehicleParams(
    m0=m0,
    stage1=stage1,
    stage2=stage2,
    m1_dry=m1_dry,
    m2_dry=m2_dry,
    t1_burn=t1_burn,
    t2_burn=t2_burn,
)

r_target = earth.r_e + mission.h_target
v_circ = math.sqrt(earth.mu / r_target)

print(f"Target: h={mission.h_target/1000:.0f} km, v={v_circ:.1f} m/s")
print()

best_error = float('inf')
best_params = None

# Grid search
theta0_vals = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
t_coast_vals = [30.0, 50.0, 70.0, 90.0]
t_burn2_vals = [180.0, 200.0, 220.0, 240.0, 260.0]

total_tests = len(theta0_vals) * len(t_coast_vals) * len(t_burn2_vals)
test_num = 0

for theta0_deg in theta0_vals:
    for t_coast in t_coast_vals:
        for t_burn2 in t_burn2_vals:
            test_num += 1
            
            theta0 = theta0_deg * math.pi / 180.0
            
            numerics = NumericsParams(
                h_pitch_over=200.0,
                theta0=theta0,
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
            
            try:
                traj = simulate_ascent(config)
                
                t_arr = np.array(traj.t)
                mask = np.isfinite(t_arr)
                
                if np.any(mask):
                    last_idx = np.max(np.where(mask)[0])
                    
                    r_final = float(traj.r[last_idx])
                    v_final = float(traj.v[last_idx])
                    gamma_final = float(traj.gamma[last_idx])
                    m_final = float(traj.m[last_idx])
                    
                    # Check validity
                    if r_final > earth.r_e + 1000 and m_final > m2_dry:
                        # Calculate error
                        r_err = abs(r_final - r_target) / r_target
                        v_err = abs(v_final - v_circ) / v_circ
                        gamma_err = abs(gamma_final)
                        
                        total_err = r_err + v_err + gamma_err
                        
                        if total_err < best_error:
                            best_error = total_err
                            best_params = (theta0_deg, t_coast, t_burn2, r_err, v_err, gamma_err)
                            
                            print(f"[{test_num}/{total_tests}] New best: θ={theta0_deg:.1f}°, t_coast={t_coast:.0f}s, t_burn2={t_burn2:.0f}s")
                            print(f"  r_err={r_err*100:.4f}%, v_err={v_err*100:.4f}%, γ={gamma_final*180/math.pi:.4f}°")
                            print(f"  Total error: {total_err:.6f}")
                            
            except Exception:
                pass

print()
print("="*60)
if best_params:
    theta0_deg, t_coast, t_burn2, r_err, v_err, gamma_err = best_params
    print(f"Best parameters found:")
    print(f"  theta0 = {theta0_deg:.1f} degrees")
    print(f"  t_coast = {t_coast:.1f} seconds")
    print(f"  t_burn2 = {t_burn2:.1f} seconds")
    print(f"  Errors: r={r_err*100:.4f}%, v={v_err*100:.4f}%, γ={gamma_err*180/math.pi:.4f}°")
else:
    print("No valid solution found!")
