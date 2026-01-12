"""CLI for apogee-launch simulator."""

import json
import logging
import sys
from typing import Optional

import typer

from .simulator import solve_to_circular_orbit

app = typer.Typer(add_completion=False)


@app.callback(invoke_without_command=True)
def main(
    h_target_km: float = typer.Option(..., "--h-target-km", help="Target altitude [km]"),
    payload_kg: float = typer.Option(..., "--payload-kg", help="Payload mass [kg]"),
    no_trajectory: bool = typer.Option(False, "--no-trajectory", help="Exclude trajectory from output"),
    theta0_deg: Optional[float] = typer.Option(None, "--theta0-deg", help="Initial pitch-over angle [degrees]"),
    t_coast: Optional[float] = typer.Option(None, "--t-coast", help="Initial coast duration [s]"),
    t_burn2: Optional[float] = typer.Option(None, "--t-burn2", help="Initial stage 2 burn time [s]"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging (numerical methods details)"),
):
    """Simulate rocket launch to circular orbit using shooting method."""
    
    # Configure logging
    log_level = logging.WARNING
    if verbose:
        log_level = logging.INFO
    if debug:
        log_level = logging.DEBUG
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stderr)],
    )
    
    # Set specific levels for different modules
    if debug:
        logging.getLogger('apogee_physics.shooting').setLevel(logging.DEBUG)
        logging.getLogger('apogee_physics.simulate').setLevel(logging.DEBUG)
    else:
        logging.getLogger('apogee_physics.shooting').setLevel(logging.INFO)
        logging.getLogger('apogee_physics.simulate').setLevel(logging.WARNING)
    
    logging.getLogger('apogee_launch').setLevel(log_level)
    
    kwargs = {}
    if theta0_deg is not None:
        kwargs["theta0_initial"] = theta0_deg
    if t_coast is not None:
        kwargs["t_coast_initial"] = t_coast
    if t_burn2 is not None:
        kwargs["t_burn2_initial"] = t_burn2
    
    result = solve_to_circular_orbit(
        h_target_km=h_target_km,
        payload_kg=payload_kg,
        include_trajectory=not no_trajectory,
        trim=True,
        **kwargs,
    )
    
    output = {
        "schema_version": result.schema_version,
        "inputs": result.inputs,
        "optimal_numerics": result.optimal_numerics,
        "summary": result.summary,
    }
    
    if result.trajectory is not None:
        output["trajectory"] = result.trajectory
    
    print(json.dumps(output))


if __name__ == "__main__":
    app()
