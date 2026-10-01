import type { LatLng, SpawnSettings } from './model';
export interface AdminRequest {
    action: string;
    eventId: string;
    orbId?: string;
    create?: boolean;
    reactivate?: boolean;
    type?: string;
    prize?: string;
    rewardKind?: 'reward' | 'points';
    prizeVisible?: boolean;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    lifetimeMinutes?: number;
    name?: string;
    bufferMeters?: number;
    lockWindowSec?: number;
    commonPoints?: number;
    rarePoints?: number;
    epicPoints?: number;
    consolationPoints?: number;
    firstArrivalPoints?: number;
    holdSeconds?: number;
    frameRadiusFraction?: number;
    recoverySeconds?: number;
    state?: string;
    durationMinutes?: number;
    firstWarningMinutes?: number;
    lastWarningMinutes?: number;
    spawning?: SpawnSettings;
    inventoryId?: string;
    quantity?: number;
    expectedRemaining?: number;
    zonePoints?: LatLng[];
    code?: string;
    sourceEventId?: string;
    acknowledgeWarnings?: boolean;
    uid?: string;
    email?: string;
    limit?: number;
    cursor?: string;
    tier?: string;
    category?: string;
    actorUid?: string;
    asOf?: number;
}
export interface AccessResult {
    ok: true;
    isAdmin: boolean;
    role: 'organizer' | 'redemption' | 'none';
    eventIds: string[];
}
export interface EventSummary {
    id: string;
    name: string;
    state: string;
    createdAt: number;
    startedAt: number | null;
    endedAt: number | null;
}
export interface Readiness {
    canStart: boolean;
    blockers: string[];
    warnings: string[];
    checkedAt: number;
}
