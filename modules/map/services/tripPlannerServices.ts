// pasada-gemini/modules/map/services/tripPlanningService.ts
import { allJeepneyRoutes } from './jeepneyDataService'; // Your local jeepney routes data
import { Coordinate, JeepneyRoute, PlannedTripLeg } from '../utils/routeTypes'; // Adjusted path
import { getWalkingDirections, calculateDistance } from './mapApiServices'; // Import helpers from mapApiServices

// --- Constants ---
const MAX_WALK_DISTANCE_TO_JEEP = 700; // meters
const MAX_WALK_DISTANCE_FOR_TRANSFER = 400; // meters

/**
 * Finds the closest point on a jeepney route to a given coordinate.
 * This version projects the point onto each segment for better accuracy.
 * @param point The target coordinate.
 * @param route The JeepneyRoute object.
 * @returns An object containing the segment index, distance, and the exact point on the polyline.
 */
export function findNearestPointOnRoute(
    point: Coordinate,
    route: JeepneyRoute
  ): { accessPoint: Coordinate; segmentIndex: number; distanceToPoint: number; pointOnPolyline: Coordinate } {
    let minDistance = Infinity;
    let bestSegmentIndex = -1;
    let closestPointOnPolyline: Coordinate = route.coordinates[0];

    if (!route.coordinates || route.coordinates.length === 0) {
        console.warn(`Route ${route.id} has no coordinates.`);
        return {
            accessPoint: point, // Fallback
            segmentIndex: -1,
            distanceToPoint: Infinity,
            pointOnPolyline: point,
        };
    }
     if (route.coordinates.length === 1) { // Handle route with a single point
        const dist = calculateDistance(point, route.coordinates[0]);
        return {
            accessPoint: route.coordinates[0],
            segmentIndex: 0, // Or -1 if a segment implies two points
            distanceToPoint: dist,
            pointOnPolyline: route.coordinates[0],
        };
    }


    for (let i = 0; i < route.coordinates.length - 1; i++) {
      const p1 = route.coordinates[i];
      const p2 = route.coordinates[i + 1];

      const l2 = (p2.latitude - p1.latitude)**2 + (p2.longitude - p1.longitude)**2;
      if (l2 === 0) {
        const dist = calculateDistance(point, p1);
        if (dist < minDistance) {
          minDistance = dist;
          closestPointOnPolyline = p1;
          bestSegmentIndex = i;
        }
        continue;
      }

      let t = ((point.latitude - p1.latitude) * (p2.latitude - p1.latitude) + (point.longitude - p1.longitude) * (p2.longitude - p1.longitude)) / l2;
      t = Math.max(0, Math.min(1, t));

      const projection: Coordinate = {
        latitude: p1.latitude + t * (p2.latitude - p1.latitude),
        longitude: p1.longitude + t * (p2.longitude - p1.longitude),
      };

      const distToProjection = calculateDistance(point, projection);
      if (distToProjection < minDistance) {
        minDistance = distToProjection;
        closestPointOnPolyline = projection;
        bestSegmentIndex = i;
      }
    }
     // Check distance to the very last point as well, as the loop stops at length - 1 for segments
    const lastPoint = route.coordinates[route.coordinates.length - 1];
    const distToLast = calculateDistance(point, lastPoint);
    if (distToLast < minDistance) {
        minDistance = distToLast;
        closestPointOnPolyline = lastPoint;
        // If the last point is closest, the relevant segment is the one ending at this last point
        bestSegmentIndex = route.coordinates.length - 2 >= 0 ? route.coordinates.length - 2 : 0;
    }


    return {
      accessPoint: closestPointOnPolyline, // The exact projected point
      segmentIndex: bestSegmentIndex, // Start index of the segment this point lies on or is nearest to
      distanceToPoint: minDistance,
      pointOnPolyline: closestPointOnPolyline,
    };
}

/**
 * Extracts a segment of a jeepney route's coordinates.
 * @param route The JeepneyRoute object.
 * @param startVertexIndex The starting vertex index on the route.
 * @param endVertexIndex The ending vertex index on the route.
 * @returns An array of Coordinates for the segment.
 */
