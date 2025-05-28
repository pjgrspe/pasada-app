// pasada-gemini/modules/map/services/tripRefinementService.ts
import { Coordinate, PlannedTripLeg, JeepneyRoute } from '../utils/routeTypes';
import { getJeepneyRouteById, getAllJeepneyRoutes } from './jeepneyDataService'; // Added getAllJeepneyRoutes
import { getWalkingDirections, calculateDistance, findNearestPointOnRoute } from './mapApiServices';
import { calculateDistanceOfPolyline } from '../utils/mapHelpers';
import {
    REFINE_SEARCH_RADIUS_METERS,
    REFINE_MIN_WALK_SAVING_METERS,
    REFINE_MAX_WALK_FOR_CONNECTION,
    MIN_CANDIDATE_SEPARATION_METERS,
    REFINE_EARLY_EXIT_WALK_THRESHOLD,
    MAX_WALK_TO_JEEP_METERS,
    MAX_FINAL_WALK_METERS,
    OVERLAP_CUT_THRESHOLD_METERS,
    OVERLAP_WALK_POINTS_TO_CHECK_V7,
    DIRECT_BOARDING_PROXIMITY_THRESHOLD, // Ensure this is added to constants
    MIN_SAVING_FOR_DIRECT_ROUTE_SWITCH_METERS // Ensure this is added to constants
} from '../constants/tripPlanningConstants';
import { trimJeepLeg } from '../utils/tripUtils';

// Helper function (can be kept as is or made internal if not used elsewhere)
export function getCoordinatesInSearchWindow(
    routeCoordinates: Coordinate[],
    centerVertexIndexInput: number,
    searchRadiusMeters: number,
    minSeparationMeters: number
): Array<{point: Coordinate, index: number}> {
    const results: Array<{point: Coordinate, index: number}> = [];
    if (!routeCoordinates || routeCoordinates.length === 0) return results;

    const centerVertexIndex = Math.max(0, Math.min(centerVertexIndexInput, routeCoordinates.length - 1));
    const centerPoint = routeCoordinates[centerVertexIndex];

    if (centerPoint) {
        results.push({point: centerPoint, index: centerVertexIndex});
    } else {
        return results;
    }

    let lastAddedPointBackward = centerPoint;
    let accumulatedDistBackward = 0;
    for (let i = centerVertexIndex - 1; i >= 0; i--) {
        if (!routeCoordinates[i] || !routeCoordinates[i+1]) continue;
        if (i + 1 >= routeCoordinates.length ) break;
        accumulatedDistBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (accumulatedDistBackward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointBackward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointBackward = routeCoordinates[i];
        }
    }

    let lastAddedPointForward = centerPoint;
    let accumulatedDistForward = 0;
    for (let i = centerVertexIndex + 1; i < routeCoordinates.length; i++) {
         if (i - 1 < 0 ) break;
         if (!routeCoordinates[i-1] || !routeCoordinates[i]) continue;
        accumulatedDistForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (accumulatedDistForward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointForward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointForward = routeCoordinates[i];
        }
    }
    return results;
}

/**
 * Attempts to cut an overlapping walk segment that occurs after a jeepney ride.
 */
