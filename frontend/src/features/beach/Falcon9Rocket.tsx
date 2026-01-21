import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three-stdlib';

/**
 * Falcon 9 Rocket Component
 * 
 * GLB MODEL ORIENTATION (falcon_9_-_spacex.glb):
 * ==============================================
 * The model is oriented with nose pointing in +Y direction.
 * To make it VERTICAL with nose UP in Three.js scene:
 *   - rotation={[0, 0, 0]} → Already vertical, nose UP (+Y)
 * 
 * But to point nose EAST (+X in our scene, toward mountains):
 *   - rotation={[0, 0, -Math.PI/2]} → Nose points +X (EAST)
 * 
 * FLIGHT PATH ANGLE (γ) MAPPING:
 * ==============================
 * In our scene: +X = EAST (flight direction), +Y = UP
 * 
 * - γ = 90° (vertical launch): rotation={[0, 0, 0]}
 *   Nose points UP (+Y)
 * 
 * - γ = 0° (horizontal, orbital): rotation={[0, 0, -Math.PI/2]}
 *   Nose points EAST (+X)
 * 
 * General formula during flight:
 *   rotation={[0, 0, -(Math.PI/2 - gamma_rad)]}
 *   Or simplified: rotation={[0, 0, gamma_rad - Math.PI/2]}
 * 
 * Where gamma_rad is from API trajectory.gamma_rad
 */

export interface Falcon9RocketRef {
  getRocketGroup: () => Group | null;
  getModelBounds: () => { minY: number; maxY: number } | null;
}

export interface Falcon9RocketProps {
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  modelPath?: string;
  children?: ReactNode;
}

/**
 * Falcon 9 Rocket - Complete model
 */
export const Falcon9Rocket = forwardRef<Falcon9RocketRef, Falcon9RocketProps>(
  function Falcon9Rocket(
    {
      position = [0, 0, 0],
      scale = 1,
      rotation = [0, 0, 0],
      modelPath = '/models/falcon_9_-_spacex.glb',
      children,
    },
    ref
  ) {
    const rocketGroupRef = useRef<Group>(null);
    const modelGroupRef = useRef<Group>(null);
    const modelBoundsRef = useRef<{ minY: number; maxY: number } | null>(null);

    // Load the Falcon 9 model
    const { scene } = useGLTF(modelPath) as GLTF & { scene: Group };

    // Clone and setup the model
    useEffect(() => {
      if (scene && modelGroupRef.current) {
        // Clear only the cloned model nodes (do not touch React children)
        while (modelGroupRef.current.children.length > 0) {
          modelGroupRef.current.remove(modelGroupRef.current.children[0]);
        }

        // Clone the entire scene
        const clonedScene = scene.clone(true);

        // Setup shadows and materials
        clonedScene.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Clone material to avoid shared state
            if (child.material instanceof MeshStandardMaterial) {
              child.material = child.material.clone();
              child.material.envMapIntensity = 0.8;
            }
          }
        });

        const box = new Box3().setFromObject(clonedScene);
        modelBoundsRef.current = { minY: box.min.y, maxY: box.max.y };

        modelGroupRef.current.add(clonedScene);
      }
    }, [scene]);

    // Expose ref methods
    useImperativeHandle(ref, () => ({
      getRocketGroup: () => rocketGroupRef.current,
      getModelBounds: () => modelBoundsRef.current,
    }));

    return (
      <group
        ref={rocketGroupRef}
        position={position}
        scale={scale}
        rotation={rotation}
      >
        <group ref={modelGroupRef} />
        {children}
      </group>
    );
  }
);

// Preload the model
useGLTF.preload('/models/falcon_9_-_spacex.glb');
useGLTF.preload('/models/falcon_9_-_spacex_just_first_stage.glb');
useGLTF.preload('/models/falcon_9_-_spacex_second.glb');

export default Falcon9Rocket;
