from __future__ import annotations

from typing import Tuple

import diffrax
import jax
import jax.numpy as jnp
import optimistix as optx

from .atmosphere import build_atmosphere_table
from .dynamics import compute_derived, rhs_general, rhs_gravity_turn, rhs_vertical, rhs_coast
from .orbit import orbit_diagnostics
from .trajectory import OrbitDiagnostics, Trajectory
from .types import AscentConfig, StageParams


Array = jax.Array

_R = 0
_LAM = 1
_V = 2
_GAMMA = 3
_M = 4


def _cond_ground(t, y, args, **kwargs):
    earth_, *_ = args
    return y[_R] - earth_.r_e


def _cond_pitch_over(t, y, args, **kwargs):
    earth_, _stage, _atmos, _v_eps, h_po, *_ = args
    return (y[_R] - earth_.r_e) - h_po


def _cond_stage1_burnout(t, y, args, **kwargs):
    _earth, _stage, _atmos, _v_eps, m1_end_, *_ = args
    return y[_M] - m1_end_


def _cond_fuel_depletion(t, y, args, **kwargs):
    _earth, _stage, _atmos, _v_eps, m_min_s2, *_ = args
    return y[_M] - m_min_s2


def _term_rhs_vertical(t, y, args):
    return rhs_vertical(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])


def _term_rhs_gravity_turn(t, y, args):
    return rhs_gravity_turn(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])


def _term_rhs_coast(t, y, args):
    return rhs_coast(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])


def _term_rhs_stage2_steer(t, y, args):
    return rhs_general(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], alpha=args[5], v_eps=args[3])


def _require_event(result: diffrax.RESULTS, *, name: str, hint: str) -> None:
    try:
        if result == diffrax.RESULTS.event_occurred:
            return
        if result == diffrax.RESULTS.nonlinear_max_steps_reached:
            raise RuntimeError(
                f"{name} event root-finding failed with result={result}. "
                "Try loosening numerics.root_rtol/root_atol or increasing numerics.max_steps. "
                + hint
            )
        raise RuntimeError(f"{name} did not terminate via event; result={result}. " + hint)
    except Exception as e:
        if isinstance(e, jax.errors.TracerBoolConversionError):
            return
        raise


def _require_event_with_values(*, result: diffrax.RESULTS, name: str, hint: str, g0: float, g1: float) -> None:
    try:
        if result == diffrax.RESULTS.event_occurred:
            return
        is_traced = isinstance(g0, jax.core.Tracer) or isinstance(g1, jax.core.Tracer)
        values_msg = ""
        if not is_traced:
            values_msg = f" g_start={float(g0):.6e}, g_end={float(g1):.6e}."
        msg = f"{name} did not terminate via event; result={result}.{values_msg} "
        if result == diffrax.RESULTS.nonlinear_max_steps_reached:
            msg = (
                f"{name} event root-finding failed with result={result}.{values_msg} "
                "Try loosening numerics.root_rtol/root_atol or increasing numerics.max_steps. "
            )
        raise RuntimeError(msg + hint)
    except Exception as e:
        if isinstance(e, jax.errors.TracerBoolConversionError):
            return
        raise


def _strip_nans(ts: Array, ys: Array) -> Tuple[Array, Array]:
    mask = jnp.isfinite(ts)
    if isinstance(mask, jax.core.Tracer):
        return ts, ys
    return ts[mask], ys[mask]


def _last_finite_index(ts: Array) -> Array:
    mask = jnp.isfinite(ts)
    idxs = jnp.where(mask, jnp.arange(ts.shape[0]), -1)
    return jnp.max(idxs)


def _event_mask_is(event_mask, index: int) -> bool:
    if event_mask is None:
        return False
    try:
        # event_mask mirrors the PyTree structure of the cond_fn passed to diffrax.Event.
        if isinstance(event_mask, (tuple, list)):
            return bool(event_mask[index])
        # Single event
        return bool(event_mask)
    except Exception as e:
        if isinstance(e, jax.errors.TracerBoolConversionError):
            return False
        raise


