import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh } from 'three';
import type { GLTF } from 'three-stdlib';

// Seeded random function for consistent placement
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// ============ GLB PALM TREES ============

interface PalmTreeModelProps {
  position: [number, number, number];
  scale?: number;
  rotation?: number;
  variant?: 'coconut' | 'curly';
}

/**
 * Real palm tree using downloaded GLB models
 */
export function PalmTreeModel({ 
  position, 
  scale = 1, 
  rotation = 0,
  variant = 'coconut'
}: PalmTreeModelProps) {
  const groupRef = useRef<Group>(null);
  
  const modelPath = variant === 'coconut' 
    ? '/models/coconut_palm.glb' 
    : '/models/curly_palm.glb';
  
  const { scene } = useGLTF(modelPath) as GLTF & { scene: Group };
  
  useEffect(() => {
    if (scene && groupRef.current) {
      const cloned = scene.clone();
      
      cloned.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      // Clear and add
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      groupRef.current.add(cloned);
    }
  }, [scene]);

  // Slight sway animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.rotation.z = Math.sin(t * 0.3 + position[0]) * 0.01;
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position} 
      rotation={[0, rotation, 0]} 
      scale={scale}
    />
  );
}

interface PalmForestProps {
  count?: number;
  areaWidth?: number;
  areaDepth?: number;
  offsetZ?: number;
  density?: 'sparse' | 'normal' | 'dense';
}

/**
 * Dense palm tree forest using real GLB models
 * Creates a realistic tropical forest between beach and mountains
 */
export function PalmForest({ 
  count = 80,          // Base count
  areaWidth = 400, 
  areaDepth = 150,
  offsetZ = 0,         // Z offset (north-south)
  offsetX = 100,       // X offset (east-west) - NEW
  density = 'dense'
}: PalmForestProps & { offsetX?: number }) {
  // Adjust density multiplier - lower for performance
  const actualCount = density === 'dense' ? count * 1.5 : 
                      density === 'sparse' ? count * 0.5 : count;

  const trees = useMemo(() => {
    const items = [];
    
    for (let i = 0; i < actualCount; i++) {
      // Spread along Z axis (north-south)
      const z = offsetZ + (seededRandom(i * 1.1) - 0.5) * areaDepth;
      
      // Position on X axis (east side) with some variation
      const x = offsetX + seededRandom(i * 2.2) * areaWidth;
      
      // Larger, more visible palm trees (0.4 to 0.8)
      const scale = 0.4 + seededRandom(i * 3.3) * 0.4;
      const rotation = seededRandom(i * 4.4) * Math.PI * 2;
      
      // Alternate between coconut and curly palm types
      const variant: 'coconut' | 'curly' = seededRandom(i * 5.5) > 0.4 ? 'coconut' : 'curly';
      
      items.push({ x, z, scale, rotation, variant, key: i });
    }
    return items;
  }, [actualCount, areaWidth, areaDepth, offsetZ, offsetX]);

  return (
    <group>
      {trees.map((tree) => (
        <PalmTreeModel
          key={tree.key}
          position={[tree.x, 0, tree.z]}
          scale={tree.scale}
          rotation={tree.rotation}
          variant={tree.variant}
        />
      ))}
    </group>
  );
}

// ============ SEAGULLS ============



// ============ SEAGULLS ============

interface SeagullsProps {
  count?: number;
}

/**
 * Animated seagulls in the sky
 */
export function Seagulls({ count = 10 }: SeagullsProps) {
  const groupRef = useRef<Group>(null);
  
  const birds = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const x = (seededRandom(i * 6.1) - 0.5) * 300;
      const y = 30 + seededRandom(i * 6.2) * 60;
      const z = seededRandom(i * 6.3) * 200;
      const speed = 0.15 + seededRandom(i * 6.4) * 0.15;
      const radius = 50 + seededRandom(i * 6.5) * 80;
      const phase = seededRandom(i * 6.6) * Math.PI * 2;
      
      items.push({ x, y, z, speed, radius, phase, key: i });
    }
    return items;
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.children.forEach((bird, i) => {
        const data = birds[i];
        if (data) {
          // Circular flight pattern
          bird.position.x = data.x + Math.cos(t * data.speed + data.phase) * data.radius;
          bird.position.z = data.z + Math.sin(t * data.speed + data.phase) * data.radius * 0.5;
          // Face flight direction
          bird.rotation.y = -t * data.speed - data.phase + Math.PI / 2;
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {birds.map((bird) => (
        <group key={bird.key} position={[bird.x, bird.y, bird.z]}>
          {/* Simple bird shape */}
          <mesh>
            <coneGeometry args={[0.3, 1.2, 3]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
          {/* Wings */}
          <mesh position={[0.7, 0, 0]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[1.0, 0.04, 0.3]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>
          <mesh position={[-0.7, 0, 0]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[1.0, 0.04, 0.3]} />
            <meshStandardMaterial color="#eeeeee" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Preload models
useGLTF.preload('/models/coconut_palm.glb');
useGLTF.preload('/models/curly_palm.glb');
