---
title: simulator
description: Main launch simulation API
---

# simulator

The main API for running launch simulations.

## Functions

### `solve_to_circular_orbit`

Solve for optimal circular orbit insertion.

```python
def solve_to_circular_orbit(
    h_target_km: float,
    payload_kg: float,
    *,
    include_trajectory: bool = True,
    trim: bool = True,
    # ... additional parameters
) -> LaunchResult:
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `h_target_km` | float | Target altitude [km] (160-400) |
| `payload_kg` | float | Payload mass [kg] (0-10000) |
| `include_trajectory` | bool | Include full trajectory data |
| `trim` | bool | Remove pre-pitchover phase |

**Returns:** `LaunchResult` dataclass with:
- `schema_version`: API version
- `inputs`: Echo of input parameters
- `optimal_numerics`: Optimal control values
- `summary`: Mission success metrics
- `trajectory`: Full trajectory data (if requested)

### `simulate_to_orbit`

Single simulation with given control parameters.

```python
def simulate_to_orbit(
    h_target_km: float,
    payload_kg: float,
    theta0_deg: float,
    t_coast: float,
    t_burn2: float,
    # ...
) -> Trajectory:
```

## LaunchResult Schema

```python
@dataclass
class LaunchResult:
    schema_version: int
    inputs: dict[str, float]
    optimal_numerics: dict[str, float]
    summary: dict[str, float]
    trajectory: dict[str, Any] | None
```
