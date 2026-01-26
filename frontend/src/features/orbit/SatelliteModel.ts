/**
 * SatelliteModel.ts - Satellite 3D Model Controller
 * 
 * EXACTLY MATCHES YawSteeringLab.tsx CONVENTIONS
 */

import { Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SatelliteController {
  object: Group;
  update: (params: {
    positionGlobe: Vector3;
    velocityGlobe: Vector3;
    yawRad: number;
    panelAngleRad: number;
  }) => void;
}

/**
 * Base rotation to align model axes with body frame:
 * - Rotate 90 degrees around Z axis
 * - This transforms: Model X -> Body Y (SADA axis for panels)
 */
const MODEL_BASE_ROTATION = new Quaternion().setFromAxisAngle(
  new Vector3(0, 0, 1),
  Math.PI / 2
);

/**
 * Build body frame quaternion - EXACTLY as in YawSteeringLab.tsx lines 341-400
 */
function buildBodyQuaternion(
  positionGlobe: Vector3,
  velocityGlobe: Vector3,
  yawRad: number
): Quaternion {
  const rHat = positionGlobe.clone().normalize();
  const zLVLH = rHat.clone().multiplyScalar(-1); // Nadir
  const xLVLH = velocityGlobe.clone().normalize(); // Velocity
  let yLVLH = new Vector3().crossVectors(zLVLH, xLVLH).normalize(); // South

  const det = xLVLH.dot(new Vector3().crossVectors(yLVLH, zLVLH));
  if (det < 0) yLVLH = yLVLH.multiplyScalar(-1);

  if (yLVLH.dot(new Vector3(0, 1, 0)) > 0) yLVLH = yLVLH.multiplyScalar(-1);

  const cosPsi = Math.cos(yawRad);
  const sinPsi = Math.sin(yawRad);

  const xBody = xLVLH.clone().multiplyScalar(cosPsi)
    .add(yLVLH.clone().multiplyScalar(sinPsi))
    .normalize();

  const yBody = xLVLH.clone().multiplyScalar(-sinPsi)
    .add(yLVLH.clone().multiplyScalar(cosPsi))
    .normalize();

  const zBody = zLVLH.clone();

  const rotMatrix = new Matrix4().makeBasis(xBody, yBody, zBody);
  return new Quaternion().setFromRotationMatrix(rotMatrix);
}

export function createSatelliteController(
  modelUrl = '/models/satellite_replace.glb'
): SatelliteController {
  const root = new Group();
  root.scale.setScalar(4);

  // These will be set when model loads
  let modelLoaded = false;
  let satelliteBaseQuat: Quaternion | null = null;
  let solarPanels: Object3D | null = null;
  let solarPanelsBaseQuat: Quaternion | null = null;
  let connections: Object3D | null = null;
  let connectionsBaseQuat: Quaternion | null = null;

  // Create loader instance for this controller
  const loader = new GLTFLoader();

  // Load model
  loader.load(modelUrl, (gltf: { scene: Object3D }) => {
    const satellite = gltf.scene;

    satelliteBaseQuat = satellite.quaternion.clone();
    satellite.quaternion.identity();

    // Find solar panels - try multiple names
    solarPanels = satellite.getObjectByName('Solar_Panels_28')
      || satellite.getObjectByName('Object_56')
      || null;

    connections = satellite.getObjectByName('Object_55') || null;

    if (solarPanels) {
      solarPanelsBaseQuat = solarPanels.quaternion.clone();
      console.log('SatelliteModel: Found solar panels:', solarPanels.name);
    } else {
      console.warn('SatelliteModel: Solar panels not found!');
      // List all objects for debugging
      satellite.traverse((obj: Object3D) => {
        console.log('  Object:', obj.name, obj.type);
      });
    }

    if (connections) {
      connectionsBaseQuat = connections.quaternion.clone();
    }

    root.add(satellite);
    modelLoaded = true;
  });

  return {
    object: root,
    update: ({ positionGlobe, velocityGlobe, yawRad, panelAngleRad }) => {
      if (!modelLoaded) return;

      // 1. Build body orientation quaternion
      const bodyQuat = buildBodyQuaternion(positionGlobe, velocityGlobe, yawRad);

      // 2. Apply base rotation to align model with body frame
      if (satelliteBaseQuat) {
        root.quaternion.copy(bodyQuat).multiply(satelliteBaseQuat);
      } else {
        root.quaternion.copy(bodyQuat).multiply(MODEL_BASE_ROTATION);
      }

      // 3. Animate solar panels
      if (solarPanels && solarPanelsBaseQuat) {
        const panelAxis = new Vector3(1, 0, 0);
        const panelQuat = new Quaternion().setFromAxisAngle(panelAxis, panelAngleRad);
        solarPanels.quaternion.copy(solarPanelsBaseQuat).multiply(panelQuat);

        // Detailed debug logging
        if (Math.random() < 0.02) {
          console.log('=== PANEL DEBUG ===');
          console.log('panelAngleRad:', panelAngleRad.toFixed(3), 'rad =', (panelAngleRad * 180 / Math.PI).toFixed(1), '°');
          console.log('baseQuat:', solarPanelsBaseQuat.x.toFixed(3), solarPanelsBaseQuat.y.toFixed(3), solarPanelsBaseQuat.z.toFixed(3), solarPanelsBaseQuat.w.toFixed(3));
          console.log('rotQuat:', panelQuat.x.toFixed(3), panelQuat.y.toFixed(3), panelQuat.z.toFixed(3), panelQuat.w.toFixed(3));
          console.log('finalQuat:', solarPanels.quaternion.x.toFixed(3), solarPanels.quaternion.y.toFixed(3), solarPanels.quaternion.z.toFixed(3), solarPanels.quaternion.w.toFixed(3));
          console.log('rotation.x:', solarPanels.rotation.x.toFixed(3), 'rad');
          console.log('panel visible:', solarPanels.visible);
          console.log('panel parent:', solarPanels.parent?.name || 'no parent');
        }
      }

      // Connections rotate with panels
      if (connections && connectionsBaseQuat) {
        const panelAxis = new Vector3(1, 0, 0);
        const panelQuat = new Quaternion().setFromAxisAngle(panelAxis, panelAngleRad);
        connections.quaternion.copy(connectionsBaseQuat).multiply(panelQuat);
      }
    },
  };
}
