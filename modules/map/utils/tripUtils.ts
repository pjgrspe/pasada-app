// pasada-gemini/modules/map/utils/tripUtils.ts
import { Coordinate } from './routeTypes';
import { calculateDistance } from '../services/mapApiServices';

export function trimJeepLeg(
    fullRouteCoords: Coordinate[],
    newStartCoord: Coordinate,
    newEndCoord: Coordinate,
    originalBoardingIndex?: number, // Index on the fullRouteCoords
    finalAlightingIndex?: number,   // Index on the fullRouteCoords
    tookLoop?: boolean,
    loopConnectIdx?: number
): Coordinate[] {
    if (!fullRouteCoords || fullRouteCoords.length === 0) {
        return newStartCoord && newEndCoord ? [newStartCoord, newEndCoord] : (newStartCoord ? [newStartCoord] : (newEndCoord ? [newEndCoord] : []));
    }
    if (!newStartCoord || !newEndCoord) return [];


    // If indices are not provided, find the closest points on the full route
    // This part might need careful re-evaluation if original indices are crucial
    // and not always available. For now, it defaults to finding closest.
    let startIdx = originalBoardingIndex;
    let endIdx = finalAlightingIndex;

    if (typeof startIdx !== 'number' || typeof endIdx !== 'number') {
        // Fallback: Find closest indices if not provided
        // This might not be ideal if the original indices from planning are important for context
        let tempStartIdx = 0;
        let minDistStart = Infinity;
        for (let i = 0; i < fullRouteCoords.length; i++) {
            if (!fullRouteCoords[i]) continue;
            const dist = calculateDistance(newStartCoord, fullRouteCoords[i]);
            if (dist < minDistStart) {
                minDistStart = dist;
                tempStartIdx = i;
            }
        }
        startIdx = tempStartIdx;

        let tempEndIdx = startIdx; // Start search from the found startIdx
        let minDistEnd = fullRouteCoords[startIdx] ? calculateDistance(fullRouteCoords[startIdx], newEndCoord) : Infinity;

        for (let i = startIdx; i < fullRouteCoords.length; i++) {
            if (!fullRouteCoords[i]) continue;
            const dist = calculateDistance(newEndCoord, fullRouteCoords[i]);
            if (dist < minDistEnd) {
                minDistEnd = dist;
                tempEndIdx = i;
            }
        }
        endIdx = tempEndIdx;
        tookLoop = false; // Cannot reliably determine loop without original indices
    }


    let trimmedCoordinates: Coordinate[] = [];

    if (tookLoop && typeof loopConnectIdx === 'number' && endIdx < startIdx && loopConnectIdx < fullRouteCoords.length) {
        // Handle loop: path goes from startIdx to end of array, then from loopConnectIdx to endIdx
        const part1 = fullRouteCoords.slice(startIdx, fullRouteCoords.length);
        const part2 = fullRouteCoords.slice(loopConnectIdx, endIdx + 1);
        trimmedCoordinates = [...part1, ...part2];
    } else {
        // Standard case or no loop
        if (startIdx <= endIdx && fullRouteCoords[startIdx] && fullRouteCoords[endIdx]) {
            trimmedCoordinates = fullRouteCoords.slice(startIdx, endIdx + 1);
        } else if (fullRouteCoords[startIdx]) { // Only start index valid (or end before start without loop)
            trimmedCoordinates = [fullRouteCoords[startIdx]];
        } else { // Should ideally not happen if startIdx is valid
            trimmedCoordinates = [];
        }
    }

    // Ensure the first and last points match newStartCoord and newEndCoord exactly,
    // if the trimmed segment is not empty.
    if (trimmedCoordinates.length > 0) {
        trimmedCoordinates[0] = newStartCoord; // Set the first point
        if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
           // If only one point after slicing (e.g. start and end are the same on original route),
           // but newStart and newEnd are different, ensure both are present.
           trimmedCoordinates.push(newEndCoord);
        } else if (trimmedCoordinates.length > 1) {
            trimmedCoordinates[trimmedCoordinates.length - 1] = newEndCoord; // Set the last point
        }
    } else {
        // If slicing resulted in an empty array, but we have new start/end, use them.
        trimmedCoordinates = [newStartCoord];
        if (calculateDistance(newStartCoord, newEndCoord) > 1) trimmedCoordinates.push(newEndCoord);
    }

    // Final check if only one point remains but start and end are distinct.
    if (trimmedCoordinates.length === 1 && calculateDistance(newStartCoord, newEndCoord) > 1) {
        trimmedCoordinates.push(newEndCoord);
    }


    return trimmedCoordinates.filter(c => c) as Coordinate[]; // Filter out any undefined from potential bad slices
}