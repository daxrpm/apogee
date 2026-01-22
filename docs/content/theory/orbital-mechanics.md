---
title: Orbital Mechanics
description: Two-body orbital diagnostics and Keplerian elements
---

# Orbital Mechanics

At engine cutoff, we compute **osculating orbital elements** to evaluate mission success.

!!! note "LaTeX Reference"
    This section corresponds to **Section 7** of `nm_final_project.tex` (Equations 18-21).

## The Two-Body Problem

After leaving the atmosphere, the rocket follows a Keplerian orbit around Earth.

<figure markdown>
  ![Earth Orbit Geometry](../assets/images/general_earth_orbit.png){ width="450" }
  <figcaption>Orbital geometry with apoapsis and periapsis</figcaption>
</figure>

### Assumptions

1. **Point masses**: Earth and spacecraft treated as point masses
2. **No perturbations**: No atmospheric drag, solar radiation, or third-body effects
3. **Spherical Earth**: Gravitational field is $\mu/r^2$

### Governing Equation

$$
\ddot{\mathbf{r}} = -\frac{\mu}{r^3}\mathbf{r}
$$

Where $\mu = GM_\oplus = 3.986 \times 10^{14}$ m³/s².

---

## Step 1: Specific Orbital Energy

### Derivation

The total mechanical energy per unit mass is conserved:

$$
\varepsilon = \frac{v^2}{2} - \frac{\mu}{r} = \text{constant}
$$

**Step 1.1**: Kinetic energy per unit mass = $\frac{1}{2}v^2$

**Step 1.2**: Potential energy per unit mass = $-\frac{\mu}{r}$ (zero at infinity)

**Step 1.3**: Sum gives specific orbital energy:

$$
\boxed{\varepsilon = \frac{v^2}{2} - \frac{\mu}{r}}
\tag{Eq. 18}
$$

### Physical Interpretation

| $\varepsilon$ | Orbit Type |
|---------------|------------|
| $\varepsilon < 0$ | Bound (elliptical) |
| $\varepsilon = 0$ | Parabolic (escape) |
| $\varepsilon > 0$ | Hyperbolic (escape) |

**Implementation:**

```python title="apogee_physics/orbit.py" linenums="30"
# [Eq. 18] Specific orbital energy
eps = 0.5 * v * v - mu / r
```

---

## Step 2: Specific Angular Momentum

### Derivation

Angular momentum per unit mass is also conserved:

$$
\mathbf{h} = \mathbf{r} \times \mathbf{v}
$$

For planar motion:

$$
h = r \cdot v_\perp = r \cdot v \cos\gamma
$$

Where $v_\perp = v\cos\gamma$ is the tangential velocity component.

$$
\boxed{h = r \cdot v \cdot \cos\gamma}
\tag{Eq. 19}
$$

### Physical Interpretation

- $h = 0$: Radial motion (impact trajectory)
- Maximum $h$ for given energy: Circular orbit
- $\gamma = 0$: All velocity is tangential ($h = rv$)

**Implementation:**

```python title="apogee_physics/orbit.py" linenums="33"
# [Eq. 19] Specific angular momentum
h_ang = r * v * jnp.cos(gamma)
```

---

## Step 3: Eccentricity

### Derivation

The eccentricity relates energy and angular momentum:

**Step 3.1**: Start from the vis-viva equation:

$$
v^2 = \mu\left(\frac{2}{r} - \frac{1}{a}\right)
$$

**Step 3.2**: For an ellipse:

$$
a = -\frac{\mu}{2\varepsilon}
$$

**Step 3.3**: The semi-latus rectum is:

$$
p = \frac{h^2}{\mu}
$$

**Step 3.4**: Eccentricity from $p = a(1 - e^2)$:

$$
e^2 = 1 - \frac{p}{a} = 1 + \frac{2\varepsilon h^2}{\mu^2}
$$

$$
\boxed{e = \sqrt{1 + \frac{2\varepsilon h^2}{\mu^2}}}
\tag{Eq. 20}
$$

### Numerical Guard

To handle numerical errors that might give $e^2 < 0$:

$$
e = \sqrt{\max\left(0, 1 + \frac{2\varepsilon h^2}{\mu^2}\right)}
$$

**Implementation:**

```python title="apogee_physics/orbit.py" linenums="36"
# [Eq. 20] Eccentricity with numerical guard
e = jnp.sqrt(jnp.maximum(0.0, 1.0 + (2.0 * eps * h_ang * h_ang) / (mu * mu)))
```

### Eccentricity Values

