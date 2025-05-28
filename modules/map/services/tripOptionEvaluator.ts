// pasada-gemini/modules/map/services/tripOptionEvaluator.ts
import { PlannedTripLeg, Coordinate } from '../utils/routeTypes';
import {
    TRANSFER_PENALTY_SCORE,
    WALK_METER_PENALTY_SCORE,
    JEEP_DURATION_PENALTY_SCORE,
    INITIAL_WALK_PENALTY_MULTIPLIER,
    SIMILARITY_FINGERPRINT_COORD_PRECISION,
    // These thresholds become less critical if structural identity is primary,
    // but can be used for near-matches if fingerprints differ.
    SIMILARITY_MAX_WALK_DIFF_METERS,
    SIMILARITY_MAX_DURATION_DIFF_SECONDS,
    SIMILARITY_TRANSFER_POINT_PROXIMITY_METERS,
    MAX_TRIP_OPTIONS_TO_RETURN
} from '../constants/tripPlanningConstants';
import { calculateDistance } from './mapApiServices';

interface TripOptionDetails {
  legs: PlannedTripLeg[];
  fingerprint: string; // Based on key coordinates and route IDs
  score: number;
  totalWalkDistance: number;
  totalJeepDistance: number;
  totalDuration: number;
  numTransfers: number;
  id: string; // Original index or unique ID
  jeepRouteSequence: string[]; // Sequence of jeepney route IDs
  legTypeSequence: string[]; // Sequence of leg types ('walk', 'jeepney')
  // keyCoordinates: string[]; // Can be used for more advanced fingerprinting if needed
}

function roundCoord(coord: number): string {
    return coord.toFixed(SIMILARITY_FINGERPRINT_COORD_PRECISION);
}

function generateTripFingerprint(legs: PlannedTripLeg[]): string {
    let fingerprintParts: string[] = [];
    if (legs.length === 0) return "empty";

    // Simplified fingerprint: sequence of leg types and jeep route IDs
    // More detailed fingerprinting can include key coordinates if needed for other scenarios
    legs.forEach(leg => {
        if (leg.type === 'jeepney') {
            fingerprintParts.push(`J:${leg.routeId || 'unknown'}`);
        } else {
            fingerprintParts.push('W');
        }
        // For a more robust fingerprint against slight coordinate variations,
        // one might include rounded start/end coordinates of jeepney legs
        // or significant turning points in walk legs.
        // Example for jeep start/end:
        // if (leg.type === 'jeepney' && leg.coordinates.length > 1) {
        //     const start = leg.coordinates[0];
        //     const end = leg.coordinates[leg.coordinates.length - 1];
        //     fingerprintParts.push(`S:${roundCoord(start.latitude)},${roundCoord(start.longitude)}`);
        //     fingerprintParts.push(`E:${roundCoord(end.latitude)},${roundCoord(end.longitude)}`);
        // }
    });
    return fingerprintParts.join('|');
}


function calculateTripMetrics(legs: PlannedTripLeg[]): Omit<TripOptionDetails, 'fingerprint' | 'score' | 'id' | 'jeepRouteSequence' | 'legTypeSequence'> {
    let totalWalkDistance = 0;
    let totalJeepDistance = 0;
    let totalDuration = 0;
    let jeepLegCount = 0;

    legs.forEach((leg) => {
        const dist = typeof leg.distance === 'number' ? leg.distance : 0;
        // Estimate duration if not present: walk ~1.4m/s (5km/h), jeep ~5.5m/s (20km/h)
        const dur = typeof leg.duration === 'number' ? leg.duration : (dist / (leg.type === 'walk' ? 1.4 : 5.5));
        totalDuration += dur;

        if (leg.type === 'walk') {
            totalWalkDistance += dist;
        } else if (leg.type === 'jeepney') {
            totalJeepDistance += dist;
            jeepLegCount++;
        }
    });
    const numTransfers = Math.max(0, jeepLegCount - 1);
    return { legs, totalWalkDistance, totalJeepDistance, totalDuration, numTransfers };
}

function scoreTripOption(metrics: Omit<TripOptionDetails, 'fingerprint' | 'score' | 'id' | 'jeepRouteSequence' | 'legTypeSequence'>): number {
    let score = (metrics.numTransfers * TRANSFER_PENALTY_SCORE) +
                (metrics.totalWalkDistance * WALK_METER_PENALTY_SCORE) +
                (metrics.totalDuration * JEEP_DURATION_PENALTY_SCORE);

    if (metrics.legs.length > 0 && metrics.legs[0].type === 'walk') {
        const initialWalkDist = typeof metrics.legs[0].distance === 'number' ? metrics.legs[0].distance : 0;
        score += (initialWalkDist * WALK_METER_PENALTY_SCORE * (INITIAL_WALK_PENALTY_MULTIPLIER - 1));
    }
    return score;
}

function getJeepRouteSequence(legs: PlannedTripLeg[]): string[] {
    return legs.filter(leg => leg.type === 'jeepney').map(leg => leg.routeId || 'unknown_route_id');
}

function getLegTypeSequence(legs: PlannedTripLeg[]): string[] {
    return legs.map(leg => leg.type);
}

function areCoordsClose(coordA?: Coordinate, coordB?: Coordinate, threshold?: number): boolean {
    if (!coordA || !coordB || typeof threshold !== 'number') return false;
    return calculateDistance(coordA, coordB) <= threshold;
}

