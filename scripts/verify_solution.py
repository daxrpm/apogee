"""Verify that the found parameters work and produce circular orbit."""
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

# Use the best parameters found
numerics = NumericsParams(
    h_pitch_over=200.0,
    theta0=8.0 * math.pi / 180.0,
    t_burn2=240.0,
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

print("Testing with best parameters:")
print(f"  theta0 = {numerics.theta0 * 180/math.pi:.2f}°")
print(f"  t_coast = {numerics.t_coast:.1f} s")
print(f"  t_burn2 = {numerics.t_burn2:.1f} s")
print()

traj = simulate_ascent(config)

t_arr = np.array(traj.t)
mask = np.isfinite(t_arr)
last_idx = np.max(np.where(mask)[0])

r_final = float(traj.r[last_idx])
v_final = float(traj.v[last_idx])
gamma_final = float(traj.gamma[last_idx])
m_final = float(traj.m[last_idx])
h_final = float(traj.h[last_idx])

r_target = earth.r_e + mission.h_target
v_circ = math.sqrt(earth.mu / r_target)

print("Final state:")
print(f"  Altitude: {h_final/1000:.3f} km (target: {mission.h_target/1000:.0f} km)")
print(f"  Velocity: {v_final:.1f} m/s (target: {v_circ:.1f} m/s)")
print(f"  FPA: {gamma_final * 180/math.pi:.4f}° (target: 0°)")
print(f"  Mass: {m_final:.1f} kg")
print()

r_err = abs(r_final - r_target) / r_target * 100
v_err = abs(v_final - v_circ) / v_circ * 100
gamma_err_deg = abs(gamma_final) * 180 / math.pi
ecc = float(traj.orbit.eccentricity)

print("Orbit quality:")
print(f"  Radius error: {r_err:.4f}%")
print(f"  Velocity error: {v_err:.4f}%")
print(f"  FPA error: {gamma_err_deg:.4f}°")
print(f"  Eccentricity: {ecc:.6f}")
print()

if ecc < 0.01 and r_err < 1.0 and v_err < 1.0:
    print("✓✓✓ EXCELLENT: Near-circular orbit achieved!")
elif ecc < 0.05:
    print("✓ GOOD: Orbit is nearly circular")
else:
    print("⚠ Orbit is not circular enough")
