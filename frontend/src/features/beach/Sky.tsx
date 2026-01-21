import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Color,
  BackSide,
  ShaderMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  AdditiveBlending,
} from 'three';

import type { AmbientLight, DirectionalLight, HemisphereLight } from 'three';

import { useSimulationStore } from '../../stores/simulationStore';
import { interpolateValue } from '../../utils/coordinateTransform';

interface DaytimeSkyProps {
  sunPosition?: Vector3;
}

interface AscentLightProps {
  position?: [number, number, number];
  intensity?: number;
}

export function AscentLight({
  position = [100, 80, -50],
  intensity = 2.0,
}: AscentLightProps) {
  const { launchData, animationTime, currentScene, isPlaying } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const ambientRef = useRef<AmbientLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const dirRef = useRef<DirectionalLight>(null);

  useFrame(() => {
    if (!trajectory || currentScene !== 'launch' || !isPlaying) return;
    const altitudeM = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);

    const fadeStartM = 20000;
    const fadeEndM = 120000;
    const spaceFactor = smoothstep01((altitudeM - fadeStartM) / (fadeEndM - fadeStartM));

    if (ambientRef.current) {
      ambientRef.current.intensity = (1 - spaceFactor) * 0.5;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = (1 - spaceFactor) * 0.8;
    }
    if (dirRef.current) {
      dirRef.current.intensity = intensity;
    }
  });

  return (
    <>
      <directionalLight
        ref={dirRef}
        position={position}
        intensity={intensity}
        color="#fffdf0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={6000}
        shadow-camera-left={-2000}
        shadow-camera-right={2000}
        shadow-camera-top={2000}
        shadow-camera-bottom={-2000}
        shadow-bias={-0.0001}
      />
      <ambientLight ref={ambientRef} intensity={0.5} color="#b3d9ff" />
      <hemisphereLight
        ref={hemiRef}
        color="#87ceeb"
        groundColor="#ada291"
        intensity={0.8}
      />
    </>
  );
}

/**
 * Daytime blue sky with sun and clouds
 * Creates a bright, clear blue sky typical of Ecuador coast
 */
export function DaytimeSky({ sunPosition = new Vector3(100, 80, -50) }: DaytimeSkyProps) {
  // Daytime sky shader
  const uniforms = useMemo(() => ({
    topColor: { value: new Color(0x0077be) },      // Deep sky blue
    horizonColor: { value: new Color(0x87ceeb) },  // Light sky blue
    bottomColor: { value: new Color(0xadd8e6) },   // Very light blue
    sunPosition: { value: sunPosition.clone().normalize() },
    sunColor: { value: new Color(0xffffcc) },      // Bright white-yellow sun
    offset: { value: 20 },
    exponent: { value: 0.4 },
  }), [sunPosition]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          uniform vec3 sunPosition;
          uniform vec3 sunColor;
          uniform float offset;
          uniform float exponent;
          
          varying vec3 vWorldPosition;
          
          void main() {
            float h = normalize(vWorldPosition + offset).y;
            
            vec3 skyColor;
            if (h > 0.0) {
              skyColor = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
            } else {
              skyColor = mix(horizonColor, bottomColor, pow(abs(h), 0.3));
            }
            
            vec3 sunDir = normalize(sunPosition);
            vec3 viewDir = normalize(vWorldPosition);
            float sunAngle = dot(viewDir, sunDir);
            
            float sunDisc = smoothstep(0.9995, 0.9999, sunAngle);
            float sunGlow = pow(max(0.0, sunAngle), 64.0) * 0.3;
            float sunHalo = pow(max(0.0, sunAngle), 16.0) * 0.15;
            
            vec3 finalColor = skyColor;
            finalColor += sunColor * sunGlow;
            finalColor += vec3(1.0, 1.0, 0.9) * sunHalo;
            finalColor = mix(finalColor, vec3(1.0, 1.0, 0.95), sunDisc);
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        side: BackSide,
        depthWrite: false,
      }),
    [uniforms]
  );

  return (
    <mesh material={material}>
      <sphereGeometry args={[100000, 64, 64]} />
    </mesh>
  );
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash01(n: number): number {
  return fract(Math.sin(n) * 43758.5453123);
}

