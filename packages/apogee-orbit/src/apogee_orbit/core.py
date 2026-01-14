from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np

from .types import OrbitState


@dataclass(frozen=True)
class EquatorialOrbit:
    """Circular equatorial orbit model.
    
    Assumptions:
    - Circular orbit (eccentricity = 0)
    - Equatorial plane (inclination = 0)
    - Earth radius and gravitational parameter are constants from WGS84/USSA76
    """
    
    r: float
    """Orbital radius [m] (semi-major axis)"""
    
    mu: float = 3.986004418e14
    """Earth gravitational parameter [m^3/s^2]"""

    nu_initial: float = 0.0
    """Initial true anomaly [rad] at t=0 (starting position)"""
    
    @property
    def n(self) -> float:
        """Mean motion [rad/s]"""
        return np.sqrt(self.mu / self.r**3)
    
    @property
    def period(self) -> float:
        """Orbital period [s]"""
        return 2 * np.pi / self.n

    def get_state(self, t: float) -> OrbitState:
        """Get satellite state at time t.
        
        Args:
            t: Time since epoch [s] (Assuming nu=0 at t=0)
            
        Returns:
            OrbitState with position and velocity in ECI
        """
        nu = self.nu_initial + self.n * t
        
        # Position in ECI (z=0 for equatorial)
        # r = [r*cos(nu), r*sin(nu), 0]
        rx = self.r * np.cos(nu)
        ry = self.r * np.sin(nu)
        rz = 0.0
        
        # Velocity in ECI
        # v = [-v*sin(nu), v*cos(nu), 0]
        v_mag = self.n * self.r
        vx = -v_mag * np.sin(nu)
        vy = v_mag * np.cos(nu)
        vz = 0.0
        
        return OrbitState(
            t=t,
            nu=nu,
            r_eci=(rx, ry, rz),
            v_eci=(vx, vy, vz)
        )

    def get_lvlh_basis(self, t: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Get LVLH basis vectors in ECI frame.
        
        LVLH Frame Definition:
        - Z (Nadir): Points to Earth center (-r vector)
        - X (Velocity): Points along velocity vector
        - Y (Neg-Normal): Z x X (Points South for equatorial prograde)
        
        Returns:
            Tuple of (x_lvlh, y_lvlh, z_lvlh) as numpy arrays
        """
        nu = self.nu_initial + self.n * t
        sin_nu = np.sin(nu)
        cos_nu = np.cos(nu)
        
        # Z_lvlh = -r_hat = [-cos(nu), -sin(nu), 0]
        z_lvlh = np.array([-cos_nu, -sin_nu, 0.0])
        
        # X_lvlh = v_hat = [-sin(nu), cos(nu), 0]
        x_lvlh = np.array([-sin_nu, cos_nu, 0.0])
        
        # Y_lvlh = Z x X
        # For this specific case:
        # (-cos, -sin, 0) x (-sin, cos, 0)
        # z term: (-cos)(cos) - (-sin)(-sin) = -cos^2 - sin^2 = -1
        # So y_lvlh = [0, 0, -1] (Pointing South)
        y_lvlh = np.array([0.0, 0.0, -1.0])
        
        return x_lvlh, y_lvlh, z_lvlh
