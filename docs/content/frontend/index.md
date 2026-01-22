---
title: Frontend
description: React Three Fiber 3D visualization (Work in Progress)
---

# Frontend

The Apogee frontend is a **React + Three.js** 3D visualization platform.

!!! warning "Work in Progress"
    The frontend is under active development. Some features are not yet implemented.

## Status

| Feature | Status | Description |
|---------|--------|-------------|
| Navigation Scenes | ✅ Complete | Ecuador → Quito → Pedernales intro |
| Beach Scene | ✅ Complete | Launch site with sky, water, vegetation |
| Launch Pad | ✅ Complete | Falcon 9 model and platform |
| Control Panel | ✅ Complete | Parameter sliders, launch button |
| Launch Animation | ✅ Complete | Trajectory playback from backend |
| Camera System | ✅ Complete | 5 camera modes |
| Propulsion FX | ✅ Complete | Engine flames, stage separation |
| Telemetry HUD | ✅ Complete | Flight data overlay |
| Orbit Visualization | 🔄 Planned | 3D orbital path |
| Satellite Attitude | 🔄 Planned | Yaw steering animation |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite 7 |
| Language | TypeScript 5.9 |
| 3D Engine | Three.js 0.182 |
| React Binding | React Three Fiber 9.5 |
| State | Zustand 5.0 |
| Helpers | @react-three/drei 10.7 |

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/

## Documentation

- [Architecture](architecture.md) - Code structure
- [Components](components.md) - Feature documentation