function smoothstep01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export function AscentSky({ sunPosition = new Vector3(100, 80, -50) }: DaytimeSkyProps) {
  const { launchData, animationTime, currentScene, isPlaying } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const uniforms = useMemo(() => ({
    topColor: { value: new Color(0x0077be) },
    horizonColor: { value: new Color(0x87ceeb) },
    bottomColor: { value: new Color(0xadd8e6) },
    sunPosition: { value: sunPosition.clone().normalize() },
    sunColor: { value: new Color(0xffffcc) },
    offset: { value: 20 },
    exponent: { value: 0.4 },
  }), [sunPosition]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          uniform vec3 sunPosition;
          uniform vec3 sunColor;
          uniform float offset;
          uniform float exponent;
          
          varying vec3 vWorldPosition;
          
          void main() {
            float h = normalize(vWorldPosition + offset).y;
            
            vec3 skyColor;
            if (h > 0.0) {
              skyColor = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
            } else {
              skyColor = mix(horizonColor, bottomColor, pow(abs(h), 0.3));
            }
            
            vec3 sunDir = normalize(sunPosition);
            vec3 viewDir = normalize(vWorldPosition);
            float sunAngle = dot(viewDir, sunDir);
            
            float sunDisc = smoothstep(0.9995, 0.9999, sunAngle);
            float sunGlow = pow(max(0.0, sunAngle), 64.0) * 0.3;
            float sunHalo = pow(max(0.0, sunAngle), 16.0) * 0.15;
            
            vec3 finalColor = skyColor;
            finalColor += sunColor * sunGlow;
            finalColor += vec3(1.0, 1.0, 0.9) * sunHalo;
            finalColor = mix(finalColor, vec3(1.0, 1.0, 0.95), sunDisc);
            
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        side: BackSide,
        depthWrite: false,
      }),
    [uniforms]
  );

  useFrame(() => {
    if (!trajectory || currentScene !== 'launch' || !isPlaying) return;
    const altitudeM = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);

    const fadeStartM = 15000;
    const fadeEndM = 110000;
    const spaceFactor = smoothstep01((altitudeM - fadeStartM) / (fadeEndM - fadeStartM));

    const dayTop = new Color(0x0077be);
    const dayHorizon = new Color(0x87ceeb);
    const dayBottom = new Color(0xadd8e6);

    const spaceTop = new Color(0x000008);
    const spaceHorizon = new Color(0x000000);
    const spaceBottom = new Color(0x000000);

    uniforms.topColor.value.copy(dayTop).lerp(spaceTop, spaceFactor);
    uniforms.horizonColor.value.copy(dayHorizon).lerp(spaceHorizon, spaceFactor);
    uniforms.bottomColor.value.copy(dayBottom).lerp(spaceBottom, spaceFactor);
  });

  return (
    <mesh material={material}>
      <sphereGeometry args={[100000, 64, 64]} />
    </mesh>
  );
}

interface DaytimeLightProps {
  position?: [number, number, number];
  intensity?: number;
}

/**
 * Daytime directional light - bright white sunlight
 */
export function DaytimeLight({ 
  position = [100, 80, -50], 
  intensity = 2.0
}: DaytimeLightProps) {
  return (
    <>
      {/* Main sun light - bright white */}
      <directionalLight
        position={position}
        intensity={intensity}
        color="#fffdf0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={6000}
        shadow-camera-left={-2000}
        shadow-camera-right={2000}
        shadow-camera-top={2000}
        shadow-camera-bottom={-2000}
        shadow-bias={-0.0001}
      />
      {/* Ambient light - slight blue tint from sky */}
      <ambientLight intensity={0.5} color="#b3d9ff" />
      {/* Hemisphere light - blue sky, brown ground */}
      <hemisphereLight
        color="#87ceeb"
        groundColor="#ada291"
        intensity={0.8}
      />
    </>
  );
}

interface CloudsProps {
  count?: number;
}

/**
 * White fluffy clouds for daytime sky
 */
export function DaytimeClouds({ count = 20 }: CloudsProps) {
  return <AscentClouds count={count} />;
}

interface AscentCloudsProps {
  count?: number;
}

export function AscentClouds({ count = 20 }: AscentCloudsProps) {
  const { launchData, animationTime, currentScene, isPlaying } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const clouds = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const a = hash01(i * 12.13 + 1.0);
      const b = hash01(i * 19.87 + 2.0);
      const c = hash01(i * 27.41 + 3.0);
      const d = hash01(i * 33.77 + 4.0);
      const e = hash01(i * 41.11 + 5.0);
      const f = hash01(i * 55.59 + 6.0);

      const x = (a - 0.5) * 800;
      const y = 300 + b * 350;
      const z = -500 + c * 100;
      const scaleX = 25 + d * 50;
      const scaleY = 8 + e * 12;
      const scaleZ = 25 + f * 40;
      items.push({ x, y, z, scaleX, scaleY, scaleZ, key: i });
    }
    return items;
  }, [count]);

  const [cloudOpacity, setCloudOpacity] = useState(0.6);

  const eps = 1e-3;

  useFrame(() => {
    let desired = 0.6;

    if (trajectory && currentScene === 'launch' && isPlaying) {
      const altitudeM = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);
      const fadeStartM = 8000;
      const fadeEndM = 25000;
      const t = smoothstep01((altitudeM - fadeStartM) / (fadeEndM - fadeStartM));
      desired = (1 - t) * 0.6;
    }

    setCloudOpacity((prev) => (Math.abs(prev - desired) < eps ? prev : desired));
  });

  return (
    <group>
      {clouds.map((cloud) => (
        <mesh 
          key={cloud.key} 
          position={[cloud.x, cloud.y, cloud.z]}
          scale={[cloud.scaleX, cloud.scaleY, cloud.scaleZ]}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial 
            color="#ffffff" 
            transparent 
            opacity={cloudOpacity} 
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

interface SpaceStarsProps {
  count?: number;
}

export function SpaceStars({ count = 2500 }: SpaceStarsProps) {
  const { launchData, animationTime, currentScene, isPlaying } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const [opacity, setOpacity] = useState(0.0);

  const eps = 1e-3;

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = hash01(i * 12.9898 + 10.0);
      const v = hash01(i * 78.233 + 20.0);
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const radius = 80000 + hash01(i * 39.425 + 30.0) * 15000;

      positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useFrame(() => {
    let desired = 0.0;

    if (trajectory && currentScene === 'launch' && isPlaying) {
      const altitudeM = interpolateValue(trajectory.t_s, trajectory.h_m, animationTime);
      const fadeStartM = 40000;
      const fadeEndM = 120000;
      desired = smoothstep01((altitudeM - fadeStartM) / (fadeEndM - fadeStartM));
    }

    setOpacity((prev) => (Math.abs(prev - desired) < eps ? prev : desired));
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color={0xffffff}
        size={2.0}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

// Keep old exports as aliases for compatibility
export { DaytimeSky as SunsetSky };
export { DaytimeLight as SunsetLight };
export { DaytimeClouds as SunsetClouds };
