from __future__ import annotations

from dataclasses import replace
import math
import warnings

import jax
import jax.numpy as jnp
import numpy as np

from .simulate import simulate_ascent
from .trajectory import Trajectory
from .types import AscentConfig

Array = jax.Array


def compute_residuals(u: np.ndarray, base_config: AscentConfig) -> np.ndarray:
    """
    Computes the residual vector F(u) for the shooting method.
    u = [theta0_rad, t_coast_s, t_burn2_s]
    
    Target:
    F[0] = (r_final - r_target) / r_target
    F[1] = (v_final - v_circ) / v_circ
    F[2] = gamma_final  (radians)
    """
    theta0 = float(u[0])
    t_coast = float(u[1])
    t_burn2 = float(u[2])
    
    # Check physical bounds to prevent simulator crashes
    if theta0 < 0 or theta0 > 0.35 or t_coast < 0 or t_burn2 < 0:
        return np.array([1e3, 1e3, 1e3]) # Penalty

    numerics_new = replace(base_config.numerics, theta0=theta0, t_coast=t_coast, t_burn2=t_burn2)
    config = replace(base_config, numerics=numerics_new)

    # We run the simulation (JIT compiled inside if needed, but here we call it eagerly)
    # Ideally, simulate_ascent is JIT-able. For Finite Diff, we can call it.
    traj = simulate_ascent(config)

    # Extract final state
    mask = np.isfinite(traj.t)
    if not np.any(mask):
        return np.array([1e3, 1e3, 1e3])
        
    last_idx = np.max(np.where(mask)[0])
    
    r_final = float(traj.r[last_idx])
    v_final = float(traj.v[last_idx])
    gamma_final = float(traj.gamma[last_idx])
    m_final = float(traj.m[last_idx])
    
    earth = base_config.earth
    
    # CRITICAL: Check fuel depletion (prevent negative mass)
    m_min = base_config.vehicle.m2_dry + base_config.mission.payload_mass
    if m_final < m_min - 1.0:  # Allow 1kg tolerance
        return np.array([1e4, 1e4, 1e4])  # Massive penalty for fuel violation
    
    # Check for crash or invalid state
    if r_final < earth.r_e + 100.0 or not math.isfinite(r_final):
        return np.array([1e4, 1e4, 1e4])

    r_target = earth.r_e + config.mission.h_target
    v_circ = math.sqrt(earth.mu / r_target)
    
    f1 = (r_final - r_target) / r_target
    f2 = (v_final - v_circ) / v_circ
    f3 = gamma_final
    
    return np.array([f1, f2, f3])


