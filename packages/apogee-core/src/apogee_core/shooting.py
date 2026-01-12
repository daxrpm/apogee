from __future__ import annotations

from dataclasses import replace
import math

import jax
import jax.numpy as jnp
import numpy as np

from .simulate import simulate_ascent, simulate_ascent_final
from .trajectory import Trajectory
from .types import AscentConfig

Array = jax.Array


def compute_residuals(u: np.ndarray, base_config: AscentConfig) -> np.ndarray:
    theta0 = float(u[0])
    t_coast = float(u[1])
    t_burn2 = float(u[2])
    alpha2 = float(u[3]) if u.shape[0] >= 4 else 0.0
    
    # Check physical bounds to prevent simulator crashes
    if theta0 < 0 or theta0 > 0.35 or t_coast < 0 or t_burn2 < 0 or abs(alpha2) > 0.6:
        return np.array([1e3, 1e3, 1e3]) # Penalty

    numerics_new = replace(base_config.numerics, theta0=theta0, t_coast=t_coast, t_burn2=t_burn2, alpha2=alpha2)
    config = replace(base_config, numerics=numerics_new)

    try:
        _t_final, y_final = simulate_ascent_final(config)
    except Exception:
        return np.array([1e3, 1e3, 1e3])

    r_final = float(y_final[0])
    v_final = float(y_final[2])
    gamma_final = float(y_final[3])
    m_final = float(y_final[4])
    
    earth = base_config.earth
    
    # CRITICAL: Check fuel depletion (prevent negative mass)
    m_min = base_config.vehicle.m2_dry + base_config.mission.payload_mass
    if m_final < m_min - 1.0:  # Allow 1kg tolerance
        return np.array([1e4, 1e4, 1e4])  # Massive penalty for fuel violation
    
    # Check for crash or invalid state
    if r_final < earth.r_e + 100.0 or not math.isfinite(r_final):
        return np.array([1e4, 1e4, 1e4])

    r_target = earth.r_e + config.mission.h_target

    mu = earth.mu
    cos_g = math.cos(gamma_final)
    h = r_final * v_final * cos_g
    energy = 0.5 * v_final * v_final - mu / r_final
    if (not math.isfinite(energy)) or energy >= 0.0:
        return np.array([1e4, 1e4, 1e4])
    a = -mu / (2.0 * energy)
    if (not math.isfinite(a)) or a <= 0.0:
        return np.array([1e4, 1e4, 1e4])
    e2 = 1.0 - (h * h) / (mu * a)
    if not math.isfinite(e2):
        return np.array([1e4, 1e4, 1e4])
    e2 = max(0.0, e2)
    e = math.sqrt(e2)

    f1 = (a - r_target) / r_target
    f2 = e
    f3 = gamma_final

    return np.array([f1, f2, f3])