def _solve_segment(*, term: diffrax.ODETerm, solver: diffrax.AbstractSolver, t0: float, t1: float, dt0: float, y0: Array, args, event: diffrax.Event | None, rtol: float, atol: float, max_steps: int):
    saveat = diffrax.SaveAt(t0=True, steps=True)
    stepsize_controller = diffrax.PIDController(rtol=rtol, atol=atol)

    sol = diffrax.diffeqsolve(
        term,
        solver,
        t0=t0,
        t1=t1,
        dt0=dt0,
        y0=y0,
        args=args,
        saveat=saveat,
        stepsize_controller=stepsize_controller,
        event=event,
        max_steps=max_steps,
        throw=False,
    )
    ts, ys = _strip_nans(sol.ts, sol.ys)
    if not isinstance(ts, jax.core.Tracer):
        if ts.size == 0:
            ts = jnp.array([t0])
            ys = jnp.expand_dims(y0, 0)
            
    return ts, ys, sol.result, sol.event_mask


def _solve_segment_final(*, term: diffrax.ODETerm, solver: diffrax.AbstractSolver, t0: float, t1: float, dt0: float, y0: Array, args, event: diffrax.Event | None, rtol: float, atol: float, max_steps: int):
    saveat = diffrax.SaveAt(t1=True)
    stepsize_controller = diffrax.PIDController(rtol=rtol, atol=atol)

    sol = diffrax.diffeqsolve(
        term,
        solver,
        t0=t0,
        t1=t1,
        dt0=dt0,
        y0=y0,
        args=args,
        saveat=saveat,
        stepsize_controller=stepsize_controller,
        event=event,
        max_steps=max_steps,
        throw=False,
    )

    # With SaveAt(t1=True), sol.ts/sol.ys have length 1.
    t_end = sol.ts[0]
    y_end = sol.ys[0]
    return t_end, y_end, sol.result, sol.event_mask


def _get_last_state(ts: Array, ys: Array) -> Array:
    is_traced = isinstance(ts, jax.core.Tracer)
    if is_traced:
        mask = jnp.isfinite(ts)
        idxs = jnp.where(mask, jnp.arange(ts.shape[0]), -1)
        last_idx = jnp.max(idxs)
        return ys[last_idx]
    else:
        if ts.size == 0:
            return ys[0] # dangerous but unlikely if _solve_segment is correct
        return ys[-1]


def _get_last_time(ts: Array) -> Array:
    is_traced = isinstance(ts, jax.core.Tracer)
    if is_traced:
        last_idx = _last_finite_index(ts)
        return ts[last_idx]
    else:
        if ts.size == 0:
            return jnp.array(0.0)
        return ts[-1]

