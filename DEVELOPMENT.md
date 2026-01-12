# Development Guide

## Architecture Overview

This project uses a **monorepo structure** with **uv workspaces** for dependency management.

### Package Structure

```
packages/
├── apogee-physics/    # Pure physics engine (JAX/Diffrax)
├── apogee-launch/     # Launch simulator + CLI
├── apogee-orbit/      # Orbital mechanics (future)
└── apogee-api/        # FastAPI backend
```

### Dependency Flow

```
apogee-api → apogee-launch → apogee-physics
           → apogee-orbit
```

## Development Setup

### Install Dependencies

```bash
# Install all packages in editable mode
uv sync

# Install specific package
uv sync --package apogee-launch
```

### Add Dependencies

```bash
# Add dependency to specific package
cd packages/apogee-launch
uv add numpy

# Or from root with --package flag
uv add --package apogee-launch numpy
```

## Running the Project

### CLI Simulator

```bash
# Run launch simulation
uv run apogee-launch --h-target-km 213 --payload-kg 4082

# Without trajectory (faster)
uv run apogee-launch --h-target-km 213 --payload-kg 4082 --no-trajectory

# With custom parameters
uv run apogee-launch --h-target-km 200 --payload-kg 5000 \
  --theta0-deg 8.0 --t-coast 50.0 --t-burn2 300.0
```

### FastAPI Backend

```bash
# Development server with auto-reload
uv run uvicorn apogee_api.main:app --reload

# Production-like server
uv run uvicorn apogee_api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Access:
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Launch: POST http://localhost:8000/launch/simulate

### Python API

```python
from apogee_launch import solve_to_circular_orbit

result = solve_to_circular_orbit(
    h_target_km=213.0,
    payload_kg=4082.0,
    include_trajectory=True,
)

print(f"Eccentricity: {result.summary['ecc']:.6f}")
```

## Testing

### Manual Testing

```bash
# Test CLI
uv run apogee-launch --h-target-km 213 --payload-kg 4082 --no-trajectory | jq

# Test API
curl -X POST "http://localhost:8000/launch/simulate" \
  -H "Content-Type: application/json" \
  -d '{"h_target_km": 213, "payload_kg": 4082, "include_trajectory": false}' | jq
```

### Expected Output

CLI and API should produce identical results:

```json
{
  "schema_version": 1,
  "inputs": {
    "h_target_km": 213.0,
    "payload_kg": 4082.0
  },
  "optimal_numerics": {
    "theta0_rad": 0.1546863...,
    "t_coast_s": 5.2768674...,
    "t_burn2_s": 351.4219853...,
    "alpha2_rad": 0.1132040...
  },
  "summary": {
    "ecc": 0.000498436...,
    "h_err_m": -1644.615...,
    "v_err_mps": 1.829967...,
    "gamma_deg": -0.025611...
  }
}
```

## Code Organization

### apogee-physics

Pure physics implementation - **no I/O, no HTTP, no CLI**.

- `atmosphere.py`: USSA76 atmosphere model
- `dynamics.py`: ODE right-hand side
- `simulate.py`: Diffrax integration with events
- `shooting.py`: Shooting method solver
- `orbit.py`: Orbital diagnostics
- `trajectory.py`: Trajectory data structure
- `types.py`: Type definitions
- `calibration.py`: Vehicle calibration utilities

### apogee-launch

High-level launch API + CLI.

- `simulator.py`: Public API (`solve_to_circular_orbit`, `simulate_to_orbit`)
- `falcon9.py`: Falcon 9 default parameters
- `cli.py`: Typer CLI application

**Design principle**: FastAPI consumes `apogee_launch` directly, no duplication.

### apogee-orbit

Placeholder for future orbital mechanics:

- Orbit propagation (two-body, SGP4)
- Solar position calculations
- Yaw steering for solar panels
- Power generation modeling

### apogee-api

FastAPI backend - thin orchestration layer.

- `main.py`: FastAPI app with CORS
- `routers/launch.py`: Launch endpoints
- `routers/health.py`: Health check
- `schemas/launch.py`: Pydantic models

## Best Practices

### Adding New Features

1. **Physics changes**: Modify `apogee-physics`
2. **Launch logic**: Modify `apogee-launch/simulator.py`
3. **API endpoint**: Add to `apogee-api/routers/`
4. **CLI command**: Modify `apogee-launch/cli.py`

### Dependency Management

- Use `uv add` for dependencies (never edit `pyproject.toml` manually for deps)
- Keep `apogee-physics` minimal (only JAX, Diffrax, ussa1976)
- API-specific deps go in `apogee-api` only

### Code Style

- Follow existing patterns (dataclasses, type hints)
- No comments unless explaining non-obvious physics/math
- Keep functions pure when possible (especially in `apogee-physics`)

## Future: Docker Deployment

```dockerfile
# Dockerfile (future)
FROM python:3.11-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY . .
RUN uv sync --frozen
CMD ["uv", "run", "uvicorn", "apogee_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### Import errors after refactoring

```bash
# Re-sync all packages
uv sync --all-packages
```

### JAX compilation issues

```bash
# Clear JAX cache
rm -rf ~/.cache/jax
```

### Slow first run

JAX compiles on first run. Subsequent runs are fast due to caching.
