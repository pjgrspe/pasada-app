// pasada-gemini/modules/map/services/tripPlannerServices.ts
// Uses jeepLegFullRouteStartIndex/EndIndex for refinement context + Overlap Cut v7

import {
  Coordinate,
  PlannedTripLeg,
  JeepneyRoute,
} from '../utils/routeTypes'; // Ensure this path is correct
import {
  findNearbyRouteSegments,
  initializeJeepneySpatialIndex,
  getJeepneySpatialIndex,
  getJeepneyRouteById,
} from './jeepneyDataService'; // Ensure this path is correct
import {
  getWalkingDirections,
  getDrivingDirections,
  calculateDistance,
  findNearestPointOnRoute,
} from './mapApiServices'; // Ensure this path is correct

// --- Constants for Trip Planning Logic ---
const MAX_WALK_TO_JEEP_METERS = 700;
const MAX_FINAL_WALK_METERS = 1500;
const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 200;
const MIN_JEEP_RIDE_PROGRESS_METERS = 200;
const DESIRED_PATH_SEARCH_AHEAD_METERS = 700;
const DIVERGENCE_THRESHOLD_METERS = 250;

// --- Constants for Post-Processing Refinement Optimization ---
const REFINE_SEARCH_RADIUS_METERS = 150;
const REFINE_MIN_WALK_SAVING_METERS = 30;
const REFINE_MAX_WALK_FOR_CONNECTION = 500;
const MIN_CANDIDATE_SEPARATION_METERS = 30;
const REFINE_EARLY_EXIT_WALK_THRESHOLD = 10;
const ALIGHTING_POINT_SEARCH_TOLERANCE_METERS = 50;
const OVERLAP_CUT_THRESHOLD_METERS = 30; // How close walk start and jeep point must be
const OVERLAP_WALK_POINTS_TO_CHECK_V7 = 5; // Check first N points of walk leg

interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate;
  alightPointOnJeep: Coordinate;
  desiredPathStartIndex: number;
  desiredPathEndIndex: number;
  walkToBoardingDistance: number;
  jeepBoardingVertexIndex: number; // Index on full jeep route
  jeepAlightingVertexIndex: number; // Index on full jeep route (after forward trace)
}

function findBestAlignedJeepney(
    actualCurrentLocation: Coordinate,
    desiredPathPolyline: Coordinate[],
    currentDesiredPathIndex: number,
    maxWalkToBoard: number,
    finalDestination: Coordinate
): AlignedJeepInfo | null {
    console.log(`  findBestAlignedJeepney (SegmentAware Base): currentLoc ${JSON.stringify(actualCurrentLocation)}, desiredPathIdx ${currentDesiredPathIndex}`);
    let bestOption: AlignedJeepInfo | null = null;
    let bestOptionScore = -Infinity;

    for (let dpIdx = currentDesiredPathIndex; dpIdx < desiredPathPolyline.length - 1; dpIdx++) {
        let cumulativeDesiredPathSearchDistance = 0;
        if (dpIdx > currentDesiredPathIndex) {
            cumulativeDesiredPathSearchDistance += calculateDistance(desiredPathPolyline[dpIdx - 1], desiredPathPolyline[dpIdx]);
        }
        if (cumulativeDesiredPathSearchDistance > DESIRED_PATH_SEARCH_AHEAD_METERS && dpIdx > currentDesiredPathIndex) break;

        const pointOnDesiredPath = desiredPathPolyline[dpIdx];
        const nearbySegments = findNearbyRouteSegments(pointOnDesiredPath, ALIGNMENT_PROXIMITY_THRESHOLD_METERS);

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

            for (let j = trueBoardingVertexIndex; j < segInfo.originalRoute.coordinates.length - 1; j++) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j + 1];
                jeepRideDistanceOnRoute += calculateDistance(jeepSegStart, jeepSegEnd);

                let aligns = false;
                for (let k = jeepCoversDesiredPathUpToIndex; k < desiredPathPolyline.length; k++) {
                    if (calculateDistance(jeepSegEnd, desiredPathPolyline[k]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        aligns = true;
                        tracedAlightPointCoordinate = jeepSegEnd;
                        tracedAlightingVertexIndex = j + 1;
                        jeepCoversDesiredPathUpToIndex = k;
                        break;
                    }
                    if (k > jeepCoversDesiredPathUpToIndex + 10 && calculateDistance(jeepSegEnd, desiredPathPolyline[k]) > DIVERGENCE_THRESHOLD_METERS * 1.5) break;
                }
                if (!aligns || jeepRideDistanceOnRoute > MAX_WALK_TO_JEEP_METERS * 5) break;
            }

            const rideDistance = calculateDistance(actualBoardingVertexCoordinate, tracedAlightPointCoordinate);
            if (rideDistance >= MIN_JEEP_RIDE_PROGRESS_METERS) {
                const progressOnDesiredPath = jeepCoversDesiredPathUpToIndex - dpIdx;
                let score = progressOnDesiredPath * 10 - (walkToBoardDist / 10);
                const distToFinalDestBefore = calculateDistance(actualBoardingVertexCoordinate, finalDestination);
                const distToFinalDestAfter = calculateDistance(tracedAlightPointCoordinate, finalDestination);
                if (distToFinalDestAfter < distToFinalDestBefore) score += (distToFinalDestBefore - distToFinalDestAfter) / 100;
                else if (distToFinalDestAfter > distToFinalDestBefore + rideDistance * 0.75) score -= 1000;

                if (score > bestOptionScore) {
                    bestOptionScore = score;
                    bestOption = {
                        jeepRoute: segInfo.originalRoute,
                        boardingPointOnJeep: actualBoardingVertexCoordinate,
                        alightPointOnJeep: tracedAlightPointCoordinate,
                        desiredPathStartIndex: dpIdx,
                        desiredPathEndIndex: jeepCoversDesiredPathUpToIndex,
                        walkToBoardingDistance: walkToBoardDist,
                        jeepBoardingVertexIndex: trueBoardingVertexIndex, // Index on full route
                        jeepAlightingVertexIndex: tracedAlightingVertexIndex // Index on full route
                    };
                }
            }
        }
    }
    if (bestOption) console.log(`    findBestAlignedJeepney (SegmentAware Base) found: ${bestOption.jeepRoute.name}, boardFullRouteIdx ${bestOption.jeepBoardingVertexIndex}, alightFullRouteIdx ${bestOption.jeepAlightingVertexIndex}, score: ${bestOptionScore.toFixed(2)}`);
    else console.log("    findBestAlignedJeepney (SegmentAware Base): No suitable jeep alignment found.");
    return bestOption;
}


