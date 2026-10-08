import alea from 'alea';
import type { HexPoint } from '../types/map';
import { hexDistance } from './hexMath';

export interface Plate {
  id: number;
  center: HexPoint;
  isOceanic: boolean;
  color: string;
  motionVector: { x: number; y: number; z: number };
}

export interface TectonicResult {
  plateMap: Map<string, number>;
  stressMap: Map<string, number>;
  elevationModifierMap: Map<string, number>;
}

export function simulateTectonics(
  width: number,
  height: number,
  plateCount: number,
  oceanicRatio: number,
  seed: string,
  offsetToAxial: (col: number, row: number) => HexPoint
): TectonicResult {
  const prng = alea(`${seed}_tectonics`);
  const plateMap = new Map<string, number>();
  const stressMap = new Map<string, number>();
  const elevationModifierMap = new Map<string, number>();

  const getKey = (q: number, r: number) => `${q},${r}`;

  const plates: Plate[] = [];
  const colors = [
    '#e11d48', '#0284c7', '#16a34a', '#ca8a04', '#9333ea',
    '#0891b2', '#ea580c', '#4d7c0f', '#be185d', '#1d4ed8'
  ];

  for (let i = 0; i < plateCount; i++) {
    const col = Math.floor(prng() * width);
    const row = Math.floor(prng() * height);
    const center = offsetToAxial(col, row);

    const angle = prng() * Math.PI * 2;
    const z = prng() * 2 - 1;
    const rScale = Math.sqrt(1 - z * z);

    plates.push({
      id: i,
      center,
      isOceanic: prng() < oceanicRatio,
      color: colors[i % colors.length],
      motionVector: {
        x: rScale * Math.cos(angle),
        y: rScale * Math.sin(angle),
        z,
      },
    });
  }

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const tileHex = offsetToAxial(col, row);
      let closestPlateId = 0;
      let minDistance = Infinity;

      for (const plate of plates) {
        const dist = hexDistance(tileHex, plate.center) + (prng() * 0.8 - 0.4);
        if (dist < minDistance) {
          minDistance = dist;
          closestPlateId = plate.id;
        }
      }

      plateMap.set(getKey(tileHex.q, tileHex.r), closestPlateId);
    }
  }

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const currentHex = offsetToAxial(col, row);
      const currentKey = getKey(currentHex.q, currentHex.r);
      const currentPlateId = plateMap.get(currentKey);
      if (currentPlateId === undefined) continue;

      const currentPlate = plates[currentPlateId];
      let elevDelta = currentPlate.isOceanic ? -0.18 : 0.12;

      const neighbors = [
        { q: currentHex.q + 1, r: currentHex.r },
        { q: currentHex.q - 1, r: currentHex.r },
        { q: currentHex.q, r: currentHex.r + 1 },
        { q: currentHex.q, r: currentHex.r - 1 },
      ];

      let maxStress = 0;

      for (const n of neighbors) {
        const neighborKey = getKey(n.q, n.r);
        const neighborPlateId = plateMap.get(neighborKey);

        if (neighborPlateId !== undefined && neighborPlateId !== currentPlateId) {
          const neighborPlate = plates[neighborPlateId];

          const dotProd =
            currentPlate.motionVector.x * neighborPlate.motionVector.x +
            currentPlate.motionVector.y * neighborPlate.motionVector.y +
            currentPlate.motionVector.z * neighborPlate.motionVector.z;

          const stress = -dotProd;

          if (Math.abs(stress) > Math.abs(maxStress)) {
            maxStress = stress;
          }
        }
      }

      if (maxStress > 0.15) {
        elevDelta += maxStress * 0.45;
      } else if (maxStress < -0.15) {
        elevDelta += maxStress * 0.25;
      }

      stressMap.set(currentKey, maxStress);
      elevationModifierMap.set(currentKey, elevDelta);
    }
  }

  return { plateMap, stressMap, elevationModifierMap };
}
