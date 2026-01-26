/**
 * OrbitGlobe.tsx - Globe visualization with satellite
 * 
 * EXACTLY MATCHES YawSteeringLab.tsx CONVENTIONS:
 * 
 * LAB COORDINATE SYSTEM (Three.js):
 * - Orbit in XZ plane, Y is up (north pole)
 * - Position at nu: [r*cos(nu), 0, r*sin(nu)]
 * - Velocity at nu: [-sin(nu), 0, cos(nu)]
 * - When nu increases 0→360, satellite moves counterclockwise (EAST)
 * 
 * This component receives ECI coordinates from OrbitScene and transforms
 * them to match the lab's Three.js coordinate system exactly.
 */

import { useEffect, useMemo, useRef } from 'react';
import Globe from 'react-globe.gl';
import type { GlobeMethods } from 'react-globe.gl';
import { Group, Object3D, Vector3, DirectionalLight, AmbientLight } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSatelliteController } from './SatelliteModel';

export interface OrbitPoint {
  lat: number;
  lng: number;
  alt: number;
}

export interface OrbitSatelliteData {
  lat: number;
  lng: number;
  alt: number;
  yawRad: number;
  panelAngleRad: number;
  nuRad: number; // True anomaly - the key parameter!
}

interface OrbitGlobeProps {
  orbitPath: OrbitPoint[];
  satellite: OrbitSatelliteData;
  orbitRadius: number; // in meters
  sun: { lat: number; lng: number; alt: number };
  sunVectorEci: [number, number, number];
  onGlobeClick: (coords: { lat: number; lng: number }) => void;
}

const sunLoader = new GLTFLoader();
let cachedSunScene: Object3D | null = null;
let sunPromise: Promise<Object3D> | null = null;

async function loadSunScene(modelUrl: string): Promise<Object3D> {
  if (cachedSunScene) return cachedSunScene;
  if (!sunPromise) {
    sunPromise = sunLoader.loadAsync(modelUrl).then((gltf) => {
      cachedSunScene = gltf.scene;
      return gltf.scene;
    });
  }
  return sunPromise;
}

// Earth radius in meters
const R_EARTH = 6378137;
const GLOBE_RADIUS = 100; // react-globe.gl default

export function OrbitGlobe({ orbitPath, satellite, orbitRadius, sun, sunVectorEci, onGlobeClick }: OrbitGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const controller = useMemo(() => createSatelliteController('/models/satellite_replace.glb'), []);
  
  const sunObject = useMemo(() => {
    const root = new Group();
    root.scale.setScalar(0.8);
    void loadSunScene('/models/sun.glb').then((scene) => {
      root.add(scene.clone(true));
    });
    return root;
  }, []);

  const pathsData = useMemo(() => [{ points: orbitPath }], [orbitPath]);

  // Satellite Scene Management
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    
    const scene = globe.scene();
    scene.add(controller.object);

    return () => {
      scene.remove(controller.object);
    };
  }, [controller]);

  // Satellite Update Loop - EXACTLY LIKE YawSteeringLab.tsx lines 314-420
  useEffect(() => {
    const worldScale = GLOBE_RADIUS / R_EARTH;
    const nuRad = satellite.nuRad;
    const r = orbitRadius;
    
    // ========================================================================
    // POSITION & VELOCITY - FIXED FOR GLOBE.GL COORDINATE SYSTEM
    // ========================================================================
    
    // Globe.gl has a mirrored Z axis compared to our lab
    // To go EAST (prograde), we negate Z:
    // - Position: [r*cos(nu), 0, -r*sin(nu)]
    // - Velocity: [-sin(nu), 0, -cos(nu)]
    
    const positionGlobe = new Vector3(
      r * Math.sin(nuRad),
      0,
      r * Math.cos(nuRad)
    );
    
    // Velocity tangent (derivative w.r.t. nu)
    const velocityGlobe = new Vector3(
      Math.cos(nuRad),
      0,
      -Math.sin(nuRad)
    ).normalize();
    
    // Scale position for rendering
    const positionScaled = positionGlobe.clone().multiplyScalar(worldScale);

    // ========================================================================
    // UPDATE CONTROLLER - Same as lab lines 362-408
    // ========================================================================
    controller.update({
      positionGlobe: positionGlobe,
      velocityGlobe: velocityGlobe,
      yawRad: satellite.yawRad,
      panelAngleRad: satellite.panelAngleRad,
    });

    // Set position
    controller.object.position.copy(positionScaled);

  }, [controller, satellite, orbitRadius]);

  // Lighting Update
  useEffect(() => {
    if (!globeRef.current) return;
    const scene = globeRef.current.scene();
    
    // Sun Light
    let sunLight = scene.getObjectByName('SUN_DIRECTIONAL_LIGHT') as DirectionalLight;
    if (!sunLight) {
        sunLight = new DirectionalLight(0xffffff, 2.5);
        sunLight.name = 'SUN_DIRECTIONAL_LIGHT';
        scene.add(sunLight);
    }

    // Sun direction in Globe.gl coords (same transform as lab: x->x, z->y, y->z)
    const [sx, sy, sz] = sunVectorEci;
    const sunGlobe = new Vector3(sy, sz, sx);
    sunLight.position.copy(sunGlobe.multiplyScalar(10000));

    // Ambient Light
    let ambient = scene.getObjectByName('SCENE_AMBIENT') as AmbientLight;
    if (!ambient) {
        ambient = new AmbientLight(0x404040, 1.0);
        ambient.name = 'SCENE_AMBIENT';
        scene.add(ambient);
    }
  }, [sunVectorEci]);


  return (
    <Globe
      ref={globeRef}
      backgroundColor="#000000"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      onGlobeClick={(coords) => onGlobeClick(coords)}
      objectsData={[]} 
      customLayerData={[{ ...sun }]}
      customThreeObject={sunObject}
      customThreeObjectUpdate={(obj: Object3D, d: object) => {
        const globe = globeRef.current;
        if (!globe) return;
        const datum = d as { lat: number; lng: number; alt: number };
        const c = globe.getCoords(datum.lat, datum.lng, datum.alt);
        obj.position.set(c.x, c.y, c.z);
      }}
      pathsData={pathsData}
      pathPoints="points"
      pathPointLat={(p: OrbitPoint) => p.lat}
      pathPointLng={(p: OrbitPoint) => p.lng}
      pathPointAlt={(p: OrbitPoint) => p.alt}
      pathColor={() => 'rgba(120, 200, 255, 0.8)'}
      pathStroke={1}
      pathDashLength={0.2}
      pathDashGap={0.08}
      pathDashAnimateTime={4000}
    />
  );
}
