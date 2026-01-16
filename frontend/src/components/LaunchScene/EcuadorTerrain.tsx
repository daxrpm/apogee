import { useMemo, useRef, useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { TextureLoader, PlaneGeometry, Mesh, MeshStandardMaterial, DoubleSide, RepeatWrapping, CanvasTexture } from 'three';
import type { Texture } from 'three';

// ============ TYPES ============

export type RegionId = 'ecuador' | 'quito';
export type TextureOption = 'google' | 'bing' | 'google_hybrid';

export interface RegionConfig {
  id: RegionId;
  label: string;
  width: number;
  height: number;
}

export interface TextureConfig {
  id: TextureOption;
  label: string;
}

// ============ REGION CONFIGURATIONS ============

export const REGIONS: RegionConfig[] = [
  { id: 'ecuador', label: '🇪🇨 Ecuador', width: 12, height: 7.22 },
  { id: 'quito', label: '🏙️ Quito', width: 12, height: 7.22 },
];

export const TEXTURE_OPTIONS: TextureConfig[] = [
  { id: 'google', label: 'Google Satellite' },
  { id: 'bing', label: 'Bing Satellite' },
  { id: 'google_hybrid', label: 'Google Hybrid' },
];

// ============ TERRAIN COMPONENT ============

interface TerrainMeshProps {
  regionId: RegionId;
  textureId: TextureOption;
  segments?: number;
  maxElevation?: number;
}

/**
 * TerrainMesh - 3D terrain with multi-region and multi-texture support
 */
export function TerrainMesh({
  regionId,
  textureId,
  segments = 256,
  maxElevation = 0.8,
}: TerrainMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const { invalidate } = useThree();

  // Get region config
  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0];

  // ===== LOAD ALL TEXTURES UPFRONT (hooks must be called unconditionally) =====
  
  // Ecuador textures
  const ecuadorHeight = useLoader(TextureLoader, '/assets/ecuador_height.png');
  const ecuadorGoogle = useLoader(TextureLoader, '/assets/ecuador_color_google_sat.png');
  const ecuadorBing = useLoader(TextureLoader, '/assets/ecuador_color_bing_sat.png');
  const ecuadorHybrid = useLoader(TextureLoader, '/assets/ecuador_color_google_sat_hy.png');

  // Quito textures  
  const quitoHeight = useLoader(TextureLoader, '/assets/quito_height.png');
  const quitoGoogle = useLoader(TextureLoader, '/assets/quito_color_google_sat.png');
  const quitoBing = useLoader(TextureLoader, '/assets/quito_color_bing_sat.png');
  const quitoHybrid = useLoader(TextureLoader, '/assets/quito_color_google_sat_hy.png');

  // ===== SELECT ACTIVE TEXTURES BASED ON PROPS =====
  
  const heightTexture: Texture = regionId === 'quito' ? quitoHeight : ecuadorHeight;
  
  const colorTexture: Texture = useMemo(() => {
    if (regionId === 'quito') {
      switch (textureId) {
        case 'bing': return quitoBing;
        case 'google_hybrid': return quitoHybrid;
        default: return quitoGoogle;
      }
    } else {
      switch (textureId) {
        case 'bing': return ecuadorBing;
        case 'google_hybrid': return ecuadorHybrid;
        default: return ecuadorGoogle;
      }
    }
  }, [regionId, textureId, ecuadorGoogle, ecuadorBing, ecuadorHybrid, quitoGoogle, quitoBing, quitoHybrid]);

  // Create geometry with displaced vertices
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(region.width, region.height, segments, segments);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !heightTexture.image) return geo;

    const img = heightTexture.image as HTMLImageElement;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const positions = geo.attributes.position.array as Float32Array;
    const vertexCount = positions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      
      const u = (x / region.width + 0.5);
      const v = (y / region.height + 0.5);
      
      const px = Math.floor(u * (canvas.width - 1));
      const py = Math.floor((1 - v) * (canvas.height - 1));
      
      const pixelIndex = (py * canvas.width + px) * 4;
      const rawValue = pixels[pixelIndex];
      
      let heightValue: number;
      if (rawValue >= 254) {
        heightValue = 0;
      } else {
        heightValue = rawValue / 254;
      }
      
      positions[i * 3 + 2] = heightValue * maxElevation;
    }

    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, [region.width, region.height, segments, maxElevation, heightTexture]);

  // Create procedural detail texture
  const detailTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 50000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const gray = Math.floor(Math.random() * 50) + 100;
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

  // Create material
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

// ============ LEGACY EXPORT =============

interface EcuadorTerrainProps {
  width?: number;
  height?: number;
  segments?: number;
  maxElevation?: number;
  autoRotate?: boolean;
  textureId?: TextureOption;
}

export function EcuadorTerrain(props: EcuadorTerrainProps) {
  return (
    <TerrainMesh
      regionId="ecuador"
      textureId={props.textureId || 'google'}
      segments={props.segments}
      maxElevation={props.maxElevation}
    />
  );
}
