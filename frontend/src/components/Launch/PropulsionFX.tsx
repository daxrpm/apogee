/**
 * PropulsionFX - Rocket engine exhaust particle effects
 * 
 * Creates realistic rocket flame and exhaust particles for:
 * - Stage 1: 9 Merlin engines (large, bright orange flames with dense smoke)
 * - Stage 2: 1 Merlin Vacuum (smaller, blue-white plume)
 * 
 * Includes launch pad smoke cloud during initial liftoff.
 * Uses Three.js Points system for GPU-accelerated particles.
 * 
 * @module Launch/PropulsionFX
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ============ CONSTANTS ============

const STAGE1_EXHAUST_PARTICLES = 3000;  // More particles for denser effect
const STAGE2_EXHAUST_PARTICLES = 1000;
const LAUNCH_SMOKE_PARTICLES = 2000;    // Ground smoke cloud

// ============ MAIN COMPONENT ============

interface PropulsionFXProps {
  /** Whether engines are active */
  active: boolean;
  /** Current stage (1 or 2) */
  stage?: 1 | 2;
  /** Engine thrust level (0-1) */
  thrust?: number;
  /** Position offset for the exhaust origin */
  position?: [number, number, number];
  /** Scale of the effect */
  scale?: number;
  /** Current altitude (for launch smoke fade) */
  altitude?: number;
}

export function PropulsionFX({
  active,
  stage = 1,
  thrust = 1,
  position = [0, 0, 0],
  scale = 1,
  altitude = 0,
}: PropulsionFXProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = stage === 1 ? STAGE1_EXHAUST_PARTICLES : STAGE2_EXHAUST_PARTICLES;

  // Track if this is initial launch for smoke effect
  const [isInitialLaunch, setIsInitialLaunch] = useState(true);
  
  useEffect(() => {
    if (altitude > 500) {
      setIsInitialLaunch(false);
    }
  }, [altitude]);

  // Generate initial particle data
  const [positions, velocities, lifetimes] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);
    const life = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Random starting position in exhaust cone
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.4 * (stage === 1 ? 1.8 : 0.6);
      
      pos[i3] = Math.cos(angle) * radius;
      pos[i3 + 1] = -Math.random() * 0.5;
      pos[i3 + 2] = Math.sin(angle) * radius;
      
      // Velocity - strong downward with turbulent spread
      const spread = stage === 1 ? 0.4 : 0.2;
      vel[i3] = (Math.random() - 0.5) * spread;
      vel[i3 + 1] = -(Math.random() * 0.6 + 0.4); // Downward
      vel[i3 + 2] = (Math.random() - 0.5) * spread;
      
      // Random lifetime phase for continuous stream
      life[i] = Math.random();
    }

    return [pos, vel, life];
  }, [particleCount, stage]);

  // Animate particles each frame
  useFrame((state, delta) => {
    if (!pointsRef.current || !active) return;

    const positionAttr = pointsRef.current.geometry.attributes.position;
    const posArray = positionAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Update lifetime
      lifetimes[i] += delta * (1.5 + Math.random() * 0.5);
      
      // Reset particle when lifetime exceeds 1
      if (lifetimes[i] > 1) {
        lifetimes[i] = 0;
        
        // Reset to nozzle position with random spread
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.3 * (stage === 1 ? 1.5 : 0.5);
        
        posArray[i3] = Math.cos(angle) * radius;
        posArray[i3 + 1] = -Math.random() * 0.3;
        posArray[i3 + 2] = Math.sin(angle) * radius;
      } else {
        // Move particle with velocity and turbulence
        const speed = (2.5 + Math.random()) * thrust * delta * 35;
        
        // Add turbulence for realistic chaotic motion
        const turbX = Math.sin(time * 15 + i * 0.1) * 0.03;
        const turbZ = Math.cos(time * 12 + i * 0.15) * 0.03;
        
        posArray[i3] += (velocities[i3] + turbX) * speed;
        posArray[i3 + 1] += velocities[i3 + 1] * speed * 1.2; // Faster downward
        posArray[i3 + 2] += (velocities[i3 + 2] + turbZ) * speed;
        
        // Expand plume as it moves away
        const age = lifetimes[i];
        posArray[i3] *= 1 + age * 0.01;
        posArray[i3 + 2] *= 1 + age * 0.01;
      }
    }

    positionAttr.needsUpdate = true;
  });

  // Colors based on stage
  const particleColor = stage === 1 ? '#ff5500' : '#99ccff';
  const particleSize = (stage === 1 ? 0.12 : 0.08) * thrust;

  if (!active) return null;

  return (
    <group position={position} scale={scale}>
      {/* Main exhaust particles */}
      <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={particleColor}
          size={particleSize}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85 * thrust}
        />
      </Points>

      {/* Hot inner core */}
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color={stage === 1 ? '#ffff88' : '#ffffff'}
          size={particleSize * 0.4}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.9 * thrust}
        />
      </Points>

      {/* Core flame glow */}
      <FlameCore stage={stage} thrust={thrust} />

      {/* Mach diamonds (Stage 1 only at low altitude) */}
      {stage === 1 && altitude < 20000 && <MachDiamonds thrust={thrust} altitude={altitude} />}
      
      {/* Launch pad smoke (only during initial launch) */}
      {stage === 1 && isInitialLaunch && altitude < 100 && (
        <LaunchPadSmoke active={active} thrust={thrust} />
      )}
    </group>
  );
}

