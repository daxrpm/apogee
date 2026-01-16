import { useMemo, useRef, useEffect } from 'react';
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { TextureLoader, PlaneGeometry, Mesh, MeshStandardMaterial, DoubleSide, RepeatWrapping, CanvasTexture } from 'three';

// Available satellite texture options
export type TextureOption = 'google' | 'bing' | 'google_hybrid';

export const TEXTURE_OPTIONS: { id: TextureOption; label: string; path: string }[] = [
  { id: 'google', label: 'Google Satellite', path: '/assets/ecuador_color_google_sat.png' },
  { id: 'bing', label: 'Bing Satellite', path: '/assets/ecuador_color_bing_sat.png' },
  { id: 'google_hybrid', label: 'Google Hybrid', path: '/assets/ecuador_color_google_sat_hy.png' },
];

interface EcuadorTerrainProps {
  /** Width of the terrain in world units */
  width?: number;
  /** Height of the terrain in world units */
  height?: number;
  /** Number of segments for detail (higher = more detail) */
  segments?: number;
  /** Maximum elevation displacement */
  maxElevation?: number;
  /** Enable auto-rotation for demo */
  autoRotate?: boolean;
  /** Selected texture option */
  textureId?: TextureOption;
}

/**
 * EcuadorTerrain - 3D terrain mesh using displacement mapping
 * 
 * Uses the heightmap to displace vertices and the color texture for the surface.
 */
export function EcuadorTerrain({
  width = 10,
  height = 10,
  segments = 256,
  maxElevation = 2,
  autoRotate = false,
  textureId = 'google',
}: EcuadorTerrainProps) {
  const meshRef = useRef<Mesh>(null);
  const { invalidate } = useThree();

  // Load all textures upfront (avoids Suspense issues on switch)
  const googleTexture = useLoader(TextureLoader, '/assets/ecuador_color_google_sat.png');
  const bingTexture = useLoader(TextureLoader, '/assets/ecuador_color_bing_sat.png');
  const hybridTexture = useLoader(TextureLoader, '/assets/ecuador_color_google_sat_hy.png');
  const heightTexture = useLoader(TextureLoader, '/assets/ecuador_height.png');

  // Select the active texture based on prop
  const colorTexture = useMemo(() => {
    switch (textureId) {
      case 'bing': return bingTexture;
      case 'google_hybrid': return hybridTexture;
      default: return googleTexture;
    }
  }, [textureId, googleTexture, bingTexture, hybridTexture]);

  // Create geometry with displaced vertices
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(width, height, segments, segments);
    
    // Get the image data from heightmap
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !heightTexture.image) return geo;

    const img = heightTexture.image as HTMLImageElement;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Displace vertices based on heightmap
    const positions = geo.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      // Get UV coordinates for this vertex
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      
      // Convert to UV (0-1 range)
      const u = (x / width + 0.5);
      const v = (y / height + 0.5);
      
      // Get pixel coordinates (flip V because image Y is inverted)
      const px = Math.floor(u * (canvas.width - 1));
      const py = Math.floor((1 - v) * (canvas.height - 1));
      
      // Get pixel value (red channel, 0-255)
      const pixelIndex = (py * canvas.width + px) * 4;
      const rawValue = pixels[pixelIndex];
      
      // Handle heightmap: 
      // - Pure white (255) = ocean/no-data = flat at 0
      // - Other values: brighter = higher elevation
      let heightValue: number;
      if (rawValue >= 254) {
        // Ocean or no-data: flat at sea level
        heightValue = 0;
      } else {
        // Land: brighter = higher (normal behavior)
        heightValue = rawValue / 254;
      }
      
      // Displace Z (up direction for plane)
      positions[i * 3 + 2] = heightValue * maxElevation;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [width, height, segments, maxElevation, heightTexture]);

  // Create procedural detail texture (noise)
  const detailTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 512, 512);
      // Add noise
      for (let i = 0; i < 50000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const gray = Math.floor(Math.random() * 50) + 100; // 100-150
        ctx.fillStyle = `rgba(${gray},${gray},${gray},0.1)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(20, 20); // Repeat 20 times across the terrain
    return tex;
  }, []);

  // Create material with detail map - recreate when texture changes
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      map: colorTexture,
      roughnessMap: detailTexture,
      bumpMap: detailTexture,
      bumpScale: 0.05,
      side: DoubleSide,
      roughness: 0.9,
      metalness: 0.1,
    });
  }, [colorTexture, detailTexture]);

  // Force re-render when texture changes
  useEffect(() => {
    invalidate();
  }, [colorTexture, invalidate]);

  // Optional auto-rotation for demo
  useFrame((_, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.z += delta * 0.1;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]} // Lay flat (XZ plane)
      position={[0, 0, 0]}
      castShadow
      receiveShadow
    />
  );
}