| $e$ | Orbit Type |
|-----|------------|
| $e = 0$ | Circular |
| $0 < e < 1$ | Elliptical |
| $e = 1$ | Parabolic |
| $e > 1$ | Hyperbolic |

!!! success "Mission Goal"
    For circular orbit insertion, we want $e \approx 0$ (typically $e < 0.001$).

---

## Step 4: Semi-Major Axis

### Derivation

From the energy equation:

$$
\varepsilon = -\frac{\mu}{2a}
$$

Solving for $a$:

$$
\boxed{a = -\frac{\mu}{2\varepsilon}}
\tag{Eq. 21}
$$

!!! warning "Bound Orbits Only"
    This formula is valid only for $\varepsilon < 0$ (bound orbits).

**Implementation:**

```python title="apogee_physics/orbit.py" linenums="38"
# [Eq. 21] Semi-major axis (valid for bound orbits)
a = -mu / (2.0 * eps)
```

---

## Step 5: Apoapsis and Periapsis

### Derivation

For an ellipse with semi-major axis $a$ and eccentricity $e$:

$$
r_a = a(1 + e) \quad \text{(apoapsis)}
$$

$$
r_p = a(1 - e) \quad \text{(periapsis)}
$$

Altitudes above Earth's surface:

$$
h_a = r_a - R_E, \quad h_p = r_p - R_E
$$

**Implementation:**

```python title="apogee_physics/orbit.py" linenums="41"
r_apo = a * (1.0 + e)
r_peri = a * (1.0 - e)
```

---

## Mission Success Criteria

For a **circular orbit** at target altitude $h_{\text{target}}$:

### Target State

$$
\begin{aligned}
r_{\text{target}} &= R_E + h_{\text{target}} \\
v_{\text{circular}} &= \sqrt{\frac{\mu}{r_{\text{target}}}} \\
\gamma_{\text{target}} &= 0 \quad \text{(horizontal)}
\end{aligned}
$$

### Success Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Eccentricity | $e$ | $< 0.001$ |
| Altitude error | $a - r_{\text{target}}$ | $< 2$ km |
| Velocity error | $v - v_{\text{circular}}$ | $< 5$ m/s |
| Flight-path angle | $\gamma$ | $< 0.1°$ |

---

## Complete Implementation

```python title="apogee_physics/orbit.py" linenums="16"
def orbit_diagnostics(*, y: Array, earth: EarthParams):
    """Two-body orbit diagnostics at cutoff per LaTeX Report (Section 7).
    
    Equations:
      - Specific Energy (epsilon): [Eq. 18]
      - Specific Angular Momentum (h): [Eq. 19]
      - Eccentricity (e): [Eq. 20]
      - Semi-major Axis (a): [Eq. 21]
    """
    r = y[_R]
    v = y[_V]
    gamma = y[_GAMMA]
    
    mu = earth.mu
    
    # [Eq. 18] Specific energy
    eps = 0.5 * v * v - mu / r
    
    # [Eq. 19] Specific angular momentum
    h_ang = r * v * jnp.cos(gamma)
    
    # [Eq. 20] Eccentricity
    e = jnp.sqrt(jnp.maximum(0.0, 1.0 + (2.0 * eps * h_ang * h_ang) / (mu * mu)))
    
    # [Eq. 21] Semi-major axis
    a = -mu / (2.0 * eps)
    
    # Apoapsis and periapsis
    r_apo = a * (1.0 + e)
    r_peri = a * (1.0 - e)
    
    return eps, h_ang, a, e, r_apo, r_peri
```

---

## Orbital Parameters in Output

The simulation returns orbital diagnostics in the JSON output:

```json
{
  "trajectory": {
    "orbit": {
      "specific_energy": -2.94e7,
      "specific_angular_momentum": 5.13e10,
      "semi_major_axis": 6578137,
      "eccentricity": 0.000498,
      "apoapsis": 6581414,
      "periapsis": 6574860
    }
  }
}
```

---

## References

1. **Battin, R.H.** (1999). *An Introduction to the Mathematics and Methods of Astrodynamics*. 
   AIAA Education Series. Chapters 3-4.

2. **Curtis, H.D.** (2013). *Orbital Mechanics for Engineering Students*. 
   Butterworth-Heinemann. Chapter 2 - "The Two-Body Problem".

3. **Vallado, D.A.** (2013). *Fundamentals of Astrodynamics and Applications*. 
   Microcosm Press. Chapter 2.

---

## Next Steps

- [Flight Phases](flight-phases.md) - Hybrid system dynamics
- [Shooting Method](../numerical-methods/optimization/shooting-method.md) - How we achieve circular orbits