def simulate_ascent(config: AscentConfig) -> Trajectory:
    earth = config.earth
    vehicle = config.vehicle
    numerics = config.numerics

    atmos = build_atmosphere_table(z_max_m=config.atmosphere_z_max, dz_m=config.atmosphere_dz)

    m1_prop = vehicle.stage1.thrust * vehicle.t1_burn / (vehicle.stage1.isp * earth.g0)

    m1_end = vehicle.m0 - m1_prop

    y0 = jnp.array([earth.r_e + 1.0, 0.0, 0.0, jnp.pi / 2.0, vehicle.m0])

    solver = diffrax.Tsit5()
    root_finder = optx.Newton(rtol=numerics.root_rtol, atol=numerics.root_atol, norm=optx.rms_norm)

    event_pitch_over = diffrax.Event((_cond_pitch_over, _cond_ground), root_finder=root_finder)

    term_vertical = diffrax.ODETerm(_term_rhs_vertical)
    h_pitch_over = max(float(numerics.h_pitch_over), 2000.0)
    args_vertical = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), h_pitch_over)

    ts_a, ys_a, result_a, event_mask_a = _solve_segment(
        term=term_vertical,
        solver=solver,
        t0=0.0,
        t1=numerics.t_max,
        dt0=numerics.dt0,
        y0=y0,
        args=args_vertical,
        event=event_pitch_over,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )

    _require_event(
        result_a,
        name="Pitch-over",
        hint="Increase numerics.t_max, adjust numerics.h_pitch_over, or check that the vehicle accelerates upward (T > weight).",
    )
    if _event_mask_is(event_mask_a, 1):
        raise RuntimeError("Pitch-over terminated by ground impact; check initial conditions / thrust-to-weight.")

    y_po = _get_last_state(ts_a, ys_a)
    y_po = y_po.at[_GAMMA].set(jnp.pi / 2.0 - numerics.theta0)

    event_s1 = diffrax.Event((_cond_stage1_burnout, _cond_ground), root_finder=root_finder)

    term_s1 = diffrax.ODETerm(_term_rhs_gravity_turn)
    args_s1 = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), m1_end)

    # Note: we use _get_last_state to find start time for next segment too?
    # No, ts_a is array.
    # But wait, t0_b needs to be the end time of A.
    # ts_a[-1] is NaN in JIT!
    
    t0_b = _get_last_time(ts_a)
    t1_b = numerics.t_max

    ts_b, ys_b, result_b, event_mask_b = _solve_segment(
        term=term_s1,
        solver=solver,
        t0=t0_b,
        t1=t1_b,
        dt0=numerics.dt0,
        y0=y_po,
        args=args_s1,
        event=event_s1,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )

    # Use extracted end state
    y_b_end = _get_last_state(ts_b, ys_b)

    g0_b = y_po[_M] - m1_end
    g1_b = y_b_end[_M] - m1_end
    _require_event_with_values(
        result=result_b,
        name="Stage 1 burnout",
        hint="Increase numerics.t_max or adjust vehicle.t1_burn/isp/thrust so m reaches m1_end.",
        g0=g0_b,
        g1=g1_b,
    )
    if _event_mask_is(event_mask_b, 1):
        raise RuntimeError("Stage 1 segment terminated by ground impact; check guidance/parameters.")

    # Apply separation: remove stage 1 dry mass
    y_sep = y_b_end.at[_M].set(y_b_end[_M] - vehicle.m1_dry)

    # Coast Phase (New Phase C)
    # -------------------------
    t0_coast = _get_last_time(ts_b)
    t1_coast = t0_coast + numerics.t_coast

    # We reuse rhs_coast (already defined but unused)
    # Coasting is usually just gravity + drag, thrust=0, dm/dt=0
    term_coast = diffrax.ODETerm(_term_rhs_coast)
    # Use stage2 params for area/drag during coast (or stage1? usually stage 2 acts as the body now)
    # The 'rhs_coast' sets thrust=0 internally.
    args_coast = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps))

    event_coast = diffrax.Event(_cond_ground, root_finder=root_finder)
    ts_coast, ys_coast, result_coast, event_mask_coast = _solve_segment(
        term=term_coast,
        solver=solver,
        t0=t0_coast,
        t1=t1_coast,
        dt0=numerics.dt0,
        y0=y_sep,
        args=args_coast,
        event=event_coast,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    
    y_coast_end = _get_last_state(ts_coast, ys_coast)

    # Stage 2 Burn (Phase D)
    # ----------------------
    # Control variable is now t_burn2 (duration), not m_cut
    if result_coast == diffrax.RESULTS.event_occurred:
        raise RuntimeError("Coast terminated by ground impact; check guidance/parameters.")

    t0_d = _get_last_time(ts_coast)
    t1_d = t0_d + numerics.t_burn2

    mission = config.mission
    m_min_s2 = vehicle.m2_dry + mission.payload_mass

    event_fuel = diffrax.Event((_cond_fuel_depletion, _cond_ground), root_finder=root_finder)
    
    term_s2 = diffrax.ODETerm(_term_rhs_stage2_steer)
    args_s2 = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps), m_min_s2, jnp.array(numerics.alpha2))

    ts_d, ys_d, result_d, event_mask_d = _solve_segment(
        term=term_s2,
        solver=solver,
        t0=t0_d,
        t1=t1_d,
        dt0=numerics.dt0,
        y0=y_coast_end,
        args=args_s2,
        event=event_fuel,  # Stop at fuel depletion OR t1_d
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )

    if result_d == diffrax.RESULTS.event_occurred and _event_mask_is(event_mask_d, 1):
        raise RuntimeError("Stage 2 terminated by ground impact; check guidance/parameters.")
    
    # Check if we ran out of fuel during the fixed burn time?
    # Ideally, the optimizer finds a t_burn2 < max_burn_time.
    # But physically, m cannot drop below m2_dry.
    # The ODE allows m to go negative if not checked, but that's "mathematically valid" for the optimizer gradients.
    # We will let it float and penalize or bound in the outer loop.

    ts = jnp.concatenate([ts_a, ts_b[1:], ts_coast[1:], ts_d[1:]])
    ys = jnp.concatenate([ys_a, ys_b[1:], ys_coast[1:], ys_d[1:]], axis=0)

    mask = jnp.isfinite(ts)
    idxs = jnp.where(mask, jnp.arange(ts.shape[0]), -1)
    last_idx = jnp.max(idxs)

    r = ys[:, _R]
    lam = ys[:, _LAM]
    v = ys[:, _V]
    gamma = ys[:, _GAMMA]
    m = ys[:, _M]

    h = r - earth.r_e
    x = earth.r_e * lam

    def _derived_series(ys_seg: Array, stage: StageParams) -> tuple[Array, Array, Array]:
        r_seg = ys_seg[:, _R]
        v_seg = ys_seg[:, _V]
        h_seg = r_seg - earth.r_e
        h_clip = jnp.maximum(h_seg, 0.0)
        rho = atmos.rho_at(h_clip)
        cs = atmos.cs_at(h_clip)
        mach = v_seg / cs
        cd = stage.cd(mach)
        drag = 0.5 * rho * cd * stage.a_ref * v_seg * v_seg
        q = 0.5 * rho * v_seg * v_seg
        return mach, drag, q

    mach_a, drag_a, q_a = _derived_series(ys_a, vehicle.stage1)
    mach_b, drag_b, q_b = _derived_series(ys_b, vehicle.stage1)
    mach_coast, drag_coast, q_coast = _derived_series(ys_coast, vehicle.stage2)
    mach_d, drag_d, q_d = _derived_series(ys_d, vehicle.stage2)

    mach = jnp.concatenate([mach_a, mach_b[1:], mach_coast[1:], mach_d[1:]])
    drag = jnp.concatenate([drag_a, drag_b[1:], drag_coast[1:], drag_d[1:]])
    q = jnp.concatenate([q_a, q_b[1:], q_coast[1:], q_d[1:]])

    y_final = ys[last_idx]
    eps, h_ang, a, e, r_apo, r_peri = orbit_diagnostics(y=y_final, earth=earth)

    orbit = OrbitDiagnostics(
        specific_energy=eps,
        specific_angular_momentum=h_ang,
        semi_major_axis=a,
        eccentricity=e,
        r_apoapsis=r_apo,
        r_periapsis=r_peri,
    )

    return Trajectory(
        t=ts,
        r=r,
        h=h,
        lam=lam,
        x=x,
        v=v,
        gamma=gamma,
        m=m,
        q=q,
        mach=mach,
        drag=drag,
        orbit=orbit,
    )


