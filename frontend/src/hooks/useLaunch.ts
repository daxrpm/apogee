/**
 * useLaunch Hook - Launch Simulation State Management
 * 
 * Provides a React hook for managing launch simulation state,
 * including loading states, error handling, and result caching.
 * 
 * @module hooks/useLaunch
 */

import { useState, useCallback } from 'react';
import {
    simulateLaunch,
    type LaunchResponse,
    type LaunchParams
} from '../services/api';

/**
 * Hook return type for launch simulation.
 */
export interface UseLaunchReturn {
    /** Trigger a launch simulation */
    launch: (params: LaunchParams) => Promise<LaunchResponse | null>;

    /** Whether simulation is currently running */
    loading: boolean;

    /** Error message if simulation failed */
    error: string | null;

    /** Latest successful simulation result */
    data: LaunchResponse | null;

    /** Clear current data and error state */
    reset: () => void;
}

/**
 * React hook for managing launch simulation state.
 * 
 * Handles API calls, loading states, and error management for
 * the apogee-launch backend integration.
 * 
 * @returns {UseLaunchReturn} Launch state and control functions
 * 
 * @example
 * ```tsx
 * function LaunchButton() {
 *   const { launch, loading, error, data } = useLaunch();
 * 
 *   const handleClick = async () => {
 *     const result = await launch({
 *       h_target_km: 200,
 *       payload_kg: 5000,
 *       include_trajectory: true
 *     });
 *     
 *     if (result) {
 *       console.log('Launch successful:', result.summary.ecc);
 *     }
 *   };
 * 
 *   return (
 *     <button onClick={handleClick} disabled={loading}>
 *       {loading ? 'Simulating...' : 'Launch'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useLaunch(): UseLaunchReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LaunchResponse | null>(null);

    /**
     * Execute a launch simulation with the given parameters.
     * 
     * @param params - Launch configuration
     * @returns Simulation result, or null if failed
     */
    const launch = useCallback(async (params: LaunchParams): Promise<LaunchResponse | null> => {
        setLoading(true);
        setError(null);

        try {
            const result = await simulateLaunch(params);
            setData(result);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(message);
            console.error('[useLaunch] Simulation failed:', message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Reset hook state to initial values.
     */
    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setData(null);
    }, []);

    return {
        launch,
        loading,
        error,
        data,
        reset,
    };
}