def solve_circular_orbit(base_config: AscentConfig) -> tuple[AscentConfig, Trajectory]:
    payload_mass = float(base_config.mission.payload_mass)
    if payload_mass < 0.0 or payload_mass > 10_000.0:
        raise ValueError("payload_mass must be in [0, 10000] kg for the robust LEO configuration")

    bounds = np.array(
        [
            [0.01, 0.30],
            [0.0, 200.0],
            [50.0, 450.0],
            [-0.30, 0.30],
        ],
        dtype=float,
    )

    def _project(u: np.ndarray) -> np.ndarray:
        return np.minimum(np.maximum(u, bounds[:, 0]), bounds[:, 1])

    def _u_from_x(x: np.ndarray) -> np.ndarray:
        x = np.clip(x, -20.0, 20.0)
        s = 1.0 / (1.0 + np.exp(-x))
        return bounds[:, 0] + (bounds[:, 1] - bounds[:, 0]) * s

    def _x_from_u(u: np.ndarray) -> np.ndarray:
        u = _project(u)
        span = bounds[:, 1] - bounds[:, 0]
        z = (u - bounds[:, 0]) / span
        z = np.clip(z, 1e-6, 1.0 - 1e-6)
        return np.log(z / (1.0 - z))

    def _ok(F: np.ndarray) -> bool:
        return (abs(F[0]) < 2.0e-4) and (abs(F[1]) < 2.0e-3) and (abs(F[2]) < 1.0e-3)

    def _ok_norm(F: np.ndarray) -> bool:
        return float(np.linalg.norm(F)) < 7.5e-4

    def _fd_jacobian_x(x: np.ndarray, f0: np.ndarray, eval_budget: list[int]) -> np.ndarray:
        J = np.zeros((3, 4), dtype=float)
        steps = np.array([2e-2, 5e-2, 5e-2, 2e-2], dtype=float)
        for i in range(4):
            du = np.zeros(4, dtype=float)
            du[i] = steps[i]
            eval_budget[0] += 1
            f_plus = compute_residuals(_u_from_x(x + du), base_config)
            J[:, i] = (f_plus - f0) / steps[i]
        return J

    def _broyden_update(J: np.ndarray, s: np.ndarray, y: np.ndarray) -> np.ndarray:
        denom = float(np.dot(s, s))
        if denom <= 0.0:
            return J
        Js = J @ s
        return J + np.outer((y - Js), s) / denom

    def _newton(u0: np.ndarray) -> np.ndarray:
        x = _x_from_u(u0.astype(float))
        eval_budget = [0]
        max_evals = 900

        lam_max = 1.0e12
        resets = 0
        max_resets = 2

        u = _u_from_x(x)
        f = compute_residuals(u, base_config)
        if float(np.linalg.norm(f)) > 100.0:
            raise RuntimeError("Initial guess is infeasible")
        eval_budget[0] += 1
        J = _fd_jacobian_x(x, f, eval_budget)

        lam = 1e-2

        for _ in range(90):
            if eval_budget[0] > max_evals:
                break
            if _ok(f):
                return u

            f_norm = float(np.linalg.norm(f))
            accepted = False

            for _lm_try in range(12):
                if eval_budget[0] > max_evals:
                    break

                if (not math.isfinite(lam)) or lam > lam_max:
                    break

                A = (J.T @ J).astype(float)
                A.flat[:: A.shape[0] + 1] += float(lam)
                b = J.T @ (-f)
                try:
                    dx = np.linalg.solve(A, b)
                except np.linalg.LinAlgError:
                    dx, *_ = np.linalg.lstsq(A, b, rcond=None)

                for alpha in (1.0, 0.5, 0.25, 0.125, 0.0625):
                    x_try = x + alpha * dx
                    u_try = _u_from_x(x_try)
                    eval_budget[0] += 1
                    f_try = compute_residuals(u_try, base_config)
                    f_try_norm = float(np.linalg.norm(f_try))

                    if (not math.isfinite(f_try_norm)) or (f_try_norm > 100.0):
                        continue

                    if f_try_norm < f_norm:
                        s = x_try - x
                        y = f_try - f
                        J = _broyden_update(J, s, y)
                        x = x_try
                        u = u_try
                        f = f_try
                        lam = max(1e-8, lam / 2.0)
                        accepted = True
                        break

                if accepted:
                    break

                lam = min(lam * 10.0, lam_max)

            if not accepted:
                if (not math.isfinite(lam)) or lam >= lam_max:
                    resets += 1
                    if resets > max_resets:
                        break
                    lam = 1e-1
                    eval_budget[0] += 1
                    J = _fd_jacobian_x(x, f, eval_budget)
                    continue
                eval_budget[0] += 1
                J = _fd_jacobian_x(x, f, eval_budget)
                lam = max(lam, 1e-1)
        raise RuntimeError(
            "Shooting did not converge"
            + f" (evals={eval_budget[0]}/{max_evals}, u={u.tolist()}, ||F||={float(np.linalg.norm(f)):.6g}, F={f.tolist()})"
        )

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
    alpha2_seed = 0.0
    
    # Override with config values if provided
    if base_config.numerics.theta0 > 0:
        theta0_seed = base_config.numerics.theta0
    if base_config.numerics.t_coast > 0:
        t_coast_seed = base_config.numerics.t_coast
    if base_config.numerics.t_burn2 > 0:
        t_burn2_seed = base_config.numerics.t_burn2
    if getattr(base_config.numerics, "alpha2", 0.0) != 0.0:
        alpha2_seed = float(base_config.numerics.alpha2)

    theta0_grid = np.deg2rad(np.array([5.0, 6.5, 8.0, 9.5, 11.0]))
    t_coast_grid = np.array([0.0, 5.0, 20.0, 50.0, 80.0])
    t_burn2_grid = np.array([180.0, 220.0, 260.0, 300.0, 340.0, 380.0, 420.0])
    alpha2_grid = np.deg2rad(np.array([-12.0, -8.0, -4.0, -2.0, 0.0, 2.0, 4.0, 8.0, 12.0]))

    candidates: list[np.ndarray] = [
        np.array([theta0_seed, t_coast_seed, t_burn2_seed, alpha2_seed]),
        np.array([9.31 * math.pi / 180.0, 2.85, 336.4, 6.0 * math.pi / 180.0]),
        np.array([8.88 * math.pi / 180.0, 2.10, 371.3, 8.31 * math.pi / 180.0]),
    ]
    for th in theta0_grid:
        for tc in t_coast_grid:
            for tb in t_burn2_grid:
                for a2 in alpha2_grid:
                    candidates.append(np.array([float(th), float(tc), float(tb), float(a2)]))

    scored: list[tuple[float, np.ndarray]] = []
    for u0 in candidates:
        F0 = compute_residuals(_project(u0), base_config)
        n0 = float(np.linalg.norm(F0))
        if math.isfinite(n0) and n0 < 100.0:
            scored.append((n0, _project(u0)))
    scored.sort(key=lambda x: x[0])
    if len(scored) == 0:
        raise RuntimeError("No feasible initial guesses found for shooting")

    last_err: Exception | None = None
    best_result = None
    best_residual = float("inf")

    for _n0, u0 in scored[:24]:
        try:
            u = _newton(u0)
            F = compute_residuals(u, base_config)
            residual = float(np.linalg.norm(F))
            if residual < best_residual:
                best_residual = residual
                best_result = u
            if _ok(F) or _ok_norm(F):
                break
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
    alpha2_star = float(u[3])
    
    numerics_star = replace(
        base_config.numerics,
        theta0=theta0_star,
        t_coast=t_coast_star,
        t_burn2=t_burn2_star,
        alpha2=alpha2_star,
    )
    optimal_config = replace(base_config, numerics=numerics_star)
    traj = simulate_ascent(optimal_config)
    
    return optimal_config, traj

