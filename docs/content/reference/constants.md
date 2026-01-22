---
title: Physical Constants
description: Earth parameters and unit conversions
---

# Physical Constants

## Earth Parameters

| Symbol | Value | Units | Description |
|--------|-------|-------|-------------|
| $R_E$ | 6,371,000 | m | Mean Earth radius |
| $\mu$ | 3.986004418 × 10¹⁴ | m³/s² | Gravitational parameter |
| $g_0$ | 9.80665 | m/s² | Standard gravity |
| $M_E$ | 5.972 × 10²⁴ | kg | Earth mass |
| $\omega_E$ | 7.2921 × 10⁻⁵ | rad/s | Earth rotation rate |

## Atmosphere (Sea Level)

| Property | Value | Units |
|----------|-------|-------|
| Pressure | 101,325 | Pa |
| Density | 1.225 | kg/m³ |
| Temperature | 288.15 | K |
| Speed of Sound | 340.3 | m/s |

## Unit Conversions

| Conversion | Value |
|------------|-------|
| 1 km → m | 1,000 |
| 1 deg → rad | π/180 = 0.01745 |
| 1 kN → N | 1,000 |
| 1 tonne → kg | 1,000 |

## Orbital Velocities

For circular orbits at altitude $h$:

$$
v = \sqrt{\frac{\mu}{R_E + h}}
$$

| Altitude | Velocity | Period |
|----------|----------|--------|
| 160 km | 7,808 m/s | 87.5 min |
| 200 km | 7,784 m/s | 88.4 min |
| 400 km (ISS) | 7,668 m/s | 92.7 min |

## Implementation

```python
# apogee_physics/types.py
@dataclass(frozen=True, slots=True)
class EarthParams:
    r_e: float = 6_371_000.0  # Earth radius [m]
    mu: float = 3.986004418e14  # Gravitational parameter [m³/s²]
    g0: float = 9.80665  # Standard gravity [m/s²]
```
