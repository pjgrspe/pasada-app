// pasada-gemini/modules/map/services/tripPlannerServices.ts
// Fine-tuning based on test case feedback.

import {
  Coordinate,
  PlannedTripLeg,
  JeepneyRoute,
} from '../utils/routeTypes';
import {
  findNearbyRouteSegments,
  getJeepneyRouteById,
} from './jeepneyDataService';
import {
  getWalkingDirections,
  getDrivingDirections,
  calculateDistance,
  findNearestPointOnRoute,
} from './mapApiServices';
import { calculateDistanceOfPolyline } from '../utils/mapHelpers';

// --- Constants for Trip Planning Logic (Re-tuned) ---
const MAX_WALK_TO_JEEP_METERS = 750; // Slightly increased to help Test Case 3
const MAX_FINAL_WALK_METERS = 1800; // Slightly increased
const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 220; // How close a jeep route segment needs to be to the desired path
const MIN_JEEP_RIDE_PROGRESS_METERS = 150; // Minimum useful distance for a jeep leg
const DESIRED_PATH_SEARCH_AHEAD_METERS = 750; // Increased back slightly
const DIVERGENCE_THRESHOLD_METERS = 300; // Allow a bit more divergence

// --- Constants for Post-Processing Refinement Optimization (Re-tuned for Test Case 1 transfer) ---
const REFINE_SEARCH_RADIUS_METERS = 180; // Increased for better transfer point discovery
const REFINE_MIN_WALK_SAVING_METERS = 40;
const REFINE_MAX_WALK_FOR_CONNECTION = 450; // Increased for transfers
const MIN_CANDIDATE_SEPARATION_METERS = 35;
const REFINE_EARLY_EXIT_WALK_THRESHOLD = 20;
const ALIGHTING_POINT_SEARCH_TOLERANCE_METERS = 60; // Slightly more tolerance for alighting
const OVERLAP_CUT_THRESHOLD_METERS = 35;
const OVERLAP_WALK_POINTS_TO_CHECK_V7 = 5;

interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate;
  alightPointOnJeep: Coordinate;
  desiredPathStartIndex: number;
  desiredPathEndIndex: number;
  walkToBoardingDistance: number;
  jeepBoardingVertexIndex: number;
  jeepAlightingVertexIndex: number;
}