async function refineTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    console.log("[Refine START - Overlap Cut v7 + Segment Aware General Refinement]");
    if (legs.length === 0) return legs;

    const refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs));

    for (let i = 0; i < refinedLegs.length; i++) {
        // --- "OVERLAP CUT v7" LOGIC ---
        if (refinedLegs[i].type === 'walk' && i > 0 && refinedLegs[i - 1]?.type === 'jeepney') {
            const currentWalkLeg = refinedLegs[i];
            const prevJeepLeg = refinedLegs[i - 1];
            const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);

            console.log(`  [Overlap Cut v7 - Leg ${i}] Checking walk after jeep ${prevJeepLeg.routeName}.`);
            console.log(`    Walk starts at: ${JSON.stringify(currentWalkLeg.coordinates[0])}`);
            console.log(`    Prev Jeep (len ${prevJeepLeg.coordinates.length}) currently ends at: ${JSON.stringify(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length - 1])} (intended full route end index: ${prevJeepLeg.jeepLegFullRouteEndIndex})`);

            if (prevJeepRouteDef && prevJeepRouteDef.coordinates.length > 1 && currentWalkLeg.coordinates.length > 0 && typeof prevJeepLeg.jeepLegFullRouteEndIndex === 'number') {
                let actualNewAlightPointForJeep: Coordinate | null = null;
                const truePlannedAlightVertexIdxOnFullRoute = prevJeepLeg.jeepLegFullRouteEndIndex;

                for (let k = 0; k < Math.min(currentWalkLeg.coordinates.length, OVERLAP_WALK_POINTS_TO_CHECK_V7); k++) {
                    const walkPoint = currentWalkLeg.coordinates[k];
                    const { pointOnPolyline: closestJeepPointToWalk, segmentIndex: jeepSegmentIdx } =
                        findNearestPointOnRoute(walkPoint, prevJeepRouteDef);

                    let jeepVertexIdxOfClosestOverlap = jeepSegmentIdx;
                    if (jeepSegmentIdx + 1 < prevJeepRouteDef.coordinates.length &&
                        calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx + 1]) <
                        calculateDistance(closestJeepPointToWalk, prevJeepRouteDef.coordinates[jeepSegmentIdx])) {
                        jeepVertexIdxOfClosestOverlap = jeepSegmentIdx + 1;
                    }
                    jeepVertexIdxOfClosestOverlap = Math.max(0, Math.min(jeepVertexIdxOfClosestOverlap, prevJeepRouteDef.coordinates.length - 1));

                    console.log(`    [Overlap Cut v7] Walk point ${k} (${JSON.stringify(walkPoint)}) is close to jeep vertex ${jeepVertexIdxOfClosestOverlap} (${JSON.stringify(prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap])}) on full route.`);

                    if (calculateDistance(walkPoint, prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap]) < OVERLAP_CUT_THRESHOLD_METERS &&
                        jeepVertexIdxOfClosestOverlap < truePlannedAlightVertexIdxOnFullRoute) {
                        actualNewAlightPointForJeep = prevJeepRouteDef.coordinates[jeepVertexIdxOfClosestOverlap];
                        console.log(`      [Overlap Cut v7 DETECTED!] Overshoot. New candidate alight: ${JSON.stringify(actualNewAlightPointForJeep)} (index ${jeepVertexIdxOfClosestOverlap} on full route). Original intended full route end index: ${truePlannedAlightVertexIdxOnFullRoute}.`);
                        break;
                    }
                }

                if (actualNewAlightPointForJeep) {
                    const originalWalkEndTarget = currentWalkLeg.coordinates[currentWalkLeg.coordinates.length - 1];
                    const newWalkLegFromCut = await getWalkingDirections(actualNewAlightPointForJeep, originalWalkEndTarget);
                    const oldWalkDist = typeof currentWalkLeg.distance === 'number' ? currentWalkLeg.distance : calculateDistanceOfPolyline(currentWalkLeg.coordinates);
                    const newWalkDist = typeof newWalkLegFromCut?.distance === 'number' ? newWalkLegFromCut.distance : Infinity;

                    if (newWalkLegFromCut && (newWalkDist < oldWalkDist - REFINE_MIN_WALK_SAVING_METERS / 2 || oldWalkDist < OVERLAP_CUT_THRESHOLD_METERS * 1.5)) { // More lenient to apply cut
                        console.log(`      [Overlap Cut v7 APPLIED] Trimming jeep ${prevJeepLeg.routeName}. New alight: ${JSON.stringify(actualNewAlightPointForJeep)}. Old walk: ${oldWalkDist.toFixed(0)}m, New walk: ${newWalkDist.toFixed(0)}m.`);
                        const prevJeepLegOriginalStartCoord = prevJeepLeg.coordinates[0]; // This should be correct
                        prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLegOriginalStartCoord, actualNewAlightPointForJeep);
                        prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                        prevJeepLeg.jeepAlightingPointInfo = `Alight from ${prevJeepLeg.routeName} (overlap cut v7)`;
                        // Update the full route end index for the jeep leg as well
                        const { segmentIndex: newAlightSegIdx } = findNearestPointOnRoute(actualNewAlightPointForJeep, prevJeepRouteDef);
                        let newAlightVtxIdx = newAlightSegIdx;
                        if (newAlightSegIdx + 1 < prevJeepRouteDef.coordinates.length && calculateDistance(actualNewAlightPointForJeep, prevJeepRouteDef.coordinates[newAlightSegIdx+1]) < calculateDistance(actualNewAlightPointForJeep, prevJeepRouteDef.coordinates[newAlightSegIdx])) { newAlightVtxIdx++;}
                        prevJeepLeg.jeepLegFullRouteEndIndex = Math.max(0, Math.min(newAlightVtxIdx, prevJeepRouteDef.coordinates.length -1));


                        refinedLegs[i] = newWalkLegFromCut;
                        if(refinedLegs[i]) refinedLegs[i].jeepBoardingPointInfo = `Walk from ${prevJeepLeg.routeName} (overlap cut v7)`;
                    } else {
                        console.log(`  [Overlap Cut v7] New walk from cut point not applied. Old: ${oldWalkDist.toFixed(0)}m, New: ${newWalkDist.toFixed(0)}m. Identified earlier alight: ${JSON.stringify(actualNewAlightPointForJeep)}`);
                    }
                } else {
                    console.log(`  [Overlap Cut v7] No backtrack/overshoot overlap detected for walk leg ${i}.`);
                }
            }
        }
        // --- End of "Overlap Cut v7" ---

        const legToRefine = refinedLegs[i];
        if (legToRefine.type === 'walk') {
            const originalWalkDistance = typeof legToRefine.distance === 'number' ? legToRefine.distance : calculateDistanceOfPolyline(legToRefine.coordinates);
            if (originalWalkDistance === Infinity && (!legToRefine.coordinates || legToRefine.coordinates.length < 2)) {
                console.log(`  [Refine - General] Skipping leg ${i} (${legToRefine.type}), invalid original walk.`);
                continue;
            }
            let bestRefinedWalkLeg: PlannedTripLeg | null = null;
            let currentBestRefinedWalkDistance = originalWalkDistance;
            let bestNewPrevJeepAlightPoint: Coordinate | null = null;
            let bestNewNextJeepBoardPoint: Coordinate | null = null;
            let generalRefinementMade = false;

            if (i === 0 && refinedLegs.length > 1 && refinedLegs[i+1]?.type === 'jeepney') {
                const firstJeepLeg = refinedLegs[i+1];
                const firstJeepRouteDef = getJeepneyRouteById(firstJeepLeg.routeId!);
                if (!firstJeepRouteDef || !firstJeepRouteDef.coordinates || firstJeepRouteDef.coordinates.length < 2) continue;
                const tripOrigin = legToRefine.coordinates[0];
                
                let originalBoardVertexIdx = firstJeepLeg.jeepLegFullRouteStartIndex;
                if (typeof originalBoardVertexIdx !== 'number') {
                    console.warn(`  [Refine - General Initial] Missing jeepLegFullRouteStartIndex for firstJeepLeg ${firstJeepLeg.routeName}. Falling back.`);
                    const {segmentIndex: fbSegIdx} = findNearestPointOnRoute(firstJeepLeg.coordinates[0], firstJeepRouteDef);
                    originalBoardVertexIdx = fbSegIdx; // Simplified fallback
                     if (originalBoardVertexIdx + 1 < firstJeepRouteDef.coordinates.length && calculateDistance(firstJeepLeg.coordinates[0], firstJeepRouteDef.coordinates[originalBoardVertexIdx + 1]) < calculateDistance(firstJeepLeg.coordinates[0], firstJeepRouteDef.coordinates[originalBoardVertexIdx])) { originalBoardVertexIdx++;}
                }
                originalBoardVertexIdx = Math.max(0, Math.min(originalBoardVertexIdx ?? 0, firstJeepRouteDef.coordinates.length - 1));
                console.log(`  [Refine - General] Initial walk to ${firstJeepLeg.routeName}, dist: ${originalWalkDistance.toFixed(0)}m. Using planned jeepBoardVertexIdx: ${originalBoardVertexIdx}`);
                const candidateBoardPoints = getCoordinatesInSearchWindow(firstJeepRouteDef.coordinates, originalBoardVertexIdx, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                
                for (const candidateBoard of candidateBoardPoints) {
                    const newWalk = await getWalkingDirections(tripOrigin, candidateBoard);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                    if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_WALK_TO_JEEP_METERS) {
                        if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.90) {
                            currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk; bestNewNextJeepBoardPoint = candidateBoard; generalRefinementMade = true;
                            console.log(`    [Refine Initial Walk] Better board for ${firstJeepLeg.routeName}. New walk: ${newWalkDist.toFixed(0)}m`);
                        }
                    }
                }
                if (generalRefinementMade && bestRefinedWalkLeg && bestNewNextJeepBoardPoint) {
                    refinedLegs[i] = bestRefinedWalkLeg;
                    const {segmentIndex: newBoardSegIdx} = findNearestPointOnRoute(bestNewNextJeepBoardPoint, firstJeepRouteDef);
                    let newBoardVtxIdx = newBoardSegIdx;
                    if(newBoardSegIdx + 1 < firstJeepRouteDef.coordinates.length && calculateDistance(bestNewNextJeepBoardPoint, firstJeepRouteDef.coordinates[newBoardSegIdx+1]) < calculateDistance(bestNewNextJeepBoardPoint, firstJeepRouteDef.coordinates[newBoardSegIdx])) {newBoardVtxIdx++;}
                    firstJeepLeg.jeepLegFullRouteStartIndex = Math.max(0, Math.min(newBoardVtxIdx, firstJeepRouteDef.coordinates.length -1));

                    firstJeepLeg.coordinates = trimJeepLeg(firstJeepRouteDef.coordinates, bestNewNextJeepBoardPoint, firstJeepLeg.coordinates[firstJeepLeg.coordinates.length - 1]);
                    firstJeepLeg.distance = calculateDistanceOfPolyline(firstJeepLeg.coordinates);
                    firstJeepLeg.jeepBoardingPointInfo = `Board ${firstJeepLeg.routeName} (refined)`;
                }
            }
            else if (i > 0 && refinedLegs[i-1]?.type === 'jeepney') {
                const prevJeepLeg = refinedLegs[i-1];
                const prevJeepRouteDef = getJeepneyRouteById(prevJeepLeg.routeId!);
                if (!prevJeepRouteDef || !prevJeepRouteDef.coordinates || prevJeepRouteDef.coordinates.length < 2) continue;

                let originalAlightVertexIdx = prevJeepLeg.jeepLegFullRouteEndIndex;
                 if (typeof originalAlightVertexIdx !== 'number') {
                    console.warn(`  [Refine - General Transfer/Final] Missing jeepLegFullRouteEndIndex for prevJeepLeg ${prevJeepLeg.routeName}. Falling back.`);
                    const {segmentIndex: fbSegIdx} = findNearestPointOnRoute(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef);
                    originalAlightVertexIdx = fbSegIdx; // Simplified fallback
                    if (originalAlightVertexIdx + 1 < prevJeepRouteDef.coordinates.length && calculateDistance(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef.coordinates[originalAlightVertexIdx + 1]) < calculateDistance(prevJeepLeg.coordinates[prevJeepLeg.coordinates.length-1], prevJeepRouteDef.coordinates[originalAlightVertexIdx])) { originalAlightVertexIdx++;}
                }
                originalAlightVertexIdx = Math.max(0, Math.min(originalAlightVertexIdx ?? 0, prevJeepRouteDef.coordinates.length - 1));
                console.log(`  [Refine - General] Walk leg ${i} after jeep ${prevJeepLeg.routeName}. Using planned jeepAlightVertexIdx: ${originalAlightVertexIdx}.`);
                const candidateAlightPoints = getCoordinatesInSearchWindow(prevJeepRouteDef.coordinates, originalAlightVertexIdx, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                
                if (i === refinedLegs.length - 1 || refinedLegs[i+1]?.type !== 'jeepney') {
                    console.log(`    [Refine - General] Final walk from ${prevJeepLeg.routeName}, current dist: ${originalWalkDistance.toFixed(0)}m`);
                    for (const candidateAlight of candidateAlightPoints) {
                        const newWalk = await getWalkingDirections(candidateAlight, finalDestination);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                        if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < MAX_FINAL_WALK_METERS) {
                            if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.85) {
                                currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk; bestNewPrevJeepAlightPoint = candidateAlight; generalRefinementMade = true;
                                console.log(`      [Refine Final Walk] Better alight from ${prevJeepLeg.routeName}. New walk: ${newWalkDist.toFixed(0)}m`);
                                if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) break;
                            }
                        }
                    }
                    if (generalRefinementMade && bestRefinedWalkLeg && bestNewPrevJeepAlightPoint) {
                        console.log(`    [Refine - General] APPLYING to final walk. New prev alight: ${JSON.stringify(bestNewPrevJeepAlightPoint)}`);
                        refinedLegs[i] = bestRefinedWalkLeg;
                        const {segmentIndex: newAlightSegIdx} = findNearestPointOnRoute(bestNewPrevJeepAlightPoint, prevJeepRouteDef);
                        let newAlightVtxIdx = newAlightSegIdx;
                        if(newAlightSegIdx + 1 < prevJeepRouteDef.coordinates.length && calculateDistance(bestNewPrevJeepAlightPoint, prevJeepRouteDef.coordinates[newAlightSegIdx+1]) < calculateDistance(bestNewPrevJeepAlightPoint, prevJeepRouteDef.coordinates[newAlightSegIdx])) {newAlightVtxIdx++;}
                        prevJeepLeg.jeepLegFullRouteEndIndex = Math.max(0, Math.min(newAlightVtxIdx, prevJeepRouteDef.coordinates.length -1));

                        prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], bestNewPrevJeepAlightPoint);
                        prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                        prevJeepLeg.jeepAlightingPointInfo = `Alight for final walk (refined)`;
                    }
                }
                else if (refinedLegs[i+1]?.type === 'jeepney') {
                    const nextJeepLeg = refinedLegs[i+1];
                    const nextJeepRouteDef = getJeepneyRouteById(nextJeepLeg.routeId!);
                    if (!nextJeepRouteDef || !nextJeepRouteDef.coordinates || nextJeepRouteDef.coordinates.length < 2) continue;
                    
                    let originalBoardVertexIdx = nextJeepLeg.jeepLegFullRouteStartIndex;
                    if(typeof originalBoardVertexIdx !== 'number') {
                        console.warn(`  [Refine - General Transfer] Missing jeepLegFullRouteStartIndex for nextJeepLeg ${nextJeepLeg.routeName}. Falling back.`);
                        const {segmentIndex: fbSegIdx} = findNearestPointOnRoute(nextJeepLeg.coordinates[0], nextJeepRouteDef);
                        originalBoardVertexIdx = fbSegIdx;
                        if (originalBoardVertexIdx + 1 < nextJeepRouteDef.coordinates.length && calculateDistance(nextJeepLeg.coordinates[0], nextJeepRouteDef.coordinates[originalBoardVertexIdx + 1]) < calculateDistance(nextJeepLeg.coordinates[0], nextJeepRouteDef.coordinates[originalBoardVertexIdx])) { originalBoardVertexIdx++;}
                    }
                    originalBoardVertexIdx = Math.max(0, Math.min(originalBoardVertexIdx ?? 0, nextJeepRouteDef.coordinates.length - 1));
                    console.log(`    [Refine - General] Transfer walk from ${prevJeepLeg.routeName} to ${nextJeepLeg.routeName}, current dist: ${originalWalkDistance.toFixed(0)}m. Using planned nextJeepBoardVertexIdx: ${originalBoardVertexIdx}`);
                    const candidateBoardPoints = getCoordinatesInSearchWindow(nextJeepRouteDef.coordinates, originalBoardVertexIdx, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                    
                    let foundShortTransfer = false;
                    for (const cAlight of candidateAlightPoints) {
                        for (const cBoard of candidateBoardPoints) {
                            const newWalk = await getWalkingDirections(cAlight, cBoard);
                            const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                            if (newWalk && newWalkDist < currentBestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                                if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.85) {
                                    currentBestRefinedWalkDistance = newWalkDist; bestRefinedWalkLeg = newWalk; bestNewPrevJeepAlightPoint = cAlight; bestNewNextJeepBoardPoint = cBoard; generalRefinementMade = true;
                                    console.log(`      [Refine Transfer] Better walk. New: ${newWalkDist.toFixed(0)}m`);
                                    if (currentBestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) { foundShortTransfer = true; break; }
                                }
                            }
                        }
                        if (foundShortTransfer) break;
                    }
                    if (generalRefinementMade && bestRefinedWalkLeg && bestNewPrevJeepAlightPoint && bestNewNextJeepBoardPoint) {
                         console.log(`    [Refine - General] APPLYING to transfer walk. New prev alight: ${JSON.stringify(bestNewPrevJeepAlightPoint)}, new next board: ${JSON.stringify(bestNewNextJeepBoardPoint)}`);
                        refinedLegs[i] = bestRefinedWalkLeg;
                        
                        const {segmentIndex: newAlightSegIdx} = findNearestPointOnRoute(bestNewPrevJeepAlightPoint, prevJeepRouteDef);
                        let newAlightVtxIdx = newAlightSegIdx;
                        if(newAlightSegIdx + 1 < prevJeepRouteDef.coordinates.length && calculateDistance(bestNewPrevJeepAlightPoint, prevJeepRouteDef.coordinates[newAlightSegIdx+1]) < calculateDistance(bestNewPrevJeepAlightPoint, prevJeepRouteDef.coordinates[newAlightSegIdx])) {newAlightVtxIdx++;}
                        prevJeepLeg.jeepLegFullRouteEndIndex = Math.max(0, Math.min(newAlightVtxIdx, prevJeepRouteDef.coordinates.length -1));
                        prevJeepLeg.coordinates = trimJeepLeg(prevJeepRouteDef.coordinates, prevJeepLeg.coordinates[0], bestNewPrevJeepAlightPoint);
                        prevJeepLeg.distance = calculateDistanceOfPolyline(prevJeepLeg.coordinates);
                        prevJeepLeg.jeepAlightingPointInfo = `Alight for transfer to ${nextJeepLeg.routeName} (refined)`;
                        
                        const {segmentIndex: newBoardSegIdx} = findNearestPointOnRoute(bestNewNextJeepBoardPoint, nextJeepRouteDef);
                        let newBoardVtxIdx = newBoardSegIdx;
                        if(newBoardSegIdx + 1 < nextJeepRouteDef.coordinates.length && calculateDistance(bestNewNextJeepBoardPoint, nextJeepRouteDef.coordinates[newBoardSegIdx+1]) < calculateDistance(bestNewNextJeepBoardPoint, nextJeepRouteDef.coordinates[newBoardSegIdx])) {newBoardVtxIdx++;}
                        nextJeepLeg.jeepLegFullRouteStartIndex = Math.max(0, Math.min(newBoardVtxIdx, nextJeepRouteDef.coordinates.length -1));
                        nextJeepLeg.coordinates = trimJeepLeg(nextJeepRouteDef.coordinates, bestNewNextJeepBoardPoint, nextJeepLeg.coordinates[nextJeepLeg.coordinates.length-1]);
                        nextJeepLeg.distance = calculateDistanceOfPolyline(nextJeepLeg.coordinates);
                        nextJeepLeg.jeepBoardingPointInfo = `Board ${nextJeepLeg.routeName} (refined)`;
                    }
                }
            }
        }
    }
    console.log("[Refine END - Overlap Cut v7 + Segment Aware General Refinement]");
    return refinedLegs;
}


