// pasada-gemini/modules/map/services/tripPlannerServices.ts
import { allJeepneyRoutes } from './jeepneyDataService';
import { Coordinate, JeepneyRoute, PlannedTripLeg } from '../utils/routeTypes';
import { getWalkingDirections, calculateDistance, findNearestPointOnRoute } from './mapApiServices';

// --- Constants ---
const MAX_WALK_DISTANCE_TO_JEEP = 700; // meters
const MAX_WALK_DISTANCE_FOR_TRANSFER = 400; // meters
const PREFERRED_MAX_WALK_ONLY_DISTANCE = 1500; // meters, for prioritizing direct walk
const MAX_TRANSFER_ITERATIONS_DEBUG = 50;
const TRIVIAL_TRANSFER_WALK_THRESHOLD = 75;


function getJeepneyRidePath(
    route: JeepneyRoute,
    projectedBoardingPoint: Coordinate,
    projectedAlightingPoint: Coordinate,
    boardingSegIdx: number,
    alightingSegIdx: number
  ): Coordinate[] {
    // console.log(`getJeepneyRidePath for ${route.id}: boardSeg ${boardingSegIdx}, alightSeg ${alightingSegIdx}`);
    if (boardingSegIdx === -1 || alightingSegIdx === -1 || boardingSegIdx > alightingSegIdx) {
        // console.log(` -> Invalid segment indices or order.`);
        return [];
    }

    const path: Coordinate[] = [projectedBoardingPoint];
    for (let i = boardingSegIdx + 1; i <= alightingSegIdx; i++) {
        if (route.coordinates[i]) {
            path.push(route.coordinates[i]);
        } else {
            // console.log(` -> Missing coordinate at index ${i} for route ${route.id}`);
        }
    }
    const lastPathPoint = path[path.length - 1];
    if (!lastPathPoint || calculateDistance(lastPathPoint, projectedAlightingPoint) > 1) {
        path.push(projectedAlightingPoint);
    }
    
    const cleanedPath = path.filter((point, index, self) =>
        index === 0 || calculateDistance(point, self[index - 1]) > 0.1
    );
    
    // console.log(` -> Generated path length: ${cleanedPath.length}`);
    return cleanedPath.length >= 2 ? cleanedPath : [];
}

