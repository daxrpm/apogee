---
title: orbit
description: Two-body orbital diagnostics
---

# orbit

Computes Keplerian orbital elements from the terminal state.

## Functions

### `orbit_diagnostics`

Calculate orbital elements at engine cutoff.

```python
def orbit_diagnostics(
    *, 
    y: Array, 
    earth: EarthParams
) -> tuple[float, float, float, float, float, float]:
```

**Returns:**
1. `eps` - Specific orbital energy [J/kg]
2. `h_ang` - Specific angular momentum [m²/s]
3. `a` - Semi-major axis [m]
4. `e` - Eccentricity
5. `r_apo` - Apoapsis radius [m]
6. `r_peri` - Periapsis radius [m]

## Equations

**Eq. 18** - Specific energy:
$$
\varepsilon = \frac{v^2}{2} - \frac{\mu}{r}
$$

**Eq. 19** - Specific angular momentum:
$$
h = r \cdot v \cdot \cos\gamma
$$

**Eq. 20** - Eccentricity:
$$
e = \sqrt{1 + \frac{2\varepsilon h^2}{\mu^2}}
$$

**Eq. 21** - Semi-major axis:
$$
a = -\frac{\mu}{2\varepsilon}
$$

## Implementation

```python
def orbit_diagnostics(*, y: Array, earth: EarthParams):
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
```
