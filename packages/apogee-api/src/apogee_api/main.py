"""FastAPI main application."""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import health, launch, orbit

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

# Set specific levels for different modules
logging.getLogger('apogee_physics.shooting').setLevel(logging.INFO)
logging.getLogger('apogee_physics.simulate').setLevel(logging.WARNING)
logging.getLogger('apogee_launch').setLevel(logging.INFO)
logging.getLogger('apogee_api').setLevel(logging.INFO)

# Reduce noise from uvicorn
logging.getLogger('uvicorn.access').setLevel(logging.WARNING)

app = FastAPI(
    title="Apogee API",
    description="Rocket launch and orbital mechanics simulator",
    version="0.1.0",
)

logger = logging.getLogger(__name__)
logger.info("Apogee API starting up...")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(launch.router, prefix="/launch", tags=["launch"])
app.include_router(orbit.router, prefix="/orbit", tags=["orbit"])

logger.info("Apogee API ready to accept requests")

@app.on_event("startup")
async def startup_event():
    logger.info("FastAPI application started")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("FastAPI application shutting down")
