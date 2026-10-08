import React, { useState } from 'react';
import type {
  MapConfig,
  MapLayerMode,
  CustomBiome,
  Faction,
  FactionRelation,
  MapToken,
  TileData,
  POI,
} from './types/map';
import { DEFAULT_BIOMES } from './constants/biomes';
import { generateWorld } from './utils/worldGenerator';
import { MapCanvas } from './components/MapCanvas';
import { GlobeCanvas } from './components/GlobeCanvas';
import { TileHoverCard } from './components/TileHoverCard';
import { CustomBiomeEditor } from './components/CustomBiomeEditor';
import { FactionManager } from './components/FactionManager';
import { TokenManager } from './components/TokenManager';
import { findHexPath } from './utils/pathfinding';
import {
  Layers,
  Palette,
  Flag,
  Shield,
  Compass,
  Download,
  Upload,
  RotateCcw,
  Footprints,
  Brush,
  Sliders,
  Sparkles,
  MapPin,
  Globe,
  Grid,
  Mountain,
} from 'lucide-react';

export function App() {
  // Map View Mode: '2d' Hex Grid or '3d' Globe
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  // Map Config State
  const [config, setConfig] = useState<MapConfig>({
    width: 32,
    height: 32,
    hexSize: 22,
    seed: 'dnd_fantasy_realm',
    elevationScale: 1.0,
    temperatureScale: 1.0,
    humidityScale: 1.0,
    riverCount: 5,
    poiCount: 18,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    useTectonics: true,
    plateCount: 8,
    oceanicRatio: 0.6,
  });

  // Active Map Data State
  const [biomes, setBiomes] = useState<CustomBiome[]>(DEFAULT_BIOMES);
  const [mapData, setMapData] = useState<{ tiles: Map<string, TileData>; pois: POI[] }>(() =>
    generateWorld(config, biomes)
  );
  const [factions, setFactions] = useState<Faction[]>([
    { id: 'fac_1', name: 'Eldoria Krallığı', color: '#0284c7', description: 'İnsanların kadim krallığı' },
    { id: 'fac_2', name: 'Gölge Konseyi', color: '#e11d48', description: 'Ork ve nekromans ittifakı' },
  ]);
  const [relations, setRelations] = useState<FactionRelation[]>([
    { factionId1: 'fac_1', factionId2: 'fac_2', status: 'war' },
  ]);
  const [tokens, setTokens] = useState<MapToken[]>([]);

  // UI Control States
  const [layerMode, setLayerMode] = useState<MapLayerMode>('biome');
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedTileKey, setSelectedTileKey] = useState<string | null>(null);

  // Tools & Pathfinding States
  const [isPathfindingActive, setIsPathfindingActive] = useState(false);
  const [pathfindingStart, setPathfindingStart] = useState<TileData | null>(null);
  const [pathHexes, setPathHexes] = useState<string[]>([]);
  const [pathCost, setPathCost] = useState<number | null>(null);
  const [activeBrush, setActiveBrush] = useState<'none' | 'biome' | 'river' | 'faction'>('none');
  const [selectedBrushBiome, setSelectedBrushBiome] = useState<string>(DEFAULT_BIOMES[0].id);
  const [selectedBrushFaction, setSelectedBrushFaction] = useState<string>('');

  // Modals
  const [isBiomeEditorOpen, setIsBiomeEditorOpen] = useState(false);
  const [isFactionManagerOpen, setIsFactionManagerOpen] = useState(false);
  const [isTokenManagerOpen, setIsTokenManagerOpen] = useState(false);

  // World Regeneration
  const handleRegenerate = () => {
    const generated = generateWorld(config, biomes);
    setMapData(generated);
    setPathfindingStart(null);
    setPathHexes([]);
    setPathCost(null);
  };

  // Tile Selection & Click Logic
  const handleTileClick = (tile: TileData) => {
    const key = `${tile.q},${tile.r}`;
    setSelectedTileKey(key);

    // Brush Tool Editing
    if (activeBrush === 'biome') {
      tile.biomeId = selectedBrushBiome;
      const b = biomes.find((bm) => bm.id === selectedBrushBiome);
      if (b) tile.movementCost = b.movementCost;
      setMapData({ ...mapData });
      return;
    }

    if (activeBrush === 'river') {
      tile.hasRiver = !tile.hasRiver;
      setMapData({ ...mapData });
      return;
    }

    if (activeBrush === 'faction' && selectedBrushFaction) {
      tile.factionId = tile.factionId === selectedBrushFaction ? undefined : selectedBrushFaction;
      setMapData({ ...mapData });
      return;
    }

    // Explicit Pathfinding Mode
    if (isPathfindingActive) {
      if (!pathfindingStart) {
        setPathfindingStart(tile);
        setPathHexes([key]);
        setPathCost(0);
      } else {
        const result = findHexPath(
          { q: pathfindingStart.q, r: pathfindingStart.r },
          { q: tile.q, r: tile.r },
          mapData.tiles
        );
        if (result) {
          setPathHexes(result.path.map((p) => `${p.q},${p.r}`));
          setPathCost(result.totalCost);
        } else {
          alert('Bu iki nokta arasında geçilebilir bir yol bulunamadı!');
          setPathfindingStart(null);
          setPathHexes([]);
          setPathCost(null);
        }
      }
    }
  };

  // Save / Load JSON
  const handleExportJSON = () => {
    const dataObj = {
      config,
      biomes,
      tiles: Array.from(mapData.tiles.entries()),
      pois: mapData.pois,
      factions,
      relations,
      tokens,
    };
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnd_map_${config.seed}.json`;
    a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.config && parsed.tiles) {
          setConfig(parsed.config);
          if (parsed.biomes) setBiomes(parsed.biomes);
          setMapData({
            tiles: new Map(parsed.tiles),
            pois: parsed.pois || [],
          });
          if (parsed.factions) setFactions(parsed.factions);
          if (parsed.relations) setRelations(parsed.relations);
          if (parsed.tokens) setTokens(parsed.tokens);
        }
      } catch (err) {
        alert('Geçersiz harita dosyası!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Sidebar Control Panel */}
      <aside className="w-80 bg-slate-900/95 border-r border-slate-800 flex flex-col z-30 shadow-2xl backdrop-blur">
        {/* Header Title & View Toggle */}
        <div className="p-4 border-b border-slate-800 flex flex-col gap-3 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-6 h-6 text-indigo-400" />
              <h1 className="font-bold text-slate-100 text-base tracking-wide">D&D World Engine</h1>
            </div>
            <span className="text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
              v2.0 (Tectonic & 3D)
            </span>
          </div>

          {/* 2D Grid / 3D Globe View Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('2d')}
              className={`py-1.5 px-2 rounded font-medium flex items-center justify-center gap-1.5 transition ${
                viewMode === '2d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> 2D Hex
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`py-1.5 px-2 rounded font-medium flex items-center justify-center gap-1.5 transition ${
                viewMode === '3d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> 3D Globe
            </button>
          </div>
        </div>

        {/* Scrollable Settings */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Map Layer Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" /> Harita Katmanları
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setLayerMode('biome')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'biome' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Biyom
              </button>
              <button
                onClick={() => setLayerMode('topographic')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'topographic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Topografik
              </button>
              <button
                onClick={() => setLayerMode('tectonic')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'tectonic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tektonik
              </button>
              <button
                onClick={() => setLayerMode('political')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'political' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Politik
              </button>
              <button
                onClick={() => setLayerMode('temperature')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'temperature' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sıcaklık
              </button>
              <button
                onClick={() => setLayerMode('humidity')}
                className={`py-1.5 px-2 rounded font-medium transition ${
                  layerMode === 'humidity' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Nem
              </button>
            </div>
          </div>

          {/* Tectonic Plate Simulation Settings */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Mountain className="w-4 h-4 text-emerald-400" /> Tektonik Plaka Simülasyonu
              </label>
              <input
                type="checkbox"
                checked={config.useTectonics}
                onChange={(e) => setConfig({ ...config, useTectonics: e.target.checked })}
                className="accent-indigo-600 w-4 h-4 cursor-pointer"
              />
            </div>

            {config.useTectonics && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Plaka Sayısı:</span>
                    <span className="font-mono text-indigo-400">{config.plateCount}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="16"
                    value={config.plateCount}
                    onChange={(e) => setConfig({ ...config, plateCount: parseInt(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Okyanusal Plaka Oranı:</span>
                    <span className="font-mono text-indigo-400">{Math.round(config.oceanicRatio * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.05"
                    value={config.oceanicRatio}
                    onChange={(e) => setConfig({ ...config, oceanicRatio: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fractal Noise Octaves Settings */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Fraktal / Oktav Gürültü (FBM)
            </label>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Oktav Detay Sayısı (Octaves):</span>
                  <span className="font-mono text-indigo-400">{config.octaves}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={config.octaves}
                  onChange={(e) => setConfig({ ...config, octaves: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Kalıcılık (Persistence):</span>
                  <span className="font-mono text-indigo-400">{config.persistence}</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={config.persistence}
                  onChange={(e) => setConfig({ ...config, persistence: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Frekans Çarpanı (Lacunarity):</span>
                  <span className="font-mono text-indigo-400">{config.lacunarity}</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="3.5"
                  step="0.1"
                  value={config.lacunarity}
                  onChange={(e) => setConfig({ ...config, lacunarity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Action Managers */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" /> Yönetim Pencereleri
            </label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setIsBiomeEditorOpen(true)}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" /> Biyom & Spawn Düzenleyici
                </span>
                <span className="text-[10px] text-slate-400">{biomes.length} Biyom</span>
              </button>

              <button
                onClick={() => setIsFactionManagerOpen(true)}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-400" /> Politik Krallıklar & İlişkiler
                </span>
                <span className="text-[10px] text-slate-400">{factions.length} Krallık</span>
              </button>

              <button
                onClick={() => setIsTokenManagerOpen(true)}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center justify-between transition"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-pink-400" /> Harita Token'ları & PC/NPC
                </span>
                <span className="text-[10px] text-slate-400">{tokens.length} Token</span>
              </button>
            </div>
          </div>

          {/* Map Brush Editing Tool */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Brush className="w-4 h-4 text-indigo-400" /> Manuel Fırça Düzenleyici
            </label>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    setIsPathfindingActive(false);
                    setActiveBrush(activeBrush === 'biome' ? 'none' : 'biome');
                  }}
                  className={`py-1.5 px-2 rounded font-medium transition border ${
                    activeBrush === 'biome'
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Biyom Fırçası
                </button>
                <button
                  onClick={() => {
                    setIsPathfindingActive(false);
                    setActiveBrush(activeBrush === 'river' ? 'none' : 'river');
                  }}
                  className={`py-1.5 px-2 rounded font-medium transition border ${
                    activeBrush === 'river'
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Nehir Fırçası
                </button>
                <button
                  onClick={() => {
                    setIsPathfindingActive(false);
                    setActiveBrush(activeBrush === 'faction' ? 'none' : 'faction');
                  }}
                  className={`py-1.5 px-2 rounded font-medium transition border col-span-2 ${
                    activeBrush === 'faction'
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Politik Bölge Çizici
                </button>
              </div>

              {activeBrush === 'biome' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Seçili Biyom:</label>
                  <select
                    value={selectedBrushBiome}
                    onChange={(e) => setSelectedBrushBiome(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    {biomes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeBrush === 'faction' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Seçili Krallık/Bölge:</label>
                  <select
                    value={selectedBrushFaction}
                    onChange={(e) => setSelectedBrushFaction(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                  >
                    <option value="">(Tarafsız / Temizle)</option>
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Pathfinding & Distance Calculator Card */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Footprints className="w-4 h-4 text-amber-400" /> Mesafe / Yol Hesabı
              </label>
              <button
                onClick={() => {
                  const nextState = !isPathfindingActive;
                  setIsPathfindingActive(nextState);
                  if (nextState) setActiveBrush('none');
                  else {
                    setPathfindingStart(null);
                    setPathHexes([]);
                    setPathCost(null);
                  }
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                  isPathfindingActive
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isPathfindingActive ? 'Açık' : 'Kapalı'}
              </button>
            </div>

            {isPathfindingActive && (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Başlangıç:</span>
                  <span className="font-mono text-indigo-400">
                    {pathfindingStart ? `(${pathfindingStart.q}, ${pathfindingStart.r})` : 'Seçilmedi'}
                  </span>
                </div>

                {pathCost !== null && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="text-slate-300 font-semibold">Toplam Hareket Puanı:</span>
                    <span className="font-bold text-amber-400 text-sm">{pathCost} TP</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    setPathfindingStart(null);
                    setPathHexes([]);
                    setPathCost(null);
                  }}
                  className="w-full py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 rounded text-[11px]"
                >
                  Yolu Temizle
                </button>
              </div>
            )}
          </div>

          {/* Seed & General Config */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-400" /> Harita Boyut & Seed
            </label>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Seed (Tohum):</label>
                <input
                  type="text"
                  value={config.seed}
                  onChange={(e) => setConfig({ ...config, seed: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Genişlik (Tile)</label>
                  <input
                    type="number"
                    value={config.width}
                    onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value) || 20 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Yükseklik (Tile)</label>
                  <input
                    type="number"
                    value={config.height}
                    onChange={(e) => setConfig({ ...config, height: parseInt(e.target.value) || 20 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-400" /> Hedef Yerleşim / Node Sayısı
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.poiCount}
                  onChange={(e) => setConfig({ ...config, poiCount: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={handleRegenerate}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow flex items-center justify-center gap-1.5 text-xs transition"
              >
                <RotateCcw className="w-4 h-4" /> Dünyayı Yeniden Üret
              </button>
            </div>
          </div>
        </div>

        {/* Footer Import/Export Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex gap-2">
          <button
            onClick={handleExportJSON}
            className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Kaydet (JSON)
          </button>
          <label className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Yükle
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </aside>

      {/* Main Interactive Canvas Area (2D Hex or 3D Globe View) */}
      <main className="flex-1 relative">
        {viewMode === '2d' ? (
          <MapCanvas
            tiles={mapData.tiles}
            biomes={biomes}
            factions={factions}
            tokens={tokens}
            layerMode={layerMode}
            hexSize={config.hexSize}
            width={config.width}
            height={config.height}
            selectedTileKey={selectedTileKey}
            hoveredTile={hoveredTile}
            pathHexes={pathHexes}
            activeBrush={activeBrush}
            brushColor={activeBrush === 'biome' ? biomes.find((b) => b.id === selectedBrushBiome)?.color || '' : ''}
            onTileHover={setHoveredTile}
            onTileClick={handleTileClick}
          />
        ) : (
          <GlobeCanvas
            tiles={mapData.tiles}
            biomes={biomes}
            factions={factions}
            layerMode={layerMode}
            width={config.width}
            height={config.height}
            selectedTileKey={selectedTileKey}
            onTileHover={setHoveredTile}
            onTileClick={handleTileClick}
          />
        )}

        {/* Tile Stats Hover Tooltip */}
        <TileHoverCard tile={hoveredTile} biomes={biomes} x={mousePos.x} y={mousePos.y} />
      </main>

      {/* Modals */}
      {isBiomeEditorOpen && (
        <CustomBiomeEditor
          biomes={biomes}
          onUpdateBiomes={setBiomes}
          onClose={() => setIsBiomeEditorOpen(false)}
        />
      )}

      {isFactionManagerOpen && (
        <FactionManager
          factions={factions}
          relations={relations}
          onUpdateFactions={setFactions}
          onUpdateRelations={setRelations}
          onClose={() => setIsFactionManagerOpen(false)}
        />
      )}

      {isTokenManagerOpen && (
        <TokenManager
          tokens={tokens}
          onUpdateTokens={setTokens}
          onClose={() => setIsTokenManagerOpen(false)}
          selectedTileKey={selectedTileKey}
        />
      )}
    </div>
  );
}

export default App;
