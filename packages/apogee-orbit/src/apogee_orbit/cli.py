"""CLI for apogee-orbit simulator."""

import json
import logging
import math
import sys
from typing import Optional

import typer

from .plotting import plot_orbit_3d, plot_yaw_profile
from .simulator import calculate_orbit_yaw, calculate_orbit_yaw_standalone

app = typer.Typer(add_completion=False)
logger = logging.getLogger(__name__)


@app.callback(invoke_without_command=True)
def main(
    # Mission parameters (required for full simulation)
    h_target_km: Optional[float] = typer.Option(None, "--h-target-km", help="Target altitude [km] (triggers full launch+orbit)"),
    payload_kg: Optional[float] = typer.Option(None, "--payload-kg", help="Payload mass [kg]"),
    
    # Standalone orbit parameters (alternative to launch)
    r_m: Optional[float] = typer.Option(None, "--r-m", help="Orbital radius [m] (standalone mode, skips launch)"),
    nu_initial_deg: Optional[float] = typer.Option(None, "--nu-initial-deg", help="Initial true anomaly [deg] (standalone mode)"),
    
    # Sun vector
    sun_x: float = typer.Option(1.0, "--sun-x", help="Sun vector X component (ECI)"),
    sun_y: float = typer.Option(0.0, "--sun-y", help="Sun vector Y component (ECI)"),
    sun_z: float = typer.Option(0.0, "--sun-z", help="Sun vector Z component (ECI)"),
    
    # Simulation control
    t_duration_s: Optional[float] = typer.Option(None, "-t", "--t-duration", help="Simulation duration [s] (default: one full orbit)"),
    n_points: int = typer.Option(100, "-n", "--n-points", help="Number of output points"),
    
    # Logging
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug logging"),
    plot: bool = typer.Option(False, "--plot", help="Generate plots and save to plots/ directory"),
):
    """Calculate yaw steering angles for orbital solar panel pointing.
    
    Two modes of operation:
    
    1. FULL SIMULATION (--h-target-km + --payload-kg):
       Runs launch simulation first, then calculates yaw steering.
       
    2. STANDALONE (--r-m + --nu-initial-deg):
       Skips launch, uses provided orbital parameters directly.
    
    Examples:
    
        # Full simulation: launch to 200km with 5000kg payload
        uv run apogee-orbit --h-target-km 200 --payload-kg 5000
        
        # Simulate 2 orbits
        uv run apogee-orbit --h-target-km 200 --payload-kg 5000 -t 10600
        
        # Standalone with custom sun vector
        uv run apogee-orbit --r-m 6570000 --nu-initial-deg 15 --sun-x 0.7 --sun-y 0.7year
        
        # High resolution output
        uv run apogee-orbit --h-target-km 200 --payload-kg 5000 -n 360
    """
    
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
        logging.getLogger('apogee_orbit').setLevel(logging.DEBUG)
    else:
        logging.getLogger('apogee_physics.shooting').setLevel(logging.INFO)
        logging.getLogger('apogee_physics.simulate').setLevel(logging.WARNING)
        logging.getLogger('apogee_orbit').setLevel(log_level)
    
    logging.getLogger('apogee_launch').setLevel(log_level)
    
    sun_vector = (sun_x, sun_y, sun_z)
    
    # Determine mode
    full_sim_mode = h_target_km is not None and payload_kg is not None
    standalone_mode = r_m is not None
    
    if not full_sim_mode and not standalone_mode:
        typer.echo("Error: Must specify either (--h-target-km + --payload-kg) or (--r-m)", err=True)
        typer.echo("Run with --help for usage.", err=True)
        raise typer.Exit(code=1)
    
    if full_sim_mode and standalone_mode:
        typer.echo("Warning: Both modes specified. Using full simulation mode.", err=True)
    
    try:
        if full_sim_mode:
            # Full simulation: launch + orbit
            result = calculate_orbit_yaw(
                h_target_km=h_target_km,
                payload_kg=payload_kg,
                sun_vector=sun_vector,
                t_duration_s=t_duration_s,
                n_points=n_points,
            )
        else:
            # Standalone mode
            nu_initial_rad = math.radians(nu_initial_deg) if nu_initial_deg is not None else 0.0
            result = calculate_orbit_yaw_standalone(
                r_m=r_m,
                nu_initial_rad=nu_initial_rad,
                sun_vector=sun_vector,
                t_duration_s=t_duration_s,
                n_points=n_points,
            )
        
        output = {
            "schema_version": result.schema_version,
            "inputs": result.inputs,
            "orbit_params": result.orbit_params,
            "yaw_steering": result.yaw_steering,
        }
        
        print(json.dumps(output))
        
        if plot:
            try:
                from pathlib import Path
                plots_dir = Path("plots")
                plots_dir.mkdir(exist_ok=True)
                
                logger.info(f"Generating plots in {plots_dir}/ directory...")
                
                # 1. Yaw Profile
                fig1 = plot_yaw_profile(output["yaw_steering"], title=f"Orbit Yaw Profile (Sun: {sun_vector})")
                save_path1 = plots_dir / "orbit_yaw_profile.png"
                fig1.savefig(save_path1, dpi=300, bbox_inches='tight')
                logger.info(f"  Saved: {save_path1}")
                
                # 2. 3D Orbit
                fig2 = plot_orbit_3d(result, title=f"3D Orbit & Attitude (Sun: {sun_vector})")
                save_path2 = plots_dir / "orbit_3d_viz.png"
                fig2.savefig(save_path2, dpi=300, bbox_inches='tight')
                logger.info(f"  Saved: {save_path2}")
                
                # Show plots
                import matplotlib.pyplot as plt
                plt.show()
                
            except Exception as e:
                logger.error(f"Error generating plots: {e}")
                if debug:
                    import traceback
                    logger.debug(traceback.format_exc())
        
    except Exception as e:
        logger.error(f"Simulation failed: {e}")
        if debug:
            import traceback
            logger.debug(traceback.format_exc())
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
