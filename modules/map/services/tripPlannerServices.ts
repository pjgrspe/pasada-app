import {
  Coordinate,
  PlannedTripLeg,
} from '../utils/routeTypes';
import {
  getWalkingDirections,
  getDrivingDirections,
  calculateDistance,
} from './mapApiServices';
import { calculateDistanceOfPolyline } from '../utils/mapHelpers';
import { AlignedJeepInfo, findBestAlignedJeepney } from './jeepneyAlignmentService';
import { postProcessTripLegs } from './tripRefinementService';
import { trimJeepLeg } from '../utils/tripUtils';
import {
    MAX_WALK_TO_JEEP_METERS,
    MAX_FINAL_WALK_METERS,
    MIN_JEEP_RIDE_PROGRESS_METERS,
    MAX_TRIP_LEGS,
    MAX_TRIP_OPTIONS_TO_RETURN
} from '../constants/tripPlanningConstants';


async function _planSingleTripWithGuide(
  origin: Coordinate,
  destination: Coordinate,
  desiredPathPolyline: Coordinate[]
): Promise<PlannedTripLeg[]> {
  let plannedLegs: PlannedTripLeg[] = [];
  let currentLocation = origin;
  let currentDesiredPathIndex = 0;
  let lastJeepRouteIdTaken: string | undefined = undefined;
  let consecutiveShortJeepLegsOnSameRoute = 0;


  for (let legCount = 0; legCount < MAX_TRIP_LEGS; legCount++) {
    const distanceToFinalDest = calculateDistance(currentLocation, destination);

    // Check 1: Very close to final destination
    if (distanceToFinalDest < 100) { // Significantly reduced from 200
        if (distanceToFinalDest > 5) { // Add a tiny walk if not exactly there
            const finalMicroWalk = await getWalkingDirections(currentLocation, destination);
            if (finalMicroWalk) plannedLegs.push(finalMicroWalk);
        }
        currentLocation = destination; // Mark as arrived
        break; // Exit loop
    }

    // Check 2: Reached end of desired path (or path is too short)
    if (currentDesiredPathIndex >= desiredPathPolyline.length - 1 && desiredPathPolyline.length > 0) {
         // console.log(`[PlanTripSingle] Reached end of desired path. Final walk from ${JSON.stringify(currentLocation)} to ${JSON.stringify(destination)}`);
         const finalWalk = await getWalkingDirections(currentLocation, destination);
         if (finalWalk && (finalWalk.distance as number > 5)) { // Only add if meaningful
            plannedLegs.push(finalWalk);
         }
         currentLocation = destination;
         break; // Exit loop
    }

    const alignedJeepInfo: AlignedJeepInfo | null = findBestAlignedJeepney(
      currentLocation,
      desiredPathPolyline,
      currentDesiredPathIndex,
      MAX_WALK_TO_JEEP_METERS,
      destination
    );

    if (alignedJeepInfo) {
        // Anti-oscillation for short, repetitive jeep segments on the same route
        if (alignedJeepInfo.jeepRoute.id === lastJeepRouteIdTaken &&
            calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 120 && // If walk to board is short
            calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS * 1.8) { // And jeep ride itself is short
            consecutiveShortJeepLegsOnSameRoute++;
            if (consecutiveShortJeepLegsOnSameRoute > 0) { // Allow one short segment, penalize more
                // console.log(`[PlanTripSingle] Consecutive short jeep leg on same route (${alignedJeepInfo.jeepRoute.name}). Forcing walk.`);
                // Force a walk along the desired path for a bit to break the cycle
                const nextSignificantDpIdx = Math.min(currentDesiredPathIndex + Math.floor(MIN_JEEP_RIDE_PROGRESS_METERS / 40) /*~5 points ahead*/, desiredPathPolyline.length - 1);
                if (nextSignificantDpIdx > currentDesiredPathIndex) {
                    const forcedWalk = await getWalkingDirections(currentLocation, desiredPathPolyline[nextSignificantDpIdx]);
                    if (forcedWalk && forcedWalk.coordinates.length > 1 && (forcedWalk.distance as number > 10)) {
                        plannedLegs.push(forcedWalk);
                        currentLocation = forcedWalk.coordinates.slice(-1)[0];
                        currentDesiredPathIndex = nextSignificantDpIdx;
                        lastJeepRouteIdTaken = undefined; // Reset last jeep route
                        consecutiveShortJeepLegsOnSameRoute = 0; // Reset counter
                        continue; // Restart decision for next leg
                    }
                }
            }
        } else {
            consecutiveShortJeepLegsOnSameRoute = 0; // Reset if different route or conditions not met
        }


      const walkToBoardLeg = await getWalkingDirections(currentLocation, alignedJeepInfo.boardingPointOnJeep);
      const walkDistanceToBoard = (walkToBoardLeg?.distance as number) ?? Infinity;

      if (walkToBoardLeg && walkDistanceToBoard <= MAX_WALK_TO_JEEP_METERS) {
        if (walkDistanceToBoard > 5) { // Only add meaningful walk legs
            // console.log(`[PlanTripSingle] Adding walk to board ${alignedJeepInfo.jeepRoute.name}: ${walkDistanceToBoard.toFixed(0)}m`);
            plannedLegs.push(walkToBoardLeg);
        }
        currentLocation = alignedJeepInfo.boardingPointOnJeep;

        const jeepRideCoordinates = trimJeepLeg(
            alignedJeepInfo.jeepRoute.coordinates,
            alignedJeepInfo.boardingPointOnJeep,
            alignedJeepInfo.alightPointOnJeep,
            alignedJeepInfo.jeepBoardingVertexIndex,
            alignedJeepInfo.jeepAlightingVertexIndex,
            alignedJeepInfo.tookLoop,
            alignedJeepInfo.loopConnectIndex
        );

        const jeepRideDist = calculateDistanceOfPolyline(jeepRideCoordinates);

        if (jeepRideCoordinates.length >= 2 && jeepRideDist >= MIN_JEEP_RIDE_PROGRESS_METERS) {
            // console.log(`[PlanTripSingle] Adding jeep leg on ${alignedJeepInfo.jeepRoute.name}: ${jeepRideDist.toFixed(0)}m. Took Loop: ${alignedJeepInfo.tookLoop}`);
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney',
                coordinates: jeepRideCoordinates,
                routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id,
                routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}${alignedJeepInfo.tookLoop ? ' (route loops)' : ''}.`,
                distance: jeepRideDist,
                duration: (jeepRideDist / (12 * 1000 / 3600)), // Approx duration at 12km/h
                jeepBoardingPointInfo: `Board ${alignedJeepInfo.jeepRoute.name}${alignedJeepInfo.jeepBoardingVertexIndex === 0 ? ' at terminal' : ''}`,
                jeepAlightingPointInfo: `Alight from ${alignedJeepInfo.jeepRoute.name}`,
                jeepLegFullRouteStartIndex: alignedJeepInfo.jeepBoardingVertexIndex,
                jeepLegFullRouteEndIndex: alignedJeepInfo.jeepAlightingVertexIndex,
                isTerminalBoarding: alignedJeepInfo.jeepBoardingVertexIndex === 0,
            };
            plannedLegs.push(jeepRideLeg);
            currentLocation = alignedJeepInfo.alightPointOnJeep;
            currentDesiredPathIndex = alignedJeepInfo.desiredPathEndIndex;
            lastJeepRouteIdTaken = alignedJeepInfo.jeepRoute.id; // Track last jeep route
          } else {
            // console.log(`[PlanTripSingle] Jeep ride on ${alignedJeepInfo.jeepRoute.name} too short (${jeepRideDist.toFixed(0)}m) or too few coords. Planning final walk.`);
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        // console.log(`[PlanTripSingle] Walk to best jeep option (${walkDistanceToBoard.toFixed(0)}m) too far. Planning final walk.`);
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
        currentLocation = destination; // Mark as arrived
        break; // Exit loop
      }
    } else { // No suitable jeep found
      // console.log(`[PlanTripSingle] No suitable jeep found near current desired path point. Trying to walk further along desired path or to destination.`);
      if (distanceToFinalDest > MAX_FINAL_WALK_METERS * 0.75) { // If still far, try to walk along guide path
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
              // console.log(`[PlanTripSingle] Walking along desired path to index ${nextPointIndex}`);
              const partialWalkLeg = await getWalkingDirections(currentLocation, desiredPathPolyline[nextPointIndex]);
              if (partialWalkLeg && (partialWalkLeg.distance as number) > 10) {
                  plannedLegs.push(partialWalkLeg);
                  currentLocation = desiredPathPolyline[nextPointIndex];
                  currentDesiredPathIndex = nextPointIndex;
                  lastJeepRouteIdTaken = undefined; // Reset after a walk
                  consecutiveShortJeepLegsOnSameRoute = 0;
                  continue; // Try finding jeep from new point
              }
          }
      }
      // If close enough or couldn't walk along desired path, walk directly to destination
      // console.log(`[PlanTripSingle] Planning final walk directly to destination.`);
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk && (finalWalk.distance as number > 5)) {
        plannedLegs.push(finalWalk);
      }
      currentLocation = destination; // Mark as arrived
      break; // Exit loop
    }
  }

  // Ensure the last leg actually reaches the destination
  if (plannedLegs.length > 0) {
      const lastLeg = plannedLegs[plannedLegs.length -1];
      if (lastLeg.coordinates && lastLeg.coordinates.length > 0) {
        const lastActualLegEnd = lastLeg.coordinates.slice(-1)[0];
        if (lastActualLegEnd && calculateDistance(lastActualLegEnd, destination) > 10) { // If more than 10m off
            // console.log(`[PlanTripSingle] Adding final connecting walk from ${JSON.stringify(lastActualLegEnd)} to ${JSON.stringify(destination)}`);
            const finalConnectionWalk = await getWalkingDirections(lastActualLegEnd, destination);
            if (finalConnectionWalk && (finalConnectionWalk.distance as number > 5)) {
              plannedLegs.push(finalConnectionWalk);
            }
        }
      }
  } else if (calculateDistance(origin, destination) > 5) { // If no legs were planned at all
       // console.log(`[PlanTripSingle] No legs planned, attempting direct walk from origin to destination.`);
       const directWalkFallback = await getWalkingDirections(origin, destination);
       if (directWalkFallback && (directWalkFallback.distance as number > 5)) {
           plannedLegs.push(directWalkFallback);
       }
  }
  // console.log(`[PlanTripSingle] Initial plan for one guide: ${plannedLegs.length} legs.`);
  return postProcessTripLegs(plannedLegs, destination);
}


export async function planTrip(
  origin: Coordinate,
  destination: Coordinate
): Promise<Array<PlannedTripLeg[]>> {
  console.log(`[PlanTrip Multi-Guide START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);
  const drivingGuideAlternatives: PlannedTripLeg[] | null = await getDrivingDirections(origin, destination);

  if (!drivingGuideAlternatives || drivingGuideAlternatives.length === 0) {
    console.warn("[PlanTrip Multi-Guide] No driving direction guides found. Attempting direct walk.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : []; // Return as an array of trip options
  }
  console.log(`[PlanTrip Multi-Guide] Received ${drivingGuideAlternatives.length} driving guide alternatives.`);

  const allPlannedTripOptions: Array<PlannedTripLeg[]> = [];

  for (let i = 0; i < drivingGuideAlternatives.length; i++) {
    const drivingGuide = drivingGuideAlternatives[i];
    if (!drivingGuide.coordinates || drivingGuide.coordinates.length === 0) {
      console.log(`[PlanTrip Multi-Guide] Skipping driving guide option ${i + 1} due to missing coordinates.`);
      continue;
    }
    console.log(`[PlanTrip Multi-Guide] Processing driving guide option ${i + 1} with ${drivingGuide.coordinates.length} polyline points.`);
    const plannedTripForThisGuide = await _planSingleTripWithGuide(origin, destination, drivingGuide.coordinates);

    if (plannedTripForThisGuide.length > 0) {
        console.log(`[PlanTrip Multi-Guide] -> Successfully planned ${plannedTripForThisGuide.length} legs for guide ${i + 1}.`);
        allPlannedTripOptions.push(plannedTripForThisGuide);
    } else {
        console.log(`[PlanTrip Multi-Guide] -> No jeepney trip could be planned for driving guide ${i + 1}.`);
    }
  }

  if (allPlannedTripOptions.length === 0) {
    console.warn("[PlanTrip Multi-Guide] No jeepney routes planned for any driving guide. Offering direct walk as the only option.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }

  // Sort and slice options
  console.log(`[PlanTrip Multi-Guide END] Found ${allPlannedTripOptions.length} potential trip options before sorting/slicing.`);
  allPlannedTripOptions.sort((optionA, optionB) => {
    const jeepLegsA = optionA.filter(leg => leg.type === 'jeepney').length;
    const jeepLegsB = optionB.filter(leg => leg.type === 'jeepney').length;
    if (jeepLegsA !== jeepLegsB) return jeepLegsA - jeepLegsB; // Fewer jeepney legs first

    const durationA = optionA.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
    const durationB = optionB.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
    if (durationA !== durationB) return durationA - durationB; // Shorter duration first

    return optionA.length - optionB.length; // Fewer total legs first
  });

  const finalOptions = allPlannedTripOptions.slice(0, MAX_TRIP_OPTIONS_TO_RETURN);
  console.log(`[PlanTrip Multi-Guide] Returning ${finalOptions.length} sorted/sliced trip options.`);
  return finalOptions;
}