async function _refineOverlappingWalkAfterJeep(
    prevJeepLeg: PlannedTripLeg,
    currentWalkLeg: PlannedTripLeg
): Promise<{ updatedPrevJeepLeg: PlannedTripLeg, updatedWalkLeg: PlannedTripLeg }> {
    const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);
    let refinedPrevJeepLeg = { ...prevJeepLeg };
    let refinedCurrentWalkLeg = { ...currentWalkLeg };

    if (
        prevJeepRouteDef &&
        prevJeepRouteDef.coordinates.length > 1 &&
        refinedCurrentWalkLeg.coordinates.length > 0 &&
        typeof refinedPrevJeepLeg.jeepLegFullRouteEndIndex === 'number'
    ) {
        let actualNewAlightPointForJeep: Coordinate | null = null;
        let newAlightFullRouteIndexForJeep = -1;
        const originalJeepAlightIndexOnFullRoute = refinedPrevJeepLeg.jeepLegFullRouteEndIndex;

        for (let k = 0; k < Math.min(refinedCurrentWalkLeg.coordinates.length, OVERLAP_WALK_POINTS_TO_CHECK_V7); k++) {
            const walkPoint = refinedCurrentWalkLeg.coordinates[k];
            const { pointOnPolyline: closestJeepPointToWalk, segmentIndex: jeepSegmentIdx } =
                findNearestPointOnRoute(walkPoint, prevJeepRouteDef);

            let jeepVertexIdxOfClosestOverlap = jeepSegmentIdx;
            if (jeepSegmentIdx + 1 < prevJeepRouteDef.coordinates.length &&
                calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx + 1]) <
                calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx])) {
                jeepVertexIdxOfClosestOverlap = jeepSegmentIdx + 1;
            }
            // Ensure the index is valid
             if (jeepVertexIdxOfClosestOverlap < 0 || jeepVertexIdxOfClosestOverlap >= prevJeepRouteDef.coordinates.length) {
                continue;
            }


            if (calculateDistance(walkPoint, prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap]) < OVERLAP_CUT_THRESHOLD_METERS &&
                jeepVertexIdxOfClosestOverlap < originalJeepAlightIndexOnFullRoute) { // Ensure we are not going backward on the jeep route unintentionally
                actualNewAlightPointForJeep = prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap];
                newAlightFullRouteIndexForJeep = jeepVertexIdxOfClosestOverlap;
                break;
            }
        }

        if (actualNewAlightPointForJeep && newAlightFullRouteIndexForJeep !== -1) {
            const originalWalkEndTarget = refinedCurrentWalkLeg.coordinates[refinedCurrentWalkLeg.coordinates.length - 1];
            const newWalkLegFromCut = await getWalkingDirections(actualNewAlightPointForJeep, originalWalkEndTarget);
            const oldWalkDist = refinedCurrentWalkLeg.distance && typeof refinedCurrentWalkLeg.distance === 'number' ? refinedCurrentWalkLeg.distance : calculateDistanceOfPolyline(refinedCurrentWalkLeg.coordinates);
            const newWalkDist = newWalkLegFromCut?.distance && typeof newWalkLegFromCut.distance === 'number' ? newWalkLegFromCut.distance : Infinity;

            if (newWalkLegFromCut && (newWalkDist < oldWalkDist - REFINE_MIN_WALK_SAVING_METERS / 2 || oldWalkDist < OVERLAP_CUT_THRESHOLD_METERS * 1.5)) {
                refinedPrevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, refinedPrevJeepLeg.coordinates[0], actualNewAlightPointForJeep, refinedPrevJeepLeg.jeepLegFullRouteStartIndex, newAlightFullRouteIndexForJeep);
                refinedPrevJeepLeg.distance = calculateDistanceOfPolyline(refinedPrevJeepLeg.coordinates);
                refinedPrevJeepLeg.jeepAlightingPointInfo = `Alight from ${refinedPrevJeepLeg.routeName} (cut)`;
                refinedPrevJeepLeg.jeepLegFullRouteEndIndex = newAlightFullRouteIndexForJeep;

                refinedCurrentWalkLeg = newWalkLegFromCut;
                refinedCurrentWalkLeg.jeepBoardingPointInfo = `Walk from ${refinedPrevJeepLeg.routeName} (cut)`;
            }
        }
    }
    return { updatedPrevJeepLeg: refinedPrevJeepLeg, updatedWalkLeg: refinedCurrentWalkLeg };
}

/**
 * Refines an initial walk leg to a potentially better boarding point.
 */
