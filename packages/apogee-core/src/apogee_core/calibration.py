from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Callable

import jax
import jax.numpy as jnp
import numpy as np
import optimistix as optx

from .atmosphere import AtmosphereTable
from .shooting import solve_circular_orbit
from .trajectory import Trajectory
from .types import (
    AscentConfig,
    CdModel,
    MissionParams,
    StageParams,
    VehicleParams,
)


Array = jax.Array


@dataclass(frozen=True, slots=True)
class CalibrationInputs:
    """Fixed engineering constraints (Part 9.1)."""
    m0: float          # Gross mass [kg]
    diameter: float    # Vehicle diameter [m]
    stage1_thrust_sl: float  # Stage 1 thrust at sea level [N]
    stage2_thrust_vac: float # Stage 2 thrust in vacuum [N]
    stage2_burn_time: float  # Stage 2 burn time [s]
    payload_mass: float      # Payload mass [kg]
    
    # Mission target for calibration
    h_target: float    # Target orbit altitude [m]


@dataclass(frozen=True, slots=True)
class CalibrationUnknowns:
    """Variables to solve for (Part 9.2)."""
    isp1: float        # Stage 1 Isp [s]
    isp2: float        # Stage 2 Isp [s]
    t1_burn: float     # Stage 1 burn time [s]
    cd_value: float    # Constant Drag Coefficient (simplified model)
    # m1_dry and m2_dry will be derived from mass budget


@dataclass(frozen=True, slots=True)
class CalibrationResult:
    unknowns: CalibrationUnknowns
    config: AscentConfig
    trajectory: Trajectory
    cost: float
    mass_budget_error: float
    orbit_error: float


class ConstantCd(CdModel):
    def __init__(self, value: float | Array):
        self.value = value

    def __call__(self, mach: Array) -> Array:
        return jnp.full_like(mach, self.value)

jax.tree_util.register_pytree_node(
    ConstantCd,
    lambda obj: ((obj.value,), None),
    lambda _, children: ConstantCd(children[0])
)


def _pack_unknowns(u: CalibrationUnknowns) -> Array:
    return jnp.array([
        u.isp1, u.isp2, u.t1_burn, u.cd_value
    ])


def _unpack_unknowns(arr: Array) -> CalibrationUnknowns:
    return CalibrationUnknowns(
        isp1=float(arr[0]),
        isp2=float(arr[1]),
        t1_burn=float(arr[2]),
        cd_value=float(arr[3]),
    )


