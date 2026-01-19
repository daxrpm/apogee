# Frontend Specification - Apogee 3D Launch Simulator

## Overview

Interactive 3D visualization of a Falcon 9 rocket launch from Ecuador to LEO orbit, with real-time telemetry and orbital mechanics visualization.

---

## Navigation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Ecuador    │────▶│   Quito     │────▶│ Pedernales  │────▶│   Beach     │────▶│   Launch    │
│  (Country)  │     │   (City)    │     │   (Coast)   │     │   (Site)    │     │   (Active)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
     10s max           10s max            10s max             Form Input          Trajectory
   or click          or click           or click            + Launch Btn        Animation
```

### Transition Behavior
- **Animation**: Smooth camera fly-through with fade transitions
- **Timer**: Auto-advance after 10 seconds if no interaction
- **Skip**: Click anywhere or "Next" button to advance immediately
- **Labels**: None (clean cinematic experience)

---

## Scene 1-4: Geographic Navigation

### Scene 1: Ecuador Overview
- 3D country outline or satellite texture
- Camera: High altitude, looking down

### Scene 2: Quito
- Andean mountain backdrop
- Camera: City level, dramatic angles

### Scene 3: Pedernales
- Coastal region, transition to ocean
- Camera: Approaching coastline

### Scene 4: Beach Launch Site (BeachScene.tsx)
- Current implementation with ocean, beach, mountains, palms
- **Launch pad**: Use existing `falcon_9__launching_pad.glb`
- **Rocket**: Replace current with `falcon_9_-_spacex.glb` mounted on pad

---

## Scene 5: Launch Control Panel

Located in BeachScene, replaces current control panel.

### Required Parameters
| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `h_target_km` | number | 160-400 | 200 | Target altitude [km] |
| `payload_kg` | number | 0-10000 | 5000 | Payload mass [kg] |

### Advanced Options (Collapsible)
| Field | Type | Description |
|-------|------|-------------|
| `theta0_deg` | number | Initial pitch-over angle [deg] |
| `t_coast_s` | number | Coast phase duration [s] |
| `t_burn2_s` | number | Stage 2 burn time [s] |

### UI Elements
- **Start Simulation Button**: Triggers `POST /launch/simulate`
- **Loading State**: "CALCULATING TRAJECTORY..." with spinner
- **Error Display**: Subtle toast with backend error message

---

## Scene 6: Launch Animation

### API Call Flow
```
User clicks "Start Simulation"
          │
          ▼
┌─────────────────────────────────────┐
│  POST /launch/simulate              │  ~20 seconds
│  {h_target_km, payload_kg, ...}     │
│  include_trajectory: true           │
└─────────────────────────────────────┘
          │
          │ Response received
          ▼
┌─────────────────────────────────────┐
│  POST /orbit/trajectory             │  ~100ms (parallel)
│  {r_m, nu_initial_rad, sun_x/y/z}   │
└─────────────────────────────────────┘
          │
          ▼
    Begin animation using launch trajectory
    Cache orbit trajectory for later
```

### Trajectory Data Mapping

From API response `trajectory`:
```typescript
interface TrajectoryData {
  t_s: number[];        // Time [s] - animation timeline
  h_m: number[];        // Altitude [m] - for sky color
  v_mps: number[];      // Velocity [m/s] - telemetry
  gamma_rad: number[];  // Flight-path angle [rad] - rocket rotation
  m_kg: number[];       // Mass [kg] - telemetry
  q_pa: number[];       // Dynamic pressure [Pa] - telemetry (MaxQ)
  mach: number[];       // Mach number - telemetry
  pos_m: {
    x: number[];        // Position X [m] - 3D position
    y: number[];        // Position Y [m] - 3D position (EAST direction)
    z: number[];        // Position Z [m] - always 0 (planar)
  };
}
```

### Coordinate Transform (API → Three.js)
```
API Coordinates (Planar Polar):
- X axis: Initial position (radial from Earth center)
- Y axis: Downrange (EAST, toward mountains)
- Z axis: 0 (equatorial plane)

