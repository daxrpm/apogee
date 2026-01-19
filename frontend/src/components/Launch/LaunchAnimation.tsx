import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useSimulationStore } from '../../stores/simulationStore';
import {
  interpolatePosition,
  interpolateRotation,
  getTrajectoryDuration,
} from '../../utils/coordinateTransform';

/**
 * LaunchAnimation Component
 * 
 * Controls the rocket's position and rotation during launch animation.
 * Reads trajectory data from the simulation store and interpolates
 * the rocket's state based on the current animation time.
 * 
 * PHYSICS IMPLEMENTATION:
 * =======================
 * 
 * 1. POSITION:
 *    - API provides pos_m.x (radial from Earth center) and pos_m.y (downrange)
 *    - Convert to Three.js: x = downrange, y = altitude, z = 0
 *    - Scale by SCENE_SCALE (1/1000) to fit scene
 * 
 * 2. ROTATION (Flight Path Angle γ):
 *    - γ = 90° at liftoff (vertical, nose UP)
 *    - γ decreases during gravity turn
 *    - γ ≈ 0° at orbit insertion (horizontal, nose EAST)
 *    - Rotation.z = γ - π/2
 * 
 * 3. TIME SCALING:
 *    - Animation runs at configurable speed (default 10x real-time)
 *    - Smooth interpolation between trajectory points
 */

interface LaunchAnimationProps {
  children: React.ReactNode;
  timeScale?: number;
}

export function LaunchAnimation({ 
  children, 
  timeScale = 10 
}: LaunchAnimationProps) {
  const groupRef = useRef<Group>(null);
  const lastTimeRef = useRef(0);
  
  const {
    launchData,
    animationTime,
    isPlaying,
    currentScene,
    setAnimationTime,
    setIsPlaying,
    setScene,
  } = useSimulationStore();

  // Extract trajectory data
  const trajectory = launchData?.trajectory;
  
  // Memoize trajectory arrays
  const trajectoryData = useMemo(() => {
    if (!trajectory) return null;
    return {
      times: trajectory.t_s,
      posX: trajectory.pos_m.x,
      posY: trajectory.pos_m.y,
      gammas: trajectory.gamma_rad,
      velocities: trajectory.v_mps,
      altitudes: trajectory.h_m,
      duration: getTrajectoryDuration(trajectory.t_s),
    };
  }, [trajectory]);

  // Animation loop - runs every frame
  useFrame((state, delta) => {
    if (!isPlaying || !trajectoryData || currentScene !== 'launch') {
      lastTimeRef.current = state.clock.elapsedTime;
      return;
    }

    // Update animation time based on delta (scaled)
    const scaledDelta = delta * timeScale;
    const newTime = animationTime + scaledDelta;

    // Check if animation is complete
    if (newTime >= trajectoryData.duration) {
      setAnimationTime(trajectoryData.duration);
      setIsPlaying(false);
      setScene('orbit');
      return;
    }

    // Update time in store
    setAnimationTime(newTime);

    // Update rocket position and rotation
    if (groupRef.current) {
      // Get interpolated position
      const [x, y, z] = interpolatePosition(
        trajectoryData.times,
        trajectoryData.posX,
        trajectoryData.posY,
        newTime
      );

      // Get interpolated rotation
      const [rx, ry, rz] = interpolateRotation(
        trajectoryData.times,
        trajectoryData.gammas,
        newTime
      );

      // Apply transforms
      groupRef.current.position.set(x, y, z);
      groupRef.current.rotation.set(rx, ry, rz);
    }
  });

  // If no trajectory data, render children at default position
  if (!trajectoryData) {
    return <group ref={groupRef}>{children}</group>;
  }

  // Get initial position for pre-launch state
  const initialPosition = interpolatePosition(
    trajectoryData.times,
    trajectoryData.posX,
    trajectoryData.posY,
    0
  );

  const initialRotation = interpolateRotation(
    trajectoryData.times,
    trajectoryData.gammas,
    0
  );

  return (
    <group
      ref={groupRef}
      position={isPlaying ? undefined : initialPosition}
      rotation={isPlaying ? undefined : initialRotation}
    >
      {children}
    </group>
  );
}
