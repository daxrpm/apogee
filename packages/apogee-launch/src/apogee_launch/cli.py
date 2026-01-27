"""CLI for apogee-launch simulator."""

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import matplotlib.pyplot as plt
import typer

from .plotting import (
    plot_comprehensive,
    plot_flight_dynamics,
    plot_mass_profile,
    plot_time_series,
    plot_trajectory_2d,
)
from .simulator import solve_to_circular_orbit

app = typer.Typer(add_completion=False)
logger = logging.getLogger(__name__)


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
    plot: bool = typer.Option(False, "--plot", help="Generate all plots and save to plots/ directory"),
):
    """Simulate rocket launch to circular orbit using shooting method."""
    
    # Force trajectory inclusion for plotting
    if plot:
        no_trajectory = False
    
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

    try:
        import jax

        logger.info(f"JAX backend: {jax.default_backend()}")
        logger.info(f"JAX devices: {jax.devices()}")
    except Exception:
        logger.warning("Failed to query JAX backend/devices", exc_info=debug)
    
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
    
    # Generate all plots if requested
    if plot and result.trajectory is not None:
        try:
            # Create plots directory
            plots_dir = Path("plots")
            plots_dir.mkdir(exist_ok=True)
            
            mission_params = {
                "h_target_km": h_target_km,
                "payload_kg": payload_kg,
            }
            
            # Generate all plots
            plot_configs = [
                ("trajectory", plot_trajectory_2d, f"Trajectory - Target: {h_target_km}km"),
                ("time", plot_time_series, f"Flight Parameters - Target: {h_target_km}km"),
                ("dynamics", plot_flight_dynamics, f"Flight Dynamics - Target: {h_target_km}km"),
                ("mass", plot_mass_profile, f"Mass Profile - Target: {h_target_km}km"),
                ("comprehensive", plot_comprehensive, mission_params),
            ]
            
            logger.info(f"Generating plots in {plots_dir}/ directory...")
            
            for plot_name, plot_func, plot_arg in plot_configs:
                if plot_name == "comprehensive":
                    fig = plot_func(result.trajectory, plot_arg)
                else:
                    fig = plot_func(result.trajectory, plot_arg)
                
                # Save plot
                save_path = plots_dir / f"{plot_name}.png"
                fig.savefig(save_path, dpi=300, bbox_inches='tight')
                logger.debug(f"  Saved: {save_path}")
                
                # Show plot
                plt.show()
                plt.close(fig)
            
            logger.info(f"All plots generated successfully in {plots_dir}/")
            
        except Exception as e:
            logger.error(f"Error generating plots: {e}")
            if debug:
                import traceback
                logger.debug(traceback.format_exc())


if __name__ == "__main__":
    app()
