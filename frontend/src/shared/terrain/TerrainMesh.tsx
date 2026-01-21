/**
 * TerrainMesh - 3D terrain with multi-region satellite texture support
 * 
 * Renders a 3D terrain mesh using heightmap displacement and satellite imagery.
 * Supports Ecuador, Quito, Pedernales, and Launch Beach regions with
 * Google, Bing, and Google Hybrid satellite textures.
 * 
 * @module Terrain
 */

import { useMemo, useRef, useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { 
  TextureLoader, 
  PlaneGeometry, 
  Mesh, 
  MeshStandardMaterial, 
  DoubleSide, 
  RepeatWrapping, 
  CanvasTexture,
  type Texture,
} from 'three';
import { REGIONS, type RegionId, type TextureOption } from '../../types';

function createSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ============ COMPONENT PROPS ============

interface TerrainMeshProps {
  /** Region to display */
  regionId: RegionId;
  /** Satellite texture source */
  textureId: TextureOption;
  /** Mesh resolution (higher = more detail but slower) */
  segments?: number;
  /** Maximum elevation scaling factor */
  maxElevation?: number;
}

// ============ MAIN COMPONENT ============

/**
 * TerrainMesh - Renders a 3D terrain mesh with satellite textures
 * 
 * Uses heightmap PNG files to displace vertices and satellite imagery for color.
 * All textures are preloaded to avoid conditional hook issues.
 */
export function TerrainMesh({
  regionId,
  textureId,
  segments = 256,
  maxElevation = 0.8,
}: TerrainMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { invalidate } = useThree();

  // Get region config with elevation
  const region = REGIONS.find(r => r.id === regionId) ?? REGIONS[0];
  const effectiveElevation = maxElevation ?? region.elevation;

  // ===== PRELOAD ALL TEXTURES (hooks must be unconditional) =====
  
  // Ecuador
  const ecuadorHeight = useLoader(TextureLoader, '/assets/ecuador_height.png');
  const ecuadorGoogle = useLoader(TextureLoader, '/assets/ecuador_color_google_sat.png');
  const ecuadorBing = useLoader(TextureLoader, '/assets/ecuador_color_bing_sat.png');
  const ecuadorHybrid = useLoader(TextureLoader, '/assets/ecuador_color_google_sat_hy.png');

  // Quito
  const quitoHeight = useLoader(TextureLoader, '/assets/quito_height.png');
  const quitoGoogle = useLoader(TextureLoader, '/assets/quito_color_google_sat.png');
  const quitoBing = useLoader(TextureLoader, '/assets/quito_color_bing_sat.png');
  const quitoHybrid = useLoader(TextureLoader, '/assets/quito_color_google_sat_hy.png');

  // Pedernales
  const pedernalesHeight = useLoader(TextureLoader, '/assets/pedernales_height.png');
  const pedernalesGoogle = useLoader(TextureLoader, '/assets/pedernales_color_google_sat.png');
  const pedernalesBing = useLoader(TextureLoader, '/assets/pedernales_color_bing_sat.png');
  const pedernalesHybrid = useLoader(TextureLoader, '/assets/pedernales_color_google_sat_hy.png');

  // Launch Beach
  const launchBeachHeight = useLoader(TextureLoader, '/assets/launch_beach_height.png');
  const launchBeachGoogle = useLoader(TextureLoader, '/assets/launch_beach_color_google_sat.png');
  const launchBeachBing = useLoader(TextureLoader, '/assets/launch_beach_color_bing_sat.png');
  const launchBeachHybrid = useLoader(TextureLoader, '/assets/launch_beach_color_google_sat_hy.png');

  // ===== SELECT ACTIVE TEXTURES =====

  const heightTexture: Texture = useMemo(() => {
    const heightMap: Record<RegionId, Texture> = {
      ecuador: ecuadorHeight,
      quito: quitoHeight,
      pedernales: pedernalesHeight,
      launch_beach: launchBeachHeight,
    };
    return heightMap[regionId] ?? ecuadorHeight;
  }, [regionId, ecuadorHeight, quitoHeight, pedernalesHeight, launchBeachHeight]);

  const colorTexture: Texture = useMemo(() => {
    const textureMap: Record<RegionId, Record<TextureOption, Texture>> = {
      ecuador: { google: ecuadorGoogle, bing: ecuadorBing, google_hybrid: ecuadorHybrid },
      quito: { google: quitoGoogle, bing: quitoBing, google_hybrid: quitoHybrid },
      pedernales: { google: pedernalesGoogle, bing: pedernalesBing, google_hybrid: pedernalesHybrid },
      launch_beach: { google: launchBeachGoogle, bing: launchBeachBing, google_hybrid: launchBeachHybrid },
    };
    return textureMap[regionId]?.[textureId] ?? ecuadorGoogle;
  }, [
    regionId, textureId,
    ecuadorGoogle, ecuadorBing, ecuadorHybrid,
    quitoGoogle, quitoBing, quitoHybrid,
    pedernalesGoogle, pedernalesBing, pedernalesHybrid,
    launchBeachGoogle, launchBeachBing, launchBeachHybrid,
  ]);

  // ===== GEOMETRY WITH HEIGHTMAP DISPLACEMENT =====

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(region.width, region.height, segments, segments);
    
    // Read heightmap pixels
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !heightTexture.image) return geo;

    const img = heightTexture.image as HTMLImageElement;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const positions = geo.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;

    // Displace vertices based on heightmap
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      
      // UV coordinates
      const u = (x / region.width + 0.5);
      const v = (y / region.height + 0.5);
      
      // Pixel coordinates
      const px = Math.floor(u * (canvas.width - 1));
      const py = Math.floor((1 - v) * (canvas.height - 1));
      
      // Get height value (white = high, black = low, 254+ = water/zero)
      const pixelIndex = (py * canvas.width + px) * 4;
      const rawValue = pixels[pixelIndex];
      const heightValue = rawValue >= 254 ? 0 : rawValue / 254;
      
      positions[i * 3 + 2] = heightValue * effectiveElevation;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [region.width, region.height, segments, effectiveElevation, heightTexture]);

  // ===== PROCEDURAL DETAIL TEXTURE =====

  const detailTexture = useMemo(() => {
    const rand = createSeededRandom(1337);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add noise for surface detail
      for (let i = 0; i < 50000; i++) {
        const x = rand() * 512;
        const y = rand() * 512;
        const gray = Math.floor(rand() * 50) + 100;
        ctx.fillStyle = `rgba(${gray},${gray},${gray},0.1)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
  }, []);

  // ===== MATERIAL =====

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

  // Trigger re-render when textures change
  useEffect(() => {
    invalidate();
  }, [colorTexture, heightTexture, invalidate]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      castShadow
      receiveShadow
    />
  );
}

export default TerrainMesh;
