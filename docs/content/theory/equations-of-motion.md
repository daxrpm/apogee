---
title: Equations of Motion
description: Complete step-by-step derivation of rocket ascent dynamics
---

# Equations of Motion

This page provides a **step-by-step derivation** of the governing differential equations for rocket ascent.

!!! note "LaTeX Reference"
    This section corresponds to **Section 3** of `nm_final_project.tex` (Equations 5-14).

## Overview

The equations of motion describe how the [state vector](state-vector.md) evolves over time:

$$
\frac{d\mathbf{y}}{dt} = \mathbf{f}(\mathbf{y}, t, \mathbf{u})
$$

Where $\mathbf{u}$ represents control inputs (thrust magnitude, steering angle).

## Step 1: Kinematic Equations

### 1.1 Radial Velocity

The radial component of velocity is the rate of change of distance from Earth's center:

$$
\frac{dr}{dt} = v_r = v \sin\gamma
$$

**Derivation:**

The velocity vector in polar coordinates:

$$
\mathbf{v} = \dot{r}\hat{e}_r + r\dot{\lambda}\hat{e}_\theta
$$

The radial component is:

$$
\dot{r} = \mathbf{v} \cdot \hat{e}_r = v\sin\gamma
$$

$$
\boxed{\frac{dr}{dt} = v \sin\gamma}
\tag{Eq. 5}
$$

### 1.2 Angular Velocity

The tangential velocity component determines the angular rate:

$$
v_\theta = r\dot{\lambda} = v\cos\gamma
$$

Solving for $\dot{\lambda}$:

$$
\boxed{\frac{d\lambda}{dt} = \frac{v \cos\gamma}{r}}
\tag{Eq. 6}
$$

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="68"
dr = v * jnp.sin(gamma)  # [Eq. 5]
dlam = v * jnp.cos(gamma) / r_safe  # [Eq. 6]
```

---

## Step 2: Force Analysis

<figure markdown>
  ![Rocket Forces](../assets/images/rocketForces.gif){ width="400" }
  <figcaption>Forces acting on the rocket in path coordinates</figcaption>
</figure>

The rocket experiences three forces:

### 2.1 Thrust Force $\mathbf{T}$

$$
\mathbf{T} = T(\cos\alpha \, \hat{t} + \sin\alpha \, \hat{n})
$$

Where:
- $T$ = thrust magnitude [N]
- $\alpha$ = steering angle (thrust vs. velocity) [rad]
- $\hat{t}$ = unit vector along velocity
- $\hat{n}$ = unit vector perpendicular to velocity (toward center of curvature)

### 2.2 Drag Force $\mathbf{D}$

$$
\mathbf{D} = -D \hat{t}
$$

Drag acts opposite to velocity. The magnitude is:

$$
D = \frac{1}{2}\rho v^2 C_D A_{\text{ref}}
$$

See [Atmosphere Model](atmosphere.md) for details.

### 2.3 Gravitational Force $\mathbf{W}$

$$
\mathbf{W} = -mg\hat{e}_r = -\frac{\mu m}{r^2}\hat{e}_r
$$

Components in path coordinates:
- Tangential: $-mg\sin\gamma$ (opposing ascent)
- Normal: $-mg\cos\gamma$ (toward Earth)

---

## Step 3: Newton's Second Law

### 3.1 Path Coordinate System

In path coordinates (tangent $\hat{t}$, normal $\hat{n}$):

$$
\sum F_t = m\frac{dv}{dt}
$$

$$
\sum F_n = m\frac{v^2}{\rho_c} = mv\frac{d\gamma}{dt} + m\frac{v^2}{r}\cos\gamma
$$

Where $\rho_c$ is the radius of curvature.

!!! info "Curvature Term"
    The term $\frac{v^2}{r}\cos\gamma$ accounts for the changing direction of the
    local horizontal as the rocket moves around the curved Earth.

### 3.2 Tangential Force Balance

$$
T\cos\alpha - D - mg\sin\gamma = m\frac{dv}{dt}
$$

Substituting $g = \mu/r^2$:

$$
\boxed{\frac{dv}{dt} = \frac{T}{m}\cos\alpha - \frac{D}{m} - \frac{\mu}{r^2}\sin\gamma}
\tag{Eq. 9}
$$

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="72"
# [Eq. 9] Speed equation
dv = (stage.thrust / m) * jnp.cos(alpha) - derived.drag / m - \
     (mu / (r_safe * r_safe)) * jnp.sin(gamma)
```

### 3.3 Normal Force Balance

$$
T\sin\alpha - mg\cos\gamma = mv\frac{d\gamma}{dt} - m\frac{v^2}{r}\cos\gamma
$$

Rearranging:

$$
\frac{d\gamma}{dt} = \frac{T}{mv}\sin\alpha + \left(\frac{v}{r} - \frac{g}{v}\right)\cos\gamma
$$

Substituting $g = \mu/r^2$:

$$
\boxed{\frac{d\gamma}{dt} = \frac{T}{mv}\sin\alpha + \left(\frac{v}{r} - \frac{\mu}{r^2 v}\right)\cos\gamma}
\tag{Eq. 10}
$$

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="78"
# [Eq. 10] Flight-path angle equation with regularization
inv_v = v / (v * v + v_eps * v_eps)  # Regularized 1/v
dgamma = (stage.thrust * inv_v / m) * jnp.sin(alpha) + \
         (v / r_safe - (mu / (r_safe * r_safe)) * inv_v) * jnp.cos(gamma)
