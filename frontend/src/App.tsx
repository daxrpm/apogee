/**
 * App.tsx - Main Application Entry Point
 * 
 * Navigation flow: Ecuador → Quito → Pedernales → Beach → Launch → Orbit
 * Uses real satellite textures and heightmaps for 3D terrain visualization.
 * 
 * @module App
 */

import { useEffect, useState, useCallback } from 'react';
import { BeachScene } from './components/BeachScene';
import { 
  SceneTransition,
  ProgressTimer,
  NavigationTerrainScene,
} from './components/Navigation';
import { useSimulationStore } from './stores/simulationStore';
import { SCENE_INFO, type SceneType } from './types';

// ============ CONSTANTS ============

const INTRO_SCENES: SceneType[] = ['ecuador', 'quito', 'pedernales'];
const MAIN_SCENES: SceneType[] = ['beach', 'launch', 'orbit'];
const AUTO_ADVANCE_MS = 10000;

// ============ STYLES ============

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    position: 'relative' as const,
    overflow: 'hidden',
    background: '#000',
  },
  skipButton: {
    position: 'absolute' as const,
    top: 20,
    right: 20,
    zIndex: 200,
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    padding: '8px 16px',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1,
    cursor: 'pointer',
    fontFamily: "'Roboto Mono', monospace",
    transition: 'all 0.2s ease',
  },
  progressContainer: {
    position: 'absolute' as const,
    top: 20,
    right: 140,
    zIndex: 200,
  },
} as const;

// ============ COMPONENT ============

function App() {
  const { currentScene, nextScene, skipToBeach, hasSeenIntro } = useSimulationStore();
  const [interactionScene, setInteractionScene] = useState<SceneType | null>(null);

  const isIntroScene = INTRO_SCENES.includes(currentScene);
  const isUserInteracting = interactionScene === currentScene;

  const handleInteractionChange = useCallback((isInteracting: boolean) => {
    setInteractionScene(isInteracting ? currentScene : null);
  }, [currentScene]);

  // Skip intro on reload if already seen
  useEffect(() => {
    if (!hasSeenIntro || !isIntroScene) return;

    const timeoutId = window.setTimeout(() => {
      skipToBeach();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasSeenIntro, isIntroScene, skipToBeach]);

  return (
    <div style={styles.container}>
      {/* Intro terrain scenes */}
      {INTRO_SCENES.map((sceneId) => (
        <SceneTransition 
          key={sceneId}
          isActive={currentScene === sceneId} 
          autoAdvanceMs={AUTO_ADVANCE_MS}
          onComplete={nextScene}
          isPaused={isUserInteracting}
        >
          <NavigationTerrainScene 
            regionId={sceneId as 'ecuador' | 'quito' | 'pedernales'}
            sceneInfo={SCENE_INFO[sceneId]}
            onContinue={nextScene}
            onInteractionChange={handleInteractionChange}
          />
          {currentScene === sceneId && (
            <div style={styles.progressContainer}>
              <ProgressTimer 
                duration={AUTO_ADVANCE_MS} 
                isActive={currentScene === sceneId}
                isPaused={isUserInteracting} 
              />
            </div>
          )}
        </SceneTransition>
      ))}

      {/* Skip intro button */}
      {isIntroScene && (
        <button 
          style={styles.skipButton}
          onClick={skipToBeach}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          SKIP INTRO →
        </button>
      )}

      {/* Main scenes (Beach, Launch, Orbit) */}
      <SceneTransition 
        isActive={MAIN_SCENES.includes(currentScene)}
        autoAdvanceMs={0}
      >
        <BeachScene showStats={false} showModels={true} />
      </SceneTransition>
    </div>
  );
}

export default App;
