import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import type { CustomBiome, MapConfig, POI, POIType, TileData } from '../types/map';
import { DEFAULT_BIOMES } from '../constants/biomes';
import { getHexNeighbors, hexDistance, offsetToAxial } from './hexMath';

export function generateWorld(
  config: MapConfig,
  customBiomes: CustomBiome[] = DEFAULT_BIOMES
): { tiles: Map<string, TileData>; pois: POI[] } {
  const prng = alea(config.seed);
  const elevationNoise = createNoise2D(prng);
  const tempNoise = createNoise2D(prng);
  const humidityNoise = createNoise2D(prng);

  const tiles = new Map<string, TileData>();

  // Helper key generator
  const getKey = (q: number, r: number) => `${q},${r}`;

  const cols = config.width;
  const rows = config.height;

  // 1. Generate 3-layer Perlin/Simplex noise in a Rectangular Offset Grid
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const { q, r } = offsetToAxial(col, row);

      const nx = col / cols;
      const ny = row / rows;

      const scaleE = config.elevationScale * 5.0;
      let elev =
        1.0 * elevationNoise(nx * scaleE, ny * scaleE) +
        0.5 * elevationNoise(nx * scaleE * 2, ny * scaleE * 2) +
        0.25 * elevationNoise(nx * scaleE * 4, ny * scaleE * 4);
      elev = (elev + 1.5) / 3.0;
      elev = Math.max(0, Math.min(1, elev));

      const scaleT = config.temperatureScale * 5.0;
      let temp =
        1.0 * tempNoise((nx + 100) * scaleT, (ny + 100) * scaleT) +
        0.5 * tempNoise((nx + 100) * scaleT * 2, (ny + 100) * scaleT * 2);
      temp = (temp + 1.5) / 3.0;

      // Latitude gradient (colder at row 0 and row max, warmer in middle)
      const latFactor = 1.0 - Math.abs(ny - 0.5) * 2;
      temp = temp * 0.7 + latFactor * 0.3;
      temp = Math.max(0, Math.min(1, temp));

      const scaleH = config.humidityScale * 5.0;
      let hum =
        1.0 * humidityNoise((nx + 500) * scaleH, (ny + 500) * scaleH) +
        0.5 * humidityNoise((nx + 500) * scaleH * 2, (ny + 500) * scaleH * 2);
      hum = (hum + 1.5) / 3.0;
      hum = Math.max(0, Math.min(1, hum));

      // Fertility formula
      let fertility = hum * (1 - Math.abs(temp - 0.6)) * (elev > 0.3 && elev < 0.85 ? 1 : 0.2);
      fertility = Math.max(0, Math.min(1, fertility));

      // Match biome
      const biome = matchBiome(elev, temp, hum, customBiomes);

      tiles.set(getKey(q, r), {
        q,
        r,
        elevation: elev,
        temperature: temp,
        humidity: hum,
        fertility,
        biomeId: biome.id,
        movementCost: biome.movementCost,
        hasRiver: false,
        riverDirections: [],
      });
    }
  }

  // 2. Downhill River Generation
  generateRivers(tiles, config, prng);

  // 3. Distance-Maximizing & Repelling POI Placement
  const pois = generatePOIs(tiles, config);

  return { tiles, pois };
}

function matchBiome(elev: number, temp: number, hum: number, customBiomes: CustomBiome[]): CustomBiome {
  for (const biome of customBiomes) {
    if (
      elev >= biome.minElevation &&
      elev <= biome.maxElevation &&
      temp >= biome.minTemperature &&
      temp <= biome.maxTemperature &&
      hum >= biome.minHumidity &&
      hum <= biome.maxHumidity
    ) {
      return biome;
    }
  }

  if (elev < 0.25) return customBiomes.find((b) => b.id === 'deep_ocean') || customBiomes[0];
  if (elev > 0.8) return customBiomes.find((b) => b.id === 'high_mountains') || customBiomes[customBiomes.length - 1];
  return customBiomes.find((b) => b.id === 'grassland') || customBiomes[0];
}

function generateRivers(tiles: Map<string, TileData>, config: MapConfig, prng: () => number) {
  const getKey = (q: number, r: number) => `${q},${r}`;
  const candidates: TileData[] = [];

  tiles.forEach((tile) => {
    if (tile.elevation > 0.65 && tile.humidity > 0.45) {
      candidates.push(tile);
    }
  });

  candidates.sort(() => prng() - 0.5);
  const sources = candidates.slice(0, config.riverCount);

  sources.forEach((source) => {
    let current = source;
    const visited = new Set<string>();

    for (let step = 0; step < 40; step++) {
      visited.add(getKey(current.q, current.r));
      current.hasRiver = true;

      if (current.elevation <= 0.3) break;

      const neighbors = getHexNeighbors(current.q, current.r)
        .map((n) => tiles.get(getKey(n.q, n.r)))
        .filter((t): t is TileData => t !== undefined && !visited.has(getKey(t.q, t.r)));

      if (neighbors.length === 0) break;

      neighbors.sort((a, b) => a.elevation - b.elevation);

      const lowest = neighbors[0];
      if (lowest.elevation < current.elevation) {
        current = lowest;
      } else {
        const randomIndex = Math.floor(prng() * neighbors.length);
        current = neighbors[randomIndex];
      }
    }
  });
}

