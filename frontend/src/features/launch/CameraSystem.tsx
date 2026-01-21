/**
 * CameraSystem - Multiple camera views for launch visualization
 * 
 * Provides SpaceX-style camera views:
 * - Chase: Following behind the rocket
 * - Side: Lateral view from fixed position
 * - Ground: Looking up from launch pad
 * - Wide: Cinematic wide shot
 * - Onboard: From rocket's perspective
 * 
 * @module Launch/CameraSystem
 */

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useSimulationStore } from '../../stores/simulationStore';
import { interpolatePosition, interpolateValue, R_EARTH } from '../../utils/coordinateTransform';

// ============ TYPES ============

export type CameraMode = 'chase' | 'side' | 'ground' | 'wide' | 'onboard';

export interface CameraConfig {
  id: CameraMode;
  label: string;
  icon: string;
  description: string;
}

const CAMERA_MODES: CameraConfig[] = [
  { id: 'chase', label: 'Chase', icon: '🎬', description: 'Following camera' },
  { id: 'side', label: 'Side', icon: '📷', description: 'Lateral tracking' },
  { id: 'ground', label: 'Ground', icon: '🏠', description: 'From launch pad' },
  { id: 'wide', label: 'Wide', icon: '🌍', description: 'Cinematic view' },
  { id: 'onboard', label: 'Onboard', icon: '🚀', description: 'Rocket POV' },
];

// ============ CAMERA CONTROLLER ============

interface LaunchCameraProps {
  mode: CameraMode;
}

export function LaunchCamera({ mode }: LaunchCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetRef = useRef(new THREE.Vector3());
  const positionRef = useRef(new THREE.Vector3());
  
  const { launchData, animationTime } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const downrangeM = useMemo(() => {
    if (!trajectory) return null;
    return trajectory.lambda_rad.map((lam) => lam * R_EARTH);
  }, [trajectory]);

  useFrame(() => {
    if (!trajectory || !downrangeM || !controlsRef.current) return;

    // Get current rocket position
    const [rocketX, rocketY, rocketZ] = interpolatePosition(
      trajectory.t_s,
      trajectory.r_m,
      downrangeM,
      animationTime
    );
    
    const rocketPos = new THREE.Vector3(rocketX, rocketY, rocketZ);

    const gamma = trajectory.gamma_rad
      ? interpolateValue(trajectory.t_s, trajectory.gamma_rad, animationTime)
      : Math.PI / 2;
    const rocketAxis = new THREE.Vector3(Math.cos(gamma), Math.sin(gamma), 0).normalize();
    const ROCKET_HALF_LENGTH = 7;
    const rocketTail = rocketPos.clone().add(rocketAxis.clone().multiplyScalar(-ROCKET_HALF_LENGTH));
    
    // Calculate target camera position based on mode
    let lookAt: THREE.Vector3;

    const TARGET_OFFSET_Y = 4.5;
    
    switch (mode) {
      case 'chase': {
        // Behind and slightly above the rocket
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, TARGET_OFFSET_Y, 0));
        break;
      }
        
      case 'side': {
        // Lateral view, parallel to flight path
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, TARGET_OFFSET_Y, 0));
        break;
      }
        
      case 'ground':
        // Fixed at launch pad, looking up
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, TARGET_OFFSET_Y, 0));
        break;
        
      case 'wide': {
        // Far away cinematic view
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, TARGET_OFFSET_Y, 0));
        break;
      }
        
      case 'onboard':
        // From rocket TIP looking DOWN at engines (SpaceX style)
        // Look straight down at the engines
        lookAt = rocketTail;
        break;
        
      default:
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, TARGET_OFFSET_Y, 0));
    }
    
    // Smooth follow for the target. Camera translation follows the target so user orbit stays stable.
    const lerpFactor = mode === 'ground' ? 0.02 : 0.12;
    const prevTarget = targetRef.current.clone();
    targetRef.current.lerp(lookAt, lerpFactor);

    const deltaTarget = targetRef.current.clone().sub(prevTarget);
    camera.position.add(deltaTarget);
    controlsRef.current.target.copy(targetRef.current);
    controlsRef.current.update();
  });

  // Initialize camera position on mode change
  useEffect(() => {
    if (!trajectory || !downrangeM || !controlsRef.current) return;
    
    const [x, y, z] = interpolatePosition(
      trajectory.t_s,
      trajectory.r_m,
      downrangeM,
      animationTime
    );
    
    const TARGET_OFFSET_Y = 4.5;
    const gamma = trajectory.gamma_rad
      ? interpolateValue(trajectory.t_s, trajectory.gamma_rad, animationTime)
      : Math.PI / 2;
    const rocketAxis = new THREE.Vector3(Math.cos(gamma), Math.sin(gamma), 0).normalize();
    const ROCKET_HALF_LENGTH = 7;
    const rocketPos = new THREE.Vector3(x, y, z);
    const rocketTip = rocketPos.clone().add(rocketAxis.clone().multiplyScalar(ROCKET_HALF_LENGTH));
    const rocketTail = rocketPos.clone().add(rocketAxis.clone().multiplyScalar(-ROCKET_HALF_LENGTH));
    const rocketRight = new THREE.Vector3().crossVectors(rocketAxis, new THREE.Vector3(0, 0, 1)).normalize();

    targetRef.current.copy(mode === 'onboard' ? rocketTail : new THREE.Vector3(x, y + TARGET_OFFSET_Y, z));
    controlsRef.current.target.copy(targetRef.current);
    
    switch (mode) {
      case 'chase':
        positionRef.current.set(x - 30, y + 15, z + 10);
        break;
      case 'side':
        positionRef.current.set(x, y + 10, 70);
        break;
      case 'ground':
        positionRef.current.set(0, 5, 50);
        break;
      case 'wide':
        positionRef.current.set(-120, 80, 120);
        break;
      case 'onboard':
        positionRef.current.copy(
          rocketTip
            .clone()
            .add(rocketAxis.clone().multiplyScalar(2.5))
            .add(rocketRight.multiplyScalar(1.0))
        );
        break;
    }
    
    camera.position.copy(positionRef.current);
    controlsRef.current.update();
  }, [mode, trajectory, downrangeM, animationTime, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      enableRotate
      enableZoom
      enablePan
      minDistance={5}
      maxDistance={150000}
    />
  );
}

