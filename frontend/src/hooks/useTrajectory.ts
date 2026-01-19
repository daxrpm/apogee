import { useMemo } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { interpolateValue } from '../utils/coordinateTransform';

/**
 * Hook to get current trajectory telemetry data
 * Useful for HUD/Telemetry display
 */
export function useTrajectoryTelemetry() {
  const { launchData, animationTime } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  return useMemo(() => {
    if (!trajectory) {
      return {
        time: 0,
        altitude: 0,
        velocity: 0,
        gamma: Math.PI / 2,
        mach: 0,
        mass: 0,
        dynamicPressure: 0,
      };
    }

    const times = trajectory.t_s;

    return {
      time: animationTime,
      altitude: interpolateValue(times, trajectory.h_m, animationTime),
      velocity: interpolateValue(times, trajectory.v_mps, animationTime),
      gamma: interpolateValue(times, trajectory.gamma_rad, animationTime),
      mach: trajectory.mach 
        ? interpolateValue(times, trajectory.mach, animationTime) 
        : 0,
      mass: trajectory.m_kg 
        ? interpolateValue(times, trajectory.m_kg, animationTime) 
        : 0,
      dynamicPressure: trajectory.q_pa 
        ? interpolateValue(times, trajectory.q_pa, animationTime) 
        : 0,
    };
  }, [trajectory, animationTime]);
}

export type FlightPhase = 'pre-launch' | 'liftoff' | 'gravity-turn' | 'maxq' | 'stage-sep' | 'stage2' | 'orbit';

/**
 * Detects flight events based on trajectory data
 */
export function useFlightEvents() {
  const { launchData, animationTime } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  return useMemo(() => {
    if (!trajectory) {
      return {
        phase: 'pre-launch' as FlightPhase,
        maxQTime: 0,
        stageSepTime: 0,
        isMaxQ: false,
        isStageSep: false,
      };
    }

    // Find MaxQ (maximum dynamic pressure)
    let maxQTime = 0;
    let maxQ = 0;
    if (trajectory.q_pa) {
      for (let i = 0; i < trajectory.q_pa.length; i++) {
        if (trajectory.q_pa[i] > maxQ) {
          maxQ = trajectory.q_pa[i];
          maxQTime = trajectory.t_s[i];
        }
      }
    }

    // Stage separation detection (mass discontinuity)
    let stageSepTime = 144; // Default estimate for Falcon 9
    if (trajectory.m_kg) {
      for (let i = 1; i < trajectory.m_kg.length; i++) {
        const massDrop = trajectory.m_kg[i - 1] - trajectory.m_kg[i];
        const dt = trajectory.t_s[i] - trajectory.t_s[i - 1];
        if (massDrop > 10000 && dt < 2) {
          stageSepTime = trajectory.t_s[i];
          break;
        }
      }
    }

    // Determine current phase
    let phase: FlightPhase;
    const endTime = trajectory.t_s[trajectory.t_s.length - 1];
    
    if (animationTime < 0) {
      phase = 'pre-launch';
    } else if (animationTime < 10) {
      phase = 'liftoff';
    } else if (animationTime < maxQTime - 5) {
      phase = 'gravity-turn';
    } else if (animationTime < maxQTime + 5) {
      phase = 'maxq';
    } else if (animationTime < stageSepTime + 5) {
      phase = 'stage-sep';
    } else if (animationTime < endTime - 10) {
      phase = 'stage2';
    } else {
      phase = 'orbit';
    }

    return {
      phase,
      maxQTime,
      stageSepTime,
      isMaxQ: Math.abs(animationTime - maxQTime) < 5,
      isStageSep: Math.abs(animationTime - stageSepTime) < 3,
    };
  }, [trajectory, animationTime]);
}
