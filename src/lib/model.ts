export type EventState = "waiting" | "active" | "paused" | "ended";
export type OrbType = "common" | "epic" | "rare";
export type OrbStatus = "available" | "locked" | "claimed" | "expired";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OrbLock {
  playerId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface Orb {
  type: OrbType;
  branded: boolean;
  prize: string;
  rewardKind?: "reward" | "points";
  pointsAwarded?: number;
  autoSpawned?: boolean;
  inventoryId?: string;
  prizeVisible: boolean;
  spots: LatLng[];
  currentSpotIndex: number;
  location: LatLng;
  radiusMeters: number;
  exitRadiusMeters?: number;
  searchAreaRadiusMeters?: number;
  expiresAt: number;
  cooldownSec: number;
  moveCount: number;
  maxMoves: number;
  status: OrbStatus;
  lock: OrbLock | null;
  claimedBy: string | null;
  claimedByName?: string;
  claimedAt: number | null;
}

/**
 * One ring of the geofence. Wrapped in an object because Firestore cannot store an array whose
 * elements are themselves arrays, which is what a bare list of polygons would be.
 */
export interface GeofenceRing {
  points: LatLng[];
}

export interface OrbEvent {
  state: EventState;
  geofence: GeofenceRing[];
  bufferMeters: number;
  lockWindowSec: number;
  startedAt: number | null;
  endedAt: number | null;
  endsAt?: number | null;
  durationMinutes?: number;
  warningMinutes?: { first: number; last: number };
  spawning?: SpawnSettings;
  unlock?: { holdSeconds: number; frameRadiusFraction: number; recoverySeconds: number };
  scoring?: {
    common: number;
    rare: number;
    epic: number;
    consolation: number;
    firstArrival?: number;
  };
}

export interface SpawnSettings {
  enabled: boolean;
  maxLive: number;
  totalClaims: number;
  expectedPlayers: number;
  rewardFraction: number;
  rareFrequency: number;
  legendaryFrequency: number;
  commonLifetimeSeconds: number;
  rareLifetimeSeconds: number;
  legendaryLifetimeSeconds: number;
  relocationDelaySeconds: number;
  entryRadiusMeters: number;
  exitRadiusMeters: number;
  searchAreaRadiusMeters: number;
}

