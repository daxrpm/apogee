---
title: atmosphere
description: USSA76 atmosphere model implementation
---

# atmosphere

Implements the US Standard Atmosphere 1976 for density and speed of sound.

## Classes

### `AtmosphereTable`

Precomputed lookup table for atmospheric properties.

```python
@dataclass(frozen=True, slots=True)
class AtmosphereTable:
    z_m: Array    # Altitude grid [m]
    rho: Array    # Density [kg/m³]
    cs: Array     # Speed of sound [m/s]
```

**Methods:**

- `rho_at(h_m)` - Interpolate density at altitude $h$
- `cs_at(h_m)` - Interpolate speed of sound at altitude $h$

## Functions

### `build_atmosphere_table`

Build the lookup table from USSA76 data.

```python
def build_atmosphere_table(
    *, 
    z_max_m: float = 300_000, 
    dz_m: float = 100
) -> AtmosphereTable:
```

**Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `z_max_m` | 300,000 | Maximum altitude [m] |
| `dz_m` | 100 | Grid spacing [m] |

## Equation Reference

**Eq. 15**: Density interpolation
$$
\rho(h) = \text{Interp}(h, \text{USSA76}_\rho)
$$

**Eq. 16**: Drag force
$$
D = \frac{1}{2}\rho v^2 C_D A_{\text{ref}}
$$
