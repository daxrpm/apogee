import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { interpolateValue, R_EARTH } from '../../utils/coordinateTransform';
import { OrbitGlobe, type OrbitPoint, type OrbitSatelliteData } from './OrbitGlobe';

/**
 * Convert ECI position to latitude/longitude/altitude
 * Standard ECI convention: X→vernal equinox, Y→90°E, Z→North pole
 */
function eciToLatLngAlt(pos: { x: number; y: number; z: number }): { lat: number; lng: number; alt: number } {
  const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
  if (r <= 0) return { lat: 0, lng: 0, alt: 0 };

  const lat = Math.asin(pos.z / r);
  const lng = Math.atan2(pos.y, pos.x);
  const alt = Math.max(0, (r - R_EARTH) / R_EARTH);

  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI, alt };
}

/**
 * Convert ECI unit vector to latitude/longitude
 */
function vecToLatLng(vec: [number, number, number]): { lat: number; lng: number } {
  const [x, y, z] = vec;
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r <= 0) return { lat: 0, lng: 0 };

  const lat = Math.asin(z / r);
  const lng = Math.atan2(y, x);
  
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/**
 * Convert latitude/longitude to ECI unit vector
 */
function latLngToEciUnit(lat: number, lng: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  
  return [
    cosLat * Math.cos(lngRad),  // X
    cosLat * Math.sin(lngRad),  // Y
    Math.sin(latRad)             // Z
  ];
}

export function OrbitScene() {
  const {
    currentScene,
    orbitParams,
    orbitData,
    orbitLoading,
    orbitError,
    sunVector,
    setSunVector,
    fetchOrbitTrajectory,
  } = useSimulationStore();

  const [tOrbitS, setTOrbitS] = useState(0);

  useEffect(() => {
    if (currentScene !== 'orbit') return;
    if (!orbitParams) return;
    if (orbitData || orbitLoading) return;
    void fetchOrbitTrajectory();
  }, [currentScene, orbitParams, orbitData, orbitLoading, fetchOrbitTrajectory]);

  useEffect(() => {
    if (currentScene !== 'orbit') return;

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      setTOrbitS((t) => t + dt * 20);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [currentScene]);

  const orbitPath = useMemo<OrbitPoint[]>(() => {
    if (!orbitData) return [];
    const { x_m, y_m, z_m } = orbitData.trajectory;
    const points: OrbitPoint[] = [];
    for (let i = 0; i < x_m.length; i++) {
      const { lat, lng, alt } = eciToLatLngAlt({ x: x_m[i], y: y_m[i], z: z_m[i] });
      points.push({ lat, lng, alt });
    }
    return points;
  }, [orbitData]);

  const sun = useMemo(() => {
    const { lat, lng } = vecToLatLng(sunVector);
    return {
      lat,
      lng,
      alt: 2.5,
    };
  }, [sunVector]);

  const satellite = useMemo<OrbitSatelliteData>(() => {
    if (!orbitData) {
      return {
        lat: 0,
        lng: 0,
        alt: 0,
        yawRad: 0,
        panelAngleRad: 0,
        positionEciM: [R_EARTH, 0, 0],
        velocityEciMps: [0, 0, 0],
      };
    }

    const { t_s } = orbitData.yaw_steering;
    const { x_m, y_m, z_m } = orbitData.trajectory;

    const period = orbitData.orbit_params.period_s;
    const t = period > 0 ? ((tOrbitS % period) + period) % period : tOrbitS;

    const x = interpolateValue(t_s, x_m, t);
    const y = interpolateValue(t_s, y_m, t);
    const z = interpolateValue(t_s, z_m, t);

    const dt = 1;
    const t0 = Math.max(0, t - dt);
    const t1 = Math.min(period, t + dt);

    const x0 = interpolateValue(t_s, x_m, t0);
    const y0 = interpolateValue(t_s, y_m, t0);
    const z0 = interpolateValue(t_s, z_m, t0);

    const x1 = interpolateValue(t_s, x_m, t1);
    const y1 = interpolateValue(t_s, y_m, t1);
    const z1 = interpolateValue(t_s, z_m, t1);

    const denom = Math.max(1e-6, t1 - t0);
    const vx = (x1 - x0) / denom;
    const vy = (y1 - y0) / denom;
    const vz = (z1 - z0) / denom;

    const yawRad = interpolateValue(t_s, orbitData.yaw_steering.yaw_rad, t);
    // Use explicit panel angle if available, otherwise 0
    const panelAngleRad = orbitData.yaw_steering.panel_angle_rad 
      ? interpolateValue(t_s, orbitData.yaw_steering.panel_angle_rad, t)
      : 0;

    const { lat, lng, alt } = eciToLatLngAlt({ x, y, z });

    return {
      lat,
      lng,
      alt,
      yawRad,
      panelAngleRad,
      positionEciM: [x, y, z],
      velocityEciMps: [vx, vy, vz],
    };
  }, [orbitData, tOrbitS]);

  const handleGlobeClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      const newSun = latLngToEciUnit(coords.lat, coords.lng);
      setSunVector(newSun);
      void fetchOrbitTrajectory();
    },
    [setSunVector, fetchOrbitTrajectory]
  );

  if (currentScene !== 'orbit') return null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      {orbitError && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            padding: '10px 12px',
            borderRadius: 6,
            background: 'rgba(200, 40, 40, 0.25)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontFamily: "'Roboto Mono', monospace",
            fontSize: 12,
          }}
        >
          {orbitError}
        </div>
      )}

      {orbitLoading && !orbitData && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            padding: '10px 12px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontFamily: "'Roboto Mono', monospace",
            fontSize: 12,
          }}
        >
          LOADING ORBIT...
        </div>
      )}

      {orbitData && (
        <OrbitGlobe
          orbitPath={orbitPath}
          satellite={satellite}
          sun={sun}
          sunVectorEci={sunVector}
          onGlobeClick={handleGlobeClick}
        />
      )}
    </div>
  );
}