Three.js Scene (BeachScene):
- X axis: EAST (positive = mountains, rocket flight direction)
- Y axis: UP (altitude)
- Z axis: NORTH/SOUTH

Transform:
  three_x = api_y (downrange becomes east)
  three_y = api_x - R_EARTH (geocentric radius becomes altitude)
  three_z = 0
```

### Rocket Model Hierarchy

From `falcon_9_-_spacex.glb` analysis:

```
Falcon9Root
├── Stage1Group
│   ├── First Stage_F9 Octaweb Black_0
│   ├── First Stage_F9_First_Stage_0
│   ├── Octaweb_F9 Octaweb Black_0
│   ├── Merlin 1D Engine Center_*
│   ├── Merlin 1D Engine Outer_*
│   ├── Engine Cloth_Engine Cloth Black_0
│   ├── Landing Leg*_Landing Leg*_0 (×4)
│   └── Grid Fin*_F9 Grid Fin_0 (×4)
│
├── InterstageGroup
│   ├── Interstage_F9 Black_0
│   ├── Interstage Engine holder_*
│   └── Second Stage Detacher Interstage_*
│
├── Stage2Group
│   ├── Second_Stage_*
│   ├── Merlin 1D Engine Center.001_*
│   └── Engine Holder Detail*
│
└── FairingGroup
    ├── Fairing 1_F9 Fairing_0
    ├── Fairing 1 Detail_*
    ├── Fairing 2_F9 Fairing_0
    └── Fairing 2 Detail_*