async function _refineInitialWalk(
    initialWalkLeg: PlannedTripLeg,
    nextJeepLeg: PlannedTripLeg
): Promise<{ refinedWalkLeg: PlannedTripLeg, updatedNextJeepLeg: PlannedTripLeg }> {
    let refinedInitialWalk = { ...initialWalkLeg };
    let refinedNextJeepLeg = { ...nextJeepLeg };
    const nextJeepRouteDef = getJeepneyRouteById(refinedNextJeepLeg.routeId!);

    if (!nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) {
        return { refinedWalkLeg: refinedInitialWalk, updatedNextJeepLeg: refinedNextJeepLeg };
    }

    const originalWalkDistance = typeof refinedInitialWalk.distance === 'number' ? refinedInitialWalk.distance : calculateDistanceOfPolyline(refinedInitialWalk.coordinates);
    if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 1.5) {
        return { refinedWalkLeg: refinedInitialWalk, updatedNextJeepLeg: refinedNextJeepLeg };
    }

    const tripOrigin = refinedInitialWalk.coordinates[0];
    const plannedBoardIndexOnFullRoute = refinedNextJeepLeg.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(refinedNextJeepLeg.coordinates[0], nextJeepRouteDef).segmentIndex;
    const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRoute, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);

    let currentBestRefinedWalkDistance = originalWalkDistance;
    let bestNewWalkLeg: PlannedTripLeg | null = null;
    let bestNewNextJeepBoardPoint: Coordinate | null = null;
    let bestNextJeepBoardIndex: number | undefined;

    for (const { point: candidateBoard, index: candidateBoardIndex } of candidateBoardPoints) {
        const newWalk = await getWalkingDirections(tripOrigin, candidateBoard);
        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_WALK_TO_JEEP_METERS) {
            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS) {
                currentBestRefinedWalkDistance = newWalkDist;
                bestNewWalkLeg = newWalk;
                bestNewNextJeepBoardPoint = candidateBoard;
                bestNextJeepBoardIndex = candidateBoardIndex;
            }
        }
    }

    if (bestNewWalkLeg && bestNewNextJeepBoardPoint && typeof bestNextJeepBoardIndex === 'number') {
        refinedInitialWalk = bestNewWalkLeg;
        refinedNextJeepLeg.coordinates = trimJeepLeg(
            nextJeepRouteDef.coordinates,
            bestNewNextJeepBoardPoint,
            refinedNextJeepLeg.coordinates[refinedNextJeepLeg.coordinates.length - 1],
            bestNextJeepBoardIndex,
            refinedNextJeepLeg.jeepLegFullRouteEndIndex
        );
        refinedNextJeepLeg.distance = calculateDistanceOfPolyline(refinedNextJeepLeg.coordinates);
        refinedNextJeepLeg.jeepBoardingPointInfo = `Board ${refinedNextJeepLeg.routeName} (refined initial)`;
        refinedNextJeepLeg.jeepLegFullRouteStartIndex = bestNextJeepBoardIndex;
    }

    return { refinedWalkLeg: refinedInitialWalk, updatedNextJeepLeg: refinedNextJeepLeg };
}

/**
 * Refines a final walk leg from a potentially better alighting point.
 */
async function _refineFinalWalk(
    prevJeepLeg: PlannedTripLeg,
    finalWalkLeg: PlannedTripLeg,
    finalDestination: Coordinate
): Promise<{ updatedPrevJeepLeg: PlannedTripLeg, refinedWalkLeg: PlannedTripLeg }> {
    let refinedPrevJeepLeg = { ...prevJeepLeg };
    let refinedFinalWalk = { ...finalWalkLeg };
    const prevJeepRouteDef = getJeepneyRouteById(refinedPrevJeepLeg.routeId!);

    if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2) {
        return { updatedPrevJeepLeg: refinedPrevJeepLeg, refinedWalkLeg: refinedFinalWalk };
    }

    const originalWalkDistance = typeof refinedFinalWalk.distance === 'number' ? refinedFinalWalk.distance : calculateDistanceOfPolyline(refinedFinalWalk.coordinates);
    if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 1.5) {
        return { updatedPrevJeepLeg: refinedPrevJeepLeg, refinedWalkLeg: refinedFinalWalk };
    }

    const plannedAlightIndexOnFullRoute = refinedPrevJeepLeg.jeepLegFullRouteEndIndex ?? findNearestPointOnRoute(refinedPrevJeepLeg.coordinates[refinedPrevJeepLeg.coordinates.length - 1], prevJeepRouteDef).segmentIndex;
    const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoute, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);

    let currentBestRefinedWalkDistance = originalWalkDistance;
    let bestNewWalkLeg: PlannedTripLeg | null = null;
    let bestNewPrevJeepAlightPoint: Coordinate | null = null;
    let bestPrevJeepAlightIndex: number | undefined;

    for (const { point: candidateAlight, index: candidateAlightIndex } of candidateAlightPoints) {
        const newWalk = await getWalkingDirections(candidateAlight, finalDestination);
        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_FINAL_WALK_METERS) {
            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS) {
                currentBestRefinedWalkDistance = newWalkDist;
                bestNewWalkLeg = newWalk;
                bestNewPrevJeepAlightPoint = candidateAlight;
                bestPrevJeepAlightIndex = candidateAlightIndex;
                if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) break;
            }
        }
    }

    if (bestNewWalkLeg && bestNewPrevJeepAlightPoint && typeof bestPrevJeepAlightIndex === 'number') {
        refinedFinalWalk = bestNewWalkLeg;
        refinedPrevJeepLeg.coordinates = trimJeepLeg(
            prevJeepRouteDef.coordinates,
            refinedPrevJeepLeg.coordinates[0],
            bestNewPrevJeepAlightPoint,
            refinedPrevJeepLeg.jeepLegFullRouteStartIndex,
            bestPrevJeepAlightIndex
        );
        refinedPrevJeepLeg.distance = calculateDistanceOfPolyline(refinedPrevJeepLeg.coordinates);
        refinedPrevJeepLeg.jeepAlightingPointInfo = `Alight for final walk (refined)`;
        refinedPrevJeepLeg.jeepLegFullRouteEndIndex = bestPrevJeepAlightIndex;
    }
    return { updatedPrevJeepLeg: refinedPrevJeepLeg, refinedWalkLeg: refinedFinalWalk };
}

