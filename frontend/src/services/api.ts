
const API_URL = 'http://localhost:8000';

export interface LaunchParams {
    h_target_km: number;
    payload_kg: number;
    theta0_deg?: number;
    t_coast?: number;
    t_burn2?: number;
    include_trajectory?: boolean;
}

export interface LaunchResponse {
    schema_version: number;
    inputs: Record<string, number>;
    optimal_numerics: {
        theta0_rad: number;
        t_coast_s: number;
        t_burn2_s: number;
        alpha2_rad: number;
    };
    summary: {
        ecc: number;
        h_err_m: number;
        v_err_mps: number;
        gamma_deg: number;
    };
    trajectory?: {
        t_s: number[];
        h_m: number[];
        v_mps: number[];
        gamma_rad: number[];
        pos_m: {
            x: number[];
            y: number[];
            z: number[];
        };
    };
}

export async function simulateLaunch(params: LaunchParams): Promise<LaunchResponse> {
    const response = await fetch(`${API_URL}/launch/simulate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        throw new Error(`Launch simulation failed: ${response.statusText}`);
    }

    return response.json();
}
