from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import jax
import numpy as np


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


def _finite_prefix_len(t: np.ndarray) -> int:
    mask = np.isfinite(t)
    if not mask.any():
        return 0
    return int(np.sum(mask))


def trajectory_to_dict(traj: Trajectory, *, trim: bool = True) -> dict[str, Any]:
    t = np.asarray(traj.t)
    n = _finite_prefix_len(t) if trim else int(t.shape[0])

    t = t[:n]
    r = np.asarray(traj.r)[:n]
    h = np.asarray(traj.h)[:n]
    lam = np.asarray(traj.lam)[:n]
    v = np.asarray(traj.v)[:n]
    gamma = np.asarray(traj.gamma)[:n]
    m = np.asarray(traj.m)[:n]
    q = np.asarray(traj.q)[:n]
    mach = np.asarray(traj.mach)[:n]
    drag = np.asarray(traj.drag)[:n]

    c = np.cos(lam)
    s = np.sin(lam)
    x = r * c
    y = r * s
    z = np.zeros_like(x)

    v_r = v * np.sin(gamma)
    v_t = v * np.cos(gamma)
    vx = v_r * c - v_t * s
    vy = v_r * s + v_t * c
    vz = np.zeros_like(vx)

    orbit = traj.orbit
    orbit_dict = {
        "specific_energy": float(np.asarray(orbit.specific_energy)),
        "specific_angular_momentum": float(np.asarray(orbit.specific_angular_momentum)),
        "semi_major_axis": float(np.asarray(orbit.semi_major_axis)),
        "eccentricity": float(np.asarray(orbit.eccentricity)),
        "r_apoapsis": float(np.asarray(orbit.r_apoapsis)),
        "r_periapsis": float(np.asarray(orbit.r_periapsis)),
    }

    return {
        "t_s": t.tolist(),
        "r_m": r.tolist(),
        "h_m": h.tolist(),
        "lambda_rad": lam.tolist(),
        "v_mps": v.tolist(),
        "gamma_rad": gamma.tolist(),
        "m_kg": m.tolist(),
        "q_pa": q.tolist(),
        "mach": mach.tolist(),
        "drag_n": drag.tolist(),
        "pos_m": {"x": x.tolist(), "y": y.tolist(), "z": z.tolist()},
        "vel_mps": {"vx": vx.tolist(), "vy": vy.tolist(), "vz": vz.tolist()},
        "orbit": orbit_dict,
    }


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
