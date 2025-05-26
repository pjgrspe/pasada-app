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
} from './jeepneyDataService';
import {
  getWalkingDirections,
  getDrivingDirections, 
  calculateDistance,
  findNearestPointOnRoute,
} from './mapApiServices';

const MAX_WALK_TO_JEEP_METERS = 700; 
const MAX_FINAL_WALK_METERS = 1500;
// How close a point on the jeepney route should be to a point on the desired path
const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 200; 
// Minimum distance a jeepney ride should cover to be considered useful
const MIN_JEEP_RIDE_PROGRESS_METERS = 300; 
// When searching along desired path for jeepney, how far to look ahead from current desired path point
const DESIRED_PATH_SEARCH_AHEAD_METERS = 500;
// If jeep route moves this far from desired path, consider it diverged
const DIVERGENCE_THRESHOLD_METERS = 250; // <<<< ADDED DEFINITION HERE


interface AlignedJeepInfo {
  jeepRoute: JeepneyRoute;
  boardingPointOnJeep: Coordinate; // Actual point on jeep route to board
  alightPointOnJeep: Coordinate;   // Actual point on jeep route to alight
  // Index on desiredPathPolyline corresponding to boarding
  desiredPathStartIndex: number;
  // Index on desiredPathPolyline corresponding to alighting (or point it aligns with)
  desiredPathEndIndex: number; 
  walkToBoardingDistance: number;
}

