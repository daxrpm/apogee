---
title: simulate
description: Hybrid system simulation with event detection
---

# simulate

Manages the multi-phase rocket flight simulation with event-driven transitions.

## Functions

### `simulate_ascent`

Main simulation entry point.

```python
def simulate_ascent(config: AscentConfig) -> Trajectory:
```

**Phases:**

1. **Vertical Ascent** → Event: Pitchover altitude
2. **Gravity Turn** → Event: Stage 1 burnout
3. **Coast** → Fixed duration
4. **Stage 2 Burn** → Events: Time limit, fuel depletion

**Returns:** Complete trajectory with all phase data concatenated.

### `simulate_ascent_final`

Simulation for optimization (returns only final state).

```python
def simulate_ascent_final(config: AscentConfig) -> FinalState:
```

More efficient when only the terminal state is needed.

### `simulate_ascent_final_core`

JIT-friendly core integration routine used by the shooting solver to push the expensive ODE integration onto the selected JAX backend (CPU/GPU).

This function:

- takes a pre-built `AtmosphereTable` argument (so it is not constructed inside `jax.jit`)
- avoids Python-side checks/raises that depend on traced values

```python
def simulate_ascent_final_core(config: AscentConfig, atmos: AtmosphereTable) -> tuple[Array, Array]:
```

For backwards compatibility, `simulate_ascent_final_unchecked` remains available as an alias.

## Event Functions

```python
def _cond_ground(t, y, args, **kwargs):
    """Ground impact detection."""
    return y[_R] - args["earth"].r_e

def _cond_pitch_over(t, y, args, **kwargs):
    """Pitchover altitude reached."""
    return y[_R] - (args["earth"].r_e + args["h_pitch"])

def _cond_stage1_burnout(t, y, args, **kwargs):
    """Stage 1 propellant exhausted."""
    return y[_M] - args["m1_end"]

def _cond_fuel_depletion(t, y, args, **kwargs):
    """All propellant exhausted."""
    return y[_M] - args["m_min"]
```

## ODE Solver Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Solver | Tsit5 | Tsitouras 5(4) RK |
| rtol | 1e-6 | Relative tolerance |
| atol | 1e-6 | Absolute tolerance |
| max_steps | 100,000 | Safety limit |