// ============ FLAME CORE ============

function FlameCore({ stage, thrust }: { stage: 1 | 2; thrust: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (meshRef.current) {
      // Intense flicker effect
      const flicker = 0.85 + Math.sin(time * 40) * 0.1 + Math.sin(time * 67) * 0.05;
      const pulse = 1 + Math.sin(time * 8) * 0.1;
      meshRef.current.scale.y = (1.2 + Math.random() * 0.3) * thrust * flicker * pulse;
      meshRef.current.scale.x = meshRef.current.scale.z = 
        (0.9 + Math.random() * 0.2) * thrust * flicker;
    }
    
    if (glowRef.current) {
      // Outer glow pulsation
      const glow = 0.9 + Math.sin(time * 5) * 0.1;
      glowRef.current.scale.setScalar(glow);
    }
  });

  const coneLength = stage === 1 ? 4 : 2;
  const coneRadius = stage === 1 ? 1.0 : 0.4;
  const coreColor = stage === 1 ? '#ffcc00' : '#aaddff';
  const midColor = stage === 1 ? '#ff6600' : '#6699ff';
  const outerColor = stage === 1 ? '#ff2200' : '#3366cc';

  return (
    <group>
      {/* White-hot inner core */}
      <mesh ref={meshRef} position={[0, -coneLength / 2, 0]}>
        <coneGeometry args={[coneRadius * 0.3, coneLength * 0.6, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95 * thrust}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Yellow core */}
      <mesh position={[0, -coneLength / 2, 0]}>
        <coneGeometry args={[coneRadius * 0.5, coneLength * 0.8, 12]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.85 * thrust}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Orange middle layer */}
      <mesh position={[0, -coneLength * 0.55, 0]}>
        <coneGeometry args={[coneRadius * 0.75, coneLength, 16]} />
        <meshBasicMaterial
          color={midColor}
          transparent
          opacity={0.6 * thrust}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Red outer glow */}
      <mesh ref={glowRef} position={[0, -coneLength * 0.6, 0]}>
        <coneGeometry args={[coneRadius, coneLength * 1.3, 16]} />
        <meshBasicMaterial
          color={outerColor}
          transparent
          opacity={0.35 * thrust}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Intense point light */}
      <pointLight
        position={[0, -1.5, 0]}
        color={coreColor}
        intensity={stage === 1 ? 20 * thrust : 8 * thrust}
        distance={80}
        decay={2}
      />
      
      {/* Secondary ambient glow */}
      <pointLight
        position={[0, -3, 0]}
        color={outerColor}
        intensity={stage === 1 ? 10 * thrust : 4 * thrust}
        distance={50}
        decay={2}
      />
    </group>
  );
}

// ============ MACH DIAMONDS ============

