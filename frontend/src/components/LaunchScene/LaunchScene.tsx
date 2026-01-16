import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Stats } from '@react-three/drei';
import { EcuadorTerrain } from './EcuadorTerrain';

interface LaunchSceneProps {
  /** Show performance stats */
  showStats?: boolean;
  /** Show grid helper */
  showGrid?: boolean;
}

/**
 * LaunchScene - The main 3D scene container for the launch visualization
 * 
 * Contains the Ecuador terrain, lighting, camera controls, and helpers.
 */
export function LaunchScene({ showStats = true, showGrid = true }: LaunchSceneProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      <Canvas
        shadows
        camera={{
          position: [15, 12, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
        }}
      >
        {/* Performance stats */}
        {showStats && <Stats />}

        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight
          position={[-5, 10, -5]}
          intensity={0.5}
        />

        {/* Environment for reflections */}
        <Environment preset="night" />

        {/* Camera controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2.1}
        />

        {/* Grid helper */}
        {showGrid && (
          <Grid
            infiniteGrid
            cellSize={1}
            sectionSize={5}
            fadeDistance={50}
            cellColor="#1a1a2e"
            sectionColor="#2a2a4e"
          />
        )}

        {/* Ecuador 3D Terrain */}
        <Suspense fallback={null}>
          <EcuadorTerrain
            width={10.3}    // 842px ratio
            height={12}     // 980px ratio
            segments={256}
            maxElevation={1}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '12px 16px',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>🚀 Ecuador 3D Terrain</h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Drag to rotate • Scroll to zoom • Right-click to pan
        </p>
      </div>
    </div>
  );
}