def solve_circular_orbit(base_config: AscentConfig) -> tuple[AscentConfig, Trajectory]:
    """
    Solves the 3x3 Two-Point Boundary Value Problem using Newton-Raphson with Finite Differences.
    
    Controls (u):
      1. theta0 (Pitch-over angle)
      2. t_coast (Coast duration)
      3. t_burn2 (Stage 2 burn duration)
      
    Targets (F=0):
      1. Radius error (relative)
      2. Velocity error (relative)
      3. Flight path angle (absolute, rad)
    """
    
    # Use scipy's robust root finder instead of manual Newton-Raphson
    import scipy.optimize
    
    def _objective(u: np.ndarray) -> float:
        """Minimize sum of squared residuals."""
        F = compute_residuals(u, base_config)
        return np.sum(F**2)
    
    def _solve_robust(u0: np.ndarray) -> np.ndarray:
        """Solve using scipy's minimize with bounds."""
        bounds = [
            (0.01, 0.3),   # theta0: 0.5° to 17°
            (10.0, 150.0), # t_coast: 10 to 150 seconds
            (100.0, 350.0) # t_burn2: 100 to 350 seconds
        ]
        
        result = scipy.optimize.minimize(
            _objective,
            u0,
            method='L-BFGS-B',
            bounds=bounds,
            options={'ftol': 1e-8, 'maxiter': 50}
        )
        
        if result.fun > 1e-6:  # If residuals are still large, try again with different method
            result = scipy.optimize.minimize(
                _objective,
                u0,
                method='Powell',
                bounds=bounds,
                options={'ftol': 1e-8, 'maxfev': 200}
            )
        
        # Check if solution is good enough
        F_final = compute_residuals(result.x, base_config)
        norm_F = np.linalg.norm(F_final)
        
        if norm_F > 1e-3:
            theta0_deg = result.x[0] * 180.0 / math.pi
            raise RuntimeError(
                f"Shooting did not converge (residual={norm_F:.6f}, "
                f"theta0={theta0_deg:.3f}deg, t_coast={result.x[1]:.3f}s, t_burn2={result.x[2]:.3f}s)"
            )
        
        return result.x

    # Use physics-based initial guess
    earth = base_config.earth
    h_target = base_config.mission.h_target
    r_target = earth.r_e + h_target
    v_circ = math.sqrt(earth.mu / r_target)
    
    # Calculate mass after stage 1
    m1_prop = (base_config.vehicle.stage1.thrust * base_config.vehicle.t1_burn) / (base_config.vehicle.stage1.isp * earth.g0)
    m_after_s1 = base_config.vehicle.m0 - m1_prop
    m_after_sep = m_after_s1 - base_config.vehicle.m1_dry
    
    # Estimate delta-v needed for stage 2 (accounting for stage 1 contribution)
    # Stage 1 provides ~3700 m/s, need ~7800 m/s orbital + losses
    # Stage 2 needs to provide ~5000-6000 m/s
    delta_v_s2_needed = 5500.0  # m/s (empirical)
    
    # Use Tsiolkovsky to estimate final mass
    # Δv = Isp * g0 * ln(m_initial / m_final)
    # m_final = m_initial * exp(-Δv / (Isp * g0))
    m_final_est = m_after_sep * math.exp(-delta_v_s2_needed / (base_config.vehicle.stage2.isp * earth.g0))
    m_final_est = max(m_final_est, base_config.vehicle.m2_dry + base_config.mission.payload_mass + 500.0)
    
    # Calculate burn time
    m2_prop_needed = m_after_sep - m_final_est
    t_burn2_est = (m2_prop_needed * base_config.vehicle.stage2.isp * earth.g0) / base_config.vehicle.stage2.thrust
    t_burn2_est = max(100.0, min(350.0, t_burn2_est))  # Clamp to reasonable range
    
    # Use empirically validated initial guess for Falcon 9 with t1_burn~146s
    theta0_seed = 8.0 * math.pi / 180.0  # 8 degrees works well
    t_coast_seed = 50.0  # 50 seconds coast
    t_burn2_seed = 240.0  # 240 seconds stage 2 burn
    
    # Override with config values if provided
    if base_config.numerics.theta0 > 0:
        theta0_seed = base_config.numerics.theta0
    if base_config.numerics.t_coast > 0:
        t_coast_seed = base_config.numerics.t_coast
    if base_config.numerics.t_burn2 > 0:
        t_burn2_seed = base_config.numerics.t_burn2

    # Reduced grid for speed - search around the good initial guess
    theta0_grid = np.deg2rad(np.array([6.0, 8.0, 10.0]))
    t_coast_grid = np.array([40.0, 50.0, 60.0])
    t_burn2_grid = np.array([220.0, 240.0, 260.0])

    candidates: list[np.ndarray] = [
        np.array([theta0_seed, t_coast_seed, t_burn2_seed]),
    ]
    for th in theta0_grid:
        for tc in t_coast_grid:
            for tb in t_burn2_grid:
                candidates.append(np.array([float(th), float(tc), float(tb)]))

    last_err: Exception | None = None
    best_result = None
    best_residual = float('inf')
    
    for u0 in candidates:
        try:
            u = _solve_robust(u0)
            F = compute_residuals(u, base_config)
            residual = np.linalg.norm(F)
            
            if residual < best_residual:
                best_residual = residual
                best_result = u
                
            if residual < 1e-4:
                break  # Good enough
                
        except Exception as e:
            last_err = e
            continue
    
    if best_result is not None and best_residual < 1e-3:
        u = best_result
    else:
        if last_err is None:
            raise RuntimeError("Shooting did not converge")
        raise last_err

    # Return final result
    theta0_star = float(u[0])
    t_coast_star = float(u[1])
    t_burn2_star = float(u[2])
    
    numerics_star = replace(base_config.numerics, theta0=theta0_star, t_coast=t_coast_star, t_burn2=t_burn2_star)
    optimal_config = replace(base_config, numerics=numerics_star)
    traj = simulate_ascent(optimal_config)
    
    return optimal_config, traj

