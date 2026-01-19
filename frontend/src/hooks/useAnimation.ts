import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { getTrajectoryDuration } from '../utils/coordinateTransform';

/**
 * Animation hook for controlling trajectory playback.
 * 
 * Uses requestAnimationFrame for smooth 60fps updates.
 * Syncs with Zustand store for global animation state.
 * 
 * @param timeScale - Playback speed multiplier (default: 1 = real-time)
 * @returns Animation control functions
 */
export function useAnimation(timeScale: number = 1) {
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animateRef = useRef<((time: number) => void) | null>(null);
  
  const {
    launchData,
    animationTime,
    isPlaying,
    setAnimationTime,
    setIsPlaying,
    setScene,
  } = useSimulationStore();

  // Get trajectory duration
  const duration = launchData?.trajectory 
    ? getTrajectoryDuration(launchData.trajectory.t_s)
    : 0;

  // Update animation ref in effect to avoid render-phase mutation
  useEffect(() => {
    animateRef.current = (currentTime: number) => {
      if (!isPlaying || !launchData?.trajectory) {
        lastTimeRef.current = currentTime;
        return;
      }

      const deltaMs = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      
      const deltaClamped = Math.min(deltaMs, 100);
      const deltaSeconds = (deltaClamped / 1000) * timeScale;
      
      const newTime = animationTime + deltaSeconds;
      
      if (newTime >= duration) {
        setAnimationTime(duration);
        setIsPlaying(false);
        setScene('orbit');
      } else {
        setAnimationTime(newTime);
        frameRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
      }
    };
  }, [isPlaying, launchData, animationTime, duration, timeScale, setAnimationTime, setIsPlaying, setScene]);

  // Start/stop animation loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
    }
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isPlaying]);

  // Control functions
  const play = useCallback(() => {
    setIsPlaying(true);
  }, [setIsPlaying]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const reset = useCallback(() => {
    setAnimationTime(0);
    setIsPlaying(false);
  }, [setAnimationTime, setIsPlaying]);

  const seek = useCallback((time: number) => {
    setAnimationTime(Math.max(0, Math.min(time, duration)));
  }, [setAnimationTime, duration]);

  const setSpeed = useCallback((speed: number) => {
    // This would need store integration if we want persistent speed
    console.log('Speed set to:', speed);
  }, []);

  return {
    currentTime: animationTime,
    duration,
    isPlaying,
    progress: duration > 0 ? animationTime / duration : 0,
    play,
    pause,
    reset,
    seek,
    setSpeed,
  };
}
