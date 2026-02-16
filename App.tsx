
import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, GameStats, Obstacle, AIEvent, ModifierType, AssetMap, LANES } from './types';
import { 
  GAME_SPEED_START, 
  MAX_SPEED, 
  ACCELERATION, 
  PLAYER_JUMP_FORCE, 
  GRAVITY 
} from './constants';
import GameHUD from './components/GameHUD';
import ArchitectureDocs from './components/ArchitectureDocs';
import { getAINarrativeEvent } from './services/geminiService';
import { checkCollision } from './utils/gamePhysics';

const ASSETS = {
  CITY_FAR: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80',
  CITY_MID: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80',
  GROUND_TEX: 'https://images.unsplash.com/photo-1533230393619-3f0f46149842?auto=format&fit=crop&w=800&q=80',
  TRAIN_TEX: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80'
};

const OBSTACLE_POOL_SIZE = 10;

class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private assets: AssetMap;

  constructor(ctx: CanvasRenderingContext2D, assets: AssetMap) {
    this.ctx = ctx;
    this.assets = assets;
  }

  public render(w: number, h: number, data: any, stats: GameStats) {
    const { ctx, assets } = this;
    const horizon = h * 0.55;

    // Optimized filtering logic
    ctx.filter = data.isChronoShifting 
      ? 'invert(0.1) hue-rotate(90deg) contrast(1.2) saturate(1.5)' 
      : data.currentModifier === 'GLITCH_MODE' && data.frameCount % 5 === 0 
        ? `hue-rotate(${Math.random() * 360}deg) brightness(1.5)` 
        : 'none';

    // Sky & Far Parallax
    if (assets.CITY_FAR && assets.CITY_MID) {
      const farX = -(data.bgOffset * 0.1) % w;
      ctx.drawImage(assets.CITY_FAR, farX, 0, w, horizon);
      ctx.drawImage(assets.CITY_FAR, farX + w, 0, w, horizon);
      const midX = -(data.bgOffset * 0.5) % w;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(assets.CITY_MID, midX, horizon - 400, w, 400);
      ctx.drawImage(assets.CITY_MID, midX + w, horizon - 400, w, 400);
      ctx.globalAlpha = 1.0;
    }

    // Atmosphere
    ctx.fillStyle = `hsla(${180 + Math.min(100, stats.multiplier * 10)}, 70%, 50%, 0.1)`;
    ctx.fillRect(0, 0, w, horizon);

    // Ground
    if (assets.GROUND_TEX) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, w, h - horizon);
      ctx.clip();
      const pX = -(data.bgOffset * 2) % 400;
      for (let x = -400; x < w + 400; x += 400) ctx.drawImage(assets.GROUND_TEX, x + pX, horizon, 400, h - horizon);
      ctx.restore();
    }

    // Render Speedlines
    ctx.strokeStyle = data.isChronoShifting ? 'rgba(52, 211, 153, 0.4)' : 'rgba(51, 65, 85, 0.4)';
    for (let i = 0; i < 15; i++) {
      const p = 600 / (600 + (i * 200 - (data.bgOffset * 10) % 200));
      if (p > 0 && p < 1) {
        const y = horizon + (h - horizon) * p;
        ctx.beginPath();
        ctx.moveTo(w/2 - 2000 * p, y);
        ctx.lineTo(w/2 + 2000 * p, y);
        ctx.stroke();
      }
    }

    // Render Pool-based Obstacles
    data.obstacles.forEach((obs: Obstacle) => {
      if (!obs.active) return;
      const p = 600 / (600 + obs.z);
      const x = w/2 + LANES[obs.lane] * p;
      const y = horizon + (h - horizon) * p;
      const bw = 160 * p;
      const bh = obs.height * 2.5 * p;

      if (obs.type === 'TRAIN' && assets.TRAIN_TEX) {
        ctx.drawImage(assets.TRAIN_TEX, x - bw/2, y - bh, bw, bh);
      } else {
        ctx.fillStyle = obs.type === 'TRAIN' ? '#1e293b' : '#be123c';
        ctx.fillRect(x - bw/2, y - bh, bw, bh);
      }
    });

    // Character
    const pP = 600 / (600 + 80);
    const pX = w/2 + LANES[data.playerLane] * pP;
    const pY = horizon + (h - horizon) * pP - (data.playerY * pP * 2.5);
    this.drawChar(pX, pY, 70 * pP, data.frameCount, data.playerY > 0);
  }

  private drawChar(x: number, y: number, s: number, f: number, j: boolean) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.abs(Math.cos(f * 0.1)) * 5;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(0, -s * 1.5 + bob, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [activeEvent, setActiveEvent] = useState<AIEvent | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    score: 0, coins: 0, multiplier: 1, distance: 0, syncLevel: 100, chronoEnergy: 100
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const requestRef = useRef<number>();
  
  const gameData = useRef({
    playerLane: 1, playerY: 0, playerJumpVelocity: 0,
    obstacles: Array.from({ length: OBSTACLE_POOL_SIZE }, () => ({
      id: '', lane: 0, z: -100, type: 'BARRIER', height: 50, active: false
    })) as Obstacle[],
    speed: GAME_SPEED_START, spawnTimer: 0, frameCount: 0, bgOffset: 0,
    currentModifier: 'NORMAL' as ModifierType, modifierTimer: 0,
    isChronoShifting: false, nextAIEventScore: 500, currentScore: 0
  });

  useEffect(() => {
    const preload = async () => {
      const assets: AssetMap = {};
      const load = Promise.all(Object.entries(ASSETS).map(([key, url]) => {
        return new Promise((res) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
          img.onload = () => { assets[key] = img; res(true); };
          img.onerror = () => res(false);
        });
      }));
      // Fix: r(null) ensures the resolve function is called with an argument to match the signature (value: any) => void
      await Promise.race([load, new Promise(r => setTimeout(() => r(null), 6000))]);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) rendererRef.current = new GameRenderer(ctx, assets);
      }
      setImagesLoaded(true);
    };
    preload();
  }, []);

  const spawnFromPool = useCallback(() => {
    const data = gameData.current;
    const pooled = data.obstacles.find(o => !o.active);
    if (pooled) {
      pooled.active = true;
      pooled.z = 3500;
      pooled.lane = Math.floor(Math.random() * 3);
      pooled.type = Math.random() > 0.85 ? 'TRAIN' : 'BARRIER';
      pooled.height = pooled.type === 'TRAIN' ? 140 : 50;
    }
  }, []);

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    const data = gameData.current;
    data.frameCount++;
    const tScale = data.isChronoShifting ? 0.3 : 1.0;
    
    setStats(prev => {
      const dS = (data.speed * prev.multiplier / 10) * tScale;
      data.currentScore = prev.score + dS;
      return {
        ...prev,
        score: prev.score + dS,
        distance: prev.distance + (data.speed / 10) * tScale,
        chronoEnergy: data.isChronoShifting ? Math.max(0, prev.chronoEnergy - 1.5) : Math.min(100, prev.chronoEnergy + 0.1),
        multiplier: 1 + Math.floor(prev.distance / 500)
      };
    });

    if (data.frameCount % 60 === 0 && data.nextAIEventScore < data.currentScore) {
       getAINarrativeEvent(Math.floor(data.currentScore)).then(ev => {
         setActiveEvent(ev);
         data.currentModifier = ev.modifier;
         data.modifierTimer = ev.duration * 60;
         data.nextAIEventScore += 2000;
       });
    }

    data.speed = Math.min(MAX_SPEED, data.speed + ACCELERATION * tScale);
    data.bgOffset += data.speed * 0.2 * tScale;

    // Movement & Collision
    if (data.playerY > 0 || data.playerJumpVelocity !== 0) {
      data.playerY += data.playerJumpVelocity * tScale;
      data.playerJumpVelocity -= GRAVITY * (data.currentModifier === 'LOW_GRAVITY' ? 0.4 : 1) * tScale;
      if (data.playerY < 0) { data.playerY = 0; data.playerJumpVelocity = 0; }
    }

    data.spawnTimer += data.speed * tScale;
    if (data.spawnTimer > 400) { spawnFromPool(); data.spawnTimer = 0; }

    data.obstacles.forEach(obs => {
      if (!obs.active) return;
      obs.z -= data.speed * tScale;
      if (checkCollision(data.playerLane, data.playerY, 50, obs)) setGameState(GameState.GAMEOVER);
      if (obs.z < -100) obs.active = false;
    });

    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, data, stats);
    }
    requestRef.current = requestAnimationFrame(update);
  }, [gameState, stats]);

  useEffect(() => {
    const res = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; }};
    window.addEventListener('resize', res); res();
    return () => window.removeEventListener('resize', res);
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING && imagesLoaded) requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, update, imagesLoaded]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      if (e.key === 'ArrowLeft') gameData.current.playerLane = Math.max(0, gameData.current.playerLane - 1);
      if (e.key === 'ArrowRight') gameData.current.playerLane = Math.min(2, gameData.current.playerLane + 1);
      if (e.key === ' ' || e.key === 'ArrowUp') { if (gameData.current.playerY === 0) gameData.current.playerJumpVelocity = PLAYER_JUMP_FORCE; }
      if (e.key === 'Shift') gameData.current.isChronoShifting = true;
    };
    const ku = (e: KeyboardEvent) => { if (e.key === 'Shift') gameData.current.isChronoShifting = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [gameState]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      <canvas ref={canvasRef} className="block w-full h-full" aria-label="Game Canvas" />
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-20">
          <h1 className="text-8xl font-orbitron font-bold text-white mb-12">HYPER<span className="text-cyan-400">RUN</span></h1>
          <button 
            onClick={() => { 
              gameData.current.obstacles.forEach(o => o.active = false);
              setStats({score:0, coins:0, multiplier:1, distance:0, syncLevel:100, chronoEnergy:100});
              setGameState(GameState.PLAYING); 
            }} 
            className="px-12 py-6 bg-cyan-500 text-slate-950 font-bold rounded-2xl text-2xl hover:bg-cyan-400 transition-all shadow-[0_0_40px_rgba(6,182,212,0.4)]"
            aria-label="Start simulation"
          >
            CONNECT TO NEXUS
          </button>
        </div>
      )}
      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="bg-slate-900 border-t-4 border-red-500 p-12 rounded-3xl text-center">
            <h2 className="text-5xl font-orbitron text-white mb-8">LINK SEVERED</h2>
            <p className="text-cyan-400 text-3xl font-orbitron mb-12">{Math.floor(stats.score).toLocaleString()}</p>
            <button onClick={() => setGameState(GameState.MENU)} className="w-full py-5 bg-red-600 text-white font-bold rounded-xl text-xl hover:bg-red-500 transition-all">RE-SYNC NEURAL LINK</button>
          </div>
        </div>
      )}
      {gameState === GameState.PLAYING && <GameHUD stats={stats} activeEvent={activeEvent} />}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.5)_100%)] z-10" />
    </div>
  );
};

export default App;
