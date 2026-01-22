---
title: apogee-api
description: FastAPI REST backend
---

# apogee-api

REST API for frontend integration and web services.

## Installation

```bash
uv sync --package apogee-api
```

## Running the Server

```bash
# Development mode
uv run uvicorn apogee_api.main:app --reload

# Production mode
uv run uvicorn apogee_api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Interactive Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/launch/simulate` | POST | Run launch simulation |
| `/orbit/trajectory` | POST | Compute orbit trajectory |
| `/orbit/yaw` | POST | Real-time yaw steering |

See [endpoints](endpoints.md) for full API reference.

## Dependencies

```toml
dependencies = [
    "fastapi",
    "uvicorn[standard]",
    "pydantic",
    "apogee-launch",
    "apogee-orbit",
]
```
