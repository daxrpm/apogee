---
title: apogee-launch
description: Launch simulator with Falcon 9 vehicle model
---

# apogee-launch

User-facing launch simulator with Falcon 9 parameters and CLI.

## Installation

```bash
uv sync --package apogee-launch
```

## CLI Usage

```bash
# Basic launch
uv run apogee-launch --h-target-km 200 --payload-kg 5000

# With plots
uv run apogee-launch --h-target-km 200 --payload-kg 5000 --plot

# Verbose output
uv run apogee-launch --h-target-km 200 --payload-kg 5000 --verbose
```

## JAX Backend / GPU Logs

When running with `--verbose`, the CLI prints which JAX backend is active and which devices are visible:

```text
JAX backend: gpu
JAX devices: [CudaDevice(id=0), ...]
```

If this shows `cpu`, verify that a CUDA-enabled `jaxlib` is installed and that `uv.lock` matches your environment.

## Python API

```python
from apogee_launch import solve_to_circular_orbit

result = solve_to_circular_orbit(
    h_target_km=200,
    payload_kg=5000,
    include_trajectory=True,
)

print(f"Eccentricity: {result.summary['ecc']}")
```

## Modules

| Module | Purpose |
|--------|---------|
| [simulator](simulator.md) | Main API functions |
| [falcon9](falcon9.md) | Vehicle parameters |
| plotting | Visualization utilities |
| cli | Typer CLI application |

## Dependencies

```toml
dependencies = [
    "apogee-physics",
    "typer>=0.15.0",
    "matplotlib",
]
```
