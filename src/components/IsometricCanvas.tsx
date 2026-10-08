import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { CustomBiome, Faction, MapLayerMode, MapToken, TileData } from '../types/map';
import { hexToPixel, pixelToHex } from '../utils/hexMath';
import { RotateCcw, RotateCw, RefreshCw } from 'lucide-react';

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

  // Pan, Zoom & Rotation state
  const [transform, setTransform] = useState({ x: window.innerWidth / 2, y: 220, scale: 1.0 });
  const [rotationAngle, setRotationAngle] = useState<number>(0);
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

  // Camera view angle in radians
  const rad = (rotationAngle * Math.PI) / 180;
  const cosRot = Math.cos(rad);
  const sinRot = Math.sin(rad);

  // Isometric projection constants: 30 degree angle (cos=sqrt(3)/2, sin=0.5)
  const cosIso = Math.cos(Math.PI / 6); // ~0.866025
  const sinIso = Math.sin(Math.PI / 6); // 0.5

  // Depth-sort tiles according to isometric ground projection
  const sortedTiles = useMemo(() => {
    const arr = Array.from(tiles.values());
    arr.sort((a, b) => {
      const { x: ax, y: ay } = hexToPixel(a.q, a.r, hexSize);
      const { x: bx, y: by } = hexToPixel(b.q, b.r, hexSize);

      const rotAx = ax * cosRot - ay * sinRot;
      const rotAy = ax * sinRot + ay * cosRot;

      const rotBx = bx * cosRot - by * sinRot;
      const rotBy = bx * sinRot + by * cosRot;

      const groundYA = (rotAx + rotAy) * sinIso;
      const groundYB = (rotBx + rotBy) * sinIso;

      if (Math.abs(groundYA - groundYB) > 0.01) {
        return groundYA - groundYB;
      }
      return a.elevation - b.elevation;
    });
    return arr;
  }, [tiles, hexSize, sinRot, cosRot, sinIso]);

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

    const maxExtrusion = 45;
    const baseColumnHeight = 14;

    sortedTiles.forEach((tile) => {
      const { x: flatX, y: flatY } = hexToPixel(tile.q, tile.r, hexSize);

      const elevationOffset = tile.elevation * maxExtrusion;
      const prismHeight = baseColumnHeight + elevationOffset;

      // 1. Calculate 6 top surface vertices projected into isometric 3D space
      const topVertices: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const angleRad = (i * Math.PI) / 3; // Flat-topped hex angles: 0°, 60°, 120°, 180°, 240°, 300°
        const vx = flatX + hexSize * Math.cos(angleRad);
        const vy = flatY + hexSize * Math.sin(angleRad);

        // World rotation around origin
        const rotVx = vx * cosRot - vy * sinRot;
        const rotVy = vx * sinRot + vy * cosRot;

        // Exact Isometric Projection (2:1 aspect ratio)
        const isoVx = (rotVx - rotVy) * cosIso;
        const isoVy = (rotVx + rotVy) * sinIso - elevationOffset;
        topVertices.push({ x: isoVx, y: isoVy });
      }

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

      // Draw Extruded 3D Hexagonal Column Side Walls (front-facing faces)
      for (let i = 0; i < 6; i++) {
        const nextI = (i + 1) % 6;
        const p1 = topVertices[i];
        const p2 = topVertices[nextI];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // In 2D screen projection, side faces with dx > 0 face towards the camera (clockwise winding order)
        if (dx > 0.001) {
          const p3 = { x: p2.x, y: p2.y + prismHeight };
          const p4 = { x: p1.x, y: p1.y + prismHeight };

          // Directional normal lighting calculation
          const wallAngle = Math.atan2(dy, dx);
          const lightFactor = Math.max(0.35, Math.min(0.85, 0.6 + 0.35 * Math.sin(wallAngle)));
          const sideColor = adjustColorBrightness(fillColor, lightFactor);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fillStyle = sideColor;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw Top Hex Surface (Flat-topped hex projected into Isometric plane)
      ctx.beginPath();
      ctx.moveTo(topVertices[0].x, topVertices[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(topVertices[i].x, topVertices[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Path Highlight
      if (pathSet.has(getKey(tile.q, tile.r))) {
        ctx.beginPath();
        ctx.moveTo(topVertices[0].x, topVertices[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(topVertices[i].x, topVertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Selected Tile Highlight
      if (selectedTileKey === getKey(tile.q, tile.r)) {
        ctx.beginPath();
        ctx.moveTo(topVertices[0].x, topVertices[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(topVertices[i].x, topVertices[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Hovered Tile Highlight
      if (hoveredTile && hoveredTile.q === tile.q && hoveredTile.r === tile.r) {
        ctx.beginPath();
        ctx.moveTo(topVertices[0].x, topVertices[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(topVertices[i].x, topVertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // POI Icons
      if (tile.poi) {
        const rotX = flatX * cosRot - flatY * sinRot;
        const rotY = flatX * sinRot + flatY * cosRot;
        const isoX = (rotX - rotY) * cosIso;
        const isoY = (rotX + rotY) * sinIso - elevationOffset;

        ctx.font = `${Math.floor(hexSize * 0.85)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let symbol = '🏛️';
        if (tile.poi.type === 'town') symbol = '🏡';
        if (tile.poi.type === 'village') symbol = '🛖';
        if (tile.poi.type === 'camp') symbol = '⛺';
        if (tile.poi.type === 'cave') symbol = '🕳️';
        if (tile.poi.type === 'dungeon') symbol = '💀';
        ctx.fillText(symbol, isoX, isoY - 2);
      }
    });

    // Render Map Tokens
    tokens.forEach((token) => {
      const tileKey = `${token.q},${token.r}`;
      const tile = tiles.get(tileKey);
      const elev = tile ? tile.elevation * maxExtrusion : 0;
      const { x: flatX, y: flatY } = hexToPixel(token.q, token.r, hexSize);

      const rotX = flatX * cosRot - flatY * sinRot;
      const rotY = flatX * sinRot + flatY * cosRot;

      const isoX = (rotX - rotY) * cosIso;
      const isoY = (rotX + rotY) * sinIso - elev;

      ctx.beginPath();
      ctx.arc(isoX, isoY - 4, hexSize * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = token.color || '#ec4899';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.floor(hexSize * 0.55)}px sans-serif`;
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
    layerMode,
    hexSize,
    transform,
    cosRot,
    sinRot,
    cosIso,
    sinIso,
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

  // Exact inverse raycasting from screen mouse coordinates to world axial hex coordinates
  const getHexAtMouse = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      // Un-project pan & zoom
      const screenX = (mouseX - transform.x) / transform.scale;
      const screenY = (mouseY - transform.y) / transform.scale;

      // Exact inverse isometric projection
      const rotX = 0.5 * (screenX / cosIso + screenY / sinIso);
      const rotY = 0.5 * (screenY / sinIso - screenX / cosIso);

      // Un-rotate by camera rotation angle (-rad)
      const flatX = rotX * cosRot + rotY * sinRot;
      const flatY = -rotX * sinRot + rotY * cosRot;

      const hex = pixelToHex(flatX, flatY, hexSize);
      return getKey(hex.q, hex.r);
    },
    [transform, cosIso, sinIso, cosRot, sinRot, hexSize]
  );

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }

    const tileKey = getHexAtMouse(e.clientX, e.clientY);
    const tile = tileKey ? tiles.get(tileKey) || null : null;
    onTileHover(tile);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(false);

    const tileKey = getHexAtMouse(e.clientX, e.clientY);
    const tile = tileKey ? tiles.get(tileKey) || null : null;
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

      {/* Top Banner & Interactive Rotation Control Buttons */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl backdrop-blur shadow-xl">
        <span>📐 <span className="font-semibold text-indigo-400">2D İzometrik Prizma Görünümü</span></span>
        <div className="h-4 w-[1px] bg-slate-700 mx-1" />
        <button
          onClick={() => setRotationAngle((prev) => (prev - 90 + 360) % 360)}
          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-0.5 transition"
          title="-90° Döndür"
        >
          <RotateCcw className="w-3.5 h-3.5 text-indigo-400" /> -90°
        </button>
        <button
          onClick={() => setRotationAngle((prev) => (prev - 45 + 360) % 360)}
          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-0.5 transition"
          title="-45° Döndür"
        >
          <RotateCcw className="w-3.5 h-3.5 text-indigo-400" /> -45°
        </button>
        <button
          onClick={() => setRotationAngle((prev) => (prev + 45) % 360)}
          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-0.5 transition"
          title="+45° Döndür"
        >
          <RotateCw className="w-3.5 h-3.5 text-indigo-400" /> +45°
        </button>
        <button
          onClick={() => setRotationAngle((prev) => (prev + 90) % 360)}
          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-0.5 transition"
          title="+90° Döndür"
        >
          <RotateCw className="w-3.5 h-3.5 text-indigo-400" /> +90°
        </button>
        <button
          onClick={() => setRotationAngle(0)}
          className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded flex items-center transition"
          title="Açıyı Sıfırla (0°)"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] text-amber-400 ml-1 font-semibold">{rotationAngle}°</span>
      </div>
    </div>
  );
};
