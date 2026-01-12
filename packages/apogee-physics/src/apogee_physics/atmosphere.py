from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jax
import jax.numpy as jnp
import numpy as np
import ussa1976


Array = jax.Array


@jax.tree_util.register_pytree_node_class
@dataclass(frozen=True, slots=True)
class AtmosphereTable:
    z_m: Array
    rho: Array
    cs: Array

    def tree_flatten(self):
        children = (self.z_m, self.rho, self.cs)
        aux_data = None
        return children, aux_data

    @classmethod
    def tree_unflatten(cls, aux_data, children):
        z_m, rho, cs = children
        return cls(z_m=z_m, rho=rho, cs=cs)

    def rho_at(self, h_m: Array) -> Array:
        """Interpolate density rho(h) [Section 4.1, Eq. 15]."""
        # FIX 3: Hold last table value above z_max for C0-continuous extrapolation.
        return jnp.interp(h_m, self.z_m, self.rho, left=self.rho[0], right=self.rho[-1])

    def cs_at(self, h_m: Array) -> Array:
        """Interpolate speed of sound cs(h) [Section 4.1, Eq. 15]."""
        # FIX 3: Hold last table value above z_max for C0-continuous extrapolation.
        return jnp.interp(h_m, self.z_m, self.cs, left=self.cs[0], right=self.cs[-1])


def build_atmosphere_table(*, z_max_m: float, dz_m: float) -> AtmosphereTable:
    """Build discrete USSA76 table for interpolation [Section 4.1]."""
    z_max_m = float(z_max_m)
    dz_m = float(dz_m)
    return _build_atmosphere_table_cached(z_max_m=z_max_m, dz_m=dz_m)


@lru_cache(maxsize=8)
def _build_atmosphere_table_cached(*, z_max_m: float, dz_m: float) -> AtmosphereTable:
    if z_max_m <= 0.0:
        raise ValueError("z_max_m must be positive")
    if dz_m <= 0.0:
        raise ValueError("dz_m must be positive")

    z = np.arange(0.0, z_max_m + dz_m, dz_m, dtype=float)
    ds = ussa1976.compute(z=z, variables=["rho", "cs"])

    rho = np.asarray(ds["rho"].values, dtype=float)
    cs = np.asarray(ds["cs"].values, dtype=float)

    if np.isnan(rho).any():
        rho = np.nan_to_num(rho, nan=0.0, posinf=0.0, neginf=0.0)

    if np.isnan(cs).any():
        finite = np.isfinite(cs)
        if not finite.any():
            raise ValueError("ussa1976 returned only NaNs for cs")
        last_finite = cs[finite][-1]
        cs = np.where(finite, cs, last_finite)

    # Add an extra point just above z_max so extrapolation above the table
    # approaches vacuum (rho=0) while remaining C0-continuous at z_max.
    z = np.concatenate([z, np.array([z[-1] + dz_m], dtype=float)])
    rho = np.concatenate([rho, np.array([0.0], dtype=float)])
    cs = np.concatenate([cs, np.array([cs[-1]], dtype=float)])

    return AtmosphereTable(z_m=jnp.asarray(z), rho=jnp.asarray(rho), cs=jnp.asarray(cs))