function getCoordinatesInSearchWindow(
    routeCoordinates: Coordinate[],
    centerVertexIndex: number,
    searchRadiusMeters: number,
    minSeparationMeters: number
): Coordinate[] {
    const results: Coordinate[] = [];
    if (!routeCoordinates || routeCoordinates.length === 0 || centerVertexIndex < 0 || centerVertexIndex >= routeCoordinates.length) {
        return results;
    }

    const centerPoint = routeCoordinates[centerVertexIndex];
    results.push(centerPoint);
    let lastAddedPointBackward = centerPoint;
    let lastAddedPointForward = centerPoint;

    let distBackward = 0;
    for (let i = centerVertexIndex - 1; i >= 0; i--) {
        if (i + 1 >= routeCoordinates.length || i < 0 ) break; 
        distBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (distBackward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointBackward) >= minSeparationMeters) {
            results.push(routeCoordinates[i]);
            lastAddedPointBackward = routeCoordinates[i];
        }
    }
    let distForward = 0;
    for (let i = centerVertexIndex + 1; i < routeCoordinates.length; i++) {
        if (i - 1 < 0 || i >= routeCoordinates.length ) break; 
        distForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (distForward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPointForward) >= minSeparationMeters) {
            results.push(routeCoordinates[i]);
            lastAddedPointForward = routeCoordinates[i];
        }
    }
    return results;
}