def calibration_cost(
    p_arr: Array,
    inputs: CalibrationInputs,
    base_config: AscentConfig,
) -> float:
    """Objective function for calibration (Part 9.4)."""
    
    # Unpack parameters
    if jnp.any(p_arr <= 0.0):
        return 1e9  # Penalty for non-physical values
        
    p = _unpack_unknowns(p_arr)
    
    g0 = base_config.earth.g0
    
    # Calculate propellant masses from physics
    m1_prop = (inputs.stage1_thrust_sl * p.t1_burn) / (p.isp1 * g0)
    m2_prop = (inputs.stage2_thrust_vac * inputs.stage2_burn_time) / (p.isp2 * g0)
    
    # CRITICAL: Check total propellant doesn't exceed vehicle mass
    total_prop = m1_prop + m2_prop
    if total_prop > inputs.m0 - 20_000.0:  # Need at least 20 tons for structure
        return 1e9
    
    # Physical bounds on propellant masses
    if m1_prop < 350_000.0 or m1_prop > 450_000.0:
        return 1e9
    if m2_prop < 90_000.0 or m2_prop > 115_000.0:
        return 1e9
    
    # Calculate total available mass for dry structures
    # m0 = m1_dry + m2_dry + m1_prop + m2_prop + payload
    # Therefore: m1_dry + m2_dry = m0 - m1_prop - m2_prop - payload
    
    total_dry_mass = inputs.m0 - m1_prop - m2_prop - inputs.payload_mass
    
    # Check if we have enough mass left for structures
    if total_dry_mass < 20_000.0:  # Minimum realistic dry mass
        return 1e9
    
    # Split dry mass between stages using typical structural fractions
    # Stage 1 is ~85% of total dry mass, Stage 2 is ~15%
    m1_dry = 0.85 * total_dry_mass
    m2_dry = 0.15 * total_dry_mass
    
    # Verify positivity
    if m1_dry < 10_000.0 or m2_dry < 2_000.0:
        return 1e9
    
    # Mass budget is now satisfied by construction
    mass_budget_error = 0.0
    
    # 3. Setup Simulation Config
    # We create a new VehicleParams
    
    # Area reference
    radius = inputs.diameter / 2.0
    a_ref = jnp.pi * radius * radius
    
    stage1 = StageParams(
        thrust=inputs.stage1_thrust_sl,
        isp=p.isp1,
        a_ref=float(a_ref),
        cd=ConstantCd(p.cd_value),
    )
    
    stage2 = StageParams(
        thrust=inputs.stage2_thrust_vac,
        isp=p.isp2,
        a_ref=float(a_ref),
        cd=ConstantCd(p.cd_value * 0.8),  # Stage 2 typically has lower Cd
    )
    
    vehicle = VehicleParams(
        m0=inputs.m0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=m1_dry,
        m2_dry=m2_dry,
        t1_burn=p.t1_burn,
        t2_burn=inputs.stage2_burn_time,
    )
    
    mission = replace(base_config.mission, h_target=inputs.h_target, payload_mass=inputs.payload_mass)
    config = replace(base_config, vehicle=vehicle, mission=mission)
    
    # 4. Inner Loop: Solve Shooting Problem
    # We need to catch errors if shooting fails
    
    # We define a penalty for shooting failure
    orbit_penalty = 0.0
    
    try:
        # We use a try-except block in Python, but JAX transformations might complicate this.
        # Since we are using an outer optimizer (likely Python loop or Scipy), this is fine.
        # If we were using pure JAX opt, we couldn't try-except.
        # Assuming we use a Python-based optimizer for the outer loop (scipy/optimistix with unroll).
        
        # To keep it JAX-compatible (for potential JIT), we should ideally not throw.
        # But solve_circular_orbit currently throws or warns.
        # Let's assume we use simulate_ascent directly if we want pure gradients,
        # but the prompt asks for "Inner Loop: Solves the Shooting Problem".
        
        # Calling the shooting solver
        opt_config, traj = solve_circular_orbit(config)
        
        # 5. Calculate Residuals from the Optimal Trajectory
        # Even if shooting converges, we check the quality.
        # But if shooting converges, the orbit error should be near zero by definition.
        # The main contribution to the cost function is the MASS BUDGET and REGULARIZATION.
        # Wait, if we can satisfy any orbit by adjusting control variables (theta0, m_cut),
        # then the "Orbit Error" term in the objective is minimal, provided the vehicle CAN reach orbit.
        # If the vehicle is physically incapable, shooting will fail.
        
        # If shooting works:
        r_target = config.earth.r_e + config.mission.h_target
        v_circ = jnp.sqrt(config.earth.mu / r_target)

        t_np = np.array(traj.t)
        if not np.any(np.isfinite(t_np)):
            return 1e9
        last_idx = int(np.max(np.where(np.isfinite(t_np))[0]))

        r_cut = float(traj.r[last_idx])
        v_cut = float(traj.v[last_idx])
        gamma_cut = float(traj.gamma[last_idx])

        if not (np.isfinite(r_cut) and np.isfinite(v_cut) and np.isfinite(gamma_cut)):
            return 1e9
        
        f1 = float((r_cut - float(r_target)) / float(r_target))
        f2 = float((v_cut - float(v_circ)) / float(v_circ))
        f3 = float(gamma_cut) # Should be 0

        orbit_error_sq = f1**2 + f2**2 + f3**2

        # If the inner shooting solver didn't actually converge, treat as invalid.
        # (solve_circular_orbit currently returns a trajectory even on early-stop.)
        if orbit_error_sq > 1e-4:
            return 1e8

        # Penalize if r_cut is too low (crash)
        if r_cut < float(config.earth.r_e + 1000.0):
            orbit_error_sq += 100.0

    except Exception as e:
        # If shooting failed completely
        # print(f"Shooting failed: {e}") 
        orbit_error_sq = 10.0 # Large penalty
    
    # Strong regularization to known Falcon 9 values
    isp1_target = 282.0  # Merlin 1D sea level (from literature)
    isp2_target = 348.0  # Merlin Vac (from literature)
    t1_target = 162.0    # Typical F9 MECO time
    cd_target = 0.3      # Typical rocket Cd
    
    # Regularization penalties (strong to ensure uniqueness)
    reg_isp1 = ((p.isp1 - isp1_target) / 15.0)**2
    reg_isp2 = ((p.isp2 - isp2_target) / 15.0)**2
    reg_t1 = ((p.t1_burn - t1_target) / 10.0)**2
    reg_cd = ((p.cd_value - cd_target) / 0.1)**2
    
    regularization = 500.0 * (reg_isp1 + reg_isp2 + reg_t1 + reg_cd)
    
    # Mass budget penalty (should be near zero after adjustment)
    mass_penalty = 1e6 * (mass_budget_error**2)
    
    # Orbit error penalty
    w_orbit = 1e5
    
    cost = mass_penalty + w_orbit * orbit_error_sq + regularization
    
    return float(cost)


