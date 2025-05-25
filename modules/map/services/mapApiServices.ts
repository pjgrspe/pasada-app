// pasada-gemini/modules/map/services/mapApiServices.ts
import { gMapsApiKey } from '@/APIKeys';
import { regionFromCoordinates as mapRegionFromCoordinates } from '../utils/mapHelpers'; // Renamed import to avoid conflict
import { Coordinate, GoogleDirectionsResponse, PlannedTripLeg } from '../utils/routeTypes'; // Import from new types file
import { planTrip as planJeepneyTrip } from './tripPlannerServices'; // Import from new trip planning service

// --- Constants (if any specific to this file, otherwise keep in tripPlanningService) ---
const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers (can be shared or kept here if used by other funcs)

// --- General Map/API Helper Functions ---

/**
 * Decodes a Google Maps polyline string into an array of coordinates.
 * @param encoded The encoded polyline string.
 * @returns An array of Coordinate objects.
 */
export function decodeGooglePolyline(encoded: string): Coordinate[] {
  // Standard algorithm for decoding Google Polylines (same as before)
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates: Coordinate[] = [],
    shift = 0,
    result = 0,
    byte,
    latitude_change,
    longitude_change;

  while (index < encoded.length) {
    byte = null;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change;
    lng += longitude_change;
    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coordinates;
}

/**
 * Calculates the Haversine distance between two coordinates.
 * @param coord1 The first coordinate.
 * @param coord2 The second coordinate.
 * @returns The distance in meters.
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const lat1 = coord1.latitude * Math.PI / 180;
  const lat2 = coord2.latitude * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000; // Distance in meters
}

/**
 * Fetches walking directions from Google Directions API.
 * @param start The starting coordinate.
 * @param end The ending coordinate.
 * @returns A Promise resolving to a PlannedTripLeg or null.
 */
export async function getWalkingDirections(start: Coordinate, end: Coordinate): Promise<PlannedTripLeg | null> {
  if (!start || !end) {
    console.warn("mapApiServices.getWalkingDirections: Start or end coordinate is missing.");
    return null;
  }
  try {
    if (gMapsApiKey === null) {
        console.warn("Google Maps API Key is not configured in APIkeys.ts for getWalkingDirections.");
        return null;
    }
    const apiKey = gMapsApiKey;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start.latitude},${start.longitude}&destination=${end.latitude},${end.longitude}&mode=walking&key=${apiKey}`;
    const response = await fetch(url);
    const data: GoogleDirectionsResponse = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      const coordinates = decodeGooglePolyline(route.overview_polyline.points);
      const instructions = leg.steps.map(step => step.html_instructions.replace(/<[^>]*>/g, '')).join('; ');

      return {
        type: 'walk',
        coordinates,
        distance: leg.distance.value,
        duration: leg.duration.value,
        instructions: instructions,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        mode: 'walking',
      };
    } else {
      console.warn(`Walking directions API error: ${data.status}`, data.error_message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching walking directions:", error);
    return null;
  }
}

/**
 * Geocodes an address using a mock implementation.
 * @param address The address string to geocode.
 * @returns A Promise resolving to geocoded data or null.
 */
export async function geocode(address: string): Promise<{ coordinate: Coordinate; formattedAddress: string; } | null> {
    console.warn(`mapApiService.geocode is using mock data for: ${address}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    if (address.toLowerCase().includes("manila")) {
        return {
            coordinate: { latitude: 14.5995, longitude: 120.9842 },
            formattedAddress: "Manila, Metro Manila, Philippines",
        };
    } else if (address.toLowerCase().includes("quezon city")) {
        return {
            coordinate: { latitude: 14.6760, longitude: 121.0437 },
            formattedAddress: "Quezon City, Metro Manila, Philippines",
        };
    } else if (address.toLowerCase().includes("malolos")) {
        return {
            coordinate: { latitude: 14.8433, longitude: 120.8134 },
            formattedAddress: "Malolos, Bulacan, Philippines",
        };
    }
    console.warn(`No mock geocode found for: ${address}`);
    return null;
}

// --- Service Object ---
const mapApiService = {
  // Kept for compatibility if used elsewhere, but jeepney planning uses planJeepneyTrip
  getDirections: async (start: Coordinate, end: Coordinate): Promise<any | null> => {
    console.warn("mapApiService.getDirections is a mock. Use planTrip from tripPlanningService for jeepney routing.");
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
        coordinates: [start, { latitude: (start.latitude + end.latitude) / 2, longitude: (start.longitude + end.longitude) / 2 }, end],
        distance: 10000,
        duration: 600,
    };
  },
  geocode,
  planTrip: planJeepneyTrip, // Use the imported trip planner
  decodeGooglePolyline,
  calculateDistance,
  getWalkingDirections,
  regionFromCoordinates: mapRegionFromCoordinates, // Re-export the helper from mapHelpers
};

export default mapApiService;
