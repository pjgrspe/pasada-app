// pasada-gemini/modules/map/services/tripPlannerServices.ts
// Increased JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT and added logging for terminal logic.

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

// --- Constants for Trip Planning Logic (tuned for performance) ---
const MAX_WALK_TO_JEEP_METERS = 700;
const MAX_FINAL_WALK_METERS = 1500;
const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 200;
const MIN_JEEP_RIDE_PROGRESS_METERS = 200;
const DESIRED_PATH_SEARCH_AHEAD_METERS = 600;
const DIVERGENCE_THRESHOLD_METERS = 250;
// Increased threshold for terminal zone detection
const JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT = 25; // If boarding index is less than this, redirect to route start (index 0)

// --- Constants for Post-Processing Refinement Optimization ---
const REFINE_SEARCH_RADIUS_METERS = 120;
const REFINE_MIN_WALK_SAVING_METERS = 50;
const REFINE_MAX_WALK_FOR_CONNECTION = 400;
const MIN_CANDIDATE_SEPARATION_METERS = 40;
const REFINE_EARLY_EXIT_WALK_THRESHOLD = 15;
const ALIGHTING_POINT_SEARCH_TOLERANCE_METERS = 50;
const OVERLAP_CUT_THRESHOLD_METERS = 30;
const OVERLAP_WALK_POINTS_TO_CHECK_V7 = 4;

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
            const { pointOnPolyline: projectedPointOnJeepRoute, segmentIndex: initialSegmentIndex } =
                findNearestPointOnRoute(pointOnDesiredPath, segInfo.originalRoute);

            if (calculateDistance(pointOnDesiredPath, projectedPointOnJeepRoute) > ALIGNMENT_PROXIMITY_THRESHOLD_METERS) continue;

            let candidateBoardingVertexIndex = initialSegmentIndex;
            if (initialSegmentIndex + 1 < segInfo.originalRoute.coordinates.length &&
                calculateDistance(projectedPointOnJeepRoute, segInfo.originalRoute.coordinates[initialSegmentIndex + 1]) <
                calculateDistance(projectedPointOnJeepRoute, segInfo.originalRoute.coordinates[initialSegmentIndex])) {
                candidateBoardingVertexIndex = initialSegmentIndex + 1;
            }
            candidateBoardingVertexIndex = Math.max(0, Math.min(candidateBoardingVertexIndex, segInfo.originalRoute.coordinates.length - 1));

            let actualBoardingCoordinateForRide = segInfo.originalRoute.coordinates[candidateBoardingVertexIndex];
            let rideStartsFromVertexIndex = candidateBoardingVertexIndex;
            let walkToThisBoardingPointDist = calculateDistance(actualCurrentLocation, actualBoardingCoordinateForRide);

            // DEBUG LOG for terminal logic
            // console.log(`[Jeep: ${segInfo.originalRoute.name}] Initial candidateBoardingVertexIndex: ${candidateBoardingVertexIndex}`);

            if (candidateBoardingVertexIndex < JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT && segInfo.originalRoute.coordinates.length > 0) {
                // console.log(`  -> Candidate is in terminal zone ( < ${JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT}). Forcing board at index 0.`);
                actualBoardingCoordinateForRide = segInfo.originalRoute.coordinates[0];
                rideStartsFromVertexIndex = 0;
                walkToThisBoardingPointDist = calculateDistance(actualCurrentLocation, actualBoardingCoordinateForRide);
            }
            // console.log(`  -> Final rideStartsFromVertexIndex: ${rideStartsFromVertexIndex}, walkDist: ${walkToThisBoardingPointDist.toFixed(0)}m`);


            if (walkToThisBoardingPointDist > maxWalkToBoard) continue;

            let tracedAlightPointCoordinate = actualBoardingCoordinateForRide;
            let tracedAlightingVertexIndex = rideStartsFromVertexIndex;
            let jeepCoversDesiredPathUpToIndex = dpIdx;
            let jeepRideDistanceOnRoute = 0;
            let bestTracedAlightPointForThisSegment: Coordinate | null = null;
            let bestTracedAlightingVertexIndexForThisSegment = -1;
            let bestJeepCoversDesiredPathUpToIndexForThisSegment = -1;

            for (let j = rideStartsFromVertexIndex; j < segInfo.originalRoute.coordinates.length - 1; j++) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j + 1];
                jeepRideDistanceOnRoute += calculateDistance(jeepSegStart, jeepSegEnd);

                for (let k = desiredPathPolyline.length - 1; k >= jeepCoversDesiredPathUpToIndex; k--) {
                     if (calculateDistance(jeepSegEnd, desiredPathPolyline[k]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        if (k > bestJeepCoversDesiredPathUpToIndexForThisSegment) {
                            bestTracedAlightPointForThisSegment = jeepSegEnd;
                            bestTracedAlightingVertexIndexForThisSegment = j + 1;
                            bestJeepCoversDesiredPathUpToIndexForThisSegment = k;
                        }
                        if (k > jeepCoversDesiredPathUpToIndex) {
                             tracedAlightPointCoordinate = jeepSegEnd;
                             tracedAlightingVertexIndex = j + 1;
                             jeepCoversDesiredPathUpToIndex = k;
                        }
                    }
                }
                if (bestTracedAlightPointForThisSegment && calculateDistance(jeepSegEnd, desiredPathPolyline[bestJeepCoversDesiredPathUpToIndexForThisSegment]) > DIVERGENCE_THRESHOLD_METERS * 1.5) {
                    break;
                }
                if (jeepRideDistanceOnRoute > MAX_WALK_TO_JEEP_METERS * 6) break;
            }

            if (bestTracedAlightPointForThisSegment) {
                tracedAlightPointCoordinate = bestTracedAlightPointForThisSegment;
                tracedAlightingVertexIndex = bestTracedAlightingVertexIndexForThisSegment;
                jeepCoversDesiredPathUpToIndex = bestJeepCoversDesiredPathUpToIndexForThisSegment;
            }

            const rideDistance = calculateDistance(actualBoardingCoordinateForRide, tracedAlightPointCoordinate);

            if (rideDistance >= MIN_JEEP_RIDE_PROGRESS_METERS) {
                const progressOnDesiredPath = jeepCoversDesiredPathUpToIndex - dpIdx;
                let score = progressOnDesiredPath * 15 - (walkToThisBoardingPointDist / 20);

                const distToFinalDestBeforeRide = calculateDistance(actualBoardingCoordinateForRide, finalDestination);
                const distToFinalDestAfterRide = calculateDistance(tracedAlightPointCoordinate, finalDestination);
                score += (distToFinalDestBeforeRide - distToFinalDestAfterRide) / 50;

                if (distToFinalDestAfterRide > distToFinalDestBeforeRide - (rideDistance * 0.2)) {
                    score -= 500;
                }

                if (score > bestOptionScore) {
                    bestOptionScore = score;
                    bestOption = {
                        jeepRoute: segInfo.originalRoute,
                        boardingPointOnJeep: actualBoardingCoordinateForRide,
                        alightPointOnJeep: tracedAlightPointCoordinate,
                        desiredPathStartIndex: dpIdx,
                        desiredPathEndIndex: jeepCoversDesiredPathUpToIndex,
                        walkToBoardingDistance: walkToThisBoardingPointDist,
                        jeepBoardingVertexIndex: rideStartsFromVertexIndex,
                        jeepAlightingVertexIndex: tracedAlightingVertexIndex
                    };
                }
            }
        }
    }
    return bestOption;
}