function generatePOIs(tiles: Map<string, TileData>, config: MapConfig): POI[] {
  const pois: POI[] = [];

  const landTiles: TileData[] = [];
  tiles.forEach((tile) => {
    if (tile.elevation > 0.32 && tile.elevation < 0.88) {
      landTiles.push(tile);
    }
  });

  if (landTiles.length === 0) return pois;

  const cityNames = [
    'Eldoria', 'Valenhold', 'Ironforge', 'Aethelgard', 'Stormwatch', 'Oakhaven', 'Shadowfen',
    'Sunspire', 'Silvermoon', 'Dragonreach', 'Highgate', 'Winterfell', 'Neverwinter', 'Waterdeep',
    'Baldurs Gate', 'Aramoor', 'Kraghammer', 'Aurelia', 'Brimstone Capital', 'Vanguard Keep'
  ];

  const townNames = [
    'Riverbend', 'Stonehill', 'Greenfield', 'Crossroads', 'Mistwood', 'Falconcreek', 'Amberfall',
    'Pinehaven', 'Ravencrest', 'Boulderdash', 'Clearwater', 'Goldshire', 'Southshore', 'Moorland'
  ];

  const villageNames = [
    'Mossybank', 'Whispering Pines', 'Hollow Creek', 'Brambleton', 'Thornbury', 'Millstone',
    'Willowbrook', 'Sunfield', 'Deepdell', 'Froggy Bottom', 'Oakhaven Village', 'Rivermouth'
  ];

  const campNames = ['Bandit Camp', 'Hunter Outpost', 'Nomad Encampment', 'Goblin Lair', 'Mercenary Bivouac', 'Ranger Watchpost'];
  const caveNames = ['Dark Cavern', 'Crystal Cave', 'Smuggler Cave', 'Echoing Abyss', 'Obsidian Den', 'Batwing Mine'];
  const dungeonNames = ['Forgotten Ruins', 'Lich Tomb', 'Ancient Catacombs', 'Crypt of Shadows', 'Sunken Temple', 'Dread Stronghold'];

  const targetPoiCount = Math.max(1, config.poiCount);

  const poiTypesList: { type: POIType; count: number; pool: string[] }[] = [
    { type: 'city', count: Math.max(1, Math.floor(targetPoiCount * 0.25)), pool: cityNames },
    { type: 'town', count: Math.max(1, Math.floor(targetPoiCount * 0.3)), pool: townNames },
    { type: 'village', count: Math.max(1, Math.floor(targetPoiCount * 0.25)), pool: villageNames },
    { type: 'camp', count: Math.max(1, Math.floor(targetPoiCount * 0.08)), pool: campNames },
    { type: 'cave', count: Math.max(1, Math.floor(targetPoiCount * 0.06)), pool: caveNames },
    { type: 'dungeon', count: Math.max(1, Math.floor(targetPoiCount * 0.06)), pool: dungeonNames },
  ];

  let idCounter = 1;
  const frictionCoefficient = 1.5;

  for (const group of poiTypesList) {
    for (let i = 0; i < group.count; i++) {
      let bestTile: TileData | null = null;
      let bestScore = -Infinity;

      for (const tile of landTiles) {
        if (tile.poi) continue;

        const suitability = tile.fertility * 2.0 + (tile.hasRiver ? 0.8 : 0);

        let totalRepulsion = 0;
        let minDistanceToOther = Infinity;

        for (const existing of pois) {
          const dist = hexDistance(
            { q: tile.q, r: tile.r },
            { q: existing.q, r: existing.r }
          );

          if (dist < minDistanceToOther) {
            minDistanceToOther = dist;
          }

          totalRepulsion += 12.0 / (dist * dist + frictionCoefficient);
        }

        if (minDistanceToOther <= 1) continue;

        let totalAttraction = 0;
        if (group.type === 'village') {
          for (const existing of pois) {
            if (existing.type === 'town' || existing.type === 'city') {
              const dist = hexDistance(
                { q: tile.q, r: tile.r },
                { q: existing.q, r: existing.r }
              );
              if (dist >= 2 && dist <= 6) {
                totalAttraction += 5.0 / (dist + 1.0);
              }
            }
          }
        } else if (group.type === 'town') {
          for (const existing of pois) {
            if (existing.type === 'city') {
              const dist = hexDistance(
                { q: tile.q, r: tile.r },
                { q: existing.q, r: existing.r }
              );
              if (dist >= 3 && dist <= 8) {
                totalAttraction += 6.0 / (dist + 1.0);
              }
            }
          }
        }

        const spacingBonus = minDistanceToOther === Infinity ? 5 : Math.min(minDistanceToOther, 8) * 0.5;
        const score = suitability + totalAttraction - totalRepulsion + spacingBonus;

        if (score > bestScore) {
          bestScore = score;
          bestTile = tile;
        }
      }

      if (!bestTile) {
        for (const tile of landTiles) {
          if (!tile.poi) {
            bestTile = tile;
            break;
          }
        }
      }

      if (bestTile) {
        const name = group.pool[i % group.pool.length] + (i >= group.pool.length ? ` ${i + 1}` : '');
        const poi: POI = {
          id: `poi_${idCounter++}`,
          name,
          type: group.type,
          q: bestTile.q,
          r: bestTile.r,
          description: `${bestTile.biomeId} biyomunda yer alan ${group.type}.`,
        };
        bestTile.poi = poi;
        pois.push(poi);
      }
    }
  }

  return pois;
}