function findBestAlignedJeepney(
    actualCurrentLocation: Coordinate,
    desiredPathPolyline: Coordinate[],
    currentDesiredPathIndex: number,
    maxWalkToBoard: number,
    finalDestination: Coordinate
): AlignedJeepInfo | null {
    let bestOption: AlignedJeepInfo | null = null;
    let bestOptionScore = -Infinity;

    const remainingDesiredPathDistance = calculateDistanceOfPolyline(desiredPathPolyline.slice(currentDesiredPathIndex));
    const effectiveSearchAhead = Math.min(DESIRED_PATH_SEARCH_AHEAD_METERS, remainingDesiredPathDistance);
    let cumulativeDesiredPathSearchDistance = 0;

    for (let dpIdx = currentDesiredPathIndex; dpIdx < desiredPathPolyline.length - 1; dpIdx++) {
        if (dpIdx > currentDesiredPathIndex) {
            cumulativeDesiredPathSearchDistance += calculateDistance(desiredPathPolyline[dpIdx - 1], desiredPathPolyline[dpIdx]);
        }
        if (cumulativeDesiredPathSearchDistance > effectiveSearchAhead && dpIdx > currentDesiredPathIndex) break;

        const pointOnDesiredPath = desiredPathPolyline[dpIdx];
        const nearbySegments = findNearbyRouteSegments(pointOnDesiredPath, ALIGNMENT_PROXIMITY_THRESHOLD_METERS);

        if (nearbySegments.length === 0) continue;

        for (const segInfo of nearbySegments) {
            const { pointOnPolyline: projectedBoardingPoint, segmentIndex: boardingSegmentStartIdx } =
                findNearestPointOnRoute(pointOnDesiredPath, segInfo.originalRoute);

            if (calculateDistance(pointOnDesiredPath, projectedBoardingPoint) > ALIGNMENT_PROXIMITY_THRESHOLD_METERS) continue;

            const walkToBoardDist = calculateDistance(actualCurrentLocation, projectedBoardingPoint);
            if (walkToBoardDist > maxWalkToBoard) continue;

            let trueBoardingVertexIndex = boardingSegmentStartIdx;
            if (boardingSegmentStartIdx + 1 < segInfo.originalRoute.coordinates.length &&
                calculateDistance(projectedBoardingPoint, segInfo.originalRoute.coordinates[boardingSegmentStartIdx + 1]) <
                calculateDistance(projectedBoardingPoint, segInfo.originalRoute.coordinates[boardingSegmentStartIdx])) {
                trueBoardingVertexIndex = boardingSegmentStartIdx + 1;
            }
            trueBoardingVertexIndex = Math.max(0, Math.min(trueBoardingVertexIndex, segInfo.originalRoute.coordinates.length - 1));
            const actualBoardingVertexCoordinate = segInfo.originalRoute.coordinates[trueBoardingVertexIndex];

            let tracedAlightPointCoordinate = actualBoardingVertexCoordinate;
            let tracedAlightingVertexIndex = trueBoardingVertexIndex;
            let jeepCoversDesiredPathUpToIndex = dpIdx;
            let jeepRideDistanceOnRoute = 0;

            // Trace along the jeep route
            for (let j = trueBoardingVertexIndex; j < segInfo.originalRoute.coordinates.length - 1; j++) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j + 1];
                jeepRideDistanceOnRoute += calculateDistance(jeepSegStart, jeepSegEnd);

                let aligns = false;
                // Check alignment with future points on the desired path
                for (let k = jeepCoversDesiredPathUpToIndex; k < desiredPathPolyline.length; k++) {
                    if (calculateDistance(jeepSegEnd, desiredPathPolyline[k]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        aligns = true;
                        // Prefer the alighting point that covers the furthest on the desired path
                        if (k >= jeepCoversDesiredPathUpToIndex) { // Check ">=" to handle initial alignment at dpIdx
                            tracedAlightPointCoordinate = jeepSegEnd;
                            tracedAlightingVertexIndex = j + 1;
                            jeepCoversDesiredPathUpToIndex = k;
                        }
                        // For Test Case 1 (undershooting/transfer), we might need to find the *best* alignment point,
                        // not just the first or furthest. This part is tricky.
                        // Let's try to ensure we project far enough.
                    }
                     // If the jeep route diverges too much from the current check point on desired path, stop checking further on desired path for this jeep segment
                    if (k > jeepCoversDesiredPathUpToIndex + 5 && // Check a bit ahead on desired path
                        calculateDistance(jeepSegEnd, desiredPathPolyline[k]) > DIVERGENCE_THRESHOLD_METERS * 1.75) {
                         break;
                    }
                }

                // If, after checking all relevant future desired path points, no alignment was found for jeepSegEnd,
                // and the jeep route is starting to diverge, then break from tracing this jeep route.
                if (!aligns && calculateDistance(jeepSegEnd, desiredPathPolyline[jeepCoversDesiredPathUpToIndex]) > DIVERGENCE_THRESHOLD_METERS) {
                    break;
                }
                 // Safety break if jeep ride becomes excessively long for a single segment evaluation
                if (jeepRideDistanceOnRoute > MAX_WALK_TO_JEEP_METERS * 7) break;
            }

            const rideDistance = calculateDistance(actualBoardingVertexCoordinate, tracedAlightPointCoordinate);

            if (rideDistance >= MIN_JEEP_RIDE_PROGRESS_METERS) {
                const progressOnDesiredPath = jeepCoversDesiredPathUpToIndex - dpIdx;
                // Score heavily based on how much of the desired path is covered
                // For Test Case 3: Make sure this score is high enough if a jeep follows highway
                let score = progressOnDesiredPath * 20; // Increased multiplier for desired path coverage
                score -= (walkToBoardDist / 15); // Walk distance is a penalty

                const distToFinalDestBeforeRide = calculateDistance(actualBoardingVertexCoordinate, finalDestination);
                const distToFinalDestAfterRide = calculateDistance(tracedAlightPointCoordinate, finalDestination);

                // Reward making progress towards the final destination
                score += (distToFinalDestBeforeRide - distToFinalDestAfterRide) / 30; // Increased reward for directness

                // Penalize if the jeep ride doesn't make substantial progress towards the destination OR goes further away
                if (distToFinalDestAfterRide >= distToFinalDestBeforeRide - (rideDistance * 0.1)) {
                    score -= 1000; // Strong penalty for inefficient rides
                }
                // Bonus for longer rides that follow the desired path well
                if (progressOnDesiredPath > 5 && rideDistance > MIN_JEEP_RIDE_PROGRESS_METERS * 2) {
                    score += rideDistance / 100;
                }


                if (score > bestOptionScore) {
                    bestOptionScore = score;
                    bestOption = {
                        jeepRoute: segInfo.originalRoute,
                        boardingPointOnJeep: actualBoardingVertexCoordinate,
                        alightPointOnJeep: tracedAlightPointCoordinate,
                        desiredPathStartIndex: dpIdx,
                        desiredPathEndIndex: jeepCoversDesiredPathUpToIndex,
                        walkToBoardingDistance: walkToBoardDist,
                        jeepBoardingVertexIndex: trueBoardingVertexIndex,
                        jeepAlightingVertexIndex: tracedAlightingVertexIndex
                    };
                }
            }
        }
    }
    return bestOption;
}


