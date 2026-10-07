import type { HexPoint, TileData } from '../types/map';
import { getHexNeighbors, hexDistance } from './hexMath';

export function findHexPath(
  startHex: HexPoint,
  targetHex: HexPoint,
  tiles: Map<string, TileData>
): { path: HexPoint[]; totalCost: number } | null {
  const getKey = (q: number, r: number) => `${q},${r}`;

  const startKey = getKey(startHex.q, startHex.r);
  const targetKey = getKey(targetHex.q, targetHex.r);

  if (!tiles.has(startKey) || !tiles.has(targetKey)) return null;

  interface QueueNode {
    key: string;
    point: HexPoint;
    gScore: number;
    fScore: number;
  }

  const openSet: Map<string, QueueNode> = new Map();
  const cameFrom: Map<string, HexPoint> = new Map();
  const gScore: Map<string, number> = new Map();

  gScore.set(startKey, 0);
  openSet.set(startKey, {
    key: startKey,
    point: startHex,
    gScore: 0,
    fScore: hexDistance(startHex, targetHex),
  });

  while (openSet.size > 0) {
    let currentKey = '';
    let lowestF = Infinity;

    openSet.forEach((node, key) => {
      if (node.fScore < lowestF) {
        lowestF = node.fScore;
        currentKey = key;
      }
    });

    const currentNode = openSet.get(currentKey)!;

    if (currentKey === targetKey) {
      const path: HexPoint[] = [targetHex];
      let curr = targetKey;

      while (cameFrom.has(curr)) {
        const prev = cameFrom.get(curr)!;
        path.unshift(prev);
        curr = getKey(prev.q, prev.r);
      }

      return { path, totalCost: gScore.get(targetKey) || 0 };
    }

    openSet.delete(currentKey);

    const neighbors = getHexNeighbors(currentNode.point.q, currentNode.point.r);

    for (const neighbor of neighbors) {
      const nKey = getKey(neighbor.q, neighbor.r);
      const neighborTile = tiles.get(nKey);

      if (!neighborTile || neighborTile.movementCost >= 99) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + neighborTile.movementCost;

      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentNode.point);
        gScore.set(nKey, tentativeG);

        const fScore = tentativeG + hexDistance(neighbor, targetHex);
        openSet.set(nKey, {
          key: nKey,
          point: neighbor,
          gScore: tentativeG,
          fScore,
        });
      }
    }
  }

  return null;
}
