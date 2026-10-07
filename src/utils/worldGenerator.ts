import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import type { CustomBiome, MapConfig, POI, POIType, TileData } from '../types/map';
import { DEFAULT_BIOMES } from '../constants/biomes';
import { getHexNeighbors, hexDistance } from './hexMath';

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

  // 1. Generate 3-layer Perlin/Simplex noise for Elevation, Temperature, Humidity
  const cols = config.width;
  const rows = config.height;

  for (let q = 0; q < cols; q++) {
    for (let r = 0; r < rows; r++) {
      // Scale coordinates
      const nx = q / (cols * 0.4);
      const ny = r / (rows * 0.4);

      // Multi-octave noise for rich topography
      let elev =
        1.0 * elevationNoise(nx * config.elevationScale, ny * config.elevationScale) +
        0.5 * elevationNoise(nx * config.elevationScale * 2, ny * config.elevationScale * 2) +
        0.25 * elevationNoise(nx * config.elevationScale * 4, ny * config.elevationScale * 4);
      elev = (elev + 1.75) / 3.5; // normalize approximately to 0..1
      elev = Math.max(0, Math.min(1, elev));

      let temp =
        1.0 * tempNoise(nx * config.temperatureScale + 100, ny * config.temperatureScale + 100) +
        0.5 * tempNoise((nx * config.temperatureScale + 100) * 2, (ny * config.temperatureScale + 100) * 2);
      temp = (temp + 1.5) / 3.0;
      // Pole temperature gradient (colder at top/bottom, warmer at center)
      const latitude = Math.abs(r - rows / 2) / (rows / 2);
      temp = temp * 0.7 + (1 - latitude) * 0.3;
      temp = Math.max(0, Math.min(1, temp));

      let hum =
        1.0 * humidityNoise(nx * config.humidityScale + 500, ny * config.humidityScale + 500) +
        0.5 * humidityNoise((nx * config.humidityScale + 500) * 2, (ny * config.humidityScale + 500) * 2);
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

  // 3. Rich POI Generation (Cities, Towns, Villages, Camps, Caves, Dungeons)
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

  landTiles.sort((a, b) => {
    const scoreA = a.fertility + (a.hasRiver ? 0.4 : 0);
    const scoreB = b.fertility + (b.hasRiver ? 0.4 : 0);
    return scoreB - scoreA;
  });

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

  const poiTypesList: { type: POIType; count: number; pool: string[] }[] = [
    { type: 'city', count: Math.max(1, Math.floor(config.poiCount * 0.25)), pool: cityNames },
    { type: 'town', count: Math.max(2, Math.floor(config.poiCount * 0.3)), pool: townNames },
    { type: 'village', count: Math.max(2, Math.floor(config.poiCount * 0.25)), pool: villageNames },
    { type: 'camp', count: Math.max(1, Math.floor(config.poiCount * 0.08)), pool: campNames },
    { type: 'cave', count: Math.max(1, Math.floor(config.poiCount * 0.06)), pool: caveNames },
    { type: 'dungeon', count: Math.max(1, Math.floor(config.poiCount * 0.06)), pool: dungeonNames },
  ];

  let idCounter = 1;
  const minSpacing = config.poiCount > 25 ? 1 : config.poiCount > 15 ? 2 : 3;

  for (const group of poiTypesList) {
    for (let i = 0; i < group.count; i++) {
      const selectedIndex = landTiles.findIndex((tile) => {
        if (tile.poi) return false;
        return pois.every((existing) => hexDistance({ q: tile.q, r: tile.r }, { q: existing.q, r: existing.r }) >= minSpacing);
      });

      if (selectedIndex !== -1) {
        const tile = landTiles[selectedIndex];
        const name = group.pool[i % group.pool.length] + (i >= group.pool.length ? ` ${i + 1}` : '');
        const poi: POI = {
          id: `poi_${idCounter++}`,
          name,
          type: group.type,
          q: tile.q,
          r: tile.r,
          description: `${tile.biomeId} biyomunda yer alan ${group.type}.`,
        };
        tile.poi = poi;
        pois.push(poi);
      }
    }
  }

  return pois;
}