async function refineTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    if (legs.length === 0) return legs;
    const refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs));

    for (let i = 0; i < refinedLegs.length; i++) {
        const currentLeg = refinedLegs[i];

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
                        jeepVertexIdxOfClosestOverlap < originalJeepAlightIndexOnFullRoute) {
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
                        prevJeepLeg.jeepLegFullRouteEndIndex = newAlightFullRouteIndexForJeep;

                        refinedLegs[i] = newWalkLegFromCut;
                        if(refinedLegs[i]) refinedLegs[i].jeepBoardingPointInfo = `Walk from ${prevJeepLeg.routeName} (cut)`;
                    }
                }
            }
        }
        const legToRefine = refinedLegs[i];
        if (legToRefine.type === 'walk') {
            const originalWalkDistance = typeof legToRefine.distance === 'number' ? legToRefine.distance : calculateDistanceOfPolyline(legToRefine.coordinates);
            if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 2) continue; // Further increase threshold to avoid refining short walks

            let bestRefinedWalkLeg: PlannedTripLeg | null = null;
            let currentBestRefinedWalkDistance = originalWalkDistance;
            let bestNewPrevJeepAlightPoint: Coordinate | null = null;
            let bestNewNextJeepBoardPoint: Coordinate | null = null;
            let bestPrevJeepAlightIndex: number | undefined;
            let bestNextJeepBoardIndex: number | undefined;

            if (i === 0 && refinedLegs.length > 1 && refinedLegs[i+1]?.type === 'jeepney') {
                const nextJeepLeg = refinedLegs[i+1];
                const nextJeepRouteDef = getJeepneyRouteById(nextJeepLeg.routeId!);
                if (!nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) continue;
                const tripOrigin = legToRefine.coordinates[0];
                const plannedBoardIndexOnFullRoute = nextJeepLeg.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(nextJeepLeg.coordinates[0], nextJeepRouteDef).segmentIndex;
                const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRoute, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);

                for (const { point: candidateBoard, index: candidateBoardIndex } of candidateBoardPoints) {
                    const newWalk = await getWalkingDirections(tripOrigin, candidateBoard);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                    if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_WALK_TO_JEEP_METERS) {
                        if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS) {
                            currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk; bestNewNextJeepBoardPoint = candidateBoard;
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
                            currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk; bestNewPrevJeepAlightPoint = candidateAlight;
                            bestPrevJeepAlightIndex = candidateAlightIndex;
                            if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) break;
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
            else if (i > 0 && i < refinedLegs.length - 1 && refinedLegs[i-1]?.type === 'jeepney' && refinedLegs[i+1]?.type === 'jeepney') {
                const prevJeepLeg = refinedLegs[i-1];
                const nextJeepLeg = refinedLegs[i+1];
                const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);
                const nextJeepRouteDef = getJeepneyRouteById(nextJeepLeg.routeId!);
                if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2 ||
                    !nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) continue;

                const plannedAlightIndexOnFullRoutePrev = prevJeepLeg.jeepLegFullRouteEndIndex ?? findNearestPointOnRoute(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef).segmentIndex;
                const plannedBoardIndexOnFullRouteNext = nextJeepLeg.jeepLegFullRouteStartIndex ?? findNearestPointOnRoute(nextJeepLeg.coordinates[0], nextJeepRouteDef).segmentIndex;

                // For transfers, slightly larger search window can be beneficial if it means a much better connection
                const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoutePrev, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);
                const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRouteNext, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);

                let foundShortTransfer = false;
                for (const { point: cAlight, index: cAlightIndex } of candidateAlightPoints) {
                    for (const { point: cBoard, index: cBoardIndex } of candidateBoardPoints) {
                        const newWalk = await getWalkingDirections(cAlight, cBoard);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS * 0.8) { // Slightly less saving needed for transfers
                                currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk;
                                bestNewPrevJeepAlightPoint = cAlight; bestNewNextJeepBoardPoint = cBoard;
                                bestPrevJeepAlightIndex = cAlightIndex;
                                bestNextJeepBoardIndex = cBoardIndex;
                                if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) { foundShortTransfer = true; break; }
                            }
                        }
                    }
                    if (foundShortTransfer) break;
                }
                 if (bestRefinedWalkLeg && bestNewPrevJeepAlightPoint && bestNewNextJeepBoardPoint && typeof bestPrevJeepAlightIndex === 'number' && typeof bestNextJeepBoardIndex === 'number') {
                    refinedLegs[i] = bestRefinedWalkLeg;
                    prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], bestNewPrevJeepAlightPoint);
                    prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                    prevJeepLeg.jeepAlightingPointInfo = `Alight for transfer to ${nextJeepLeg.routeName} (refined)`;
                    prevJeepLeg.jeepLegFullRouteEndIndex = bestPrevJeepAlightIndex;

                    nextJeepLeg.coordinates = trimJeepLeg(nextJeepRouteDef.coordinates, bestNewNextJeepBoardPoint, nextJeepLeg.coordinates[nextJeepLeg.coordinates.length-1]);
                    nextJeepLeg.distance = calculateDistanceOfPolyline(nextJeepLeg.coordinates);
                    nextJeepLeg.jeepBoardingPointInfo = `Board ${nextJeepLeg.routeName} (refined transfer)`;
                    nextJeepLeg.jeepLegFullRouteStartIndex = bestNextJeepBoardIndex;
                }
            }
        }
    }
    return refinedLegs.filter(leg => leg.coordinates && leg.coordinates.length > 0 && ( (leg.type === 'walk' && leg.distance && typeof leg.distance === 'number' && leg.distance > 1) || leg.type === 'jeepney'));
}