```

### Flight Phases & Events

| Phase | Trigger | Visual Event |
|-------|---------|--------------|
| **Liftoff** | t=0 | Engine ignition, particles start |
| **Vertical Ascent** | h < 2km | Rocket rises straight up |
| **Pitch-over** | h ≈ 2km | Rocket tilts using `gamma_rad` |
| **MaxQ** | max(q_pa) | Telemetry highlight |
| **MECO** | Stage 1 burnout | Engine shutdown effect |
| **Stage Sep** | ~144s (from trajectory) | Interstage detaches, Stage1 falls away |
| **SES-1** | Post separation | Stage 2 engine ignites |
| **SECO** | End of trajectory | Engine shutdown |
| **Orbit** | h_final | Transition to globe view |

### Camera Behavior

1. **Liftoff (0-30s)**
   - Fixed ground camera, tracks rocket ascending
   - Gradual zoom out as altitude increases

2. **Gravity Turn (30-100s)**
   - Follow camera, positioned behind/side of rocket
   - Shows pitch angle clearly (γ from horizontal)
   - User can rotate with OrbitControls (optional)

3. **Stage Separation (~144s)**
   - Dramatic camera switch: wide shot showing both stages
   - Brief slow-motion effect (optional)

4. **Stage 2 Burn (144-500s)**
   - Lateral view to show near-horizontal flight
   - Increasing distance as we approach space

5. **Transition to Orbit (h > h_target - 10km)**
   - Fade to black, then fade into globe.gl view

### Sky Color Gradient (Altitude-Based)

```typescript
function getSkyColor(altitude_m: number): Color {
  const h = altitude_m / 1000; // km
  
  if (h < 10) {
    // Sea level to 10km: Light blue
    return lerp('#87CEEB', '#4A90D9', h / 10);
  } else if (h < 40) {
    // 10-40km: Blue to dark blue
    return lerp('#4A90D9', '#1a1a4e', (h - 10) / 30);
  } else if (h < 100) {
    // 40-100km: Dark blue to black (Karman line)
    return lerp('#1a1a4e', '#000011', (h - 40) / 60);
  } else {
    // Space: Pure black with stars
    return '#000000';
  }
}
```

### Propulsion Effects (Particles)

- **Stage 1 (9 engines)**: Large orange/yellow flame cone
- **Stage 2 (1 engine)**: Smaller blue-white exhaust (vacuum nozzle)
- **Shutdown**: Flame fade-out over 0.5s

---

## Scene 7: Telemetry Overlay

SpaceX-style HUD overlay during launch:

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──────────┐                                      ┌──────────┐   │
│  │  SPEED   │                                      │ G-FORCE  │   │
│  │  1553    │                                      │   2.0    │   │
│  │  KM/H    │                                      │    G     │   │
│  └──────────┘                                      └──────────┘   │
│                                                                    │
│  ┌──────────┐                                                      │
│  │ ALTITUDE │                                                      │
│  │  10.8    │                                                      │
│  │   KM     │                                                      │
│  └──────────┘                                                      │
│                                                                    │
│                                                                    │
│          STARTUP    LIFTOFF    MAX Q    STAGE SEP    FAIRING      │
│             ●──────────●────────●──────────○───────────○          │
│                              T+00:01:07                            │
│                               NROL-105                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Telemetry Values
| Display | Source | Formula |
|---------|--------|---------|
| Speed | `v_mps` | `v_mps * 3.6` → km/h |
| Altitude | `h_m` | `h_m / 1000` → km |
| G-Force | `v_mps` derivative | `dv/dt / 9.81` → G |
| Mach | `mach` | Direct |
| Mass | `m_kg` | `m_kg / 1000` → tonnes |

### Timeline Milestones
- STARTUP: t = -3s (pre-launch)
- LIFTOFF: t = 0
- MAX Q: t where q_pa is maximum
- STAGE SEP: t where mass drops sharply (~144s)
- FAIRING: Not simulated (would be after stage sep)
- SECO: End of trajectory

---

## Scene 8: Orbital Phase (globe.gl)

### Transition
- Fade from Three.js launch scene
- Fade into globe.gl satellite view
- Globe centered on Ecuador, zoomed to show orbit

### Globe Configuration
Based on: https://github.com/vasturiano/globe.gl/blob/master/example/satellites/index.html

```typescript
const globe = Globe()
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png');
```

### Satellite Object
```typescript
interface Satellite {
  lat: number;        // Derived from orbit position
  lng: number;        // Derived from orbit position  
  alt: number;        // h_target_km / EARTH_RADIUS_KM
  yaw: number;        // From /orbit/yaw API
  solarPanelAngle: number;  // Derived from yaw
}
```

### Orbit Trajectory Line
- Draw complete circular equatorial orbit (i=0)
- Highlight current satellite position
- Line color: subtle glow (white or blue)

### Sun Vector Interaction
1. **Draggable Sun**: User can drag sun position in 3D
2. **Real-time API Call**: On drag, call `POST /orbit/yaw`:
   ```json
   {
     "r_m": 6570000,
     "nu_initial_rad": 0.242,
     "sun_x": 0.7,
     "sun_y": 0.7,
     "sun_z": 0.0,
     "t_s": <current_animation_time>
   }
   ```
3. **Response** (<5ms):
   ```json
   {
     "yaw_deg": 45.0,
     "beta_deg": 0.0,
     "satellite_position": [x, y, z]
   }
   ```
4. **Update**: Rotate satellite model by `yaw_deg`

### Solar Panel Animation
- Panels rotate about satellite body Y-axis
- Rotation angle = `yaw_deg` from API
- Continuous loop: satellite orbits, panels track sun

---

## Replay Mode

### Trigger
- "Replay" button appears after launch completes
- Stores last successful trajectory data

### Behavior
- Resets to BeachScene with rocket on pad
- Replays same trajectory animation
- Skip button available
- No new API calls needed

---

## Error Handling

### API Errors
```typescript
interface APIError {
  status: number;
  detail: string;
}
```

Display: Subtle toast notification
```
┌─────────────────────────────────────────┐
│ ⚠️ Simulation failed: {detail}          │
│                                    [×]  │
└─────────────────────────────────────────┘
```

### Network Errors
- Show "Backend unavailable" message
- Retry button

---

## Technical Stack

### Dependencies (package.json)
```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "react-globe.gl": "^2.27.0",
    "framer-motion": "^10.16.0",
    "zustand": "^4.4.0"
  }
}
```

### State Management (Zustand)

```typescript
interface SimulationStore {
  // Navigation
  currentScene: 'ecuador' | 'quito' | 'pedernales' | 'beach' | 'launch' | 'orbit';
  
