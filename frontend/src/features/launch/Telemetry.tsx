/**
 * Telemetry - SpaceX-style HUD overlay
 * 
 * Minimal, modern telemetry display showing all critical flight data.
 * 
 * @module Launch/Telemetry
 */

import { useMemo } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';
import { interpolateValue } from '../../utils/coordinateTransform';

export function Telemetry() {
  const { currentScene, isPlaying, currentStage, enginesActive, launchData, animationTime } = useSimulationStore();
  const trajectory = launchData?.trajectory;

  const telemetry = useMemo(() => {
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
      mach: trajectory.mach ? interpolateValue(times, trajectory.mach, animationTime) : 0,
      mass: trajectory.m_kg ? interpolateValue(times, trajectory.m_kg, animationTime) : 0,
      dynamicPressure: trajectory.q_pa ? interpolateValue(times, trajectory.q_pa, animationTime) : 0,
    };
  }, [trajectory, animationTime]);

  const events = useMemo(() => {
    if (!trajectory) {
      return {
        maxQTime: 0,
        stageSepTime: 0,
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
    let stageSepTime = 144;
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

    return {
      maxQTime,
      stageSepTime,
    };
  }, [trajectory]);

  const shouldShow = currentScene === 'launch' && isPlaying && telemetry;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `T+ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current event status
  const currentEvent = useMemo(() => {
    if (!events || !telemetry) return 'STARTUP';
    
    if (events.stageSepTime && telemetry.time >= events.stageSepTime) {
      return 'STAGE SEP';
    }
    if (events.maxQTime && telemetry.time >= events.maxQTime) {
      return 'MAX Q';
    }
    return 'LIFTOFF';
  }, [events, telemetry]);

  if (!shouldShow) return null;

  const {
    velocity,      // m/s
    altitude,      // m
    time,          // s
    gamma,         // rad
    mass,          // kg
    dynamicPressure, // Pa
  } = telemetry;
  
  // Unit conversions
  const velocityKmh = velocity * 3.6;   // m/s to km/h
  const altitudeKm = altitude / 1000;   // m to km
  const gammaDeg = gamma * (180 / Math.PI);  // rad to degrees
  const massT = mass / 1000;            // kg to tonnes
  const qKpa = dynamicPressure / 1000;  // Pa to kPa

  return (
    <div style={styles.container}>
      {/* Left side metrics */}
      <div style={styles.leftGroup}>
        <MetricDual 
          label="VELOCITY" 
          value1={Math.round(velocity)} 
          unit1="m/s"
          value2={Math.round(velocityKmh)} 
          unit2="km/h" 
        />
        <Metric 
          label="ALTITUDE" 
          value={altitudeKm.toFixed(1)} 
          unit="km" 
        />
        <Metric 
          label="ANGLE" 
          value={gammaDeg.toFixed(1)} 
          unit="°" 
        />
      </div>

      {/* Center: Timeline & Time */}
      <div style={styles.centerGroup}>
        <div style={styles.timeline}>
          <TimelineStep label="LIFTOFF" active={time >= 0} />
          <TimelineStep label="STARTUP" active={time >= 1} />
          <TimelineStep label="MAX Q" active={events?.maxQTime ? time >= events.maxQTime : false} />
          <TimelineStep label="STAGE SEP" active={events?.stageSepTime ? time >= events.stageSepTime : false} />
        </div>
        
        <div style={styles.missionTime}>{formatTime(time)}</div>
        
        <div style={styles.eventLabel}>{currentEvent}</div>
      </div>

      {/* Right side metrics */}
      <div style={styles.rightGroup}>
        <Metric 
          label="MASS" 
          value={massT.toFixed(1)} 
          unit="t" 
        />
        <Metric 
          label="DYN PRESS" 
          value={qKpa.toFixed(0)} 
          unit="kPa" 
        />
        <EngineStatus stage={currentStage} active={enginesActive} />
      </div>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

interface MetricProps {
  label: string;
  value: string | number;
  unit: string;
}

function Metric({ label, value, unit }: MetricProps) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>
        <span style={styles.metricNumber}>{value}</span>
        <span style={styles.metricUnit}>{unit}</span>
      </div>
    </div>
  );
}

interface MetricDualProps {
  label: string;
  value1: string | number;
  unit1: string;
  value2: string | number;
  unit2: string;
}

function MetricDual({ label, value1, unit1, value2, unit2 }: MetricDualProps) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>
        <span style={styles.metricNumber}>{value1}</span>
        <span style={styles.metricUnit}>{unit1}</span>
      </div>
      <div style={styles.metricValueSecondary}>
        <span style={styles.metricNumberSecondary}>{value2}</span>
        <span style={styles.metricUnitSecondary}>{unit2}</span>
      </div>
    </div>
  );
}

interface TimelineStepProps {
  label: string;
  active: boolean;
}

function TimelineStep({ label, active }: TimelineStepProps) {
  return (
    <div style={{
      ...styles.timelineStep,
      ...(active ? styles.timelineStepActive : {}),
    }}>
      <div style={active ? styles.timelineDotActive : styles.timelineDot} />
      <div style={styles.timelineLabel}>{label}</div>
    </div>
  );
}

interface EngineStatusProps {
  stage: 1 | 2;
  active: boolean;
}

function EngineStatus({ stage, active }: EngineStatusProps) {
  return (
    <div style={styles.engines}>
      <div style={styles.metricLabel}>ENGINES</div>
      <div style={styles.engineGrid}>
        {stage === 1 ? (
          // Stage 1: 9 engines in octaweb pattern
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                style={{
                  ...styles.engineDot,
                  ...(active ? styles.engineDotActive : {}),
                }}
              />
            ))}
            <div
              style={{
                ...styles.engineDotCenter,
                ...(active ? styles.engineDotActive : {}),
              }}
            />
          </>
        ) : (
          // Stage 2: 1 engine
          <div
            style={{
              ...styles.engineDotSingle,
              ...(active ? styles.engineDotActive : {}),
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============ STYLES ============

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,  // Reduced from 80
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.75))',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 30px',
    fontFamily: "'Roboto Mono', monospace",
    zIndex: 50,
  },
  leftGroup: {
    display: 'flex',
    gap: 30,
    flex: 1.2,
  },
  centerGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    flex: 1.5,
  },
  rightGroup: {
    display: 'flex',
    gap: 30,
    flex: 1.2,
    justifyContent: 'flex-end',
  },
  
  // Metrics
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  metricLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 700,
  },
  metricValue: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
  },
  metricNumber: {
    fontSize: 24,  // Reduced from 32
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1,
  },
  metricUnit: {
    fontSize: 11,  // Reduced from 14
    color: 'rgba(255, 255, 255, 0.6)',
  },
  
  // Timeline
  timeline: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },
  timelineStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    opacity: 0.3,
    transition: 'opacity 0.3s ease',
  },
  timelineStepActive: {
    opacity: 1,
  },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  timelineDotActive: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#6366f1',
    border: '1px solid #8b5cf6',
    boxShadow: '0 0 8px rgba(99, 102, 241, 0.8)',
  },
  timelineLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
  
  // Mission time
  missionTime: {
    fontSize: 22,  // Reduced from 28
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 2,
    marginTop: 2,
  },
  
  // Event label
  eventLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: '#6366f1',
    letterSpacing: 1.3,
    marginTop: 1,
  },
  
  // Engine status
  engines: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  engineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 2,
    width: 36,
  },
  engineDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'all 0.2s ease',
  },
  engineDotCenter: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'all 0.2s ease',
  },
  engineDotActive: {
    background: '#ff6600',
    border: '1px solid #ff8833',
    boxShadow: '0 0 6px rgba(255, 102, 0, 0.8)',
  },
  engineDotSingle: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'all 0.2s ease',
    gridColumn: '1 / -1',
    justifySelf: 'center',
  },
};

export default Telemetry;
