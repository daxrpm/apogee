import { useState, useCallback } from 'react';
import { simulateLaunch, type LaunchResponse, type LaunchParams } from '../services/api';

export function useLaunch() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<LaunchResponse | null>(null);

    const launch = useCallback(async (params: LaunchParams) => {
        setLoading(true);
        setError(null);
        try {
            const result = await simulateLaunch(params);
            setData(result);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        launch,
        loading,
        error,
        data,
    };
}
