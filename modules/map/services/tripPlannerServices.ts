// pasada-gemini/modules/map/services/tripPlannerServices.ts
import {
  Coordinate,
  PlannedTripLeg,
  JeepneyRoute,
} from '../utils/routeTypes';
import {
  allJeepneyRoutes, // Ensure this is imported to access full route data
  findNearbyRouteSegments, 
  initializeJeepneySpatialIndex,
  getJeepneySpatialIndex,
  getJeepneyRouteById, // Added for refinement
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

// Constants for refinement
const REFINE_SEARCH_RADIUS_METERS = 200; // How far along a jeep route to look for better connection points
const REFINE_MIN_WALK_SAVING_METERS = 50; // Minimum saving for a walk to be considered "better"
const REFINE_MAX_WALK_FOR_CONNECTION = 600; // Max walk distance for a refined connection


interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate;
  alightPointOnJeep: Coordinate;
  desiredPathStartIndex: number;
  desiredPathEndIndex: number; 
  walkToBoardingDistance: number;
}

function findBestAlignedJeepney(
    actualCurrentLocation: Coordinate,
    desiredPathPolyline: Coordinate[],
    currentDesiredPathIndex: number,
    maxWalkToBoard: number
): AlignedJeepInfo | null {
    // ... (original findBestAlignedJeepney function from the uploaded file) ...
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

// --- NEW: Refinement Function ---
async function refineTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    console.log("[Refine START] Starting trip refinement process.");
    if (legs.length < 2) {
        console.log("[Refine END] Not enough legs to refine.");
        return legs; // Nothing to refine if less than 2 legs
    }

    const refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs)); // Deep copy

    for (let i = 1; i < refinedLegs.length; i++) { // Start from the first potential walk leg after an initial jeep/walk
        const currentLeg = refinedLegs[i];
        const prevLeg = refinedLegs[i-1];

        if (currentLeg.type === 'walk' && prevLeg.type === 'jeepney') {
            const originalWalkDistance = typeof currentLeg.distance === 'number' ? currentLeg.distance : Infinity;
            let bestRefinedWalk: PlannedTripLeg | null = null;
            let bestRefinedWalkDistance = originalWalkDistance;
            let bestPrevJeepAlightPoint: Coordinate | null = null;
            let bestNextJeepBoardPoint: Coordinate | null = null;

            const prevJeepRoute = getJeepneyRouteById(prevLeg.routeId!);
            if (!prevJeepRoute) continue;

            const originalAlightPoint = prevLeg.coordinates[prevLeg.coordinates.length - 1];
            const originalAlightIndexOnPrevJeep = findNearestPointOnRoute(originalAlightPoint, prevJeepRoute).segmentIndex;


            // Case 1: This walk is to the final destination
            if (i === refinedLegs.length - 1 || (refinedLegs[i+1] && refinedLegs[i+1].type !== 'jeepney') ) {
                console.log(`[Refine] Evaluating final walk leg ${i} from ${prevLeg.routeName}`);
                // Iterate nearby points on prevJeepRoute to find a better alighting spot for walking to finalDestination
                const searchWindowCoordsPrev = getCoordinatesInSearchWindow(prevJeepRoute.coordinates, originalAlightIndexOnPrevJeep, REFINE_SEARCH_RADIUS_METERS);

                for (const candidateAlight of searchWindowCoordsPrev) {
                    const newWalk = await getWalkingDirections(candidateAlight, finalDestination);
                    const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;

                    if (newWalk && newWalkDist < bestRefinedWalkDistance && newWalkDist < MAX_FINAL_WALK_METERS) {
                         if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.8) {
                            bestRefinedWalkDistance = newWalkDist;
                            bestRefinedWalk = newWalk;
                            bestPrevJeepAlightPoint = candidateAlight;
                            console.log(`  [Refine Final Walk] Better alight from ${prevLeg.routeName} found. Old walk: ${originalWalkDistance.toFixed(0)}m, New walk: ${newWalkDist.toFixed(0)}m`);
                        }
                    }
                }
                if (bestRefinedWalk && bestPrevJeepAlightPoint) {
                    refinedLegs[i] = bestRefinedWalk; // Update walk leg
                    // Adjust preceding jeep leg
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

                const searchWindowCoordsPrev = getCoordinatesInSearchWindow(prevJeepRoute.coordinates, originalAlightIndexOnPrevJeep, REFINE_SEARCH_RADIUS_METERS);
                const searchWindowCoordsNext = getCoordinatesInSearchWindow(nextJeepRoute.coordinates, originalBoardIndexOnNextJeep, REFINE_SEARCH_RADIUS_METERS);

                for (const candidateAlight of searchWindowCoordsPrev) {
                    for (const candidateBoard of searchWindowCoordsNext) {
                        const newWalk = await getWalkingDirections(candidateAlight, candidateBoard);
                        const newWalkDist = typeof newWalk?.distance === 'number' ? newWalk.distance : Infinity;
                        
                        if (newWalk && newWalkDist < bestRefinedWalkDistance && newWalkDist < REFINE_MAX_WALK_FOR_CONNECTION) {
                             if (originalWalkDistance - newWalkDist >= REFINE_MIN_WALK_SAVING_METERS || newWalkDist < originalWalkDistance * 0.8) {
                                bestRefinedWalkDistance = newWalkDist;
                                bestRefinedWalk = newWalk;
                                bestPrevJeepAlightPoint = candidateAlight;
                                bestNextJeepBoardPoint = candidateBoard;
                                console.log(`  [Refine Transfer] Better walk from ${prevLeg.routeName} to ${nextLeg.routeName} found. Old: ${originalWalkDistance.toFixed(0)}m, New: ${newWalkDist.toFixed(0)}m`);
                            }
                        }
                    }
                }
                if (bestRefinedWalk && bestPrevJeepAlightPoint && bestNextJeepBoardPoint) {
                    refinedLegs[i] = bestRefinedWalk; // Update walk leg
                    // Adjust preceding jeep leg
                    const oldPrevJeepEnd = prevLeg.coordinates[prevLeg.coordinates.length-1];
                    prevLeg.coordinates = trimJeepLeg(prevJeepRoute.coordinates, prevLeg.coordinates[0], bestPrevJeepAlightPoint);
                    prevLeg.distance = calculateDistanceOfPolyline(prevLeg.coordinates);
                     console.log(`  [Refine Transfer] Updated prev jeep ${prevLeg.routeName} to end at ${JSON.stringify(bestPrevJeepAlightPoint)} (was ${JSON.stringify(oldPrevJeepEnd)})`);
                    // Adjust succeeding jeep leg
                    const oldNextJeepStart = nextLeg.coordinates[0];
                    nextLeg.coordinates = trimJeepLeg(nextJeepRoute.coordinates, bestNextJeepBoardPoint, nextLeg.coordinates[nextLeg.coordinates.length-1]);
                    nextLeg.distance = calculateDistanceOfPolyline(nextLeg.coordinates);
                    console.log(`  [Refine Transfer] Updated next jeep ${nextLeg.routeName} to start at ${JSON.stringify(bestNextJeepBoardPoint)} (was ${JSON.stringify(oldNextJeepStart)})`);
                }
            }
        }
    }
    console.log("[Refine END] Refinement process complete.");
    return refinedLegs;
}

