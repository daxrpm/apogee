"""Orbit simulation endpoints."""

import logging
import math
import time

import numpy as np
from fastapi import APIRouter, HTTPException

from apogee_orbit import EquatorialOrbit, calculate_yaw_steering

from ..schemas.orbit import (
    OrbitTrajectoryRequest,
    OrbitTrajectoryResponse,
    YawRequest,
    YawResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/trajectory", response_model=OrbitTrajectoryResponse)
async def get_orbit_trajectory(request: OrbitTrajectoryRequest):
    """Get full orbit trajectory with yaw steering profile.
    
    This endpoint propagates the orbit and calculates yaw steering angles
    for every point. Use after /launch/simulate to visualize the orbit.
    
    Typical response time: ~100ms
    """
    start_time = time.time()
    logger.info(f"POST /orbit/trajectory - r={request.r_m/1000:.0f}km, nu0={math.degrees(request.nu_initial_rad):.1f}deg, n_points={request.n_points}")
    
    try:
        # Create orbit
        orbit = EquatorialOrbit(r=request.r_m, nu_initial=request.nu_initial_rad)
        period = orbit.period
        
        # Duration
        t_duration = request.t_duration_s if request.t_duration_s is not None else period
        
        # Sun vector
        sun_vector = (request.sun_x, request.sun_y, request.sun_z)
        
        # Generate time array
        t_array = np.linspace(0.0, t_duration, request.n_points)
        
        # Arrays for output
        x_arr, y_arr, z_arr = [], [], []
        yaw_rad_arr, yaw_deg_arr = [], []
        beta_rad_arr, beta_deg_arr = [], []
        nu_arr = []
        
        # Calculate for each point
        for t in t_array:
            # Get state
            state = orbit.get_state(float(t))
            x_arr.append(float(state.r_eci[0]))
            y_arr.append(float(state.r_eci[1]))
            z_arr.append(float(state.r_eci[2]))
            nu_arr.append(float(state.nu))
            
            # Get yaw
            sol = calculate_yaw_steering(orbit, float(t), sun_vector)
            yaw_rad_arr.append(float(sol.yaw))
            yaw_deg_arr.append(float(math.degrees(sol.yaw)))
            beta_rad_arr.append(float(sol.beta))
            beta_deg_arr.append(float(math.degrees(sol.beta)))
        
        elapsed = time.time() - start_time
        logger.info(f"Trajectory computed in {elapsed*1000:.1f}ms - {request.n_points} points, period={period:.0f}s")
        
        return OrbitTrajectoryResponse(
            orbit_params={
                "semi_major_axis_m": float(request.r_m),
                "period_s": float(period),
                "mean_motion_rad_s": float(orbit.n),
                "nu_initial_rad": float(request.nu_initial_rad),
                "t_duration_s": float(t_duration),
            },
            trajectory={
                "x_m": x_arr,
                "y_m": y_arr,
                "z_m": z_arr,
            },
            yaw_steering={
                "t_s": [float(t) for t in t_array],
                "yaw_rad": yaw_rad_arr,
                "yaw_deg": yaw_deg_arr,
                "beta_rad": beta_rad_arr,
                "beta_deg": beta_deg_arr,
                "nu_rad": nu_arr,
            },
        )
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Trajectory calculation failed after {elapsed*1000:.1f}ms: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Trajectory calculation failed: {str(e)}")


@router.post("/yaw", response_model=YawResponse)
async def get_yaw_instant(request: YawRequest):
    """Get instant yaw calculation for a single time point.
    
    This is the FAST endpoint for live sun updates.
    Call this on every sun drag event.
    
    Typical response time: <5ms
    """
    start_time = time.time()
    
    try:
        # Create orbit
        orbit = EquatorialOrbit(r=request.r_m, nu_initial=request.nu_initial_rad)
        
        # Sun vector
        sun_vector = (request.sun_x, request.sun_y, request.sun_z)
        
        # Calculate yaw
        sol = calculate_yaw_steering(orbit, request.t_s, sun_vector)
        
        # Get satellite position
        state = orbit.get_state(request.t_s)
        
        elapsed = time.time() - start_time
        logger.debug(f"Yaw calculated in {elapsed*1000:.2f}ms - yaw={math.degrees(sol.yaw):.1f}deg")
        
        return YawResponse(
            yaw_rad=float(sol.yaw),
            yaw_deg=float(math.degrees(sol.yaw)),
            beta_rad=float(sol.beta),
            beta_deg=float(math.degrees(sol.beta)),
            sun_body=[float(sol.sun_body[0]), float(sol.sun_body[1]), float(sol.sun_body[2])],
            satellite_position=[float(state.r_eci[0]), float(state.r_eci[1]), float(state.r_eci[2])],
        )
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Yaw calculation failed after {elapsed*1000:.2f}ms: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Yaw calculation failed: {str(e)}")
