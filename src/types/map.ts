export type HexPoint = { q: number; r: number }; // Axial coordinates

export type MapLayerMode =
  | 'biome'
  | 'topographic'
  | 'tectonic'
  | 'political'
  | 'temperature'
  | 'humidity'
  | 'movement';

export type POIType = 'city' | 'town' | 'village' | 'camp' | 'cave' | 'dungeon';

export interface POI {
  id: string;
  name: string;
  type: POIType;
  icon?: string;
  q: number;
  r: number;
  description?: string;
}

export interface CustomBiome {
  id: string;
  name: string;
  color: string;
  borderColor?: string;
  movementCost: number; // e.g. 1 (normal), 2 (difficult terrain), 3, 99 (impassable)
  minElevation: number; // 0..1
  maxElevation: number; // 0..1
  minTemperature: number; // 0..1
  maxTemperature: number; // 0..1
  minHumidity: number; // 0..1
  maxHumidity: number; // 0..1
  iconName?: string; // Lucide icon identifier or emoji/symbol
}

export interface Faction {
  id: string;
  name: string;
  color: string;
  capitalPoiId?: string;
  description?: string;
}

export type RelationStatus = 'alliance' | 'neutral' | 'war' | 'vassal';

export interface FactionRelation {
  factionId1: string;
  factionId2: string;
  status: RelationStatus;
}

export interface MapToken {
  id: string;
  name: string;
  type: 'player' | 'monster' | 'npc' | 'object' | 'quest';
  icon: string; // Emoji or icon name
  color: string;
  q: number;
  r: number;
  hp?: { current: number; max: number };
  notes?: string;
}

export interface TileData {
  q: number;
  r: number;
  elevation: number;   // 0.0 - 1.0
  temperature: number; // 0.0 - 1.0
  humidity: number;    // 0.0 - 1.0
  fertility: number;   // 0.0 - 1.0 (derived)
  biomeId: string;
  movementCost: number;
  hasRiver: boolean;
  riverDirections: number[]; // 0 to 5 indicating hex edges where river flows
  factionId?: string;
  poi?: POI;
  customColor?: string;
  customIcon?: string;
  plateId?: number;
  tectonicStress?: number;
}

export interface MapConfig {
  width: number;  // Columns / Radius or Grid size (q bounds)
  height: number; // Rows / Grid size (r bounds)
  hexSize: number; // Radius in pixels
  seed: string;
  elevationScale: number;
  temperatureScale: number;
  humidityScale: number;
  riverCount: number;
  poiCount: number;
  // Fractal Noise Parameters (FBM)
  octaves: number;
  persistence: number;
  lacunarity: number;
  // Tectonic Plate Parameters
  useTectonics: boolean;
  plateCount: number;
  oceanicRatio: number;
}
