/**
 * YAW STEERING LABORATORY
 * =======================
 * 
 * Uses /orbit/trajectory endpoint for smooth yaw values across the orbit.
 * 
 * WHAT EACH ANGLE DOES:
 * - YAW (ψ): Rotates ENTIRE satellite around Nadir axis (Z-LVLH)
 * - PANEL ANGLE (φ): Rotates ONLY solar panels around SADA axis (Y-body)
 * - BETA (β): Sun elevation above orbit plane (informational, no rotation)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface TrajectoryResponse {
  orbit_params: {
    semi_major_axis_m: number;
    period_s: number;
    mean_motion_rad_s: number;
  };
  trajectory: {
    x_m: number[];
    y_m: number[];
    z_m: number[];
  };
  yaw_steering: {
    t_s: number[];
    nu_rad: number[];
    yaw_rad: number[];
    yaw_deg: number[];
    beta_rad: number[];
    beta_deg: number[];
    panel_angle_rad: number[];
    panel_angle_deg: number[];
  };
}

interface InterpolatedData {
  yaw_rad: number;
  yaw_deg: number;
  beta_rad: number;
  beta_deg: number;
  panel_angle_rad: number;
  panel_angle_deg: number;
  sun_body: [number, number, number];
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export default function YawSteeringLab() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const satelliteBaseQuatRef = useRef<THREE.Quaternion | null>(null);
  const solarPanelsBaseQuatRef = useRef<THREE.Quaternion | null>(null);

  // UI State
  const [nu, setNu] = useState(0); // True anomaly in degrees
  const [sunAzimuth, setSunAzimuth] = useState(0); // Sun azimuth in orbit plane (degrees)
  const [sunElevation, setSunElevation] = useState(20); // Sun elevation above orbit plane (degrees) - DEFAULT 20° for visible yaw variation
  const [orbitRadius] = useState(6571); // km
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryResponse | null>(null);
  const [interpolatedData, setInterpolatedData] = useState<InterpolatedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAxes, setShowAxes] = useState(true);

  // 3D objects refs
  const satelliteRef = useRef<THREE.Group | null>(null);
  const sunRef = useRef<THREE.Mesh | null>(null);
  const solarPanelsRef = useRef<THREE.Object3D | null>(null);
  const lvlhAxesRef = useRef<THREE.Group | null>(null);
  const bodyAxesRef = useRef<THREE.Group | null>(null);
  const orbitLineRef = useRef<THREE.Line | null>(null);

  const deg2rad = useCallback((deg: number) => (deg * Math.PI) / 180, []);

  // Convert sun position from azimuth/elevation to ECI vector
  // Azimuth: angle in the orbit plane (0° = +X direction)
  // Elevation: angle above the orbit plane (0° = in plane, 90° = north pole)
  const getSunECI = useCallback(() => {
    const azRad = deg2rad(sunAzimuth);
    const elRad = deg2rad(sunElevation);
    
    // In backend ECI: orbit is in XY plane, Z is north pole
    // sun_x = cos(el) * cos(az)
    // sun_y = cos(el) * sin(az)
    // sun_z = sin(el)
    const sun_x = Math.cos(elRad) * Math.cos(azRad);
    const sun_y = Math.cos(elRad) * Math.sin(azRad);
    const sun_z = Math.sin(elRad);
    
    return { sun_x, sun_y, sun_z };
  }, [deg2rad, sunAzimuth, sunElevation]);

  // For Three.js visualization (Y-up, XZ plane orbit)
  const getSunDirThreeJS = useCallback(() => {
    const { sun_x, sun_y, sun_z } = getSunECI();
    // Backend ECI (XY plane, Z-up) -> Three.js (XZ plane, Y-up)
    // x -> x, y -> z, z -> y
    return new THREE.Vector3(sun_x, sun_z, sun_y).normalize();
  }, [getSunECI]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvasEl = canvasRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, canvasEl.clientWidth / canvasEl.clientHeight, 0.1, 100000);
    camera.position.set(15000, 10000, 15000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvasEl.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // Earth wireframe
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(6371, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x1e88e5, wireframe: true, transparent: true, opacity: 0.2 })
    );
    scene.add(earth);

    // ECI Axes
    scene.add(new THREE.AxesHelper(8000));

    // Orbit path
    const orbitPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const angle = (i * Math.PI) / 180;
      orbitPoints.push(new THREE.Vector3(orbitRadius * Math.cos(angle), 0, orbitRadius * Math.sin(angle)));
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.4, transparent: true })
    );
    orbitLineRef.current = orbitLine;
    scene.add(orbitLine);

    // Sun sphere
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(500, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    sunRef.current = sun;
    scene.add(sun);

    // LVLH & Body Axes groups
    const lvlhAxes = new THREE.Group();
    lvlhAxesRef.current = lvlhAxes;
    scene.add(lvlhAxes);

    const bodyAxes = new THREE.Group();
    bodyAxesRef.current = bodyAxes;
    scene.add(bodyAxes);

    // Load satellite model
    const loader = new GLTFLoader();
    loader.load('/models/satellite_replace.glb', (gltf) => {
      const satellite = gltf.scene;
      satellite.scale.setScalar(300);
      
      // The model likely has panels along X. We want them along Y.
      // Rotate 90 deg around Z: X -> Y
      const baseRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
      satelliteBaseQuatRef.current = baseRotation;
      
      satelliteRef.current = satellite;
      scene.add(satellite);

      const panels = satellite.getObjectByName('Solar_Panels_28') || satellite.getObjectByName('Object_56');
      if (panels) {
        solarPanelsRef.current = panels;
        solarPanelsBaseQuatRef.current = panels.quaternion.clone();
      }
    });

    function animate() {
      rafIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      if (!canvasEl || !camera || !renderer) return;
      camera.aspect = canvasEl.clientWidth / canvasEl.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      controls.dispose();
      renderer.dispose();
      canvasEl?.removeChild(renderer.domElement);
    };
  }, [orbitRadius]);

  // Fetch trajectory from backend
  const fetchTrajectory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { sun_x, sun_y, sun_z } = getSunECI();
      const r_m = orbitRadius * 1000;

      const response = await fetch(`${API_BASE_URL}/orbit/trajectory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r_m,
          nu_initial_rad: 0,
          sun_x,
          sun_y,
          sun_z,
          n_points: 361,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: TrajectoryResponse = await response.json();
      setTrajectoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [getSunECI, orbitRadius]);

  // Auto-fetch on sun position change
  useEffect(() => {
    const t = setTimeout(() => void fetchTrajectory(), 300);
    return () => clearTimeout(t);
  }, [fetchTrajectory]);

  // Interpolate data at current nu from trajectory
  useEffect(() => {
    if (!trajectoryData) return;

    const nuRad = deg2rad(nu);
    const nuArr = trajectoryData.yaw_steering.nu_rad;
    
    // Find closest index
    let bestIdx = 0;
    let bestDist = Math.abs(nuArr[0] - nuRad);
    for (let i = 1; i < nuArr.length; i++) {
      const dist = Math.abs(nuArr[i] - nuRad);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const yaw_rad = trajectoryData.yaw_steering.yaw_rad[bestIdx];
    const yaw_deg = trajectoryData.yaw_steering.yaw_deg[bestIdx];
    const beta_rad = trajectoryData.yaw_steering.beta_rad[bestIdx];
    const beta_deg = trajectoryData.yaw_steering.beta_deg[bestIdx];
    const panel_angle_rad = trajectoryData.yaw_steering.panel_angle_rad[bestIdx];
    const panel_angle_deg = trajectoryData.yaw_steering.panel_angle_deg[bestIdx];

    // Compute sun_body from yaw
    const { sun_x, sun_y, sun_z } = getSunECI();
    
    // Get LVLH basis at current nu (backend convention)
    const sin_nu = Math.sin(nuRad);
    const cos_nu = Math.cos(nuRad);
    
    // x_lvlh = velocity direction = [-sin(nu), cos(nu), 0]
    // y_lvlh = south = [0, 0, -1]
    // z_lvlh = nadir = [-cos(nu), -sin(nu), 0]
    const sx_local = -sun_x * sin_nu + sun_y * cos_nu;
    const sy_local = -sun_z;
    const sz_local = -sun_x * cos_nu - sun_y * sin_nu;

    // Apply yaw rotation
    const c = Math.cos(yaw_rad);
    const s = Math.sin(yaw_rad);
    const s_bx = c * sx_local + s * sy_local;
    const s_by = -s * sx_local + c * sy_local;
    const s_bz = sz_local;

    setInterpolatedData({
      yaw_rad,
      yaw_deg,
      beta_rad,
      beta_deg,
      panel_angle_rad,
      panel_angle_deg,
      sun_body: [s_bx, s_by, s_bz],
    });
  }, [trajectoryData, nu, deg2rad, getSunECI]);

  // Update 3D scene
  useEffect(() => {
    if (!sceneRef.current) return;

    const nuRad = deg2rad(nu);
    
    // Satellite position in Three.js coords (XZ plane, Y-up)
    const posThreeJS = new THREE.Vector3(
      orbitRadius * Math.cos(nuRad),
      0,
      orbitRadius * Math.sin(nuRad)
    );

    // Velocity direction in Three.js
    const velDir = new THREE.Vector3(-Math.sin(nuRad), 0, Math.cos(nuRad)).normalize();

    // Position sun
    const sunDir = getSunDirThreeJS();
    if (sunRef.current) {
      sunRef.current.position.copy(sunDir.clone().multiplyScalar(20000));
    }

    // Position satellite
    if (satelliteRef.current) {
      satelliteRef.current.position.copy(posThreeJS);
    }

    // Calculate LVLH frame in Three.js
    const rHat = posThreeJS.clone().normalize();
    const zLVLH = rHat.clone().multiplyScalar(-1); // Nadir
    const xLVLH = velDir.clone(); // Velocity
    const yLVLH = new THREE.Vector3().crossVectors(zLVLH, xLVLH).normalize(); // South

    // Update LVLH axes
    if (lvlhAxesRef.current) {
      lvlhAxesRef.current.clear();
      lvlhAxesRef.current.position.copy(posThreeJS);
      if (showAxes) {
        const len = 3000;
        lvlhAxesRef.current.add(new THREE.ArrowHelper(xLVLH, new THREE.Vector3(), len, 0xff0000, 600, 400));
        lvlhAxesRef.current.add(new THREE.ArrowHelper(yLVLH, new THREE.Vector3(), len, 0x00ff00, 600, 400));
        lvlhAxesRef.current.add(new THREE.ArrowHelper(zLVLH, new THREE.Vector3(), len, 0x0000ff, 600, 400));
        lvlhAxesRef.current.visible = true;
      } else {
        lvlhAxesRef.current.visible = false;
      }
    }

    // Apply backend rotations
    if (interpolatedData && satelliteRef.current) {
      const yawRad = interpolatedData.yaw_rad;
      const panelAngleRad = interpolatedData.panel_angle_rad;

      // Build body frame
      const cosPsi = Math.cos(yawRad);
      const sinPsi = Math.sin(yawRad);
      
      // X-Body (Front): Rotates from Velocity towards Normal/South
      const xBody = xLVLH.clone().multiplyScalar(cosPsi).add(yLVLH.clone().multiplyScalar(sinPsi)).normalize();
      // Y-Body (SADA / Panels): Rotates from Normal/South towards -Velocity
      const yBody = xLVLH.clone().multiplyScalar(-sinPsi).add(yLVLH.clone().multiplyScalar(cosPsi)).normalize();
      // Z-Body (Nadir): Always points to Earth
      const zBody = zLVLH.clone();

      // Update body axes
      if (bodyAxesRef.current) {
        bodyAxesRef.current.clear();
        bodyAxesRef.current.position.copy(posThreeJS);
        if (showAxes) {
          const len = 3500;
          bodyAxesRef.current.add(new THREE.ArrowHelper(xBody, new THREE.Vector3(), len, 0x00ffff, 600, 400));
          bodyAxesRef.current.add(new THREE.ArrowHelper(yBody, new THREE.Vector3(), len, 0xff00ff, 600, 400));
          bodyAxesRef.current.add(new THREE.ArrowHelper(zBody, new THREE.Vector3(), len, 0xffffff, 600, 400));
          bodyAxesRef.current.visible = true;
        } else {
          bodyAxesRef.current.visible = false;
        }
      }

      // Orient satellite
      const rotMatrix = new THREE.Matrix4().makeBasis(xBody, yBody, zBody);
      const bodyQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      if (satelliteBaseQuatRef.current) {
        satelliteRef.current.quaternion.copy(bodyQuat).multiply(satelliteBaseQuatRef.current);
      } else {
        satelliteRef.current.quaternion.copy(bodyQuat);
      }

      // Rotate solar panels
      if (solarPanelsRef.current && solarPanelsBaseQuatRef.current) {
        // Model X is Body Y (the rotation axis)
        const panelAxis = new THREE.Vector3(1, 0, 0);
        // Backend now uses SADM convention where 0 is Nadir
        const panelQuat = new THREE.Quaternion().setFromAxisAngle(panelAxis, panelAngleRad);
        solarPanelsRef.current.quaternion.copy(solarPanelsBaseQuatRef.current).multiply(panelQuat);
      }
    } else if (satelliteRef.current) {
      // Default LVLH orientation
      const rotMatrix = new THREE.Matrix4().makeBasis(xLVLH, yLVLH, zLVLH);
      const defaultQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
      if (satelliteBaseQuatRef.current) {
        satelliteRef.current.quaternion.copy(defaultQuat).multiply(satelliteBaseQuatRef.current);
      } else {
        satelliteRef.current.quaternion.copy(defaultQuat);
      }
    }
  }, [nu, interpolatedData, showAxes, getSunDirThreeJS, deg2rad, orbitRadius]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div ref={canvasRef} style={{ flex: 1, position: 'relative' }} />

      <div
        style={{
          width: '380px',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)',
          color: '#fff',
          padding: '20px',
          overflowY: 'auto',
          fontFamily: "'Inter', sans-serif",
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <h1 style={{ fontSize: '22px', marginBottom: '5px', color: '#00d9ff' }}>
          🛰️ Yaw Steering Lab
        </h1>
        <p style={{ fontSize: '11px', color: '#666', marginBottom: '20px' }}>
          Uses /orbit/trajectory for smooth yaw
        </p>

        {/* Orbit Position */}
        <section style={{ marginBottom: '25px' }}>
          <h2 style={{ fontSize: '14px', marginBottom: '12px', color: '#ffd700' }}>📍 Orbit Position</h2>
          <label style={{ display: 'block', marginBottom: '15px' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>
              True Anomaly (ν): <strong>{nu}°</strong>
            </span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={nu}
              onChange={(e) => setNu(Number(e.target.value))}
              style={{ width: '100%', marginTop: '5px' }}
            />
          </label>
        </section>

        {/* Sun Position */}
        <section style={{ marginBottom: '25px' }}>
          <h2 style={{ fontSize: '14px', marginBottom: '12px', color: '#ffd700' }}>☀️ Sun Position</h2>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>
              Azimuth: <strong>{sunAzimuth}°</strong> (in orbit plane)
            </span>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={sunAzimuth}
              onChange={(e) => setSunAzimuth(Number(e.target.value))}
              style={{ width: '100%', marginTop: '5px' }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>
              Elevation: <strong>{sunElevation}°</strong> (above orbit plane)
            </span>
            <input
              type="range"
              min="-90"
              max="90"
              step="5"
              value={sunElevation}
              onChange={(e) => setSunElevation(Number(e.target.value))}
              style={{ width: '100%', marginTop: '5px' }}
            />
            <div style={{ fontSize: '10px', color: '#666', marginTop: '3px' }}>
              0° = in plane, ±90° = poles. Non-zero for yaw variation!
            </div>
          </label>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <label style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showAxes}
              onChange={(e) => setShowAxes(e.target.checked)}
              style={{ marginRight: '10px' }}
            />
            <span style={{ fontSize: '13px' }}>Show Coordinate Axes</span>
          </label>
        </section>

        {/* Backend Response */}
        <section
          style={{
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '10px',
            padding: '15px',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '14px', marginBottom: '15px', color: '#00d9ff' }}>
            📊 Backend Calculations
          </h2>

          {loading && <p style={{ color: '#888' }}>Loading trajectory...</p>}
          {error && <p style={{ color: '#ff6b6b' }}>Error: {error}</p>}

          {interpolatedData && (
            <div style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.8' }}>
              {/* YAW */}
              <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(0,217,255,0.1)', borderRadius: '6px' }}>
                <div style={{ color: '#00d9ff', fontWeight: 'bold', marginBottom: '4px' }}>
                  🔄 YAW (ψ) - Rotates ENTIRE satellite
                </div>
                <div style={{ fontSize: '18px', color: '#fff' }}>
                  {interpolatedData.yaw_deg.toFixed(2)}°
                </div>
                <div style={{ fontSize: '10px', color: '#888' }}>
                  {interpolatedData.yaw_rad.toFixed(4)} rad
                </div>
              </div>

              {/* BETA */}
              <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255,215,0,0.1)', borderRadius: '6px' }}>
                <div style={{ color: '#ffd700', fontWeight: 'bold', marginBottom: '4px' }}>
                  📐 BETA (β) - Sun elevation
                </div>
                <div style={{ fontSize: '18px', color: '#fff' }}>
                  {interpolatedData.beta_deg.toFixed(2)}°
                </div>
                <div style={{ fontSize: '10px', color: '#888' }}>
                  = sun elevation slider value
                </div>
              </div>

              {/* PANEL ANGLE */}
              <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(0,255,0,0.1)', borderRadius: '6px' }}>
                <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '4px' }}>
                  ⚡ PANEL (φ) - Rotates ONLY panels
                </div>
                <div style={{ fontSize: '18px', color: '#fff' }}>
                  {interpolatedData.panel_angle_deg.toFixed(2)}°
                </div>
              </div>

              {/* SUN IN BODY FRAME */}
              <div style={{ padding: '10px', background: 'rgba(255,165,0,0.1)', borderRadius: '6px' }}>
                <div style={{ color: '#ffa500', fontWeight: 'bold', marginBottom: '4px' }}>
                  ☀️ Sun Vector (Body Frame)
                </div>
                <div style={{ fontSize: '12px', color: '#fff' }}>
                  X: {interpolatedData.sun_body[0].toFixed(4)}<br />
                  Y: {interpolatedData.sun_body[1].toFixed(4)} 
                  <span style={{ color: Math.abs(interpolatedData.sun_body[1]) < 0.01 ? '#00ff00' : '#ff9900' }}>
                    {Math.abs(interpolatedData.sun_body[1]) < 0.01 ? ' ✓ ≈0' : ' (non-zero ok with β≠0)'}
                  </span><br />
                  Z: {interpolatedData.sun_body[2].toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Legend */}
        <section>
          <h2 style={{ fontSize: '12px', marginBottom: '10px', color: '#888' }}>Axis Legend</h2>
          <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#aaa' }}>
            <p><span style={{ color: '#ff0000' }}>■</span> LVLH X (Velocity)</p>
            <p><span style={{ color: '#00ff00' }}>■</span> LVLH Y (South)</p>
            <p><span style={{ color: '#0000ff' }}>■</span> LVLH Z (Nadir)</p>
            <p><span style={{ color: '#00ffff' }}>■</span> Body X (after yaw)</p>
            <p><span style={{ color: '#ff00ff' }}>■</span> Body Y (SADA axis)</p>
            <p><span style={{ color: '#ffffff' }}>■</span> Body Z (Nadir)</p>
          </div>
        </section>
      </div>
    </div>
  );
}
