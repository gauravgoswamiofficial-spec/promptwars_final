
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  PAUSED = 'PAUSED',
  ARCH_DOCS = 'ARCH_DOCS'
}

export type ModifierType = 'NORMAL' | 'SPEED_UP' | 'LOW_GRAVITY' | 'GLITCH_MODE' | 'CHRONO_SHIFT';

export interface Obstacle {
  id: string;
  lane: number;
  z: number;
  type: 'BARRIER' | 'TRAIN' | 'RAMP' | 'POWERUP';
  height: number;
  active: boolean; // For object pooling
}

export interface GameStats {
  score: number;
  coins: number;
  multiplier: number;
  distance: number;
  syncLevel: number;
  chronoEnergy: number;
}

export interface AIEvent {
  message: string;
  modifier: ModifierType;
  duration: number;
  source?: string; // For Search grounding attribution
}

export interface LevelPattern {
  name: string;
  difficulty: number;
  obstacles: Array<{
    lane: number;
    type: string;
    gap: number;
  }>;
}

export interface AssetMap {
  [key: string]: HTMLImageElement;
}

export const LANES = [-150, 0, 150];
