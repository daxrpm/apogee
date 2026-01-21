import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  PlaneGeometry, 
  RepeatWrapping, 
  TextureLoader, 
  Vector3,
  MeshStandardMaterial,
  CanvasTexture,
  Mesh,
  Group
} from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';

function createSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface OceanWaterProps {
  position?: [number, number, number];
  sunDirection?: Vector3;
}

/**
 * Realistic ocean water using Three.js Water shader
 * Creates animated waves with reflections - daytime blue water
 */
export function OceanWater({ 
  position = [0, 0, 0], 
  sunDirection = new Vector3(100, 80, -50) 
}: OceanWaterProps) {
  const { scene } = useThree();
  const [water, setWater] = useState<Water | null>(null);

  // Create water geometry and object
  useEffect(() => {
    // Massive ocean plane to cover horizon
    const geometry = new PlaneGeometry(4000, 4000, 128, 128);
    
    const loader = new TextureLoader();
    const waterNormals = loader.load('/assets/waternormals.jpg');
    waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

    const waterObj = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: waterNormals,
      sunDirection: sunDirection.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: 0x006994,
      distortionScale: 3.7,
      fog: false,
    });

    waterObj.rotation.x = -Math.PI / 2;
    waterObj.position.set(position[0], position[1], position[2]);
    
    scene.add(waterObj);
    setWater(waterObj);

    return () => {
      scene.remove(waterObj);
      geometry.dispose();
    };
  }, [scene, sunDirection, position]);

  // Animate water
  useFrame((_, delta) => {
    if (water) {
      const uniforms = water.material.uniforms;
      if (uniforms?.time) {
        uniforms.time.value += delta * 0.5;
      }
    }
  });

  return null; // Water is added directly to scene
}

interface BeachSandProps {
  position?: [number, number, number];
  width?: number;
  depth?: number;
}

/**
 * Beach sand with procedural texture - larger area with correct Ecuador beach color
 * Color: #ada291 (as requested)
 */
export function BeachSand({ 
  position = [0, 0, 100], 
  width = 400,    
  depth = 800     
}: BeachSandProps) {
  const meshRef = useRef<Mesh>(null);

  // Create procedural sand texture with color #ada291
  const sandTexture = useMemo(() => {
    const rand = createSeededRandom(2025);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base sand color #ada291 with slight variations
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, '#ada291');      // Main color
    gradient.addColorStop(0.3, '#b5a89a');    // Slightly lighter
    gradient.addColorStop(0.7, '#a49a88');    // Slightly darker
    gradient.addColorStop(1, '#ada291');      // Back to main
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);

    // Add grain noise for sand texture
    for (let i = 0; i < 100000; i++) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      // Variations around #ada291
      const r = 173 + Math.floor(rand() * 30 - 15);
      const g = 162 + Math.floor(rand() * 30 - 15);
      const b = 145 + Math.floor(rand() * 30 - 15);
      const alpha = rand() * 0.3;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(x, y, rand() * 3 + 1, rand() * 3 + 1);
    }

    // Add some darker patches (wet sand near water)
    for (let i = 0; i < 80; i++) {
      const x = rand() * 1024;
      const y = rand() * 250; // Near water edge
      const radius = rand() * 60 + 15;
      const gradient2 = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient2.addColorStop(0, 'rgba(120, 110, 95, 0.35)');
      gradient2.addColorStop(1, 'rgba(120, 110, 95, 0)');
      ctx.fillStyle = gradient2;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(20, 16); // Increased repeat for larger area
    return texture;
  }, []);

  // Create sand bump map
  const bumpMap = useMemo(() => {
    const rand = createSeededRandom(2026);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    // Add noise for sand grain bump
    for (let i = 0; i < 50000; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const gray = Math.floor(rand() * 60) + 100;
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(20, 12);
    return texture;
  }, []);

  // Create geometry with slight undulation
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(width, depth, 128, 128);
    const positions = geo.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      
      // Create gentle beach slope (rising from West to East)
      // West is negative X, East is positive X
      const distanceFromWest = x + width / 2;
      // Linear slope from 0 to 0.5 height (matching vegetation at y=-1.0 if base is -1.5)
      const slopeHeight = distanceFromWest * (0.5 / width);
      
      // Add some natural undulation
      const noise = Math.sin(x * 0.05) * Math.cos(y * 0.08) * 0.15;
      
      positions[i + 2] = slopeHeight + noise;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [width, depth]);

  const material = useMemo(() => {
    return new MeshStandardMaterial({
      map: sandTexture,
      bumpMap: bumpMap,
      bumpScale: 0.08,
      roughness: 0.9,
      metalness: 0.0,
    });
  }, [sandTexture, bumpMap]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    />
  );
}

// ============ REALISTIC GLB MOUNTAIN ============

interface RealisticMountainProps {
  position?: [number, number, number];
  scale?: number;
  rotation?: number;
}

/**
 * Realistic beach mountain using downloaded GLB model
 */
export function RealisticMountain({ 
  position = [0, 0, 300], 
  scale = 8,
  rotation = 0
}: RealisticMountainProps) {
  const groupRef = useRef<Group>(null);
  
  const { scene } = useGLTF('/models/ovens_anticline_-_beach_mountain.glb') as GLTF & { scene: Group };
  
  useEffect(() => {
    if (scene && groupRef.current) {
      const cloned = scene.clone();
      
      cloned.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // Disable frustum culling to prevent mountain from disappearing
          child.frustumCulled = false;
        }
      });
      
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      groupRef.current.add(cloned);
    }
  }, [scene]);

  return (
    <group 
      ref={groupRef} 
      position={position}
      rotation={[0, rotation, 0]}
      scale={scale}
    />
  );
}

// Preload models
useGLTF.preload('/models/ovens_anticline_-_beach_mountain.glb');
