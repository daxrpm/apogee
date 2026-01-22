---
title: attitude
description: Yaw steering algorithm for solar panel optimization
---

# attitude

Implements the yaw steering control law for solar panel optimization.

## Functions

### `calculate_yaw_steering`

Calculate optimal yaw angle for given sun position.

```python
def calculate_yaw_steering(
    orbit: EquatorialOrbit,
    t: float,
    sun_eci: tuple[float, float, float]
) -> AttitudeSolution:
```

**Parameters:**

- `orbit`: EquatorialOrbit instance
- `t`: Time since epoch [s]
- `sun_eci`: Sun direction in ECI frame

**Returns:** `AttitudeSolution` with yaw and beta angles.

## Algorithm

### Step 1: Transform Sun to LVLH

Get LVLH basis and project sun vector:

$$
\mathbf{s}_{\text{local}} = \begin{bmatrix} 
\mathbf{s} \cdot \mathbf{x}_L \\ 
\mathbf{s} \cdot \mathbf{y}_L \\ 
\mathbf{s} \cdot \mathbf{z}_L 
\end{bmatrix}
$$

### Step 2: Calculate Yaw Angle

Rotation about nadir (Z) axis:

$$
\boxed{\psi = \arctan2(s_{y,\text{local}}, s_{x,\text{local}})}
$$

This places the sun vector in the body X-Z plane.

### Step 3: Calculate Beta Angle

Sun elevation above orbital plane:

$$
\beta = \arcsin(-s_{y,\text{local}})
$$

## Physical Interpretation

| Condition | Yaw $\psi$ | Meaning |
|-----------|------------|---------|
| Sun ahead | 0° | Face forward |
| Sun behind | 180° | Face backward |
| Sun at ±90° | ±90° | Rotate sideways |

## Implementation

```python
def calculate_yaw_steering(orbit, t, sun_eci):
    # Normalize sun vector
    s_eci = np.array(sun_eci) / np.linalg.norm(sun_eci)
    
    # Get LVLH basis
    x_lvlh, y_lvlh, z_lvlh = orbit.get_lvlh_basis(t)
    
    # Project to local frame
    sx_local = np.dot(s_eci, x_lvlh)
    sy_local = np.dot(s_eci, y_lvlh)
    sz_local = np.dot(s_eci, z_lvlh)
    
    # Yaw and beta
    psi = np.arctan2(sy_local, sx_local)
    beta = np.arcsin(-sy_local)
    
    return AttitudeSolution(t=t, yaw=psi, beta=beta, ...)
```
