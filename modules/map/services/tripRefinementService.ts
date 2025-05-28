// pasada-gemini/modules/map/services/tripRefinementService.ts
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes';
import { getJeepneyRouteById } from './jeepneyDataService';
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
    OVERLAP_WALK_POINTS_TO_CHECK_V7
} from '../constants/tripPlanningConstants';
import { trimJeepLeg } from '../utils/tripUtils'; // We'll create this file next

export async function refineTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    if (legs.length === 0) return legs;
    const refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs)); // Deep copy

    for (let i = 0; i < refinedLegs.length; i++) {
        const currentLeg = refinedLegs[i];

        // Attempt to cut overlapping walk segment after a jeepney ride
        if (currentLeg.type === 'walk' && i > 0 && refinedLegs[i - 1]?.type === 'jeepney') {
            const prevJeepLeg = refinedLegs[i - 1];
            const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);

            if (prevJeepRouteDef && prevJeepRouteDef.coordinates.length > 1 && currentLeg.coordinates.length > 0 && typeof prevJeepLeg.jeepLegFullRouteEndIndex === 'number') {
                let actualNewAlightPointForJeep: Coordinate | null = null;
                let newAlightFullRouteIndexForJeep = -1;
                const originalJeepAlightIndexOnFullRoute = prevJeepLeg.jeepLegFullRouteEndIndex;

                for (let k = 0; k < Math.min(currentLeg.coordinates.length, OVERLAP_WALK_POINTS_TO_CHECK_V7); k++) {
                    const walkPoint = currentLeg.coordinates[k];
                    const { pointOnPolyline: closestJeepPointToWalk, segmentIndex: jeepSegmentIdx } =
                        findNearestPointOnRoute(walkPoint, prevJeepRouteDef);

                    let jeepVertexIdxOfClosestOverlap = jeepSegmentIdx;
                    if (jeepSegmentIdx + 1 < prevJeepRouteDef.coordinates.length &&
                        calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx + 1]) <
                        calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx])) {
                        jeepVertexIdxOfClosestOverlap = jeepSegmentIdx + 1;
                    }
                    jeepVertexIdxOfClosestOverlap = Math.max(0, Math.min(jeepVertexIdxOfClosestOverlap, prevJeepRouteDef.coordinates.length - 1));


                    if (calculateDistance(walkPoint, prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap]) < OVERLAP_CUT_THRESHOLD_METERS &&
                        jeepVertexIdxOfClosestOverlap < originalJeepAlightIndexOnFullRoute) { // Ensure we are not going backward on the jeep route unintentionally
                        actualNewAlightPointForJeep = prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap];
                        newAlightFullRouteIndexForJeep = jeepVertexIdxOfClosestOverlap;
                        break;
                    }
                }

                if (actualNewAlightPointForJeep && newAlightFullRouteIndexForJeep !== -1) {
                    const originalWalkEndTarget = currentLeg.coordinates[currentLeg.coordinates.length - 1];
                    const newWalkLegFromCut = await getWalkingDirections(actualNewAlightPointForJeep, originalWalkEndTarget);
                    const oldWalkDist = currentLeg.distance && typeof currentLeg.distance === 'number' ? currentLeg.distance : calculateDistanceOfPolyline(currentLeg.coordinates);
                    const newWalkDist = newWalkLegFromCut?.distance && typeof newWalkLegFromCut.distance === 'number' ? newWalkLegFromCut.distance : Infinity;

                    if (newWalkLegFromCut && (newWalkDist < oldWalkDist - REFINE_MIN_WALK_SAVING_METERS / 2 || oldWalkDist < OVERLAP_CUT_THRESHOLD_METERS * 1.5)) {
                        prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], actualNewAlightPointForJeep);
                        prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                        prevJeepLeg.jeepAlightingPointInfo = `Alight from ${prevJeepLeg.routeName} (cut)`;
                        prevJeepLeg.jeepLegFullRouteEndIndex = newAlightFullRouteIndexForJeep; // Update the end index on the full route

                        refinedLegs[i] = newWalkLegFromCut;
                        if(refinedLegs[i]) refinedLegs[i].jeepBoardingPointInfo = `Walk from ${prevJeepLeg.routeName} (cut)`; // Indicate the walk starts from the cut point
                    }
                }
            }
        }


        // Refine current walk leg (initial, transfer, or final walk)
        const legToRefine = refinedLegs[i]; // Use the potentially updated leg
        if (legToRefine.type === 'walk') {
            const originalWalkDistance = typeof legToRefine.distance === 'number' ? legToRefine.distance : calculateDistanceOfPolyline(legToRefine.coordinates);

            if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 1.5) continue; // Skip very short walks

            let bestRefinedWalkLeg: PlannedTripLeg | null = null;
            let currentBestRefinedWalkDistance = originalWalkDistance;

            let bestNewPrevJeepAlightPoint: Coordinate | null = null;
            let bestNewNextJeepBoardPoint: Coordinate | null = null;
            let bestPrevJeepAlightIndex: number | undefined;
            let bestNextJeepBoardIndex: number | undefined;


            // Case 1: Refining initial walk (leg 0, followed by a jeepney leg)
            if (i === 0 && refinedLegs.length > 1 && refinedLegs[i+1]?.type === 'jeepney') {
                const nextJeepLeg = refinedLegs[i+1];
                const nextJeepRouteDef = getJeepneyRouteById(nextJeepLeg.routeId!);
                if (!nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) continue;

                const tripOrigin = legToRefine.coordinates[0]; // Starting point of the whole trip
                const plannedBoardIndexOnFullRoute = nextJeepLeg.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(nextJeepLeg.coordinates[0], nextJeepRouteDef).segmentIndex;

                const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRoute, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);

                for (const { point: candidateBoard, index: candidateBoardIndex } of candidateBoardPoints) {
                    const newWalk = await getWalkingDirections(tripOrigin, candidateBoard);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                    if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_WALK_TO_JEEP_METERS) {
                        if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS) {
                            currentBestRefinedWalkDistance = newWalkDist;
                            bestRefinedWalkLeg = newWalk;
                            bestNewNextJeepBoardPoint = candidateBoard;
                            bestNextJeepBoardIndex = candidateBoardIndex;
                        }
                    }
                }
                if (bestRefinedWalkLeg && bestNewNextJeepBoardPoint && typeof bestNextJeepBoardIndex === 'number') {
                    refinedLegs[i] = bestRefinedWalkLeg;
                    nextJeepLeg.coordinates = trimJeepLeg(nextJeepRouteDef.coordinates, bestNewNextJeepBoardPoint, nextJeepLeg.coordinates[nextJeepLeg.coordinates.length - 1]);
                    nextJeepLeg.distance = calculateDistanceOfPolyline(nextJeepLeg.coordinates);
                    nextJeepLeg.jeepBoardingPointInfo = `Board ${nextJeepLeg.routeName} (refined initial)`;
                    nextJeepLeg.jeepLegFullRouteStartIndex = bestNextJeepBoardIndex;
                }
            }
            // Case 2: Refining final walk (last leg, preceded by a jeepney leg)
            else if (i === refinedLegs.length - 1 && i > 0 && refinedLegs[i-1]?.type === 'jeepney') {
                const prevJeepLeg = refinedLegs[i-1];
                const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);
                if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2) continue;

                const plannedAlightIndexOnFullRoute = prevJeepLeg.jeepLegFullRouteEndIndex ?? findNearestPointOnRoute(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef).segmentIndex;
                const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoute, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);

                for (const { point: candidateAlight, index: candidateAlightIndex } of candidateAlightPoints) {
                    const newWalk = await getWalkingDirections(candidateAlight, finalDestination);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

                    if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_FINAL_WALK_METERS) {
                         if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS) {
                            currentBestRefinedWalkDistance = newWalkDist;
                            bestRefinedWalkLeg = newWalk;
                            bestNewPrevJeepAlightPoint = candidateAlight;
                            bestPrevJeepAlightIndex = candidateAlightIndex;
                            if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) break; // Early exit if very short walk found
                         }
                    }
                }
                 if (bestRefinedWalkLeg && bestNewPrevJeepAlightPoint && typeof bestPrevJeepAlightIndex === 'number') {
                    refinedLegs[i] = bestRefinedWalkLeg;
                    prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], bestNewPrevJeepAlightPoint);
                    prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                    prevJeepLeg.jeepAlightingPointInfo = `Alight for final walk (refined)`;
                    prevJeepLeg.jeepLegFullRouteEndIndex = bestPrevJeepAlightIndex;
                }
            }
            // Case 3: Refining transfer walk (between two jeepney legs)
            else if (i > 0 && i < refinedLegs.length - 1 && refinedLegs[i-1]?.type === 'jeepney' && refinedLegs[i+1]?.type === 'jeepney') {
                const prevJeepLeg = refinedLegs[i-1];
                const nextJeepLeg = refinedLegs[i+1];
                const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);
                const nextJeepRouteDef = getJeepneyRouteById(nextJeepLeg.routeId!);

                if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2 ||
                    !nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) continue;

                const plannedAlightIndexOnFullRoutePrev = prevJeepLeg.jeepLegFullRouteEndIndex ?? findNearestPointOnRoute(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef).segmentIndex;
                const plannedBoardIndexOnFullRouteNext = nextJeepLeg.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(nextJeepLeg.coordinates[0], nextJeepRouteDef).segmentIndex;

                const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoutePrev, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);
                const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRouteNext, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);

                let foundShortTransfer = false;
                for (const { point: cAlight, index: cAlightIndex } of candidateAlightPoints) {
                    for (const { point: cBoard, index: cBoardIndex } of candidateBoardPoints) {
                        const newWalk = await getWalkingDirections(cAlight, cBoard);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

                        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS * 0.8) { // Slightly less strict saving for transfers
                                currentBestRefinedWalkDistance = newWalkDist;
                                bestRefinedWalkLeg = newWalk;
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

                 if (bestRefinedWalkLeg && bestNewPrevJeepAlightPoint && bestNewNextJeepBoardPoint && typeof bestPrevJeepAlightIndex === 'number' && typeof bestNextJeepBoardIndex === 'number') {
                    refinedLegs[i] = bestRefinedWalkLeg;
                    // Update previous jeep leg
                    prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], bestNewPrevJeepAlightPoint);
                    prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                    prevJeepLeg.jeepAlightingPointInfo = `Alight for transfer to ${nextJeepLeg.routeName} (refined)`;
                    prevJeepLeg.jeepLegFullRouteEndIndex = bestPrevJeepAlightIndex;

                    // Update next jeep leg
                    nextJeepLeg.coordinates = trimJeepLeg(nextJeepRouteDef.coordinates, bestNewNextJeepBoardPoint, nextJeepLeg.coordinates[nextJeepLeg.coordinates.length-1]);
                    nextJeepLeg.distance = calculateDistanceOfPolyline(nextJeepLeg.coordinates);
                    nextJeepLeg.jeepBoardingPointInfo = `Board ${nextJeepLeg.routeName} (refined transfer)`;
                    nextJeepLeg.jeepLegFullRouteStartIndex = bestNextJeepBoardIndex;
                }
            }
        }
    }
    // Filter out any legs that might have become empty or too short (e.g., 1m walk) after refinement
    return refinedLegs.filter(leg => leg.coordinates && leg.coordinates.length > 0 && ( (leg.type === 'walk' && leg.distance && typeof leg.distance === 'number' && leg.distance > 1) || leg.type === 'jeepney'));
}


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
        return results; // Should not happen if centerVertexIndex is valid
    }

    let lastAddedPointBackward = centerPoint;
    let accumulatedDistBackward = 0;
    // Search backward
    for (let i = centerVertexIndex - 1; i >= 0; i--) {
        if (!routeCoordinates[i] || !routeCoordinates[i+1]) continue;
        if (i + 1 >= routeCoordinates.length ) break; // Safety for i+1
        accumulatedDistBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (accumulatedDistBackward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointBackward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointBackward = routeCoordinates[i];
        }
    }

    let lastAddedPointForward = centerPoint;
    let accumulatedDistForward = 0;
    // Search forward
    for (let i = centerVertexIndex + 1; i < routeCoordinates.length; i++) {
         if (i - 1 < 0 ) break; // Safety for i-1
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