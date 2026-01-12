"""FastAPI main application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import launch, health

app = FastAPI(
    title="APOGEE API",
    description="Rocket launch and orbital mechanics simulator",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(launch.router, prefix="/launch", tags=["launch"])