```

---

## Step 4: Mass Flow Equation

### 4.1 Tsiolkovsky Rocket Equation

<figure markdown>
  ![Variable Mass](../assets/images/variableMass.png){ width="400" }
  <figcaption>Variable mass dynamics: exhaust velocity $v_e = I_{sp} \cdot g_0$</figcaption>
</figure>

The thrust is produced by expelling mass at high velocity:

$$
T = \dot{m}_e v_e = \dot{m}_e I_{sp} g_0
$$

Where:
- $\dot{m}_e$ = propellant mass flow rate [kg/s]
- $v_e$ = exhaust velocity [m/s]
- $I_{sp}$ = specific impulse [s]
- $g_0$ = standard gravity (9.80665 m/s²)

### 4.2 Mass Depletion Rate

Since $\dot{m} = -\dot{m}_e$ (rocket loses mass):

$$
\boxed{\frac{dm}{dt} = -\frac{T}{I_{sp} g_0}}
\tag{Eq. 11}
$$

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="81"
# [Eq. 11] Mass flow
dm = -stage.thrust / (stage.isp * earth.g0)
```

---

## Step 5: Numerical Regularization

### 5.1 The $1/v$ Singularity

Equation 10 contains $1/v$ terms. At liftoff, $v = 0$, causing division by zero.

**Problem:**
$$
\frac{d\gamma}{dt} \propto \frac{1}{v} \to \infty \quad \text{as} \quad v \to 0
$$

### 5.2 Regularized Inverse Velocity

We replace $1/v$ with a smooth approximation:

$$
\boxed{\left(\frac{1}{v}\right)_{\text{reg}} = \frac{v}{v^2 + v_\epsilon^2}}
\tag{Eq. 12}
$$

**Properties:**

| Regime | Behavior |
|--------|----------|
| $v \gg v_\epsilon$ | $\approx 1/v$ (exact) |
| $v = 0$ | $= 0$ (bounded) |
| $v = v_\epsilon$ | $= 1/(2v_\epsilon)$ |

Typically $v_\epsilon = 1.0$ m/s.

### 5.3 Safe Radius Guard

Similarly for $1/r$ terms:

$$
\boxed{r_{\text{safe}} = \max(r, 0.99 \cdot R_E)}
\tag{Eq. 13}
$$

This prevents singularity if numerical error pushes $r$ below Earth's surface.

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="65"
# Guard r to avoid singularity at r=0 [Eq. 13]
r_safe = jnp.maximum(r, earth.r_e * 0.99)

# ...

# Guard the 1/v terms near v -> 0 [Eq. 12]
inv_v = v / (v * v + v_eps * v_eps)
```

---

## Complete ODE System

The full system of differential equations:

$$
\frac{d}{dt}\begin{bmatrix} r \\ \lambda \\ v \\ \gamma \\ m \end{bmatrix} = 
\begin{bmatrix} 
v\sin\gamma \\[4pt]
\frac{v\cos\gamma}{r} \\[4pt]
\frac{T}{m}\cos\alpha - \frac{D}{m} - \frac{\mu}{r^2}\sin\gamma \\[4pt]
\frac{T}{mv}\sin\alpha + \left(\frac{v}{r} - \frac{\mu}{r^2 v}\right)\cos\gamma \\[4pt]
-\frac{T}{I_{sp}g_0}
\end{bmatrix}
$$

**Implementation:**

```python title="apogee_physics/dynamics.py" linenums="83"
return jnp.stack([dr, dlam, dv, dgamma, dm])
```

---

## Special Cases

### Vertical Ascent ($\gamma = \pi/2$)

During vertical flight:
- $\dot{r} = v$ (all velocity is radial)
- $\dot{\lambda} = 0$ (no downrange motion)
- $\dot{\gamma} = 0$ (constrained vertical)

**Implementation**: `rhs_vertical()` in `dynamics.py`

### Gravity Turn ($\alpha = 0$)

Thrust aligned with velocity:
- Simplified equations (no $\sin\alpha$ terms)
- Natural trajectory curvature from gravity

**Implementation**: `rhs_gravity_turn()` in `dynamics.py`

### Coast ($T = 0$)

No thrust phase:
- $\dot{m} = 0$ (mass constant)
- Only drag and gravity act

**Implementation**: `rhs_coast()` in `dynamics.py`

---

## Summary Table

| Equation | Expression | Implementation |
|----------|------------|----------------|
| Eq. 5 | $\dot{r} = v\sin\gamma$ | `dynamics.py:69` |
| Eq. 6 | $\dot{\lambda} = v\cos\gamma/r$ | `dynamics.py:70` |
| Eq. 9 | Speed equation | `dynamics.py:73` |
| Eq. 10 | Flight-path angle equation | `dynamics.py:79` |
| Eq. 11 | Mass flow | `dynamics.py:82` |
| Eq. 12 | Regularized $1/v$ | `dynamics.py:77` |
| Eq. 13 | Safe radius | `dynamics.py:66` |

---

## References

1. Battin, R.H. (1999). *An Introduction to the Mathematics and Methods of Astrodynamics*. 
   AIAA Education Series. Chapter 6 - "Rocket Dynamics".

2. Sutton, G.P. & Biblarz, O. (2016). *Rocket Propulsion Elements*. 
   Wiley. Chapter 4 - "Flight Performance".

3. Curtis, H.D. (2013). *Orbital Mechanics for Engineering Students*. 
   Butterworth-Heinemann. Chapter 11 - "Rocket Vehicle Dynamics".

---

## Next Steps

- [Atmosphere Model](atmosphere.md) - Density and speed of sound
- [Orbital Mechanics](orbital-mechanics.md) - Two-body diagnostics
- [Numerical Methods](../numerical-methods/index.md) - ODE solvers
