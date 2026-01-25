/**
 * SatelliteModel.ts - Satellite 3D Model Controller with Verified Physics
 * 
 * This module handles loading and animating the satellite GLB model with correct
 * attitude physics for yaw steering and solar panel tracking.
 * 
 * PHYSICS REFERENCE:
 * ==================
 * 
 * LVLH Frame Definition (Local Vertical, Local Horizontal):
 * - Z_LVLH (Nadir): Points toward Earth center (-r_hat)
 * - X_LVLH (Velocity): Points along velocity direction (v_hat)
 * - Y_LVLH (Neg-Normal): Z × X (South for equatorial prograde orbit)
 * 
 * Body Frame (after yaw rotation around Nadir):
 * - Xb: cos(ψ)·Xl + sin(ψ)·Yl
 * - Yb: -sin(ψ)·Xl + cos(ψ)·Yl  
 * - Zb: Zl (same as LVLH Z, Nadir)
 * 
 * Coordinate Systems:
 * - ECI (Earth-Centered Inertial): X toward vernal equinox, Z toward North Pole
 * - Globe.gl World: Uses (X_world = X_eci, Y_world = Z_eci, Z_world = Y_eci)
 * 
 * The satellite orientation is computed in ECI frame and then transformed to 
 * globe.gl world coordinates for rendering.
 */

