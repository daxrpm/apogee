"""Launch simulator - migrated from scripts/production_simulator.py.

Maintains all original logic while providing clean API for FastAPI.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import jax
jax.config.update("jax_enable_x64", True)
import numpy as np

from apogee_physics import (
    AscentConfig,
    EarthParams,
    MissionParams,
    NumericsParams,
    StageParams,
    VehicleParams,
    simulate_ascent,
    solve_circular_orbit,
    trajectory_to_dict,
    Trajectory,
)
from apogee_physics.calibration import ConstantCd

from .falcon9 import FALCON9_DEFAULT, Falcon9Params


@dataclass
class LaunchResult:
    """Result from launch simulation."""
    
    schema_version: int
    inputs: dict[str, float]
    optimal_numerics: dict[str, float]
    summary: dict[str, float]
    trajectory: dict[str, Any] | None


def create_falcon9_vehicle(
    payload_mass: float = 0.0,
    *,
    params: Falcon9Params = FALCON9_DEFAULT,
) -> tuple[VehicleParams, float, float, float]:
    """Create Falcon 9 vehicle configuration with correct mass budget.
    
    Args:
        payload_mass: Payload mass [kg]
        params: Falcon 9 parameters (defaults to official values)
    
    Returns:
        (vehicle, t1_burn, m1_prop, m2_prop)
    """
    g0 = 9.80665
    
    total_dry = params.m1_dry + params.m2_dry + params.interstage
    available_prop = params.m0 - total_dry - payload_mass
    
    m2_prop = (params.thrust2 * params.t2_burn) / (params.isp2 * g0)
    m1_prop = available_prop - m2_prop
    t1_burn = (m1_prop * params.isp1 * g0) / params.thrust1
    
    total_check = total_dry + m1_prop + m2_prop + payload_mass
    assert abs(total_check - params.m0) < 1.0, f"Mass budget error: {total_check} != {params.m0}"
    
    a_ref = math.pi * (params.diameter / 2.0) ** 2
    
    stage1 = StageParams(
        thrust=params.thrust1,
        isp=params.isp1,
        a_ref=a_ref,
        cd=ConstantCd(0.3),
    )
    
    stage2 = StageParams(
        thrust=params.thrust2,
        isp=params.isp2,
        a_ref=a_ref,
        cd=ConstantCd(0.24),
    )
    
    vehicle = VehicleParams(
        m0=params.m0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=params.m1_dry,
        m2_dry=params.m2_dry,
        t1_burn=t1_burn,
        t2_burn=params.t2_burn,
    )
    
    return vehicle, t1_burn, m1_prop, m2_prop


def simulate_to_orbit(
    h_target_km: float,
    payload_kg: float,
    *,
    theta0_deg: float | None = None,
    t_coast: float | None = None,
    t_burn2: float | None = None,
    h_pitch_over: float = 200.0,
    v_eps: float = 1e-3,
    dt0: float = 0.5,
    rtol: float = 1e-6,
    atol: float = 1e-6,
    root_rtol: float = 1e-6,
    root_atol: float = 1e-3,
    t_max: float = 2000.0,
    max_steps: int = 100_000,
    falcon9_params: Falcon9Params = FALCON9_DEFAULT,
) -> tuple[AscentConfig, Trajectory]:
    """Simulate Falcon 9 ascent to circular orbit.
    
    Args:
        h_target_km: Target altitude [km]
        payload_kg: Payload mass [kg]
        theta0_deg: Pitch-over angle [degrees] (None = auto-scale)
        t_coast: Coast duration [s] (None = auto-scale)
        t_burn2: Stage 2 burn time [s] (None = auto-scale)
        h_pitch_over: Pitch-over altitude [m]
        v_eps: Velocity epsilon for singularity guard [m/s]
        dt0: Initial time step [s]
        rtol: Relative tolerance for ODE solver
        atol: Absolute tolerance for ODE solver
        root_rtol: Relative tolerance for root finding
        root_atol: Absolute tolerance for root finding
        t_max: Maximum simulation time [s]
        max_steps: Maximum ODE steps
        falcon9_params: Falcon 9 vehicle parameters
    
    Returns:
        (config, trajectory)
    """
    h_target = h_target_km * 1000.0
    payload_mass = float(payload_kg)
    
    vehicle, _, _, _ = create_falcon9_vehicle(payload_mass, params=falcon9_params)
    
    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
    mission = MissionParams(h_target=h_target, payload_mass=payload_mass)
    
    if theta0_deg is None or t_coast is None or t_burn2 is None:
        t_burn2_base = 240.0
        theta0_base = 8.0
        t_coast_base = 50.0
        
        t_burn2 = t_burn2_base + (h_target_km - 200.0) * 0.2
        t_burn2 -= (payload_mass / 1000.0) * 5.0
        t_burn2 = max(180.0, min(280.0, t_burn2))
        
        theta0_deg = theta0_base - (h_target_km - 200.0) / 100.0
        theta0_deg = max(6.0, min(9.0, theta0_deg))
        
        t_coast = t_coast_base + (h_target_km - 200.0) * 0.2
        t_coast = max(30.0, min(90.0, t_coast))
    
    numerics = NumericsParams(
        h_pitch_over=h_pitch_over,
        theta0=theta0_deg * math.pi / 180.0,
        t_burn2=t_burn2,
        t_coast=t_coast,
        v_eps=v_eps,
        dt0=dt0,
        rtol=rtol,
        atol=atol,
        root_rtol=root_rtol,
        root_atol=root_atol,
        t_max=t_max,
        max_steps=max_steps,
    )
    
    config = AscentConfig(
        earth=earth,
        mission=mission,
        vehicle=vehicle,
        numerics=numerics,
        atmosphere_z_max=300_000.0,
        atmosphere_dz=100.0,
    )
    
    traj = simulate_ascent(config)
    return config, traj


def solve_to_circular_orbit(
    h_target_km: float,
    payload_kg: float,
    *,
    theta0_initial: float = 8.0,
    t_coast_initial: float = 50.0,
    t_burn2_initial: float = 300.0,
    alpha2_initial: float = 0.0,
    h_pitch_over: float = 200.0,
    v_eps: float = 1e-3,
    dt0: float = 0.5,
    rtol: float = 1e-6,
    atol: float = 1e-6,
    root_rtol: float = 1e-6,
    root_atol: float = 1e-3,
    t_max: float = 2000.0,
    max_steps: int = 100_000,
    atmosphere_z_max: float = 300_000.0,
    atmosphere_dz: float = 100.0,
    trim: bool = True,
    include_trajectory: bool = True,
    falcon9_params: Falcon9Params = FALCON9_DEFAULT,
) -> LaunchResult:
    """Solve for optimal circular orbit insertion using shooting method.
    
    Args:
        h_target_km: Target altitude [km]
        payload_kg: Payload mass [kg]
        theta0_initial: Initial guess for pitch-over angle [degrees]
        t_coast_initial: Initial guess for coast duration [s]
        t_burn2_initial: Initial guess for stage 2 burn time [s]
        alpha2_initial: Initial guess for stage 2 steering angle [rad]
        h_pitch_over: Pitch-over altitude [m]
        v_eps: Velocity epsilon for singularity guard [m/s]
        dt0: Initial time step [s]
        rtol: Relative tolerance for ODE solver
        atol: Absolute tolerance for ODE solver
        root_rtol: Relative tolerance for root finding
        root_atol: Absolute tolerance for root finding
        t_max: Maximum simulation time [s]
        max_steps: Maximum ODE steps
        atmosphere_z_max: Maximum atmosphere altitude [m]
        atmosphere_dz: Atmosphere table spacing [m]
        trim: Trim trajectory to finite values
        include_trajectory: Include full trajectory in result
        falcon9_params: Falcon 9 vehicle parameters
    
    Returns:
        LaunchResult with optimal parameters and trajectory
    """
    if payload_kg < 0.0 or payload_kg > 10_000.0:
        raise ValueError("payload_kg must be in [0, 10000]")
    if h_target_km <= 160.0:
        raise ValueError("h_target_km must be > 160 km (LEO minimum altitude)")

    h_target_m = float(h_target_km) * 1000.0
    payload_mass = float(payload_kg)

    vehicle, _, _, _ = create_falcon9_vehicle(payload_mass, params=falcon9_params)

    earth = EarthParams(r_e=6_371_000.0, mu=3.986004418e14, g0=9.80665)
    mission = MissionParams(h_target=h_target_m, payload_mass=payload_mass)

    numerics = NumericsParams(
        h_pitch_over=h_pitch_over,
        theta0=theta0_initial * math.pi / 180.0,
        t_burn2=t_burn2_initial,
        t_coast=t_coast_initial,
        v_eps=v_eps,
        dt0=dt0,
        rtol=rtol,
        atol=atol,
        root_rtol=root_rtol,
        root_atol=root_atol,
        t_max=t_max,
        max_steps=max_steps,
        alpha2=alpha2_initial,
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

    result = LaunchResult(
        schema_version=1,
        inputs={
            "h_target_km": float(h_target_km),
            "payload_kg": float(payload_kg),
        },
        optimal_numerics={
            "theta0_rad": float(opt_config.numerics.theta0),
            "t_coast_s": float(opt_config.numerics.t_coast),
            "t_burn2_s": float(opt_config.numerics.t_burn2),
            "alpha2_rad": float(opt_config.numerics.alpha2),
        },
        summary={
            "ecc": ecc,
            "h_err_m": float(h_final_m - h_target_m),
            "v_err_mps": float(v_final_mps - v_circ_mps),
            "gamma_deg": float(gamma_final_rad * 180.0 / math.pi),
        },
        trajectory=trajectory_to_dict(traj, trim=trim) if include_trajectory else None,
    )

    return result