function MachDiamonds({ thrust, altitude }: { thrust: number; altitude: number }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Fade out with altitude (atmospheric effect)
  const visibility = Math.max(0, 1 - altitude / 20000);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        // Shimmer and fade with altitude
        mat.opacity = (0.5 + Math.sin(time * 25 + i * 1.5) * 0.3) * thrust * visibility;
      }
      // Oscillate position slightly
      mesh.position.y = -2 - i * 0.7 + Math.sin(time * 30 + i) * 0.05;
    });
  });

  if (visibility < 0.1) return null;

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, -2 - i * 0.7, 0]} rotation={[Math.PI, 0, 0]}>
          <octahedronGeometry args={[0.25 - i * 0.035, 0]} />
          <meshBasicMaterial
            color="#ffffaa"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============ LAUNCH PAD SMOKE ============

function LaunchPadSmoke({ active, thrust }: { active: boolean; thrust: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Generate smoke particles spreading outward from pad
  const [positions, velocities, lifetimes] = useMemo(() => {
    const count = LAUNCH_SMOKE_PARTICLES;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // Start at ground level, spread in a wide circle
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 2;
      
      pos[i3] = Math.cos(angle) * radius;
      pos[i3 + 1] = -5 + Math.random() * 2; // Below rocket, at ground
      pos[i3 + 2] = Math.sin(angle) * radius;
      
      // Velocity - outward and upward (mushroom cloud effect)
      const outSpeed = 0.5 + Math.random() * 0.5;
      vel[i3] = Math.cos(angle) * outSpeed;
      vel[i3 + 1] = 0.2 + Math.random() * 0.3; // Slowly rising
      vel[i3 + 2] = Math.sin(angle) * outSpeed;
      
      life[i] = Math.random();
    }

    return [pos, vel, life];
  }, []);

  useFrame((state, delta) => {
    if (!pointsRef.current || !active) return;

    const positionAttr = pointsRef.current.geometry.attributes.position;
    const posArray = positionAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < LAUNCH_SMOKE_PARTICLES; i++) {
      const i3 = i * 3;
      
      lifetimes[i] += delta * 0.3; // Slow aging
      
      if (lifetimes[i] > 1) {
        lifetimes[i] = 0;
        
        // Reset near center
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 1.5;
        
        posArray[i3] = Math.cos(angle) * radius;
        posArray[i3 + 1] = -5 + Math.random();
        posArray[i3 + 2] = Math.sin(angle) * radius;
      } else {
        // Expand outward with turbulence
        const speed = delta * 8 * thrust;
        const turbulence = Math.sin(time * 3 + i * 0.1) * 0.02;
        
        posArray[i3] += velocities[i3] * speed * (1 + turbulence);
        posArray[i3 + 1] += velocities[i3 + 1] * speed * 0.5;
        posArray[i3 + 2] += velocities[i3 + 2] * speed * (1 + turbulence);
        
        // Slow down over time (drag)
        velocities[i3] *= 0.995;
        velocities[i3 + 2] *= 0.995;
      }
    }

    positionAttr.needsUpdate = true;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#999999"
        size={0.8}
        sizeAttenuation
        depthWrite={false}
        opacity={0.4 * thrust}
      />
    </Points>
  );
}

// ============ SMOKE TRAIL ============

interface SmokeTrailProps {
  active: boolean;
  rocketPosition: [number, number, number];
}

export function SmokeTrail({ active, rocketPosition }: SmokeTrailProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailPositions = useRef<Float32Array>(new Float32Array(500 * 3));
  const trailIndex = useRef(0);
  const lastUpdateTime = useRef(0);

  useFrame((state) => {
    if (!pointsRef.current) return;

    // Add new trail point every 30ms for denser trail
    if (active && state.clock.elapsedTime - lastUpdateTime.current > 0.03) {
      lastUpdateTime.current = state.clock.elapsedTime;

      const i = (trailIndex.current % 150) * 3;
      trailPositions.current[i] = rocketPosition[0] + (Math.random() - 0.5) * 0.8;
      trailPositions.current[i + 1] = rocketPosition[1] - 3;
      trailPositions.current[i + 2] = rocketPosition[2] + (Math.random() - 0.5) * 0.8;

      trailIndex.current++;
    }

    const posAttr = pointsRef.current.geometry.attributes.position;
    (posAttr.array as Float32Array).set(trailPositions.current);
    posAttr.needsUpdate = true;
  });

  return (
    <Points ref={pointsRef} positions={trailPositions.current} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#aaaaaa"
        size={0.5}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
      />
    </Points>
  );
}

export default PropulsionFX;