function getCoordinatesInSearchWindow(
    routeCoordinates: Coordinate[],
    centerVertexIndexInput: number,
    searchRadiusMeters: number,
    minSeparationMeters: number
): Array<{point: Coordinate, index: number}> { // Return points with their original indices
    const results: Array<{point: Coordinate, index: number}> = [];
    if (!routeCoordinates || routeCoordinates.length === 0) return results;

    const centerVertexIndex = Math.max(0, Math.min(centerVertexIndexInput, routeCoordinates.length - 1));
    const centerPoint = routeCoordinates[centerVertexIndex];
    results.push({point: centerPoint, index: centerVertexIndex});

    let lastAddedPointBackward = centerPoint;
    let accumulatedDistBackward = 0;
    for (let i = centerVertexIndex - 1; i >= 0; i--) {
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
        accumulatedDistForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (accumulatedDistForward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointForward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointForward = routeCoordinates[i];
        }
    }
    return results;
}

function trimJeepLeg(
    fullRouteCoords: Coordinate[], newStartCoord: Coordinate, newEndCoord: Coordinate
): Coordinate[] {
    if (fullRouteCoords.length === 0) return [newStartCoord, newEndCoord];

    let startVertexIndex = 0;
    let minDistStart = Infinity;
    for (let i = 0; i < fullRouteCoords.length; i++) {
        const dist = calculateDistance(newStartCoord, fullRouteCoords[i]);
        if (dist < minDistStart) {
            minDistStart = dist;
            startVertexIndex = i;
        }
    }

    let endVertexIndex = startVertexIndex;
    let minDistEnd = calculateDistance(fullRouteCoords[startVertexIndex] || newStartCoord, newEndCoord);

    // Prefer points *after* the startVertexIndex for the end point
    for (let i = startVertexIndex; i < fullRouteCoords.length; i++) {
        const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
        if (dist < minDistEnd) {
            minDistEnd = dist;
            endVertexIndex = i;
        }
    }
    // If the end point is still too far, or somehow before the start, do a broader search
    // but still try to ensure endVertexIndex >= startVertexIndex
    if (minDistEnd > ALIGHTING_POINT_SEARCH_TOLERANCE_METERS * 1.5 || endVertexIndex < startVertexIndex) {
        let globalMinDistEnd = minDistEnd;
        let globalEndVertexIndex = endVertexIndex;
        for (let i = 0; i < fullRouteCoords.length; i++) {
            const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
            if (dist < globalMinDistEnd) {
                globalMinDistEnd = dist;
                globalEndVertexIndex = i;
            }
        }
        // Only use global if it's better AND not before the determined start point
        if (globalMinDistEnd < minDistEnd && globalEndVertexIndex >= startVertexIndex) {
            endVertexIndex = globalEndVertexIndex;
        } else if (globalEndVertexIndex < startVertexIndex && globalMinDistEnd < ALIGHTING_POINT_SEARCH_TOLERANCE_METERS) {
            // If it's very close but before start, it implies a loop or unusual route section.
            // Could indicate an issue with how start/end of jeep segment was chosen by findBestAlignedJeepney.
            // Forcing it to be at least startVertexIndex to avoid backward segments.
            endVertexIndex = startVertexIndex;
        }
        // If still endVertexIndex < startVertexIndex after global search, force end to be same as start (minimal segment)
        if (endVertexIndex < startVertexIndex) {
            endVertexIndex = startVertexIndex;
        }
    }


    let trimmedCoordinates: Coordinate[];
    if (startVertexIndex <= endVertexIndex) {
        trimmedCoordinates = fullRouteCoords.slice(startVertexIndex, endVertexIndex + 1);
    } else {
        // This should be a very rare fallback if logic above still results in start > end
        trimmedCoordinates = [fullRouteCoords[startVertexIndex] || newStartCoord, fullRouteCoords[endVertexIndex] || newEndCoord];
    }

    if (trimmedCoordinates.length > 0) {
        trimmedCoordinates[0] = newStartCoord;
        trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord;
    } else {
        trimmedCoordinates = [newStartCoord];
        if (calculateDistance(newStartCoord, newEndCoord) > 1) trimmedCoordinates.push(newEndCoord);
    }
    if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
        trimmedCoordinates.push(newEndCoord);
    }
    return trimmedCoordinates.length >= 2 ? trimmedCoordinates : [newStartCoord, newEndCoord]; // Ensure at least 2 points if distinct
}


