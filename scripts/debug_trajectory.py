"""Debug trajectory to see what's happening."""
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

print(f"Vehicle parameters:")
print(f"  m0 = {m0:.0f} kg")
print(f"  t1_burn = {t1_burn:.2f} s")
print(f"  m1_prop = {m1_prop:.0f} kg")
print(f"  m2_prop = {m2_prop:.0f} kg")
print()

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

# Try with manual controls
numerics = NumericsParams(
    h_pitch_over=200.0,
    theta0=6.0 * math.pi / 180.0,  # 6 degrees
    t_burn2=200.0,  # 200 seconds
    t_coast=50.0,   # 50 seconds coast
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

print("Running simulation with manual controls...")
print(f"  theta0 = {numerics.theta0 * 180 / math.pi:.2f} deg")
print(f"  t_coast = {numerics.t_coast:.1f} s")
print(f"  t_burn2 = {numerics.t_burn2:.1f} s")
print()

try:
    traj = simulate_ascent(config)
    
    # Check trajectory
    t_arr = np.array(traj.t)
    mask = np.isfinite(t_arr)
    
    if not np.any(mask):
        print("✗ No valid trajectory points!")
    else:
        last_idx = np.max(np.where(mask)[0])
        
        t_final = float(traj.t[last_idx])
        r_final = float(traj.r[last_idx])
        h_final = float(traj.h[last_idx])
        v_final = float(traj.v[last_idx])
        gamma_final = float(traj.gamma[last_idx])
        m_final = float(traj.m[last_idx])
        
        print(f"Final state:")
        print(f"  Time: {t_final:.1f} s")
        print(f"  Altitude: {h_final/1000:.1f} km")
        print(f"  Radius: {r_final:.1f} m")
        print(f"  Velocity: {v_final:.1f} m/s")
        print(f"  FPA: {gamma_final * 180/math.pi:.2f} deg")
        print(f"  Mass: {m_final:.1f} kg")
        print()
        
        # Check if we crashed
        if r_final < earth.r_e + 1000:
            print("✗ Vehicle crashed!")
        elif m_final < m2_dry:
            print("✗ Ran out of fuel!")
        else:
            # Check orbit
            r_target = earth.r_e + mission.h_target
            v_circ = math.sqrt(earth.mu / r_target)
            
            print(f"Orbit check:")
            print(f"  Target altitude: {mission.h_target/1000:.1f} km")
            print(f"  Target velocity: {v_circ:.1f} m/s")
            print(f"  Altitude error: {(h_final - mission.h_target)/1000:.1f} km")
            print(f"  Velocity error: {v_final - v_circ:.1f} m/s")
            print(f"  Eccentricity: {float(traj.orbit.eccentricity):.6f}")
            
except Exception as e:
    print(f"✗ Simulation failed: {e}")
    import traceback
    traceback.print_exc()
