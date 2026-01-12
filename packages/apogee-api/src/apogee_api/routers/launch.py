"""Launch simulation endpoints."""

import logging
import time

from fastapi import APIRouter, HTTPException

from apogee_launch import solve_to_circular_orbit

from ..schemas.launch import LaunchRequest, LaunchResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/simulate", response_model=LaunchResponse)
async def simulate_launch(request: LaunchRequest):
    """Simulate rocket launch to circular orbit using shooting method.
    
    This endpoint solves the optimal trajectory for a Falcon 9-like rocket
    to reach a circular orbit at the specified altitude with the given payload.
    """
    start_time = time.time()
    logger.info(f"POST /simulate - h_target={request.h_target_km}km, payload={request.payload_kg}kg, include_trajectory={request.include_trajectory}")
    
    try:
        kwargs = {}
        if request.theta0_deg is not None:
            kwargs["theta0_initial"] = request.theta0_deg
        if request.t_coast is not None:
            kwargs["t_coast_initial"] = request.t_coast
        if request.t_burn2 is not None:
            kwargs["t_burn2_initial"] = request.t_burn2
        
        result = solve_to_circular_orbit(
            h_target_km=request.h_target_km,
            payload_kg=request.payload_kg,
            include_trajectory=request.include_trajectory,
            trim=True,
            **kwargs,
        )
        
        elapsed = time.time() - start_time
        logger.info(f"Simulation completed in {elapsed:.2f}s - ecc={result.summary['ecc']:.6f}, h_err={result.summary['h_err_m']:.1f}m")
        
        return LaunchResponse(
            schema_version=result.schema_version,
            inputs=result.inputs,
            optimal_numerics=result.optimal_numerics,
            summary=result.summary,
            trajectory=result.trajectory,
        )
    except ValueError as e:
        elapsed = time.time() - start_time
        logger.warning(f"Bad request after {elapsed:.2f}s: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        elapsed = time.time() - start_time
        logger.error(f"Simulation failed after {elapsed:.2f}s: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Internal error after {elapsed:.2f}s: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
