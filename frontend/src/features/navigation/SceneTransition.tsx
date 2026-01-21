/**
 * SceneTransition - Fade transition between navigation scenes
 * 
 * Timer pauses when user interacts and STAYS paused until clicking Continue.
 * 
 * @module Navigation/SceneTransition
 */

import { useState, useEffect, useRef } from 'react';

interface SceneTransitionProps {
  children: React.ReactNode;
  fadeDuration?: number;
  autoAdvanceMs?: number;
  onComplete?: () => void;
  isActive?: boolean;
  /** Timer is paused (user interacted) */
  isPaused?: boolean;
}

export function SceneTransition({
  children,
  fadeDuration = 800,
  autoAdvanceMs = 10000,
  onComplete,
  isActive = true,
  isPaused = false,
}: SceneTransitionProps) {
  const [opacity, setOpacity] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);

  // Fade in/out
  useEffect(() => {
    if (isActive) {
      const visibleTimer = window.setTimeout(() => {
        setIsVisible(true);
      }, 0);
      elapsedRef.current = 0;
      const timer = window.setTimeout(() => setOpacity(1), 50);
      return () => {
        window.clearTimeout(visibleTimer);
        window.clearTimeout(timer);
      };
    } else {
      const opacityTimer = window.setTimeout(() => {
        setOpacity(0);
      }, 0);
      const timer = window.setTimeout(() => setIsVisible(false), fadeDuration);
      return () => {
        window.clearTimeout(opacityTimer);
        window.clearTimeout(timer);
      };
    }
  }, [isActive, fadeDuration]);

  // Auto-advance timer (only runs when NOT paused)
  useEffect(() => {
    if (!isActive || autoAdvanceMs === 0 || !onComplete || isPaused) {
      lastTickRef.current = Date.now();
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      elapsedRef.current += delta;
      lastTickRef.current = now;

      if (elapsedRef.current >= autoAdvanceMs) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isActive, autoAdvanceMs, onComplete, isPaused]);

  if (!isVisible && !isActive) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity,
        transition: `opacity ${fadeDuration}ms ease-in-out`,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

/**
 * ProgressTimer - Visual timer that shows remaining time
 * Shows paused state when user has interacted
 */
interface ProgressTimerProps {
  duration: number;
  isActive: boolean;
  isPaused?: boolean;
}

export function ProgressTimer({ duration, isActive, isPaused = false }: ProgressTimerProps) {
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = window.setTimeout(() => {
        setProgress(0);
      }, 0);
      elapsedRef.current = 0;
      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      if (!isPaused) {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        elapsedRef.current += delta;
        lastTickRef.current = now;

        const newProgress = Math.min(elapsedRef.current / duration, 1);
        setProgress(newProgress);

        if (newProgress >= 1) {
          clearInterval(interval);
        }
      } else {
        lastTickRef.current = Date.now();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, isActive, isPaused]);

  return (
    <div style={styles.timerContainer}>
      <div style={styles.timerTrack}>
        <div
          style={{
            ...styles.timerFill,
            width: `${progress * 100}%`,
            background: isPaused 
              ? 'rgba(255, 255, 255, 0.4)' 
              : 'linear-gradient(90deg, #ff6b35, #ff9966)',
          }}
        />
      </div>
      <span style={styles.timerText}>
        {isPaused ? (
          <span style={{ color: '#ff9966' }}>⏸ PAUSED</span>
        ) : (
          `${Math.ceil((1 - progress) * duration / 1000)}s`
        )}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  timerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  timerTrack: {
    width: 100,
    height: 4,
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    transition: 'width 0.1s linear',
  },
  timerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: "'Roboto Mono', monospace",
    minWidth: 60,
  },
};

export default SceneTransition;
