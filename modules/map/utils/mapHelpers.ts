// pasada-app/modules/map/utils/mapHelpers.ts
import { Region } from 'react-native-maps';
import { calculateDistance } from '../services/mapApiServices'; // Adjust the import path as necessary

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculates a region that encompasses all provided coordinates.
 * @param coordinates Array of latitude/longitude objects.
 * @param paddingFactor Optional factor to add padding around the coordinates (e.g., 0.1 for 10% padding).
 * @returns A Region object for react-native-maps.
 */

export function calculateDistanceOfPolyline(polyline: Coordinate[]): number {
    let totalDistance = 0;
    if (!polyline || polyline.length < 2) return 0;
    for (let i = 0; i < polyline.length - 1; i++) {
        totalDistance += calculateDistance(polyline[i], polyline[i+1]);
    }
    return totalDistance;
}

export const regionFromCoordinates = (coordinates: Coordinate[], paddingFactor: number = 0.1): Region | undefined => {
  if (!coordinates || coordinates.length === 0) {
    return undefined;
  }

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  const latitudeDelta = (maxLat - minLat) * (1 + paddingFactor * 2);
  const longitudeDelta = (maxLng - minLng) * (1 + paddingFactor * 2);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, latitudeDelta), // Ensure a minimum delta
    longitudeDelta: Math.max(0.01, longitudeDelta), // Ensure a minimum delta
  };
};

// Add other map-related utility functions here
// e.g., calculateDistance, decodePolyline, etc.