/**
 * Refines a transfer walk leg between two jeepney legs.
 */
async function _refineTransferWalk(
    prevJeepLeg: PlannedTripLeg,
    transferWalkLeg: PlannedTripLeg,
    nextJeepLeg: PlannedTripLeg
): Promise<{ updatedPrevJeepLeg: PlannedTripLeg, refinedWalkLeg: PlannedTripLeg, updatedNextJeepLeg: PlannedTripLeg }> {
    let refinedPrevJeep = { ...prevJeepLeg };
    let refinedTransferWalk = { ...transferWalkLeg };
    let refinedNextJeep = { ...nextJeepLeg };

    const prevJeepRouteDef = getJeepneyRouteById(refinedPrevJeep.routeId!);
    const nextJeepRouteDef = getJeepneyRouteById(refinedNextJeep.routeId!);

    if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2 ||
        !nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) {
        return { updatedPrevJeepLeg: refinedPrevJeep, refinedWalkLeg: refinedTransferWalk, updatedNextJeepLeg: refinedNextJeep };
    }

    const originalWalkDistance = typeof refinedTransferWalk.distance === 'number' ? refinedTransferWalk.distance : calculateDistanceOfPolyline(refinedTransferWalk.coordinates);
    if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 1.5) {
         return { updatedPrevJeepLeg: refinedPrevJeep, refinedWalkLeg: refinedTransferWalk, updatedNextJeepLeg: refinedNextJeep };
    }

    const plannedAlightIndexOnFullRoutePrev = refinedPrevJeep.jeepLegFullRouteEndIndex ?? findNearestPointOnRoute(refinedPrevJeep.coordinates[refinedPrevJeep.coordinates.length - 1], prevJeepRouteDef).segmentIndex;
    const plannedBoardIndexOnFullRouteNext = refinedNextJeep.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(refinedNextJeep.coordinates[0], nextJeepRouteDef).segmentIndex;

    const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoutePrev, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);
    const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRouteNext, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);

    let currentBestRefinedWalkDistance = originalWalkDistance;
    let bestNewWalkLeg: PlannedTripLeg | null = null;
    let bestNewPrevJeepAlightPoint: Coordinate | null = null;
    let bestNewNextJeepBoardPoint: Coordinate | null = null;
    let bestPrevJeepAlightIndex: number | undefined;
    let bestNextJeepBoardIndex: number | undefined;
    let foundShortTransfer = false;

    for (const { point: cAlight, index: cAlightIndex } of candidateAlightPoints) {
        for (const { point: cBoard, index: cBoardIndex } of candidateBoardPoints) {
            const newWalk = await getWalkingDirections(cAlight, cBoard);
            const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

            if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS * 0.8) {
                    currentBestRefinedWalkDistance = newWalkDist;
                    bestNewWalkLeg = newWalk;
                    bestNewPrevJeepAlightPoint = cAlight;
                    bestNewNextJeepBoardPoint = cBoard;
                    bestPrevJeepAlightIndex = cAlightIndex;
                    bestNextJeepBoardIndex = cBoardIndex;
                    if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) {
                        foundShortTransfer = true;
                        break;
                    }
                }
            }
        }
        if (foundShortTransfer) break;
    }

    if (bestNewWalkLeg && bestNewPrevJeepAlightPoint && bestNewNextJeepBoardPoint && typeof bestPrevJeepAlightIndex === 'number' && typeof bestNextJeepBoardIndex === 'number') {
        refinedTransferWalk = bestNewWalkLeg;
        refinedPrevJeep.coordinates = trimJeepLeg(
            prevJeepRouteDef.coordinates,
            refinedPrevJeep.coordinates[0],
            bestNewPrevJeepAlightPoint,
            refinedPrevJeep.jeepLegFullRouteStartIndex,
            bestPrevJeepAlightIndex
        );
        refinedPrevJeep.distance = calculateDistanceOfPolyline(refinedPrevJeep.coordinates);
        refinedPrevJeep.jeepAlightingPointInfo = `Alight for transfer to ${refinedNextJeep.routeName} (refined)`;
        refinedPrevJeep.jeepLegFullRouteEndIndex = bestPrevJeepAlightIndex;

        refinedNextJeep.coordinates = trimJeepLeg(
            nextJeepRouteDef.coordinates,
            bestNewNextJeepBoardPoint,
            refinedNextJeep.coordinates[refinedNextJeep.coordinates.length - 1],
            bestNextJeepBoardIndex,
            refinedNextJeep.jeepLegFullRouteEndIndex
        );
        refinedNextJeep.distance = calculateDistanceOfPolyline(refinedNextJeep.coordinates);
        refinedNextJeep.jeepBoardingPointInfo = `Board ${refinedNextJeep.routeName} (refined transfer)`;
        refinedNextJeep.jeepLegFullRouteStartIndex = bestNextJeepBoardIndex;
    }
    return { updatedPrevJeepLeg: refinedPrevJeep, refinedWalkLeg: refinedTransferWalk, updatedNextJeepLeg: refinedNextJeep };
}

