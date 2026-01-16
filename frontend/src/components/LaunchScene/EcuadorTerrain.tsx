import { useMemo, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader, PlaneGeometry, Mesh, MeshStandardMaterial, DoubleSide } from 'three';

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
}

/**
 * EcuadorTerrain - 3D terrain mesh using displacement mapping
 * 
 * Uses the heightmap to displace vertices and the color texture for the surface.
 * The heightmap (grayscale) determines elevation: white = high, black = low.
 */
export function EcuadorTerrain({
  width = 10,
  height = 10,
  segments = 256,
  maxElevation = 2,
  autoRotate = false,
}: EcuadorTerrainProps) {
  const meshRef = useRef<Mesh>(null);

  // Load textures
  const colorTexture = useLoader(TextureLoader, '/assets/ecuador_color.png');
  const heightTexture = useLoader(TextureLoader, '/assets/ecuador_height.png');

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
      const heightValue = pixels[pixelIndex] / 255;
      
      // Displace Z (up direction for plane)
      positions[i * 3 + 2] = heightValue * maxElevation;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [width, height, segments, maxElevation, heightTexture]);

  // Create material
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      map: colorTexture,
      side: DoubleSide,
      roughness: 0.8,
      metalness: 0.1,
    });
  }, [colorTexture]);

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