function trimJeepLeg(
    fullRouteCoords: Coordinate[], newStartCoord: Coordinate, newEndCoord: Coordinate
): Coordinate[] {
    let startVertexIndex = 0;
    let minDistStart = Infinity;
    if (fullRouteCoords.length === 0) {
        console.warn("trimJeepLeg called with empty fullRouteCoords.");
        return [newStartCoord, newEndCoord];
    }

    for (let i = 0; i < fullRouteCoords.length; i++) {
        const dist = calculateDistance(newStartCoord, fullRouteCoords[i]);
        if (dist < minDistStart) {
            minDistStart = dist;
            startVertexIndex = i;
        }
    }

    let endVertexIndex = startVertexIndex;
    let minDistEnd = calculateDistance(fullRouteCoords[startVertexIndex] || newStartCoord, newEndCoord);

    for (let i = startVertexIndex; i < fullRouteCoords.length; i++) { // Prefer forward search for end
        const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
        if (dist < minDistEnd) {
            minDistEnd = dist;
            endVertexIndex = i;
        }
    }
    // If end point is still before start or poorly matched after forward search, do a global search
    if (endVertexIndex < startVertexIndex || minDistEnd > ALIGHTING_POINT_SEARCH_TOLERANCE_METERS * 1.5) {
        console.log(`  trimJeepLeg: End vertex (idx ${endVertexIndex}) might be before start (idx ${startVertexIndex}) or poorly matched (dist ${minDistEnd.toFixed(0)}m). Global search for end vertex.`);
        let globalMinDistEnd = minDistEnd; // Initialize with current best
        let globalEndVertexIndex = endVertexIndex;
        for (let i = 0; i < fullRouteCoords.length; i++) { // Global search
            const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
            if (dist < globalMinDistEnd) {
                globalMinDistEnd = dist;
                globalEndVertexIndex = i;
            }
        }
        if (globalEndVertexIndex !== -1 && globalMinDistEnd < minDistEnd ) { // Only use global if it's better
            console.log(`  trimJeepLeg: Global search found better end vertex ${globalEndVertexIndex} (dist ${globalMinDistEnd.toFixed(0)}m). Original forward search end: ${endVertexIndex} (dist ${minDistEnd.toFixed(0)}m).`);
            endVertexIndex = globalEndVertexIndex;
        } else {
             console.log(`  trimJeepLeg: Global search did not find a better end point or original forward search was acceptable.`);
        }
    }


    console.log(`  trimJeepLeg: Determined startVertexIndex: ${startVertexIndex}, endVertexIndex: ${endVertexIndex}`);
    let trimmedCoordinates: Coordinate[];
    if (startVertexIndex <= endVertexIndex) {
        trimmedCoordinates = fullRouteCoords.slice(startVertexIndex, endVertexIndex + 1);
    } else {
        console.warn(`  trimJeepLeg: Fallback - final startVertexIndex ${startVertexIndex} > endVertexIndex ${endVertexIndex}. Using direct points.`);
        trimmedCoordinates = [newStartCoord, newEndCoord];
    }

    if (trimmedCoordinates.length > 0) {
        trimmedCoordinates[0] = newStartCoord;
        trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord;
    } else {
        trimmedCoordinates = [newStartCoord];
        if (calculateDistance(newStartCoord, newEndCoord) > 1) trimmedCoordinates.push(newEndCoord);
    }
    return trimmedCoordinates.length >= 2 ? trimmedCoordinates : (calculateDistance(newStartCoord, newEndCoord) < 1 ? [newStartCoord] : [newStartCoord, newEndCoord]);
}


