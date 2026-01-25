/**
 * API Service - Backend Integration Layer
 * 
 * Provides typed fetch wrappers for the apogee-launch FastAPI backend.
 * 
 * @see packages/apogee-launch/src/apogee_launch/simulator.py for backend implementation
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============ REQUEST TYPES ============

/**
 * Parameters for launch simulation request.
 * Maps to `solve_to_circular_orbit()` in apogee-launch.
 */
export interface LaunchParams {
    /** Target orbital altitude in kilometers (160-400 km for LEO) */
    h_target_km: number;

    /** Payload mass in kilograms (0-10000 kg) */
    payload_kg: number;

    /** Initial guess for pitch-over angle in degrees (optional) */
    theta0_deg?: number;

    /** Initial guess for coast duration in seconds (optional) */
    t_coast?: number;

    /** Initial guess for stage 2 burn time in seconds (optional) */
    t_burn2?: number;

    /** Whether to include full trajectory data in response */
    include_trajectory?: boolean;
}

// ============ RESPONSE TYPES ============

/**
 * Optimal control parameters found by the shooting method.
 */
export interface OptimalNumerics {
    /** Optimal pitch-over angle in radians */
    theta0_rad: number;

    /** Optimal coast phase duration in seconds */
    t_coast_s: number;

    /** Optimal stage 2 burn duration in seconds */
    t_burn2_s: number;

    /** Optimal stage 2 steering angle in radians */
    alpha2_rad: number;
}

/**
 * Mission success metrics.
 */
export interface MissionSummary {
    /** Final orbital eccentricity (0 = perfect circle) */
    ecc: number;

    /** Altitude error from target in meters */
    h_err_m: number;

    /** Velocity error from circular orbit in m/s */
    v_err_mps: number;

    /** Final flight-path angle in degrees (0 = horizontal) */
    gamma_deg: number;
}

/**
 * Full trajectory data for visualization.
 */
export interface TrajectoryData {
    /** Time points in seconds */
    t_s: number[];

    /** Geocentric radius in meters */
    r_m: number[];

    /** Downrange central angle in radians */
    lambda_rad: number[];

    /** Altitude in meters */
    h_m: number[];

    /** Velocity magnitude in m/s */
    v_mps: number[];

    /** Flight-path angle in radians */
    gamma_rad: number[];

    /** 3D position data for visualization */
    pos_m: {
        x: number[];
        y: number[];
        z: number[];
    };

    /** Mass in kg (optional) */
    m_kg?: number[];

    /** Dynamic pressure in Pa (optional) */
    q_pa?: number[];

    /** Mach number (optional) */
    mach?: number[];

    /** Drag force in N (optional) */
    drag_n?: number[];

    orbit?: {
        specific_energy?: number;
        specific_angular_momentum?: number;
        semi_major_axis: number;
        eccentricity?: number;
        r_apoapsis?: number;
        r_periapsis?: number;
    };
}

/**
 * Complete launch simulation response.
 * Maps to `LaunchResult` in apogee-launch.
 */
export interface LaunchResponse {
    /** API schema version for compatibility checking */
    schema_version: number;

    /** Echo of input parameters */
    inputs: Record<string, number>;

    /** Optimal control parameters found by solver */
    optimal_numerics: OptimalNumerics;

    /** Mission success metrics */
    summary: MissionSummary;

    /** Full trajectory (only if include_trajectory=true) */
    trajectory?: TrajectoryData;
}

// ============ API FUNCTIONS ============

/**
 * Simulate a rocket launch to circular orbit.
 * 
 * Calls the apogee-launch backend to compute optimal trajectory
 * using numerical shooting methods.
 * 
 * @param params - Launch configuration parameters
 * @returns Promise with simulation results and optional trajectory
 * @throws Error if API call fails or validation errors occur
 * 
 * @example
 * ```typescript
 * const result = await simulateLaunch({
 *   h_target_km: 200,
 *   payload_kg: 5000,
 *   include_trajectory: true
 * });
 * console.log(`Eccentricity: ${result.summary.ecc}`);
 * ```
 */
export async function simulateLaunch(params: LaunchParams): Promise<LaunchResponse> {
    const response = await fetch(`${API_BASE_URL}/launch/simulate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorText = await response.text();

        // Try to parse JSON error from backend
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) {
                // Parse shooting convergence error format
                const detail = errorJson.detail;
                const match = detail.match(/Shooting did not converge \(evals=(\d+)\/(\d+), u=\[([^\]]+)\], \|\|F\|\|=([\d.]+), F=\[([^\]]+)\]\)/);

                if (match) {
                    const error = new Error('CONVERGENCE_ERROR') as Error & { convergenceData: object };
                    error.convergenceData = {
                        evaluations: `${match[1]}/${match[2]}`,
                        parameters: match[3].split(',').map((v: string) => parseFloat(v.trim())),
                        residualNorm: parseFloat(match[4]),
                        residuals: match[5].split(',').map((v: string) => parseFloat(v.trim())),
                    };
                    throw error;
                }

                throw new Error(detail);
            }
            throw new Error(errorText);
        } catch (parseError) {
            if (parseError instanceof Error && parseError.message === 'CONVERGENCE_ERROR') {
                throw parseError;
            }
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
    }

    return response.json();
}

// ============ ORBIT ENDPOINTS ============

export interface OrbitTrajectoryRequest {
    r_m: number;
    nu_initial_rad: number;
    sun_x: number;
    sun_y: number;
    sun_z: number;
    t_duration_s?: number;
    n_points?: number;
}

export interface OrbitTrajectoryResponse {
    orbit_params: {
        semi_major_axis_m: number;
        period_s: number;
        mean_motion_rad_s: number;
        nu_initial_rad: number;
        t_duration_s: number;
    };
    trajectory: {
        x_m: number[];
        y_m: number[];
        z_m: number[];
    };
    yaw_steering: {
        t_s: number[];
        yaw_rad: number[];
        yaw_deg: number[];
        beta_rad: number[];
        beta_deg: number[];
        panel_angle_rad: number[];
        panel_angle_deg: number[];
        nu_rad: number[];
    };
}

export interface YawRequest {
    r_m: number;
    nu_initial_rad: number;
    sun_x: number;
    sun_y: number;
    sun_z: number;
    t_s: number;
}

export interface YawResponse {
    yaw_rad: number;
    yaw_deg: number;
    beta_rad: number;
    beta_deg: number;
    panel_angle_rad: number;
    panel_angle_deg: number;
    sun_body: number[];
    satellite_position: number[];
}

export async function getOrbitTrajectory(
    params: OrbitTrajectoryRequest
): Promise<OrbitTrajectoryResponse> {
    const response = await fetch(`${API_BASE_URL}/orbit/trajectory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) throw new Error(errorJson.detail);
        } catch {
            // ignore parse
        }
        throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

export async function getYawInstant(params: YawRequest): Promise<YawResponse> {
    const response = await fetch(`${API_BASE_URL}/orbit/yaw`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.detail) throw new Error(errorJson.detail);
        } catch {
            // ignore parse
        }
        throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

/**
 * Health check for the backend API.
 * 
 * @returns Promise that resolves if backend is healthy
 * @throws Error if backend is unreachable
 */
export async function checkApiHealth(): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);

    if (!response.ok) {
        throw new Error('Backend API is not available');
    }

    return response.json();
}
