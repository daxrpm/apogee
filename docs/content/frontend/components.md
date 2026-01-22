---
title: Frontend Components
description: Key React Three Fiber components
---

# Frontend Components

## Beach Scene

### `BeachScene.tsx`

Main 3D scene containing all launch site elements.

### `Sky.tsx`

Rayleigh scattering atmosphere simulation with volumetric clouds.

### `Water.tsx`

Shader-based ocean with reflections and wave dynamics.

### `Falcon9Rocket.tsx`

GLB model of the Falcon 9 rocket with stage separation support.

### `LaunchPad.tsx`

Launch platform and support structure.

## Launch Animation

### `LaunchAnimation.tsx`

Controls rocket position/rotation during flight:

1. Reads trajectory from Zustand store
2. Interpolates position at current animation time
3. Updates 3D model transform
4. Handles stage separation visually

### `CameraSystem.tsx`

Multi-mode camera system:

| Mode | Description |
|------|-------------|
| Chase | Following behind rocket |
| Side | Lateral tracking shot |
| Ground | Looking up from pad |
| Wide | Cinematic overview |
| Onboard | Rocket POV |

### `PropulsionFX.tsx`

Engine flame particle effects:

- Stage 1: 9 orange flames
- Stage 2: 1 blue-white plume
- Automatic scaling with thrust

### `Telemetry.tsx`

HUD overlay showing:

- Altitude
- Velocity
- Flight-path angle
- Time
- Phase indicator

## Navigation

### `NavigationTerrainScene.tsx`

Satellite imagery terrain visualization for intro sequence.

### `SceneTransition.tsx`

Fade transitions between scenes with auto-advance timer.
