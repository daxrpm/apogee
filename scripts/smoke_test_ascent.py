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
    simulate_ascent,
    solve_circular_orbit,
)
from apogee_core.calibration import ConstantCd


def main() -> None:
    earth = EarthParams(
        r_e=6_371_000.0,
        mu=3.986004418e14,
        g0=9.80665,
    )

    mission = MissionParams(
        h_target=200_000.0,
        payload_mass=0.0,
    )

    diameter = 3.7
    a_ref = math.pi * (diameter / 2.0) ** 2

    stage1 = StageParams(
        thrust=7_686_000.0,
        isp=280.0,
        a_ref=a_ref,
        cd=ConstantCd(0.3),
    )
    stage2 = StageParams(
        thrust=981_000.0,
        isp=340.0,
        a_ref=a_ref,
        cd=ConstantCd(0.2),
    )

    vehicle = VehicleParams(
        m0=549_054.0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=30_000.0,
        m2_dry=4_000.0,
        t1_burn=160.0,
        t2_burn=397.0,
    )

    numerics = NumericsParams(
        h_pitch_over=200.0,
        theta0=10.0 * math.pi / 180.0,
        t_burn2=170.0,
        t_coast=100.0,
        v_eps=1e-3,
        dt0=0.25,
        rtol=1e-5,
        atol=1e-5,
        root_rtol=1e-5,
        root_atol=1e-3,
        t_max=2_000.0,
        max_steps=200_000,
    )

    config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=50.0,
    )

    traj = simulate_ascent(config)

    print("--- terminal ---")
    print("t_end", float(traj.t[-1]))
    print("h_end", float(traj.h[-1]))
    print("v_end", float(traj.v[-1]))
    print("gamma_end", float(traj.gamma[-1]))
    print("m_end", float(traj.m[-1]))

    print("--- orbit diagnostics (cutoff) ---")
    print("eps", float(traj.orbit.specific_energy))
    print("h_ang", float(traj.orbit.specific_angular_momentum))
    print("a", float(traj.orbit.semi_major_axis))
    print("e", float(traj.orbit.eccentricity))
    print("r_apo", float(traj.orbit.r_apoapsis))
    print("r_peri", float(traj.orbit.r_periapsis))

    print("--- trajectory shapes ---")
    print("n", traj.t.shape[0])

    print("\n--- shooting solve (circular orbit) ---")
    opt_config, opt_traj = solve_circular_orbit(config)

    r_target = opt_config.earth.r_e + opt_config.mission.h_target
    v_circ = math.sqrt(opt_config.earth.mu / r_target)

    print("theta0* (deg)", float(opt_config.numerics.theta0 * 180.0 / math.pi))
    print("t_burn2*", float(opt_config.numerics.t_burn2))
    print("t_coast*", float(opt_config.numerics.t_coast))
    print("r_cut", float(opt_traj.r[-1]), "r_target", float(r_target))
    print("v_cut", float(opt_traj.v[-1]), "v_circ", float(v_circ))
    print("gamma_cut (deg)", float(opt_traj.gamma[-1] * 180.0 / math.pi))
    print("e", float(opt_traj.orbit.eccentricity))


if __name__ == "__main__":
    main()
