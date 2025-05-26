// pasada-gemini/modules/map/services/tripPlannerServices.ts
import {
  Coordinate,
  PlannedTripLeg,
  JeepneyRoute,
} from '../utils/routeTypes';
import {
  allJeepneyRoutes, 
  findNearbyRouteSegments, 
  initializeJeepneySpatialIndex,
  getJeepneySpatialIndex,
  getJeepneyRouteById,
} from './jeepneyDataService';
import {
  getWalkingDirections,
  getDrivingDirections, 
  calculateDistance,
  findNearestPointOnRoute,
} from './mapApiServices';

const MAX_WALK_TO_JEEP_METERS = 700; 
const MAX_FINAL_WALK_METERS = 1500;
const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 200; 
const MIN_JEEP_RIDE_PROGRESS_METERS = 300; 
const DESIRED_PATH_SEARCH_AHEAD_METERS = 500;
const DIVERGENCE_THRESHOLD_METERS = 250;

// Constants for refinement optimization
const REFINE_SEARCH_RADIUS_METERS = 150; // Reduced search radius
const REFINE_MIN_WALK_SAVING_METERS = 30; // Min saving to consider a refinement valid
const REFINE_MAX_WALK_FOR_CONNECTION = 500; // Max walk for a refined transfer
const MIN_CANDIDATE_SEPARATION_METERS = 30; // Select candidate points at least this far apart
const REFINE_EARLY_EXIT_WALK_THRESHOLD = 10; // If refined walk is already this short, stop optimizing it further


interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate;
  alightPointOnJeep: Coordinate;
  desiredPathStartIndex: number;
  desiredPathEndIndex: number; 
  walkToBoardingDistance: number;
}

// Original findBestAlignedJeepney from user's provided file
function findBestAlignedJeepney(
    actualCurrentLocation: Coordinate, 
    desiredPathPolyline: Coordinate[],
    currentDesiredPathIndex: number, 
    maxWalkToBoard: number
): AlignedJeepInfo | null {
    console.log(`  findBestAlignedJeepney (original): actualCurrentLoc ${JSON.stringify(actualCurrentLocation)}, desiredPathIdx ${currentDesiredPathIndex}`);
    let bestOption: AlignedJeepInfo | null = null;
    let bestOptionScore = -Infinity; 

    let desiredPathSearchEndIndex = currentDesiredPathIndex;
    let cumulativeDesiredPathSearchDistance = 0;
    for (let dpIdx = currentDesiredPathIndex; dpIdx < desiredPathPolyline.length -1; dpIdx++) {
        desiredPathSearchEndIndex = dpIdx + 1;
        if (dpIdx > currentDesiredPathIndex) {
            cumulativeDesiredPathSearchDistance += calculateDistance(desiredPathPolyline[dpIdx-1], desiredPathPolyline[dpIdx]);
        }
        if (cumulativeDesiredPathSearchDistance > DESIRED_PATH_SEARCH_AHEAD_METERS) break; 

        const pointOnDesiredPath = desiredPathPolyline[dpIdx];
        const nearbySegments = findNearbyRouteSegments(pointOnDesiredPath, ALIGNMENT_PROXIMITY_THRESHOLD_METERS);

        for (const segInfo of nearbySegments) {
            const { pointOnPolyline: potentialBoardingPoint, segmentIndex: boardingSegmentIdx, distanceToPoint: distToBoardingPoint } =
                findNearestPointOnRoute(pointOnDesiredPath, segInfo.originalRoute);

            if (distToBoardingPoint > ALIGNMENT_PROXIMITY_THRESHOLD_METERS) continue;

            const walkToBoardDist = calculateDistance(actualCurrentLocation, potentialBoardingPoint);
            if (walkToBoardDist > maxWalkToBoard) continue;

            let potentialAlightPoint = potentialBoardingPoint;
            let jeepCoversDesiredPathUpToIndex = dpIdx; 
            let lastGoodAlignmentPointOnJeep = potentialBoardingPoint;
            let jeepRideDistance = 0;

            for (let j = boardingSegmentIdx; j < segInfo.originalRoute.coordinates.length - 1; j++) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j+1];
                jeepRideDistance += calculateDistance(jeepSegStart, jeepSegEnd);

                let aligns = false;
                for (let k = jeepCoversDesiredPathUpToIndex; k < desiredPathPolyline.length; k++) {
                    if (calculateDistance(jeepSegEnd, desiredPathPolyline[k]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        aligns = true;
                        lastGoodAlignmentPointOnJeep = jeepSegEnd;
                        jeepCoversDesiredPathUpToIndex = k; 
                        break;
                    }
                     if (k > jeepCoversDesiredPathUpToIndex + 10 && calculateDistance(jeepSegEnd, desiredPathPolyline[k]) > DIVERGENCE_THRESHOLD_METERS * 1.5) { 
                        break; 
                    }
                }
                if (!aligns || jeepRideDistance > MAX_WALK_TO_JEEP_METERS * 3) { 
                    break; 
                }
                potentialAlightPoint = lastGoodAlignmentPointOnJeep;
            }
            
            const actualJeepRideDistance = calculateDistance(potentialBoardingPoint, potentialAlightPoint);

            if (actualJeepRideDistance >= MIN_JEEP_RIDE_PROGRESS_METERS) {
                const progressOnDesiredPath = jeepCoversDesiredPathUpToIndex - dpIdx;
                const score = progressOnDesiredPath - (walkToBoardDist / 100); 

                if (score > bestOptionScore) {
                    bestOptionScore = score;
                    bestOption = {
                        jeepRoute: segInfo.originalRoute,
                        boardingPointOnJeep: potentialBoardingPoint,
                        alightPointOnJeep: potentialAlightPoint,
                        desiredPathStartIndex: dpIdx,
                        desiredPathEndIndex: jeepCoversDesiredPathUpToIndex,
                        walkToBoardingDistance: walkToBoardDist
                    };
                }
            }
        }
    }
    if (bestOption) console.log(`    findBestAlignedJeepney (original) found: ${bestOption.jeepRoute.name}, walk: ${bestOption.walkToBoardingDistance.toFixed(0)}m`);
    return bestOption;
}

