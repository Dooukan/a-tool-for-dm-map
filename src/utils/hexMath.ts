import type { HexPoint } from '../types/map';

// Flat-topped Hexagon Geometry Math
// Pixel offset logic for rendering hex grid on canvas
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * ((3 / 2) * q);
  const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): HexPoint {
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return cubeToAxial(cubeRound(axialToCube({ q, r })));
}

export function axialToCube(hex: HexPoint): { x: number; y: number; z: number } {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

export function cubeToAxial(cube: { x: number; y: number; z: number }): HexPoint {
  return { q: cube.x, r: cube.z };
}

export function cubeRound(cube: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

export const HEX_DIRECTIONS: HexPoint[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function getHexNeighbors(q: number, r: number): HexPoint[] {
  return HEX_DIRECTIONS.map((dir) => ({ q: q + dir.q, r: r + dir.r }));
}

export function hexDistance(a: HexPoint, b: HexPoint): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

// Draw a single flat-topped hexagon path on canvas
export function drawHexagonPath(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i); // Flat top (0 deg start)
    const x = centerX + size * Math.cos(angleRad);
    const y = centerY + size * Math.sin(angleRad);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}