// ... (refineTripLegs, getCoordinatesInSearchWindow, trimJeepLeg remain the same as the previous good version)
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
            if (originalWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD * 1.5) continue;

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

                const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, plannedAlightIndexOnFullRoutePrev, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);
                const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, plannedBoardIndexOnFullRouteNext, REFINE_SEARCH_RADIUS_METERS * 1.2, MIN_CANDIDATE_SEPARATION_METERS);

                let foundShortTransfer = false;
                for (const { point: cAlight, index: cAlightIndex } of candidateAlightPoints) {
                    for (const { point: cBoard, index: cBoardIndex } of candidateBoardPoints) {
                        const newWalk = await getWalkingDirections(cAlight, cBoard);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS * 0.8) {
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

function trimJeepLeg(
    fullRouteCoords: Coordinate[], newStartCoord: Coordinate, newEndCoord: Coordinate
): Coordinate[] {
    if (!fullRouteCoords || fullRouteCoords.length === 0) {
        return newStartCoord && newEndCoord ? [newStartCoord, newEndCoord] : (newStartCoord ? [newStartCoord] : (newEndCoord ? [newEndCoord] : []));
    }
    if (!newStartCoord || !newEndCoord) {
        return [];
    }

    let startVertexIndex = 0;
    let minDistStart = Infinity;
    for (let i = 0; i < fullRouteCoords.length; i++) {
        if (!fullRouteCoords[i]) continue;
        const dist = calculateDistance(newStartCoord, fullRouteCoords[i]);
        if (dist < minDistStart) {
            minDistStart = dist;
            startVertexIndex = i;
        }
    }

    let endVertexIndex = startVertexIndex;
    let minDistEnd = fullRouteCoords[startVertexIndex] ? calculateDistance(fullRouteCoords[startVertexIndex], newEndCoord) : Infinity;

    for (let i = startVertexIndex; i < fullRouteCoords.length; i++) {
         if (!fullRouteCoords[i]) continue;
        const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
        if (dist < minDistEnd) {
            minDistEnd = dist;
            endVertexIndex = i;
        }
    }

    if (minDistEnd > ALIGHTING_POINT_SEARCH_TOLERANCE_METERS * 1.5 || endVertexIndex < startVertexIndex) {
        let globalMinDistEnd = minDistEnd;
        let globalEndVertexIndex = endVertexIndex;
        for (let i = 0; i < fullRouteCoords.length; i++) {
            if (!fullRouteCoords[i]) continue;
            const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
            if (dist < globalMinDistEnd) {
                globalMinDistEnd = dist;
                globalEndVertexIndex = i;
            }
        }
        if (globalMinDistEnd < minDistEnd && globalEndVertexIndex >= startVertexIndex) {
            endVertexIndex = globalEndVertexIndex;
        } else if (globalEndVertexIndex < startVertexIndex && globalMinDistEnd < ALIGHTING_POINT_SEARCH_TOLERANCE_METERS){
            endVertexIndex = startVertexIndex;
        }
         if (endVertexIndex < startVertexIndex) {
            endVertexIndex = startVertexIndex;
        }
    }

    let trimmedCoordinates: Coordinate[];
    if (startVertexIndex <= endVertexIndex && fullRouteCoords[startVertexIndex] && fullRouteCoords[endVertexIndex]) {
        trimmedCoordinates = fullRouteCoords.slice(startVertexIndex, endVertexIndex + 1);
    } else if (fullRouteCoords[startVertexIndex]) {
        trimmedCoordinates = [fullRouteCoords[startVertexIndex]];
    } else {
        trimmedCoordinates = [];
    }

    if (trimmedCoordinates.length > 0) {
        trimmedCoordinates[0] = newStartCoord;
        if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
           trimmedCoordinates.push(newEndCoord);
        } else if (trimmedCoordinates.length > 1) {
            trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord;
        }
    } else {
        trimmedCoordinates = [newStartCoord];
        if (calculateDistance(newStartCoord, newEndCoord) > 1) trimmedCoordinates.push(newEndCoord);
    }

    if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
        trimmedCoordinates.push(newEndCoord);
    }
    return trimmedCoordinates.filter(c => c) as Coordinate[];
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
  const MAX_TRIP_LEGS = 10;

  for (let legCount = 0; legCount < MAX_TRIP_LEGS; legCount++) {
    const distanceToFinalDest = calculateDistance(currentLocation, destination);
    if (distanceToFinalDest < 100) {
        if (distanceToFinalDest > 5) {
            const finalMicroWalk = await getWalkingDirections(currentLocation, destination);
            if (finalMicroWalk) plannedLegs.push(finalMicroWalk);
        }
        currentLocation = destination;
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
            if (consecutiveShortJeepLegsOnSameRoute > 0) {
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

      if (walkToBoardLeg && walkDistanceToBoard <= MAX_WALK_TO_JEEP_METERS) {
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

        if (jeepRideCoordinates.length >= 2 && jeepRideDist >= MIN_JEEP_RIDE_PROGRESS_METERS) {
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
                distance: jeepRideDist,
                duration: (jeepRideDist / (12 * 1000 / 3600)),
                jeepBoardingPointInfo: `Board ${alignedJeepInfo.jeepRoute.name}${alignedJeepInfo.jeepBoardingVertexIndex === 0 ? ' at terminal' : ''}`,
                jeepAlightingPointInfo: `Alight from ${alignedJeepInfo.jeepRoute.name}`,
                jeepLegFullRouteStartIndex: alignedJeepInfo.jeepBoardingVertexIndex,
                jeepLegFullRouteEndIndex: alignedJeepInfo.jeepAlightingVertexIndex,
                isTerminalBoarding: alignedJeepInfo.jeepBoardingVertexIndex === 0,
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
      if (distanceToFinalDest > MAX_FINAL_WALK_METERS * 0.75) {
          const walkAlongDesiredPathDist = Math.min(MAX_WALK_TO_JEEP_METERS * 0.65, distanceToFinalDest * 0.4);
          let nextPointIndex = currentDesiredPathIndex;
          let distWalked = 0;
          for(let k=currentDesiredPathIndex; k < desiredPathPolyline.length -1; k++) {
              if(!desiredPathPolyline[k] || !desiredPathPolyline[k+1]) break;
              distWalked += calculateDistance(desiredPathPolyline[k], desiredPathPolyline[k+1]);
              nextPointIndex = k + 1;
              if (distWalked >= walkAlongDesiredPathDist) break;
          }
          if (nextPointIndex > currentDesiredPathIndex && desiredPathPolyline[nextPointIndex]) {
              const partialWalkLeg = await getWalkingDirections(currentLocation, desiredPathPolyline[nextPointIndex]);
              if (partialWalkLeg && (partialWalkLeg.distance as number) > 10) {
                  plannedLegs.push(partialWalkLeg);
                  currentLocation = desiredPathPolyline[nextPointIndex];
                  currentDesiredPathIndex = nextPointIndex;
                  lastJeepRouteIdTaken = undefined;
                  continue;
              }
          }
      }
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk && (finalWalk.distance as number > 5)) { plannedLegs.push(finalWalk); }
      currentLocation = destination; break;
    }
  }

  if (plannedLegs.length > 0) {
      const lastLeg = plannedLegs[plannedLegs.length -1];
      if (lastLeg.coordinates && lastLeg.coordinates.length > 0) {
        const lastActualLegEnd = lastLeg.coordinates.slice(-1)[0];
        if (lastActualLegEnd && calculateDistance(lastActualLegEnd, destination) > 10) {
            const finalConnectionWalk = await getWalkingDirections(lastActualLegEnd, destination);
            if (finalConnectionWalk && (finalConnectionWalk.distance as number > 5)) {
              plannedLegs.push(finalConnectionWalk);
            }
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
