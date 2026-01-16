import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Stats } from '@react-three/drei';
import { EcuadorTerrain, TEXTURE_OPTIONS } from './EcuadorTerrain';
import type { TextureOption } from './EcuadorTerrain';

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
  const [selectedTexture, setSelectedTexture] = useState<TextureOption>('google');
  const [maxElevation, setMaxElevation] = useState(0.8);

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
            width={12}
            height={7.22}
            segments={256}
            maxElevation={maxElevation}
            textureId={selectedTexture}
          />
        </Suspense>
      </Canvas>

      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          background: 'rgba(0, 0, 0, 0.75)',
          padding: '16px 20px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          minWidth: '200px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.7 }}>
          🛰️ Satellite Texture
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {TEXTURE_OPTIONS.map((option) => (
            <label
              key={option.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                background: selectedTexture === option.id 
                  ? 'rgba(99, 102, 241, 0.3)' 
                  : 'rgba(255, 255, 255, 0.05)',
                border: selectedTexture === option.id 
                  ? '1px solid rgba(99, 102, 241, 0.5)' 
                  : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="radio"
                name="texture"
                value={option.id}
                checked={selectedTexture === option.id}
                onChange={() => setSelectedTexture(option.id)}
                style={{ accentColor: '#6366f1' }}
              />
              {option.label}
            </label>
          ))}
        </div>

        {/* Elevation slider */}
        <h3 style={{ margin: '16px 0 8px 0', fontSize: '14px', opacity: 0.7 }}>
          ⛰️ Elevation: {maxElevation.toFixed(1)}
        </h3>
        <input
          type="range"
          min="0.2"
          max="2"
          step="0.1"
          value={maxElevation}
          onChange={(e) => setMaxElevation(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#6366f1',
          }}
        />
      </div>

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
