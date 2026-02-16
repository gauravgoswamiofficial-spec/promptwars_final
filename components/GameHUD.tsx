
import React from 'react';
import { GameStats, AIEvent } from '../types';

interface GameHUDProps {
  stats: GameStats;
  activeEvent: AIEvent | null;
}

const GameHUD: React.FC<GameHUDProps> = React.memo(({ stats, activeEvent }) => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-10 flex flex-col p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="bg-black/40 backdrop-blur-md border-l-4 border-cyan-500 px-4 py-2 rounded-r-lg shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">Neural Range</div>
            <div className="text-2xl font-orbitron font-bold text-white leading-none">
              {Math.floor(stats.distance).toLocaleString()}m
            </div>
          </div>
          <div className="bg-black/40 backdrop-blur-md border-l-4 border-yellow-500 px-4 py-2 rounded-r-lg">
            <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-400 font-bold">Nexus Bits</div>
            <div className="text-xl font-orbitron font-bold text-white leading-none">
              {stats.coins.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className="bg-black/40 backdrop-blur-md border-r-4 border-purple-500 px-6 py-4 rounded-l-lg">
            <div className="text-[10px] uppercase tracking-[0.2em] text-purple-400 font-bold">Multiplier</div>
            <div className="text-4xl font-orbitron font-bold text-white leading-none">
              x{stats.multiplier}
            </div>
            <div className="mt-2 text-2xl font-orbitron text-cyan-300">
              {Math.floor(stats.score).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-between items-end">
        <div className="w-64 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-cyan-400">
              <span>Bio-Sync Status</span>
              <span>{Math.floor(stats.syncLevel)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                style={{ width: `${stats.syncLevel}%` }}
                aria-valuenow={stats.syncLevel}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-emerald-400">
              <span>Chrono Capacity</span>
              <span>{stats.chronoEnergy >= 100 ? '[SHIFT READY]' : '[CHARGING]'}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 ${stats.chronoEnergy < 100 ? 'opacity-50' : 'animate-pulse'}`}
                style={{ width: `${stats.chronoEnergy}%` }}
                aria-valuenow={stats.chronoEnergy}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
              />
            </div>
          </div>
        </div>

        {activeEvent && (
          <div className="mb-4 mr-4 animate-bounce">
            <div className="bg-red-500/10 backdrop-blur-xl border-l-4 border-red-500 p-4 rounded-r-xl max-w-xs shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <div className="text-[9px] uppercase tracking-[0.3em] font-black text-red-500 mb-1">
                <i className="fa fa-skull mr-2" aria-hidden="true"></i> SYSTEM INTRUSION
              </div>
              <p className="text-white font-orbitron text-sm italic">
                "{activeEvent.message.toUpperCase()}"
              </p>
              <div className="mt-2 h-1 bg-red-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500" 
                  style={{ 
                    animation: `shrink ${activeEvent.duration}s linear forwards` 
                  }} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
});

export default GameHUD;
