import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useSimulationStore } from '../../stores/simulationStore';
import {
  interpolatePosition,
  interpolateValue,
} from '../../utils/coordinateTransform';

/**
 * RocketCamera - Camera controller that follows the rocket during launch
 * 
 * CAMERA BEHAVIOR:
 * ================
 * 
 * Pre-launch (beach scene):
 * - Free OrbitControls around launch pad
 * 
 * During launch:
 * - Camera follows rocket position
 * - OrbitControls target locked to rocket
 * - User can rotate around rocket but not pan away
 * 
 * Camera offset from rocket:
 * - Behind and slightly above the rocket
 * - Distance increases with altitude for better perspective
 */

interface RocketCameraProps {
  enabled?: boolean;
}

export function RocketCamera({ enabled = true }: RocketCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  
  const {
    launchData,
    animationTime,
    isPlaying,
    currentScene,
  } = useSimulationStore();

  const trajectory = launchData?.trajectory;
  const isLaunching = currentScene === 'launch' && isPlaying;

  // Smooth camera follow
  useFrame(() => {
    if (!isLaunching || !trajectory || !controlsRef.current) return;

    // Get current rocket position
    const [rocketX, rocketY, rocketZ] = interpolatePosition(
      trajectory.t_s,
      trajectory.pos_m.x,
      trajectory.pos_m.y,
      animationTime
    );

    // Get current altitude for dynamic camera offset
    const altitude = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);
    const altitudeKm = altitude / 1000;

    // Calculate camera offset based on altitude
    // Scale distance with altitude for cinematic view
    const baseDistance = 80;
    const altitudeScale = Math.min(altitudeKm / 5, 20); // More aggressive scaling
    const cameraDistance = baseDistance + altitudeScale * 50;

    // Camera position: behind and slightly above rocket
    // At high altitude, camera stays more behind to see trajectory
    const cameraOffset = new Vector3(
      -cameraDistance * 0.2,   // Slightly west
      cameraDistance * 0.15,   // Above (less vertical offset at altitude)
      cameraDistance * 0.8     // Behind
    );

    // Target position (rocket)
    const targetPos = new Vector3(rocketX, rocketY, rocketZ);

    // Faster lerp at high speeds to keep rocket in frame
    const velocity = interpolateValue(trajectory.t_s, trajectory.v_mps, animationTime);
    const speedFactor = Math.min(velocity / 2000, 1); // 0-1 based on speed
    const lerpFactor = 0.05 + speedFactor * 0.15; // 0.05 to 0.20

    // Update OrbitControls target to follow rocket
    controlsRef.current.target.lerp(targetPos, lerpFactor);

    // Calculate desired camera position
    const desiredCameraPos = targetPos.clone().add(cameraOffset);
    camera.position.lerp(desiredCameraPos, lerpFactor);

    // Force controls update
    controlsRef.current.update();
  });

  // Default target for pre-launch
  const defaultTarget: [number, number, number] = isLaunching 
    ? [0, 50, 0]  // Will be overridden by useFrame
    : [0, 10, 0]; // Launch pad area

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={isLaunching ? 50000 : 800}
      maxPolarAngle={Math.PI / 2.05}
      target={defaultTarget}
      enablePan={!isLaunching}  // Disable pan during launch
      enabled={enabled}
    />
  );
}
