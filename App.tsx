
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameState, GameStats, Obstacle, AIEvent, ModifierType, AssetMap } from './types';
import { 
  LANES, 
  GAME_SPEED_START, 
  MAX_SPEED, 
  ACCELERATION, 
  PLAYER_JUMP_FORCE, 
  GRAVITY 
} from './constants';
import GameHUD from './components/GameHUD';
import ArchitectureDocs from './components/ArchitectureDocs';
import { getAINarrativeEvent } from './services/geminiService';

const ASSETS = {
  CITY_FAR: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80',
  CITY_MID: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&q=80',
  GROUND_TEX: 'https://images.unsplash.com/photo-1533230393619-3f0f46149842?auto=format&fit=crop&w=800&q=80',
  TRAIN_TEX: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80'
};

/**
 * GameRenderer handles the complex canvas drawing logic to keep App component clean.
 */
class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private assets: AssetMap;

  constructor(ctx: CanvasRenderingContext2D, assets: AssetMap) {
    this.ctx = ctx;
    this.assets = assets;
    this.applyPolyfills();
  }

  private applyPolyfills() {
    if (!(this.ctx as any).roundRect) {
      (this.ctx as any).roundRect = function (x: number, y: number, w: number, h: number, r: number | number[]) {
        const radius = Array.isArray(r) ? r[0] : (r as number);
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + w - radius, y);
        this.quadraticCurveTo(x + w, y, x + w, y + radius);
        this.lineTo(x + w, y + h - radius);
        this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        this.lineTo(x + radius, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
        return this;
      };
    }
  }

  public render(
    w: number, 
    h: number, 
    data: any, 
    stats: GameStats
  ) {
    const { ctx, assets } = this;
    const horizon = h * 0.55;

    // Apply filters
    if (data.isChronoShifting) {
       ctx.filter = 'invert(0.1) hue-rotate(90deg) contrast(1.2) saturate(1.5)';
    } else if (data.currentModifier === 'GLITCH_MODE') {
       if (data.frameCount % 5 === 0) ctx.filter = `hue-rotate(${Math.random() * 360}deg) brightness(1.5)`;
       else ctx.filter = 'none';
    } else {
       ctx.filter = 'none';
    }

    // Sky/Far Parallax
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

    // Atmosphere tint
    const intensity = Math.min(100, stats.multiplier * 10);
    ctx.fillStyle = `hsla(${180 + intensity}, 70%, 50%, 0.15)`;
    ctx.fillRect(0, 0, w, horizon);

    // Ground
    if (assets.GROUND_TEX) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, horizon, w, h - horizon);
        ctx.clip();
        const patternX = -(data.bgOffset * 2) % 400;
        for (let x = -400; x < w + 400; x += 400) {
            ctx.drawImage(assets.GROUND_TEX, x + patternX, horizon, 400, h - horizon);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, horizon, w, h - horizon);
    }

    // Grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.lineWidth = 1;
    [-400, -200, 0, 200, 400].forEach(xOffset => {
      ctx.beginPath();
      ctx.moveTo(w/2 + xOffset * 5, h);
      ctx.lineTo(w/2 + xOffset * 0.05, horizon);
      ctx.stroke();
    });

    // Speed lines
    for (let i = 0; i < 15; i++) {
        const lineZ = (i * 200 - (data.bgOffset * 10) % 200);
        const p = 600 / (600 + lineZ);
        if (p < 0 || p > 1) continue;
        const y = horizon + (h - horizon) * p;
        ctx.beginPath();
        ctx.globalAlpha = p * 0.5;
        ctx.strokeStyle = data.isChronoShifting ? '#34d399' : '#334155';
        ctx.moveTo(w/2 - 2000 * p, y);
        ctx.lineTo(w/2 + 2000 * p, y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Obstacles
    data.obstacles.sort((a: Obstacle, b: Obstacle) => b.z - a.z).forEach((obs: Obstacle) => {
        const p = 600 / (600 + obs.z);
        const xBase = w/2 + LANES[obs.lane] * p;
        const yBase = horizon + (h - horizon) * p;
        const width = 160 * p;
        const height = obs.height * 2.5 * p;

        if (obs.type === 'TRAIN') {
            if (assets.TRAIN_TEX) {
                ctx.drawImage(assets.TRAIN_TEX, xBase - width/2, yBase - height, width, height);
            } else {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(xBase - width/2, yBase - height, width, height);
            }
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
            ctx.strokeRect(xBase - width/2, yBase - height, width, height);
        } else {
            ctx.fillStyle = '#be123c';
            ctx.shadowBlur = data.isChronoShifting ? 0 : 25;
            ctx.shadowColor = '#f43f5e';
            ctx.fillRect(xBase - width/2, yBase - height, width, height);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#f43f5e';
            ctx.strokeRect(xBase - width/2, yBase - height, width, height);
        }
    });

    // Character
    const pP = 600 / (600 + 80); 
    const pX = w/2 + LANES[data.playerLane] * pP;
    const pY = horizon + (h - horizon) * pP - (data.playerY * pP * 2.5);
    const pS = 70 * pP;
    this.drawCharacter(pX, pY, pS, data.frameCount, data.playerY > 0, data.isChronoShifting, data.currentModifier);

    ctx.filter = 'none';
  }

  private drawCharacter(x: number, y: number, s: number, f: number, j: boolean, cs: boolean, mod: string) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    const aS = cs ? 0.05 : 0.2;
    const runCycle = Math.sin(f * aS);
    const bob = Math.abs(Math.cos(f * aS * 0.5)) * 5;

    if (mod === 'GLITCH_MODE' && f % 10 < 3) ctx.translate((Math.random() - 0.5) * 10, 0);

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#22d3ee';
    ctx.fillStyle = '#22d3ee';

    // Body
    (ctx as any).roundRect(-s * 0.4, -s * 1.6 + bob, s * 0.8, s * 0.8, 10);
    ctx.fill();

    if (cs) {
       ctx.strokeStyle = '#34d399';
       ctx.strokeRect(-s * 0.5, -s * 1.7 + bob, s, s);
    }

    // Helmet
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, -s * 1.8 + bob, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Visor
    ctx.fillStyle = '#fef08a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(s * 0.1, -s * 1.85 + bob, s * 0.15, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    const legL = s * 0.6;
    const l1 = j ? 0.5 : runCycle;
    const l2 = j ? -0.5 : -runCycle;

    const drawLeg = (angle: number, color: string) => {
      ctx.save();
      ctx.translate(0, -s * 0.8 + bob);
      ctx.rotate(angle * 0.6);
      ctx.fillStyle = color;
      ctx.beginPath();
      (ctx as any).roundRect(-s * 0.15, 0, s * 0.3, legL, 5);
      ctx.fill();
      ctx.restore();
    };

    drawLeg(l2, '#1e293b');
    drawLeg(l1, '#22d3ee');

    ctx.restore();
  }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [activeEvent, setActiveEvent] = useState<AIEvent | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    coins: 0,
    multiplier: 1,
    distance: 0,
    syncLevel: 100,
    chronoEnergy: 100
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const imageAssets = useRef<AssetMap>({});
  const requestRef = useRef<number>();
  
  const gameData = useRef({
    playerLane: 1,
    playerY: 0,
    playerJumpVelocity: 0,
    obstacles: [] as Obstacle[],
    speed: GAME_SPEED_START,
    lastSpawnZ: 0,
    spawnTimer: 0,
    frameCount: 0,
    bgOffset: 0,
    currentModifier: 'NORMAL' as ModifierType,
    modifierTimer: 0,
    isChronoShifting: false,
    nextAIEventScore: 500,
    currentScore: 0 // Sync score locally for triggers
  });

  // Assets initialization
  useEffect(() => {
    let mounted = true;
    const preload = async () => {
      const load = Promise.all(Object.entries(ASSETS).map(([key, url]) => {
        return new Promise((res) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
          img.onload = () => { imageAssets.current[key] = img; res(true); };
          img.onerror = () => res(false);
        });
      }));
      await Promise.race([load, new Promise(r => setTimeout(r, 6000))]);
      if (mounted) setImagesLoaded(true);
    };
    preload();
    return () => { mounted = false; };
  }, []);

  const resetGame = useCallback(() => {
    gameData.current = {
      playerLane: 1,
      playerY: 0,
      playerJumpVelocity: 0,
      obstacles: [],
      speed: GAME_SPEED_START,
      lastSpawnZ: 0,
      spawnTimer: 0,
      frameCount: 0,
      bgOffset: 0,
      currentModifier: 'NORMAL',
      modifierTimer: 0,
      isChronoShifting: false,
      nextAIEventScore: 500,
      currentScore: 0
    };
    setActiveEvent(null);
    setStats({
      score: 0,
      coins: 0,
      multiplier: 1,
      distance: 0,
      syncLevel: 100,
      chronoEnergy: 100
    });
  }, []);

  const triggerAIEvent = async (score: number) => {
    try {
      const event = await getAINarrativeEvent(score);
      setActiveEvent(event);
      gameData.current.currentModifier = event.modifier;
      gameData.current.modifierTimer = event.duration * 60;
    } catch (e) {
      console.error(e);
    }
  };

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const data = gameData.current;
    data.frameCount++;
    
    const timeScale = data.isChronoShifting ? 0.3 : 1.0;
    
    // Use functional update to avoid stale closures and unnecessary re-renders of the callback
    setStats(prev => {
      const nextEnergy = data.isChronoShifting 
        ? Math.max(0, prev.chronoEnergy - 1.5) 
        : Math.min(100, prev.chronoEnergy + 0.1);
      
      if (nextEnergy <= 0) data.isChronoShifting = false;

      const currentSpeedMod = data.currentModifier === 'SPEED_UP' ? data.speed * 1.5 : data.speed;
      const dDist = (currentSpeedMod / 10) * timeScale;
      const dScore = ((currentSpeedMod * prev.multiplier) / 10) * timeScale;
      
      data.currentScore = prev.score + dScore;

      return {
        ...prev,
        chronoEnergy: nextEnergy,
        distance: prev.distance + dDist,
        score: prev.score + dScore,
        multiplier: 1 + Math.floor((prev.distance + dDist) / 500)
      };
    });

    const currentSpeed = data.currentModifier === 'SPEED_UP' ? data.speed * 1.5 : data.speed;
    const gravityScale = data.currentModifier === 'LOW_GRAVITY' ? 0.4 : GRAVITY;

    data.speed = Math.min(MAX_SPEED, data.speed + ACCELERATION * timeScale);
    data.bgOffset += currentSpeed * 0.2 * timeScale;

    // Fixed AI trigger to use data ref score for stability
    if (data.frameCount % 60 === 0 && data.nextAIEventScore < data.currentScore) {
       triggerAIEvent(Math.floor(data.currentScore));
       data.nextAIEventScore += 1500;
    }

    if (data.modifierTimer > 0) {
      data.modifierTimer -= timeScale;
      if (data.modifierTimer <= 0) {
        data.currentModifier = 'NORMAL';
        // Explicitly ensuring argument is passed to setActiveEvent to fix the Reported Error
        setActiveEvent(null);
      }
    }

    // Player physics
    if (data.playerY > 0 || data.playerJumpVelocity !== 0) {
      data.playerY += data.playerJumpVelocity * timeScale;
      data.playerJumpVelocity -= gravityScale * timeScale;
      if (data.playerY < 0) { data.playerY = 0; data.playerJumpVelocity = 0; }
    }

    // Spawning logic
    data.spawnTimer += currentSpeed * timeScale;
    if (data.spawnTimer > 400) {
      const lane = Math.floor(Math.random() * 3);
      const type = Math.random() > 0.85 ? 'TRAIN' : 'BARRIER';
      data.obstacles.push({
        id: Math.random().toString(36).substring(2, 9),
        lane, z: 3500, type: type as any, height: type === 'TRAIN' ? 140 : 50
      });
      data.spawnTimer = 0;
    }

    // Collision & Cleanup
    data.obstacles = data.obstacles.filter(obs => {
      obs.z -= currentSpeed * timeScale;
      if (obs.z > 0 && obs.z < 80 && obs.lane === data.playerLane) {
        if (data.playerY < obs.height) setGameState(GameState.GAMEOVER);
      }
      return obs.z > -100;
    });

    // Rendering via isolated class
    if (rendererRef.current && canvasRef.current) {
       rendererRef.current.render(canvasRef.current.width, canvasRef.current.height, data, stats);
    }

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, stats]); // update depends on stats to ensure render receives fresh data

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    if (canvasRef.current && imagesLoaded) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) rendererRef.current = new GameRenderer(ctx, imageAssets.current);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, [imagesLoaded]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && imagesLoaded) {
      // Loop is started here. update() handles self-recursion via requestAnimationFrame.
      requestRef.current = requestAnimationFrame(update);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, update, imagesLoaded]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      if (e.key === 'ArrowLeft') gameData.current.playerLane = Math.max(0, gameData.current.playerLane - 1);
      if (e.key === 'ArrowRight') gameData.current.playerLane = Math.min(2, gameData.current.playerLane + 1);
      if (e.key === ' ' || e.key === 'ArrowUp') {
        if (gameData.current.playerY === 0) gameData.current.playerJumpVelocity = PLAYER_JUMP_FORCE;
      }
      if (e.key === 'Shift' && stats.chronoEnergy > 20) gameData.current.isChronoShifting = true;
    };
    const ku = (e: KeyboardEvent) => { if (e.key === 'Shift') gameData.current.isChronoShifting = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [gameState, stats.chronoEnergy]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-inter">
      {!imagesLoaded && (
        <div 
          className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950"
          role="alert"
          aria-busy="true"
        >
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-cyan-500 font-orbitron tracking-widest text-xs uppercase">Initialising Neural Link...</p>
          </div>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-none"
        aria-label="HyperRun Gameplay Field"
      />

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md p-4 text-center z-20">
          <div className="relative mb-6">
             <div className="absolute -inset-10 bg-cyan-500/10 blur-3xl rounded-full animate-pulse"></div>
             <h1 className="relative text-7xl md:text-9xl font-orbitron font-bold text-white tracking-tighter">
               HYPER<span className="text-cyan-400">RUN</span>
             </h1>
          </div>
          <p className="text-cyan-500/80 font-orbitron tracking-[0.4em] text-[11px] mb-12 uppercase">Neural Photorealistic Simulation</p>
          
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button 
              onClick={() => { resetGame(); setGameState(GameState.PLAYING); }}
              className="group relative px-10 py-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-2xl transition-all overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.3)]"
              aria-label="Start Game"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
              <span className="relative flex items-center justify-center gap-3 text-lg">
                <i className="fa fa-bolt" aria-hidden="true"></i> CONNECT TO NEXUS
              </span>
            </button>
            <button 
              onClick={() => setGameState(GameState.ARCH_DOCS)}
              className="px-8 py-4 bg-slate-900/60 hover:bg-slate-800 text-white font-bold rounded-2xl border border-slate-700 backdrop-blur-xl transition-all"
              aria-label="View Technical Schematics"
            >
              <i className="fa fa-microchip mr-2 text-slate-400" aria-hidden="true"></i> SYSTEM BLUEPRINTS
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.GAMEOVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 text-center z-30">
          <div className="bg-slate-900 border-t-2 border-red-500 p-12 rounded-[2rem] shadow-[0_0_100px_rgba(239,68,68,0.15)] max-w-md w-full relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)]">
               <i className="fa fa-power-off text-white text-3xl" aria-hidden="true"></i>
            </div>
            <h2 className="text-4xl font-orbitron font-bold text-white mb-2 mt-4 tracking-tighter uppercase">Link Severed</h2>
            <div className="space-y-4 mb-12 mt-8">
              <div className="flex justify-between items-center p-5 bg-black/40 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 font-black tracking-widest">Efficiency Rating</span>
                <span className="text-3xl font-orbitron text-cyan-400">{Math.floor(stats.score).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { resetGame(); setGameState(GameState.PLAYING); }}
                className="w-full py-5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-red-900/20"
                aria-label="Restart Run"
              >
                RE-SYNC NEURAL LINK
              </button>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all"
                aria-label="Return to Main Menu"
              >
                EXIT SIMULATION
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.PLAYING && <GameHUD stats={stats} activeEvent={activeEvent} />}
      {gameState === GameState.ARCH_DOCS && <ArchitectureDocs onBack={() => setGameState(GameState.MENU)} />}
      
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.3)_100%)] z-10" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" aria-hidden="true" />
    </div>
  );
};

export default App;
