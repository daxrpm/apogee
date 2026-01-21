import { useRef, useMemo, useState, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Group, Vector3 } from 'three';
import { useSimulationStore } from '../../stores/simulationStore';
import {
  interpolatePosition,
  interpolateRotation,
  getTrajectoryDuration,
  interpolateValue,
  R_EARTH,
  SCENE_SCALE,
} from '../../utils/coordinateTransform';
import { PropulsionFX } from './PropulsionFX';
import { Falcon9Rocket, type Falcon9RocketRef } from '../beach';

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
 *    - API provides r_m (geocentric radius) and lambda_rad (downrange angle)
 *    - Downrange distance is computed as R_EARTH * lambda_rad
 *    - Convert to Three.js: x = downrange, y = altitude, z = 0
 *    - Scale by SCENE_SCALE (1/10) to fit scene
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
 * 
 * 4. PROPULSION EFFECTS:
 *    - Stage 1: 9 engines, orange flames
 *    - Stage 2: 1 engine, blue-white plume
 *    - Automatic stage detection from mass discontinuity
 */

interface LaunchAnimationProps {
  children: ReactNode;
  timeScale?: number;
}

export function LaunchAnimation({ 
  children, 
  timeScale = 10 
}: LaunchAnimationProps) {
  const groupRef = useRef<Group>(null);
  const lastTimeRef = useRef(0);
  const stage1GroupRef = useRef<Group>(null);
  const stage2RocketRef = useRef<Falcon9RocketRef>(null);
  const [isStage1Visible, setIsStage1Visible] = useState(true);
  const [isStage1Initialized, setIsStage1Initialized] = useState(false);
  const [stage1InitialTransform, setStage1InitialTransform] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);
  const stage1StateRef = useRef<{
    t0: number;
    pos0: Vector3;
    vel0: Vector3;
    rot0: Euler;
  } | null>(null);

  const STAGE1_DISAPPEAR_Y = -30;

  const [stage2EngineOffsetY, setStage2EngineOffsetY] = useState(-2);
  
  const {
    launchData,
    animationTime,
    isPlaying,
    currentScene,
    setAnimationTime,
    setIsPlaying,
    setScene,
    enginesActive,
    setEnginesActive,
    currentStage,
    setCurrentStage,
  } = useSimulationStore();

  // Extract trajectory data
  const trajectory = launchData?.trajectory;

  const rocketScale = useMemo(() => {
    if (isValidElement<{ scale?: number }>(children) && typeof children.props.scale === 'number') {
      return children.props.scale;
    }
    return 1;
  }, [children]);
  
  // Memoize trajectory arrays and stage separation detection
  const trajectoryData = useMemo(() => {
    if (!trajectory) return null;
    
    // Detect stage separation time from mass discontinuity
    let stageSepTime = 144; // Default estimate
    if (trajectory.m_kg) {
      for (let i = 1; i < trajectory.m_kg.length; i++) {
        const massDrop = trajectory.m_kg[i - 1] - trajectory.m_kg[i];
        const dt = trajectory.t_s[i] - trajectory.t_s[i - 1];
        if (massDrop > 10000 && dt < 2) {
          stageSepTime = trajectory.t_s[i];
          break;
        }
      }
    }
    
    return {
      times: trajectory.t_s,
      posX: trajectory.r_m,
      posY: trajectory.lambda_rad.map((lam: number) => lam * R_EARTH),
      gammas: trajectory.gamma_rad,
      velocities: trajectory.v_mps,
      altitudes: trajectory.h_m,
      masses: trajectory.m_kg,
      duration: getTrajectoryDuration(trajectory.t_s),
      stageSepTime,
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
      setEnginesActive(false);
      setScene('orbit');
      return;
    }

    // Update time in store
    setAnimationTime(newTime);
    
    // Activate engines at liftoff
    if (newTime > 0 && !enginesActive) {
      setEnginesActive(true);
    }
    
    // Detect stage separation
    if (newTime >= trajectoryData.stageSepTime && currentStage === 1) {
      setCurrentStage(2);
    }

    if (newTime < trajectoryData.stageSepTime) {
      stage1StateRef.current = null;
      if (!isStage1Visible) setIsStage1Visible(true);
      if (isStage1Initialized) setIsStage1Initialized(false);
      if (stage1InitialTransform) setStage1InitialTransform(null);
    }

    if (trajectory && newTime >= trajectoryData.stageSepTime) {
      if (!stage1StateRef.current) {
        const [sx, sy, sz] = interpolatePosition(
          trajectoryData.times,
          trajectoryData.posX,
          trajectoryData.posY,
          trajectoryData.stageSepTime
        );

        const [rx, ry, rz] = interpolateRotation(
          trajectoryData.times,
          trajectoryData.gammas,
          trajectoryData.stageSepTime
        );

        const vMps = interpolateValue(trajectoryData.times, trajectoryData.velocities, trajectoryData.stageSepTime);
        const gamma = interpolateValue(trajectoryData.times, trajectoryData.gammas, trajectoryData.stageSepTime);
        const vScene = vMps * SCENE_SCALE;
        const vx = vScene * Math.cos(gamma);
        const vy = vScene * Math.sin(gamma);

        const sidePushMps = 4;
        const vz = sidePushMps * SCENE_SCALE;

        const sepOffsetLocal = new Vector3(0, -1.2, 0.2);
        const sepOffset = sepOffsetLocal.applyEuler(new Euler(rx, ry, rz));

        stage1StateRef.current = {
          t0: trajectoryData.stageSepTime,
          pos0: new Vector3(sx, sy, sz).add(sepOffset),
          vel0: new Vector3(vx, vy - 0.6, vz),
          rot0: new Euler(rx, ry, rz),
        };

        if (!isStage1Initialized) setIsStage1Initialized(true);
        setStage1InitialTransform({
          position: [stage1StateRef.current.pos0.x, stage1StateRef.current.pos0.y, stage1StateRef.current.pos0.z],
          rotation: [stage1StateRef.current.rot0.x, stage1StateRef.current.rot0.y, stage1StateRef.current.rot0.z],
        });
      }

      if (stage1GroupRef.current && stage1StateRef.current) {
        const dt = Math.max(0, newTime - stage1StateRef.current.t0);
        const gScene = 9.81 * SCENE_SCALE;
        const pos = stage1StateRef.current.pos0
          .clone()
          .add(stage1StateRef.current.vel0.clone().multiplyScalar(dt))
          .add(new Vector3(0, -0.5 * gScene * dt * dt, 0));

        stage1GroupRef.current.position.copy(pos);
        stage1GroupRef.current.rotation.set(
          stage1StateRef.current.rot0.x,
          stage1StateRef.current.rot0.y,
          stage1StateRef.current.rot0.z + dt * 0.35
        );

        if (isStage1Visible && pos.y < STAGE1_DISAPPEAR_Y) {
          setIsStage1Visible(false);
        }
      }

      const bounds = stage2RocketRef.current?.getModelBounds();
      if (bounds) {
        const desired = bounds.minY * rocketScale;
        setStage2EngineOffsetY((prev) => (Math.abs(prev - desired) < 1e-3 ? prev : desired));
      }
    }
  });

  // If no trajectory data, render children at default position
  if (!trajectoryData) {
    return <group ref={groupRef}>{children}</group>;
  }

  const displayTime = Math.max(0, Math.min(animationTime, trajectoryData.duration));
  const displayPosition = interpolatePosition(
    trajectoryData.times,
    trajectoryData.posX,
    trajectoryData.posY,
    displayTime
  );

  const displayRotation = interpolateRotation(
    trajectoryData.times,
    trajectoryData.gammas,
    displayTime
  );

  // Calculate thrust level (decays slightly with altitude due to back-pressure)
  const currentAltitude = trajectoryData.altitudes 
    ? interpolateValue(trajectoryData.times, trajectoryData.altitudes, animationTime)
    : 0;
  const thrustLevel = Math.min(1, 0.8 + (currentAltitude / 100000) * 0.2);

  const propulsionScale = (currentStage === 1 ? 3.6 : 2.8) * (0.8 + 0.2 * thrustLevel);

  const isSeparated = animationTime >= trajectoryData.stageSepTime;

  return (
    <>
      <group
        ref={groupRef}
        position={displayPosition}
        rotation={displayRotation}
      >
        {isSeparated ? (
          <Falcon9Rocket
            ref={stage2RocketRef}
            modelPath="/models/falcon_9_-_spacex_second.glb"
            scale={rocketScale}
          />
        ) : (
          children
        )}

        <PropulsionFX
          active={enginesActive}
          stage={currentStage}
          thrust={thrustLevel}
          position={[0, isSeparated ? stage2EngineOffsetY : -2, 0]}
          scale={propulsionScale}
          altitude={currentAltitude}
        />
      </group>

      {isSeparated && isStage1Visible && isStage1Initialized && stage1InitialTransform && (
        <group
          ref={stage1GroupRef}
          position={stage1InitialTransform?.position}
          rotation={stage1InitialTransform?.rotation}
        >
          <Falcon9Rocket
            modelPath="/models/falcon_9_-_spacex_just_first_stage.glb"
            scale={rocketScale}
          />
        </group>
      )}
    </>
  );
}

