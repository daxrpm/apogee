from __future__ import annotations

from dataclasses import dataclass

import jax


Array = jax.Array


@dataclass(frozen=True, slots=True)
class OrbitDiagnostics:
    specific_energy: Array
    specific_angular_momentum: Array
    semi_major_axis: Array
    eccentricity: Array
    r_apoapsis: Array
    r_periapsis: Array


@dataclass(frozen=True, slots=True)
class Trajectory:
    t: Array
    r: Array
    h: Array
    lam: Array
    x: Array
    v: Array
    gamma: Array
    m: Array
    q: Array
    mach: Array
    drag: Array
    orbit: OrbitDiagnostics


# Register Pytree Nodes
def _register_dataclass_pytree(cls):
    def flatten(obj):
        # All fields are arrays/children
        return tuple(getattr(obj, f) for f in obj.__slots__), None

    def unflatten(aux, children):
        return cls(*children)

    jax.tree_util.register_pytree_node(cls, flatten, unflatten)

_register_dataclass_pytree(OrbitDiagnostics)
_register_dataclass_pytree(Trajectory)
