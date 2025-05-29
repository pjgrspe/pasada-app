// pasada-gemini/modules/map/services/refinementStrategies.ts
import { Coordinate, PlannedTripLeg, JeepneyRoute } from '../utils/routeTypes'; // Adjusted path
import { getJeepneyRouteById } from './jeepneyDataService';
import { getWalkingDirections, calculateDistance, findNearestPointOnRoute } from './mapApiServices';
import { calculateDistanceOfPolyline } from '../utils/mapHelpers'; // Adjusted path
import {
    REFINE_SEARCH_RADIUS_METERS,
    REFINE_MIN_WALK_SAVING_METERS,
    REFINE_MAX_WALK_FOR_CONNECTION,
    MIN_CANDIDATE_SEPARATION_METERS,
    REFINE_EARLY_EXIT_WALK_THRESHOLD,
    MAX_WALK_TO_JEEP_METERS,
    MAX_FINAL_WALK_METERS,
    OVERLAP_CUT_THRESHOLD_METERS,
    OVERLAP_WALK_POINTS_TO_CHECK_V7
} from '../constants/tripPlanningConstants'; // Adjusted path
import { trimJeepLeg } from '../utils/tripUtils'; // Adjusted path
import { getCoordinatesInSearchWindow } from '../utils/mapSearchHelpers'; // Import from new location

/**
 * Attempts to cut an overlapping walk segment that occurs after a jeepney ride.
 */
export async function refineOverlappingWalkAfterJeep(
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
            // Ensure index is valid before accessing array
            jeepVertexIdxOfClosestOverlap = Math.max(0, Math.min(jeepVertexIdxOfClosestOverlap, prevJeepRouteDef.coordinates.length - 1));


            if (calculateDistance(walkPoint, prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap]) < OVERLAP_CUT_THRESHOLD_METERS &&
                jeepVertexIdxOfClosestOverlap < originalJeepAlightIndexOnFullRoute) {
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
export async function refineInitialWalk(
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
export async function refineFinalWalk(
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
export async function refineTransferWalk(
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
                if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS * 0.8) { // Slightly less strict saving for transfers
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
