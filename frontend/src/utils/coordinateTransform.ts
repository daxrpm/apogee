/**
 * Coordinate Transform Utilities
 * 
 * Converts between API trajectory coordinates and Three.js scene coordinates.
 * 
 * PHYSICS REFERENCE:
 * =================
 * 
 * API Coordinate System (Planar Polar, Earth-Centered):
 * - Origin: Earth center
 * - X axis: Initial radial direction (from Earth center through launch site)
 * - Y axis: Downrange direction (EAST, tangent to Earth surface)
 * - Z axis: 0 (equatorial plane, 2D trajectory)
 * 
 * pos_m.x = radial distance from Earth center [m]
 * pos_m.y = downrange distance from launch site [m]
 * pos_m.z = 0 (always, planar trajectory)
 * 
 * Three.js Scene Coordinate System (BeachScene):
 * - Origin: Launch pad on beach
 * - X axis: EAST (positive = toward mountains, rocket flight direction)
 * - Y axis: UP (positive = altitude above ground)
 * - Z axis: NORTH/SOUTH (unused for trajectory, z=0)
 * 
 * FLIGHT PATH ANGLE (γ - gamma):
 * ==============================
 * 
 * γ is the angle between velocity vector and local horizontal.
 * - γ = 90° (π/2 rad): Velocity pointing straight UP (vertical ascent)
 * - γ = 0°: Velocity pointing horizontal (orbital insertion)
 * - γ decreases from 90° to ~0° during ascent (gravity turn)
 * 
 * The rocket nose points in the direction of velocity (approximately).
 * 
 * ROCKET ORIENTATION MAPPING:
 * ===========================
 * 
 * The Falcon 9 GLB model has nose pointing in +Y direction (model space).
 * In Three.js scene, we want:
 * - Nose UP (+Y scene): rotation.z = 0
 * - Nose EAST (+X scene): rotation.z = -π/2
 * 
 * General formula:
 *   rotation.z = γ - π/2
 * 
 * Where γ is gamma_rad from the API.
 * 
 * When γ = π/2 (vertical): rotation.z = 0 → nose UP ✓
 * When γ = 0 (horizontal): rotation.z = -π/2 → nose EAST ✓
 */

export const R_EARTH = 6_371_000; // Earth radius in meters

/**
 * Scale factor for converting real-world meters to scene units.
 * 
 * SCENE ANALYSIS:
 * ===============
 * - Mountain at Y=40, scale=20 → visual height ~100 units
 * - Beach width: 200 units
 * - Camera initial position: [0, 60, 250]
 * 
 * TRAJECTORY SCALE:
 * =================
 * Using 1/500 scale:
 * - 10km altitude = 20 scene units (liftoff phase)
 * - 50km altitude = 100 scene units (passing mountains ~t=60s)
 * - 100km altitude = 200 scene units (Karman line)
 * - 200km altitude = 400 scene units (orbital)
 */
export const SCENE_SCALE = 1 / 10;

/**
 * Launch pad position in scene coordinates.
 * This is the origin for the rocket's initial position.
 */
export const PAD_POSITION = {
  x: 0,
  y: 2, // Slightly above ground
  z: 0,
};

/**
 * Converts API trajectory point to Three.js scene position.
 * 
 * @param apiX - Radial distance from Earth center [m] (pos_m.x from API)
 * @param apiY - Downrange distance [m] (pos_m.y from API)
 * @returns Three.js position [x, y, z] in scene units
 */
export function apiToScenePosition(
  apiX: number,
  apiY: number
): [number, number, number] {
  // Convert from geocentric to altitude
  const altitude_m = apiX - R_EARTH;

  // Apply scale and offset from pad position
  const sceneX = PAD_POSITION.x + apiY * SCENE_SCALE;  // Downrange → EAST

  // Add PAD_POSITION.y to ensure rocket starts at pad height, not at water level
  const sceneY = PAD_POSITION.y + altitude_m * SCENE_SCALE;  // Altitude → UP (already correct)
  const sceneZ = 0;

  return [sceneX, sceneY, sceneZ];
}

/**
 * Converts flight path angle (gamma) to rocket rotation.
 * 
 * @param gamma_rad - Flight path angle in radians (from API)
 * @returns Three.js Euler rotation [x, y, z] in radians
 * 
 * The rocket rotates around Z axis:
 * - γ = π/2 (90°, vertical): Z rotation = 0 → nose UP
 * - γ = 0 (horizontal): Z rotation = -π/2 → nose EAST
 */
