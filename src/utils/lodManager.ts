import type { TileData } from '../types/map';

export interface ChunkLOD {
  chunkX: number;
  chunkY: number;
  lodLevel: number; // 0 = Full detail, 1 = 2x2 group, 2 = 4x4 group
  avgElevation: number;
  avgTemperature: number;
  avgHumidity: number;
  primaryBiomeId: string;
  tiles: TileData[];
}

export class LODManager {
  chunkSize: number;

  constructor(chunkSize: number = 8) {
    this.chunkSize = chunkSize;
  }

  // Aggregate tiles into LOD chunks based on scale / distance
  public createLODChunks(tiles: Map<string, TileData>, lodLevel: number): ChunkLOD[] {
    const chunkMap = new Map<string, TileData[]>();

    // Step 1: Group tiles by chunk coordinates
    tiles.forEach((tile) => {
      // Approximate rectangular grid coordinates from q, r
      const col = tile.q;
      const row = tile.r + Math.floor(tile.q / 2);

      const chunkX = Math.floor(col / this.chunkSize);
      const chunkY = Math.floor(row / this.chunkSize);
      const key = `${chunkX},${chunkY}`;

      if (!chunkMap.has(key)) {
        chunkMap.set(key, []);
      }
      chunkMap.get(key)!.push(tile);
    });

    const chunks: ChunkLOD[] = [];

    // Step 2: Calculate aggregate metrics for each chunk
    chunkMap.forEach((chunkTiles, key) => {
      const [chunkX, chunkY] = key.split(',').map(Number);

      let sumElev = 0;
      let sumTemp = 0;
      let sumHum = 0;
      const biomeCounts = new Map<string, number>();

      chunkTiles.forEach((tile) => {
        sumElev += tile.elevation;
        sumTemp += tile.temperature;
        sumHum += tile.humidity;

        biomeCounts.set(tile.biomeId, (biomeCounts.get(tile.biomeId) || 0) + 1);
      });

      // Find predominant biome
      let primaryBiomeId = chunkTiles[0]?.biomeId || 'grassland';
      let maxCount = 0;
      biomeCounts.forEach((count, bId) => {
        if (count > maxCount) {
          maxCount = count;
          primaryBiomeId = bId;
        }
      });

      chunks.push({
        chunkX,
        chunkY,
        lodLevel,
        avgElevation: sumElev / chunkTiles.length,
        avgTemperature: sumTemp / chunkTiles.length,
        avgHumidity: sumHum / chunkTiles.length,
        primaryBiomeId,
        tiles: chunkTiles,
      });
    });

    return chunks;
  }

  // Determine active LOD level based on camera scale or distance
  public static getLODLevelForScale(scale: number): number {
    if (scale > 1.2) return 0; // High detail (individual tiles)
    if (scale > 0.6) return 1; // Medium detail (LOD 1)
    return 2; // Low detail (LOD 2 chunks)
  }
}
