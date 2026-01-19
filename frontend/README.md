# Apogee Frontend 🚀

A high-fidelity 3D visualization platform for rocket launch simulations, built with React, Three.js, and React Three Fiber.

## Overview

**Apogee Frontend** provides an immersive, realistic 3D environment to visualize rocket launches from Pedernales, Ecuador. It features a geographically accurate beach scene with dynamic ocean water, atmospheric sky simulation, and integration with the `apogee-launch` backend for trajectory calculations.

### Key Features

- **Realistic 3D Environment**: High-quality GLB models for palm trees, mountains, and the Falcon 9 launch pad
- **Dynamic Atmosphere**: Rayleigh scattering sky simulation with volumetric clouds
- **Interactive Ocean**: Shader-based water with reflections and wave dynamics
- **Physics Integration**: Ready-to-connect API hooks for trajectory visualization
- **Responsive Controls**: Orbit camera controls with real-time parameter adjustments

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite |
| Language | TypeScript |
| 3D Engine | Three.js via React Three Fiber |
| State | React Hooks (`useLaunch`) |
| Styling | CSS Modules |


## Setup & Installation

### Prerequisites

- Node.js 24+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/daxrpm/apogee.git
cd apogee/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`.

## Backend Integration

The frontend is designed to integrate with the **apogee-launch** Python backend.

### API Contract

The frontend calls `POST /launch/simulate` with:

```typescript
interface LaunchParams {
  h_target_km: number;      // Target altitude (160-400 km)
  payload_kg: number;       // Payload mass (0-10000 kg)
  include_trajectory?: boolean;
}
```

And expects:

```typescript
interface LaunchResponse {
  schema_version: number;
  inputs: Record<string, number>;
  optimal_numerics: {
    theta0_rad: number;     // Optimal pitch-over angle
    t_coast_s: number;      // Coast phase duration
    t_burn2_s: number;      // Stage 2 burn time
    alpha2_rad: number;     // Stage 2 steering angle
  };
  summary: {
    ecc: number;            // Orbital eccentricity
    h_err_m: number;        // Altitude error
    v_err_mps: number;      // Velocity error
    gamma_deg: number;      // Flight-path angle
  };
  trajectory?: {
    t_s: number[];
    h_m: number[];
    v_mps: number[];
    gamma_rad: number[];
    pos_m: { x: number[]; y: number[]; z: number[] };
  };
}
```

### Starting the Backend

```bash
cd packages/apogee-launch
uv run uvicorn apogee_launch.api:app --reload
```

## Future Roadmap

1. **Trajectory Visualization**: Render 3D flight paths using trajectory data
2. **Real-time Animation**: Animate rocket ascent based on simulation output
3. **Stage Separation**: Visualize booster separation and landing
4. **Orbital View**: Switch to Earth orbit perspective after launch

## Code Quality

This project follows best practices:

- **TypeScript**: Full type safety across components
- **Modular Components**: Each 3D element is isolated and reusable
- **Performance**: GLB preloading, disabled antialiasing, frustum culling
- **Clean Imports**: Organized import groups (React, Three, Hooks, Components)
- **JSDoc**: Comprehensive documentation on public APIs