// --- More Advanced (but still heuristic) findBestAlignedJeepney ---
function findBestAlignedJeepney(
    actualCurrentLocation: Coordinate, // Where the user IS (start of walk, or last alight point)
    desiredPathPolyline: Coordinate[],
    currentDesiredPathIndex: number, // Index on desiredPathPolyline to start searching from
    maxWalkToBoard: number
): AlignedJeepInfo | null {
    console.log(`  findBestAlignedJeepney: actualCurrentLoc ${JSON.stringify(actualCurrentLocation)}, desiredPathIdx ${currentDesiredPathIndex}`);
    let bestOption: AlignedJeepInfo | null = null;
    let bestOptionScore = -Infinity; // Higher score is better (e.g., longer alignment, less walking)

    // Iterate a segment of the desired path to find potential areas to board a jeep
    let desiredPathSearchEndIndex = currentDesiredPathIndex;
    let cumulativeDesiredPathSearchDistance = 0;
    for (let dpIdx = currentDesiredPathIndex; dpIdx < desiredPathPolyline.length -1; dpIdx++) {
        desiredPathSearchEndIndex = dpIdx + 1;
        if (dpIdx > currentDesiredPathIndex) {
            cumulativeDesiredPathSearchDistance += calculateDistance(desiredPathPolyline[dpIdx-1], desiredPathPolyline[dpIdx]);
        }
        if (cumulativeDesiredPathSearchDistance > DESIRED_PATH_SEARCH_AHEAD_METERS) break; // Don't look too far ahead on desired path for one walk

        const pointOnDesiredPath = desiredPathPolyline[dpIdx];
        const nearbySegments = findNearbyRouteSegments(pointOnDesiredPath, ALIGNMENT_PROXIMITY_THRESHOLD_METERS);

        for (const segInfo of nearbySegments) {
            const { pointOnPolyline: potentialBoardingPoint, segmentIndex: boardingSegmentIdx, distanceToPoint: distToBoardingPoint } =
                findNearestPointOnRoute(pointOnDesiredPath, segInfo.originalRoute);

            if (distToBoardingPoint > ALIGNMENT_PROXIMITY_THRESHOLD_METERS) continue;

            const walkToBoardDist = calculateDistance(actualCurrentLocation, potentialBoardingPoint);
            if (walkToBoardDist > maxWalkToBoard) continue;

            // Now, trace this jeep route to see how far it aligns with the *remaining* desired path
            let potentialAlightPoint = potentialBoardingPoint;
            let jeepCoversDesiredPathUpToIndex = dpIdx; // Start with the desired path index we used for boarding
            let lastGoodAlignmentPointOnJeep = potentialBoardingPoint;
            let jeepRideDistance = 0;

            for (let j = boardingSegmentIdx; j < segInfo.originalRoute.coordinates.length - 1; j++) {
                const jeepSegStart = segInfo.originalRoute.coordinates[j];
                const jeepSegEnd = segInfo.originalRoute.coordinates[j+1];
                jeepRideDistance += calculateDistance(jeepSegStart, jeepSegEnd);

                // Check alignment of jeepSegEnd with the subsequent desired path
                let aligns = false;
                for (let k = jeepCoversDesiredPathUpToIndex; k < desiredPathPolyline.length; k++) {
                    if (calculateDistance(jeepSegEnd, desiredPathPolyline[k]) < ALIGNMENT_PROXIMITY_THRESHOLD_METERS) {
                        // Basic angle check would be good here too
                        aligns = true;
                        lastGoodAlignmentPointOnJeep = jeepSegEnd;
                        jeepCoversDesiredPathUpToIndex = k; // Jeep covers desired path up to this point k
                        break;
                    }
                     // Use the defined DIVERGENCE_THRESHOLD_METERS
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
    if (bestOption) console.log(`    findBestAlignedJeepney found: ${bestOption.jeepRoute.name}, walk: ${bestOption.walkToBoardingDistance.toFixed(0)}m`);
    return bestOption;
}


export async function planTripWithDrivingGuide(
  origin: Coordinate,
  destination: Coordinate
): Promise<Array<PlannedTripLeg[]>> {
  console.log(`[Driving Guide PlanTrip V2 START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);

  if (!getJeepneySpatialIndex()) initializeJeepneySpatialIndex();

  const drivingPathLeg = await getDrivingDirections(origin, destination);
  if (!drivingPathLeg || !drivingPathLeg.coordinates || drivingPathLeg.coordinates.length === 0) {
    console.warn("Failed to get driving directions guide. Falling back to direct walk attempt.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  const desiredPathPolyline: Coordinate[] = drivingPathLeg.coordinates;
  console.log(`  Got desired driving path with ${desiredPathPolyline.length} points.`);

  const plannedLegs: PlannedTripLeg[] = [];
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
    if (currentDesiredPathIndex >= desiredPathPolyline.length -1) {
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
          if (consecutiveShortJeepLegs > 1) { 
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
        plannedLegs.push(walkToBoardLeg);
        currentLocation = alignedJeepInfo.boardingPointOnJeep;
        lastJeepRouteId = undefined; 
        console.log(`      Added walk to ${alignedJeepInfo.jeepRoute.name}. New current loc: ${JSON.stringify(currentLocation)}`);

        const jeepRideCoordinates: Coordinate[] = [];
        let currentJeepCoord = alignedJeepInfo.boardingPointOnJeep;
        jeepRideCoordinates.push(currentJeepCoord);
        let jeepStartIndex = findNearestPointOnRoute(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.jeepRoute).segmentIndex;
        let jeepEndIndex = findNearestPointOnRoute(alignedJeepInfo.alightPointOnJeep, alignedJeepInfo.jeepRoute).segmentIndex;
        
        if (jeepStartIndex > -1 && jeepEndIndex > -1 && jeepStartIndex <= jeepEndIndex) {
            for (let j = jeepStartIndex; j <= jeepEndIndex; j++) {
                if (j + 1 < alignedJeepInfo.jeepRoute.coordinates.length) {
                    const nextCoord = alignedJeepInfo.jeepRoute.coordinates[j+1];
                    if(calculateDistance(jeepRideCoordinates[jeepRideCoordinates.length-1], nextCoord) > 0.1) { 
                        jeepRideCoordinates.push(nextCoord);
                    }
                }
            }
        } else { 
             if(jeepRideCoordinates.length > 0 && calculateDistance(jeepRideCoordinates[jeepRideCoordinates.length-1], alignedJeepInfo.alightPointOnJeep) > 0.1) { // Check if length is > 0 before accessing last element
                jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
             } else if (jeepRideCoordinates.length === 0) { // If array is empty, push both points
                jeepRideCoordinates.push(alignedJeepInfo.boardingPointOnJeep);
                jeepRideCoordinates.push(alignedJeepInfo.alightPointOnJeep);
             }
        }


        if (jeepRideCoordinates.length >= 2) {
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney', coordinates: jeepRideCoordinates, routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id, routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}.`,
            };
            plannedLegs.push(jeepRideLeg);
            currentLocation = alignedJeepInfo.alightPointOnJeep; 
            currentDesiredPathIndex = alignedJeepInfo.desiredPathEndIndex; 
            lastJeepRouteId = alignedJeepInfo.jeepRoute.id; 
            console.log(`      Added ride on ${alignedJeepInfo.jeepRoute.name}. New current loc: ${JSON.stringify(currentLocation)}. Desired path index now: ${currentDesiredPathIndex}`);
          } else {
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk) plannedLegs.push(finalWalk);
        currentLocation = destination; break; 
      }
    } else {
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk) plannedLegs.push(finalWalk);
      currentLocation = destination; break;
    }
  }
  
  if (plannedLegs.length > 0) {
      const lastLegEnd = plannedLegs[plannedLegs.length -1].coordinates.slice(-1)[0];
      if (lastLegEnd && calculateDistance(lastLegEnd, destination) > 50) { 
          console.log("  Adding final walk from last leg to destination.");
          const finalWalk = await getWalkingDirections(lastLegEnd, destination); 
          if (finalWalk) plannedLegs.push(finalWalk); 
      }
  } else if (calculateDistance(origin, destination) > 50) { 
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback) plannedLegs.push(directWalkFallback);
  }

  console.log(`[Driving Guide PlanTrip V2 END] Found ${plannedLegs.length} legs for one solution.`);
  return plannedLegs.length > 0 ? [plannedLegs] : []; 
}

export { planTripWithDrivingGuide as planTrip }; // You can alias it