// --- OPTIMIZED Refinement Function ---
async function refineTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    console.log("[Refine START] Starting trip refinement process (Optimized).");
    if (legs.length < 2) {
        console.log("[Refine END] Not enough legs to refine.");
        return legs;
    }

    const refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs)); 

    for (let i = 1; i < refinedLegs.length; i++) {
        const currentLeg = refinedLegs[i];
        const prevLeg = refinedLegs[i-1];

        if (currentLeg.type === 'walk' && prevLeg.type === 'jeepney') {
            const originalWalkDistance = typeof currentLeg.distance === 'number' ? currentLeg.distance : Infinity;
            if (originalWalkDistance === Infinity && (!currentLeg.coordinates || currentLeg.coordinates.length < 2)) {
                console.log(`[Refine] Skipping leg ${i}, invalid original walk distance or coordinates.`);
                continue;
            }
            
            let bestRefinedWalk: PlannedTripLeg | null = null;
            let bestRefinedWalkDistance = originalWalkDistance;
            let bestPrevJeepAlightPoint: Coordinate | null = null;
            let bestNextJeepBoardPoint: Coordinate | null = null;
            let refinementMadeForThisLeg = false;

            const prevJeepRoute = getJeepneyRouteById(prevLeg.routeId!);
            if (!prevJeepRoute) continue;

            const originalAlightPoint = prevLeg.coordinates[prevLeg.coordinates.length - 1];
            const originalAlightIndexOnPrevJeep = findNearestPointOnRoute(originalAlightPoint, prevJeepRoute).segmentIndex;

            // Case 1: This walk is to the final destination
            if (i === refinedLegs.length - 1 || (refinedLegs[i+1] && refinedLegs[i+1].type !== 'jeepney') ) {
                console.log(`[Refine] Evaluating final walk leg ${i} from ${prevLeg.routeName}`);
                const searchWindowCoordsPrev = getCoordinatesInSearchWindow(prevJeepRoute.coordinates, originalAlightIndexOnPrevJeep, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                let foundVeryShortFinalWalk = false;

                for (const candidateAlight of searchWindowCoordsPrev) {
                    const newWalk = await getWalkingDirections(candidateAlight, finalDestination);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

                    if (newWalk && newWalkDist < bestRefinedWalkDistance && newWalkDist < MAX_FINAL_WALK_METERS) {
                         if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.85) { // Slightly more lenient for final walk
                            bestRefinedWalkDistance = newWalkDist;
                            bestRefinedWalk = newWalk;
                            bestPrevJeepAlightPoint = candidateAlight;
                            refinementMadeForThisLeg = true;
                            console.log(`  [Refine Final Walk] Better alight from ${prevLeg.routeName} found. Old walk: ${originalWalkDistance.toFixed(0)}m, New walk: ${newWalkDist.toFixed(0)}m`);
                            if (bestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) {
                                console.log("    Final walk is very short, exiting refinement for this leg early.");
                                foundVeryShortFinalWalk = true;
                                break;
                            }
                        }
                    }
                }
                if (refinementMadeForThisLeg && bestRefinedWalk && bestPrevJeepAlightPoint) {
                    refinedLegs[i] = bestRefinedWalk; 
                    const oldPrevJeepEnd = prevLeg.coordinates[prevLeg.coordinates.length -1];
                    prevLeg.coordinates = trimJeepLeg(prevJeepRoute.coordinates, prevLeg.coordinates[0], bestPrevJeepAlightPoint);
                    prevLeg.distance = calculateDistanceOfPolyline(prevLeg.coordinates); 
                    console.log(`  [Refine Final Walk] Updated prev jeep ${prevLeg.routeName} to end at ${JSON.stringify(bestPrevJeepAlightPoint)} (was ${JSON.stringify(oldPrevJeepEnd)})`);
                }
            }
            // Case 2: This walk is a transfer to another jeep
            else if (refinedLegs[i+1] && refinedLegs[i+1].type === 'jeepney') {
                const nextLeg = refinedLegs[i+1];
                const nextJeepRoute = getJeepneyRouteById(nextLeg.routeId!);
                if (!nextJeepRoute) continue;

                console.log(`[Refine] Evaluating transfer walk leg ${i} from ${prevLeg.routeName} to ${nextLeg.routeName}`);
                const originalBoardPoint = nextLeg.coordinates[0];
                const originalBoardIndexOnNextJeep = findNearestPointOnRoute(originalBoardPoint, nextJeepRoute).segmentIndex;

                const searchWindowCoordsPrev = getCoordinatesInSearchWindow(prevJeepRoute.coordinates, originalAlightIndexOnPrevJeep, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                const searchWindowCoordsNext = getCoordinatesInSearchWindow(nextJeepRoute.coordinates, originalBoardIndexOnNextJeep, REFINE_SEARCH_RADIUS_METERS, MIN_CANDIDATE_SEPARATION_METERS);
                let foundVeryShortTransferWalk = false;

                for (const candidateAlight of searchWindowCoordsPrev) {
                    for (const candidateBoard of searchWindowCoordsNext) {
                        const newWalk = await getWalkingDirections(candidateAlight, candidateBoard);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                        
                        if (newWalk && newWalkDist < bestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                             if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.85) {
                                bestRefinedWalkDistance = newWalkDist;
                                bestRefinedWalk = newWalk;
                                bestPrevJeepAlightPoint = candidateAlight;
                                bestNextJeepBoardPoint = candidateBoard;
                                refinementMadeForThisLeg = true;
                                console.log(`  [Refine Transfer] Better walk from ${prevLeg.routeName} to ${nextLeg.routeName} found. Old: ${originalWalkDistance.toFixed(0)}m, New: ${newWalkDist.toFixed(0)}m. Current Best: ${bestRefinedWalkDistance.toFixed(0)}m`);
                                if (bestRefinedWalkDistance < REFINE_EARLY_EXIT_WALK_THRESHOLD) {
                                    console.log("    Transfer walk is very short, exiting refinement for this leg early.");
                                    foundVeryShortTransferWalk = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (foundVeryShortTransferWalk) break;
                }
                if (refinementMadeForThisLeg && bestRefinedWalk && bestPrevJeepAlightPoint && bestNextJeepBoardPoint) {
                    refinedLegs[i] = bestRefinedWalk; 
                    const oldPrevJeepEnd = prevLeg.coordinates[prevLeg.coordinates.length-1];
                    prevLeg.coordinates = trimJeepLeg(prevJeepRoute.coordinates, prevLeg.coordinates[0], bestPrevJeepAlightPoint);
                    prevLeg.distance = calculateDistanceOfPolyline(prevLeg.coordinates);
                     console.log(`  [Refine Transfer] Updated prev jeep ${prevLeg.routeName} to end at ${JSON.stringify(bestPrevJeepAlightPoint)} (was ${JSON.stringify(oldPrevJeepEnd)})`);
                    const oldNextJeepStart = nextLeg.coordinates[0];
                    nextLeg.coordinates = trimJeepLeg(nextJeepRoute.coordinates, bestNextJeepBoardPoint, nextLeg.coordinates[nextLeg.coordinates.length-1]);
                    nextLeg.distance = calculateDistanceOfPolyline(nextLeg.coordinates);
                    console.log(`  [Refine Transfer] Updated next jeep ${nextLeg.routeName} to start at ${JSON.stringify(bestNextJeepBoardPoint)} (was ${JSON.stringify(oldNextJeepStart)})`);
                }
            }
        }
    }
    console.log("[Refine END] Refinement process complete (Optimized).");
    return refinedLegs;
}

// Helper function to get coordinates within a search radius along a route (Optimized for sparsity)
function getCoordinatesInSearchWindow(
    routeCoordinates: Coordinate[], 
    centerIndex: number, 
    searchRadiusMeters: number,
    minSeparation: number // New parameter
): Coordinate[] {
    const results: Coordinate[] = [];
    if (!routeCoordinates || routeCoordinates.length === 0) return results;
    
    const validCenterIndex = Math.max(0, Math.min(centerIndex, routeCoordinates.length -1));
    const centerPoint = routeCoordinates[validCenterIndex];
    if(!centerPoint) return results;
    
    results.push(centerPoint);
    let lastAddedPoint = centerPoint;

    // Search backward
    let distBackward = 0;
    for (let i = validCenterIndex - 1; i >= 0; i--) {
        if (!routeCoordinates[i+1] || !routeCoordinates[i]) break; // Should not happen with valid i
        distBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (distBackward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPoint) >= minSeparation) {
            results.push(routeCoordinates[i]);
            lastAddedPoint = routeCoordinates[i];
        }
    }
    // Search forward
    lastAddedPoint = centerPoint; // Reset for forward search
    let distForward = 0;
    for (let i = validCenterIndex + 1; i < routeCoordinates.length; i++) {
        if (!routeCoordinates[i-1] || !routeCoordinates[i]) break;
        distForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (distForward > searchRadiusMeters) break;
        if (calculateDistance(routeCoordinates[i], lastAddedPoint) >= minSeparation) {
            results.push(routeCoordinates[i]);
            lastAddedPoint = routeCoordinates[i];
        }
    }
    return results;
}

// Helper function to trim/reconstruct a jeep leg's coordinates
function trimJeepLeg(fullRouteCoords: Coordinate[], newStartCoord: Coordinate, newEndCoord: Coordinate): Coordinate[] {
    const tempRouteForFindingIndex: JeepneyRoute = { id: 'temp', name: 'temp', coordinates: fullRouteCoords };
    // findNearestPointOnRoute returns segmentIndex (index of the first point of the segment)
    // We need the index of the point itself.
    let startIndex = findNearestPointOnRoute(newStartCoord, tempRouteForFindingIndex).segmentIndex;
    let endIndex = findNearestPointOnRoute(newEndCoord, tempRouteForFindingIndex).segmentIndex;

    // Adjust to point indices. If the point is closer to the end of its segment, use segmentIndex + 1.
    if (startIndex !== -1 && startIndex + 1 < fullRouteCoords.length) {
      if (calculateDistance(newStartCoord, fullRouteCoords[startIndex+1]) < calculateDistance(newStartCoord, fullRouteCoords[startIndex])) {
        startIndex = startIndex + 1;
      }
    }
     if (endIndex !== -1 && endIndex + 1 < fullRouteCoords.length) {
      if (calculateDistance(newEndCoord, fullRouteCoords[endIndex+1]) < calculateDistance(newEndCoord, fullRouteCoords[endIndex])) {
        endIndex = endIndex + 1;
      }
    }
    // Ensure indices are within bounds after adjustment
    startIndex = Math.max(0, Math.min(startIndex, fullRouteCoords.length -1));
    endIndex = Math.max(0, Math.min(endIndex, fullRouteCoords.length-1));


    let trimmedCoordinates: Coordinate[] = [];

    if (startIndex <= endIndex && startIndex !== -1 && endIndex !== -1) {
        trimmedCoordinates = fullRouteCoords.slice(startIndex, endIndex + 1);
        if (trimmedCoordinates.length > 0) {
            trimmedCoordinates[0] = newStartCoord; 
            trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord; 
        } else { 
             trimmedCoordinates = [newStartCoord, newEndCoord];
        }
    } else if (startIndex > endIndex && startIndex !== -1 && endIndex !== -1) { // Handle cases like circular routes or reversed segment order
        console.warn(`trimJeepLeg: startIndex ${startIndex} > endIndex ${endIndex}. This might occur on circular or complex routes. Taking segment from startIndex to end of route, then start to endIndex`);
        // This specific handling might need adjustment based on how your routes are structured (e.g. if they are explicitly one-way segments vs parts of a loop)
        // For now, a simple fallback or direct path
        trimmedCoordinates = [newStartCoord, newEndCoord]; // Fallback to direct connection
    } else { 
        console.warn(`trimJeepLeg: Invalid indices startIndex ${startIndex}, endIndex ${endIndex}. Using direct newStart/newEnd.`);
        return [newStartCoord, newEndCoord];
    }
    
    if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
        return [newStartCoord, newEndCoord];
    }
    return trimmedCoordinates.length >=2 ? trimmedCoordinates : [newStartCoord, newEndCoord];
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
  console.log(`[Driving Guide PlanTrip V2 + Refine (Optimized) START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);

  if (!getJeepneySpatialIndex()) initializeJeepneySpatialIndex();

  const drivingPathLeg = await getDrivingDirections(origin, destination);
  if (!drivingPathLeg || !drivingPathLeg.coordinates || drivingPathLeg.coordinates.length === 0) {
    console.warn("Failed to get driving directions guide. Falling back to direct walk attempt.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  const desiredPathPolyline: Coordinate[] = drivingPathLeg.coordinates;
  console.log(`  Got desired driving path with ${desiredPathPolyline.length} points.`);

  let plannedLegs: PlannedTripLeg[] = [];
  let currentLocation = origin;
  let currentDesiredPathIndex = 0;
  let lastJeepRouteId: string | undefined = undefined; 
  let consecutiveShortJeepLegs = 0;

  const MAX_LEGS = 15; 

  for (let legCount = 0; legCount < MAX_LEGS; legCount++) {
    if (calculateDistance(currentLocation, destination) < 100) {
      console.log("  Reached destination or very close.");
      break;
    }
    if (currentDesiredPathIndex >= desiredPathPolyline.length -1 && desiredPathPolyline.length > 0) {
         console.log("  Reached end of desired path guide, attempting final walk.");
         const finalWalk = await getWalkingDirections(currentLocation, destination);
         if (finalWalk) plannedLegs.push(finalWalk);
         currentLocation = destination; 
         break;
    }

    console.log(`  Leg ${legCount + 1}: Current loc ${JSON.stringify(currentLocation)}, desiredPathIdx ${currentDesiredPathIndex}`);

    const alignedJeepInfo = findBestAlignedJeepney(
      currentLocation, 
      desiredPathPolyline,
      currentDesiredPathIndex,
      MAX_WALK_TO_JEEP_METERS
    );

    if (alignedJeepInfo && alignedJeepInfo.jeepRoute.id !== lastJeepRouteId && calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) >= MIN_JEEP_RIDE_PROGRESS_METERS/2 ) {
      if(alignedJeepInfo.jeepRoute.id === lastJeepRouteId && calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 50 && calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS) {
          console.log(`    Skipping immediate re-board of short segment on ${alignedJeepInfo.jeepRoute.name}. Forcing walk check.`);
          consecutiveShortJeepLegs++;
          if (consecutiveShortJeepLegs > 1 && desiredPathPolyline.length > 0 && desiredPathPolyline[Math.min(currentDesiredPathIndex + 10, desiredPathPolyline.length -1)]) { 
             const walkToNextSignificantDesiredPoint = await getWalkingDirections(currentLocation, desiredPathPolyline[Math.min(currentDesiredPathIndex + 10, desiredPathPolyline.length -1)]);
             if(walkToNextSignificantDesiredPoint) {
                 plannedLegs.push(walkToNextSignificantDesiredPoint);
                 currentLocation = walkToNextSignificantDesiredPoint.coordinates.slice(-1)[0];
                 currentDesiredPathIndex = Math.min(currentDesiredPathIndex + 10, desiredPathPolyline.length -1);
                 lastJeepRouteId = undefined; 
                 consecutiveShortJeepLegs = 0;
                 console.log("Forced a longer walk along desired path.");
                 continue;
             }
          }
      } else {
        consecutiveShortJeepLegs = 0; 
      }

      console.log(`    Found aligned jeep: ${alignedJeepInfo.jeepRoute.name}`);
      const walkToBoardLeg = await getWalkingDirections(currentLocation, alignedJeepInfo.boardingPointOnJeep);
      // Check if walkToBoardLeg and its distance are valid before using them
      const walkDistance = typeof walkToBoardLeg?.distance === 'number' ? walkToBoardLeg.distance : Infinity;

      if (walkToBoardLeg && walkDistance < MAX_WALK_TO_JEEP_METERS * 1.2) {
        if (walkDistance > 10) { 
             plannedLegs.push(walkToBoardLeg);
        }
        currentLocation = alignedJeepInfo.boardingPointOnJeep;
        lastJeepRouteId = undefined; 
        console.log(`      Added walk to ${alignedJeepInfo.jeepRoute.name}. New current loc: ${JSON.stringify(currentLocation)}`);

        const jeepRideCoordinates: Coordinate[] = [];
        
        const fullCurrentJeepRoute = getJeepneyRouteById(alignedJeepInfo.jeepRoute.id);
        if (fullCurrentJeepRoute) {
            const tempRouteForIndices: JeepneyRoute = {id: '', name: '', coordinates: fullCurrentJeepRoute.coordinates};
            let jeepStartIndex = findNearestPointOnRoute(alignedJeepInfo.boardingPointOnJeep, tempRouteForIndices).segmentIndex;
            let jeepEndIndex = findNearestPointOnRoute(alignedJeepInfo.alightPointOnJeep, tempRouteForIndices).segmentIndex;

            // Adjust to point indices
            if (jeepStartIndex !== -1 && jeepStartIndex + 1 < fullCurrentJeepRoute.coordinates.length) {
              if (calculateDistance(alignedJeepInfo.boardingPointOnJeep, fullCurrentJeepRoute.coordinates[jeepStartIndex+1]) < calculateDistance(alignedJeepInfo.boardingPointOnJeep, fullCurrentJeepRoute.coordinates[jeepStartIndex])) {
                jeepStartIndex = jeepStartIndex + 1;
              }
            }
             if (jeepEndIndex !== -1 && jeepEndIndex + 1 < fullCurrentJeepRoute.coordinates.length) {
              if (calculateDistance(alignedJeepInfo.alightPointOnJeep, fullCurrentJeepRoute.coordinates[jeepEndIndex+1]) < calculateDistance(alignedJeepInfo.alightPointOnJeep, fullCurrentJeepRoute.coordinates[jeepEndIndex])) {
                jeepEndIndex = jeepEndIndex + 1;
              }
            }
            jeepStartIndex = Math.max(0, Math.min(jeepStartIndex, fullCurrentJeepRoute.coordinates.length -1));
            jeepEndIndex = Math.max(0, Math.min(jeepEndIndex, fullCurrentJeepRoute.coordinates.length -1));

            if (jeepStartIndex <= jeepEndIndex) {
                for (let j = jeepStartIndex; j <= jeepEndIndex; j++) {
                     jeepRideCoordinates.push(fullCurrentJeepRoute.coordinates[j]);
                }
                 // Ensure exact start and end points
                if(jeepRideCoordinates.length > 0) {
                    jeepRideCoordinates[0] = alignedJeepInfo.boardingPointOnJeep;
                    jeepRideCoordinates[jeepRideCoordinates.length - 1] = alignedJeepInfo.alightPointOnJeep;
                } else { // If slice somehow is empty but start/end are distinct
                    jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
                    if(calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
                }

            } else { 
                 console.warn(`Could not accurately determine jeep segment for ${alignedJeepInfo.jeepRoute.name} (start ${jeepStartIndex} > end ${jeepEndIndex}). Using direct board/alight points.`);
                 jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
                 if(calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
            }
        } else {
             console.warn(`Full route not found for ${alignedJeepInfo.jeepRoute.name}. Using direct board/alight points.`);
             jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
             if(calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) > 1) jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
        }


        if (jeepRideCoordinates.length >= 2 && calculateDistance(jeepRideCoordinates[0], jeepRideCoordinates[jeepRideCoordinates.length-1]) > 10) {
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
                distance: calculateDistanceOfPolyline(jeepRideCoordinates),
            };
            plannedLegs.push(jeepRideLeg);
            currentLocation = alignedJeepInfo.alightPointOnJeep; 
            currentDesiredPathIndex = alignedJeepInfo.desiredPathEndIndex; 
            lastJeepRouteId = alignedJeepInfo.jeepRoute.id; 
            console.log(`      Added ride on ${alignedJeepInfo.jeepRoute.name}. New current loc: ${JSON.stringify(currentLocation)}. Desired path index now: ${currentDesiredPathIndex}`);
          } else {
             console.log("      Jeep ride too short or invalid, attempting final walk.");
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        console.log("      Walk to board is too long or failed, attempting final walk.");
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk) plannedLegs.push(finalWalk);
        currentLocation = destination; break; 
      }
    } else {
      console.log("    No aligned jeep found, attempting final walk.");
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk) plannedLegs.push(finalWalk);
      currentLocation = destination; break;
    }
  }
  
  if (plannedLegs.length > 0) {
      const lastLegEnd = plannedLegs[plannedLegs.length -1].coordinates.slice(-1)[0];
      if (lastLegEnd && calculateDistance(lastLegEnd, destination) > 20) { 
          console.log("  Adding final walk from last leg to destination.");
          const finalWalk = await getWalkingDirections(lastLegEnd, destination); 
          const finalWalkDist = typeof finalWalk?.distance === 'number' ? finalWalk.distance : Infinity;
          if (finalWalk && finalWalkDist > 10) {
            plannedLegs.push(finalWalk);
          }
      }
  } else if (calculateDistance(origin, destination) > 20) { 
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback) plannedLegs.push(directWalkFallback);
  }

  console.log(`[Driving Guide PlanTrip V2 END] Found ${plannedLegs.length} legs before refinement.`);
  
  const refinedSolution = await refineTripLegs(plannedLegs, destination);

  return refinedSolution.length > 0 ? [refinedSolution] : []; 
}

export { planTripWithDrivingGuide as planTrip };