/**
 * NEW REFINEMENT FUNCTION
 * Checks if a sequence of Walk -> Jeep1 -> Walk -> Jeep2 can be simplified to
 * Walk -> Jeep2, by boarding Jeep2 earlier.
 */
async function _attemptDirectRouteOptimization(
    originalLegs: PlannedTripLeg[],
    finalDestination: Coordinate // Used for context if needed, not directly for this optimization
): Promise<{ legs: PlannedTripLeg[], changed: boolean }> {
    // Check if the pattern for this optimization exists: Walk -> Jeep1 -> Walk -> Jeep2
    if (originalLegs.length < 4 ||
        originalLegs[0].type !== 'walk' ||
        originalLegs[1].type !== 'jeepney' ||
        originalLegs[2].type !== 'walk' ||
        originalLegs[3].type !== 'jeepney') {
        return { legs: originalLegs, changed: false };
    }

    const initialWalk = originalLegs[0];
    const firstJeep = originalLegs[1];
    // const transferWalk = originalLegs[2]; // We'll compare against the sum of these
    const secondJeep = originalLegs[3];

    if (!secondJeep.routeId) {
        // console.warn("[DirectRouteOpt] Second jeep leg has no routeId.");
        return { legs: originalLegs, changed: false };
    }

    const secondJeepRouteDef = getJeepneyRouteById(secondJeep.routeId);
    if (!secondJeepRouteDef || !secondJeepRouteDef.coordinates || secondJeepRouteDef.coordinates.length < 2) {
        // console.warn(`[DirectRouteOpt] Second jeep route definition not found or invalid for ${secondJeep.routeId}.`);
        return { legs: originalLegs, changed: false };
    }

    const tripOrigin = initialWalk.coordinates[0];
    // The point where the user currently boards the *first* jeep.
    const firstJeepBoardPoint = initialWalk.coordinates[initialWalk.coordinates.length - 1];

    // Find the closest point on the *second* jeep's route to where the first jeep was boarded.
    const {
        pointOnPolyline: potentialDirectBoardOnSecondJeepRoute,
        segmentIndex: directBoardSegmentIdxOnSecondJeep,
        distanceToPoint: walkDistToPotentialBoardPoint // This is the distance from firstJeepBoardPoint to secondJeepRouteDef
    } = findNearestPointOnRoute(firstJeepBoardPoint, secondJeepRouteDef);


    // If the second jeep route doesn't pass close enough to the first jeep's boarding point, this optimization isn't viable.
    if (walkDistToPotentialBoardPoint > DIRECT_BOARDING_PROXIMITY_THRESHOLD) {
        // console.log(`[DirectRouteOpt] Second jeep route too far from first jeep's boarding point (${walkDistToPotentialBoardPoint.toFixed(0)}m).`);
        return { legs: originalLegs, changed: false };
    }

    // Determine the actual vertex on the second jeep route for boarding
    // This ensures we snap to an actual coordinate on the route.
    let actualDirectBoardingVertexIndex = directBoardSegmentIdxOnSecondJeep;
    if (directBoardSegmentIdxOnSecondJeep + 1 < secondJeepRouteDef.coordinates.length &&
        calculateDistance(potentialDirectBoardOnSecondJeepRoute, secondJeepRouteDef.coordinates[directBoardSegmentIdxOnSecondJeep + 1]) <
        calculateDistance(potentialDirectBoardOnSecondJeepRoute, secondJeepRouteDef.coordinates[directBoardSegmentIdxOnSecondJeep])) {
        actualDirectBoardingVertexIndex = directBoardSegmentIdxOnSecondJeep + 1;
    }
    actualDirectBoardingVertexIndex = Math.max(0, Math.min(actualDirectBoardingVertexIndex, secondJeepRouteDef.coordinates.length - 1));
    const actualDirectBoardingCoordinate = secondJeepRouteDef.coordinates[actualDirectBoardingVertexIndex];

    // The alighting point for this new direct jeep ride should be the same as the original secondJeep's alighting point.
    const originalAlightFromSecondJeepPoint = secondJeep.coordinates[secondJeep.coordinates.length - 1];
    const { segmentIndex: originalAlightSegmentIdxOnSecondJeepRoute } = findNearestPointOnRoute(originalAlightFromSecondJeepPoint, secondJeepRouteDef);
    let originalAlightVertexIndexOnSecondJeepRoute = originalAlightSegmentIdxOnSecondJeepRoute;
     if (originalAlightSegmentIdxOnSecondJeepRoute + 1 < secondJeepRouteDef.coordinates.length &&
        calculateDistance(originalAlightFromSecondJeepPoint, secondJeepRouteDef.coordinates[originalAlightSegmentIdxOnSecondJeepRoute + 1]) <
        calculateDistance(originalAlightFromSecondJeepPoint, secondJeepRouteDef.coordinates[originalAlightSegmentIdxOnSecondJeepRoute])) {
        originalAlightVertexIndexOnSecondJeepRoute = originalAlightSegmentIdxOnSecondJeepRoute + 1;
    }
    originalAlightVertexIndexOnSecondJeepRoute = Math.max(0, Math.min(originalAlightVertexIndexOnSecondJeepRoute, secondJeepRouteDef.coordinates.length - 1));


    // Check for valid progression on the second jeep route (board before alight, considering loops)
    let isRideOnSecondJeepValid = false;
    if (secondJeepRouteDef.isLooping && typeof secondJeepRouteDef.loopConnectIndex === 'number') {
        // If it's a loop, a ride is valid if it makes progress, even if index wraps
        isRideOnSecondJeepValid = true; // Simplified: assume trimJeepLeg handles loop logic correctly
    } else {
        isRideOnSecondJeepValid = actualDirectBoardingVertexIndex < originalAlightVertexIndexOnSecondJeepRoute;
    }

    if (!isRideOnSecondJeepValid) {
        // console.log(`[DirectRouteOpt] Invalid progression on second jeep route (board index ${actualDirectBoardingVertexIndex} vs alight index ${originalAlightVertexIndexOnSecondJeepRoute}).`);
        return { legs: originalLegs, changed: false };
    }

    // Create the new initial walk leg: from tripOrigin to the new direct boarding point on the second jeep route.
    const newOptimizedInitialWalk = await getWalkingDirections(tripOrigin, actualDirectBoardingCoordinate);
    if (!newOptimizedInitialWalk || (newOptimizedInitialWalk.distance as number) > MAX_WALK_TO_JEEP_METERS * 1.5) { // Allow slightly longer initial walk
        // console.log(`[DirectRouteOpt] New initial walk too long or failed (${newOptimizedInitialWalk?.distance}).`);
        return { legs: originalLegs, changed: false };
    }

    // Create the new direct jeep leg using the second jeep's route
    const newDirectJeepRideCoordinates = trimJeepLeg(
        secondJeepRouteDef.coordinates,
        actualDirectBoardingCoordinate,
        originalAlightFromSecondJeepPoint, // Alight where the original second jeep was supposed to
        actualDirectBoardingVertexIndex,
        originalAlightVertexIndexOnSecondJeepRoute,
        secondJeepRouteDef.isLooping,
        secondJeepRouteDef.loopConnectIndex
    );

    if (!newDirectJeepRideCoordinates || newDirectJeepRideCoordinates.length < 2) {
        // console.log("[DirectRouteOpt] Failed to trim new direct jeep leg.");
        return { legs: originalLegs, changed: false };
    }

    const newDirectJeepRideDist = calculateDistanceOfPolyline(newDirectJeepRideCoordinates);
    const newDirectJeepRideDuration = (newDirectJeepRideDist / (12 * 1000 / 3600)); // Approx duration

    const newDirectJeepLeg: PlannedTripLeg = {
        type: 'jeepney',
        coordinates: newDirectJeepRideCoordinates,
        routeName: secondJeepRouteDef.name,
        routeId: secondJeepRouteDef.id,
        routeColor: secondJeepRouteDef.color,
        instructions: `Take ${secondJeepRouteDef.name} directly (optimized).`,
        distance: newDirectJeepRideDist,
        duration: newDirectJeepRideDuration,
        jeepBoardingPointInfo: `Board ${secondJeepRouteDef.name} (optimized direct)`,
        jeepAlightingPointInfo: `Alight from ${secondJeepRouteDef.name}`,
        jeepLegFullRouteStartIndex: actualDirectBoardingVertexIndex,
        jeepLegFullRouteEndIndex: originalAlightVertexIndexOnSecondJeepRoute,
        isTerminalBoarding: actualDirectBoardingVertexIndex === 0,
    };

    // Compare costs
    const originalPlanSegmentDistance = (initialWalk.distance as number || 0) +
                                     (firstJeep.distance as number || 0) +
                                     (originalLegs[2].distance as number || 0); // original transferWalk distance

    const newPlanSegmentDistance = (newOptimizedInitialWalk.distance as number || 0) +
                                 (newDirectJeepLeg.distance as number || 0);

    if (newPlanSegmentDistance < originalPlanSegmentDistance - MIN_SAVING_FOR_DIRECT_ROUTE_SWITCH_METERS) {
        const newTripLegs: PlannedTripLeg[] = [newOptimizedInitialWalk, newDirectJeepLeg];
        // Append remaining legs from the original plan (i.e., legs after the original secondJeep)
        if (originalLegs.length > 4) { // If there were legs after originalLegs[3] (the secondJeep)
            newTripLegs.push(...originalLegs.slice(4));
        }
        // console.log(`[DirectRouteOpt] Applied optimization. Original segment: ${originalPlanSegmentDistance.toFixed(0)}m, New segment: ${newPlanSegmentDistance.toFixed(0)}m`);
        return { legs: newTripLegs, changed: true };
    }
    // console.log(`[DirectRouteOpt] Optimization not applied. Original: ${originalPlanSegmentDistance.toFixed(0)}m, New: ${newPlanSegmentDistance.toFixed(0)}m. Saving not met.`);
    return { legs: originalLegs, changed: false };
}


