---
title: dynamics
description: Equations of motion implementation
---

# dynamics

Implements the rocket equations of motion (Eq. 5-14).

## Functions

### `compute_derived`

Compute derived quantities from state vector.

```python
def compute_derived(
    *, 
    y: Array, 
    earth: EarthParams, 
    stage: StageParams, 
    atmos: AtmosphereTable
) -> Derived:
```

**Returns:**
- `h`: Altitude [m]
- `rho`: Atmospheric density [kg/m³]
- `cs`: Speed of sound [m/s]
- `mach`: Mach number
- `drag`: Drag force [N]
- `q`: Dynamic pressure [Pa]

### `rhs_general`

General ODE right-hand side.

```python
def rhs_general(
    *,
    t: Array,
    y: Array,
    earth: EarthParams,
    stage: StageParams,
    atmos: AtmosphereTable,
    alpha: Array,
    v_eps: Array
) -> Array:
```

**Equations implemented:**

| Equation | Expression | Line |
|----------|------------|------|
| Eq. 5 | $\dot{r} = v\sin\gamma$ | 69 |
| Eq. 6 | $\dot{\lambda} = v\cos\gamma/r$ | 70 |
| Eq. 9 | Speed equation | 73 |
| Eq. 10 | Flight-path angle | 79 |
| Eq. 11 | Mass flow | 82 |
| Eq. 12 | Regularized $1/v$ | 77 |
| Eq. 13 | Safe radius | 66 |

### `rhs_vertical`

Vertical ascent phase ($\gamma = \pi/2$).

### `rhs_gravity_turn`

Gravity turn phase ($\alpha = 0$).

### `rhs_coast`

Coast phase ($T = 0$).

## State Vector Indices

```python
_R = 0      # Geocentric radius
_LAM = 1    # Downrange angle
_V = 2      # Speed magnitude
_GAMMA = 3  # Flight-path angle
_M = 4      # Mass
```
