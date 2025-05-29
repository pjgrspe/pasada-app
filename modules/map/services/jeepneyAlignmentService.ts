// pasada-gemini/modules/map/services/jeepneyAlignmentService.ts
import { Coordinate, JeepneyRoute, PlannedTripLeg } from '../utils/routeTypes';
import { findNearbyRouteSegments } from './jeepneyDataService';
import { calculateDistance, findNearestPointOnRoute, getWalkingDirections } from './mapApiServices';
import { calculateDistanceOfPolyline } from '../utils/mapHelpers';
import {
    ALIGNMENT_PROXIMITY_THRESHOLD_METERS,
    MIN_JEEP_RIDE_PROGRESS_METERS,
    DESIRED_PATH_SEARCH_AHEAD_METERS,
    DIVERGENCE_THRESHOLD_METERS,
    JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT,
    MAX_WALK_TO_JEEP_METERS
} from '../constants/tripPlanningConstants';

export interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate;
  alightPointOnJeep: Coordinate;
  desiredPathStartIndex: number;
  desiredPathEndIndex: number;
  walkToBoardingDistance: number;
  jeepBoardingVertexIndex: number;
  jeepAlightingVertexIndex: number;
  tookLoop?: boolean;
  loopConnectIndex?: number;
}

export function findBestAlignedJeepney(
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

            if (candidateBoardingVertexIndex < JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT && segInfo.originalRoute.coordinates.length > 0) {
                actualBoardingCoordinateForRide = segInfo.originalRoute.coordinates[0];
                rideStartsFromVertexIndex = 0;
                walkToThisBoardingPointDist = calculateDistance(actualCurrentLocation, actualBoardingCoordinateForRide);
            }

            if (walkToThisBoardingPointDist > maxWalkToBoard) continue;

            let currentBestAlightPoint = actualBoardingCoordinateForRide;
            let currentBestAlightIndex = rideStartsFromVertexIndex;
            let currentBestDpCoverageIndex = dpIdx;
            let currentRideDistance = 0;
            let hasLoopedThisAttempt = false;
            let tookLoopInBestAlignment = false;

            for (let j = rideStartsFromVertexIndex; j < segInfo.originalRoute.coordinates.length -1; ) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j + 1];
                currentRideDistance += calculateDistance(jeepSegStart, jeepSegEnd);

                for (let k_dp = desiredPathPolyline.length - 1; k_dp >= currentBestDpCoverageIndex; k_dp--) {
                    if (calculateDistance(jeepSegEnd, desiredPathPolyline[k_dp]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        if (k_dp >= currentBestDpCoverageIndex) {
                            currentBestAlightPoint = jeepSegEnd;
                            currentBestAlightIndex = j + 1;
                            currentBestDpCoverageIndex = k_dp;
                            tookLoopInBestAlignment = hasLoopedThisAttempt;
                        }
                    }
                }

                if (calculateDistance(jeepSegEnd, desiredPathPolyline[currentBestDpCoverageIndex]) > DIVERGENCE_THRESHOLD_METERS * 1.5 && currentRideDistance > MIN_JEEP_RIDE_PROGRESS_METERS) {
                    break;
                }
                if (currentRideDistance > MAX_WALK_TO_JEEP_METERS * 7) break;

                if ((j + 1) === (segInfo.originalRoute.coordinates.length - 1) &&
                    segInfo.originalRoute.isLooping &&
                    typeof segInfo.originalRoute.loopConnectIndex === 'number' &&
                    !hasLoopedThisAttempt &&
                    currentBestDpCoverageIndex < desiredPathPolyline.length - 2
                ) {
                    j = segInfo.originalRoute.loopConnectIndex -1; // -1 because loop increments j
                    hasLoopedThisAttempt = true;
                } else {
                    j++;
                }
            }

            if (currentRideDistance >= MIN_JEEP_RIDE_PROGRESS_METERS) {
                const progressOnDesiredPath = currentBestDpCoverageIndex - dpIdx;
                let score = progressOnDesiredPath * 15 - (walkToThisBoardingPointDist / 20);
                score += currentRideDistance / 100;

                const distToFinalDestBeforeRide = calculateDistance(actualBoardingCoordinateForRide, finalDestination);
                const distToFinalDestAfterRide = calculateDistance(currentBestAlightPoint, finalDestination);
                score += (distToFinalDestBeforeRide - distToFinalDestAfterRide) / 50;

                if (distToFinalDestAfterRide > distToFinalDestBeforeRide - (currentRideDistance * 0.15)) {
                    score -= 600; // Penalize if ride doesn't significantly reduce distance to final dest
                }

                if (score > bestOptionScore) {
                    bestOptionScore = score;
                    bestOption = {
                        jeepRoute: segInfo.originalRoute,
                        boardingPointOnJeep: actualBoardingCoordinateForRide,
                        alightPointOnJeep: currentBestAlightPoint,
                        desiredPathStartIndex: dpIdx,
                        desiredPathEndIndex: currentBestDpCoverageIndex,
                        walkToBoardingDistance: walkToThisBoardingPointDist,
                        jeepBoardingVertexIndex: rideStartsFromVertexIndex,
                        jeepAlightingVertexIndex: currentBestAlightIndex,
                        tookLoop: tookLoopInBestAlignment,
                        loopConnectIndex: tookLoopInBestAlignment ? segInfo.originalRoute.loopConnectIndex : undefined
                    };
                }
            }
        }
    }
    return bestOption;
}