---
title: Runge-Kutta Methods
description: Theory and derivation of explicit Runge-Kutta ODE solvers
---

# Runge-Kutta Methods

This page derives the general theory of **explicit Runge-Kutta methods** for solving initial value problems.

!!! note "LaTeX Reference"
    This section corresponds to **Section 6.1** of `nm_final_project.tex`.

## The Problem

Given an initial value problem:

$$
\frac{dy}{dt} = f(t, y), \quad y(t_0) = y_0
$$

We seek a numerical approximation $y_n \approx y(t_n)$ at discrete times.

---

## Step 1: Euler's Method (First Order)

### Derivation

Taylor expand $y(t + h)$:

$$
y(t + h) = y(t) + h\frac{dy}{dt} + \frac{h^2}{2}\frac{d^2y}{dt^2} + \mathcal{O}(h^3)
$$

Truncating after the first derivative:

$$
y_{n+1} = y_n + h \cdot f(t_n, y_n)
$$

### Properties

- **Order**: 1 (local error $\mathcal{O}(h^2)$, global error $\mathcal{O}(h)$)
- **Stages**: 1
- **Evaluations per step**: 1

!!! warning "Insufficient for Apogee"
    First-order methods require extremely small time steps for acceptable accuracy.

---

## Step 2: General Runge-Kutta Form

### Structure

An $s$-stage explicit RK method has the form:

$$
y_{n+1} = y_n + h \sum_{i=1}^{s} b_i k_i
$$

Where the **stages** are:

$$
\begin{aligned}
k_1 &= f(t_n, y_n) \\
k_2 &= f(t_n + c_2 h, y_n + h(a_{21}k_1)) \\
k_3 &= f(t_n + c_3 h, y_n + h(a_{31}k_1 + a_{32}k_2)) \\
&\vdots \\
k_s &= f\left(t_n + c_s h, y_n + h\sum_{j=1}^{s-1} a_{sj}k_j\right)
\end{aligned}
$$

### Butcher Tableau

The coefficients are organized in a **Butcher tableau**:

$$
\begin{array}{c|cccc}
0 & & & & \\
c_2 & a_{21} & & & \\
c_3 & a_{31} & a_{32} & & \\
\vdots & \vdots & & \ddots & \\
c_s & a_{s1} & a_{s2} & \cdots & a_{s,s-1} \\
\hline
& b_1 & b_2 & \cdots & b_s
\end{array}
$$

### Consistency Condition

For consistency, the node values must satisfy:

$$
c_i = \sum_{j=1}^{i-1} a_{ij}
$$

---

## Step 3: Classical 4th Order RK

The "RK4" method:

$$
\begin{array}{c|cccc}
0 & & & & \\
\frac{1}{2} & \frac{1}{2} & & & \\
\frac{1}{2} & 0 & \frac{1}{2} & & \\
1 & 0 & 0 & 1 & \\
\hline
& \frac{1}{6} & \frac{1}{3} & \frac{1}{3} & \frac{1}{6}
\end{array}
$$

### Algorithm

$$
\begin{aligned}
k_1 &= f(t_n, y_n) \\
k_2 &= f(t_n + \tfrac{h}{2}, y_n + \tfrac{h}{2}k_1) \\
k_3 &= f(t_n + \tfrac{h}{2}, y_n + \tfrac{h}{2}k_2) \\
k_4 &= f(t_n + h, y_n + h \cdot k_3) \\
y_{n+1} &= y_n + \frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)
\end{aligned}
$$

### Properties

- **Order**: 4
- **Stages**: 4
- **Evaluations per step**: 4

---

## Step 4: Embedded Methods for Error Estimation

### The Idea

Use two formulas of different orders:

- Higher order $\hat{y}_{n+1}$ (order $p$) for stepping
- Lower order $y_{n+1}$ (order $p-1$) for error estimate

The **local error estimate**:

$$
\text{err} \approx \|\hat{y}_{n+1} - y_{n+1}\|
$$

### Butcher Tableau with Embedding

$$
\begin{array}{c|ccccc}
c_1 & & & & & \\
c_2 & a_{21} & & & & \\
\vdots & \vdots & \ddots & & & \\
c_s & a_{s1} & \cdots & a_{s,s-1} & & \\
\hline
& b_1 & b_2 & \cdots & b_s & \text{(order } p\text{)} \\
& \hat{b}_1 & \hat{b}_2 & \cdots & \hat{b}_s & \text{(order } p-1\text{)}
\end{array}
$$

---

## Step 5: Tsitouras 5(4) Method

The Apogee simulator uses the **Tsit5** method from Tsitouras (2011).

### Properties

| Property | Value |
|----------|-------|
| Stages | 7 |
| Order (main) | 5 |
| Order (embedded) | 4 |
| FSAL | Yes |
| Evaluations | 6 per step |

**FSAL** (First Same As Last): The last stage evaluation can be reused as the first stage of the next step.

### Why Tsit5?

1. **Efficiency**: 6 evaluations for 5th order (optimal)
2. **Robust error estimate**: Good step size control
3. **Well-tested**: Standard in scientific computing

### Implementation

```python title="apogee_physics/simulate.py"
import diffrax

solver = diffrax.Tsit5()
```

---

## Order Conditions

For an RK method to achieve order $p$, the coefficients must satisfy algebraic conditions derived from Taylor series matching.

### Order 1

$$
\sum_{i=1}^s b_i = 1
$$

### Order 2

$$
\sum_{i=1}^s b_i c_i = \frac{1}{2}
$$

### Order 3

$$
\sum_{i=1}^s b_i c_i^2 = \frac{1}{3}, \quad \sum_{i,j} b_i a_{ij} c_j = \frac{1}{6}
$$

### Higher Orders

Order 4 requires 4 conditions, order 5 requires 9, etc. The conditions become increasingly complex.

---

## Comparison of Methods

| Method | Order | Stages | Evaluations | Use Case |
|--------|-------|--------|-------------|----------|
| Euler | 1 | 1 | 1 | Toy problems |
| RK4 | 4 | 4 | 4 | Fixed step |
| **Tsit5** | 5(4) | 7 | 6 | **Adaptive** |
| DP5 | 5(4) | 7 | 6 | Alternative to Tsit5 |
| RK8(7) | 8(7) | 13 | 13 | High accuracy |

---

## References

1. **Hairer, E., Nørsett, S.P., & Wanner, G.** (1993). 
   *Solving Ordinary Differential Equations I: Nonstiff Problems*. Springer.
   Chapter II - "Runge-Kutta and Extrapolation Methods".

2. **Tsitouras, Ch.** (2011). "Runge-Kutta pairs of order 5(4) satisfying only the 
   first column simplifying assumption." *Computers & Mathematics with Applications*,
   62, 770-775. DOI: [10.1016/j.camwa.2011.06.002](https://doi.org/10.1016/j.camwa.2011.06.002)

3. **Butcher, J.C.** (2016). *Numerical Methods for Ordinary Differential Equations*. 
   Wiley. Chapter 3.

---

## Next Steps

- [Adaptive Stepping](adaptive-stepping.md) - Step size control
- [Shooting Method](../optimization/shooting-method.md) - Where ODE solving is used
