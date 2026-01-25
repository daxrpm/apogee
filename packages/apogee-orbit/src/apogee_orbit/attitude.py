"""Yaw steering calculation for equatorial orbits.

This module implements the classical yaw steering law used by GPS and
communication satellites to keep solar panels facing the sun.
"""
from __future__ import annotations

import numpy as np

from .core import EquatorialOrbit
from .types import AttitudeSolution


def calculate_yaw_steering(orbit: EquatorialOrbit, t: float, sun_eci: tuple[float, float, float]) -> AttitudeSolution:
    """Calculate the optimal yaw steering angle using the standard yaw steering law (US20070090229A1).
    
    The standard yaw steering law is:
    
        ψ = atan2(tan(β), sin(η))
    
    Where:
        β = beta angle (sun elevation above orbit plane)
        η = orbit angle from "Noon" (Sun projection) = ν - α
            (η = 0 at Noon, η = π/2 at Dusk, η = π at Midnight, η = 3π/2 at Dawn)
    
    This formula produces:
        - ψ = ±90° at Noon/Midnight (η = 0 or π) - Singularity points
        - ψ = β at Dusk (η = π/2)
        - ψ = -β at Dawn (η = 3π/2)
    
    Reference Frame Convention:
        - At ν = α (η = 0): satellite is at "Noon" (Sub-solar longitude)
          → This gives FAST yaw change (High Yaw)
        - At ν = α + 90° (η = 90°): satellite is at "Dusk" (6 PM)
          → This gives LOW yaw (ψ = β)
    
    Args:
        orbit: EquatorialOrbit instance
        t: Time since epoch [s]
        sun_eci: Sun vector in ECI frame
    
    Returns:
        AttitudeSolution with yaw, beta, panel angle, and sun in body frame
    """
    # Normalize sun vector
    s = np.array(sun_eci, dtype=float)
    s_norm = np.linalg.norm(s)
    if s_norm < 1e-9:
        raise ValueError("Sun vector is too small")
    s = s / s_norm
    
    sun_x, sun_y, sun_z = s[0], s[1], s[2]
    
    # ==========================================================================
    # STANDARD YAW STEERING FORMULA (US20070090229A1 Style)
    # ==========================================================================
    
    # Beta angle: sun elevation above orbit plane
    # For equatorial orbit, orbit normal is +Z, so beta = arcsin(sun_z)
    beta = float(np.arcsin(np.clip(sun_z, -1.0, 1.0)))
    
    # Sun azimuth in orbit plane
    alpha = float(np.arctan2(sun_y, sun_x))
    
    # True anomaly at time t
    nu = orbit.nu_initial + orbit.n * t
    
    # Orbital angle η (eta): measured from Orbit Midnight
    # η = 0 at Midnight (Satellite opposite to Sun)
    # η = 90° at Dawn (6 AM)
    # η = 180° at Noon (Satellite towards Sun)
    # η = 270° (-90°) at Dusk (6 PM)
    eta = nu - alpha - np.pi
    
    # Standard formula: ψ = atan2(tan(β), sin(η))
    # With η from Midnight:
    # - 6 AM (η=90°): ψ = β
    # - 6 PM (η=270°): ψ = 180° - β
    psi = float(np.arctan2(np.tan(beta), np.sin(eta)))
    
    # ==========================================================================
    # GET LVLH BASIS AND COMPUTE SUN IN BODY FRAME
    # ==========================================================================
    
    # Get LVLH basis vectors
    x_lvlh, y_lvlh, z_lvlh = orbit.get_lvlh_basis(t)
    
    # Project Sun vector into LVLH frame
    sx_lvlh = float(np.dot(s, x_lvlh))
    sy_lvlh = float(np.dot(s, y_lvlh))
    sz_lvlh = float(np.dot(s, z_lvlh))
    
    # Apply yaw rotation (rotation around Z_lvlh by angle psi)
    cos_psi = np.cos(psi)
    sin_psi = np.sin(psi)
    
    s_bx = cos_psi * sx_lvlh + sin_psi * sy_lvlh
    s_by = -sin_psi * sx_lvlh + cos_psi * sy_lvlh
    s_bz = sz_lvlh
    
    # ==========================================================================
    # PANEL ANGLE (SADM): rotation of solar panels around body Y axis
    # ==========================================================================
    
    # SADM Convention (Standard):
    # - Panel normal at angle = 0 points along Body Z (Nadir)
    # - Positive rotation rotates the normal from Body Z toward Body X
    # - To face the sun (s_bx, s_by, s_bz): phi = atan2(s_bx, s_bz)
    
    # This matches the patent diagram (US20070090229A1):
    # At Noon (η=0, ψ=90°): 
    #   s_bx = -sin(beta), s_bz = -cos(beta)
    #   phi = atan2(-sin(beta), -cos(beta)) = -(180° - beta)
    panel_angle = float(np.arctan2(s_bx, s_bz))

    return AttitudeSolution(
        t=t,
        yaw=float(psi),
        beta=beta,
        sun_body=(float(s_bx), float(s_by), float(s_bz)),
        panel_angle=panel_angle
    )
