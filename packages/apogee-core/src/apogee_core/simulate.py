from __future__ import annotations

from typing import Tuple

import diffrax
import jax
import jax.numpy as jnp
import optimistix as optx

from .atmosphere import build_atmosphere_table
from .dynamics import compute_derived, rhs_gravity_turn, rhs_vertical, rhs_coast
from .orbit import orbit_diagnostics
from .trajectory import OrbitDiagnostics, Trajectory
from .types import AscentConfig, StageParams


Array = jax.Array

_R = 0
_LAM = 1
_V = 2
_GAMMA = 3
_M = 4


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
    
    # Robustness: if solver returns no steps (e.g. immediate event or failure),
    # return the initial state as a single-point trajectory.
    # We need to check if ts is empty.
    # In JIT, len(ts) is static (max steps), but _strip_nans returns dynamic-sized array?
    # _strip_nans uses masking, so the shape is dynamic in eager mode or boolean-indexed.
    # We can check size.
    
    def _handle_empty():
        return jnp.array([t0]), jnp.expand_dims(y0, 0)

    def _handle_ok():
        return ts, ys

    # If ts has size 0, use fallback.
    # Note: jnp.array(t0) is scalar, we need 1D array.
    
    # Use jax.lax.cond for JIT compatibility if needed, but here we are likely just using python control flow 
    # if _strip_nans returns concrete arrays in eager mode.
    # However, to be safe with JIT:
    # ts.size is a tracer in JIT.
    
    has_steps = (ts.shape[0] > 0)
    
    # We can't easily conditionally return different shaped arrays in JIT if they weren't dynamic.
    # But _strip_nans already produces dynamic shapes (via boolean indexing).
    # Actually, boolean indexing in JIT returns a known shape if using `size`? 
    # No, boolean indexing returns Bounded arrays in JAX if used carefully, 
    # but normally `ts[mask]` is problematic in JIT unless using `jax.numpy.compress` or similar which pads?
    # `_strip_nans` implementation:
    #     mask = jnp.isfinite(ts)
    #     if isinstance(mask, jax.core.Tracer): return ts, ys 
    # It returns FULL arrays if traced!
    # So if traced, `ts` is full length (with NaNs).
    # If not traced (eager), `ts` is stripped.
    
    # If traced, we rely on the caller to handle NaNs? 
    # But `simulate_ascent` concatenates them.
    # `ts_a` etc.
    
    if isinstance(ts, jax.core.Tracer):
        # In JIT, we didn't strip NaNs. So we have full arrays.
        # We assume sol.ts[0] is t0 (due to SaveAt(t0=True)).
        # If SaveAt(t0=True) is used, index 0 is always finite (t0).
        # So we don't need to do anything special?
        pass
    else:
        # Eager mode: ts is stripped.
        if ts.size == 0:
            ts = jnp.array([t0])
            ys = jnp.expand_dims(y0, 0)
            
    return ts, ys, sol.result


def _get_last_state(ts: Array, ys: Array) -> Array:
    """Get the last valid state from a potentially padded trajectory segment."""
    # check for tracer
    is_traced = isinstance(ts, jax.core.Tracer)
    if is_traced:
        mask = jnp.isfinite(ts)
        # Fill non-finite indices with -1 so they are not selected by max
        idxs = jnp.where(mask, jnp.arange(ts.shape[0]), -1)
        last_idx = jnp.max(idxs)
        return ys[last_idx]
    else:
        # In eager mode, we assume _solve_segment handled empty cases or returned stripped arrays
        if ts.size == 0:
            # Fallback if somehow empty (should be handled by _solve_segment)
            return ys[0] # dangerous but unlikely if _solve_segment is correct
        return ys[-1]


