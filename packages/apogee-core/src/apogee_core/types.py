from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol

import jax


Array = jax.Array


class CdModel(Protocol):
    def __call__(self, mach: Array) -> Array: ...


@dataclass(frozen=True, slots=True)
class EarthParams:
    r_e: float
    mu: float
    g0: float


@dataclass(frozen=True, slots=True)
class MissionParams:
    h_target: float
    payload_mass: float


@dataclass(frozen=True, slots=True)
class StageParams:
    thrust: float
    isp: float
    a_ref: float
    cd: CdModel


@dataclass(frozen=True, slots=True)
class VehicleParams:
    m0: float
    stage1: StageParams
    stage2: StageParams
    m1_dry: float
    m2_dry: float
    t1_burn: float
    t2_burn: float


@dataclass(frozen=True, slots=True)
class NumericsParams:
    h_pitch_over: float
    theta0: float
    t_burn2: float
    t_coast: float
    v_eps: float
    dt0: float
    rtol: float
    atol: float
    root_rtol: float
    root_atol: float
    t_max: float
    max_steps: int


@dataclass(frozen=True, slots=True)
class AscentConfig:
    earth: EarthParams
    mission: MissionParams
    vehicle: VehicleParams
    numerics: NumericsParams
    atmosphere_z_max: float = 300_000.0
    atmosphere_dz: float = 50.0


# Register Pytree Nodes for JAX

def _register_dataclass_pytree(cls, static_fields=()):
    from dataclasses import fields
    
    def flatten(obj):
        # vars(obj) fails for slots=True, so we use fields()
        # We cache field names for efficiency if needed, but iteration is fine
        child_keys = []
        children = []
        aux = {}
        
        for field in fields(obj):
            k = field.name
            v = getattr(obj, k)
            if k in static_fields:
                aux[k] = v
            else:
                children.append(v)
                child_keys.append(k)
                
        return children, (aux, tuple(child_keys))

    def unflatten(aux_data, children):
        aux, keys = aux_data
        # Reconstruct dict
        d = aux.copy()
        for k, v in zip(keys, children):
            d[k] = v
        return cls(**d)

    jax.tree_util.register_pytree_node(cls, flatten, unflatten)

_register_dataclass_pytree(EarthParams)
_register_dataclass_pytree(MissionParams)
# CdModel is a Protocol, concrete implementations need registration.
_register_dataclass_pytree(StageParams)
_register_dataclass_pytree(VehicleParams)
# max_steps is static (int)
_register_dataclass_pytree(NumericsParams, static_fields=('max_steps',))
_register_dataclass_pytree(AscentConfig, static_fields=('atmosphere_z_max', 'atmosphere_dz'))
