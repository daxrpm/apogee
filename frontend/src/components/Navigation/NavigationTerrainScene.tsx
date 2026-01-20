/**
 * NavigationTerrainScene - 3D terrain scene for intro flythrough
 * 
 * Displays real satellite terrain with interactive camera controls.
 * Pauses auto-advance timer when user interacts with the map.
 * 
 * @module Navigation
 */

import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Loader } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { TerrainMesh } from '../Terrain';
import { 
  REGIONS, 
  TEXTURE_OPTIONS, 
  type RegionId, 
  type TextureOption, 
  type SceneInfo,
} from '../../types';

// ============ CAMERA COMPONENT ============

interface AnimatedCameraProps {
  regionId: RegionId;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const CAMERA_POSITIONS: Record<RegionId, [number, number, number]> = {
  ecuador: [0, 15, 20],
  quito: [5, 12, 15],
  pedernales: [-5, 10, 18],
  launch_beach: [0, 8, 15],
};

function AnimatedCamera({ regionId, onInteractionStart, onInteractionEnd }: AnimatedCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const isUserInteracting = useRef(false);
  const interactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Set initial camera position
  useEffect(() => {
    const pos = CAMERA_POSITIONS[regionId] ?? CAMERA_POSITIONS.ecuador;
    camera.position.set(...pos);
  }, [regionId, camera]);

  const handleInteractionStart = useCallback(() => {
    if (interactionTimeout.current) {
      clearTimeout(interactionTimeout.current);
    }
    if (!isUserInteracting.current) {
      isUserInteracting.current = true;
      onInteractionStart?.();
    }
  }, [onInteractionStart]);

  const handleInteractionEnd = useCallback(() => {
    interactionTimeout.current = setTimeout(() => {
      isUserInteracting.current = false;
      onInteractionEnd?.();
    }, 2000);
  }, [onInteractionEnd]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !isUserInteracting.current;
      controlsRef.current.autoRotateSpeed = 0.3;
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2.2}
      autoRotate
      autoRotateSpeed={0.3}
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
}

// ============ SCENE CONTENT ============

interface SceneContentProps {
  regionId: RegionId;
  textureId: TextureOption;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

function SceneContent({ regionId, textureId, onInteractionStart, onInteractionEnd }: SceneContentProps) {
  const region = REGIONS.find(r => r.id === regionId);
  const elevation = region?.elevation ?? 0.8;

  return (
    <>
      <ambientLight intensity={0.4} color="#6080a0" />
      <directionalLight
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 10, -5]} intensity={0.5} />
      
      <Environment preset="night" />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade />
      <fog attach="fog" args={['#0a0a1f', 20, 60]} />

      <AnimatedCamera 
        regionId={regionId}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
      />

      <Suspense fallback={null}>
        <TerrainMesh
          key={`${regionId}-${textureId}`}
          regionId={regionId}
          textureId={textureId}
          segments={256}
          maxElevation={elevation}
        />
      </Suspense>
    </>
  );
}

// ============ SATELLITE SELECTOR ============

interface SatelliteSelectorProps {
  selected: TextureOption;
  onChange: (texture: TextureOption) => void;
}

function SatelliteSelector({ selected, onChange }: SatelliteSelectorProps) {
  return (
    <div style={styles.satelliteSelector}>
      <span style={styles.satelliteLabel}>🛰️ SATELLITE</span>
      <div style={styles.satelliteButtons}>
        {TEXTURE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            style={{
              ...styles.satelliteButton,
              ...(selected === option.id ? styles.satelliteButtonActive : {}),
            }}
          >
            {option.icon}
            <span style={styles.satelliteButtonText}>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

interface NavigationTerrainSceneProps {
  regionId: RegionId;
  sceneInfo: SceneInfo;
  onContinue?: () => void;
  onInteractionChange?: (isInteracting: boolean) => void;
}

export function NavigationTerrainScene({ 
  regionId, 
  sceneInfo, 
  onContinue,
  onInteractionChange,
}: NavigationTerrainSceneProps) {
  // User has interacted - timer stays paused permanently until Continue
  const [hasInteracted, setHasInteracted] = useState(false);
  const [selectedTexture, setSelectedTexture] = useState<TextureOption>('google');

  // When user starts interacting, pause permanently
  const handleInteractionStart = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteractionChange?.(true);
    }
  }, [hasInteracted, onInteractionChange]);

  // We don't auto-resume - user must click Continue
  const handleInteractionEnd = useCallback(() => {
    // Do nothing - stay paused
  }, []);

  const handleTextureChange = useCallback((texture: TextureOption) => {
    setSelectedTexture(texture);
    // Also triggers permanent pause
    if (!hasInteracted) {
      setHasInteracted(true);
      onInteractionChange?.(true);
    }
  }, [hasInteracted, onInteractionChange]);

  return (
    <div style={styles.container}>
      <Canvas
        shadows
        camera={{ position: [15, 12, 15], fov: 50, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a0a1a']} />
        <SceneContent 
          regionId={regionId}
          textureId={selectedTexture}
          onInteractionStart={handleInteractionStart}
          onInteractionEnd={handleInteractionEnd}
        />
      </Canvas>

      <Loader />
      
      <SatelliteSelector selected={selectedTexture} onChange={handleTextureChange} />

      {hasInteracted && (
        <div style={styles.interactionIndicator}>⏸ Timer paused - Click CONTINUE</div>
      )}

      <div style={styles.overlay}>
        <div style={styles.infoBox}>
          <div style={styles.emoji}>{sceneInfo.emoji}</div>
          <div style={styles.textContainer}>
            <h1 style={styles.title}>{sceneInfo.title}</h1>
            <p style={styles.subtitle}>{sceneInfo.subtitle}</p>
          </div>
        </div>
        <button style={styles.continueButton} onClick={onContinue}>
          CONTINUE →
        </button>
      </div>

      <div style={styles.hint}>
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}

// ============ STYLES ============

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    background: '#0a0a1a',
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '0 40px',
    pointerEvents: 'none',
  },
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '20px 28px',
    borderRadius: 12,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    pointerEvents: 'auto',
  },
  emoji: { fontSize: 48 },
  textContainer: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: 2,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: "'Roboto Mono', monospace",
  },
  continueButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: 8,
    padding: '14px 28px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 2,
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'all 0.2s ease',
    fontFamily: "'Roboto Mono', monospace",
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
  },
  hint: {
    position: 'absolute',
    top: 20,
    left: 20,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontFamily: "'Roboto Mono', monospace",
    background: 'rgba(0, 0, 0, 0.5)',
    padding: '8px 12px',
    borderRadius: 6,
  },
  interactionIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    color: '#ff9966',
    fontSize: 12,
    fontFamily: "'Roboto Mono', monospace",
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid rgba(255, 153, 102, 0.3)',
  },
  satelliteSelector: {
    position: 'absolute',
    top: 20,
    right: 180,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '12px 16px',
    borderRadius: 10,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    zIndex: 100,
  },
  satelliteLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: "'Roboto Mono', monospace",
  },
  satelliteButtons: { display: 'flex', gap: 6 },
  satelliteButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: 16,
  },
  satelliteButtonActive: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4))',
    border: '1px solid rgba(99, 102, 241, 0.6)',
    color: '#fff',
    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
  },
  satelliteButtonText: {
    fontSize: 9,
    fontWeight: 500,
    fontFamily: "'Roboto Mono', monospace",
    whiteSpace: 'nowrap',
  },
};
