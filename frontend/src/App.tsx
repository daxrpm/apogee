/**
 * App.tsx - Main Application Entry Point
 * 
 * Provides scene switching between Terrain Maps and Beach Launch views.
 * 
 * @module App
 */

import { BeachScene } from './components/BeachScene';

// ============ STYLES ============

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  modeSwitcher: {
    position: 'absolute' as const,
    top: 20,
    left: 20,
    zIndex: 100,
    display: 'flex',
    gap: '8px',
  },
  modeButton: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    color: 'white',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s ease',
  },
  inactive: {
    background: 'rgba(0, 0, 0, 0.7)',
  },
  activeTerrain: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    boxShadow: '0 4px 6px rgba(99, 102, 241, 0.3)',
  },
  activeBeach: {
    background: 'linear-gradient(135deg, #ff6b35, #ff9966)',
    boxShadow: '0 4px 6px rgba(255, 107, 53, 0.3)',
  },
};

// ============ COMPONENT ============

/**
 * Apogee Frontend - 3D Launch & Orbit Visualization
 * 
 * Main application component that provides scene switching between:
 * 1. **Terrain Mode**: 3D terrain visualization of Ecuador
 * 2. **Beach Mode**: Launch site at Pedernales with rocket pad
 * 
 * Future additions:
 * - Rocket launch animation using trajectory data from API
 * - Orbital trajectory visualization
 * - Stage separation and landing simulation
 */
function App() {
  return (
    <div style={styles.container}>
      <BeachScene showStats={true} showModels={true} />
    </div>
  );
}

export default App;
