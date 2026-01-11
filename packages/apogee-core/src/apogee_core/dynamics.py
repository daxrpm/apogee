from __future__ import annotations

from dataclasses import dataclass

import jax
import jax.numpy as jnp

from .atmosphere import AtmosphereTable
from .types import EarthParams, StageParams


Array = jax.Array

_R = 0
_LAM = 1
_V = 2
_GAMMA = 3
_M = 4


@dataclass(frozen=True, slots=True)
class Derived:
    h: Array
    rho: Array
    cs: Array
    mach: Array
    drag: Array
    q: Array


def compute_derived(*, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable) -> Derived:
    """Compute derived scalars per LaTeX (Eq. 241--245).

    Returns altitude h, density rho(h), speed of sound a_s(h)=cs, Mach M, drag D, and
    dynamic pressure q.
    """
    r = y[_R]
    v = y[_V]

    h = r - earth.r_e
    h_clip = jnp.maximum(h, 0.0)

    rho = atmos.rho_at(h_clip)
    cs = atmos.cs_at(h_clip)
    mach = v / cs

    cd = stage.cd(mach)
    drag = 0.5 * rho * cd * stage.a_ref * v * v
    q = 0.5 * rho * v * v

    return Derived(h=h, rho=rho, cs=cs, mach=mach, drag=drag, q=q)


def rhs_general(*, t: Array, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable, alpha: Array, v_eps: Array) -> Array:
    """General ascent RHS per LaTeX Eqs. (248--253).

    Implements the canonical state y=[r, lambda, v, gamma, m].
    """
    derived = compute_derived(y=y, earth=earth, stage=stage, atmos=atmos)

    r = y[_R]
    v = y[_V]
    gamma = y[_GAMMA]
    m = y[_M]
    
    # FIX 3: Guard r to avoid singularity at r=0
    r_safe = jnp.maximum(r, earth.r_e * 0.99) # Allow slight penetration but stop 0

    mu = earth.mu

    dr = v * jnp.sin(gamma)
    dlam = v * jnp.cos(gamma) / r_safe
    dv = (stage.thrust / m) * jnp.cos(alpha) - derived.drag / m - (mu / (r_safe * r_safe)) * jnp.sin(gamma)

    # FIX 1: Guard the LaTeX 1/v terms near v -> 0 to avoid numerical singularity.
    # For v >> v_eps this is exactly the LaTeX equation.
    v_safe = jnp.maximum(v, v_eps)
    dgamma = (stage.thrust / (m * v_safe)) * jnp.sin(alpha) + (v / r_safe - mu / (r_safe * r_safe * v_safe)) * jnp.cos(gamma)

    dm = -stage.thrust / (stage.isp * earth.g0)

    return jnp.stack([dr, dlam, dv, dgamma, dm])


def rhs_vertical(*, t: Array, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable, v_eps: Array) -> Array:
    """Vertical ascent phase per LaTeX Sec. 256--264.

    Enforces gamma = pi/2 and sets dgamma/dt = 0.
    """
    # FIX 2: Preserve canonical model by forcing gamma=pi/2, calling rhs_general,
    # then setting dgamma/dt=0 for the vertical phase.
    gamma = jnp.pi / 2.0
    y_fix = y.at[_GAMMA].set(gamma)
    dy = rhs_general(t=t, y=y_fix, earth=earth, stage=stage, atmos=atmos, alpha=jnp.array(0.0), v_eps=v_eps)
    return dy.at[_GAMMA].set(0.0)


def rhs_gravity_turn(*, t: Array, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable, v_eps: Array) -> Array:
    """Gravity turn phase per LaTeX Sec. 225--235 with alpha=0."""
    return rhs_general(t=t, y=y, earth=earth, stage=stage, atmos=atmos, alpha=jnp.array(0.0), v_eps=v_eps)


def rhs_coast(*, t: Array, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable, v_eps: Array) -> Array:
    """Coast dynamics: T=0 implies dm/dt=0 (LaTeX line 254)."""
    stage0 = StageParams(thrust=0.0, isp=stage.isp, a_ref=stage.a_ref, cd=stage.cd)
    dy = rhs_general(t=t, y=y, earth=earth, stage=stage0, atmos=atmos, alpha=jnp.array(0.0), v_eps=v_eps)
    return dy.at[_M].set(0.0)
