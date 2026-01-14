"""Orbital simulator - Full pipeline from launch to yaw steering.

Provides clean API for calculating yaw steering angles over an orbit.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from apogee_launch import solve_to_circular_orbit as launch_solve

from .core import EquatorialOrbit
from .attitude import calculate_yaw_steering

logger = logging.getLogger(__name__)


@dataclass
class OrbitResult:
    """Result from orbital yaw steering calculation."""
    
    schema_version: int
    inputs: dict[str, Any]
    orbit_params: dict[str, float]
    yaw_steering: dict[str, list[float]]


def calculate_orbit_yaw(
    h_target_km: float,
    payload_kg: float,
    sun_vector: tuple[float, float, float] = (1.0, 0.0, 0.0),
    *,
    t_duration_s: float | None = None,
    n_points: int = 100,
) -> OrbitResult:
    """Calculate yaw steering angles for a full orbit after launch.
    
    This function:
    1. Runs the launch simulation (shooting method)
    2. Extracts orbital parameters (radius, initial angle)
    3. Propagates the orbit and calculates yaw steering at each point
    
    Args:
        h_target_km: Target altitude [km]
        payload_kg: Payload mass [kg]
        sun_vector: Sun direction vector in ECI frame (arbitrary magnitude)
        t_duration_s: Duration to simulate [s] (None = one full orbit)
        n_points: Number of points to calculate
    
    Returns:
        OrbitResult with yaw steering profile
    """
    logger.info(f"Starting orbit simulation: h_target={h_target_km:.1f}km, payload={payload_kg:.1f}kg")
    
    # --- Phase 1: Launch Simulation ---
    logger.info("Phase 1: Running launch simulation...")
    launch_result = launch_solve(
        h_target_km=h_target_km,
        payload_kg=payload_kg,
        include_trajectory=True,
        trim=True,
    )
    
    if launch_result.trajectory is None:
        raise RuntimeError("Launch simulation did not return trajectory data")
    
    # Extract orbital parameters from launch
    orbit_data = launch_result.trajectory.get("orbit", {})
    semi_major_axis = orbit_data.get("semi_major_axis")
    eccentricity = orbit_data.get("eccentricity", 0.0)
    
    if semi_major_axis is None:
        raise RuntimeError("Launch simulation did not return semi_major_axis")
    
    # Get final position angle (lambda) for continuity
    lambda_rad_list = launch_result.trajectory.get("lambda_rad", [0.0])
    lambda_final = float(lambda_rad_list[-1]) if lambda_rad_list else 0.0
    
    logger.info(f"Launch complete: a={semi_major_axis:.0f}m, e={eccentricity:.6f}, λ_final={math.degrees(lambda_final):.2f}°")
    
    # --- Phase 2: Orbit Setup ---
    logger.info("Phase 2: Setting up circular equatorial orbit...")
    orbit = EquatorialOrbit(r=semi_major_axis, nu_initial=lambda_final)
    
    period = orbit.period
    if t_duration_s is None:
        t_duration_s = period
        logger.info(f"Simulating one full orbit: T={period:.1f}s ({period/60:.1f} min)")
    else:
        logger.info(f"Simulating {t_duration_s:.1f}s ({t_duration_s/period:.2f} orbits)")
    
    # --- Phase 3: Yaw Steering Calculation ---
    logger.info(f"Phase 3: Calculating yaw steering for {n_points} points...")
    logger.debug(f"Sun vector: {sun_vector}")
    
    t_array = np.linspace(0.0, t_duration_s, n_points)
    yaw_array = []
    beta_array = []
    nu_array = []
    
    for t in t_array:
        sol = calculate_yaw_steering(orbit, float(t), sun_vector)
        yaw_array.append(float(sol.yaw))
        beta_array.append(float(sol.beta))
        nu_array.append(float(orbit.nu_initial + orbit.n * t))
    
    logger.info("Yaw steering calculation complete")
    
    return OrbitResult(
        schema_version=1,
        inputs={
            "h_target_km": float(h_target_km),
            "payload_kg": float(payload_kg),
            "sun_vector": list(sun_vector),
            "t_duration_s": float(t_duration_s),
            "n_points": n_points,
        },
        orbit_params={
            "semi_major_axis_m": float(semi_major_axis),
            "eccentricity": float(eccentricity),
            "period_s": float(period),
            "nu_initial_rad": float(lambda_final),
            "mean_motion_rad_s": float(orbit.n),
        },
        yaw_steering={
            "t_s": [float(t) for t in t_array],
            "yaw_rad": yaw_array,
            "yaw_deg": [math.degrees(y) for y in yaw_array],
            "beta_rad": beta_array,
            "beta_deg": [math.degrees(b) for b in beta_array],
            "nu_rad": nu_array,
        },
    )


def calculate_orbit_yaw_standalone(
    r_m: float,
    nu_initial_rad: float,
    sun_vector: tuple[float, float, float] = (1.0, 0.0, 0.0),
    *,
    t_duration_s: float | None = None,
    n_points: int = 100,
) -> OrbitResult:
    """Calculate yaw steering without running launch simulation.
    
    Use this when you already have orbital parameters from a previous launch.
    
    Args:
        r_m: Orbital radius [m] (semi-major axis)
        nu_initial_rad: Initial true anomaly [rad]
        sun_vector: Sun direction vector in ECI frame
        t_duration_s: Duration to simulate [s] (None = one full orbit)
        n_points: Number of points to calculate
    
    Returns:
        OrbitResult with yaw steering profile
    """
    logger.info(f"Standalone orbit simulation: r={r_m:.0f}m, nu_0={math.degrees(nu_initial_rad):.2f}°")
    
    orbit = EquatorialOrbit(r=r_m, nu_initial=nu_initial_rad)
    period = orbit.period
    
    if t_duration_s is None:
        t_duration_s = period
    
    t_array = np.linspace(0.0, t_duration_s, n_points)
    yaw_array = []
    beta_array = []
    nu_array = []
    
    for t in t_array:
        sol = calculate_yaw_steering(orbit, float(t), sun_vector)
        yaw_array.append(float(sol.yaw))
        beta_array.append(float(sol.beta))
        nu_array.append(float(orbit.nu_initial + orbit.n * t))
    
    return OrbitResult(
        schema_version=1,
        inputs={
            "r_m": float(r_m),
            "nu_initial_rad": float(nu_initial_rad),
            "sun_vector": list(sun_vector),
            "t_duration_s": float(t_duration_s),
            "n_points": n_points,
        },
        orbit_params={
            "semi_major_axis_m": float(r_m),
            "eccentricity": 0.0,
            "period_s": float(period),
            "nu_initial_rad": float(nu_initial_rad),
            "mean_motion_rad_s": float(orbit.n),
        },
        yaw_steering={
            "t_s": [float(t) for t in t_array],
            "yaw_rad": yaw_array,
            "yaw_deg": [math.degrees(y) for y in yaw_array],
            "beta_rad": beta_array,
            "beta_deg": [math.degrees(b) for b in beta_array],
            "nu_rad": nu_array,
        },
    )
