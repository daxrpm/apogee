/**
 * Simulation Store - Global state management with Zustand
 * 
 * Manages navigation, launch parameters, simulation results, and animation state.
 * Single source of truth for the entire application state.
 * 
 * @module stores/simulationStore
 */

import { create } from 'zustand';
import {
  simulateLaunch,
  getOrbitTrajectory,
  type LaunchResponse,
  type LaunchParams,
  type OrbitTrajectoryResponse,
} from '../services/api';
import { SCENE_ORDER, type SceneType, type ConvergenceError } from '../types';

// ============ STATE INTERFACE ============

interface SimulationState {
  // Navigation
  currentScene: SceneType;
  hasSeenIntro: boolean;

  // Launch parameters
  hTargetKm: number;
  payloadKg: number;
  theta0Deg: number | null;
  tCoastS: number | null;
  tBurn2S: number | null;

  // API state
  isLoading: boolean;
  error: string | null;
  errorData: ConvergenceError | null;
  launchData: LaunchResponse | null;

  // Animation state
  animationTime: number;
  isPlaying: boolean;

  // Propulsion FX
  enginesActive: boolean;
  currentStage: 1 | 2;

  // Orbit phase
  sunVector: [number, number, number];

  skipLaunch3D: boolean;

  orbitParams: { r_m: number; nu_initial_rad: number } | null;
  orbitData: OrbitTrajectoryResponse | null;
  orbitLoading: boolean;
  orbitError: string | null;
}

// ============ ACTIONS INTERFACE ============

interface SimulationActions {
  // Navigation
  setScene: (scene: SceneType) => void;
  nextScene: () => void;
  prevScene: () => void;
  skipToBeach: () => void;

  // Parameters
  setHTargetKm: (value: number) => void;
  setPayloadKg: (value: number) => void;
  setTheta0Deg: (value: number | null) => void;
  setTCoastS: (value: number | null) => void;
  setTBurn2S: (value: number | null) => void;

  // Simulation
  startSimulation: () => Promise<void>;
  clearError: () => void;

  // Animation
  setAnimationTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setEnginesActive: (active: boolean) => void;
  setCurrentStage: (stage: 1 | 2) => void;

  // Orbit
  setSunVector: (vec: [number, number, number]) => void;
  fetchOrbitTrajectory: () => Promise<void>;
  clearOrbitError: () => void;

  setSkipLaunch3D: (value: boolean) => void;
  skipToOrbit: () => void;

  // Reset
  replay: () => void;
  reset: () => void;
  restartFromIntro: () => void;
}

type SimulationStore = SimulationState & SimulationActions;

// ============ INITIAL STATE ============

const initialState: SimulationState = {
  currentScene: 'ecuador',
  hasSeenIntro: false,
  hTargetKm: 200,
  payloadKg: 5000,
  theta0Deg: null,
  tCoastS: null,
  tBurn2S: null,
  isLoading: false,
  error: null,
  errorData: null,
  launchData: null,
  animationTime: 0,
  isPlaying: false,
  enginesActive: false,
  currentStage: 1,
  sunVector: [1, 0, 0],
  skipLaunch3D: false,
  orbitParams: null,
  orbitData: null,
  orbitLoading: false,
  orbitError: null,
};