function calculateDistanceOfPolyline(polyline: Coordinate[]): number {
    let totalDistance = 0;
    if (!polyline || polyline.length < 2) return 0;
    for (let i = 0; i < polyline.length - 1; i++) {
        totalDistance += calculateDistance(polyline[i], polyline[i+1]);
    }
    return totalDistance;
}

export async function planTripWithDrivingGuide(
  origin: Coordinate,
  destination: Coordinate
): Promise<Array<PlannedTripLeg[]>> {
  console.log(`[PlanTrip V-SegmentAware START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);

  if (!getJeepneySpatialIndex()) initializeJeepneySpatialIndex();

  const drivingPathLeg = await getDrivingDirections(origin, destination);
  if (!drivingPathLeg || !drivingPathLeg.coordinates || drivingPathLeg.coordinates.length === 0) {
    console.warn("Failed to get driving directions guide. Attempting direct walk.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  const desiredPathPolyline: Coordinate[] = drivingPathLeg.coordinates;
  console.log(`  Got desired driving path with ${desiredPathPolyline.length} points.`);

  let plannedLegs: PlannedTripLeg[] = [];
  let currentLocation = origin;
  let currentDesiredPathIndex = 0;
  let lastJeepRouteIdTaken: string | undefined = undefined;
  let consecutiveShortJeepLegsOnSameRoute = 0;

  const MAX_TRIP_LEGS = 15;

  for (let legCount = 0; legCount < MAX_TRIP_LEGS; legCount++) {
    if (calculateDistance(currentLocation, destination) < 100) {
      console.log("  Reached destination or very close.");
      break;
    }
    if (currentDesiredPathIndex >= desiredPathPolyline.length - 1 && desiredPathPolyline.length > 0) {
         console.log("  Reached end of desired path guide, attempting final walk.");
         const finalWalk = await getWalkingDirections(currentLocation, destination);
         if (finalWalk) { plannedLegs.push(finalWalk); }
         currentLocation = destination; break;
    }

    console.log(`  Leg ${legCount + 1}: Current loc ${JSON.stringify(currentLocation)}, desiredPathIdx ${currentDesiredPathIndex}`);

    const alignedJeepInfo = findBestAlignedJeepney(
      currentLocation, desiredPathPolyline, currentDesiredPathIndex, MAX_WALK_TO_JEEP_METERS, destination
    );

    if (alignedJeepInfo) {
        if (alignedJeepInfo.jeepRoute.id === lastJeepRouteIdTaken &&
            calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 50 &&
            calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS) {
            consecutiveShortJeepLegsOnSameRoute++;
            if (consecutiveShortJeepLegsOnSameRoute > 1) {
                console.log("    Skipping short re-board, forcing walk along desired path.");
                const nextSignificantDpIdx = Math.min(currentDesiredPathIndex + 5, desiredPathPolyline.length - 1);
                if (nextSignificantDpIdx > currentDesiredPathIndex) {
                    const forcedWalk = await getWalkingDirections(currentLocation, desiredPathPolyline[nextSignificantDpIdx]);
                    if (forcedWalk && forcedWalk.coordinates.length > 1) {
                        plannedLegs.push(forcedWalk); currentLocation = forcedWalk.coordinates.slice(-1)[0];
                        currentDesiredPathIndex = nextSignificantDpIdx; lastJeepRouteIdTaken = undefined;
                        consecutiveShortJeepLegsOnSameRoute = 0; continue;
                    }
                }
            }
        } else {
            consecutiveShortJeepLegsOnSameRoute = 0;
        }

      const walkToBoardLeg = await getWalkingDirections(currentLocation, alignedJeepInfo.boardingPointOnJeep);
      const walkDistanceToBoard = typeof walkToBoardLeg?.distance === 'number' ? walkToBoardLeg.distance : Infinity;

      if (walkToBoardLeg && walkDistanceToBoard < MAX_WALK_TO_JEEP_METERS * 1.2) {
        if (walkDistanceToBoard > 10) {
            plannedLegs.push(walkToBoardLeg);
        }
        currentLocation = alignedJeepInfo.boardingPointOnJeep;
        console.log(`      Added walk to ${alignedJeepInfo.jeepRoute.name}.`);

        const jeepRideCoordinates: Coordinate[] = [];
        const fullCurrentJeepRoute = getJeepneyRouteById(alignedJeepInfo.jeepRoute.id);

        if (fullCurrentJeepRoute && fullCurrentJeepRoute.coordinates.length > 1) {
            let { jeepBoardingVertexIndex, jeepAlightingVertexIndex } = alignedJeepInfo;
            const targetAlightCoordinate = alignedJeepInfo.alightPointOnJeep;

            if (jeepAlightingVertexIndex < jeepBoardingVertexIndex && jeepBoardingVertexIndex < fullCurrentJeepRoute.coordinates.length) {
                console.warn(`Loop Alight Correction: Initial alightIdx ${jeepAlightingVertexIndex} < boardIdx ${jeepBoardingVertexIndex} for ${alignedJeepInfo.jeepRoute.name}. Searching for later instance of alight point near ${JSON.stringify(targetAlightCoordinate)}.`);
                let foundLaterCorrectedAlightIdx = -1;
                let minDistanceToLaterAlight = Infinity;

                for (let k = jeepBoardingVertexIndex + 1; k < fullCurrentJeepRoute.coordinates.length; k++) {
                    const distToTarget = calculateDistance(fullCurrentJeepRoute.coordinates[k], targetAlightCoordinate);
                    if (distToTarget < ALIGHTING_POINT_SEARCH_TOLERANCE_METERS) {
                        if (alignedJeepInfo.desiredPathEndIndex < desiredPathPolyline.length &&
                            calculateDistance(fullCurrentJeepRoute.coordinates[k], desiredPathPolyline[alignedJeepInfo.desiredPathEndIndex]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS * 1.5) {
                            if (distToTarget < minDistanceToLaterAlight) {
                                minDistanceToLaterAlight = distToTarget;
                                foundLaterCorrectedAlightIdx = k;
                            }
                        }
                    }
                }
                if (foundLaterCorrectedAlightIdx !== -1) {
                    console.log(`   Found and corrected later alighting point for ${alignedJeepInfo.jeepRoute.name} at index ${foundLaterCorrectedAlightIdx}.`);
                    jeepAlightingVertexIndex = foundLaterCorrectedAlightIdx;
                } else {
                    console.warn(`   Could not find a suitable later alighting point for ${alignedJeepInfo.jeepRoute.name}. Using originally traced alight index ${alignedJeepInfo.jeepAlightingVertexIndex}.`);
                }
            }

            if (jeepBoardingVertexIndex <= jeepAlightingVertexIndex) {
                jeepRideCoordinates.push(...fullCurrentJeepRoute.coordinates.slice(jeepBoardingVertexIndex, jeepAlightingVertexIndex + 1));
            } else {
                console.warn(`      Jeep segment for ${alignedJeepInfo.jeepRoute.name} has boardIdx ${jeepBoardingVertexIndex} > alightIdx ${jeepAlightingVertexIndex} even after loop check. This will likely be a very short/invalid segment. Using direct points.`);
                jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
                if (calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) {
                    jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
                }
            }

            if (jeepRideCoordinates.length > 0) {
                jeepRideCoordinates[0] = alignedJeepInfo.boardingPointOnJeep;
                jeepRideCoordinates[jeepRideCoordinates.length - 1] = alignedJeepInfo.alightPointOnJeep;
            } else {
                 jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
                 if (calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) {
                    jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
                 }
            }
             if (jeepRideCoordinates.length === 1 && calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) {
                jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
            }
        } else {
             console.warn(`    Full route details not found for ${alignedJeepInfo.jeepRoute.name}. Using direct points.`);
             jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
             if(calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) {
                jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
             }
        }

        if (jeepRideCoordinates.length >= 2 && calculateDistanceOfPolyline(jeepRideCoordinates) > MIN_JEEP_RIDE_PROGRESS_METERS * 0.5) {
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
                distance: calculateDistanceOfPolyline(jeepRideCoordinates),
                duration: (calculateDistanceOfPolyline(jeepRideCoordinates) / (15 * 1000 / 3600)),
                jeepBoardingPointInfo: `Board ${alignedJeepInfo.jeepRoute.name}`,
                jeepAlightingPointInfo: `Alight from ${alignedJeepInfo.jeepRoute.name}`,
                jeepLegFullRouteStartIndex: alignedJeepInfo.jeepBoardingVertexIndex, // Store this
                jeepLegFullRouteEndIndex: alignedJeepInfo.jeepAlightingVertexIndex,   // Store this
            };
            plannedLegs.push(jeepRideLeg);
            currentLocation = alignedJeepInfo.alightPointOnJeep;
            currentDesiredPathIndex = alignedJeepInfo.desiredPathEndIndex;
            lastJeepRouteIdTaken = alignedJeepInfo.jeepRoute.id;
            console.log(`      Added ride on ${alignedJeepInfo.jeepRoute.name}. New loc: ${JSON.stringify(currentLocation)}. Desired path idx: ${currentDesiredPathIndex}. Full route indices: ${jeepRideLeg.jeepLegFullRouteStartIndex} to ${jeepRideLeg.jeepLegFullRouteEndIndex}`);
          } else {
             console.log(`      Jeep ride for ${alignedJeepInfo.jeepRoute.name} too short/invalid (Length: ${jeepRideCoordinates.length}, Dist: ${calculateDistanceOfPolyline(jeepRideCoordinates).toFixed(0)}m). Attempting final walk.`);
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        console.log("      Walk to board too long/failed. Attempting final walk.");
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk) plannedLegs.push(finalWalk);
        currentLocation = destination; break;
      }
    } else {
      console.log("    No suitable aligned jeep found. Attempting final walk.");
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk) { plannedLegs.push(finalWalk); }
      currentLocation = destination; break;
    }
  }

  if (plannedLegs.length > 0) {
      const lastActualLegEnd = plannedLegs[plannedLegs.length -1].coordinates.slice(-1)[0];
      if (lastActualLegEnd && calculateDistance(lastActualLegEnd, destination) > 20) {
          console.log("  Adding final walk segment from last leg's end to actual destination.");
          const finalConnectionWalk = await getWalkingDirections(lastActualLegEnd, destination);
          if (finalConnectionWalk && (typeof finalConnectionWalk.distance === 'number' ? finalConnectionWalk.distance : 0) > 10) {
            plannedLegs.push(finalConnectionWalk);
          }
      }
  } else if (calculateDistance(origin, destination) > 20) {
       console.log("  No legs planned, creating a direct walk as fallback.");
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback) { plannedLegs.push(directWalkFallback); }
  }

  console.log(`[PlanTrip V-SegmentAware END] Found ${plannedLegs.length} legs before refinement.`);
  const refinedSolution = await refineTripLegs(plannedLegs, destination);
  return refinedSolution.length > 0 ? [refinedSolution] : [];
}

export { planTripWithDrivingGuide as planTrip };
