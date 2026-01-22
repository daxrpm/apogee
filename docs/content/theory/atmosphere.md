---
title: Atmosphere Model
description: US Standard Atmosphere 1976 implementation for density and speed of sound
---

# Atmosphere Model

The Apogee simulator uses the **US Standard Atmosphere 1976 (USSA76)** for atmospheric properties.

!!! note "LaTeX Reference"
    This section corresponds to **Section 4** of `nm_final_project.tex` (Equations 15-16).

## Overview

Atmospheric drag significantly affects rocket trajectories during the lower portion of ascent. We need two key properties:

1. **Density** $\rho(h)$ - for drag force calculation
2. **Speed of Sound** $a_s(h)$ - for Mach number

## USSA76 Model

The US Standard Atmosphere 1976 defines temperature, pressure, and density as functions of geometric altitude.

### Temperature Profile

The atmosphere is divided into layers with different lapse rates:

| Layer | Altitude Range | Lapse Rate |
|-------|----------------|------------|
| Troposphere | 0 - 11 km | -6.5 K/km |
| Tropopause | 11 - 20 km | 0 K/km |
| Stratosphere 1 | 20 - 32 km | +1.0 K/km |
| Stratosphere 2 | 32 - 47 km | +2.8 K/km |
| Stratopause | 47 - 51 km | 0 K/km |
| Mesosphere | > 51 km | varies |

### Density Computation

Within each layer, density follows from the hydrostatic equation and ideal gas law.

**Isothermal Layer:**
$$
\rho(h) = \rho_b \exp\left(-\frac{g_0 M (h - h_b)}{R^* T_b}\right)
$$

**Gradient Layer:**
$$
\rho(h) = \rho_b \left(\frac{T_b}{T_b + L(h - h_b)}\right)^{1 + g_0 M / (R^* L)}
$$

Where:
- $\rho_b$ = density at layer base [kg/m³]
- $T_b$ = temperature at layer base [K]
- $L$ = lapse rate [K/m]
- $M$ = molar mass of air (0.0289644 kg/mol)
- $R^*$ = universal gas constant (8.31447 J/(mol·K))

### Speed of Sound

For an ideal gas:

$$
a_s(h) = \sqrt{\gamma \frac{R^*}{M} T(h)} = \sqrt{\gamma R T(h)}
$$

Where:
- $\gamma = 1.4$ (ratio of specific heats for air)
- $R = R^*/M = 287.05$ J/(kg·K)

## Implementation

### Lookup Table Approach

Rather than evaluating the piecewise functions repeatedly, we build a precomputed table.

$$
\boxed{\rho(h) = \text{Interp}(h, \text{USSA76}_\rho)}
\tag{Eq. 15}
$$

**Implementation:**

```python title="apogee_physics/atmosphere.py" linenums="43"
def build_atmosphere_table(*, z_max_m: float, dz_m: float) -> AtmosphereTable:
    """Build discrete USSA76 table for interpolation [Section 4.1]."""
    z = np.arange(0.0, z_max_m + dz_m, dz_m, dtype=float)
    ds = ussa1976.compute(z=z, variables=["rho", "cs"])
    
    rho = np.asarray(ds["rho"].values, dtype=float)
    cs = np.asarray(ds["cs"].values, dtype=float)
    
    return AtmosphereTable(z_m=jnp.asarray(z), rho=jnp.asarray(rho), cs=jnp.asarray(cs))
```

### Interpolation

Linear interpolation between table points:

```python title="apogee_physics/atmosphere.py" linenums="32"
def rho_at(self, h_m: Array) -> Array:
    """Interpolate density rho(h) [Section 4.1, Eq. 15]."""
    return jnp.interp(h_m, self.z_m, self.rho, left=self.rho[0], right=self.rho[-1])

def cs_at(self, h_m: Array) -> Array:
    """Interpolate speed of sound cs(h) [Section 4.1, Eq. 15]."""
    return jnp.interp(h_m, self.z_m, self.cs, left=self.cs[0], right=self.cs[-1])
```

### Default Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `z_max_m` | 300,000 m | Maximum altitude |
| `dz_m` | 100 m | Table resolution |

## Aerodynamic Drag

### Mach Number

$$
M = \frac{v}{a_s(h)}
$$