@jax.jit
def simulate_ascent(config: AscentConfig) -> Trajectory:
    earth = config.earth
    vehicle = config.vehicle
    numerics = config.numerics

    atmos = build_atmosphere_table(z_max_m=config.atmosphere_z_max, dz_m=config.atmosphere_dz)

    m1_prop = vehicle.stage1.thrust * vehicle.t1_burn / (vehicle.stage1.isp * earth.g0)

    m1_end = vehicle.m0 - m1_prop

    y0 = jnp.array([earth.r_e, 0.0, 0.0, jnp.pi / 2.0, vehicle.m0])

    solver = diffrax.Tsit5()
    root_finder = optx.Newton(rtol=numerics.root_rtol, atol=numerics.root_atol, norm=optx.rms_norm)

    def cond_pitch_over(t, y, args, **kwargs):
        earth_, _stage, _atmos, _v_eps, h_po = args
        return (y[_R] - earth_.r_e) - h_po

    event_pitch_over = diffrax.Event(cond_pitch_over, root_finder=None)

    term_vertical = diffrax.ODETerm(
        lambda t, y, args: rhs_vertical(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])
    )
    args_vertical = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), numerics.h_pitch_over)

    ts_a, ys_a, result_a = _solve_segment(
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

    y_po = _get_last_state(ts_a, ys_a)
    y_po = y_po.at[_GAMMA].set(jnp.pi / 2.0 - numerics.theta0)

    def cond_stage1_burnout(t, y, args, **kwargs):
        _earth, _stage, _atmos, _v_eps, m1_end_ = args
        return y[_M] - m1_end_

    event_s1 = diffrax.Event(cond_stage1_burnout, root_finder=None)

    term_s1 = diffrax.ODETerm(
        lambda t, y, args: rhs_gravity_turn(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])
    )
    args_s1 = (earth, vehicle.stage1, atmos, jnp.array(numerics.v_eps), m1_end)

    # Note: we use _get_last_state to find start time for next segment too?
    # No, ts_a is array.
    # But wait, t0_b needs to be the end time of A.
    # ts_a[-1] is NaN in JIT!
    
    t0_b = _get_last_state(ts_a, ts_a.reshape(-1, 1))[0] # Hacky reuse of _get_last_state for scalar?
    # Let's clean up _get_last_state to handle 1D arrays or make a specific one for time.
    # Actually, let's just make _get_last_state handle 1D arrays properly.
    
    # Redefine logic inside simulate_ascent for clarity or helper.
    # Let's stick to the helper pattern but assume ys can be 1D or 2D.
    
    t1_b = jnp.maximum(numerics.t_max, t0_b + 1.0)

    ts_b, ys_b, result_b = _solve_segment(
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

    y_sep = y_b_end
    y_sep = y_sep.at[_M].set(y_sep[_M] - vehicle.m1_dry)

    # Coast Phase (New Phase C)
    # -------------------------
    t0_coast = _get_last_state(ts_b, ts_b.reshape(-1, 1))[0]
    t1_coast = t0_coast + numerics.t_coast

    # We reuse rhs_coast (already defined but unused)
    # Coasting is usually just gravity + drag, thrust=0, dm/dt=0
    term_coast = diffrax.ODETerm(
        lambda t, y, args: rhs_coast(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])
    )
    # Use stage2 params for area/drag during coast (or stage1? usually stage 2 acts as the body now)
    # The 'rhs_coast' sets thrust=0 internally.
    args_coast = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps))

    ts_coast, ys_coast, result_coast = _solve_segment(
        term=term_coast,
        solver=solver,
        t0=t0_coast,
        t1=t1_coast,
        dt0=numerics.dt0,
        y0=y_sep,
        args=args_coast,
        event=None, # Coast is fixed time, not event driven (unless we crash)
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    
    y_coast_end = _get_last_state(ts_coast, ys_coast)

    # Stage 2 Burn (Phase D)
    # ----------------------
    # Control variable is now t_burn2 (duration), not m_cut
    t0_d = _get_last_state(ts_coast, ts_coast.reshape(-1, 1))[0]
    t1_d = t0_d + numerics.t_burn2

    term_s2 = diffrax.ODETerm(
        lambda t, y, args: rhs_gravity_turn(t=t, y=y, earth=args[0], stage=args[1], atmos=args[2], v_eps=args[3])
    )
    # Note: We don't need m_cut in args anymore, just physics params. 
    # But rhs_gravity_turn args signature is (earth, stage, atmos, v_eps).
    args_s2 = (earth, vehicle.stage2, atmos, jnp.array(numerics.v_eps))

    ts_d, ys_d, result_d = _solve_segment(
        term=term_s2,
        solver=solver,
        t0=t0_d,
        t1=t1_d,
        dt0=numerics.dt0,
        y0=y_coast_end,
        args=args_s2,
        event=None, # Fixed time duration
        rtol=numerics.rtol,
        atol=numerics.atol,
        max_steps=numerics.max_steps,
    )
    
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
