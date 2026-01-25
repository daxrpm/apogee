import { useState } from 'react';
import { useSimulationStore } from '../../stores/simulationStore';

export function ControlPanel() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    hTargetKm,
    payloadKg,
    theta0Deg,
    tCoastS,
    tBurn2S,
    skipLaunch3D,
    isLoading,
    error,
    errorData,
    setHTargetKm,
    setPayloadKg,
    setTheta0Deg,
    setTCoastS,
    setTBurn2S,
    setSkipLaunch3D,
    startSimulation,
    clearError,
  } = useSimulationStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSimulation();
  };

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.logo}>◆ APOGEE</div>
          <div style={styles.subtitle}>LAUNCH CONTROL</div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Main Parameters */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              TARGET ALTITUDE
              <span style={styles.unit}>km</span>
            </label>
            <input
              type="number"
              value={hTargetKm}
              onChange={(e) => setHTargetKm(Number(e.target.value))}
              min={160}
              max={400}
              step={1}
              style={styles.input}
              disabled={isLoading}
            />
            <div style={styles.range}>160 - 400 km (LEO)</div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              PAYLOAD MASS
              <span style={styles.unit}>kg</span>
            </label>
            <input
              type="number"
              value={payloadKg}
              onChange={(e) => setPayloadKg(Number(e.target.value))}
              min={0}
              max={10000}
              step={100}
              style={styles.input}
              disabled={isLoading}
            />
            <div style={styles.range}>0 - 10,000 kg</div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={styles.advancedToggle}
          >
            {showAdvanced ? '▼' : '▶'} ADVANCED OPTIONS
          </button>

          {/* Advanced Parameters */}
          {showAdvanced && (
            <div style={styles.advancedSection}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  PITCH-OVER ANGLE
                  <span style={styles.unit}>deg</span>
                </label>
                <input
                  type="number"
                  value={theta0Deg ?? ''}
                  onChange={(e) => setTheta0Deg(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Auto"
                  step={0.1}
                  style={styles.input}
                  disabled={isLoading}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  COAST DURATION
                  <span style={styles.unit}>s</span>
                </label>
                <input
                  type="number"
                  value={tCoastS ?? ''}
                  onChange={(e) => setTCoastS(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Auto"
                  step={1}
                  style={styles.input}
                  disabled={isLoading}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  STAGE 2 BURN
                  <span style={styles.unit}>s</span>
                </label>
                <input
                  type="number"
                  value={tBurn2S ?? ''}
                  onChange={(e) => setTBurn2S(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Auto"
                  step={1}
                  style={styles.input}
                  disabled={isLoading}
                />
              </div>

              <div style={styles.checkboxRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={skipLaunch3D}
                    onChange={(e) => setSkipLaunch3D(e.target.checked)}
                    disabled={isLoading}
                    style={styles.checkbox}
                  />
                  SKIP LAUNCH 3D
                </label>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={styles.errorContainer}>
              <div style={styles.errorHeader}>
                <span>⚠️ {error}</span>
                <button 
                  type="button" 
                  onClick={clearError}
                  style={styles.errorClose}
                >
                  ×
                </button>
              </div>
              {errorData && (
                <div style={styles.errorDetails}>
                  <div style={styles.errorRow}>
                    <span style={styles.errorLabel}>Evaluations:</span>
                    <span>{errorData.evaluations}</span>
                  </div>
                  <div style={styles.errorRow}>
                    <span style={styles.errorLabel}>Residual ||F||:</span>
                    <span>{errorData.residualNorm.toExponential(4)}</span>
                  </div>
                  <div style={styles.errorRow}>
                    <span style={styles.errorLabel}>Parameters:</span>
                  </div>
                  <div style={styles.errorParams}>
                    <span>θ₀: {(errorData.parameters[0] * 180 / Math.PI).toFixed(2)}°</span>
                    <span>t_coast: {errorData.parameters[2].toFixed(1)}s</span>
                    <span>t_burn2: {errorData.parameters[3].toFixed(1)}s</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Launch Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.launchButton,
              ...(isLoading ? styles.launchButtonLoading : {}),
            }}
          >
            {isLoading ? (
              <div style={styles.loadingContent}>
                <div style={styles.spinner} />
                CALCULATING TRAJECTORY...
              </div>
            ) : (
              'START SIMULATION'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          FALCON 9 • PEDERNALES, ECUADOR
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 100,
    fontFamily: "'Roboto Mono', 'SF Mono', monospace",
  },
  panel: {
    background: 'rgba(0, 0, 0, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    padding: '20px',
    minWidth: '280px',
    color: '#fff',
    backdropFilter: 'blur(10px)',
  },
  header: {
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '15px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '2px',
    color: '#fff',
  },
  subtitle: {
    fontSize: '10px',
    letterSpacing: '3px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '10px',
    letterSpacing: '1px',
    color: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unit: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '9px',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '2px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '16px',
    fontFamily: "'Roboto Mono', monospace",
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  range: {
    fontSize: '9px',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  advancedToggle: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '10px',
    letterSpacing: '1px',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '8px 0',
    transition: 'color 0.2s',
  },
  advancedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingLeft: '12px',
    borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingTop: '4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '10px',
    letterSpacing: '1px',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: '#1a73e8',
  },
  errorContainer: {
    background: 'rgba(255, 100, 100, 0.15)',
    border: '1px solid rgba(255, 100, 100, 0.3)',
    borderRadius: '2px',
    padding: '10px 12px',
    fontSize: '11px',
    color: '#ff6b6b',
  },
  errorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  errorDetails: {
    borderTop: '1px solid rgba(255, 100, 100, 0.2)',
    paddingTop: '8px',
    fontSize: '10px',
  },
  errorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  errorLabel: {
    color: 'rgba(255, 150, 150, 0.7)',
  },
  errorParams: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    paddingLeft: '8px',
    color: 'rgba(255, 200, 200, 0.8)',
    fontFamily: "'Roboto Mono', monospace",
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  launchButton: {
    background: 'linear-gradient(180deg, #1a73e8 0%, #1557b0 100%)',
    border: 'none',
    borderRadius: '2px',
    padding: '14px 20px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '8px',
  },
  launchButtonLoading: {
    background: 'rgba(255, 255, 255, 0.1)',
    cursor: 'not-allowed',
  },
  loadingContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  footer: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '9px',
    letterSpacing: '1px',
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
  },
};

// Add keyframe animation for spinner
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}
