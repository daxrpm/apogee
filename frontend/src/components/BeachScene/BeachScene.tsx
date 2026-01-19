import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Loader } from '@react-three/drei';
import { Vector3 } from 'three';

// Components
import { OceanWater, BeachSand, RealisticMountain } from './Water';
import { DaytimeSky, DaytimeLight, DaytimeClouds } from './Sky';
import { LaunchPad } from './LaunchPad';
import { Falcon9Rocket, type Falcon9RocketRef } from './Falcon9Rocket';
import { PalmForest, Seagulls } from './Vegetation';
import { ControlPanel } from './ControlPanel';
import { LaunchAnimation } from '../Launch/LaunchAnimation';
import { RocketCamera } from '../Launch/RocketCamera';
import { Telemetry } from '../Launch/Telemetry';

// Store
import { useSimulationStore } from '../../stores/simulationStore';

interface BeachSceneProps {
  showStats?: boolean;
  showModels?: boolean;
}

/**
 * BeachScene - Realistic 3D beach environment for rocket launch
 * 
 * Scene layout (EAST-WEST orientation):
 * - WEST (negative X): Ocean water
 * - CENTER: Sandy beach with launch pad
 * - EAST (positive X): Mountains as backdrop
 * 
 * Camera looks from south, with west to the left and east to the right
 */
export function BeachScene({ showStats = false, showModels = true }: BeachSceneProps) {
  const rocketRef = useRef<Falcon9RocketRef>(null);
  const { currentScene, isPlaying } = useSimulationStore();
  
  // Fixed pad position and scale
  const padPosition: [number, number, number] = [0, 2, 0];
  const padScale = 1;
  const rocketScale = padScale * 0.005;
  
  // Sun position for daytime lighting
  const sunDirection = new Vector3(50, 120, -30);
  
  // Show control panel only before launch
  const showControlPanel = currentScene === 'beach';
  const isLaunching = currentScene === 'launch' && isPlaying;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <Canvas
        shadows
        camera={{
          position: [0, 60, 250],  // Further back and higher
          fov: 55,
          near: 1,
          far: 150000,  // Extended for high altitude trajectories
        }}
        gl={{
          antialias: false,  // Disable for performance
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        {showStats && <Stats />}

        {/* Daytime Blue Sky - extended for rocket tracking */}
        <DaytimeSky sunPosition={sunDirection} />
        <DaytimeClouds count={10} />

        {/* Lighting */}
        <DaytimeLight 
          position={[sunDirection.x, sunDirection.y, sunDirection.z]} 
          intensity={2.0}
        />

        {/* Camera Controls - follows rocket during launch */}
        <RocketCamera />

        {/* ====== OCEAN (WEST side, negative X) ====== */}
        {/* Massive ocean plane extending to horizon on the West */}
        <OceanWater 
          position={[-600, -2, 0]} 
          sunDirection={sunDirection}
        />

        {/* ====== SANDY BEACH (CENTER) ====== */}
        {/* Narrower East-West, Longer North-South */}
        <BeachSand 
          position={[0, -1.5, 0]} 
          width={200}    // Narrower: 200m
          depth={6000}   // Longer: 2km North-South
        />

        {/* Launch Pad + Falcon 9 Rocket */}
        <Suspense fallback={null}>
          {showModels && (
            <group>
              {/* Launch pad structure */}
              <LaunchPad 
                position={padPosition}
                scale={padScale}
                rotation={[0, Math.PI/2, 0]}
              />
              
              {/* Falcon 9 Rocket with animation wrapper */}
              {isLaunching ? (
                // During launch: animate rocket following trajectory
                <LaunchAnimation timeScale={3}>
                  <Falcon9Rocket
                    ref={rocketRef}
                    scale={rocketScale}
                  />
                </LaunchAnimation>
              ) : (
                // Pre-launch: static rocket on pad
                <Falcon9Rocket
                  ref={rocketRef}
                  position={[padPosition[0] - 0.5, padPosition[1], padPosition[2]]}
                  scale={rocketScale}
                  rotation={[0, 0, 0]}  // VERTICAL - nose UP
                />
              )}
            </group>
          )}
        </Suspense>

        {/* ====== VEGETATION (EAST of beach) ====== */}
        {/* Green ground transition, slightly lowered to match sand */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[300, -1.0, 0]} 
          receiveShadow
        >
          <planeGeometry args={[400, 5000]} />
          <meshStandardMaterial color="#2d5a2d" roughness={0.95} />
        </mesh>

        {/* Palm forest density */}
        <Suspense fallback={null}>
          <group position={[0, -1.0, 0]}>
            <PalmForest 
              count={100}
              offsetX={150}
              offsetZ={0}
              areaWidth={150}
              areaDepth={1800}
              density="normal"
            />
          </group>
        </Suspense>

        {/* ====== MOUNTAIN (EAST side, positive X) ====== */}
        {/* Distant massive backdrop, moved closer to meet vegetation (x=450) */}
        <Suspense fallback={null}>
          <RealisticMountain 
            position={[150, 40, 0]}
            scale={20}
            rotation={-Math.PI / 2 - 0.5}
          />
        </Suspense>

        {/* ====== WILDLIFE ====== */}
        <Seagulls count={15} />

        {/* Shadow receiver plane (spanning entire active area) */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -0.1, 0]} 
          receiveShadow
        >
          <planeGeometry args={[2000, 2000]} />
          <shadowMaterial opacity={0.15} />
        </mesh>
      </Canvas>

      {/* Loading indicator */}
      <Loader />

      {/* Launch Control Panel */}
      {showControlPanel && <ControlPanel />}

      {/* Telemetry HUD during launch */}
      <Telemetry />
    </div>
  );
}

export default BeachScene;
