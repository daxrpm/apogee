---
title: ODE Integration
description: Overview of ODE solvers used in the Apogee simulator
---

# ODE Integration

The Apogee simulator solves initial value problems (IVPs) of the form:

$$
\frac{d\mathbf{y}}{dt} = \mathbf{f}(\mathbf{y}, t), \quad \mathbf{y}(t_0) = \mathbf{y}_0
$$

## Solver Choice

We use the **Tsitouras 5(4)** explicit Runge-Kutta method from [Diffrax](https://github.com/patrick-kidger/diffrax).

### Why Tsit5?

| Feature | Benefit |
|---------|---------|
| Explicit | No linear system solves |
| 5th order | High accuracy |
| Embedded 4th order | Error estimation for adaptivity |
| FSAL | Efficient step reuse |

### Configuration

```python title="apogee_physics/simulate.py" linenums="143"
solver = diffrax.Tsit5()
stepsize_controller = diffrax.PIDController(rtol=rtol, atol=atol)
```

## Topics

- [Runge-Kutta Methods](runge-kutta.md) - Theory and derivation
- [Adaptive Stepping](adaptive-stepping.md) - Error control

## Implementation

```python title="apogee_physics/simulate.py" linenums="143"
def _solve_segment(*, term, solver, t0, t1, dt0, y0, args, event, rtol, atol, max_steps):
    """Solve ODE segment with event detection."""
    return diffrax.diffeqsolve(
        term,
        solver,
        t0=t0,
        t1=t1,
        dt0=dt0,
        y0=y0,
        args=args,
        saveat=diffrax.SaveAt(t0=True, steps=True),
        stepsize_controller=diffrax.PIDController(rtol=rtol, atol=atol),
        event=event,
        max_steps=max_steps,
    )
```

## References

1. **Hairer, E., Nørsett, S.P., & Wanner, G.** (1993). 
   *Solving Ordinary Differential Equations I: Nonstiff Problems*. Springer.

2. **Tsitouras, Ch.** (2011). "Runge-Kutta pairs of order 5(4) satisfying only the 
   first column simplifying assumption." *Computers & Mathematics with Applications*,
   62, 770-775.
