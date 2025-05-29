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
import { useMapStore } from '../store/useMapStore';

export async function planTrip(
  origin: Coordinate,
  destination: Coordinate
): Promise<PlannedTripLeg[][]> {
  const { setLoadingStatus } = useMapStore.getState();
  
  setLoadingStatus('🗺️ Getting driving directions from Google Maps...');
  
  const drivingGuides = await getDrivingDirections(origin, destination);
  if (!drivingGuides || drivingGuides.length === 0) {
    setLoadingStatus('⚠️ No driving routes available, creating direct walking route...');
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }

  setLoadingStatus(`🚌 Found ${drivingGuides.length} possible route${drivingGuides.length > 1 ? 's' : ''}, searching for jeepney connections...`);
  
  const allProcessedTripOptions: PlannedTripLeg[][] = [];

  for (let i = 0; i < drivingGuides.length; i++) {
    const drivingGuide = drivingGuides[i];
    
    setLoadingStatus(`🔍 Analyzing route ${i + 1} of ${drivingGuides.length} - Finding optimal jeepney segments...`);
    
    if (!drivingGuide.coordinates || drivingGuide.coordinates.length === 0) {
      continue;
    }
    
    const plannedTripForThisGuide = await _planSingleTripWithGuide(origin, destination, drivingGuide.coordinates);

    if (plannedTripForThisGuide.length > 0) {
        allProcessedTripOptions.push(plannedTripForThisGuide);
    }
  }

  if (allProcessedTripOptions.length === 0) {
    setLoadingStatus('🚶 No jeepney routes possible, providing walking directions...');
    const directWalk = await getWalkingDirections(origin, destination);
    return directWalk ? [[directWalk]] : [];
  }

  setLoadingStatus(`⚖️ Evaluating ${allProcessedTripOptions.length} route option${allProcessedTripOptions.length > 1 ? 's' : ''} - Comparing efficiency and transfers...`);

  const evaluatedResults: EvaluatedTripResults = evaluateAndFilterTripOptions(allProcessedTripOptions);

  const finalOptionsToPresent: PlannedTripLeg[][] = [];
  if (evaluatedResults.recommended && evaluatedResults.recommended.length > 0) {
      finalOptionsToPresent.push(evaluatedResults.recommended);
  }
  if (evaluatedResults.alternatives && evaluatedResults.alternatives.length > 0) {
      finalOptionsToPresent.push(...evaluatedResults.alternatives);
  }

  setLoadingStatus('✅ Route planning complete! Displaying your best options...');
  
  return finalOptionsToPresent.length > 0 ? finalOptionsToPresent : allProcessedTripOptions;
}

async function _planSingleTripWithGuide(
  origin: Coordinate,
  destination: Coordinate,
  desiredPathPolyline: Coordinate[]
): Promise<PlannedTripLeg[]> {
  const { setLoadingStatus } = useMapStore.getState();
  
  let plannedLegs: PlannedTripLeg[] = [];
  let currentLocation = origin;
  let currentDesiredPathIndex = 0;
  let lastJeepRouteIdTaken: string | undefined = undefined;
  let consecutiveShortJeepLegsOnSameRoute = 0;

  setLoadingStatus('🎯 Starting route optimization from your location...');

  for (let legCount = 0; legCount < MAX_TRIP_LEGS; legCount++) {
    const distanceToFinalDest = calculateDistance(currentLocation, destination);

    if (distanceToFinalDest < 100) {
        setLoadingStatus('🏁 Almost there! Planning final approach...');
        if (distanceToFinalDest > 5) {
            const finalMicroWalk = await getWalkingDirections(currentLocation, destination);
            if (finalMicroWalk) plannedLegs.push(finalMicroWalk);
        }
        currentLocation = destination;
        break;
    }

    if (currentDesiredPathIndex >= desiredPathPolyline.length - 1 && desiredPathPolyline.length > 0) {
         setLoadingStatus('🚶 Planning final walking segment to destination...');
         const finalWalk = await getWalkingDirections(currentLocation, destination);
         if (finalWalk && (finalWalk.distance as number > 5)) {
            plannedLegs.push(finalWalk);
         }
         currentLocation = destination;
         break;
    }

    setLoadingStatus(`🔎 Looking for nearby jeepney routes (${legCount + 1}/${MAX_TRIP_LEGS} segments)...`);

    const alignedJeepInfo: AlignedJeepInfo | null = findBestAlignedJeepney(
      currentLocation,
      desiredPathPolyline,
      currentDesiredPathIndex,
      MAX_WALK_TO_JEEP_METERS,
      destination
    );

    if (alignedJeepInfo) {
        setLoadingStatus(`🚌 Found ${alignedJeepInfo.jeepRoute.name} - Calculating boarding and alighting points...`);
        
        if (alignedJeepInfo.jeepRoute.id === lastJeepRouteIdTaken &&
            calculateDistance(currentLocation, alignedJeepInfo.boardingPointOnJeep) < 120 &&
            calculateDistance(alignedJeepInfo.boardingPointOnJeep, alignedJeepInfo.alightPointOnJeep) < MIN_JEEP_RIDE_PROGRESS_METERS * 1.8) {
            consecutiveShortJeepLegsOnSameRoute++;
            if (consecutiveShortJeepLegsOnSameRoute > 0) {
                setLoadingStatus('🔄 Optimizing route to avoid short segments...');
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
        setLoadingStatus(`🚶‍♂️ Adding ${Math.round(walkDistanceToBoard)}m walk to ${alignedJeepInfo.jeepRoute.name} boarding point...`);
        
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
             setLoadingStatus('🚶 No suitable jeepney nearby, planning walking route to destination...');
             const finalWalk = await getWalkingDirections(currentLocation, destination);
             if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
             currentLocation = destination; break;
          }
      } else {
        setLoadingStatus('🚶 No suitable jeepney nearby, planning walking route to destination...');
        const finalWalk = await getWalkingDirections(currentLocation, destination);
        if (finalWalk && (finalWalk.distance as number > 5)) plannedLegs.push(finalWalk);
        currentLocation = destination;
        break;
      }
    } else {
      if (distanceToFinalDest > MAX_FINAL_WALK_METERS * 0.75) {
          setLoadingStatus('📍 Exploring alternative walking paths...');
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
      setLoadingStatus('🚶 Completing journey with walking directions...');
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
  setLoadingStatus('🔧 Optimizing route segments and connections...');
  // Pass origin (absolute trip origin) and allGuidingPaths to postProcessTripLegs
  // For this reverted version, postProcessTripLegs only needs legs and destination
  return postProcessTripLegs(plannedLegs, destination);
}