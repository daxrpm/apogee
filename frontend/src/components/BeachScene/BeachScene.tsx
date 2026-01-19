import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Loader } from '@react-three/drei';
import { Vector3 } from 'three';

// Beach scene components
import { OceanWater, BeachSand, RealisticMountain } from './Water';
import { DaytimeSky, DaytimeLight, DaytimeClouds } from './Sky';
import { LaunchPad } from './LaunchPad';
import { PalmForest, Seagulls } from './Vegetation';

interface BeachSceneProps {
  showStats?: boolean;
  showModels?: boolean;
}

import { useLaunch } from '../../hooks/useLaunch';

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
  // Launch pad controls
  const [padScale, setPadScale] = useState(1);
  const [padPosition, setPadPosition] = useState<[number, number, number]>([0, 2, 0]);
  
  // Backend Launch Integration
  const { launch, loading, error, data: launchData } = useLaunch();

  const handleLaunch = async () => {
    console.log("Initiating launch sequence...");
    const result = await launch({
      h_target_km: 200,
      payload_kg: 5000,
      include_trajectory: true
    });
    
    if (result) {
      console.log("Launch Data Received:", result);
      // Future: Trigger animation here
    }
  };
  
  // Sun position for daytime lighting (high in sky for rocket tracking)
  const sunDirection = new Vector3(50, 120, -30);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <Canvas
        shadows
        camera={{
          position: [0, 60, 250],  // Further back and higher
          fov: 55,
          near: 1,
          far: 20000,  // Deep visibility for distant mountains and horizon
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

        {/* Camera Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={20}
          maxDistance={800}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 10, 0]}
        />

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

        {/* Launch Pad in center of beach */}
        <Suspense fallback={null}>
          {showModels && (
            <LaunchPad 
              position={padPosition}
              scale={padScale}
              rotation={[0, Math.PI/2, 0]}
            />
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

      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '16px 20px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          minWidth: '200px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#87ceeb' }}>
          🚀 Pedernales Launch Site
        </h3>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
            Rocket Scale: {padScale.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={padScale}
            onChange={(e) => setPadScale(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#87ceeb' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
            Height: {padPosition[1].toFixed(0)}m
          </label>
          <input
            type="range"
            min="-5"
            max="15"
            step="1"
            value={padPosition[1]}
            onChange={(e) => setPadPosition([padPosition[0], parseFloat(e.target.value), padPosition[2]])}
            style={{ width: '100%', accentColor: '#87ceeb' }}
          />
        </div>

        <p style={{ margin: '12px 0 0 0', fontSize: '11px', opacity: 0.5 }}>
          🌴 West: Ocean • 🏔️ East: Mountains
        </p>
      </div>

      {/* Info Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '12px 16px',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <p style={{ margin: '0 0 8px 0', opacity: 0.9 }}>
          🇪🇨 Pedernales, Ecuador • Ocean West • Mountains East
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => handleLaunch()}
            disabled={loading}
            style={{
              background: loading ? '#666' : '#e04006',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '6px 12px',
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            {loading ? 'CALCULATING...' : 'LAUNCH SIMULATION'}
          </button>
          
          {error && <span style={{ color: '#ff6b6b' }}>Error: {error}</span>}
          {launchData && (
            <span style={{ color: '#51cf66' }}>
              ✓ Orbit: {launchData.summary.h_err_m.toFixed(1)}m error
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeachScene;
