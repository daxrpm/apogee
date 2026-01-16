import { LaunchScene } from './components/LaunchScene';

/**
 * Apogee Frontend - 3D Launch & Orbit Visualization
 * 
 * This application visualizes:
 * 1. Rocket launch from Ecuador with 3D terrain
 * 2. Orbital trajectory using globe.gl
 * 3. Satellite with yaw-steering solar panels
 */
function App() {
  return <LaunchScene showStats={true} showGrid={true} />;
}

export default App;
