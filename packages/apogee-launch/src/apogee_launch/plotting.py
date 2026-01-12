"""Plotting utilities for apogee-launch trajectory visualization."""

import logging
import math
from typing import Any

import matplotlib.pyplot as plt
import numpy as np

logger = logging.getLogger(__name__)


def plot_trajectory_2d(trajectory: dict[str, Any], title: str = "Rocket Trajectory") -> plt.Figure:
    """Create 2D trajectory plot (altitude vs downrange distance).
    
    Args:
        trajectory: Trajectory dictionary from simulation result
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    x = np.array(trajectory["pos_m"]["x"]) / 1000  # Convert to km
    y = np.array(trajectory["pos_m"]["y"]) / 1000  # Convert to km
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Plot trajectory
    ax.plot(x, y, 'b-', linewidth=2, label='Trajectory')
    
    # Mark launch and orbit insertion points
    ax.plot(x[0], y[0], 'go', markersize=8, label='Launch')
    ax.plot(x[-1], y[-1], 'ro', markersize=8, label='Orbit Insertion')
    
    # Add Earth surface (approximate circle)
    earth_radius_km = 6371.0
    theta = np.linspace(0, 2*np.pi, 100)
    earth_x = earth_radius_km * np.cos(theta)
    earth_y = earth_radius_km * np.sin(theta)
    ax.plot(earth_x, earth_y, 'k-', linewidth=1, alpha=0.3, label='Earth Surface')
    
    # Add target altitude circle
    # Extract target altitude from title or use a default
    target_altitude_km = 200.0  # Default
    if "Target:" in title:
        try:
            # Extract number from title like "Trajectory - Target: 213km"
            import re
            match = re.search(r'Target:\s*(\d+(?:\.\d+)?)km', title)
            if match:
                target_altitude_km = float(match.group(1))
        except:
            pass
    
    target_radius_km = earth_radius_km + target_altitude_km
    target_x = target_radius_km * np.cos(theta)
    target_y = target_radius_km * np.sin(theta)
    ax.plot(target_x, target_y, 'r--', linewidth=1, alpha=0.5, label=f'Target Altitude ({target_altitude_km:.0f} km)')
    
    # Formatting
    ax.set_xlabel('Downrange Distance [km]')
    ax.set_ylabel('Altitude [km]')
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    ax.legend()
    ax.set_aspect('equal')
    
    return fig


def plot_time_series(trajectory: dict[str, Any], title: str = "Flight Parameters vs Time") -> plt.Figure:
    """Create time series plots of key flight parameters.
    
    Args:
        trajectory: Trajectory dictionary from simulation result
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    t = np.array(trajectory["t_s"])
    h = np.array(trajectory["h_m"]) / 1000  # Convert to km
    v = np.array(trajectory["v_mps"])
    gamma = np.array(trajectory["gamma_rad"]) * 180 / math.pi  # Convert to degrees
    
    fig, axes = plt.subplots(3, 1, figsize=(12, 10), sharex=True)
    
    # Altitude
    axes[0].plot(t, h, 'b-', linewidth=2)
    axes[0].set_ylabel('Altitude [km]')
    axes[0].grid(True, alpha=0.3)
    axes[0].set_title('Altitude vs Time')
    
    # Velocity
    axes[1].plot(t, v, 'r-', linewidth=2)
    axes[1].set_ylabel('Velocity [m/s]')
    axes[1].grid(True, alpha=0.3)
    axes[1].set_title('Velocity vs Time')
    
    # Flight-path angle
    axes[2].plot(t, gamma, 'g-', linewidth=2)
    axes[2].set_xlabel('Time [s]')
    axes[2].set_ylabel('Flight-Path Angle [deg]')
    axes[2].grid(True, alpha=0.3)
    axes[2].set_title('Flight-Path Angle vs Time')
    
    fig.suptitle(title)
    fig.tight_layout()
    
    return fig