export async function planTrip(origin: Coordinate, destination: Coordinate): Promise<Array<PlannedTripLeg[]>> {
  console.log(`[PlanTrip START] Origin: ${JSON.stringify(origin)}, Destination: ${JSON.stringify(destination)}`);
  let tripOptions: Array<PlannedTripLeg[]> = [];

  // 1. Direct Walking Option
  console.log("[PlanTrip STAGE 1] Calculating direct walking route...");
  const directWalkLeg = await getWalkingDirections(origin, destination);
  if (directWalkLeg && directWalkLeg.coordinates.length > 0) {
    console.log(` -> Direct walk option found. Distance: ${directWalkLeg.distance}m, Duration: ${directWalkLeg.duration}s`);
    tripOptions.push([directWalkLeg]);
  } else {
    console.log(" -> No direct walking route found or it's invalid.");
  }

  // 2. Single Jeepney Ride (0 Transfers)
  console.log("\n[PlanTrip STAGE 2] Evaluating single jeepney ride options...");
  for (const jeepRoute of allJeepneyRoutes) {
    console.log(` -> Checking route: ${jeepRoute.name} (ID: ${jeepRoute.id})`);
    const boardingDetails = findNearestPointOnRoute(origin, jeepRoute);
    console.log(`    - Nearest boarding point on ${jeepRoute.name}: dist ${boardingDetails.distanceToPoint.toFixed(0)}m, segIdx ${boardingDetails.segmentIndex}`);

    if (boardingDetails.distanceToPoint > MAX_WALK_DISTANCE_TO_JEEP || boardingDetails.segmentIndex === -1) {
        console.log(`    - Skipping ${jeepRoute.name}: Boarding point too far or not found.`);
        continue;
    }

    let bestAlightingForDest = null;
    let minWalkDistFromJeepToFinalDest = Infinity;
    console.log(`    - Finding best alighting point on ${jeepRoute.name} to destination...`);
    for (let i = boardingDetails.segmentIndex; i < jeepRoute.coordinates.length -1; i++) {
        const potentialAlightVertex = jeepRoute.coordinates[i+1];
        if(!potentialAlightVertex) continue;
        console.log(`      - Testing alight at vertex ${i+1} of ${jeepRoute.name}`);
        const walkFromThisAlightPoint = await getWalkingDirections(potentialAlightVertex, destination);
        if (walkFromThisAlightPoint && typeof walkFromThisAlightPoint.distance === 'number' && walkFromThisAlightPoint.distance < MAX_WALK_DISTANCE_TO_JEEP) {
            console.log(`        - Walk from vertex ${i+1} to dest: ${walkFromThisAlightPoint.distance.toFixed(0)}m`);
            if (walkFromThisAlightPoint.distance < minWalkDistFromJeepToFinalDest) {
                minWalkDistFromJeepToFinalDest = walkFromThisAlightPoint.distance;
                bestAlightingForDest = {
                    pointOnPolyline: potentialAlightVertex,
                    segmentIndex: i, // Segment *ending* at this vertex
                    walkLeg: walkFromThisAlightPoint,
                };
                console.log(`        - New best alighting point for ${jeepRoute.name} found at vertex ${i+1}. Walk to dest: ${minWalkDistFromJeepToFinalDest.toFixed(0)}m`);
            }
        }
    }

    if (bestAlightingForDest) {
      console.log(`    - Best alighting point for ${jeepRoute.name} found. Walk to dest: ${minWalkDistFromJeepToFinalDest.toFixed(0)}m. Fetching walk to boarding...`);
      const walkToBoarding = await getWalkingDirections(origin, boardingDetails.pointOnPolyline);
      if (walkToBoarding) {
        console.log(`      - Walk to boarding ${jeepRoute.name} successful. Distance: ${typeof walkToBoarding.distance === 'number' ? walkToBoarding.distance.toFixed(0) : 'N/A'}m`);
        const jeepRidePathCoords = getJeepneyRidePath(
          jeepRoute,
          boardingDetails.pointOnPolyline,
          bestAlightingForDest.pointOnPolyline,
          boardingDetails.segmentIndex,
          bestAlightingForDest.segmentIndex
        );
        console.log(`      - Jeep ride path for ${jeepRoute.name} generated, length: ${jeepRidePathCoords.length}`);

        if (jeepRidePathCoords.length >= 2) {
          const jeepneyLeg: PlannedTripLeg = {
            type: 'jeepney',
            coordinates: jeepRidePathCoords,
            routeName: jeepRoute.name,
            routeId: jeepRoute.id,
            routeColor: jeepRoute.color,
            mode: jeepRoute.name,
            instructions: `Take the ${jeepRoute.name}. Alight near ${bestAlightingForDest.walkLeg.startAddress || 'destination approach'}.`,
            jeepBoardingPointInfo: `near ${walkToBoarding.endAddress || 'boarding area'}`,
            jeepAlightingPointInfo: `near ${bestAlightingForDest.walkLeg.startAddress || 'alighting area'}`,
          };
          tripOptions.push([walkToBoarding, jeepneyLeg, bestAlightingForDest.walkLeg]);
          console.log(`    -> SUCCESS: Single jeepney option added using ${jeepRoute.name}.`);
        } else {
          console.log(`    - FAILED: Jeep ride path for ${jeepRoute.name} was too short or invalid.`);
        }
      } else {
         console.log(`    - FAILED: Could not get walking directions to boarding point of ${jeepRoute.name}.`);
      }
    } else {
        console.log(`    - No suitable alighting point found on ${jeepRoute.name} for a single ride to destination.`);
    }
  }

  // 3. One Transfer
  console.log("\n[PlanTrip STAGE 3] Evaluating one-transfer options...");
  let transferChecks = 0;
  transferLoop: for (const routeA of allJeepneyRoutes) {
    console.log(` -> Starting transfer search with Route A: ${routeA.name}`);
    const boardingDetailsA = findNearestPointOnRoute(origin, routeA);
    if (boardingDetailsA.distanceToPoint > MAX_WALK_DISTANCE_TO_JEEP || boardingDetailsA.segmentIndex === -1) {
        console.log(`    - Skipping Route A (${routeA.name}): Initial boarding point too far or not found.`);
        continue;
    }

    console.log(`    - Route A (${routeA.name}): Boarding at seg ${boardingDetailsA.segmentIndex}, dist ${boardingDetailsA.distanceToPoint.toFixed(0)}m. Fetching walk to boarding A...`);
    const walkToBoardingA = await getWalkingDirections(origin, boardingDetailsA.pointOnPolyline);
    if (!walkToBoardingA) {
        console.log(`    - FAILED: Could not get walking directions to boarding point of Route A (${routeA.name}).`);
        continue;
    }
    console.log(`      - Walk to boarding Route A (${routeA.name}) successful.`);

    for (let i = boardingDetailsA.segmentIndex; i < routeA.coordinates.length - 1; i++) { // Iterate alighting points on A
      transferChecks++;
      if (transferChecks > MAX_TRANSFER_ITERATIONS_DEBUG) {
        console.warn(`DEBUG: Exceeded MAX_TRANSFER_ITERATIONS_DEBUG (${MAX_TRANSFER_ITERATIONS_DEBUG}). Breaking from transfer search.`);
        break transferLoop;
      }
      const ptA_alight_for_transfer = routeA.coordinates[i + 1];
      console.log(`    - Route A (${routeA.name}): Considering alight at vertex ${i+1} for transfer. Transfer check #${transferChecks}`);

      for (const routeB of allJeepneyRoutes) {
        if (routeA.id === routeB.id) continue;
        // console.log(`      - Checking transfer from ${routeA.name} to ${routeB.name}...`);

        const boardingDetailsB = findNearestPointOnRoute(ptA_alight_for_transfer, routeB);
        if (boardingDetailsB.distanceToPoint > MAX_WALK_DISTANCE_FOR_TRANSFER || boardingDetailsB.segmentIndex === -1) {
            // console.log(`        - Skipping Route B (${routeB.name}): Transfer boarding point too far or not found from Route A's alight point.`);
            continue;
        }
        // console.log(`        - Route B (${routeB.name}): Potential transfer boarding at seg ${boardingDetailsB.segmentIndex}, dist ${boardingDetailsB.distanceToPoint.toFixed(0)}m.`);
        
        const IS_OVERLAPPING_PAIR_FOR_TRANSFER =
            ( (routeA.id === 'checkpointSilver' && routeB.id === 'checkpointViolet') ||
              (routeA.id === 'checkpointViolet' && routeB.id === 'checkpointSilver') );

        if (IS_OVERLAPPING_PAIR_FOR_TRANSFER && boardingDetailsB.distanceToPoint < TRIVIAL_TRANSFER_WALK_THRESHOLD) {
            console.log(`        - SKIPPING trivial overlap transfer from ${routeA.name} to ${routeB.name} (walk: ${boardingDetailsB.distanceToPoint.toFixed(0)}m).`);
            continue; 
        }

        console.log(`        - Potential transfer: ${routeA.name} (alight vertex ${i+1}) to ${routeB.name} (board seg ${boardingDetailsB.segmentIndex}). Fetching walk between them...`);
        const walkToBoardingB = await getWalkingDirections(ptA_alight_for_transfer, boardingDetailsB.pointOnPolyline);
        if (!walkToBoardingB) {
            console.log(`        - FAILED: Could not get walking directions for transfer from ${routeA.name} to ${routeB.name}.`);
            continue;
        }
        console.log(`          - Walk for transfer to ${routeB.name} successful.`);

        let bestAlightingB_for_Dest = null;
        let minWalkDistFromBToFinalDest = Infinity;
        // console.log(`          - Finding best alighting point on ${routeB.name} to final destination...`);
        for (let j = boardingDetailsB.segmentIndex; j < routeB.coordinates.length - 1; j++) {
            const potentialAlightVertexB = routeB.coordinates[j+1];
            if(!potentialAlightVertexB) continue;
            const walkFromThisAlightB = await getWalkingDirections(potentialAlightVertexB, destination);
            if(walkFromThisAlightB && typeof walkFromThisAlightB.distance === 'number' && walkFromThisAlightB.distance < MAX_WALK_DISTANCE_TO_JEEP) {
                if(walkFromThisAlightB.distance < minWalkDistFromBToFinalDest){
                    minWalkDistFromBToFinalDest = walkFromThisAlightB.distance;
                    bestAlightingB_for_Dest = {
                        pointOnPolyline: potentialAlightVertexB,
                        segmentIndex: j,
                        walkLeg: walkFromThisAlightB,
                    };
                }
            }
        }

        if (bestAlightingB_for_Dest) {
          console.log(`          - Best alighting point for ${routeB.name} found. Walk to dest: ${minWalkDistFromBToFinalDest.toFixed(0)}m.`);
          const jeepLegA_coords = getJeepneyRidePath(routeA, boardingDetailsA.pointOnPolyline, ptA_alight_for_transfer, boardingDetailsA.segmentIndex, i);
          const jeepLegB_coords = getJeepneyRidePath(routeB, boardingDetailsB.pointOnPolyline, bestAlightingB_for_Dest.pointOnPolyline, boardingDetailsB.segmentIndex, bestAlightingB_for_Dest.segmentIndex);
          // console.log(`            Jeep A path length: ${jeepLegA_coords.length}, Jeep B path length: ${jeepLegB_coords.length}`);

          if (jeepLegA_coords.length >= 2 && jeepLegB_coords.length >= 2) {
            const plan: PlannedTripLeg[] = [
              walkToBoardingA,
              { type: 'jeepney', coordinates: jeepLegA_coords, routeName: routeA.name, routeId: routeA.id, routeColor: routeA.color, mode: routeA.name, instructions: `Take ${routeA.name}. Alight near ${walkToBoardingB.startAddress || 'transfer point'} to switch to ${routeB.name}.`, jeepBoardingPointInfo: `near ${walkToBoardingA.endAddress || 'boarding area'}`, jeepAlightingPointInfo: `near ${walkToBoardingB.startAddress || 'transfer area'}` },
              walkToBoardingB,
              { type: 'jeepney', coordinates: jeepLegB_coords, routeName: routeB.name, routeId: routeB.id, routeColor: routeB.color, mode: routeB.name, instructions: `Take ${routeB.name}. Alight near ${bestAlightingB_for_Dest.walkLeg.startAddress || 'destination approach'}.`, jeepBoardingPointInfo: `near ${walkToBoardingB.endAddress || 'boarding area'}`, jeepAlightingPointInfo: `near ${bestAlightingB_for_Dest.walkLeg.startAddress || 'alighting area'}`},
              bestAlightingB_for_Dest.walkLeg,
            ];
            tripOptions.push(plan);
            console.log(`    -> SUCCESS: One-transfer option added: ${routeA.name} -> ${routeB.name}.`);
          } else {
            console.log(`          - FAILED: Jeep A or B path was too short for transfer ${routeA.name} -> ${routeB.name}.`);
          }
        } else {
            console.log(`          - No suitable alighting point found on ${routeB.name} for transfer from ${routeA.name}.`);
        }
      }
    }
  }

  // Sort tripOptions
  console.log("\n[PlanTrip STAGE 4] Sorting all found trip options...");
  tripOptions.sort((planA, planB) => {
    const getScore = (plan: PlannedTripLeg[]) => {
      let score = 0;
      let totalWalkDuration = 0;
      let numJeepLegs = 0;
      let isOnlyDirectWalk = true;
      plan.forEach(leg => {
        if (leg.type === 'walk') {
          totalWalkDuration += (typeof leg.duration === 'number' ? leg.duration : 30 * 60);
        } else if (leg.type === 'jeepney') {
          numJeepLegs++;
          isOnlyDirectWalk = false;
          score += 5 * 60; // Base penalty for using a jeep (e.g., wait time)
        }
      });
      score += totalWalkDuration; 
      score += numJeepLegs * 10 * 60; // Increased penalty for each jeep leg (transfer implication)

      if (isOnlyDirectWalk && typeof plan[0]?.distance === 'number' && plan[0].distance <= PREFERRED_MAX_WALK_ONLY_DISTANCE) {
        return totalWalkDuration - 50000; // Make very short walks highly preferred
      } else if (isOnlyDirectWalk) {
        return totalWalkDuration + 1000 * 60; // Penalize long direct walks
      }
      return score;
    };
    return getScore(planA) - getScore(planB);
  });

  if (tripOptions.length > 0) {
    console.log(`[PlanTrip END] Found ${tripOptions.length} trip options. Best option (${tripOptions[0].length} legs):`, JSON.stringify(tripOptions[0].map(leg => ({type: leg.type, name: leg.routeName, instructions: leg.instructions.substring(0,50) + "..." }))));
  } else {
    console.log("[PlanTrip END] No trip options found.");
  }
  return tripOptions;
}
