---
title: State Vector
description: Definition of the rocket state in planar polar coordinates
---

# State Vector

This page derives the 5-dimensional state vector used throughout the Apogee simulator.

## Coordinate System Choice

We model the rocket ascent in a **2D inertial plane** centered at Earth's center. This planar approximation is valid for:

- Equatorial launches (inclination ≈ 0°)
- Short flight times (< 15 minutes)
- Negligible Earth rotation during ascent

!!! note "LaTeX Reference"
    This section corresponds to **Section 2** of `nm_final_project.tex`.

## State Vector Definition

The complete state of the rocket at time $t$ is described by:

$$
\boxed{
\mathbf{y}(t) = \begin{bmatrix} r(t) \\ \lambda(t) \\ v(t) \\ \gamma(t) \\ m(t) \end{bmatrix}
}
\tag{Eq. 1}
$$

<figure markdown>
  ![Two-Stage Rocket Launch](../assets/images/2_stages_rocket_launch.png){ width="500" }
  <figcaption>Planar polar coordinates for rocket ascent</figcaption>
</figure>

## State Variables

### Geocentric Radius $r(t)$

**Definition**: Distance from Earth's center to the rocket.

$$
r(t) = R_E + h(t)
$$

Where:
- $R_E = 6{,}371{,}000$ m (Earth's mean radius)
- $h(t)$ = altitude above sea level [m]

**Physical range**: $r \geq R_E$ (rocket is above surface)

**Implementation**: `dynamics.py` line 37

### Downrange Central Angle $\lambda(t)$

**Definition**: Angular displacement measured from launch site.

$$
\lambda(t) = \frac{\text{arc length}}{r} = \frac{s}{r}
$$

**Physical interpretation**: 
- $\lambda = 0$ at launch
- At orbit insertion, typically $\lambda \approx 0.2$ rad (≈12°)

**Implementation**: `dynamics.py` line 38

### Speed Magnitude $v(t)$

**Definition**: Magnitude of the velocity vector.

$$
v(t) = \|\mathbf{v}(t)\| = \sqrt{v_r^2 + v_\theta^2}
$$

Where:
- $v_r = v\sin\gamma$ (radial component)
- $v_\theta = v\cos\gamma$ (tangential component)

**Physical range**: 
- Liftoff: $v = 0$
- Orbit insertion: $v \approx 7800$ m/s

**Implementation**: `dynamics.py` line 39

### Flight-Path Angle $\gamma(t)$

**Definition**: Angle between velocity vector and local horizontal.

$$
\gamma = \arctan\left(\frac{v_r}{v_\theta}\right)
$$

<figure markdown>
  ![Rocket Forces](../assets/images/rocketForces.gif){ width="350" }
  <figcaption>Flight-path angle γ measured from local horizontal</figcaption>
</figure>

**Sign convention**:
- $\gamma > 0$: Ascending (gaining altitude)
- $\gamma = 0$: Horizontal flight
- $\gamma < 0$: Descending

**Key values**:
| Phase | $\gamma$ value |
|-------|---------------|
| Vertical ascent | $\pi/2$ (90°) |
| After pitchover | $\approx 80°$ |
| Orbit insertion | $\approx 0°$ |

**Implementation**: `dynamics.py` line 40

### Vehicle Mass $m(t)$

**Definition**: Total instantaneous mass of the rocket.

$$
m(t) = m_{\text{structure}} + m_{\text{propellant}}(t) + m_{\text{payload}}
$$

<figure markdown>
  ![Variable Mass](../assets/images/variableMass.png){ width="400" }
  <figcaption>Variable mass dynamics during propulsive flight</figcaption>
</figure>

**Mass budget** (Falcon 9 v1.2 FT):

| Component | Mass [kg] |
|-----------|-----------|
| Stage 1 propellant | ~411,000 |
| Stage 1 dry | 22,000 |
| Stage 2 propellant | ~107,000 |
| Stage 2 dry | 4,000 |
| Interstage | 2,000 |
| Payload | 0-10,000 |
| **Total at liftoff** | ~549,000 |

**Implementation**: `dynamics.py` line 41, `falcon9.py`

## Velocity Decomposition

The velocity vector in polar coordinates:

$$
\mathbf{v} = v_r \hat{e}_r + v_\theta \hat{e}_\theta
$$

Relating to state variables:

$$
\begin{aligned}
v_r &= v \sin\gamma = \frac{dr}{dt} \\
v_\theta &= v \cos\gamma = r\frac{d\lambda}{dt}
\end{aligned}
$$

This decomposition leads directly to the kinematic equations derived in [Equations of Motion](equations-of-motion.md).

## Initial Conditions

For a launch from Earth's surface:

$$
\mathbf{y}(0) = \begin{bmatrix} 
R_E \\ 
0 \\ 
0 \\ 
\frac{\pi}{2} \\ 
m_0 
\end{bmatrix}
$$

| Variable | Initial Value | Meaning |
|----------|---------------|---------|
| $r(0)$ | $R_E$ | On Earth's surface |
| $\lambda(0)$ | $0$ | At launch site |
| $v(0)$ | $0$ | Stationary |
| $\gamma(0)$ | $\pi/2$ | Vertical |
| $m(0)$ | $m_0$ | Gross liftoff mass |

**Implementation**: `simulate.py` lines 220-230

## Why Polar Coordinates?

The polar representation offers several advantages:

1. **Natural gravity alignment**: Gravity points radially inward ($-\hat{e}_r$)
2. **Altitude is direct**: $h = r - R_E$
3. **Angular momentum**: $L = r \cdot v \cos\gamma$ is simple
4. **Orbital insertion**: Circular orbit has $\gamma = 0$, $v = \sqrt{\mu/r}$

## Code Implementation

```python title="apogee_physics/types.py" linenums="48"
@dataclass(frozen=True, slots=True)
class AscentConfig:
    earth: EarthParams
    mission: MissionParams
    vehicle: VehicleParams
    numerics: NumericsParams
```

The state vector indices are defined as constants:

```python title="apogee_physics/dynamics.py" linenums="13"
_R = 0      # Geocentric radius index
_LAM = 1    # Downrange angle index
_V = 2      # Speed magnitude index
_GAMMA = 3  # Flight-path angle index
_M = 4      # Mass index
```

## References

1. Battin, R.H. (1999). *An Introduction to the Mathematics and Methods of Astrodynamics*. 
   AIAA Education Series. Chapter 3 - "The Two-Body Problem".

2. Curtis, H.D. (2013). *Orbital Mechanics for Engineering Students*. 
   Butterworth-Heinemann. Chapter 2 - "The Two-Body Problem".

## Next Steps

- [Equations of Motion](equations-of-motion.md) - Derive the governing ODEs
- [Atmosphere Model](atmosphere.md) - USSA76 implementation
