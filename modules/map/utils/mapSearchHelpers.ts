// pasada-gemini/modules/map/utils/mapSearchHelpers.ts
import { Coordinate } from './routeTypes'; // Adjusted path
import { calculateDistance } from '../services/mapApiServices'; // Adjusted path

/**
 * Finds coordinates along a route within a specified search radius from a center point.
 * @param routeCoordinates The array of coordinates representing the route.
 * @param centerVertexIndexInput The index of the vertex in routeCoordinates to search around.
 * @param searchRadiusMeters The radius in meters to search within.
 * @param minSeparationMeters The minimum distance between candidate points to avoid clustering.
 * @returns An array of objects, each containing a candidate coordinate and its index on the route.
 */
export function getCoordinatesInSearchWindow(
    routeCoordinates: Coordinate[],
    centerVertexIndexInput: number,
    searchRadiusMeters: number,
    minSeparationMeters: number
): Array<{point: Coordinate, index: number}> {
    const results: Array<{point: Coordinate, index: number}> = [];
    if (!routeCoordinates || routeCoordinates.length === 0) return results;

    const centerVertexIndex = Math.max(0, Math.min(centerVertexIndexInput, routeCoordinates.length - 1));
    const centerPoint = routeCoordinates[centerVertexIndex];

    if (centerPoint) {
        results.push({point: centerPoint, index: centerVertexIndex});
    } else {
        // This should ideally not happen if centerVertexIndexInput is validated or derived correctly
        console.warn("[getCoordinatesInSearchWindow] Center point not found for index:", centerVertexIndexInput);
        return results;
    }

    let lastAddedPointBackward = centerPoint;
    let accumulatedDistBackward = 0;
    // Search backward from the center point
    for (let i = centerVertexIndex - 1; i >= 0; i--) {
        if (!routeCoordinates[i] || !routeCoordinates[i+1]) continue; // Ensure points are valid
        // Calculate distance from current point to the previous one in this backward iteration
        accumulatedDistBackward += calculateDistance(routeCoordinates[i], routeCoordinates[i+1]);
        if (accumulatedDistBackward > searchRadiusMeters) break; // Stop if outside search radius

        // Add point if it's sufficiently separated from the last added point in this direction
        if (calculateDistance(routeCoordinates[i], lastAddedPointBackward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointBackward = routeCoordinates[i];
        }
    }

    let lastAddedPointForward = centerPoint;
    let accumulatedDistForward = 0;
    // Search forward from the center point
    for (let i = centerVertexIndex + 1; i < routeCoordinates.length; i++) {
         if (i - 1 < 0 ) break; // Should not happen given loop start, but safety
         if (!routeCoordinates[i-1] || !routeCoordinates[i]) continue; // Ensure points are valid
        // Calculate distance from current point to the previous one in this forward iteration
        accumulatedDistForward += calculateDistance(routeCoordinates[i-1], routeCoordinates[i]);
        if (accumulatedDistForward > searchRadiusMeters) break; // Stop if outside search radius

        // Add point if it's sufficiently separated from the last added point in this direction
        if (calculateDistance(routeCoordinates[i], lastAddedPointForward) >= minSeparationMeters) {
            results.push({point: routeCoordinates[i], index: i});
            lastAddedPointForward = routeCoordinates[i];
        }
    }
    return results;
}
