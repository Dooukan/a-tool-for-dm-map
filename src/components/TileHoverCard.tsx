import React from 'react';
import type { CustomBiome, TileData } from '../types/map';
import { Mountain, Sun, Droplets, Compass, Sparkles, Footprints } from 'lucide-react';

interface TileHoverCardProps {
  tile: TileData | null;
  biomes: CustomBiome[];
  x: number;
  y: number;
}

export const TileHoverCard: React.FC<TileHoverCardProps> = ({ tile, biomes, x, y }) => {
  if (!tile) return null;

  const biome = biomes.find((b) => b.id === tile.biomeId);

  return (
    <div
      style={{ left: Math.min(x + 15, window.innerWidth - 260), top: Math.min(y + 15, window.innerHeight - 260) }}
      className="fixed z-40 bg-slate-900/95 border border-slate-700 backdrop-blur-md rounded-xl p-3 shadow-2xl text-xs text-slate-200 pointer-events-none w-60 space-y-2 animate-in fade-in duration-100"
    >
      {/* Title & Coordinates */}
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-100">
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: biome?.color || '#a855f7' }} />
          <span>{biome?.name || 'Bilinmeyen Biyom'}</span>
        </div>
        <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800">
          ({tile.q}, {tile.r})
        </span>
      </div>

      {/* POI Info if exists */}
      {tile.poi && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded p-1.5 flex items-center gap-2">
          <span className="text-base">🏛️</span>
          <div>
            <div className="font-semibold text-amber-300 text-xs">{tile.poi.name}</div>
            <div className="text-[10px] text-amber-400/80 capitalize">{tile.poi.type}</div>
          </div>
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-amber-300 bg-slate-800/60 p-1.5 rounded">
          <Mountain className="w-3.5 h-3.5 text-amber-400" />
          <span>Rakım: {Math.round(tile.elevation * 100)}%</span>
        </div>

        <div className="flex items-center gap-1.5 text-rose-300 bg-slate-800/60 p-1.5 rounded">
          <Sun className="w-3.5 h-3.5 text-rose-400" />
          <span>Sıcaklık: {Math.round(tile.temperature * 100)}°</span>
        </div>

        <div className="flex items-center gap-1.5 text-cyan-300 bg-slate-800/60 p-1.5 rounded">
          <Droplets className="w-3.5 h-3.5 text-cyan-400" />
          <span>Nem: {Math.round(tile.humidity * 100)}%</span>
        </div>

        <div className="flex items-center gap-1.5 text-emerald-300 bg-slate-800/60 p-1.5 rounded">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Verimlilik: {Math.round(tile.fertility * 100)}%</span>
        </div>
      </div>

      {/* Movement & River Features */}
      <div className="flex items-center justify-between text-[11px] bg-slate-800/40 p-1.5 rounded border border-slate-700/50">
        <div className="flex items-center gap-1 text-slate-300">
          <Footprints className="w-3.5 h-3.5 text-indigo-400" />
          <span>Hareket Maliyeti:</span>
        </div>
        <span className="font-bold text-indigo-300">
          {tile.movementCost >= 99 ? 'Geçilemez' : `${tile.movementCost} TP`}
        </span>
      </div>

      {tile.hasRiver && (
        <div className="flex items-center gap-1.5 text-sky-300 text-[11px] bg-sky-950/40 border border-sky-800/50 p-1 rounded">
          <Compass className="w-3.5 h-3.5 text-sky-400" />
          <span>Nehir Yatağı Mevcut</span>
        </div>
      )}
    </div>
  );
};