// Helper function to get coordinates within a search radius along a route
function getCoordinatesInSearchWindow(routeCoordinates: Coordinate[], centerIndex: number, searchRadiusMeters: number): Coordinate[] {
    const results: Coordinate[] = [];
    if (!routeCoordinates || routeCoordinates.length === 0) return results;
    
    const centerPoint = routeCoordinates[Math.max(0, Math.min(centerIndex, routeCoordinates.length -1))];
    if(!centerPoint) return results;
    results.push(centerPoint); // Include the original point

    // Search backward
    let distBackward = 0;
    for (let i = centerIndex - 1; i >= 0; i--) {
        distBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (distBackward > searchRadiusMeters) break;
        results.push(routeCoordinates[i]);
    }
    // Search forward
    let distForward = 0;
    for (let i = centerIndex + 1; i < routeCoordinates.length; i++) {
        distForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (distForward > searchRadiusMeters) break;
        results.push(routeCoordinates[i]);
    }
    return results;
}

// Helper function to trim/reconstruct a jeep leg's coordinates
function trimJeepLeg(fullRouteCoords: Coordinate[], newStartCoord: Coordinate, newEndCoord: Coordinate): Coordinate[] {
    const startIndex = findNearestPointOnRoute(newStartCoord, { id:'', name:'', coordinates: fullRouteCoords }).segmentIndex;
    const endIndex = findNearestPointOnRoute(newEndCoord, { id:'', name:'', coordinates: fullRouteCoords }).segmentIndex;

    let trimmedCoordinates: Coordinate[] = [];

    if (startIndex <= endIndex && startIndex !== -1 && endIndex !== -1) {
        trimmedCoordinates = fullRouteCoords.slice(startIndex, endIndex + 1);
        if (trimmedCoordinates.length > 0) {
            trimmedCoordinates[0] = newStartCoord; // Ensure exact start
            trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord; // Ensure exact end
        } else { // if slice results in empty, means start and end are effectively the same segment or very close
             trimmedCoordinates = [newStartCoord, newEndCoord];
        }
    } else { // Fallback if indices are weird (e.g. circular route part, or points are identical)
        console.warn(`trimJeepLeg: startIndex ${startIndex} > endIndex ${endIndex}. Using direct newStart/newEnd.`);
        return [newStartCoord, newEndCoord];
    }
     // Ensure at least two points if start and end are different
    if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
        return [newStartCoord, newEndCoord];
    }
    return trimmedCoordinates.length >=2 ? trimmedCoordinates : [newStartCoord, newEndCoord]; // Ensure at least 2 points
}

