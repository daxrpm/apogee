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
  positionEciM: [number, number, number];
  velocityEciMps: [number, number, number];
}

interface OrbitGlobeProps {
  orbitPath: OrbitPoint[];
  satellite: OrbitSatelliteData;
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

function eciVecToGlobeWorld(v: [number, number, number]): [number, number, number] {
  // globe.gl world axes correspond to:
  // x_world = x_eci, y_world = z_eci, z_world = y_eci
  const [x, y, z] = v;
  return [x, z, y];
}

// Earth radius in meters
const R_EARTH = 6378137;
const GLOBE_RADIUS = 100; // react-globe.gl default

export function OrbitGlobe({ orbitPath, satellite, sun, sunVectorEci, onGlobeClick }: OrbitGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  // Increase scale for visibility during debug? 0.8 is ~50km, plenty big.
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

  // Satellite Scene Management (Manual)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    
    // Add satellite to scene
    const scene = globe.scene();
    scene.add(controller.object);

    return () => {
      scene.remove(controller.object);
    };
  }, [controller]);

  // Satellite Update Loop
  useEffect(() => {
    // Coordinate Transform: ECI (x,y,z) -> GlobeWorld (x, z, y)
    // Scale: Meters -> Globe Units (100 / R_EARTH)
    
    const worldScale = GLOBE_RADIUS / R_EARTH;
    
    const [px, py, pz] = eciVecToGlobeWorld(satellite.positionEciM);
    const [vx, vy, vz] = eciVecToGlobeWorld(satellite.velocityEciMps);
    
    // Position vector in Globe World units
    const filePos = new Vector3(px, py, pz).multiplyScalar(worldScale);
    
    // Velocity vector (direction matters for orientation)
    const fileVel = new Vector3(vx, vy, vz);

    // Update Controller
    // Note: We pass the GlobeFrame vectors so the computed quaternion is in GlobeFrame.
    controller.update({
      positionEciM: new Vector3(px, py, pz), // Direction is what matters
      velocityEciMps: fileVel,
      yawRad: satellite.yawRad,
      panelAngleRad: satellite.panelAngleRad,
    });

    // Update Object Transform
    controller.object.position.copy(filePos);
    // controller.object.quaternion is already updated by controller.update()

  }, [controller, satellite]);

  // Lighting Update
  useEffect(() => {
    if (!globeRef.current) return;
    const scene = globeRef.current.scene();
    
    // Add Sun Light if missing
    let sunLight = scene.getObjectByName('SUN_DIRECTIONAL_LIGHT') as DirectionalLight;
    if (!sunLight) {
        sunLight = new DirectionalLight(0xffffff, 2.5);
        sunLight.name = 'SUN_DIRECTIONAL_LIGHT';
        scene.add(sunLight);
    }

    // Update Sun Light Position
    const [sx, sy, sz] = eciVecToGlobeWorld(sunVectorEci);
    // Place it far away in direction of sun
    sunLight.position.set(sx * 10000, sy * 10000, sz * 10000);

    // Add Ambient Light if missing for better fill
    let ambient = scene.getObjectByName('SCENE_AMBIENT') as AmbientLight;
    if (!ambient) {
        ambient = new AmbientLight(0x404040, 1.0); // Boost ambient
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
      // Removed objectsData for satellite, manually managed above
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