**Physical meaning:**
- $M < 1$: Subsonic
- $M = 1$: Sonic (transonic region)
- $M > 1$: Supersonic
- $M > 5$: Hypersonic

### Drag Force

$$
\boxed{D = \frac{1}{2} \rho(h) v^2 C_D(M) A_{\text{ref}}}
\tag{Eq. 16}
$$

Where:
- $\rho(h)$ = atmospheric density [kg/m³]
- $v$ = velocity magnitude [m/s]
- $C_D(M)$ = drag coefficient (function of Mach)
- $A_{\text{ref}}$ = reference area [m²]

### Dynamic Pressure

A key derived quantity:

$$
q = \frac{1}{2} \rho v^2
$$

**Max-Q** occurs when $q$ is maximum (typically around 80-90 seconds into flight).

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="42"
def compute_derived(*, y: Array, earth: EarthParams, stage: StageParams, atmos: AtmosphereTable) -> Derived:
    """Compute derived scalars per LaTeX Report (Section 4)."""
    r, v = y[_R], y[_V]
    
    h = r - earth.r_e
    h_clip = jnp.maximum(h, 0.0)
    
    rho = atmos.rho_at(h_clip)
    cs = atmos.cs_at(h_clip)
    mach = v / cs
    
    cd = stage.cd(mach)
    drag = 0.5 * rho * cd * stage.a_ref * v * v
    q = 0.5 * rho * v * v
    
    return Derived(h=h, rho=rho, cs=cs, mach=mach, drag=drag, q=q)
```

## Drag Coefficient Model

The drag coefficient varies with Mach number:

### Constant $C_D$

Simplest model (used in Apogee):

$$
C_D(M) = C_{D,0} = 0.3
$$

**Implementation:**

```python title="apogee_physics/calibration.py"
class ConstantCd:
    def __init__(self, cd: float = 0.3):
        self.cd = cd
    
    def __call__(self, mach: Array) -> Array:
        return jnp.full_like(mach, self.cd)
```

### Transonic Variation (Future)

A more realistic model includes transonic drag rise:

$$
C_D(M) = \begin{cases}
C_{D,0} & M < 0.8 \\
C_{D,0} + k(M - 0.8)^2 & 0.8 \leq M < 1.2 \\
C_{D,\text{super}} & M \geq 1.2
\end{cases}
$$

## Altitude Effects

### Density vs. Altitude

| Altitude | Density | % of sea level |
|----------|---------|----------------|
| 0 km | 1.225 kg/m³ | 100% |
| 10 km | 0.414 kg/m³ | 34% |
| 20 km | 0.089 kg/m³ | 7.3% |
| 50 km | 0.001 kg/m³ | 0.08% |
| 100 km | 5×10⁻⁷ kg/m³ | ~0% |

Above ~100 km (Kármán line), atmospheric effects become negligible.

### High-Altitude Handling

For altitudes above the table maximum:

```python title="apogee_physics/atmosphere.py" linenums="70"
# Add an extra point just above z_max so extrapolation above the table
# approaches vacuum (rho=0) while remaining C0-continuous at z_max.
z = np.concatenate([z, np.array([z[-1] + dz_m], dtype=float)])
rho = np.concatenate([rho, np.array([0.0], dtype=float)])
```

## Falcon 9 Aerodynamic Parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| Diameter | 3.7 m | SpaceX |
| Reference Area | 10.75 m² | $\pi(d/2)^2$ |
| $C_D$ | 0.3 | Typical streamlined rocket |

**Implementation:**

```python title="apogee_launch/falcon9.py" linenums="20"
diameter: float = 3.7  # Vehicle diameter [m]
```

```python title="apogee_launch/simulator.py"
a_ref = math.pi * (params.diameter / 2) ** 2  # Reference area
```

## References

1. **NOAA/NASA/USAF** (1976). *U.S. Standard Atmosphere, 1976*. 
   U.S. Government Printing Office. NOAA-S/T 76-1562.

2. **Anderson, J.D.** (2016). *Introduction to Flight*. 
   McGraw-Hill. Chapter 3 - "The Standard Atmosphere".

3. **Python Package**: [`ussa1976`](https://pypi.org/project/ussa1976/)

---

## Next Steps

- [Equations of Motion](equations-of-motion.md) - Where drag is used
- [Orbital Mechanics](orbital-mechanics.md) - Beyond atmosphere
