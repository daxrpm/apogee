# Frontend Implementation Plan - 3D Launch Simulator

## Goal Description
Create a "Wow" factor 3D visualization of the rocket launch and orbit.
- **Launch Site**: Ecuador (Eastward launch).
- **Tech Stack**: React, Vite, Three.js (`@react-three/fiber`), `globe.gl` (via `react-globe.gl`).
- **Key Features**:
    - Seamless transition from Sea Level (Launch) to Orbit.
    - Detailed "3D Ecuador" terrain.
    - Interactive Sun vector.
    - Accurate orbital path visualization.

## User Review Required
> [!IMPORTANT]
> **Data Strategy**: We will use a **Static Asset Pipeline**.
> - **Action Required**: You will need to download/generate 2 key image files (Texture & Heightmap) for Ecuador. I cannot download them directly from restricted portals (like Earth Engine) on your behalf, but I have provided a guide below.

## Proposed Changes

### New Package: `packages/frontend`
Initialize a new Vite + React + TypeScript application.

#### Dependencies
- `three`: Core 3D engine.
- `@react-three/fiber`: React reconciler for Three.js.
- `@react-three/drei`: Helpers (OrbitControls, Stars, etc.).
- `react-globe.gl`: React wrapper for Globe.gl.
- `framer-motion`: For UI overlays/animations.
- `axios` / `tanstack-query`: For API data fetching.
- `jotai` or `zustand`: State management (Physics state, Sun position, Camera mode).

### Data Strategy & 3D Terrain

#### 1. The Strategy
We use a **Displacement Map** on a curved plane segment.
- **`ecuador_color.jpg`**: High-res satellite imagery.
- **`ecuador_height.jpg`**: Grayscale heightmap (SRTM data).

#### 2. Acquisition Guide (How to get the files)
Since automated download requires authentication (Earth Engine/USGS), the most reliable way is manual download or using a dedicated tool.

**Option A: Manual Download (Recommended for Quality)**
1.  Go to [Tangram Heightmapper](https://tangrams.github.io/heightmapper/).
    -   Zoom into Ecuador.
    -   Uncheck "Map Lines/Labels".
    -   Click "Export" -> Save as `ecuador_height.jpg`.
2.  Go to [Sentinel-2 Cloudless](https://s2maps.eu) or similar.
    -   Zoom to same area.
    -   Take a screenshot or export: `ecuador_color.jpg`.

**Option B: Automation (Future)**
We can write a Python script using `elevation` library, but it requires system-level dependencies (GDAL) which are tricky on Windows.

### Component Architecture

#### 1. `SceneContainer`
The main canvas entry point. Handles the "World" and "UI" separation.

#### 2. `EarthSystem` (The Core)
Wraps `react-globe.gl`.
- **Props**: `sunPosition`, `rocketPosition`, `trajectoryData`.
- **Children**:
    - `Globe`: The main sphere.
    - `EcuadorPatch`: A custom `mesh` located at `lat: 0, lon: -78.5`.
        - Geometry: Curved Plane.
        - Material: `MeshStandardMaterial` with displacement.
    - `Rocket`: GLTF model.
    - `TrajectoryLine`: Dynamic line renderer.

#### 3. `ControlPanel`
Overlay UI to control launch parameters and visualization settings.

## Verification Plan
1. **Setup**: Initialize frontend package.
2. **Assets**: Place placeholder images in `public/assets` (I will create dummies initially).
3. **Visual Check**: Verify terrain extrusion works in Three.js.
4. **Integration**: Connect to `apogee-api` for flight data.
