// pasada-gemini/modules/map/services/mapApiServices.ts
import { gMapsApiKey } from '@/APIkeys';
import { regionFromCoordinates as mapRegionFromCoordinates } from '../utils/mapHelpers';
import { Coordinate, GoogleDirectionsResponse, PlannedTripLeg, JeepneyRoute } from '../utils/routeTypes';

const EARTH_RADIUS_KM = 6371;

export function decodeGooglePolyline(encoded: string): Coordinate[] {
  let index = 0, lat = 0, lng = 0, coordinates: Coordinate[] = [], shift = 0, result = 0, byte, latitude_change, longitude_change;
  while (index < encoded.length) {
    byte = null; shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coordinates;
}

export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const lat1 = coord1.latitude * Math.PI / 180;
  const lat2 = coord2.latitude * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000;
}

export function findNearestPointOnRoute(
    point: Coordinate,
    route: JeepneyRoute
  ): { accessPoint: Coordinate; segmentIndex: number; distanceToPoint: number; pointOnPolyline: Coordinate } {
    let minDistance = Infinity;
    let bestSegmentIndex = -1;
    let closestPointOnPolyline: Coordinate | null = null;

    if (!route.coordinates || route.coordinates.length === 0) {
        console.warn(`Route ${route.id} has no coordinates.`);
        return {
            accessPoint: point,
            segmentIndex: -1,
            distanceToPoint: Infinity,
            pointOnPolyline: point,
        };
    }
    if (route.coordinates.length === 1) {
        const dist = calculateDistance(point, route.coordinates[0]);
        return {
            accessPoint: route.coordinates[0],
            segmentIndex: 0,
            distanceToPoint: dist,
            pointOnPolyline: route.coordinates[0],
        };
    }

    closestPointOnPolyline = route.coordinates[0];

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
    const lastPoint = route.coordinates[route.coordinates.length - 1];
    const distToLast = calculateDistance(point, lastPoint);
    if (distToLast < minDistance) {
        minDistance = distToLast;
        closestPointOnPolyline = lastPoint;
        bestSegmentIndex = route.coordinates.length - 2 >= 0 ? route.coordinates.length - 2 : 0;
    }
    return {
      accessPoint: closestPointOnPolyline!,
      segmentIndex: bestSegmentIndex,
      distanceToPoint: minDistance,
      pointOnPolyline: closestPointOnPolyline!,
    };
}

export async function getWalkingDirections(start: Coordinate, end: Coordinate): Promise<PlannedTripLeg | null> {
  if (!start || !end) {
    console.warn("mapApiServices.getWalkingDirections: Start or end coordinate is missing.");
    return null;
  }
  try {
    const apiKey = gMapsApiKey;
    if (!apiKey) {
        console.error("FATAL: Google Maps API Key is not configured in APIkeys.ts or is empty.");
        return null;
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start.latitude},${start.longitude}&destination=${end.latitude},${end.longitude}&mode=walking&key=${apiKey}`;
    const response = await fetch(url);
    const data: GoogleDirectionsResponse = await response.json();

    if (data && data.status === 'OK' && data.routes && data.routes.length > 0) {
      const routeItem = data.routes[0];
      const leg = routeItem.legs[0];
      const coordinates = decodeGooglePolyline(routeItem.overview_polyline.points);
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
      const errorMessage = data?.error_message || 'Unknown API error';
      console.warn(`Walking directions API error: ${data?.status || 'Unknown status'} - ${errorMessage}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching walking directions:", error);
    return null;
  }
}

export async function geocode(address: string): Promise<{ coordinate: Coordinate; formattedAddress: string; } | null> {
    console.warn(`mapApiService.geocode is using mock data for: ${address}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    if (address.toLowerCase().includes("manila")) {
        return { coordinate: { latitude: 14.5995, longitude: 120.9842 }, formattedAddress: "Manila, Metro Manila, Philippines" };
    } // ... other mock geocode cases
    console.warn(`No mock geocode found for: ${address}`);
    return null;
}

// This object now only exports functions defined within this file or general utilities.
const mapApiService = {
  geocode,
  decodeGooglePolyline,
  calculateDistance,
  getWalkingDirections,
  findNearestPointOnRoute,
  regionFromCoordinates: mapRegionFromCoordinates,
  // REMOVED: planTrip: planJeepneyTrip,
  // The old mock getDirections can also be removed if no longer needed.
  getDirections: async (start: Coordinate, end: Coordinate): Promise<any | null> => {
    console.warn("mapApiService.getDirections is a mock and likely deprecated. Use functions from tripPlannerService for actual routing.");
    return null;
  },
};

export default mapApiService;
