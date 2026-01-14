"""Pydantic schemas for orbit endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class OrbitTrajectoryRequest(BaseModel):
    """Request for full orbit trajectory with yaw steering profile."""
    
    # Orbital parameters (from /launch/simulate response)
    r_m: float = Field(..., gt=0, description="Orbital radius [m] (from trajectory.orbit.semi_major_axis)")
    nu_initial_rad: float = Field(..., description="Initial true anomaly [rad] (from trajectory.lambda_rad[-1])")
    
    # Sun vector (user-controlled, ECI frame)
    sun_x: float = Field(1.0, description="Sun vector X component (ECI)")
    sun_y: float = Field(0.0, description="Sun vector Y component (ECI)")
    sun_z: float = Field(0.0, description="Sun vector Z component (ECI)")
    
    # Time control
    t_duration_s: float | None = Field(None, description="Duration [s] (default: 1 full orbit)")
    n_points: int = Field(100, ge=10, le=1000, description="Number of output points")


class OrbitTrajectoryResponse(BaseModel):
    """Response with full orbit trajectory and yaw steering profile."""
    
    orbit_params: dict[str, float]
    """Orbital parameters: period, mean_motion, etc."""
    
    trajectory: dict[str, list[float]]
    """3D positions: x, y, z arrays [m]"""
    
    yaw_steering: dict[str, list[float]]
    """Yaw/Beta profiles: t_s, yaw_rad, yaw_deg, beta_rad, beta_deg, nu_rad"""


class YawRequest(BaseModel):
    """Request for single-point yaw calculation (fast, for live updates)."""
    
    # Orbital parameters (cached by frontend)
    r_m: float = Field(..., gt=0, description="Orbital radius [m]")
    nu_initial_rad: float = Field(..., description="Initial true anomaly [rad]")
    
    # Sun vector (live from user drag)
    sun_x: float = Field(..., description="Sun vector X component (ECI)")
    sun_y: float = Field(..., description="Sun vector Y component (ECI)")
    sun_z: float = Field(..., description="Sun vector Z component (ECI)")
    
    # Time point
    t_s: float = Field(..., ge=0, description="Time in orbit [s]")


class YawResponse(BaseModel):
    """Response with instant yaw calculation."""
    
    yaw_rad: float
    """Yaw angle [rad]"""
    
    yaw_deg: float
    """Yaw angle [deg]"""
    
    beta_rad: float
    """Beta angle (sun elevation) [rad]"""
    
    beta_deg: float
    """Beta angle [deg]"""
    
    sun_body: list[float]
    """Sun vector in body frame [x, y, z] for debugging"""
    
    satellite_position: list[float]
    """Satellite position in ECI [x, y, z] [m]"""
