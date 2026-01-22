# APOGEE API

FastAPI backend for rocket launch and orbital simulations.

## Overview

This package provides REST API endpoints for:
- **Launch Simulation**: Optimal trajectory calculation for rocket launches to circular orbit
- **Orbit Trajectory**: Full orbit propagation with yaw steering profiles
- **Yaw Calculation**: Fast single-point yaw steering for live updates

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/launch/simulate` | POST | Simulate rocket launch to circular orbit using shooting method |
| `/orbit/trajectory` | POST | Get full orbit trajectory with yaw steering profile |
| `/orbit/yaw` | POST | Fast single-point yaw calculation for live sun updates |

## Local Development

```bash
# From the project root
cd /path/to/apogee

# Install dependencies with uv
uv sync

# Run the API server
uv run uvicorn apogee_api.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive API documentation.

## Docker Deployment

### Build Locally

```bash
# From the API package directory
cd packages/apogee-api

# Build and run with Docker Compose (recommended for testing)
docker compose up --build

# Or build manually from project root
cd ../..
docker build -f packages/apogee-api/Dockerfile -t apogee-api .
docker run -p 8000:8000 apogee-api
```

### Deploy to Coolify

1. **Create a new service** in Coolify
2. **Connect your Git repository**
3. **Configure the build settings**:
   - **Build Pack**: Dockerfile
   - **Dockerfile Location**: `packages/apogee-api/Dockerfile`
   - **Docker Context**: `.` (repository root)
   - **Port**: `8000`

4. **Environment Variables** (optional):
   ```
   PORT=8000
   LOG_LEVEL=info
   JAX_PLATFORM_NAME=cpu
   ```

5. **Health Check Path**: `/health`

6. **Deploy!**

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Server port |
| `LOG_LEVEL` | `info` | Logging level |
| `JAX_PLATFORM_NAME` | `cpu` | JAX backend (use `cpu` for containers) |

## Architecture

```
apogee-api/
├── src/apogee_api/
│   ├── __init__.py
│   ├── main.py           # FastAPI app entry point
│   ├── routers/
│   │   ├── health.py     # Health check endpoint
│   │   ├── launch.py     # Launch simulation endpoints
│   │   └── orbit.py      # Orbit calculation endpoints
│   └── schemas/
│       ├── launch.py     # Launch request/response schemas
│       └── orbit.py      # Orbit request/response schemas
├── Dockerfile            # Production Docker image
├── docker-compose.yml    # Local testing setup
└── pyproject.toml        # Package configuration
```

## Dependencies

- `fastapi` - Web framework
- `uvicorn[standard]` - ASGI server
- `pydantic` - Data validation
- `apogee-launch` - Launch simulation (workspace dependency)
- `apogee-orbit` - Orbital mechanics (workspace dependency)
