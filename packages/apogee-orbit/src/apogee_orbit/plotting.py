"""Plotting utilities for apogee-orbit visualization."""

import logging
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

logger = logging.getLogger(__name__)


def plot_yaw_profile(data: dict[str, Any], title: str = "Yaw Steering Profile") -> plt.Figure:
    """Create plot of Yaw and Beta angles over time.
    
    Args:
        data: Yaw steering data dictionary from OrbitResult
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    t = np.array(data["t_s"])
    yaw = np.degrees(data["yaw_rad"])
    beta = np.degrees(data["beta_rad"])
    nu = np.degrees(data["nu_rad"]) % 360
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), sharex=True)
    
    # Yaw Angle
    ax1.plot(t, yaw, 'b-', linewidth=2, label='Yaw')
    ax1.set_ylabel('Yaw Angle [deg]')
    ax1.set_title('Yaw Angle vs Time')
    ax1.grid(True, alpha=0.3)
    # Add quadrant markers for Yaw (0, 180, 0)
    ax1.set_yticks([0, 90, 180, -90, -180])
    
    # Beta Angle
    ax2.plot(t, beta, 'r-', linewidth=2, label='Beta')
    ax2.set_ylabel('Beta Angle [deg]')
    ax2.set_xlabel('Time [s]')
    ax2.set_title('Beta Angle (Sun Elevation) vs Time')
    ax2.grid(True, alpha=0.3)
    
    # Add secondary x-axis for True Anomaly?
    # Maybe just rely on Time.
    
    fig.suptitle(title)
    fig.tight_layout()
    return fig


def plot_orbit_3d(
    result: Any, 
    title: str = "3D Orbit Visualization"
) -> plt.Figure:
    """Create 3D visualization of the orbit with Sun vector and Yaw alignment.
    
    Args:
        result: OrbitResult object
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    yaw_data = result.yaw_steering
    inputs = result.inputs
    orbit_params = result.orbit_params
    
    t = np.array(yaw_data["t_s"])
    # We need to re-calculate ECI positions since they aren't stored in result
    # We can reconstruct them from t using EquatorialOrbit logic or just simple math
    r = orbit_params["semi_major_axis_m"] / 1000.0 # km
    nu_0 = orbit_params["nu_initial_rad"]
    n = orbit_params["mean_motion_rad_s"]
    
    nu = nu_0 + n * t
    x = r * np.cos(nu)
    y = r * np.sin(nu)
    z = np.zeros_like(x)
    
    fig = plt.figure(figsize=(10, 10))
    ax = fig.add_subplot(111, projection='3d')
    
    # Plot Earth
    u, v = np.mgrid[0:2*np.pi:20j, 0:np.pi:10j]
    earth_r = 6371.0
    xe = earth_r * np.cos(u) * np.sin(v)
    ye = earth_r * np.sin(u) * np.sin(v)
    ze = earth_r * np.cos(v)
    ax.plot_wireframe(xe, ye, ze, color="grey", alpha=0.3)
    
    # Plot Orbit Path
    ax.plot(x, y, z, 'b-', linewidth=2, label='Orbit Track')
    ax.plot([x[0]], [y[0]], [z[0]], 'go', label='Start')
    
    # Plot Sun Vector (scaled)
    sun_vec = np.array(inputs["sun_vector"])
    sun_scale = r * 1.5
    ax.quiver(0, 0, 0, sun_vec[0], sun_vec[1], sun_vec[2], length=sun_scale, color='y', label='Sun Vector', arrow_length_ratio=0.1)
    
    # Quivers for Satellite Orientation at intervals
    # Skip points to avoid clutter
    skip = max(1, len(t) // 20) 
    
    # Re-calculate LVLH and Yaw for visualization
    # We don't have the basis vectors stored, but we know:
    # Z_lvlh (Nadir) = -Pos / |Pos|
    # X_lvlh (Velocity) = [-sin(nu), cos(nu), 0]
    # Y_lvlh = Z cross X = [0, 0, -1]
    
    # Body Frame after Yaw rotation (psi) around Z_lvlh:
    # Body X = X_lvlh * cos(psi) + Y_lvlh * sin(psi)
    # Body Y = -X_lvlh * sin(psi) + Y_lvlh * cos(psi)
    # Body Z = Z_lvlh
    
    yaw_rad = np.array(yaw_data["yaw_rad"])
    
    for i in range(0, len(t), skip):
        nu_i = nu[i]
        psi = yaw_rad[i]
        
        # LVLH Basis
        xl = np.array([-np.sin(nu_i), np.cos(nu_i), 0.0])
        yl = np.array([0.0, 0.0, -1.0])
        # zl = np.array([-np.cos(nu_i), -np.sin(nu_i), 0.0]) # Not needed for rotation
        
        # Body X (Panel Normal? No, usually Body Y is panel axis. Body X is forward/sun-pointing face)
        # According to logic: Body X-Z plane contains Sun.
        # Panels rotate around Body Y.
        
        bx = xl * np.cos(psi) + yl * np.sin(psi)
        # by = -xl * np.sin(psi) + yl * np.cos(psi)
        
        # Draw Body X vector (Red)
        ax.quiver(x[i], y[i], z[i], bx[0], bx[1], bx[2], length=2000, color='r', alpha=0.8)
        
    # Legend
    # Create proxy artists for legend
    import matplotlib.lines as mlines
    red_line = mlines.Line2D([], [], color='red', label='Body X Axis')
    ax.legend(handles=[
        mlines.Line2D([], [], color='blue', label='Orbit'),
        mlines.Line2D([], [], color='yellow', label='Sun Direction'),
        red_line
    ])
    
    ax.set_title(title)
    ax.set_xlabel('X [km]')
    ax.set_ylabel('Y [km]')
    ax.set_zlabel('Z [km]')
    
    # Set equal aspect ratio
    max_range = np.array([x.max()-x.min(), y.max()-y.min(), z.max()-z.min()]).max() / 2.0
    mid_x = (x.max()+x.min()) * 0.5
    mid_y = (y.max()+y.min()) * 0.5
    mid_z = (z.max()+z.min()) * 0.5
    ax.set_xlim(mid_x - max_range, mid_x + max_range)
    ax.set_ylim(mid_y - max_range, mid_y + max_range)
    ax.set_zlim(mid_z - max_range, mid_z + max_range)
    
    return fig
