import { useTrajectoryTelemetry, useFlightEvents } from '../../hooks/useTrajectory';
import { useSimulationStore } from '../../stores/simulationStore';

/**
 * Telemetry HUD - SpaceX-style telemetry display
 * 
 * Shows real-time flight data during launch:
 * - Mission time (T+)
 * - Altitude (km)
 * - Velocity (m/s and km/h)
 * - Flight path angle (γ)
 * - Current flight phase
 */

export function Telemetry() {
  const { isPlaying, currentScene } = useSimulationStore();
  const telemetry = useTrajectoryTelemetry();
  const events = useFlightEvents();

  // Only show during launch
  if (currentScene !== 'launch' || !isPlaying) {
    return null;
  }

  // Format time as T+MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `T+${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format altitude
  const altitudeKm = telemetry.altitude / 1000;
  const altitudeDisplay = altitudeKm < 1 
    ? `${Math.round(telemetry.altitude)} m`
    : `${altitudeKm.toFixed(1)} km`;

  // Format velocity
  const velocityMps = Math.round(telemetry.velocity);
  const velocityKmh = Math.round(telemetry.velocity * 3.6);

  // Format gamma (flight path angle)
  const gammaDeg = (telemetry.gamma * 180 / Math.PI).toFixed(1);

  // Phase display
  const phaseLabels: Record<string, string> = {
    'pre-launch': 'PRE-LAUNCH',
    'liftoff': 'LIFTOFF',
    'gravity-turn': 'GRAVITY TURN',
    'maxq': 'MAX-Q',
    'stage-sep': 'STAGE SEPARATION',
    'stage2': 'STAGE 2 BURN',
    'orbit': 'ORBITAL INSERTION',
  };

  return (
    <div style={styles.container}>
      {/* Mission Timer */}
      <div style={styles.timer}>
        {formatTime(telemetry.time)}
      </div>

      {/* Flight Phase */}
      <div style={styles.phase}>
        {phaseLabels[events.phase] || events.phase.toUpperCase()}
      </div>

      {/* Telemetry Grid */}
      <div style={styles.grid}>
        {/* Altitude */}
        <div style={styles.item}>
          <div style={styles.label}>ALTITUDE</div>
          <div style={styles.value}>{altitudeDisplay}</div>
        </div>

        {/* Velocity */}
        <div style={styles.item}>
          <div style={styles.label}>VELOCITY</div>
          <div style={styles.value}>{velocityMps.toLocaleString()} m/s</div>
          <div style={styles.subValue}>{velocityKmh.toLocaleString()} km/h</div>
        </div>

        {/* Flight Path Angle */}
        <div style={styles.item}>
          <div style={styles.label}>FLIGHT ANGLE</div>
          <div style={styles.value}>{gammaDeg}°</div>
        </div>

        {/* Mach (if available) */}
        {telemetry.mach > 0 && (
          <div style={styles.item}>
            <div style={styles.label}>MACH</div>
            <div style={styles.value}>{telemetry.mach.toFixed(2)}</div>
          </div>
        )}

        {/* Dynamic Pressure (if available) */}
        {telemetry.dynamicPressure > 0 && (
          <div style={styles.item}>
            <div style={styles.label}>Q</div>
            <div style={styles.value}>{(telemetry.dynamicPressure / 1000).toFixed(1)} kPa</div>
          </div>
        )}
      </div>

      {/* Event Indicators */}
      <div style={styles.events}>
        {events.isMaxQ && (
          <div style={styles.eventAlert}>⚠️ MAX-Q</div>
        )}
        {events.isStageSep && (
          <div style={styles.eventAlert}>🚀 STAGE SEP</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: 'rgba(0, 0, 0, 0.75)',
    color: 'white',
    padding: '16px 24px',
    borderRadius: 8,
    fontFamily: "'Roboto Mono', 'Courier New', monospace",
    minWidth: 220,
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  timer: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#00ff88',
    letterSpacing: 2,
  },
  phase: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    padding: '4px 12px',
    background: 'rgba(0, 150, 255, 0.3)',
    borderRadius: 4,
    color: '#88ccff',
    fontWeight: 'bold',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
  },
  label: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
    letterSpacing: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subValue: {
    fontSize: 12,
    color: '#888',
  },
  events: {
    marginTop: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  eventAlert: {
    background: 'rgba(255, 100, 0, 0.3)',
    padding: '8px 12px',
    borderRadius: 4,
    textAlign: 'center',
    fontWeight: 'bold',
    animation: 'pulse 1s infinite',
  },
};
