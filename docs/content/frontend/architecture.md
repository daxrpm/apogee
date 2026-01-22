---
title: Frontend Architecture
description: React Three Fiber application structure
---

# Frontend Architecture

## Directory Structure

```
frontend/src/
├── App.tsx              # Main application
├── main.tsx             # Entry point
├── index.css            # Global styles
│
├── features/            # Feature modules
│   ├── beach/           # Launch site scene
│   │   ├── BeachScene.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── Falcon9Rocket.tsx
│   │   ├── LaunchPad.tsx
│   │   ├── Sky.tsx
│   │   ├── Vegetation.tsx
│   │   └── Water.tsx
│   │
│   ├── launch/          # Trajectory animation
│   │   ├── CameraSystem.tsx
│   │   ├── LaunchAnimation.tsx
│   │   ├── PropulsionFX.tsx
│   │   ├── RocketCamera.tsx
│   │   └── Telemetry.tsx
│   │
│   └── navigation/      # Intro scenes
│       ├── NavigationTerrainScene.tsx
│       └── SceneTransition.tsx
│
├── services/            # API integration
│   └── api.ts
│
├── stores/              # State management
│   └── simulationStore.ts
│
├── types/               # TypeScript types
│   └── index.ts
│
└── utils/               # Utilities
    └── coordinateTransform.ts
```

## Data Flow

```
User Input (ControlPanel)
    │
    ▼
Zustand Store (simulationStore)
    │ startSimulation()
    ▼
API Service (api.ts)
    │ POST /launch/simulate
    ▼
Backend (apogee-api)
    │
    ▼
LaunchResponse { trajectory }
    │
    ▼
LaunchAnimation.tsx
    │ interpolatePosition(t)
    ▼
Falcon9Rocket 3D Position
```

## Key Components

### `App.tsx`

Main navigation router:

- Ecuador → Quito → Pedernales (intro terrain scenes)
- Beach → Launch → Orbit (main scenes)

### `simulationStore.ts`

Zustand global state:

```typescript
interface SimulationState {
  currentScene: SceneType;
  hTargetKm: number;
  payloadKg: number;
  launchData: LaunchResponse | null;
  animationTime: number;
  isPlaying: boolean;
}
```

### `LaunchAnimation.tsx`

Interpolates rocket position from trajectory data:

```typescript
const pos = interpolatePosition(animationTime, trajectory);
const rot = interpolateRotation(animationTime, trajectory);
rocketRef.current.position.copy(pos);
rocketRef.current.rotation.copy(rot);
```

### `CameraSystem.tsx`

Five camera modes:
- Chase
- Side
- Ground
- Wide
- Onboard
