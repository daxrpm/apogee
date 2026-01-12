from __future__ import annotations

import jax
import jax.numpy as jnp

from .types import EarthParams


Array = jax.Array

_R = 0
_V = 2
_GAMMA = 3


def orbit_diagnostics(*, y: Array, earth: EarthParams):
    """Two-body orbit diagnostics at cutoff per LaTeX Report (Section 7).
    
    Equations:
      - Specific Energy (epsilon): [Eq. 18]
      - Specific Angular Momentum (h): [Eq. 19]
      - Eccentricity (e): [Eq. 20]
      - Semi-major Axis (a): [Eq. 21]
    """
    r = y[_R]
    v = y[_V]
    gamma = y[_GAMMA]

    mu = earth.mu

    # [Eq. 18]
    eps = 0.5 * v * v - mu / r
    # [Eq. 19]
    h_ang = r * v * jnp.cos(gamma)

    # [Eq. 20]
    e = jnp.sqrt(jnp.maximum(0.0, 1.0 + (2.0 * eps * h_ang * h_ang) / (mu * mu)))
    # [Eq. 21]
    a = -mu / (2.0 * eps)

    r_apo = a * (1.0 + e)
    r_peri = a * (1.0 - e)

    return eps, h_ang, a, e, r_apo, r_peri
