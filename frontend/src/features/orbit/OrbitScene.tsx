import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { interpolateAngle, interpolateValue, R_EARTH } from '../../utils/coordinateTransform';
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
  const [manualNuEnabled, setManualNuEnabled] = useState(false);
  const [manualNuDeg, setManualNuDeg] = useState(0);

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
    if (!orbitData || !orbitParams) {
      return {
        lat: 0,
        lng: 0,
        alt: 0,
        yawRad: 0,
        panelAngleRad: 0,
        nuRad: 0,
      };
    }

    const { t_s, nu_rad } = orbitData.yaw_steering;

    const period = orbitData.orbit_params.period_s;
    const t = period > 0 ? ((tOrbitS % period) + period) % period : tOrbitS;

    let nuRad = 0;
    let yawRad = 0;
    let panelAngleRad = 0;
    if (manualNuEnabled) {
      const targetNu = (manualNuDeg * Math.PI) / 180;
      let bestIdx = 0;
      let bestErr = Number.POSITIVE_INFINITY;
      for (let i = 0; i < nu_rad.length; i++) {
        const d = Math.atan2(Math.sin(nu_rad[i] - targetNu), Math.cos(nu_rad[i] - targetNu));
        const err = Math.abs(d);
        if (err < bestErr) {
          bestErr = err;
          bestIdx = i;
        }
      }

      nuRad = nu_rad[bestIdx] ?? targetNu;
      yawRad = orbitData.yaw_steering.yaw_rad[bestIdx] ?? 0;
      panelAngleRad = orbitData.yaw_steering.panel_angle_rad
        ? orbitData.yaw_steering.panel_angle_rad[bestIdx] ?? 0
        : 0;
    } else {
      nuRad = interpolateValue(t_s, nu_rad, t);
      yawRad = interpolateAngle(t_s, orbitData.yaw_steering.yaw_rad, t);
      panelAngleRad = orbitData.yaw_steering.panel_angle_rad
        ? interpolateAngle(t_s, orbitData.yaw_steering.panel_angle_rad, t)
        : 0;
    }

    // Calculate lat/lng/alt from nuRad for display purposes
    const r = orbitParams.r_m;
    const x = r * Math.cos(nuRad);
    const y = r * Math.sin(nuRad);
    const z = 0; // Equatorial orbit
    const { lat, lng, alt } = eciToLatLngAlt({ x, y, z });

    yawRad = Math.atan2(
      Math.sin(Math.PI - yawRad + Math.PI / 2),
      Math.cos(Math.PI - yawRad + Math.PI / 2)
    );

    return {
      lat,
      lng,
      alt,
      yawRad,
      panelAngleRad,
      nuRad,
    };
  }, [orbitData, orbitParams, tOrbitS, manualNuEnabled, manualNuDeg]);

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
        <>
          <OrbitGlobe
            orbitPath={orbitPath}
            satellite={satellite}
            orbitRadius={orbitParams?.r_m || R_EARTH + 200000}
            sun={sun}
            sunVectorEci={sunVector}
            onGlobeClick={handleGlobeClick}
          />

          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 1001,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontFamily: "'Roboto Mono', monospace",
              fontSize: 11,
              pointerEvents: 'auto',
              width: 260,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Manual ν</div>
              <input
                type="checkbox"
                checked={manualNuEnabled}
                onChange={(e) => setManualNuEnabled(e.target.checked)}
              />
            </div>

            <div style={{ marginTop: 8, opacity: manualNuEnabled ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>ν</div>
                <div>{manualNuDeg.toFixed(0)}°</div>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={manualNuDeg}
                onChange={(e) => setManualNuDeg(Number(e.target.value))}
                disabled={!manualNuEnabled}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Metrics Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '40px',
              width: '320px',
              background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(15, 15, 30, 0.95) 100%)',
              color: '#fff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              fontFamily: "'Inter', sans-serif",
              backdropFilter: 'blur(10px)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <h2 style={{ fontSize: '16px', marginBottom: '15px', color: '#00d9ff', borderBottom: '1px solid rgba(0,217,255,0.2)', paddingBottom: '8px' }}>
              📡 Yaw Steering Metrics
            </h2>

            <div style={{ display: 'grid', gap: '10px' }}>
              {/* ORBIT POSITION */}
              {(() => {
                // Use nuRad directly from satellite state
                const nuDeg = ((satellite.nuRad * 180 / Math.PI) % 360 + 360) % 360;
                
                const alphaRad = Math.atan2(sunVector[1], sunVector[0]);
                const alphaDeg = ((alphaRad * 180 / Math.PI) % 360 + 360) % 360;
                
                // η = ν - α - 180° (measured from Midnight)
                let etaDeg = nuDeg - alphaDeg - 180;
                etaDeg = ((etaDeg % 360) + 360) % 360;
                
                return (
                  <div style={{ padding: '10px', background: 'rgba(255,140,0,0.15)', borderRadius: '8px', marginBottom: '5px' }}>
                    <div style={{ fontSize: '10px', color: '#ff8c00', fontWeight: 'bold', textTransform: 'uppercase' }}>📍 Orbit Position</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '5px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: '#aaa' }}>True Anomaly (ν)</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>{nuDeg.toFixed(1)}°</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: '#aaa' }}>η from Midnight</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>{etaDeg.toFixed(1)}°</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '9px', color: '#888', marginTop: '5px' }}>
                      Sun Azimuth (α): {alphaDeg.toFixed(1)}°
                    </div>
                  </div>
                );
              })()}

              {/* YAW */}
              <div style={{ padding: '10px', background: 'rgba(0,217,255,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', color: '#00d9ff', fontWeight: 'bold', textTransform: 'uppercase' }}>Yaw (ψ)</div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  {(satellite.yawRad * 180 / Math.PI).toFixed(2)}°
                </div>
              </div>

              {/* BETA */}
              <div style={{ padding: '10px', background: 'rgba(255,215,0,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', color: '#ffd700', fontWeight: 'bold', textTransform: 'uppercase' }}>Beta (β)</div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  {(Math.asin(sunVector[2]) * 180 / Math.PI).toFixed(2)}°
                </div>
              </div>

              {/* PANEL ANGLE */}
              <div style={{ padding: '10px', background: 'rgba(0,255,0,0.1)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', color: '#00ff00', fontWeight: 'bold', textTransform: 'uppercase' }}>Panel (φ)</div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  {(satellite.panelAngleRad * 180 / Math.PI).toFixed(2)}°
                </div>
              </div>
            </div>

            <div style={{ marginTop: '15px', fontSize: '10px', color: '#888', textAlign: 'center' }}>
              Status: NOMINAL • US2007 Standard
            </div>
          </div>

          {/* Legend */}
          <div
             style={{
              position: 'absolute',
              bottom: '40px',
              left: '40px',
              padding: '15px',
              background: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
              color: '#aaa',
              fontSize: '11px',
              fontFamily: 'monospace',
              border: '1px solid rgba(255,255,255,0.1)',
              pointerEvents: 'none'
            }}
          >
            <div style={{ marginBottom: '5px', color: '#fff', fontWeight: 'bold' }}>CONVENTIONS</div>
            <div>η = 0° @ Midnight</div>
            <div>ψ = β @ Dawn (6 AM)</div>
            <div>φ = -(180-β) @ Noon</div>
          </div>
        </>
      )}
    </div>
  );
}