/**
 * Main function to apply various refinement strategies to a list of planned trip legs.
 */
export async function postProcessTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    if (legs.length === 0) return legs;
    let refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs));

    const MAX_REFINEMENT_ITERATIONS = 3; // Iterate to allow refinements to influence each other
    for (let iter = 0; iter < MAX_REFINEMENT_ITERATIONS; iter++) {
        let legsChangedInIteration = false;
        const currentIterationLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(refinedLegs));

        // Attempt the new direct route optimization first if applicable
        const directRouteOptimizationResult = await _attemptDirectRouteOptimization(currentIterationLegs, finalDestination);
        if (directRouteOptimizationResult.changed) {
            refinedLegs = directRouteOptimizationResult.legs;
            // console.log(`[PostProcess] Iteration ${iter + 1}: Applied direct route optimization. Restarting iteration.`);
            legsChangedInIteration = true; // Mark that a significant change happened
             // If direct route optimization changed the number of legs, we should restart the outer loop
             // with the new set of legs to ensure subsequent refinements work correctly on the new structure.
            continue; // Effectively restarts the iteration with the modified `refinedLegs`
        }


        // Proceed with other leg-by-leg refinements
        for (let i = 0; i < currentIterationLegs.length; i++) {
            // Refine overlapping walk after a jeep
            if (currentIterationLegs[i].type === 'walk' && i > 0 && currentIterationLegs[i - 1]?.type === 'jeepney') {
                const { updatedPrevJeepLeg, updatedWalkLeg } = await _refineOverlappingWalkAfterJeep(
                    currentIterationLegs[i - 1],
                    currentIterationLegs[i]
                );
                if (updatedPrevJeepLeg.distance !== currentIterationLegs[i-1].distance || updatedWalkLeg.distance !== currentIterationLegs[i].distance ) {
                    currentIterationLegs[i - 1] = updatedPrevJeepLeg;
                    currentIterationLegs[i] = updatedWalkLeg;
                    legsChangedInIteration = true;
                }
            }

            // Refine current walk leg (initial, transfer, or final)
            const legToRefine = currentIterationLegs[i]; // Use potentially updated leg
            if (legToRefine.type === 'walk') {
                 if (i === 0 && currentIterationLegs.length > 1 && currentIterationLegs[i+1]?.type === 'jeepney') {
                    const { refinedWalkLeg, updatedNextJeepLeg } = await _refineInitialWalk(legToRefine, currentIterationLegs[i+1]);
                    if (refinedWalkLeg.distance !== legToRefine.distance || updatedNextJeepLeg.distance !== currentIterationLegs[i+1].distance) {
                        currentIterationLegs[i] = refinedWalkLeg;
                        currentIterationLegs[i+1] = updatedNextJeepLeg;
                        legsChangedInIteration = true;
                    }
                } else if (i === currentIterationLegs.length - 1 && i > 0 && currentIterationLegs[i-1]?.type === 'jeepney') {
                    const { updatedPrevJeepLeg, refinedWalkLeg } = await _refineFinalWalk(currentIterationLegs[i-1], legToRefine, finalDestination);
                    if (updatedPrevJeepLeg.distance !== currentIterationLegs[i-1].distance || refinedWalkLeg.distance !== legToRefine.distance) {
                        currentIterationLegs[i-1] = updatedPrevJeepLeg;
                        currentIterationLegs[i] = refinedWalkLeg;
                        legsChangedInIteration = true;
                    }
                } else if (i > 0 && i < currentIterationLegs.length - 1 && currentIterationLegs[i-1]?.type === 'jeepney' && currentIterationLegs[i+1]?.type === 'jeepney') {
                    const { updatedPrevJeepLeg, refinedWalkLeg, updatedNextJeepLeg } = await _refineTransferWalk(currentIterationLegs[i-1], legToRefine, currentIterationLegs[i+1]);
                     if (updatedPrevJeepLeg.distance !== currentIterationLegs[i-1].distance || refinedWalkLeg.distance !== legToRefine.distance || updatedNextJeepLeg.distance !== currentIterationLegs[i+1].distance) {
                        currentIterationLegs[i-1] = updatedPrevJeepLeg;
                        currentIterationLegs[i] = refinedWalkLeg;
                        currentIterationLegs[i+1] = updatedNextJeepLeg;
                        legsChangedInIteration = true;
                    }
                }
            }
        }
        refinedLegs = JSON.parse(JSON.stringify(currentIterationLegs)); // Update main refinedLegs
        if (!legsChangedInIteration) {
            // console.log(`[PostProcess] No changes in iteration ${iter + 1}. Finishing refinement.`);
            break;
        }
        // console.log(`[PostProcess] Completed iteration ${iter + 1}. Legs changed: ${legsChangedInIteration}`);
    }

    const finalFilteredLegs = refinedLegs.filter(leg =>
        leg.coordinates &&
        leg.coordinates.length > 0 &&
        (
            (leg.type === 'walk' && typeof leg.distance === 'number' && leg.distance > 1) ||
            (leg.type === 'jeepney' && typeof leg.distance === 'number' && leg.distance > 10)
        )
    );
    // console.log(`[PostProcess] Final refined legs count: ${finalFilteredLegs.length}`);
    return finalFilteredLegs;
}