def calibrate_vehicle(
    inputs: CalibrationInputs,
    initial_guess: CalibrationUnknowns,
    base_config: AscentConfig,
) -> CalibrationResult:
    """
    Perform the calibration optimization loop.
    """
    import scipy.optimize
    
    # Initial vector
    x0 = np.array(_pack_unknowns(initial_guess))
    
    def objective(x):
        return calibration_cost(jnp.array(x), inputs, base_config)
    
    # Tight bounds around known values for fast convergence
    bounds = [
        (260.0, 310.0),    # isp1 (tight around 282)
        (330.0, 365.0),    # isp2 (tight around 348)
        (140.0, 180.0),    # t1_burn (tight around 162)
        (0.2, 0.5),        # cd (tight around 0.3)
    ]
    
    # Use L-BFGS-B for faster convergence with bounds
    # Nelder-Mead is too slow for nested optimization
    res = scipy.optimize.minimize(
        objective,
        x0,
        method='L-BFGS-B',
        bounds=bounds,
        options={'maxiter': 50, 'ftol': 1e-4}
    )
    
    # Alternatively, use Optimistix for the outer loop too if we want.
    # But scipy is fine and standard for this "offline" task.
    
    best_p_arr = jnp.array(res.x)
    best_p = _unpack_unknowns(best_p_arr)
    
    # Final computation
    cost = calibration_cost(best_p_arr, inputs, base_config)
    
    # Re-run to get trajectory
    # (Duplicated logic from cost function, clean up later)
    radius = inputs.diameter / 2.0
    a_ref = jnp.pi * radius * radius
    g0 = base_config.earth.g0
    
    # Recalculate dry masses with final parameters (same logic as cost function)
    m1_prop_final = (inputs.stage1_thrust_sl * best_p.t1_burn) / (best_p.isp1 * g0)
    m2_prop_final = (inputs.stage2_thrust_vac * inputs.stage2_burn_time) / (best_p.isp2 * g0)
    
    total_dry_mass = inputs.m0 - m1_prop_final - m2_prop_final - inputs.payload_mass
    m1_dry_final = 0.85 * total_dry_mass
    m2_dry_final = 0.15 * total_dry_mass
    
    stage1 = StageParams(
        thrust=inputs.stage1_thrust_sl,
        isp=best_p.isp1,
        a_ref=float(a_ref),
        cd=ConstantCd(best_p.cd_value),
    )
    stage2 = StageParams(
        thrust=inputs.stage2_thrust_vac,
        isp=best_p.isp2,
        a_ref=float(a_ref),
        cd=ConstantCd(best_p.cd_value * 0.8),
    )
    vehicle = VehicleParams(
        m0=inputs.m0,
        stage1=stage1,
        stage2=stage2,
        m1_dry=m1_dry_final,
        m2_dry=m2_dry_final,
        t1_burn=best_p.t1_burn,
        t2_burn=inputs.stage2_burn_time,
    )
    mission = replace(base_config.mission, h_target=inputs.h_target, payload_mass=inputs.payload_mass)
    config = replace(base_config, vehicle=vehicle, mission=mission)
    
    total_mass_calc = m1_dry_final + m2_dry_final + m1_prop_final + m2_prop_final + inputs.payload_mass
    mass_budget_error = float((total_mass_calc - inputs.m0) / inputs.m0)
    
    try:
        opt_config, traj = solve_circular_orbit(config)
        # Recalculate orbit error
        r_target = config.earth.r_e + config.mission.h_target

        v_circ = jnp.sqrt(config.earth.mu / r_target)

        t_np = np.array(traj.t)
        if not np.any(np.isfinite(t_np)):
            orbit_error = 999.0
        else:
            last_idx = int(np.max(np.where(np.isfinite(t_np))[0]))
            r_cut = float(traj.r[last_idx])
            v_cut = float(traj.v[last_idx])
            gamma_cut = float(traj.gamma[last_idx])

            if not (np.isfinite(r_cut) and np.isfinite(v_cut) and np.isfinite(gamma_cut)):
                orbit_error = 999.0
            else:
                f1 = float((r_cut - float(r_target)) / float(r_target))
                f2 = float((v_cut - float(v_circ)) / float(v_circ))
                f3 = float(gamma_cut)
                orbit_error = float(np.sqrt(f1**2 + f2**2 + f3**2))
    except Exception as e:
        print(f"Calibration verification failed: {e}")
        traj = Trajectory(
            t=jnp.array([0.0]), r=jnp.array([0.0]), h=jnp.array([0.0]), 
            lam=jnp.array([0.0]), x=jnp.array([0.0]), v=jnp.array([0.0]), 
            gamma=jnp.array([0.0]), m=jnp.array([0.0]), q=jnp.array([0.0]), 
            mach=jnp.array([0.0]), drag=jnp.array([0.0]), orbit=None # type: ignore
        )
        orbit_error = 999.0
        
    return CalibrationResult(
        unknowns=best_p,
        config=config,
        trajectory=traj,
        cost=cost,
        mass_budget_error=mass_budget_error,
        orbit_error=orbit_error
    )
