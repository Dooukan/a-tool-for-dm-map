import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { CustomBiome, Faction, MapLayerMode, MapToken, TileData } from '../types/map';
import { drawHexagonPath, hexToPixel, pixelToHex } from '../utils/hexMath';

interface IsometricCanvasProps {
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

// Adjust helper color for 3D/Isometric side walls
function adjustColorBrightness(hexOrRgb: string, factor: number): string {
  if (hexOrRgb.startsWith('#')) {
    let hex = hexOrRgb.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const num = parseInt(hex, 16);
    let r = Math.floor(((num >> 16) & 255) * factor);
    let g = Math.floor(((num >> 8) & 255) * factor);
    let b = Math.floor((num & 255) * factor);
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (hexOrRgb.startsWith('rgb')) {
    const match = hexOrRgb.match(/\d+/g);
    if (match) {
      let [r, g, b] = match.map(Number);
      r = Math.min(255, Math.max(0, Math.floor(r * factor)));
      g = Math.min(255, Math.max(0, Math.floor(g * factor)));
      b = Math.min(255, Math.max(0, Math.floor(b * factor)));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return hexOrRgb;
}

export const IsometricCanvas: React.FC<IsometricCanvasProps> = ({
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
  const [transform, setTransform] = useState({ x: window.innerWidth / 2, y: 150, scale: 1.0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
  const getKey = (q: number, r: number) => `${q},${r}`;

  // Sort tiles by depth (row then col) so front tiles render over back tiles properly
  const sortedTiles = useMemo(() => {
    const arr = Array.from(tiles.values());
    arr.sort((a, b) => {
      const depthA = a.r * 2 + a.q;
      const depthB = b.r * 2 + b.q;
      return depthA - depthB;
    });
    return arr;
  }, [tiles]);

  const renderIsometricMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    const angle = Math.PI / 6; // 30 degrees
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const maxExtrusion = 45; // Height scaling in pixels based on elevation

    sortedTiles.forEach((tile) => {
      const { x: flatX, y: flatY } = hexToPixel(tile.q, tile.r, hexSize);

      // Isometric transformation
      const isoX = (flatX - flatY) * cosAngle;
      const elevationOffset = tile.elevation * maxExtrusion;
      const isoY = (flatX + flatY) * sinAngle * 0.5 - elevationOffset;

      // Base color calculation
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

      // Draw 3D Extruded Pillar Sides if elevation > 0
      if (elevationOffset > 0) {
        const sideColorLeft = adjustColorBrightness(fillColor, 0.65);
        const sideColorRight = adjustColorBrightness(fillColor, 0.45);

        // Left wall pillar
        ctx.beginPath();
        ctx.moveTo(isoX - hexSize * 0.8, isoY);
        ctx.lineTo(isoX - hexSize * 0.8, isoY + elevationOffset);
        ctx.lineTo(isoX, isoY + hexSize * 0.5 + elevationOffset);
        ctx.lineTo(isoX, isoY + hexSize * 0.5);
        ctx.closePath();
        ctx.fillStyle = sideColorLeft;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.stroke();

        // Right wall pillar
        ctx.beginPath();
        ctx.moveTo(isoX, isoY + hexSize * 0.5);
        ctx.lineTo(isoX, isoY + hexSize * 0.5 + elevationOffset);
        ctx.lineTo(isoX + hexSize * 0.8, isoY + elevationOffset);
        ctx.lineTo(isoX + hexSize * 0.8, isoY);
        ctx.closePath();
        ctx.fillStyle = sideColorRight;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.stroke();
      }

      // Top Hex Surface
      drawHexagonPath(ctx, isoX, isoY, hexSize - 0.5);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rivers
      if (tile.hasRiver) {
        ctx.beginPath();
        ctx.arc(isoX, isoY, hexSize * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      }

      // Path Highlight
      if (pathSet.has(getKey(tile.q, tile.r))) {
        drawHexagonPath(ctx, isoX, isoY, hexSize - 2);
        ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Selected Tile
      if (selectedTileKey === getKey(tile.q, tile.r)) {
        drawHexagonPath(ctx, isoX, isoY, hexSize - 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Hovered Tile
      if (hoveredTile && hoveredTile.q === tile.q && hoveredTile.r === tile.r) {
        drawHexagonPath(ctx, isoX, isoY, hexSize - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // POI Icons
      if (tile.poi) {
        ctx.font = `${Math.floor(hexSize * 0.85)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let symbol = '🏛️';
        if (tile.poi.type === 'town') symbol = '🏡';
        if (tile.poi.type === 'village') symbol = '🛖';
        if (tile.poi.type === 'camp') symbol = '⛺';
        if (tile.poi.type === 'cave') symbol = '🕳️';
        if (tile.poi.type === 'dungeon') symbol = '💀';
        ctx.fillText(symbol, isoX, isoY);
      }
    });

    // Render Map Tokens
    tokens.forEach((token) => {
      const tileKey = `${token.q},${token.r}`;
      const tile = tiles.get(tileKey);
      const elev = tile ? tile.elevation * maxExtrusion : 0;
      const { x: flatX, y: flatY } = hexToPixel(token.q, token.r, hexSize);
      const isoX = (flatX - flatY) * cosAngle;
      const isoY = (flatX + flatY) * sinAngle * 0.5 - elev;

      ctx.beginPath();
      ctx.arc(isoX, isoY - 4, hexSize * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = token.color || '#ec4899';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.floor(hexSize * 0.65)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.icon || '♟️', isoX, isoY - 4);
    });

    ctx.restore();
  }, [
    sortedTiles,
    biomeMap,
    factionMap,
    tokens,
    tiles,
    layerMode,
    hexSize,
    transform,
    selectedTileKey,
    hoveredTile,
    pathSet,
  ]);

  useEffect(() => {
    let animId: number;
    const render = () => {
      renderIsometricMap();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [renderIsometricMap]);

  // Event Handlers
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

    // Transform screen coords to world coords
    const worldX = (mouseX - transform.x) / transform.scale;
    const worldY = (mouseY - transform.y) / transform.scale;

    // Inverse Isometric Projection calculation
    const angle = Math.PI / 6;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    const flatX = (worldX / cosAngle + worldY / (sinAngle * 0.5)) / 2;
    const flatY = (worldY / (sinAngle * 0.5) - worldX / cosAngle) / 2;

    const hex = pixelToHex(flatX, flatY, hexSize);
    const tileKey = getKey(hex.q, hex.r);
    const tile = tiles.get(tileKey);

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

    const angle = Math.PI / 6;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    const flatX = (worldX / cosAngle + worldY / (sinAngle * 0.5)) / 2;
    const flatY = (worldY / (sinAngle * 0.5) - worldX / cosAngle) / 2;

    const hex = pixelToHex(flatX, flatY, hexSize);
    const tileKey = getKey(hex.q, hex.r);
    const tile = tiles.get(tileKey);

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
      <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg backdrop-blur shadow pointer-events-none">
        📐 <span className="font-semibold text-indigo-400">2D İzometrik Görünüm</span> (Yükseklik Kabartmalı 2.5D Perspektif)
      </div>
    </div>
  );
};