def simulate_ascent_final(config: AscentConfig) -> tuple[Array, Array]:
    earth = config.earth
    vehicle = config.vehicle
    numerics = config.numerics

    atmos = build_atmosphere_table(z_max_m=config.atmosphere_z_max, dz_m=config.atmosphere_dz)

    m1_prop = vehicle.stage1.thrust * vehicle.t1_burn / (vehicle.stage1.isp * earth.g0)
    m1_end = vehicle.m0 - m1_prop

    y0 = jnp.array([earth.r_e + 1.0, 0.0, 0.0, jnp.pi / 2.0, vehicle.m0])

    solver = diffrax.Tsit5()
    root_finder = optx.Newton(rtol=numerics.root_rtol, atol=numerics.root_atol, norm=optx.rms_norm)

    term_vertical = diffrax.ODETerm(_term_rhs_vertical)
    h_pitch_over = max(float(numerics.h_pitch_over), 2000.0)
    args_vertical = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), h_pitch_over)
    event_pitch_over = diffrax.Event((_cond_pitch_over, _cond_ground), root_finder=root_finder)

    t_a, y_a, result_a, event_mask_a = _solve_segment_final(
        term=term_vertical,
        solver=solver,
        t0=0.0,
        t1=numerics.t_max,
        dt0=numerics.dt0,
        y0=y0,
        args=args_vertical,
        event=event_pitch_over,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    if result_a != diffrax.RESULTS.event_occurred or _event_mask_is(event_mask_a, 1):
        raise RuntimeError("Vertical phase failed (pitch-over not reached or ground impact).")

    y_po = y_a.at[_GAMMA].set(jnp.pi / 2.0 - numerics.theta0)

    term_s1 = diffrax.ODETerm(_term_rhs_gravity_turn)
    args_s1 = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), m1_end)
    event_s1 = diffrax.Event((_cond_stage1_burnout, _cond_ground), root_finder=root_finder)

    t_b, y_b, result_b, event_mask_b = _solve_segment_final(
        term=term_s1,
        solver=solver,
        t0=t_a,
        t1=numerics.t_max,
        dt0=numerics.dt0,
        y0=y_po,
        args=args_s1,
        event=event_s1,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    if result_b != diffrax.RESULTS.event_occurred or _event_mask_is(event_mask_b, 1):
        raise RuntimeError("Stage 1 failed (burnout not reached or ground impact).")

    y_sep = y_b.at[_M].set(y_b[_M] - vehicle.m1_dry)

    # Coast
    term_coast = diffrax.ODETerm(_term_rhs_coast)
    args_coast = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps))
    event_ground = diffrax.Event(_cond_ground, root_finder=root_finder)

    t_c, y_c, result_c, _event_mask_c = _solve_segment_final(
        term=term_coast,
        solver=solver,
        t0=t_b,
        t1=t_b + numerics.t_coast,
        dt0=numerics.dt0,
        y0=y_sep,
        args=args_coast,
        event=event_ground,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    if result_c == diffrax.RESULTS.event_occurred:
        raise RuntimeError("Coast failed (ground impact).")

    # Stage 2 burn
    mission = config.mission
    m_min_s2 = vehicle.m2_dry + mission.payload_mass

    term_s2 = diffrax.ODETerm(_term_rhs_stage2_steer)
    args_s2 = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps), m_min_s2, jnp.array(numerics.alpha2))
    event_s2 = diffrax.Event((_cond_fuel_depletion, _cond_ground), root_finder=root_finder)

    t_d, y_d, result_d, event_mask_d = _solve_segment_final(
        term=term_s2,
        solver=solver,
        t0=t_c,
        t1=t_c + numerics.t_burn2,
        dt0=numerics.dt0,
        y0=y_c,
        args=args_s2,
        event=event_s2,
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    if result_d == diffrax.RESULTS.event_occurred and _event_mask_is(event_mask_d, 1):
        raise RuntimeError("Stage 2 failed (ground impact).")

    return t_d, y_d
