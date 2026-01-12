"""Production-ready rocket simulator with fixed Falcon 9 parameters.

This simulator uses realistic Falcon 9 parameters from literature and
solves the 3x3 shooting problem to achieve circular orbit insertion.
"""
from __future__ import annotations

from dataclasses import replace
import math
import time
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


def _finite_last_index(t: np.ndarray) -> int:
    mask = np.isfinite(t)
    if not mask.any():
        return -1
    return int(np.sum(mask) - 1)


def run_continuation_sweep(
    *,
    alts_km: list[int],
    payloads_kg: list[int],
    timeout_s: int = 75,
):
    import signal

    def _timeout_handler(signum, frame):
        raise TimeoutError(f"timeout after {timeout_s}s")

    signal.signal(signal.SIGALRM, _timeout_handler)

    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)

    fails: list[tuple[int, int, str]] = []
    oks: list[tuple[int, int, float, float, float]] = []

    print("FULL continuation sweep")
    print("alts_km:", alts_km)
    print("payloads_kg:", payloads_kg)
    print("timeout_s:", timeout_s, flush=True)

    for payload in payloads_kg:
        payload_mass = float(payload)
        seed = dict(theta0=8.0 * math.pi / 180.0, t_coast=50.0, t_burn2=300.0, alpha2=0.0)

        for h_km in alts_km:
            h_target = float(h_km) * 1000.0
            mission = MissionParams(h_target=h_target, payload_mass=payload_mass)
            numerics = NumericsParams(
                h_pitch_over=200.0,
                theta0=float(seed["theta0"]),
                t_burn2=float(seed["t_burn2"]),
                t_coast=float(seed["t_coast"]),
                v_eps=1e-3,
                dt0=0.5,
                rtol=1e-6,
                atol=1e-6,
                root_rtol=1e-6,
                root_atol=1e-3,
                t_max=2000.0,
                max_steps=100_000,
                alpha2=float(seed["alpha2"]),
            )

            base_config = create_falcon9_config(h_target, payload_mass)
            base_config = replace(base_config, earth=earth, mission=mission, numerics=numerics)

            label = f"h={h_km}km payload={payload}kg"
            try:
                t0 = time.time()
                signal.alarm(int(timeout_s))
                opt_config, traj = solve_circular_orbit(base_config)
                signal.alarm(0)

                idx = _finite_last_index(np.array(traj.t))
                if idx < 0:
                    raise RuntimeError("empty trajectory")
                h_final = float(traj.h[idx])
                v_final = float(traj.v[idx])
                gamma_final = float(traj.gamma[idx])
                ecc = float(traj.orbit.eccentricity)

                r_target = earth.r_e + h_target
                v_circ = math.sqrt(earth.mu / r_target)

                dt = time.time() - t0
                oks.append((h_km, payload, ecc, h_final - h_target, dt))
                print(
                    f"OK {label} dt_s={dt:.2f} ecc={ecc:.6g} h_err={h_final-h_target:+.1f} v_err={v_final-v_circ:+.3f} gamma_deg={gamma_final*180/math.pi:+.4f}",
                    flush=True,
                )

                seed = dict(
                    theta0=float(opt_config.numerics.theta0),
                    t_coast=float(opt_config.numerics.t_coast),
                    t_burn2=float(opt_config.numerics.t_burn2),
                    alpha2=float(opt_config.numerics.alpha2),
                )
            except Exception as e:
                signal.alarm(0)
                msg = f"{type(e).__name__}: {e}"
                fails.append((h_km, payload, msg))
                print(f"FAIL {label} -> {msg}", flush=True)

    print("\nSUMMARY")
    print("ok", len(oks), "fail", len(fails))
    if fails:
        for h_km, payload, msg in fails:
            print("FAIL_CASE", h_km, "km", payload, "kg", msg)

    oks_sorted = sorted(oks, key=lambda x: x[2], reverse=True)
    print("\nWORST ecc (top 10):")
    for h_km, payload, ecc, herr, dt in oks_sorted[:10]:
        print(f"  h={h_km}km payload={payload}kg ecc={ecc:.6g} h_err={herr:+.1f} dt_s={dt:.2f}")

    herr_sorted = sorted(oks, key=lambda x: abs(x[3]), reverse=True)
    print("\nWORST |h_err| (top 10):")
    for h_km, payload, ecc, herr, dt in herr_sorted[:10]:
        print(f"  h={h_km}km payload={payload}kg h_err={herr:+.1f} ecc={ecc:.6g} dt_s={dt:.2f}")

    return oks, fails


def main():
    alts_km = [160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400]
    payloads_kg = [0, 2000, 5000, 8000, 10000]
    run_continuation_sweep(alts_km=alts_km, payloads_kg=payloads_kg, timeout_s=75)


if __name__ == "__main__":
    main()
