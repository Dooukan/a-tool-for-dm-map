import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { CustomBiome, Faction, MapLayerMode, MapToken, TileData } from '../types/map';
import { drawHexagonPath, hexToPixel, pixelToHex } from '../utils/hexMath';

interface MapCanvasProps {
  tiles: Map<string, TileData>;
  biomes: CustomBiome[];
  factions: Faction[];
  tokens: MapToken[];
  layerMode: MapLayerMode;
  hexSize: number;
  width: number;
  height: number;
  selectedTileKey: string | null;
  hoveredTile: TileData | null;
  pathHexes: string[];
  activeBrush: string | null;
  brushColor: string;
  onTileHover: (tile: TileData | null) => void;
  onTileClick: (tile: TileData) => void;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  tiles,
  biomes,
  factions,
  tokens,
  layerMode,
  hexSize,
  selectedTileKey,
  hoveredTile,
  pathHexes,
  onTileHover,
  onTileClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 100, y: 100, scale: 1.0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Map biome lookup
  const biomeMap = new Map<string, CustomBiome>();
  biomes.forEach((b) => biomeMap.set(b.id, b));

  // Map faction lookup
  const factionMap = new Map<string, Faction>();
  factions.forEach((f) => factionMap.set(f.id, f));

  // Key generator
  const getKey = (q: number, r: number) => `${q},${r}`;

  // Drawing method
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Apply pan & zoom transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    const pathSet = new Set(pathHexes);

    // 1. Draw Tiles
    tiles.forEach((tile) => {
      const { x: px, y: py } = hexToPixel(tile.q, tile.r, hexSize);

      drawHexagonPath(ctx, px, py, hexSize - 1);

      // Determine color based on active layer mode
      let fillColor = '#1e293b';
      let strokeColor = 'rgba(255, 255, 255, 0.08)';

      if (tile.customColor) {
        fillColor = tile.customColor;
      } else {
        switch (layerMode) {
          case 'biome': {
            const b = biomeMap.get(tile.biomeId);
            fillColor = b ? b.color : '#334155';
            break;
          }
          case 'topographic': {
            const e = tile.elevation;
            if (e < 0.25) fillColor = `rgb(15, 23, ${Math.floor(80 + e * 300)})`;
            else if (e < 0.6) fillColor = `rgb(${Math.floor(40 + e * 100)}, ${Math.floor(120 + e * 100)}, 40)`;
            else if (e < 0.8) fillColor = `rgb(${Math.floor(140 + e * 80)}, ${Math.floor(100 + e * 40)}, 40)`;
            else fillColor = `rgb(${Math.floor(180 + e * 70)}, ${Math.floor(180 + e * 70)}, ${Math.floor(190 + e * 65)})`;
            break;
          }
          case 'temperature': {
            const t = tile.temperature;
            if (t < 0.3) fillColor = `rgb(56, 189, 248)`;
            else if (t < 0.6) fillColor = `rgb(250, 204, 21)`;
            else fillColor = `rgb(244, 63, 94)`;
            break;
          }
          case 'humidity': {
            const h = tile.humidity;
            const r = Math.floor(180 * (1 - h));
            const g = Math.floor(150 * h + 50);
            const b = Math.floor(200 * h + 20);
            fillColor = `rgb(${r}, ${g}, ${b})`;
            break;
          }
          case 'movement': {
            const c = tile.movementCost;
            if (c >= 99) fillColor = '#1e1b4b';
            else if (c <= 1) fillColor = '#15803d';
            else if (c <= 2) fillColor = '#ca8a04';
            else fillColor = '#b91c1c';
            break;
          }
          case 'political': {
            if (tile.factionId) {
              const fac = factionMap.get(tile.factionId);
              fillColor = fac ? fac.color : '#475569';
            } else {
              fillColor = '#1e293b';
            }
            break;
          }
        }
      }

      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke Hex Borders
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Draw Rivers if present
      if (tile.hasRiver) {
        ctx.beginPath();
        ctx.arc(px, py, hexSize * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      }

      // 3. Highlight Path Hexes
      if (pathSet.has(getKey(tile.q, tile.r))) {
        drawHexagonPath(ctx, px, py, hexSize - 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 4. Highlight Selected Tile
      if (selectedTileKey === getKey(tile.q, tile.r)) {
        drawHexagonPath(ctx, px, py, hexSize - 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // 5. Highlight Hovered Tile
      if (hoveredTile && hoveredTile.q === tile.q && hoveredTile.r === tile.r) {
        drawHexagonPath(ctx, px, py, hexSize - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 6. Draw Icons & Badges (POIs & Custom Symbols)
      if (tile.poi) {
        ctx.font = `${Math.floor(hexSize * 0.9)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let symbol = '🏛️';
        if (tile.poi.type === 'town') symbol = '🏡';
        if (tile.poi.type === 'village') symbol = '🛖';
        if (tile.poi.type === 'camp') symbol = '⛺';
        if (tile.poi.type === 'cave') symbol = '🕳️';
        if (tile.poi.type === 'dungeon') symbol = '💀';
        ctx.fillText(symbol, px, py);
      }

      // Movement mode number overlay
      if (layerMode === 'movement') {
        ctx.font = `bold ${Math.floor(hexSize * 0.6)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.movementCost >= 99 ? '∞' : tile.movementCost.toString(), px, py);
      }
    });

    // 7. Draw Map Tokens
    tokens.forEach((token) => {
      const { x: px, y: py } = hexToPixel(token.q, token.r, hexSize);

      ctx.beginPath();
      ctx.arc(px, py, hexSize * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = token.color || '#ec4899';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.floor(hexSize * 0.7)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.icon || '♟️', px, py);
    });

    ctx.restore();
  }, [
    tiles,
    biomes,
    factions,
    tokens,
    layerMode,
    hexSize,
    transform,
    selectedTileKey,
    hoveredTile,
    pathHexes,
  ]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Canvas Mouse Event Handlers for Pan, Zoom, and Tile Interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - transform.x) / transform.scale;
    const worldY = (mouseY - transform.y) / transform.scale;

    const hex = pixelToHex(worldX, worldY, hexSize);
    const tile = tiles.get(getKey(hex.q, hex.r));

    if (tile) {
      onTileHover(tile);
    } else {
      onTileHover(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - transform.x) / transform.scale;
    const worldY = (mouseY - transform.y) / transform.scale;

    const hex = pixelToHex(worldX, worldY, hexSize);
    const tile = tiles.get(getKey(hex.q, hex.r));

    if (tile) {
      onTileClick(tile);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    setTransform((prev) => {
      const newScale = Math.min(Math.max(0.3, prev.scale * zoomFactor), 4.0);
      return {
        ...prev,
        scale: newScale,
      };
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="cursor-grab active:cursor-grabbing block"
      />
    </div>
  );
};