  // Launch params
  hTargetKm: number;
  payloadKg: number;
  
  // API state
  isLoading: boolean;
  error: string | null;
  launchData: LaunchResponse | null;
  orbitData: OrbitTrajectoryResponse | null;
  
  // Animation state
  animationTime: number;
  isPlaying: boolean;
  
  // Sun vector (for orbit phase)
  sunVector: [number, number, number];
  
  // Actions
  setScene: (scene) => void;
  startSimulation: () => Promise<void>;
  updateSunVector: (vec) => void;
  replay: () => void;
}
```

---

## File Structure

```
frontend/src/
├── components/
│   ├── Navigation/
│   │   ├── EcuadorScene.tsx
│   │   ├── QuitoScene.tsx
│   │   ├── PedernalesScene.tsx
│   │   └── SceneTransition.tsx
│   │
│   ├── BeachScene/
│   │   ├── BeachScene.tsx       # Main scene (existing)
│   │   ├── LaunchPad.tsx        # Pad + Rocket (modify)
│   │   ├── Falcon9Rocket.tsx    # NEW: Animatable rocket
│   │   ├── ControlPanel.tsx     # NEW: Launch form
│   │   └── ...
│   │
│   ├── Launch/
│   │   ├── LaunchAnimation.tsx  # NEW: Trajectory player
│   │   ├── RocketCamera.tsx     # NEW: Camera controller
│   │   ├── PropulsionFX.tsx     # NEW: Particle effects
│   │   ├── SkyGradient.tsx      # NEW: Altitude-based sky
│   │   └── Telemetry.tsx        # NEW: SpaceX-style HUD
│   │
│   └── Orbit/
│       ├── OrbitGlobe.tsx       # NEW: globe.gl wrapper
│       ├── SatelliteModel.tsx   # NEW: 3D satellite
│       ├── SunControl.tsx       # NEW: Draggable sun
│       └── OrbitPath.tsx        # NEW: Orbit line
│
├── hooks/
│   ├── useLaunch.ts             # Existing
│   ├── useOrbit.ts              # NEW: Orbit API hook
│   └── useAnimation.ts          # NEW: Timeline controller
│
├── stores/
│   └── simulationStore.ts       # NEW: Zustand store
│
├── services/
│   └── api.ts                   # Existing (add orbit endpoints)
│
└── utils/
    ├── coordinateTransform.ts   # NEW: API → Three.js coords
    ├── interpolation.ts         # NEW: Smooth trajectory
    └── colors.ts                # NEW: Sky gradient
```

---

## Implementation Order

1. **Phase 1**: Falcon 9 rocket component with stage separation
2. **Phase 2**: Control panel with API integration
3. **Phase 3**: Launch animation with camera tracking
4. **Phase 4**: Telemetry overlay
5. **Phase 5**: Sky gradient and propulsion effects
6. **Phase 6**: Globe.gl orbital view
7. **Phase 7**: Sun interaction and yaw steering
8. **Phase 8**: Navigation scenes (Ecuador → Beach)
9. **Phase 9**: Replay mode and polish

---

## Notes

- All trajectory interpolation uses cubic spline for smoothness
- Stage separation timing derived from mass discontinuity in `m_kg` array
- Earth radius constant: `R_EARTH = 6371000` m
- Orbit is always equatorial (i=0) and circular (e≈0)
- Sun vector default: `[1, 0, 0]` (vernal equinox direction)
