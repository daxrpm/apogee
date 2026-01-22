---
title: Numerical Stability
description: Handling singularities and edge cases in rocket simulation
---

# Numerical Stability

This section covers techniques for handling numerical challenges in rocket simulation.

## Topics

- [Singularity Guards](singularity-guards.md) - Handling $1/v$ and $1/r$ problems

## Overview

The equations of motion contain terms that can become singular:

$$
\frac{d\gamma}{dt} = \frac{T}{mv}\sin\alpha + \left(\frac{v}{r} - \frac{\mu}{r^2 v}\right)\cos\gamma
$$

Both $1/v$ and $1/r$ can cause numerical issues.

## Key Techniques

1. **Regularization**: Replace singular terms with smooth approximations
2. **Guarding**: Clamp values to safe ranges
3. **Filtering**: Remove non-physical trajectory points
