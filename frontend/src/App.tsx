import { useState } from 'react';
import { LaunchScene } from './components/LaunchScene';
import { BeachScene } from './components/BeachScene';
import './App.css';

type SceneMode = 'terrain' | 'beach';

/**
 * Apogee Frontend - 3D Launch & Orbit Visualization
 * 
 * Visualization flow:
 * 1. Terrain views: Ecuador → Quito → Pedernales → Launch Beach
 * 2. 3D Beach scene with launch pad
 * 3. Rocket launch animation (future)
 * 4. Orbital trajectory (future)
 */
function App() {
  const [sceneMode, setSceneMode] = useState<SceneMode>('beach');

  return (
    <div className="app-container">
      {/* Scene Renderer */}
      {sceneMode === 'terrain' && <LaunchScene showStats={true} showGrid={true} />}
      {sceneMode === 'beach' && <BeachScene showStats={true} showModels={true} />}

      {/* Scene Mode Selector */}
      <div className="mode-switcher">
        <button
          onClick={() => setSceneMode('terrain')}
          className={`mode-button ${sceneMode === 'terrain' ? 'active-terrain' : ''}`}
        >
          🗺️ Terrain Maps
        </button>
        <button
          onClick={() => setSceneMode('beach')}
          className={`mode-button ${sceneMode === 'beach' ? 'active-beach' : ''}`}
        >
          🏖️ Launch Beach
        </button>
      </div>
    </div>
  );
}

export default App;
