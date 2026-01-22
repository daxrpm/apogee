---
title: Installation
description: Complete installation guide for Apogee rocket simulator
---

# Installation

This guide covers all installation methods for Apogee.

## Prerequisites

### Required

- **Python ≥ 3.11**
- **[uv](https://github.com/astral-sh/uv)** - Modern Python package manager

### Optional (for frontend)

- **Node.js ≥ 20**
- **npm** or **pnpm**

## Installing uv

If you don't have uv installed:

=== "macOS/Linux"

    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

=== "Windows"

    ```powershell
    powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
    ```

=== "pip"

    ```bash
    pip install uv
    ```

## Clone Repository

```bash
git clone https://github.com/daxrpm/apogee.git
cd apogee
```

## Install Python Packages

### Full Installation (Recommended)

Install all workspace packages:

```bash
uv sync
```

This installs:

| Package | Description |
|---------|-------------|
| `apogee-physics` | Core numerical engine (JAX, Diffrax, USSA1976) |
| `apogee-launch` | Launch simulator and CLI |
| `apogee-orbit` | Orbital mechanics and yaw steering |
| `apogee-api` | FastAPI REST backend |

### Individual Package

To install only a specific package:

```bash
uv sync --package apogee-launch
```

## Verify Installation

```bash
# Check CLI is available
uv run apogee-launch --help

# Run a test simulation
uv run apogee-launch --h-target-km 200 --payload-kg 5000 --no-trajectory
```

Expected output:

```json
{
  "schema_version": 1,
  "inputs": {"h_target_km": 200.0, "payload_kg": 5000.0},
  "optimal_numerics": {...},
  "summary": {"ecc": 0.000234, "h_err_m": -123.4, ...}
}
```

## Frontend Installation (Optional)

For the 3D visualization:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173/`.

## Development Setup

For contributors:

```bash
# Install with development dependencies
uv sync --all-extras

# Run tests
uv run pytest

# Type checking
uv run mypy packages/
```

## Troubleshooting

!!! warning "JAX Installation Issues"
    If you encounter JAX-related errors on Apple Silicon:
    
    ```bash
    # Install JAX with Metal support
    pip install jax-metal
    ```

!!! note "First Run Slowness"
    The first simulation takes longer (~20s) due to JAX JIT compilation.
    Subsequent runs are much faster (~0.5s).

## Next Steps

- [Quick Start](quickstart.md) - Run your first simulation
- [Architecture](architecture.md) - Understand the codebase structure
