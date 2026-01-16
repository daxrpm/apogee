import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Stats } from '@react-three/drei';
import { TerrainMesh, REGIONS, TEXTURE_OPTIONS } from './EcuadorTerrain';
import type { RegionId, TextureOption } from './EcuadorTerrain';

interface LaunchSceneProps {
  showStats?: boolean;
  showGrid?: boolean;
}

/**
 * LaunchScene - The main 3D scene container for the launch visualization
 */
export function LaunchScene({ showStats = true, showGrid = true }: LaunchSceneProps) {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>('ecuador');
  const [selectedTexture, setSelectedTexture] = useState<TextureOption>('google');
  const [maxElevation, setMaxElevation] = useState(0.8);

  // Get the current region config
  const currentRegion = REGIONS.find(r => r.id === selectedRegion)!;

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
        {showStats && <Stats />}

        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-5, 10, -5]} intensity={0.5} />

        <Environment preset="night" />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2.1}
        />

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

        {/* 3D Terrain */}
        <Suspense fallback={null}>
          <TerrainMesh
            key={`${selectedRegion}-${selectedTexture}`}
            regionId={selectedRegion}
            textureId={selectedTexture}
            segments={256}
            maxElevation={maxElevation}
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
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '16px 20px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          minWidth: '220px',
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
        }}
      >
        {/* Region Selector */}
        <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Region
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                background: selectedRegion === region.id
                  ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                transition: 'all 0.2s ease',
              }}
            >
              {region.label}
            </button>
          ))}
        </div>

        {/* Texture Selector */}
        <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🛰️ Satellite
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {TEXTURE_OPTIONS.map((option) => (
            <label
              key={option.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: '8px',
                background: selectedTexture === option.id
                  ? 'rgba(99, 102, 241, 0.25)'
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
              <span style={{ fontSize: '13px' }}>{option.label}</span>
            </label>
          ))}
        </div>

        {/* Elevation Slider */}
        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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

      {/* Info Overlay */}
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
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
          🚀 {currentRegion.label} 3D Terrain
        </h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Drag to rotate • Scroll to zoom • Right-click to pan
        </p>
      </div>
    </div>
  );
}
