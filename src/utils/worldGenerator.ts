import { createNoise4D } from 'simplex-noise';
import alea from 'alea';
import type { CustomBiome, MapConfig, POI, POIType, TileData } from '../types/map';
import { DEFAULT_BIOMES } from '../constants/biomes';
import { getHexNeighborsWrapped, wrappedHexDistance } from './hexMath';

export function generateWorld(
  config: MapConfig,
  customBiomes: CustomBiome[] = DEFAULT_BIOMES
): { tiles: Map<string, TileData>; pois: POI[] } {
  const prng = alea(config.seed);
  const elevationNoise = createNoise4D(prng);
  const tempNoise = createNoise4D(prng);
  const humidityNoise = createNoise4D(prng);

  const tiles = new Map<string, TileData>();

  // Helper key generator
  const getKey = (q: number, r: number) => `${q},${r}`;

  // 1. Generate 3-layer Perlin/Simplex noise for Elevation, Temperature, Humidity
  const cols = config.width;
  const rows = config.height;

  for (let q = 0; q < cols; q++) {
    for (let r = 0; r < rows; r++) {
      // 4D Toroidal Noise sampling for 2D wrapping
      const angleX = (2 * Math.PI * q) / cols;
      const angleY = (2 * Math.PI * r) / rows;

      const scaleE = config.elevationScale * 0.6;
      const xE = (scaleE / (2 * Math.PI)) * Math.cos(angleX);
      const yE = (scaleE / (2 * Math.PI)) * Math.sin(angleX);
      const zE = (scaleE / (2 * Math.PI)) * Math.cos(angleY);
      const wE = (scaleE / (2 * Math.PI)) * Math.sin(angleY);

      let elev =
        1.0 * elevationNoise(xE, yE, zE, wE) +
        0.5 * elevationNoise(xE * 2, yE * 2, zE * 2, wE * 2) +
        0.25 * elevationNoise(xE * 4, yE * 4, zE * 4, wE * 4);
      elev = (elev + 1.5) / 3.0;
      elev = Math.max(0, Math.min(1, elev));

      const scaleT = config.temperatureScale * 0.6;
      const xT = (scaleT / (2 * Math.PI)) * Math.cos(angleX) + 100;
      const yT = (scaleT / (2 * Math.PI)) * Math.sin(angleX) + 100;
      const zT = (scaleT / (2 * Math.PI)) * Math.cos(angleY) + 100;
      const wT = (scaleT / (2 * Math.PI)) * Math.sin(angleY) + 100;

      let temp =
        1.0 * tempNoise(xT, yT, zT, wT) +
        0.5 * tempNoise(xT * 2, yT * 2, zT * 2, wT * 2);
      temp = (temp + 1.5) / 3.0;

      // Periodic temperature gradient (cold poles at top/bottom r=0 and r=rows, warm equator at r=rows/2)
      const latFactor = 0.5 + 0.5 * Math.cos(angleY);
      temp = temp * 0.7 + latFactor * 0.3;
      temp = Math.max(0, Math.min(1, temp));

      const scaleH = config.humidityScale * 0.6;
      const xH = (scaleH / (2 * Math.PI)) * Math.cos(angleX) + 500;
      const yH = (scaleH / (2 * Math.PI)) * Math.sin(angleX) + 500;
      const zH = (scaleH / (2 * Math.PI)) * Math.cos(angleY) + 500;
      const wH = (scaleH / (2 * Math.PI)) * Math.sin(angleY) + 500;

      let hum =
        1.0 * humidityNoise(xH, yH, zH, wH) +
        0.5 * humidityNoise(xH * 2, yH * 2, zH * 2, wH * 2);
      hum = (hum + 1.5) / 3.0;
      hum = Math.max(0, Math.min(1, hum));

      // Fertility formula: high humidity + moderate temperature + reasonable elevation
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

  // 2. Downhill River Generation Algorithm
  generateRivers(tiles, config, prng);

  // 3. Distance-Maximizing / Repelling POI Placement
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

      const neighbors = getHexNeighborsWrapped(current.q, current.r, config.width, config.height)
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

  // Physics-based placement: Repulsion with friction & Hierarchical attraction
  // Cities placed first -> Towns attracted to Cities -> Villages attracted to Towns/Cities
  const frictionCoefficient = 1.5;

  for (const group of poiTypesList) {
    for (let i = 0; i < group.count; i++) {
      let bestTile: TileData | null = null;
      let bestScore = -Infinity;

      for (const tile of landTiles) {
        if (tile.poi) continue;

        // Base desirability score based on fertility and river proximity
        const suitability = tile.fertility * 2.0 + (tile.hasRiver ? 0.8 : 0);

        // 1. Friction-dampened Repulsion from all existing POIs
        let totalRepulsion = 0;
        let minDistanceToOther = Infinity;

        for (const existing of pois) {
          const dist = wrappedHexDistance(
            { q: tile.q, r: tile.r },
            { q: existing.q, r: existing.r },
            config.width,
            config.height
          );

          if (dist < minDistanceToOther) {
            minDistanceToOther = dist;
          }

          // Inverse square law with friction coefficient
          totalRepulsion += 12.0 / (dist * dist + frictionCoefficient);
        }

        // Strict hard repulsion if adjacent or same tile
        if (minDistanceToOther <= 1) continue;

        // 2. Hierarchical Attraction Force
        let totalAttraction = 0;
        if (group.type === 'village') {
          // Villages attracted to Towns & Cities
          for (const existing of pois) {
            if (existing.type === 'town' || existing.type === 'city') {
              const dist = wrappedHexDistance(
                { q: tile.q, r: tile.r },
                { q: existing.q, r: existing.r },
                config.width,
                config.height
              );
              // Pull towards hubs within 2..6 hex distance
              if (dist >= 2 && dist <= 6) {
                totalAttraction += 5.0 / (dist + 1.0);
              }
            }
          }
        } else if (group.type === 'town') {
          // Towns attracted to Cities
          for (const existing of pois) {
            if (existing.type === 'city') {
              const dist = wrappedHexDistance(
                { q: tile.q, r: tile.r },
                { q: existing.q, r: existing.r },
                config.width,
                config.height
              );
              // Pull towards cities within 3..8 hex distance
              if (dist >= 3 && dist <= 8) {
                totalAttraction += 6.0 / (dist + 1.0);
              }
            }
          }
        }

        // Net score = suitability + attraction - friction_dampened_repulsion + spacing_bonus
        const spacingBonus = minDistanceToOther === Infinity ? 5 : Math.min(minDistanceToOther, 8) * 0.5;
        const score = suitability + totalAttraction - totalRepulsion + spacingBonus;

        if (score > bestScore) {
          bestScore = score;
          bestTile = tile;
        }
      }

      // Fallback if no tile met the >1 distance rule (e.g. extremely crowded map)
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