function areTripsEffectivelyIdentical(optionA: TripOptionDetails, optionB: TripOptionDetails): boolean {
    // 1. Different number of legs means they are fundamentally different.
    if (optionA.legs.length !== optionB.legs.length) {
        return false;
    }

    // 2. Check if the sequence of leg types is identical.
    // (e.g., Walk-Jeep-Walk vs. Walk-Jeep-Jeep-Walk)
    if (optionA.legTypeSequence.join(',') !== optionB.legTypeSequence.join(',')) {
        return false;
    }

    // 3. Check if the sequence of jeepney route IDs is identical.
    // This is the core of "same journey steps" for jeepney segments.
    if (optionA.jeepRouteSequence.join(',') !== optionB.jeepRouteSequence.join(',')) {
        return false;
    }

    // If we reach here, the options have the same number of legs,
    // the same types of legs in the same order, and use the same jeepney routes in the same order.
    // This means they represent the same fundamental journey structure.
    // Since `evaluateAndFilterTripOptions` sorts by score first, if `optionB` (keptOption)
    // has a better or equal score than `optionA` (currentOption), then `optionA` is redundant.
    // The varying walking lengths are already factored into the score.
    // For the purpose of de-duplication in the loop, if they are structurally identical,
    // the one with the worse score (optionA in this comparison context) is the duplicate.
    return true;


    // --- Optional: More granular checks if the above isn't strict enough ---
    // --- or if you want to merge options that are structurally identical AND metrically very close ---
    // --- For the current request (de-duplicating based on score for same journey steps), the above is sufficient.

    /*
    // Fallback: If fingerprints are identical (based on key coords), they are definitely the same.
    if (optionA.fingerprint === optionB.fingerprint && optionA.fingerprint !== "empty") {
        return true;
    }

    // If structure is identical (checked above), now check if metrics are too close
    if (Math.abs(optionA.totalWalkDistance - optionB.totalWalkDistance) <= SIMILARITY_MAX_WALK_DIFF_METERS &&
        Math.abs(optionA.totalDuration - optionB.totalDuration) <= SIMILARITY_MAX_DURATION_DIFF_SECONDS) {
        // Further check proximity of key jeepney leg start/end points if needed
        const jeepLegsA = optionA.legs.filter(l => l.type === 'jeepney');
        const jeepLegsB = optionB.legs.filter(l => l.type === 'jeepney');
        let keyPointsMatch = true;
        for (let i = 0; i < jeepLegsA.length; i++) {
            if (!jeepLegsA[i].coordinates || jeepLegsA[i].coordinates.length === 0 ||
                !jeepLegsB[i].coordinates || jeepLegsB[i].coordinates.length === 0) {
                keyPointsMatch = false; break;
            }
            const startA = jeepLegsA[i].coordinates[0];
            const startB = jeepLegsB[i].coordinates[0];
            const endA = jeepLegsA[i].coordinates[jeepLegsA[i].coordinates.length - 1];
            const endB = jeepLegsB[i].coordinates[jeepLegsB[i].coordinates.length - 1];

            if (!areCoordsClose(startA, startB, SIMILARITY_TRANSFER_POINT_PROXIMITY_METERS) ||
                !areCoordsClose(endA, endB, SIMILARITY_TRANSFER_POINT_PROXIMITY_METERS)) {
                keyPointsMatch = false; break;
            }
        }
        if (keyPointsMatch) return true;
    }
    */
    // return false; // If not structurally identical or not close enough by other metrics
}

export interface EvaluatedTripResults {
    recommended: PlannedTripLeg[] | null;
    alternatives: PlannedTripLeg[][];
    allProcessedOptions: TripOptionDetails[];
}

export function evaluateAndFilterTripOptions(
    tripOptions: PlannedTripLeg[][]
): EvaluatedTripResults {
    if (!tripOptions || tripOptions.length === 0) {
        return { recommended: null, alternatives: [], allProcessedOptions: [] };
    }

    const detailedOptions: TripOptionDetails[] = tripOptions.map((legs, index) => {
        const metrics = calculateTripMetrics(legs);
        const fingerprint = generateTripFingerprint(legs); // Simplified fingerprint for now
        const score = scoreTripOption(metrics);
        const jeepRouteSequence = getJeepRouteSequence(legs);
        const legTypeSequence = getLegTypeSequence(legs);
        return {
            ...metrics,
            legs,
            fingerprint,
            score,
            id: `option-${index}-${Math.random().toString(36).substring(7)}`, // Ensure unique ID
            jeepRouteSequence,
            legTypeSequence,
            keyCoordinates: [] // Placeholder, as detailed keyCoords from fingerprint are not primarily used in this version
        };
    });

    // Sort by score (ascending, lower is better)
    detailedOptions.sort((a, b) => a.score - b.score);

    const finalUniqueOptions: TripOptionDetails[] = [];
    if (detailedOptions.length > 0) {
        finalUniqueOptions.push(detailedOptions[0]); // Always add the best-scored option

        for (let i = 1; i < detailedOptions.length; i++) {
            if (finalUniqueOptions.length >= MAX_TRIP_OPTIONS_TO_RETURN) break;

            const currentOptionDetail = detailedOptions[i];
            let isRedundant = false;
            for (const keptOptionDetail of finalUniqueOptions) {
                // If currentOption is effectively identical to an already kept (and better scoring) option
                if (areTripsEffectivelyIdentical(currentOptionDetail, keptOptionDetail)) {
                    isRedundant = true;
                    break;
                }
            }
            if (!isRedundant) {
                finalUniqueOptions.push(currentOptionDetail);
            }
        }
    }

    const recommended = finalUniqueOptions.length > 0 ? finalUniqueOptions[0].legs : null;
    const alternatives = finalUniqueOptions.slice(1).map(opt => opt.legs);

    return {
        recommended,
        alternatives,
        allProcessedOptions: detailedOptions // Return all for potential debugging/logging
    };
}
