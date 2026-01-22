---
title: falcon9
description: Falcon 9 v1.2 FT vehicle parameters
---

# falcon9

Official Falcon 9 v1.2 Full Thrust parameters.

## Falcon9Params

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

## Parameter Details

### Propulsion

| Parameter | Value | Note |
|-----------|-------|------|
| Stage 1 Thrust | 7,686 kN | 9× Merlin 1D |
| Stage 2 Thrust | 981 kN | 1× Merlin 1D Vacuum |
| Stage 1 Isp | 282 s | Sea level |
| Stage 2 Isp | 348 s | Vacuum |

### Mass Budget

| Component | Mass [kg] |
|-----------|-----------|
| Stage 1 dry | 22,000 |
| Stage 1 propellant | ~411,000 |
| Stage 2 dry | 4,000 |
| Stage 2 propellant | ~107,000 |
| Interstage | 2,000 |
| Fairing | ~2,000 |
| Payload | 0-10,000 |

### Aerodynamics

| Parameter | Value |
|-----------|-------|
| Diameter | 3.7 m |
| Reference area | 10.75 m² |
| $C_D$ | 0.3 |

## Usage

```python
from apogee_launch.falcon9 import FALCON9_DEFAULT, Falcon9Params

# Use default
params = FALCON9_DEFAULT

# Custom parameters
custom = Falcon9Params(
    m0=500_000,
    thrust1=7_000_000,
    # ...
)
```