export function getJeepneyRidePath(
    routeCoordinates: Coordinate[],
    projectedStartPoint: Coordinate,
    projectedEndPoint: Coordinate,
    startSegmentIndex: number, // Index of the segment where projectedStartPoint lies
    endSegmentIndex: number   // Index of the segment where projectedEndPoint lies
  ): Coordinate[] {
    if (!routeCoordinates || routeCoordinates.length < 2 || startSegmentIndex < 0 || endSegmentIndex < 0 || startSegmentIndex >= routeCoordinates.length -1 || endSegmentIndex >= routeCoordinates.length -1) {
      return [projectedStartPoint, projectedEndPoint].filter(p => p) as Coordinate[]; // Basic fallback
    }

    // Ensure start is before end in terms of segment indices
    if (startSegmentIndex > endSegmentIndex) {
        // This case might indicate an issue or a need for more complex loop handling
        // For now, return a direct line if this happens, or an empty array
        return [projectedStartPoint, projectedEndPoint];
    }

    const path: Coordinate[] = [projectedStartPoint];

    // Add intermediate full vertices from the original route
    // Start adding from the vertex *after* the startSegmentIndex, up to the start of the endSegmentIndex
    for (let i = startSegmentIndex + 1; i <= endSegmentIndex; i++) {
      path.push(routeCoordinates[i]);
    }

    // Add the projected end point, ensuring it's not too close to the last added vertex
    if (calculateDistance(path[path.length - 1], projectedEndPoint) > 1) { // 1 meter threshold
      path.push(projectedEndPoint);
    }
    return path;
}


/**
 * Main trip planning function.
 * @param origin The starting coordinate.
 * @param destination The ending coordinate.
 * @returns A Promise resolving to an array of possible trip plans.
 */