// ============ CAMERA SELECTOR UI ============

interface CameraSelectorProps {
  currentMode: CameraMode;
  onChange: (mode: CameraMode) => void;
}

export function CameraSelector({ currentMode, onChange }: CameraSelectorProps) {
  return (
    <div style={styles.container}>
      <div style={styles.label}>🎥 CAMERA</div>
      <div style={styles.buttons}>
        {CAMERA_MODES.map((cam) => (
          <button
            key={cam.id}
            onClick={() => onChange(cam.id)}
            style={{
              ...styles.button,
              ...(currentMode === cam.id ? styles.buttonActive : {}),
            }}
            title={cam.description}
          >
            <span style={styles.icon}>{cam.icon}</span>
            <span style={styles.buttonText}>{cam.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ STYLES ============

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    right: 20,  // Changed from left to right
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: 'rgba(0, 0, 0, 0.85)',
    padding: '10px 12px',
    borderRadius: 8,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    zIndex: 100,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: "'Roboto Mono', monospace",
    textTransform: 'uppercase',
  },
  buttons: {
    display: 'flex',
    gap: 4,
    flexDirection: 'column',  // Vertical stack
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 255, 255, 0.03)',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 12,
    fontFamily: "'Roboto Mono', monospace",
  },
  buttonActive: {
    background: 'rgba(99, 102, 241, 0.3)',
    border: '1px solid rgba(99, 102, 241, 0.6)',
    color: '#fff',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
  },
  icon: {
    fontSize: 14,
  },
  buttonText: {
    fontSize: 10,
    fontWeight: 500,
    fontFamily: "'Roboto Mono', monospace",
  },
};

export default LaunchCamera;