export async function planTripWithDrivingGuide(
  origin: Coordinate,
  destination: Coordinate
): Promise<Array<PlannedTripLeg[]>> {

  const drivingPathLeg = await getDrivingDirections(origin, destination);
  if (!drivingPathLeg || !drivingPathLeg.coordinates || drivingPathLeg.coordinates.length === 0) {
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  const desiredPathPolyline: Coordinate[] = drivingPathLeg.coordinates;

  let plannedLegs: PlannedTripLeg[] = [];
  let currentLocation = origin;
  let currentDesiredPathIndex = 0;
  let lastJeepRouteIdTaken: string | undefined = undefined;
  let consecutiveShortJeepLegsOnSameRoute = 0;

  const MAX_TRIP_LEGS = 10; // Max iterations to prevent infinite loops

  for (let legCount = 0; legCount < MAX_TRIP_LEGS; legCount++) {
    const distanceToFinalDest = calculateDistance(currentLocation, destination);
    if (distanceToFinalDest < 100) { // If close enough, finish with a walk
        if (distanceToFinalDest > 5) { // Add final walk if not exactly at destination
            const finalMicroWalk = await getWalkingDirections(currentLocation, destination);
            if (finalMicroWalk) plannedLegs.push(finalMicroWalk);
        }
        currentLocation = destination; // Mark as arrived
        break;
    }

    if (currentDesiredPathIndex >= desiredPathPolyline.length - 1 && desiredPathPolyline.length > 0) {
         const finalWalk = await getWalkingDirections(currentLocation, destination);
         if (finalWalk) { plannedLegs.push(finalWalk); }
         currentLocation = destination;
         break;
    }

    const alignedJeepInfo = findBestAlignedJeepney(
      currentLocation, desiredPathPolyline, currentDesiredPathIndex, MAX_WALK_TO_JEEP_METERS, destination
    );

    if (alignedJeepInfo) {
        if (alignedJeepInfo.jeepRoute.id === lastJeepRouteIdTaken &&
            calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 120 &&
            calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS * 1.8) {
            consecutiveShortJeepLegsOnSameRoute++;
            if (consecutiveShortJeepLegsOnSameRoute > 0) { // Be more aggressive in skipping short re-boards
                const nextSignificantDpIdx = Math.min(currentDesiredPathIndex + Math.floor(MIN_JEEP_RIDE_PROGRESS_METERS / 40), desiredPathPolyline.length - 1);
                if (nextSignificantDpIdx > currentDesiredPathIndex) {
                    const forcedWalk = await getWalkingDirections(currentLocation, desiredPathPolyline[nextSignificantDpIdx]);
                    if (forcedWalk && forcedWalk.coordinates.length > 1 && (forcedWalk.distance as number > 10)) {
                        plannedLegs.push(forcedWalk); currentLocation = forcedWalk.coordinates.slice(-1)[0];
                        currentDesiredPathIndex = nextSignificantDpIdx; lastJeepRouteIdTaken = undefined;
                        consecutiveShortJeepLegsOnSameRoute = 0;
                        continue;
                    }
                }
            }
        } else {
            consecutiveShortJeepLegsOnSameRoute = 0;
        }

      const walkToBoardLeg = await getWalkingDirections(currentLocation, alignedJeepInfo.boardingPointOnJeep);
      const walkDistanceToBoard = (walkToBoardLeg?.distance as number) ?? Infinity;

      if (walkToBoardLeg && walkDistanceToBoard <= MAX_WALK_TO_JEEP_METERS) { // Use "<="
        if (walkDistanceToBoard > 5) {
            plannedLegs.push(walkToBoardLeg);
        }
        currentLocation = alignedJeepInfo.boardingPointOnJeep;

        const jeepRideCoordinates = trimJeepLeg(
            alignedJeepInfo.jeepRoute.coordinates,
            alignedJeepInfo.boardingPointOnJeep,
            alignedJeepInfo.alightPointOnJeep
        );
        const jeepRideDist = calculateDistanceOfPolyline(jeepRideCoordinates);

        if (jeepRideCoordinates.length >= 2 && jeepRideDist >= MIN_JEEP_RIDE_PROGRESS_METERS) { // Stricter "greater than or equal"
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
                distance: jeepRideDist,
                duration: (jeepRideDist / (12 * 1000 / 3600)), // Adjusted speed slightly for estimation
                jeepBoardingPointInfo: `Board ${alignedJeepInfo.jeepRoute.name}`,
                jeepAlightingPointInfo: `Alight from ${alignedJeepInfo.jeepRoute.name}`,
                jeepLegFullRouteStartIndex: alignedJeepInfo.jeepBoardingVertexIndex,
                jeepLegFullRouteEndIndex: alignedJeepInfo.jeepAlightingVertexIndex,
            };
            plannedLegs.push(jeepRideLeg);
            currentLocation = alignedJeepInfo.alightPointOnJeep;
            currentDesiredPathIndex = alignedJeepInfo.desiredPathEndIndex;
            lastJeepRouteIdTaken = alignedJeepInfo.jeepRoute.id;
          } else {
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
        currentLocation = destination; break;
      }
    } else {
      // This is crucial for Test Case 3: If no jeep is found, but the destination is still far,
      // we should still walk along the desired driving path for a bit, then re-evaluate.
      // However, if the driving path is very long and no jeeps align, it will default to walking the whole thing.
      // For Test Case 3 (A to C, C is far), if a jeep *should* be picked up along the highway:
      // The `MAX_WALK_TO_JEEP_METERS` and the scoring in `findBestAlignedJeepney` are key.
      // If the walking path (desiredPathPolyline) *does* overlap with a jeep route for a significant distance,
      // `findBestAlignedJeepney` should identify it.
      // If it still suggests full walking, it means either:
      // 1. The walk to the jeep is > MAX_WALK_TO_JEEP_METERS from `currentLocation`.
      // 2. The jeep ride found is scored lower than just continuing to the next `dpIdx` and re-evaluating (unlikely for long highway stretches).
      // 3. The `ALIGNMENT_PROXIMITY_THRESHOLD_METERS` isn't met consistently.

      // If no jeep is found, and we are not near the destination, make *some* progress by walking.
      // This part needs to be careful not to create too many small walking legs if a jeep truly isn't viable.
      if (distanceToFinalDest > MAX_FINAL_WALK_METERS * 0.8) { // If still quite far
          const walkAlongDesiredPathDist = Math.min(MAX_WALK_TO_JEEP_METERS * 0.75, distanceToFinalDest / 2); // Walk a portion
          let nextPointIndex = currentDesiredPathIndex;
          let distWalked = 0;
          for(let k=currentDesiredPathIndex; k < desiredPathPolyline.length -1; k++) {
              distWalked += calculateDistance(desiredPathPolyline[k], desiredPathPolyline[k+1]);
              nextPointIndex = k + 1;
              if (distWalked >= walkAlongDesiredPathDist) break;
          }
          if (nextPointIndex > currentDesiredPathIndex) {
              const partialWalkLeg = await getWalkingDirections(currentLocation, desiredPathPolyline[nextPointIndex]);
              if (partialWalkLeg && (partialWalkLeg.distance as number) > 5) {
                  plannedLegs.push(partialWalkLeg);
                  currentLocation = desiredPathPolyline[nextPointIndex];
                  currentDesiredPathIndex = nextPointIndex;
                  lastJeepRouteIdTaken = undefined; // Reset after a walk
                  continue; // Re-evaluate for a jeep from the new currentLocation
              }
          }
      }
      // If closer or partial walk didn't happen, proceed to final walk.
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk && (finalWalk.distance as number > 5)) { plannedLegs.push(finalWalk); }
      currentLocation = destination; break;
    }
  }

  if (plannedLegs.length > 0) {
      const lastActualLegEnd = plannedLegs[plannedLegs.length -1].coordinates.slice(-1)[0];
      if (lastActualLegEnd && calculateDistance(lastActualLegEnd, destination) > 10) {
          const finalConnectionWalk = await getWalkingDirections(lastActualLegEnd, destination);
          if (finalConnectionWalk && (finalConnectionWalk.distance as number > 5)) {
            plannedLegs.push(finalConnectionWalk);
          }
      }
  } else if (calculateDistance(origin, destination) > 5) {
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback && (directWalkFallback.distance as number > 5)) { plannedLegs.push(directWalkFallback); }
  }

  const refinedSolution = await refineTripLegs(plannedLegs, destination);
  return refinedSolution.length > 0 ? [refinedSolution] : [];
}

export { planTripWithDrivingGuide as planTrip };