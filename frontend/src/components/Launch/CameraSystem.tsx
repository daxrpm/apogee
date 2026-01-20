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
  const targetRef = useRef(new THREE.Vector3());
  const positionRef = useRef(new THREE.Vector3());
  
  const { launchData, animationTime } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const downrangeM = useMemo(() => {
    if (!trajectory) return null;
    return trajectory.lambda_rad.map((lam) => lam * R_EARTH);
  }, [trajectory]);

  useFrame(() => {
    if (!trajectory || !downrangeM) return;

    // Get current rocket position
    const [rocketX, rocketY, rocketZ] = interpolatePosition(
      trajectory.t_s,
      trajectory.r_m,
      downrangeM,
      animationTime
    );
    
    const rocketPos = new THREE.Vector3(rocketX, rocketY, rocketZ);
    
    // Get altitude for camera distance scaling
    const altitude = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);
    
    // Calculate target camera position based on mode
    let targetPosition: THREE.Vector3;
    let lookAt: THREE.Vector3;
    
    switch (mode) {
      case 'chase': {
        // Behind and slightly above the rocket
        const chaseDistance = 20 + Math.min(altitude / 5000, 50);
        targetPosition = new THREE.Vector3(
          rocketX - chaseDistance * 0.8,
          rocketY + chaseDistance * 0.3,
          rocketZ + chaseDistance * 0.2
        );
        lookAt = rocketPos;
        break;
      }
        
      case 'side': {
        // Lateral view, parallel to flight path
        const sideDistance = 30 + Math.min(altitude / 3000, 100);
        targetPosition = new THREE.Vector3(
          rocketX,
          rocketY,
          sideDistance
        );
        lookAt = rocketPos;
        break;
      }
        
      case 'ground':
        // Fixed at launch pad, looking up
        targetPosition = new THREE.Vector3(0, 5, 50);
        lookAt = rocketPos;
        break;
        
      case 'wide': {
        // Far away cinematic view
        const wideDistance = 100 + Math.min(altitude / 1000, 300);
        targetPosition = new THREE.Vector3(
          -wideDistance * 0.5,
          wideDistance * 0.3,
          wideDistance * 0.4
        );
        lookAt = rocketPos;
        break;
      }
        
      case 'onboard':
        // From rocket TIP looking DOWN at engines (SpaceX style)
        targetPosition = new THREE.Vector3(
          rocketX,
          rocketY + 5,  // Above rocket
          rocketZ
        );
        // Look straight down at the engines
        lookAt = new THREE.Vector3(
          rocketX,
          rocketY - 3,  // Below rocket (at engines)
          rocketZ
        );
        break;
        
      default:
        targetPosition = positionRef.current;
        lookAt = rocketPos;
    }
    
    // Smooth camera movement - higher lerp factor prevents jittering at high speed
    const lerpFactor = mode === 'ground' ? 0.02 : 0.12;  // Increased from 0.05 to 0.12
    positionRef.current.lerp(targetPosition, lerpFactor);
    targetRef.current.lerp(lookAt, lerpFactor);
    
    camera.position.copy(positionRef.current);
    camera.lookAt(targetRef.current);
  });

  // Initialize camera position on mode change
  useEffect(() => {
    if (!trajectory || !downrangeM) return;
    
    const [x, y, z] = interpolatePosition(
      trajectory.t_s,
      trajectory.r_m,
      downrangeM,
      animationTime
    );
    
    targetRef.current.set(x, y, z);
    
    switch (mode) {
      case 'chase':
        positionRef.current.set(x - 30, y + 15, z + 10);
        break;
      case 'side':
        positionRef.current.set(x, y, 50);
        break;
      case 'ground':
        positionRef.current.set(0, 5, 50);
        break;
      case 'wide':
        positionRef.current.set(-100, 60, 80);
        break;
      case 'onboard':
        positionRef.current.set(x, y + 1, z + 5);
        break;
    }
    
    camera.position.copy(positionRef.current);
    camera.lookAt(targetRef.current);
  }, [mode, trajectory, downrangeM, animationTime, camera]);

  return null;
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
