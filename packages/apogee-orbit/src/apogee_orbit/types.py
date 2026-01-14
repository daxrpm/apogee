from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np


@dataclass(frozen=True)
class OrbitState:
    """State of a satellite in a circular equatorial orbit.
    
    Attributes:
        t: Time since epoch [s]
        nu: True anomaly [rad] (equivalent to Right Ascension for equatorial orbit)
        r_eci: Position vector in ECI frame [m] (x, y, z)
        v_eci: Velocity vector in ECI frame [m/s] (x, y, z)
    """
    t: float
    nu: float
    r_eci: Tuple[float, float, float]
    v_eci: Tuple[float, float, float]


@dataclass(frozen=True)
class AttitudeSolution:
    """Attitude solution for yaw steering.
    
    Attributes:
        t: Time [s]
        yaw: Yaw angle [rad]
        beta: Beta angle (sun elevation above orbit plane) [rad]
        sun_body: Sun vector in body frame (after yaw rotation)
    """
    t: float
    yaw: float
    beta: float
    sun_body: Tuple[float, float, float]
