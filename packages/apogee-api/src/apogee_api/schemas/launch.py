"""Pydantic schemas for launch endpoints."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class LaunchRequest(BaseModel):
    """Request for launch simulation."""
    
    h_target_km: float = Field(..., gt=0, description="Target altitude [km]")
    payload_kg: float = Field(..., ge=0, le=10000, description="Payload mass [kg]")
    theta0_deg: Optional[float] = Field(None, description="Initial pitch-over angle [degrees]")
    t_coast: Optional[float] = Field(None, description="Initial coast duration [s]")
    t_burn2: Optional[float] = Field(None, description="Initial stage 2 burn time [s]")
    include_trajectory: bool = Field(True, description="Include full trajectory in response")


class LaunchResponse(BaseModel):
    """Response from launch simulation."""
    
    schema_version: int
    inputs: dict[str, float]
    optimal_numerics: dict[str, float]
    summary: dict[str, float]
    trajectory: Optional[dict[str, Any]] = None
