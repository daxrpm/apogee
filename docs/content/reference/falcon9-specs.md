---
title: Falcon 9 Specifications
description: Complete Falcon 9 v1.2 Full Thrust vehicle data
---

# Falcon 9 Specifications

Complete specifications for the Falcon 9 v1.2 Full Thrust (Block 5).

## Vehicle Overview

| Property | Value |
|----------|-------|
| Manufacturer | SpaceX |
| Variant | v1.2 Full Thrust |
| First Flight | 2015-12-22 |
| Height | 70 m |
| Diameter | 3.7 m |
| Mass (at liftoff) | 549,054 kg |

## Stage 1

| Property | Value |
|----------|-------|
| Engines | 9× Merlin 1D |
| Thrust (sea level) | 7,686 kN |
| Thrust (vacuum) | 8,227 kN |
| Specific Impulse (SL) | 282 s |
| Specific Impulse (vac) | 311 s |
| Burn Time | ~162 s |
| Propellant | RP-1 / LOX |
| Dry Mass | 22,000 kg |
| Propellant Mass | ~411,000 kg |

## Stage 2

| Property | Value |
|----------|-------|
| Engines | 1× Merlin 1D Vacuum |
| Thrust | 981 kN |
| Specific Impulse | 348 s |
| Burn Time | 397 s (max) |
| Propellant | RP-1 / LOX |
| Dry Mass | 4,000 kg |
| Propellant Mass | ~107,000 kg |

## Other Components

| Component | Mass |
|-----------|------|
| Interstage | 2,000 kg |
| Payload Fairing | ~2,000 kg |

## Payload Capacity

| Orbit | Capacity |
|-------|----------|
| LEO (185 km) | 22,800 kg |
| GTO | 8,300 kg |
| Mars | 4,020 kg |

## Aerodynamics

| Property | Value |
|----------|-------|
| Diameter | 3.7 m |
| Reference Area | 10.75 m² |
| $C_D$ (subsonic) | ~0.3 |
| $C_D$ (supersonic) | ~0.35 |

## Implementation

```python
@dataclass(frozen=True)
class Falcon9Params:
    m0: float = 549_054.0        # Gross liftoff mass [kg]
    thrust1: float = 7_686_000.0 # Stage 1 thrust [N]
    thrust2: float = 981_000.0   # Stage 2 thrust [N]
    isp1: float = 282.0          # Stage 1 Isp [s]
    isp2: float = 348.0          # Stage 2 Isp [s]
    t2_burn: float = 397.0       # Stage 2 burn time [s]
    m1_dry: float = 22_000.0     # Stage 1 dry mass [kg]
    m2_dry: float = 4_000.0      # Stage 2 dry mass [kg]
    interstage: float = 2_000.0  # Interstage mass [kg]
    diameter: float = 3.7        # Vehicle diameter [m]
```

## References

1. **SpaceX Falcon 9 User's Guide** (2021)
2. **Spaceflight101**: Falcon 9 Vehicle Overview
3. **NASA Space Launch Report**: Falcon 9 Data Sheet