function calculateDistanceOfPolyline(polyline: Coordinate[]): number {
    let totalDistance = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
        totalDistance += calculateDistance(polyline[i], polyline[i+1]);
    }
    return totalDistance;
}


export async function planTripWithDrivingGuide(
  origin: Coordinate,
  destination: Coordinate
): Promise<Array<PlannedTripLeg[]>> {
  console.log(`[Driving Guide PlanTrip V2 + Refine START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);

  if (!getJeepneySpatialIndex()) initializeJeepneySpatialIndex();

  const drivingPathLeg = await getDrivingDirections(origin, destination);
  if (!drivingPathLeg || !drivingPathLeg.coordinates || drivingPathLeg.coordinates.length === 0) {
    console.warn("Failed to get driving directions guide. Falling back to direct walk attempt.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  const desiredPathPolyline: Coordinate[] = drivingPathLeg.coordinates;
  console.log(`  Got desired driving path with ${desiredPathPolyline.length} points.`);

  let plannedLegs: PlannedTripLeg[] = []; // Make it mutable for initial planning
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
          if (consecutiveShortJeepLegs > 1 && desiredPathPolyline[Math.min(currentDesiredPathIndex + 10, desiredPathPolyline.length -1)]) { 
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
      if (walkToBoardLeg && typeof walkToBoardLeg.distance === 'number' && walkToBoardLeg.distance < MAX_WALK_TO_JEEP_METERS * 1.2) {
        // Only add walk leg if distance is significant
        if (walkToBoardLeg.distance > 10) { // e.g. ignore very short walks
             plannedLegs.push(walkToBoardLeg);
        }
        currentLocation = alignedJeepInfo.boardingPointOnJeep;
        lastJeepRouteId = undefined; 
        console.log(`      Added walk to ${alignedJeepInfo.jeepRoute.name}. New current loc: ${JSON.stringify(currentLocation)}`);

        const jeepRideCoordinates: Coordinate[] = [];
        let currentJeepCoord = alignedJeepInfo.boardingPointOnJeep;
        jeepRideCoordinates.push(currentJeepCoord);
        
        // Get the full original route for slicing
        const fullCurrentJeepRoute = getJeepneyRouteById(alignedJeepInfo.jeepRoute.id);
        if (fullCurrentJeepRoute) {
            const jeepStartIndex = findNearestPointOnRoute(alignedJeepInfo.boardingPointOnJeep, fullCurrentJeepRoute).segmentIndex;
            const jeepEndIndex = findNearestPointOnRoute(alignedJeepInfo.alightPointOnJeep, fullCurrentJeepRoute).segmentIndex;
            
            if (jeepStartIndex > -1 && jeepEndIndex > -1 && jeepStartIndex <= jeepEndIndex) {
                for (let j = jeepStartIndex; j <= jeepEndIndex; j++) {
                    if (j < fullCurrentJeepRoute.coordinates.length) { // Ensure j is a valid index
                        const nextCoord = fullCurrentJeepRoute.coordinates[j]; // Use point at j, not j+1 initially
                         // Add first point if it's the boarding point, or if it's different from last added point
                        if (jeepRideCoordinates.length === 0 || calculateDistance(jeepRideCoordinates[jeepRideCoordinates.length-1], nextCoord) > 0.1) {
                            jeepRideCoordinates.push(nextCoord);
                        }
                    }
                }
                 // Ensure the last point is the alight point if it wasn't captured precisely
                if (jeepRideCoordinates.length > 0 && calculateDistance(jeepRideCoordinates[jeepRideCoordinates.length-1], alignedJeepInfo.alightPointOnJeep) > 1) {
                    jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
                }
                 // Ensure the first point is the exact boarding point
                if(jeepRideCoordinates.length > 0 && calculateDistance(jeepRideCoordinates[0], alignedJeepInfo.boardingPointOnJeep) > 1){
                    jeepRideCoordinates.unshift(alignedJeepInfo.boardingPointOnJeep);
                }


            } else { 
                 console.warn(`Could not accurately determine jeep segment for ${alignedJeepInfo.jeepRoute.name}. Using direct board/alight points.`);
                 jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep); // Already has boarding point
            }
        } else {
             console.warn(`Full route not found for ${alignedJeepInfo.jeepRoute.name}. Using direct board/alight points.`);
             jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep); // Already has boarding point
        }


        if (jeepRideCoordinates.length >= 2 && calculateDistance(jeepRideCoordinates[0], jeepRideCoordinates[jeepRideCoordinates.length-1]) > 10) { // Ensure meaningful distance
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
                distance: calculateDistanceOfPolyline(jeepRideCoordinates), // Recalculate distance
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
  
  // Final walk if not perfectly at destination
  if (plannedLegs.length > 0) {
      const lastLegEnd = plannedLegs[plannedLegs.length -1].coordinates.slice(-1)[0];
      if (lastLegEnd && calculateDistance(lastLegEnd, destination) > 20) { // Reduced threshold for final walk
          console.log("  Adding final walk from last leg to destination.");
          const finalWalk = await getWalkingDirections(lastLegEnd, destination); 
          if (finalWalk && typeof finalWalk.distance === 'number' && finalWalk.distance > 10) { // Only add significant walk
            plannedLegs.push(finalWalk);
          }
      }
  } else if (calculateDistance(origin, destination) > 20) { 
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback) plannedLegs.push(directWalkFallback);
  }

  console.log(`[Driving Guide PlanTrip V2 END] Found ${plannedLegs.length} legs before refinement.`);
  console.log(`[Driving Guide PlanTrip V2 END] Found ${plannedLegs.length} legs before refinement.`);
  
  // --- Apply Refinement ---
  const refinedSolution = await refineTripLegs(plannedLegs, destination);

  return refinedSolution.length > 0 ? [refinedSolution] : []; 
}

export { planTripWithDrivingGuide as planTrip };
