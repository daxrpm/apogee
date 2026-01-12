from __future__ import annotations

import jax
import jax.numpy as jnp

from .types import EarthParams


Array = jax.Array

_R = 0
_V = 2
_GAMMA = 3


def orbit_diagnostics(*, y: Array, earth: EarthParams):
    """Two-body orbit diagnostics at cutoff per LaTeX Eqs. (299--313)."""
    r = y[_R]
    v = y[_V]
    gamma = y[_GAMMA]

    mu = earth.mu

    eps = 0.5 * v * v - mu / r
    h_ang = r * v * jnp.cos(gamma)

    e = jnp.sqrt(jnp.maximum(0.0, 1.0 + (2.0 * eps * h_ang * h_ang) / (mu * mu)))
    a = -mu / (2.0 * eps)

    r_apo = a * (1.0 + e)
    r_peri = a * (1.0 - e)

    return eps, h_ang, a, e, r_apo, r_peri
