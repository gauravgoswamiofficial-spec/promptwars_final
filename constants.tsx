
import React from 'react';

export const LANES = [-150, 0, 150];
export const GAME_SPEED_START = 8;
export const MAX_SPEED = 20;
export const ACCELERATION = 0.001;
export const PLAYER_JUMP_FORCE = 15;
export const GRAVITY = 0.8;

export const ARCHITECTURE_SECTIONS = [
  {
    title: "Game Overview & USP",
    icon: "fa-rocket",
    content: `HyperRun: Nexus is a vertical-action endless runner. Unlike traditional 3-lane runners, it features dynamic environment shifting, wall-running mechanics, and a 'Rhythm Pulse' system where obstacles react to the beat. USP: Asynchronous Ghost Multiplayer and AI-Generated Seasonal Tracks.`
  },
  {
    title: "Clean Architecture (MVVM)",
    icon: "fa-layer-group",
    content: `Implemented with a strict separation of concerns. Domain Layer contains the Business Logic (Scoring, Physics). Data Layer handles persistence (Firestore). Presentation Layer (React + Canvas) handles the view state. This ensures the engine can be ported to Unity or Native with minimal logic rewrites.`
  },
  {
    title: "Security & Anti-Cheat",
    icon: "fa-shield-halved",
    content: `Client-side inputs are timestamped and signed. The Backend (Firebase Cloud Functions) runs a 'Simulation Replay' on top scores. If the movement delta exceeds physics constraints, the score is flagged. HTTPS with TLS 1.3 is enforced for all API calls.`
  },
  {
    title: "Efficiency & Object Pooling",
    icon: "fa-microchip",
    content: `To achieve 60-120 FPS on mobile browsers, we use Object Pooling for Obstacles and Particles. Memory allocation is minimized during runtime by reusing Class instances and pre-allocating typed arrays for vertex data.`
  },
  {
    title: "Google Services Integration",
    icon: "fa-google",
    content: `Firebase Auth for cross-platform progression. Google Play Games Services for Global Leaderboards. Firebase Remote Config for A/B testing lane layouts. AdMob for rewarded revivals (Integrated via mediation).`
  }
];
