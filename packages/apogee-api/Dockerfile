# syntax=docker/dockerfile:1
#
# APOGEE API - Production Dockerfile
# Optimized for Coolify deployment
#

# =============================================================================
# Stage 1: Build stage using uv for fast, reproducible builds
# =============================================================================
FROM python:3.11-slim AS builder

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set working directory
WORKDIR /app

# Copy the entire workspace (needed for workspace dependencies)
COPY pyproject.toml uv.lock ./
COPY .python-version ./
COPY packages/ ./packages/

# Install all dependencies using uv sync
# This creates a virtual environment at /app/.venv with workspace packages
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM python:3.11-slim AS runtime

# Set environment variables for production
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    # JAX configuration (CPU-only for compatibility)
    JAX_PLATFORM_NAME=cpu \
    # Use the virtual environment
    PATH="/app/.venv/bin:$PATH" \
    # Set Python path to include workspace packages
    PYTHONPATH="/app/packages/apogee-api/src:/app/packages/apogee-launch/src:/app/packages/apogee-orbit/src:/app/packages/apogee-physics/src"

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid 1000 --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy all workspace source packages (they need to be in PYTHONPATH)
COPY --from=builder /app/packages/apogee-api/src /app/packages/apogee-api/src
COPY --from=builder /app/packages/apogee-launch/src /app/packages/apogee-launch/src
COPY --from=builder /app/packages/apogee-orbit/src /app/packages/apogee-orbit/src
COPY --from=builder /app/packages/apogee-physics/src /app/packages/apogee-physics/src

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (Coolify can override this via env)
EXPOSE 8000

# Health check for Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run uvicorn with production settings
# Use 0.0.0.0 to bind to all interfaces (required for Docker)
CMD ["uvicorn", "apogee_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
