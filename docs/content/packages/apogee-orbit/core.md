---
title: core
description: EquatorialOrbit class for circular orbit propagation
---

# core

Defines the circular equatorial orbit model.

## EquatorialOrbit

```python
@dataclass(frozen=True)
class EquatorialOrbit:
    r: float            # Orbital radius [m]
    mu: float = 3.986e14  # Earth gravitational parameter
    nu_initial: float = 0.0  # Initial true anomaly [rad]
```

### Properties

- `n` - Mean motion [rad/s]: $n = \sqrt{\mu/r^3}$
- `period` - Orbital period [s]: $T = 2\pi/n$

### Methods

#### `get_state(t)`

Get satellite state at time $t$.

```python
def get_state(self, t: float) -> OrbitState:
```

**Returns:** Position and velocity in ECI frame.

$$
\mathbf{r}(t) = r \begin{bmatrix} \cos\nu \\ \sin\nu \\ 0 \end{bmatrix}
$$

Where $\nu = \nu_0 + n \cdot t$.

#### `get_lvlh_basis(t)`

Get LVLH basis vectors at time $t$.

```python
def get_lvlh_basis(self, t: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
```

**Returns:** `(x_lvlh, y_lvlh, z_lvlh)` in ECI coordinates.

For equatorial orbit:

$$
\mathbf{x}_L = \begin{bmatrix} -\sin\nu \\ \cos\nu \\ 0 \end{bmatrix}, \quad
\mathbf{y}_L = \begin{bmatrix} 0 \\ 0 \\ -1 \end{bmatrix}, \quad
\mathbf{z}_L = \begin{bmatrix} -\cos\nu \\ -\sin\nu \\ 0 \end{bmatrix}
$$