export async function planTrip(origin: Coordinate, destination: Coordinate): Promise<Array<PlannedTripLeg[]>> {
  const tripOptions: Array<PlannedTripLeg[]> = [];

  // 1. Direct Walking
  console.log("TripPlanningService: Checking direct walk...");
  const directWalkLeg = await getWalkingDirections(origin, destination);
  if (directWalkLeg && directWalkLeg.coordinates.length > 0) {
    tripOptions.push([directWalkLeg]);
  }

  // 2. Single Jeepney Ride
  console.log("TripPlanningService: Checking single jeepney rides...");
  for (const jeepRoute of allJeepneyRoutes) {
    const nearestToOriginResult = findNearestPointOnRoute(origin, jeepRoute);
    const nearestToDestResult = findNearestPointOnRoute(destination, jeepRoute);

    if (nearestToOriginResult.segmentIndex === -1 || nearestToDestResult.segmentIndex === -1) {
        continue; // Skip if points couldn't be found on route
    }

    if (nearestToOriginResult.distanceToPoint <= MAX_WALK_DISTANCE_TO_JEEP &&
        nearestToDestResult.distanceToPoint <= MAX_WALK_DISTANCE_TO_JEEP &&
        nearestToOriginResult.segmentIndex <= nearestToDestResult.segmentIndex) { // Basic direction check

      const walkToBoarding = await getWalkingDirections(origin, nearestToOriginResult.pointOnPolyline);
      const walkFromAlighting = await getWalkingDirections(nearestToDestResult.pointOnPolyline, destination);

      if (walkToBoarding && walkFromAlighting) {
        const jeepneyRideCoordinates = getJeepneyRidePath(
            jeepRoute.coordinates,
            nearestToOriginResult.pointOnPolyline,
            nearestToDestResult.pointOnPolyline,
            nearestToOriginResult.segmentIndex,
            nearestToDestResult.segmentIndex
        );

        if (jeepneyRideCoordinates.length >= 2) {
          const jeepneyLeg: PlannedTripLeg = {
            type: 'jeepney',
            coordinates: jeepneyRideCoordinates,
            routeName: jeepRoute.name,
            routeId: jeepRoute.id,
            routeColor: jeepRoute.color,
            mode: jeepRoute.name,
            instructions: `Take the ${jeepRoute.name} jeepney.`,
            distance: "N/A", // Placeholder
            duration: "N/A", // Placeholder
          };
          tripOptions.push([walkToBoarding, jeepneyLeg, walkFromAlighting]);
        }
      }
    }
  }

  // 3. One Transfer (Conceptual - further refinement needed for robustness)
  console.log("TripPlanningService: Checking one-transfer options...");
  for (const routeA of allJeepneyRoutes) {
    for (const routeB of allJeepneyRoutes) {
      if (routeA.id === routeB.id) continue;

      const nearestToOriginOnA = findNearestPointOnRoute(origin, routeA);
      if (nearestToOriginOnA.distanceToPoint > MAX_WALK_DISTANCE_TO_JEEP || nearestToOriginOnA.segmentIndex === -1) continue;

      // Iterate along routeA to find potential transfer points to routeB
      // Consider transfer from points *after* boarding point on routeA
      for (let i = nearestToOriginOnA.segmentIndex; i < routeA.coordinates.length - 1; i++) {
        const potentialTransferOutPointOnA = routeA.coordinates[i+1]; // End of segment i on route A
        const nearestToTransferOnB = findNearestPointOnRoute(potentialTransferOutPointOnA, routeB);

        if (nearestToTransferOnB.distanceToPoint <= MAX_WALK_DISTANCE_FOR_TRANSFER && nearestToTransferOnB.segmentIndex !== -1) {
          const nearestToDestOnB = findNearestPointOnRoute(destination, routeB);

          if (nearestToDestOnB.distanceToPoint <= MAX_WALK_DISTANCE_TO_JEEP &&
              nearestToDestOnB.segmentIndex !== -1 &&
              nearestToTransferOnB.segmentIndex <= nearestToDestOnB.segmentIndex) { // Direction on B

            const walkToBoardingA = await getWalkingDirections(origin, nearestToOriginOnA.pointOnPolyline);

            const jeepA_Path = getJeepneyRidePath(
                routeA.coordinates,
                nearestToOriginOnA.pointOnPolyline,
                potentialTransferOutPointOnA, // Transferring from this point on route A
                nearestToOriginOnA.segmentIndex,
                i // Segment index for potentialTransferOutPointOnA (it's the end of segment i)
            );

            const walkToTransferPoint = await getWalkingDirections(potentialTransferOutPointOnA, nearestToTransferOnB.pointOnPolyline);

            const jeepB_Path = getJeepneyRidePath(
                routeB.coordinates,
                nearestToTransferOnB.pointOnPolyline,
                nearestToDestOnB.pointOnPolyline,
                nearestToTransferOnB.segmentIndex,
                nearestToDestOnB.segmentIndex
            );

            const walkFromAlightingB = await getWalkingDirections(nearestToDestOnB.pointOnPolyline, destination);

            if (walkToBoardingA && jeepA_Path.length >= 2 && walkToTransferPoint && jeepB_Path.length >= 2 && walkFromAlightingB) {
              const plan: PlannedTripLeg[] = [
                walkToBoardingA,
                { type: 'jeepney', coordinates: jeepA_Path, routeName: routeA.name, routeId: routeA.id, routeColor: routeA.color, mode: routeA.name, instructions: `Take ${routeA.name}. Alight for transfer to ${routeB.name}.` },
                walkToTransferPoint,
                { type: 'jeepney', coordinates: jeepB_Path, routeName: routeB.name, routeId: routeB.id, routeColor: routeB.color, mode: routeB.name, instructions: `Take ${routeB.name}.` },
                walkFromAlightingB,
              ];
              tripOptions.push(plan);
            }
          }
        }
      }
    }
  }

  tripOptions.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const durationA = a.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
    const durationB = b.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
    return durationA - durationB;
  });

  console.log(`TripPlanningService: Found ${tripOptions.length} trip options.`);
  return tripOptions;
}
