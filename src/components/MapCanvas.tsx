import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  width,
  height,
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

  // Map biome & faction lookups memoized
  const biomeMap = useMemo(() => {
    const map = new Map<string, CustomBiome>();
    biomes.forEach((b) => map.set(b.id, b));
    return map;
  }, [biomes]);

  const factionMap = useMemo(() => {
    const map = new Map<string, Faction>();
    factions.forEach((f) => map.set(f.id, f));
    return map;
  }, [factions]);

  const pathSet = useMemo(() => new Set(pathHexes), [pathHexes]);

  // Key generators
  const getKey = (q: number, r: number) => `${q},${r}`;

  // Helper for modulo mapping back to original 0..width-1, 0..height-1 tile key
  const getNormalizedKey = (q: number, r: number) => {
    const normQ = ((q % width) + width) % width;
    const normR = ((r % height) + height) % height;
    return getKey(normQ, normR);
  };

  // High performance Canvas rendering with Repeating Map Tiles & Thick Original Border
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    ctx.save();
    // Apply pan & zoom transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Calculate visible bounds in world coordinates for Viewport Culling
    const minWorldX = -transform.x / transform.scale - hexSize * 4;
    const maxWorldX = (viewportWidth - transform.x) / transform.scale + hexSize * 4;
    const minWorldY = -transform.y / transform.scale - hexSize * 4;
    const maxWorldY = (viewportHeight - transform.y) / transform.scale + hexSize * 4;

    // Repeat map 3x3 grids (from -width to 2*width - 1, -height to 2*height - 1)
    const repeatOffsets = [-1, 0, 1];

    repeatOffsets.forEach((repeatQ) => {
      repeatOffsets.forEach((repeatR) => {
        const isOriginalMap = repeatQ === 0 && repeatR === 0;

        tiles.forEach((tile) => {
          const actualQ = tile.q + repeatQ * width;
          const actualR = tile.r + repeatR * height;

          const { x: px, y: py } = hexToPixel(actualQ, actualR, hexSize);

          // Frustum Culling Check
          if (px < minWorldX || px > maxWorldX || py < minWorldY || py > maxWorldY) {
            return;
          }

          drawHexagonPath(ctx, px, py, hexSize - 0.5);

          let fillColor = '#1e293b';

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

          // Slightly dim repeated outer maps so original map stands out
          ctx.fillStyle = isOriginalMap ? fillColor : `${fillColor}99`;
          ctx.fill();

          // Stroke Hex Borders
          ctx.strokeStyle = isOriginalMap ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Draw Rivers
          if (tile.hasRiver) {
            ctx.beginPath();
            ctx.arc(px, py, hexSize * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = isOriginalMap ? '#38bdf8' : '#38bdf888';
            ctx.fill();
          }

          // Highlight Path Hexes
          if (pathSet.has(getKey(tile.q, tile.r)) && isOriginalMap) {
            drawHexagonPath(ctx, px, py, hexSize - 2);
            ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          // Highlight Selected Tile
          if (selectedTileKey === getKey(tile.q, tile.r) && isOriginalMap) {
            drawHexagonPath(ctx, px, py, hexSize - 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // Highlight Hovered Tile
          if (hoveredTile && hoveredTile.q === tile.q && hoveredTile.r === tile.r && isOriginalMap) {
            drawHexagonPath(ctx, px, py, hexSize - 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Draw POI Icons
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
            ctx.globalAlpha = isOriginalMap ? 1.0 : 0.4;
            ctx.fillText(symbol, px, py);
            ctx.globalAlpha = 1.0;
          }

          // Movement Overlay
          if (layerMode === 'movement') {
            ctx.font = `bold ${Math.floor(hexSize * 0.6)}px sans-serif`;
            ctx.fillStyle = isOriginalMap ? '#ffffff' : '#ffffff88';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tile.movementCost >= 99 ? '∞' : tile.movementCost.toString(), px, py);
          }
        });
      });
    });

    // 2. Render Thick Highlighted Boundary for Original Map (q: 0..width-1, r: 0..height-1)
    tiles.forEach((tile) => {
      // Check if tile is on perimeter boundary of original map
      const isPerimeter =
        tile.q === 0 || tile.q === width - 1 || tile.r === 0 || tile.r === height - 1;

      if (isPerimeter) {
        const { x: px, y: py } = hexToPixel(tile.q, tile.r, hexSize);
        drawHexagonPath(ctx, px, py, hexSize);
        ctx.strokeStyle = '#f59e0b'; // Thick golden border for original map edges
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
    });

    // Render Tokens on Original Map
    tokens.forEach((token) => {
      const { x: px, y: py } = hexToPixel(token.q, token.r, hexSize);

      if (px < minWorldX || px > maxWorldX || py < minWorldY || py > maxWorldY) return;

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
    biomeMap,
    factionMap,
    tokens,
    layerMode,
    hexSize,
    width,
    height,
    transform,
    selectedTileKey,
    hoveredTile,
    pathSet,
  ]);

  useEffect(() => {
    let animId: number;
    const render = () => {
      renderMap();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [renderMap]);

  // Mouse Event Handlers
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
    const normKey = getNormalizedKey(hex.q, hex.r);
    const tile = tiles.get(normKey);

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
    const normKey = getNormalizedKey(hex.q, hex.r);
    const tile = tiles.get(normKey);

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
