import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Loader } from '@react-three/drei';
import { Vector3 } from 'three';

// Components
import { OceanWater, BeachSand, RealisticMountain } from './Water';
import { DaytimeSky, DaytimeLight, DaytimeClouds, AscentSky, AscentLight, AscentClouds, SpaceStars } from './Sky';
import { LaunchPad } from './LaunchPad';
import { Falcon9Rocket, type Falcon9RocketRef } from './Falcon9Rocket';
import { PalmForest, Seagulls } from './Vegetation';
import { ControlPanel } from './ControlPanel';
import { LaunchAnimation } from '../Launch/LaunchAnimation';
import { RocketCamera } from '../Launch/RocketCamera';
import { Telemetry } from '../Launch/Telemetry';
import { LaunchCamera, CameraSelector, type CameraMode } from '../Launch/CameraSystem';

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
 * Features SpaceX-style multiple camera views during launch.
 */
export function BeachScene({ showStats = false, showModels = true }: BeachSceneProps) {
  const rocketRef = useRef<Falcon9RocketRef>(null);
  const { currentScene, isPlaying } = useSimulationStore();
  
  // Camera mode for launch visualization
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  
  // Fixed pad position and scale
  const padPosition: [number, number, number] = [0, 2, 0];
  const padScale = 1;
  const rocketScale = padScale * 0.005;
  
  // Sun position for daytime lighting
  const sunDirection = new Vector3(50, 120, -30);
  
  // Scene state
  const showControlPanel = currentScene === 'beach';
  const isLaunching = currentScene === 'launch' && isPlaying;
  const showCameraSelector = currentScene === 'launch';

  return (
    <div style={{ width: '100vw', height: '100vh', background: isLaunching ? '#000000' : '#87ceeb' }}>
      <Canvas
        shadows
        camera={{
          position: [0, 60, 250],
          fov: 55,
          near: 1,
          far: 150000,
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        {showStats && <Stats />}

        {/* Sky */}
        {isLaunching ? (
          <>
            <AscentSky sunPosition={sunDirection} />
            <AscentClouds count={10} />
            <SpaceStars />
          </>
        ) : (
          <>
            <DaytimeSky sunPosition={sunDirection} />
            <DaytimeClouds count={10} />
          </>
        )}

        {/* Lighting */}
        {isLaunching ? (
          <AscentLight
            position={[sunDirection.x, sunDirection.y, sunDirection.z]}
            intensity={2.0}
          />
        ) : (
          <DaytimeLight
            position={[sunDirection.x, sunDirection.y, sunDirection.z]}
            intensity={2.0}
          />
        )}

        {/* Camera Controls */}
        {isLaunching ? (
          // During launch: use multi-camera system
          <LaunchCamera mode={cameraMode} />
        ) : (
          // Pre-launch: standard orbit controls
          <RocketCamera />
        )}

        {/* ====== OCEAN (WEST side) ====== */}
        <OceanWater 
          position={[-600, -2, 0]} 
          sunDirection={sunDirection}
        />

        {/* ====== SANDY BEACH (CENTER) ====== */}
        <BeachSand 
          position={[0, -1.5, 0]} 
          width={200}
          depth={6000}
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
              
              {/* Falcon 9 Rocket */}
              {isLaunching ? (
                <LaunchAnimation timeScale={3}>
                  <Falcon9Rocket
                    ref={rocketRef}
                    scale={rocketScale}
                  />
                </LaunchAnimation>
              ) : (
                <Falcon9Rocket
                  ref={rocketRef}
                  position={[padPosition[0] - 0.5, padPosition[1], padPosition[2]]}
                  scale={rocketScale}
                  rotation={[0, 0, 0]}
                />
              )}
            </group>
          )}
        </Suspense>

        {/* ====== VEGETATION (EAST of beach) ====== */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[300, -1.0, 0]} 
          receiveShadow
        >
          <planeGeometry args={[400, 5000]} />
          <meshStandardMaterial color="#2d5a2d" roughness={0.95} />
        </mesh>

        {/* Palm forest */}
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

        {/* ====== MOUNTAIN (EAST side) ====== */}
        <Suspense fallback={null}>
          <RealisticMountain 
            position={[150, 40, 0]}
            scale={20}
            rotation={-Math.PI / 2 - 0.5}
          />
        </Suspense>

        {/* Wildlife */}
        <Seagulls count={15} />

        {/* Shadow receiver */}
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

      {/* Camera Selector (during launch only) */}
      {showCameraSelector && (
        <CameraSelector 
          currentMode={cameraMode} 
          onChange={setCameraMode} 
        />
      )}

      {/* Launch Control Panel */}
      {showControlPanel && <ControlPanel />}

      {/* Telemetry HUD during launch */}
      <Telemetry />
    </div>
  );
}

export default BeachScene;
