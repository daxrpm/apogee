# Apogee Frontend 🚀

A high-fidelity 3D visualization platform for rocket launch simulations, built with React, Three.js, and React Three Fiber.

![Beach Scene](https://raw.githubusercontent.com/daxrpm/apogee/main/frontend/public/screenshots/beach-scene-preview.png)

## Overview 🌟

**Apogee Frontend** provides an immersive, realistic 3D environment to visualize rocket launches from Pedernales, Ecuador. It features a geographically accurate beach scene, dynamic ocean water, atmospheric sky simulation, and seamless integration with the `apogee-launch` backend for trajectory data.

### Key Features
- **Realistic 3D Environment**: High-quality 3D assets for vegetation, mountains, and launch infrastructure.
- **Dynamic Atmosphere**: Proper Rayleigh scattering, sun positioning, and volumetric clouds.
- **Interactive Ocean**: Shader-based water simulation with reflections and wave dynamics.
- **Physics Integration**: Ready-to-connect API hooks for visualized flight trajectories.
- **Responsive Controls**: Orbit controls, camera presets, and real-time parameter adjustments.

## Technology Stack 💻

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **3D Engine**: [Three.js](https://threejs.org/) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- **State Management**: React Hooks (custom `useLaunch` hook)
- **Styling**: Modular CSS + Three.js Materials

## Project Structure 📂

```
src/
├── components/
│   ├── BeachScene/       # Main 3D Environment
│   │   ├── BeachScene.tsx    # Scene composition & lighting
│   │   ├── Water.tsx         # Ocean & Beach procedural generation
│   │   ├── Sky.tsx           # Atmosphere & Clouds
│   │   ├── Vegetation.tsx    # Palm forests & Seagulls
│   │   └── LaunchPad.tsx     # Rocket & Pad models
│   └── LaunchScene/      # (Optional) Terrain map visualization
├── hooks/
│   └── useLaunch.ts      # API integration hook for backend
├── services/
│   └── api.ts            # Axios configuration & types
└── App.tsx               # Main entry with scene routing
```

## Setup & Installation 🛠️

1.  **Clone the repository**
    ```bash
    git clone https://github.com/daxrpm/apogee.git
    cd apogee/frontend
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm run dev
    ```

## Backend Integration 🔗

This frontend is designed to consume trajectory data from the `apogee-launch` Python backend.

### Status: Paused
The integration is fully implemented in `src/hooks/useLaunch.ts` but is currently paused to focus on visual fidelity.

### Future Roadmap
1.  **Real-time WebSocket Connection**: Stream telemetry data during launch.
2.  **Trajectory Visualization**: Draw flight paths using `Three.js` lines based on `(x, y, z)` tuples from the API.
3.  **Stage Separation**: Animate variable mass and stage decoupling events.

## Best Practices 🏆
- **Component Modularity**: Each 3D element (Sky, Water, Trees) is an isolated, reusable component.
- **Asset Preloading**: Heavy GLB models are preloaded to prevent pop-in.
- **Performance**: Shadows and poly-counts are optimized for browser execution.