import { Euler, Group, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SatelliteController {
  object: Group;
  update: (params: {
    positionEciM: Vector3;
    velocityEciMps: Vector3;
    sunDir?: Vector3;
    yawRad: number;
    panelAngleRad: number;
  }) => void;
}

const loader = new GLTFLoader();
let cachedSatelliteScene: Object3D | null = null;
let cachePromise: Promise<Object3D> | null = null;

/**
 * Model alignment quaternion.
 *
 * The attitude math constructs a body frame where:
 * - +X = velocity direction
 * - +Z = nadir
 *
 * The raw GLB isn't authored in that convention, so we apply a fixed
 * alignment rotation (derived in `ModelDebugTest`).
 */
const MODEL_ALIGNMENT_EULER = new Euler(Math.PI / 2, 0, Math.PI, 'XYZ'); // (90°, 0°, 180°)
const MODEL_ALIGNMENT_QUAT = new Quaternion().setFromEuler(MODEL_ALIGNMENT_EULER);

// Solar array drive axis (SADA) in the model's local space.
// Verified visually: `Object_56` rotates correctly around local X.
const PANEL_ROT_AXIS: 'x' | 'y' | 'z' = 'x';
const PANEL_ANGLE_SIGN = 1;
const PANEL_ANGLE_OFFSET_RAD = 0;

async function loadSatelliteScene(modelUrl: string): Promise<Object3D> {
  if (cachedSatelliteScene) return cachedSatelliteScene;
  if (!cachePromise) {
    cachePromise = loader.loadAsync(modelUrl).then((gltf) => {
      cachedSatelliteScene = gltf.scene;
      return gltf.scene;
    });
  }
  return cachePromise;
}

/**
 * Build the body frame quaternion from position, velocity, and yaw angle.
 * 
 * This is the core attitude computation that determines how the satellite
 * should be oriented in 3D space based on:
 * 1. Its position (determines nadir direction)
 * 2. Its velocity (determines forward/velocity direction)
 * 3. The yaw angle (rotation around nadir for sun tracking)
 * 
 * @param positionGlobe - Position vector in globe.gl world frame (unit: globe units)
 * @param velocityGlobe - Velocity vector in globe.gl world frame
 * @param yawRad - Yaw steering angle in radians
 * @returns Quaternion representing the satellite body orientation
 */
function buildBodyQuaternion(
  positionGlobe: Vector3,
  velocityGlobe: Vector3,
  yawRad: number
): Quaternion {
  // Calculate LVLH basis vectors in globe.gl world frame
  const rHat = positionGlobe.clone().normalize();

  // Z_LVLH = -r_hat (Nadir, pointing toward Earth center)
  const zL = rHat.clone().multiplyScalar(-1);

  // X_LVLH = v_hat (Velocity direction, normalized)
  const xL = velocityGlobe.clone().normalize();

  // Y_LVLH = Z × X (completes right-handed system)
  // For equatorial prograde orbit, this points South
  const yL = new Vector3().crossVectors(zL, xL).normalize();

  // Apply yaw rotation around Z_LVLH (Nadir axis)
  const cosPsi = Math.cos(yawRad);
  const sinPsi = Math.sin(yawRad);

  // Body frame axes after yaw rotation
  // Xb = cos(ψ)·Xl + sin(ψ)·Yl
  const xB = xL.clone().multiplyScalar(cosPsi)
    .add(yL.clone().multiplyScalar(sinPsi))
    .normalize();

  // Yb = -sin(ψ)·Xl + cos(ψ)·Yl
  const yB = xL.clone().multiplyScalar(-sinPsi)
    .add(yL.clone().multiplyScalar(cosPsi))
    .normalize();

  // Zb = Zl (unchanged, still pointing nadir)
  const zB = zL.clone();

  // Create rotation matrix with body axes as columns
  // This matrix transforms from body frame to world frame
  const rotMatrix = new Matrix4().makeBasis(xB, yB, zB);

  return new Quaternion().setFromRotationMatrix(rotMatrix);
}

export function createSatelliteController(
  modelUrl = '/models/satellite_replace.glb'
): SatelliteController {
  const root = new Group();

  // Scale tuned for globe.gl default radius (~100 units for Earth)
  // Satellite should be visible but not too large
  root.scale.setScalar(0.8);

  let solarPanels: Object3D | null = null;
  let connections: Object3D | null = null;

  void loadSatelliteScene(modelUrl).then((scene) => {
    const cloned = scene.clone(true);

    // Apply model alignment to correct for GLB orientation
    cloned.quaternion.multiply(MODEL_ALIGNMENT_QUAT);

    // Find animatable parts by name
    // These names were discovered by inspecting the model in the test scene
    solarPanels =
      cloned.getObjectByName('Solar_Panels_28') ??
      cloned.getObjectByName('Object_56') ??
      null;

    connections =
      cloned.getObjectByName('Object_55') ??
      null;

    if (!solarPanels) {
      console.warn('SatelliteModel: Solar panels not found in model');
    }
    if (!connections) {
      console.warn('SatelliteModel: Connections not found in model');
    }

    root.add(cloned);
  });

  return {
    object: root,
    update: ({ positionEciM, velocityEciMps, yawRad, panelAngleRad }) => {
      // 1. Build body orientation quaternion
      // Note: positionEciM and velocityEciMps are already in globe.gl world coordinates
      // (transformed by the caller in OrbitGlobe.tsx)
      const bodyQuat = buildBodyQuaternion(positionEciM, velocityEciMps, yawRad);
      root.quaternion.copy(bodyQuat);

      // 2. Animate solar panels
      // The panels rotate around the body Y-axis (SADA axis) to track the sun
      // Testing confirmed the correct rotation axis for this model is `PANEL_ROT_AXIS`.
      if (solarPanels) {
        const a = PANEL_ANGLE_OFFSET_RAD + PANEL_ANGLE_SIGN * panelAngleRad;
        if (PANEL_ROT_AXIS === 'x') solarPanels.rotation.x = a;
        else if (PANEL_ROT_AXIS === 'y') solarPanels.rotation.y = a;
        else solarPanels.rotation.z = a;
      }

      // Connections (hinges) rotate with panels
      if (connections) {
        const a = PANEL_ANGLE_OFFSET_RAD + PANEL_ANGLE_SIGN * panelAngleRad;
        if (PANEL_ROT_AXIS === 'x') connections.rotation.x = a;
        else if (PANEL_ROT_AXIS === 'y') connections.rotation.y = a;
        else connections.rotation.z = a;
      }

    },
  };
}