export function gammaToRotation(gamma_rad: number): [number, number, number] {
  // Clamp gamma to valid range [0, π/2] for safety
  const gamma_clamped = Math.max(0, Math.min(Math.PI / 2, gamma_rad));

  // Rotation around Z axis
  const rotZ = gamma_clamped - Math.PI / 2;

  return [0, 0, rotZ];
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Catmull-Rom spline interpolation for smooth curves.
 * Uses 4 control points for cubic interpolation.
 * 
 * @param p0 - Point before start
 * @param p1 - Start point
 * @param p2 - End point  
 * @param p3 - Point after end
 * @param t - Interpolation factor [0, 1]
 * @returns Smoothly interpolated value
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom basis functions
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Finds the index in a sorted array where value would be inserted.
 * Uses binary search for efficiency with large arrays.
 */
export function findTimeIndex(times: number[], t: number): number {
  if (times.length === 0) return 0;
  if (t <= times[0]) return 0;
  if (t >= times[times.length - 1]) return times.length - 2;

  // Binary search
  let low = 0;
  let high = times.length - 1;

  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (times[mid] <= t) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Interpolates a trajectory value using Catmull-Rom spline.
 * Falls back to linear interpolation at boundaries.
 * 
 * @param times - Array of time points [s]
 * @param values - Array of values corresponding to times
 * @param t - Time to interpolate at [s]
 * @returns Smoothly interpolated value
 */
export function interpolateValue(
  times: number[],
  values: number[],
  t: number
): number {
  if (times.length === 0 || values.length === 0) return 0;
  if (times.length === 1) return values[0];
  if (t <= times[0]) return values[0];
  if (t >= times[times.length - 1]) return values[values.length - 1];

  const i = findTimeIndex(times, t);
  const t0 = times[i];
  const t1 = times[i + 1];
  const alpha = (t - t0) / (t1 - t0);

  // Use Catmull-Rom if we have enough points, otherwise linear
  if (i > 0 && i < times.length - 2) {
    return catmullRom(values[i - 1], values[i], values[i + 1], values[i + 2], alpha);
  }

  // Linear fallback at boundaries
  return lerp(values[i], values[i + 1], alpha);
}

/**
 * Interpolates position at a given time.
 * 
 * @param times - Array of time points [s]
 * @param posX - Array of X positions (radial) [m]
 * @param posY - Array of Y positions (downrange) [m]
 * @param t - Time to interpolate at [s]
 * @returns Interpolated scene position [x, y, z]
 */
export function interpolatePosition(
  times: number[],
  posX: number[],
  posY: number[],
  t: number
): [number, number, number] {
  const apiX = interpolateValue(times, posX, t);
  const apiY = interpolateValue(times, posY, t);
  return apiToScenePosition(apiX, apiY);
}

/**
 * Interpolates rotation at a given time.
 * 
 * @param times - Array of time points [s]
 * @param gammas - Array of flight path angles [rad]
 * @param t - Time to interpolate at [s]
 * @returns Interpolated rotation [x, y, z] in radians
 */
export function interpolateRotation(
  times: number[],
  gammas: number[],
  t: number
): [number, number, number] {
  const gamma = interpolateValue(times, gammas, t);
  return gammaToRotation(gamma);
}

/**
 * Gets the total duration of the trajectory.
 */
export function getTrajectoryDuration(times: number[]): number {
  if (times.length === 0) return 0;
  return times[times.length - 1] - times[0];
}

/**
 * Calculates approximate G-force from velocity derivative.
 * 
 * @param times - Time array [s]
 * @param velocities - Velocity array [m/s]
 * @param t - Current time [s]
 * @returns G-force (1G = 9.81 m/s²)
 */
export function calculateGForce(
  times: number[],
  velocities: number[],
  t: number
): number {
  const dt = 0.5; // Time step for numerical derivative
  const v1 = interpolateValue(times, velocities, Math.max(0, t - dt));
  const v2 = interpolateValue(times, velocities, t + dt);
  const dv = v2 - v1;
  const acceleration = dv / (2 * dt);

  // Include gravity (approximately 1G at surface, decreasing with altitude)
  const totalAcceleration = acceleration + 9.81;

  return Math.abs(totalAcceleration) / 9.81;
}
