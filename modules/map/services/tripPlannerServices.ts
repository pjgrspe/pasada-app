// pasada-gemini/modules/map/services/tripPlannerServices.ts
import {
  Coordinate,
  PlannedTripLeg,
  // JeepneyRoute, // Not directly used here
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
    MAX_TRIP_OPTIONS_TO_RETURN // This will now be primarily enforced by the evaluator
} from '../constants/tripPlanningConstants';
import { evaluateAndFilterTripOptions, EvaluatedTripResults } from './tripOptionEvaluator'; // NEW IMPORT

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
         if (finalWalk && (finalWalk.distance as number > 5)) {
            plannedLegs.push(finalWalk);
         }
         currentLocation = destination;
         break;
    }

    const alignedJeepInfo: AlignedJeepInfo | null = findBestAlignedJeepney(
      currentLocation,
      desiredPathPolyline,
      currentDesiredPathIndex,
      MAX_WALK_TO_JEEP_METERS,
      destination
    );

    if (alignedJeepInfo) {
        if (alignedJeepInfo.jeepRoute.id === lastJeepRouteIdTaken &&
            calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 120 &&
            calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS * 1.8) {
            consecutiveShortJeepLegsOnSameRoute++;
            if (consecutiveShortJeepLegsOnSameRoute > 0) {
                const nextSignificantDpIdx = Math.min(currentDesiredPathIndex + Math.floor(MIN_JEEP_RIDE_PROGRESS_METERS / 40), desiredPathPolyline.length - 1);
                if (nextSignificantDpIdx > currentDesiredPathIndex && desiredPathPolyline[nextSignificantDpIdx]) {
                    const forcedWalk = await getWalkingDirections(currentLocation, desiredPathPolyline[nextSignificantDpIdx]);
                    if (forcedWalk && forcedWalk.coordinates.length > 1 && (forcedWalk.distance as number > 10)) {
                        plannedLegs.push(forcedWalk);
                        currentLocation = forcedWalk.coordinates.slice(-1)[0];
                        currentDesiredPathIndex = nextSignificantDpIdx;
                        lastJeepRouteIdTaken = undefined;
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
            alignedJeepInfo.alightPointOnJeep,
            alignedJeepInfo.jeepBoardingVertexIndex,
            alignedJeepInfo.jeepAlightingVertexIndex,
            alignedJeepInfo.tookLoop,
            alignedJeepInfo.loopConnectIndex
        );

        const jeepRideDist = calculateDistanceOfPolyline(jeepRideCoordinates);

        if (jeepRideCoordinates.length >= 2 && jeepRideDist >= MIN_JEEP_RIDE_PROGRESS_METERS) {
            const jeepRideLeg: PlannedTripLeg = {
                type: 'jeepney',
                coordinates: jeepRideCoordinates,
                routeName: alignedJeepInfo.jeepRoute.name,
                routeId: alignedJeepInfo.jeepRoute.id,
                routeColor: alignedJeepInfo.jeepRoute.color,
                instructions: `Take ${alignedJeepInfo.jeepRoute.name}${alignedJeepInfo.tookLoop ? ' (route loops)' : ''}.`,
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
        currentLocation = destination;
        break;
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
                  consecutiveShortJeepLegsOnSameRoute = 0;
                  continue;
              }
          }
      }
      const finalWalk = await getWalkingDirections(currentLocation, destination);
      if (finalWalk && (finalWalk.distance as number > 5)) {
        plannedLegs.push(finalWalk);
      }
      currentLocation = destination;
      break;
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
       if (directWalkFallback && (directWalkFallback.distance as number > 5)) {
           plannedLegs.push(directWalkFallback);
       }
  }
  // Pass origin (absolute trip origin) and allGuidingPaths to postProcessTripLegs
  // For this reverted version, postProcessTripLegs only needs legs and destination
  return postProcessTripLegs(plannedLegs, destination);
}


export async function planTrip(
  origin: Coordinate,
  destination: Coordinate
): Promise<PlannedTripLeg[][]> { // Return type is now an array of trip options
  // console.log(`[PlanTrip Multi-Guide START] Origin: ${JSON.stringify(origin)}, Dest: ${JSON.stringify(destination)}`);
  const drivingGuideAlternatives: PlannedTripLeg[] | null = await getDrivingDirections(origin, destination);

  if (!drivingGuideAlternatives || drivingGuideAlternatives.length === 0) {
    // console.warn("[PlanTrip Multi-Guide] No driving direction guides found. Attempting direct walk.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }
  // console.log(`[PlanTrip Multi-Guide] Received ${drivingGuideAlternatives.length} driving guide alternatives.`);

  let allProcessedTripOptions: PlannedTripLeg[][] = [];

  for (let i = 0; i < drivingGuideAlternatives.length; i++) {
    const drivingGuide = drivingGuideAlternatives[i];
    if (!drivingGuide.coordinates || drivingGuide.coordinates.length === 0) {
      // console.log(`[PlanTrip Multi-Guide] Skipping driving guide option ${i + 1} due to missing coordinates.`);
      continue;
    }
    // console.log(`[PlanTrip Multi-Guide] Processing driving guide option ${i + 1} with ${drivingGuide.coordinates.length} polyline points.`);
    const plannedTripForThisGuide = await _planSingleTripWithGuide(origin, destination, drivingGuide.coordinates);

    if (plannedTripForThisGuide.length > 0) {
        // console.log(`[PlanTrip Multi-Guide] -> Successfully planned ${plannedTripForThisGuide.length} legs for guide ${i + 1}.`);
        allProcessedTripOptions.push(plannedTripForThisGuide);
    } else {
        // console.log(`[PlanTrip Multi-Guide] -> No jeepney trip could be planned for driving guide ${i + 1}.`);
    }
  }

  if (allProcessedTripOptions.length === 0) {
    // console.warn("[PlanTrip Multi-Guide] No jeepney routes planned for any driving guide. Offering direct walk as the only option.");
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }

  // console.log(`[PlanTrip Multi-Guide] Generated ${allProcessedTripOptions.length} raw trip options before evaluation.`);

  // Evaluate and filter options
  const evaluatedResults: EvaluatedTripResults = evaluateAndFilterTripOptions(allProcessedTripOptions);

  const finalOptionsToPresent: PlannedTripLeg[][] = [];
  if (evaluatedResults.recommended && evaluatedResults.recommended.length > 0) {
      finalOptionsToPresent.push(evaluatedResults.recommended);
  }
  evaluatedResults.alternatives.forEach(alt => {
      if (finalOptionsToPresent.length < MAX_TRIP_OPTIONS_TO_RETURN) {
          finalOptionsToPresent.push(alt);
      }
  });

  // console.log(`[PlanTrip Multi-Guide] Returning ${finalOptionsToPresent.length} evaluated and filtered trip options.`);
  return finalOptionsToPresent;
}
