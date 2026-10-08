import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { CustomBiome, Faction, MapLayerMode, TileData } from '../types/map';
import { axialToOffset } from '../utils/hexMath';

interface GlobeCanvasProps {
  tiles: Map<string, TileData>;
  biomes: CustomBiome[];
  factions: Faction[];
  layerMode: MapLayerMode;
  width: number;
  height: number;
  selectedTileKey: string | null;
  onTileHover: (tile: TileData | null) => void;
  onTileClick: (tile: TileData) => void;
}

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  tiles,
  biomes,
  factions,
  layerMode,
  width,
  height,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Setup Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);

    // 3. Create Dynamic Map Texture Canvas
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 1024;
    texCanvas.height = 512;
    const ctx = texCanvas.getContext('2d');

    const biomeMap = new Map<string, CustomBiome>();
    biomes.forEach((b) => biomeMap.set(b.id, b));

    const factionMap = new Map<string, Faction>();
    factions.forEach((f) => factionMap.set(f.id, f));

    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, texCanvas.width, texCanvas.height);

      const cellW = texCanvas.width / width;
      const cellH = texCanvas.height / height;

      tiles.forEach((tile) => {
        const { col, row } = axialToOffset(tile.q, tile.r);
        const x = col * cellW;
        const y = row * cellH;

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
            case 'tectonic': {
              if (tile.plateId !== undefined) {
                const colors = ['#e11d48', '#0284c7', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c'];
                fillColor = colors[tile.plateId % colors.length];
              } else {
                fillColor = '#1e293b';
              }
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
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);

        if (tile.hasRiver) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // 4. Create Globe Geometry with Dynamic LOD
    const globeRadius = 1.5;
    const geometry = new THREE.SphereGeometry(globeRadius, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.1,
    });

    const globeMesh = new THREE.Mesh(geometry, material);
    scene.add(globeMesh);

    // Atmosphere Glow Shell
    const atmosGeometry = new THREE.SphereGeometry(globeRadius * 1.03, 32, 32);
    const atmosMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    scene.add(atmosMesh);

    // 5. Interactive Orbit Mouse Drag Logic
    let isMouseDown = false;
    let prevMousePos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      globeMesh.rotation.y += deltaX * 0.008;
      globeMesh.rotation.x += deltaY * 0.008;

      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.min(Math.max(2.2, camera.position.z + e.deltaY * 0.003), 8.0);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel);

    // 6. Animation Loop with Slow Rotation
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isMouseDown) {
        globeMesh.rotation.y += 0.0012; // Gentle auto-rotation
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [tiles, biomes, factions, layerMode, width, height]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg backdrop-blur shadow pointer-events-none">
        🌐 <span className="font-semibold text-indigo-400">3D Planet Globe View</span> (Sürükleyerek Döndürün, Çark ile Yakınlaşın)
      </div>
    </div>
  );
};