def plot_flight_dynamics(trajectory: dict[str, Any], title: str = "Flight Dynamics") -> plt.Figure:
    """Create plots of Mach number and drag force (dynamic pressure removed).
    
    Args:
        trajectory: Trajectory dictionary from simulation result
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    t = np.array(trajectory["t_s"])
    mach = np.array(trajectory["mach"])
    drag = np.array(trajectory["drag_n"]) / 1000  # Convert to kN
    
    fig, axes = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
    
    # Mach number
    axes[0].plot(t, mach, 'r-', linewidth=2)
    axes[0].set_ylabel('Mach Number')
    axes[0].grid(True, alpha=0.3)
    axes[0].set_title('Mach Number vs Time')
    
    # Drag force
    axes[1].plot(t, drag, 'g-', linewidth=2)
    axes[1].set_xlabel('Time [s]')
    axes[1].set_ylabel('Drag Force [kN]')
    axes[1].grid(True, alpha=0.3)
    axes[1].set_title('Drag Force vs Time')
    
    fig.suptitle(title)
    fig.tight_layout()
    
    return fig


def plot_mass_profile(trajectory: dict[str, Any], title: str = "Vehicle Mass Profile") -> plt.Figure:
    """Create plot of vehicle mass over time.
    
    Args:
        trajectory: Trajectory dictionary from simulation result
        title: Plot title
        
    Returns:
        matplotlib Figure object
    """
    t = np.array(trajectory["t_s"])
    m = np.array(trajectory["m_kg"]) / 1000  # Convert to metric tons
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    ax.plot(t, m, 'b-', linewidth=2)
    ax.set_xlabel('Time [s]')
    ax.set_ylabel('Vehicle Mass [metric tons]')
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
    
    return fig


def plot_comprehensive(trajectory: dict[str, Any], mission_params: dict[str, float]) -> plt.Figure:
    """Create comprehensive plot with multiple subplots.
    
    Args:
        trajectory: Trajectory dictionary from simulation result
        mission_params: Mission parameters (h_target_km, payload_kg)
        
    Returns:
        matplotlib Figure object
    """
    t = np.array(trajectory["t_s"])
    h = np.array(trajectory["h_m"]) / 1000  # Convert to km
    v = np.array(trajectory["v_mps"])
    gamma = np.array(trajectory["gamma_rad"]) * 180 / math.pi  # Convert to degrees
    mach = np.array(trajectory["mach"])
    drag = np.array(trajectory["drag_n"]) / 1000  # Convert to kN
    m = np.array(trajectory["m_kg"]) / 1000  # Convert to metric tons
    
    fig = plt.figure(figsize=(16, 10))
    
    # 2D trajectory (top left)
    ax1 = plt.subplot(2, 3, 1)
    x = np.array(trajectory["pos_m"]["x"]) / 1000  # Convert to km
    y = np.array(trajectory["pos_m"]["y"]) / 1000  # Convert to km
    ax1.plot(x, y, 'b-', linewidth=2)
    ax1.plot(x[0], y[0], 'go', markersize=8, label='Launch')
    ax1.plot(x[-1], y[-1], 'ro', markersize=8, label='Insertion')
    
    # Add Earth surface and target altitude circles
    earth_radius_km = 6371.0
    theta = np.linspace(0, 2*np.pi, 100)
    earth_x = earth_radius_km * np.cos(theta)
    earth_y = earth_radius_km * np.sin(theta)
    ax1.plot(earth_x, earth_y, 'k-', linewidth=1, alpha=0.3)
    
    target_altitude_km = mission_params.get("h_target_km", 200.0)
    target_radius_km = earth_radius_km + target_altitude_km
    target_x = target_radius_km * np.cos(theta)
    target_y = target_radius_km * np.sin(theta)
    ax1.plot(target_x, target_y, 'r--', linewidth=1, alpha=0.5, label=f'Target {target_altitude_km:.0f}km')
    
    ax1.set_xlabel('Downrange [km]')
    ax1.set_ylabel('Altitude [km]')
    ax1.set_title('Trajectory')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # Altitude vs time (top middle)
    ax2 = plt.subplot(2, 3, 2)
    ax2.plot(t, h, 'b-', linewidth=2)
    ax2.set_xlabel('Time [s]')
    ax2.set_ylabel('Altitude [km]')
    ax2.set_title('Altitude Profile')
    ax2.grid(True, alpha=0.3)
    
    # Velocity vs time (top right)
    ax3 = plt.subplot(2, 3, 3)
    ax3.plot(t, v, 'r-', linewidth=2)
    ax3.set_xlabel('Time [s]')
    ax3.set_ylabel('Velocity [m/s]')
    ax3.set_title('Velocity Profile')
    ax3.grid(True, alpha=0.3)
    
    # Flight-path angle vs time (bottom left)
    ax4 = plt.subplot(2, 3, 4)
    ax4.plot(t, gamma, 'g-', linewidth=2)
    ax4.set_xlabel('Time [s]')
    ax4.set_ylabel('Flight-Path Angle [deg]')
    ax4.set_title('Flight-Path Angle')
    ax4.grid(True, alpha=0.3)
    
    # Mach number vs time (bottom middle)
    ax5 = plt.subplot(2, 3, 5)
    ax5.plot(t, mach, 'm-', linewidth=2)
    ax5.set_xlabel('Time [s]')
    ax5.set_ylabel('Mach Number')
    ax5.set_title('Mach Number')
    ax5.grid(True, alpha=0.3)
    
    # Mass vs time (bottom right)
    ax6 = plt.subplot(2, 3, 6)
    ax6.plot(t, m, 'c-', linewidth=2)
    ax6.set_xlabel('Time [s]')
    ax6.set_ylabel('Mass [metric tons]')
    ax6.set_title('Vehicle Mass')
    ax6.grid(True, alpha=0.3)
    
    # Overall title with mission parameters
    h_target = mission_params.get("h_target_km", "N/A")
    payload = mission_params.get("payload_kg", "N/A")
    fig.suptitle(f'Rocket Launch Simulation - Target: {h_target} km, Payload: {payload} kg', 
                 fontsize=14, fontweight='bold')
    
    fig.tight_layout()
    
    return fig


def show_or_save_plot(fig: plt.Figure, save_path: str | None = None, show: bool = True) -> None:
    """Display plot and optionally save to file.
    
    Args:
        fig: matplotlib Figure object
        save_path: Path to save figure (if None, don't save)
        show: Whether to display the plot interactively
    """
    if save_path:
        fig.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"Plot saved to: {save_path}")
    
    if show:
        plt.show()
    else:
        plt.close(fig)
