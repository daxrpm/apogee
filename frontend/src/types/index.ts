/**
 * Shared Types for Apogee Frontend
 * 
 * Centralized type definitions used across multiple components.
 * Following DRY principle - single source of truth for types.
 */

// ============ SCENE TYPES ============

/** Available scenes in the navigation flow */
export type SceneType = 'orbit_intro' | 'ecuador' | 'quito' | 'pedernales' | 'beach' | 'launch' | 'orbit';

/** Navigation flow order */
export const SCENE_ORDER: SceneType[] = ['orbit_intro', 'ecuador', 'quito', 'pedernales', 'beach', 'launch', 'orbit'];

// ============ TERRAIN TYPES ============

/** Available terrain regions */
export type RegionId = 'ecuador' | 'quito' | 'pedernales' | 'launch_beach';

/** Available satellite texture sources */
export type TextureOption = 'google' | 'bing' | 'google_hybrid';

/** Configuration for a terrain region */
export interface RegionConfig {
    id: RegionId;
    label: string;
    width: number;
    height: number;
    elevation: number;
}

/** Configuration for a texture option */
export interface TextureConfig {
    id: TextureOption;
    label: string;
    icon: string;
}

// ============ REGION CONFIGURATIONS ============

export const REGIONS: RegionConfig[] = [
    { id: 'ecuador', label: '🇪🇨 Ecuador', width: 12, height: 7.22, elevation: 0.6 },
    { id: 'quito', label: '🏙️ Quito', width: 12, height: 7.22, elevation: 1.2 },
    { id: 'pedernales', label: '🏖️ Pedernales', width: 12, height: 7.21, elevation: 1.5 },
    { id: 'launch_beach', label: '🚀 Launch Beach', width: 12, height: 7.21, elevation: 1.5 },
];

export const TEXTURE_OPTIONS: TextureConfig[] = [
    { id: 'google', label: 'Google', icon: '🌍' },
    { id: 'bing', label: 'Bing', icon: '🗺️' },
    { id: 'google_hybrid', label: 'Hybrid', icon: '🛤️' },
];

// ============ SCENE INFO ============

export interface SceneInfo {
    title: string;
    subtitle: string;
    emoji: string;
}

export const SCENE_INFO: Record<SceneType, SceneInfo> = {
    orbit_intro: { title: 'ORBIT', subtitle: 'Earth From Above • Globe View', emoji: '🌍' },
    ecuador: { title: 'ECUADOR', subtitle: 'Gateway to Space • 0° Latitude', emoji: '🇪🇨' },
    quito: { title: 'QUITO', subtitle: 'Capital City • 2,850m Elevation', emoji: '🏙️' },
    pedernales: { title: 'PEDERNALES', subtitle: 'Pacific Coast • Launch Region', emoji: '🏖️' },
    beach: { title: 'LAUNCH SITE', subtitle: 'Falcon 9 Ready for Launch', emoji: '🚀' },
    launch: { title: 'LAUNCH', subtitle: 'Trajectory in Progress', emoji: '🚀' },
    orbit: { title: 'ORBIT', subtitle: 'Orbital Insertion Complete', emoji: '🛰️' },
};

// ============ API TYPES ============

export interface ConvergenceError {
    evaluations: string;
    parameters: number[];
    residualNorm: number;
    residuals: number[];
}
