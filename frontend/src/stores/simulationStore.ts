import { create } from 'zustand';
import { simulateLaunch, type LaunchResponse, type LaunchParams } from '../services/api';

export type SceneType = 'ecuador' | 'quito' | 'pedernales' | 'beach' | 'launch' | 'orbit';

interface SimulationState {
  // Navigation
  currentScene: SceneType;
  
  // Launch parameters
  hTargetKm: number;
  payloadKg: number;
  theta0Deg: number | null;
  tCoastS: number | null;
  tBurn2S: number | null;
  
  // API state
  isLoading: boolean;
  error: string | null;
  launchData: LaunchResponse | null;
  
  // Animation state
  animationTime: number;
  isPlaying: boolean;
  
  // Sun vector for orbit phase
  sunVector: [number, number, number];
}

interface SimulationActions {
  // Navigation
  setScene: (scene: SceneType) => void;
  
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
  
  // Orbit
  setSunVector: (vec: [number, number, number]) => void;
  
  // Reset
  replay: () => void;
  reset: () => void;
}

type SimulationStore = SimulationState & SimulationActions;

const initialState: SimulationState = {
  currentScene: 'beach',
  hTargetKm: 200,
  payloadKg: 5000,
  theta0Deg: null,
  tCoastS: null,
  tBurn2S: null,
  isLoading: false,
  error: null,
  launchData: null,
  animationTime: 0,
  isPlaying: false,
  sunVector: [1, 0, 0],
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  ...initialState,
  
  // Navigation
  setScene: (scene) => set({ currentScene: scene }),
  
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
      
      // Add optional params if set
      if (state.theta0Deg !== null) {
        params.theta0_deg = state.theta0Deg;
      }
      if (state.tCoastS !== null) {
        params.t_coast = state.tCoastS;
      }
      if (state.tBurn2S !== null) {
        params.t_burn2 = state.tBurn2S;
      }
      
      const result = await simulateLaunch(params);
      
      set({ 
        launchData: result, 
        isLoading: false,
        currentScene: 'launch',
        isPlaying: true,
        animationTime: 0,
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Simulation failed',
        isLoading: false,
      });
    }
  },
  
  clearError: () => set({ error: null }),
  
  // Animation
  setAnimationTime: (time) => set({ animationTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  // Orbit
  setSunVector: (vec) => set({ sunVector: vec }),
  
  // Reset
  replay: () => set({ 
    currentScene: 'launch',
    animationTime: 0,
    isPlaying: true,
  }),
  
  reset: () => set({ 
    ...initialState,
    launchData: get().launchData, // Keep last simulation for replay
  }),
}));
