import { useMemo } from 'react';
import { Vector3, Color, BackSide, ShaderMaterial } from 'three';

interface DaytimeSkyProps {
  sunPosition?: Vector3;
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

  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
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
      
      // Multi-gradient sky (blue tones)
      vec3 skyColor;
      if (h > 0.0) {
        skyColor = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
      } else {
        skyColor = mix(horizonColor, bottomColor, pow(abs(h), 0.3));
      }
      
      // Sun glow
      vec3 sunDir = normalize(sunPosition);
      vec3 viewDir = normalize(vWorldPosition);
      float sunAngle = dot(viewDir, sunDir);
      
      // Sun disc (bright white)
      float sunDisc = smoothstep(0.9995, 0.9999, sunAngle);
      
      // Sun glow (subtle for daytime)
      float sunGlow = pow(max(0.0, sunAngle), 64.0) * 0.3;
      float sunHalo = pow(max(0.0, sunAngle), 16.0) * 0.15;
      
      vec3 finalColor = skyColor;
      finalColor += sunColor * sunGlow;
      finalColor += vec3(1.0, 1.0, 0.9) * sunHalo;
      finalColor = mix(finalColor, vec3(1.0, 1.0, 0.95), sunDisc);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: BackSide,
      depthWrite: false,
    });
  }, [uniforms]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[5000, 64, 64]} />
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
  const clouds = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 800; // Wider spread
      const y = 300 + Math.random() * 350;   // Much higher in sky
      const z = -500 + Math.random() * 100;  // Further back range
      const scaleX = 25 + Math.random() * 50;
      const scaleY = 8 + Math.random() * 12;
      const scaleZ = 25 + Math.random() * 40;
      items.push({ x, y, z, scaleX, scaleY, scaleZ, key: i });
    }
    return items;
  }, [count]);

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
            opacity={0.6} 
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

// Keep old exports as aliases for compatibility
export { DaytimeSky as SunsetSky };
export { DaytimeLight as SunsetLight };
export { DaytimeClouds as SunsetClouds };
