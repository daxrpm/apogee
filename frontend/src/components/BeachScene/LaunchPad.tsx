import { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three-stdlib';

interface LaunchPadProps {
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}

/**
 * Launch pad model loader - loads the Falcon 9 launching pad (rocket removed in Blender)
 */
export function LaunchPad({ 
  position = [0, 0, 50], 
  scale = 1,
  rotation = [0, 0, 0]
}: LaunchPadProps) {
  const groupRef = useRef<Group>(null);
  
  // Load the model
  const { scene } = useGLTF('/models/falcon_launch_pad.glb') as GLTF & { scene: Group };
  
  useEffect(() => {
    if (scene) {
      const cloned = scene.clone(true);
      
      // Setup shadows and materials
      cloned.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          if (child.material instanceof MeshStandardMaterial) {
            child.material.envMapIntensity = 0.5;
          }
        }
      });
      
      if (groupRef.current) {
        while (groupRef.current.children.length > 0) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
        groupRef.current.add(cloned);
      }
    }
  }, [scene]);

  return (
    <group 
      ref={groupRef} 
      position={position} 
      scale={scale}
      rotation={rotation}
    />
  );
}

interface RocketProps {
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
}

/**
 * Falcon 9 rocket model loader
 */
export function Rocket({ 
  position = [0, 15, 50], 
  scale = 0.5,
  rotation = [0, 0, 0]
}: RocketProps) {
  const groupRef = useRef<Group>(null);
  
  // Load the rocket model
  const { scene } = useGLTF('/models/falcon_9_-_spacex.glb') as GLTF & { scene: Group };
  
  useEffect(() => {
    if (scene) {
      const cloned = scene.clone();
      
      cloned.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      if (groupRef.current) {
        while (groupRef.current.children.length > 0) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
        groupRef.current.add(cloned);
      }
    }
  }, [scene]);

  return (
    <group 
      ref={groupRef} 
      position={position} 
      scale={scale}
      rotation={rotation}
    />
  );
}

// Preload models
useGLTF.preload('/models/falcon_launch_pad.glb');
useGLTF.preload('/models/falcon_9_-_spacex.glb');