// ============ STORE ============

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  ...initialState,

  // Navigation
  setScene: (scene) => set({ currentScene: scene }),

  nextScene: () => {
    const { currentScene } = get();
    const currentIndex = SCENE_ORDER.indexOf(currentScene);
    if (currentIndex < SCENE_ORDER.length - 1) {
      const nextSceneType = SCENE_ORDER[currentIndex + 1];
      const hasSeenIntro = currentScene === 'pedernales' ? true : get().hasSeenIntro;
      set({ currentScene: nextSceneType, hasSeenIntro });
    }
  },

  prevScene: () => {
    const { currentScene } = get();
    const currentIndex = SCENE_ORDER.indexOf(currentScene);
    if (currentIndex > 0) {
      set({ currentScene: SCENE_ORDER[currentIndex - 1] });
    }
  },

  skipToBeach: () => set({ currentScene: 'beach', hasSeenIntro: true }),

  // Parameters
  setHTargetKm: (value) => set({ hTargetKm: value }),
  setPayloadKg: (value) => set({ payloadKg: value }),
  setTheta0Deg: (value) => set({ theta0Deg: value }),
  setTCoastS: (value) => set({ tCoastS: value }),
  setTBurn2S: (value) => set({ tBurn2S: value }),

  // Simulation
  startSimulation: async () => {
    const state = get();
    set({ isLoading: true, error: null });

    try {
      const params: LaunchParams = {
        h_target_km: state.hTargetKm,
        payload_kg: state.payloadKg,
        include_trajectory: true,
      };

      if (state.theta0Deg !== null) params.theta0_deg = state.theta0Deg;
      if (state.tCoastS !== null) params.t_coast = state.tCoastS;
      if (state.tBurn2S !== null) params.t_burn2 = state.tBurn2S;

      const result = await simulateLaunch(params);

      const r_m = result.trajectory?.orbit?.semi_major_axis;
      const nu_initial_rad = result.trajectory?.lambda_rad?.[result.trajectory.lambda_rad.length - 1];

      set({
        launchData: result,
        isLoading: false,
        currentScene: state.skipLaunch3D ? 'orbit' : 'launch',
        isPlaying: state.skipLaunch3D ? false : true,
        animationTime: 0,
        enginesActive: state.skipLaunch3D ? false : true,
        currentStage: 1,
        orbitParams: typeof r_m === 'number' && typeof nu_initial_rad === 'number' ? { r_m, nu_initial_rad } : null,
        orbitData: null,
        orbitLoading: false,
        orbitError: null,
      });

      void get().fetchOrbitTrajectory();
    } catch (error) {
      const err = error as Error & { convergenceData?: ConvergenceError };
      if (err.message === 'CONVERGENCE_ERROR' && err.convergenceData) {
        set({
          error: 'Simulation did not converge',
          errorData: err.convergenceData,
          isLoading: false,
        });
      } else {
        set({
          error: err.message || 'Simulation failed',
          errorData: null,
          isLoading: false,
        });
      }
    }
  },

  clearError: () => set({ error: null, errorData: null }),

  // Animation
  setAnimationTime: (time) => set({ animationTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setEnginesActive: (active) => set({ enginesActive: active }),
  setCurrentStage: (stage) => set({ currentStage: stage }),

  // Orbit
  setSunVector: (vec) => {
    const [x, y, z] = vec;
    const n = Math.sqrt(x * x + y * y + z * z);
    if (n <= 0) return;
    set({ sunVector: [x / n, y / n, z / n] });
  },
  fetchOrbitTrajectory: async () => {
    const { orbitParams, sunVector } = get();
    if (!orbitParams) return;

    set({ orbitLoading: true, orbitError: null });
    try {
      const [sx, sy, sz] = sunVector;
      const n = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const sun_x = sx / n;
      const sun_y = sy / n;
      const sun_z = sz / n;
      const result = await getOrbitTrajectory({
        r_m: orbitParams.r_m,
        nu_initial_rad: orbitParams.nu_initial_rad,
        sun_x,
        sun_y,
        sun_z,
        n_points: 360,
      });

      set({ orbitData: result, orbitLoading: false });
    } catch (e) {
      const err = e as Error;
      set({ orbitError: err.message || 'Orbit trajectory failed', orbitLoading: false });
    }
  },
  clearOrbitError: () => set({ orbitError: null }),

  setSkipLaunch3D: (value) => set({ skipLaunch3D: value }),

  skipToOrbit: () => {
    const { launchData } = get();
    if (!launchData?.trajectory) return;

    set({
      currentScene: 'orbit',
      isPlaying: false,
      enginesActive: false,
      animationTime: launchData.trajectory.t_s[launchData.trajectory.t_s.length - 1],
    });
  },

  // Reset
  replay: () => set({
    currentScene: 'launch',
    animationTime: 0,
    isPlaying: true,
    enginesActive: true,
    currentStage: 1,
  }),

  reset: () => set({
    ...initialState,
    launchData: get().launchData,
    hasSeenIntro: get().hasSeenIntro,
  }),

  restartFromIntro: () => set({
    ...initialState,
    launchData: null,
  }),
}));

// Re-export types for convenience
export type { SceneType, ConvergenceError };
