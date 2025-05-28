// pasada-gemini/modules/map/services/mapApiServices.ts
// Added extensive logging to getDrivingDirections.

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
  if (!coord1 || !coord2) return 0;
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
        return { accessPoint: point, segmentIndex: -1, distanceToPoint: Infinity, pointOnPolyline: point };
    }
    if (route.coordinates.length === 1) {
        const dist = calculateDistance(point, route.coordinates[0]);
        return { accessPoint: route.coordinates[0], segmentIndex: 0, distanceToPoint: dist, pointOnPolyline: route.coordinates[0] };
    }
    closestPointOnPolyline = route.coordinates[0];

    for (let i = 0; i < route.coordinates.length - 1; i++) {
      const p1 = route.coordinates[i];
      const p2 = route.coordinates[i + 1];
      if(!p1 || !p2) continue;

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
    if (lastPoint) {
        const distToLast = calculateDistance(point, lastPoint);
        if (distToLast < minDistance) {
            minDistance = distToLast;
            closestPointOnPolyline = lastPoint;
            bestSegmentIndex = route.coordinates.length - 2 >= 0 ? route.coordinates.length - 2 : 0;
        }
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
      const instructions = leg.steps
        .map(step => step.html_instructions.replace(/<wbr\/>/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
        .filter(instr => instr.length > 0)
        .join('. ');
      return {
        type: 'walk',
        coordinates,
        distance: leg.distance.value,
        duration: leg.duration.value,
        instructions: instructions || "Walk to destination",
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        mode: 'walking',
      };
    } else {
      console.warn(`[mapApiServices] Walking directions API error: ${data?.status || 'Unknown status'} - ${data?.error_message || 'Unknown API error'}`);
      return null;
    }
  } catch (error) {
    console.error("[mapApiServices] Error fetching walking directions:", error);
    return null;
  }
}

export async function getDrivingDirections(start: Coordinate, end: Coordinate): Promise<PlannedTripLeg[] | null> {
  console.log("[mapApiServices] getDrivingDirections: Called with", {start, end});
  if (!start || !end) {
    console.warn("[mapApiServices] getDrivingDirections: Start or end coordinate is missing.");
    return null;
  }
  try {
    const apiKey = gMapsApiKey;
    if (!apiKey) {
      console.error("[mapApiServices] FATAL: Google Maps API Key is not configured.");
      return null;
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start.latitude},${start.longitude}&destination=${end.latitude},${end.longitude}&mode=driving&alternatives=true&region=ph&key=${apiKey}`;
    console.log("[mapApiServices] getDrivingDirections: Fetching URL:", url);

    const response = await fetch(url);
    const data: GoogleDirectionsResponse = await response.json();
    console.log("[mapApiServices] getDrivingDirections: Raw API Response Status:", data.status);
    // console.log("[mapApiServices] getDrivingDirections: Raw API Data:", JSON.stringify(data, null, 2));


    if (data && data.status === 'OK' && data.routes && data.routes.length > 0) {
      console.log(`[mapApiServices] getDrivingDirections: Found ${data.routes.length} driving routes.`);
      const drivingRouteGuides: PlannedTripLeg[] = data.routes.map((routeItem, index) => {
        const leg = routeItem.legs[0];
        const coordinates = decodeGooglePolyline(routeItem.overview_polyline.points);
        console.log(`[mapApiServices] getDrivingDirections: Processed driving alternative ${index + 1}, polyline length: ${coordinates.length}, summary: ${routeItem.summary || 'N/A'}`);
        return {
          type: 'walk', // Placeholder type for the guide polyline
          coordinates,
          distance: leg.distance.value,
          duration: leg.duration.value,
          instructions: `Driving Guide Option ${index + 1} (${routeItem.summary || ''})`,
          mode: 'driving_guide',
        };
      });
      return drivingRouteGuides;
    } else {
      console.warn(`[mapApiServices] Driving directions API error: ${data?.status || 'Unknown status'} - ${data?.error_message || 'No routes found'}`);
      if (data && data.routes && data.routes.length === 0) {
        console.log("[mapApiServices] getDrivingDirections: API status OK but no routes array or empty routes array.");
      }
      return null;
    }
  } catch (error) {
    console.error("[mapApiServices] Error fetching driving directions:", error);
    return null;
  }
}


export async function geocode(address: string): Promise<{ coordinate: Coordinate; formattedAddress: string; } | null> {
    const apiKey = gMapsApiKey;
    if (!apiKey) {
      console.error("[mapApiServices] FATAL: Google Maps API Key is not configured for geocoding.");
      return null;
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&components=country:PH&region=ph`;
    // console.log(`[mapApiServices] Geocoding URL: ${url}`);
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            const formattedAddress = data.results[0].formatted_address;
            // console.log(`[mapApiServices] Geocoded "${address}" to: ${formattedAddress}`, location);
            return {
                coordinate: { latitude: location.lat, longitude: location.lng },
                formattedAddress: formattedAddress,
            };
        } else {
            console.warn(`[mapApiServices] Geocoding API error for "${address}": ${data.status} - ${data.error_message || 'No results'}`);
            if (address.toLowerCase().includes("nepo mall") || address.toLowerCase().includes("sample start") || address.toLowerCase().includes("diamond subd")) {
                return { coordinate: { latitude: 15.160257, longitude: 120.594434 }, formattedAddress: "Nepo Mall, Angeles City (Mock Fallback)" };
            }
            if (address.toLowerCase().includes("auf") || address.toLowerCase().includes("sample end")) {
                return { coordinate: { latitude: 15.145830, longitude: 120.594995 }, formattedAddress: "Angeles University Foundation, AC (Mock Fallback)" };
            }
            if (address.toLowerCase().includes("friendship")) {
                 return { coordinate: { latitude: 15.169, longitude: 120.53 }, formattedAddress: "Friendship Highway Area (Mock Fallback)" };
            }
            return null;
        }
    } catch (error) {
        console.error(`[mapApiServices] Error during geocoding for "${address}":`, error);
        return null;
    }
}

const mapApiService = {
  geocode,
  decodeGooglePolyline,
  calculateDistance,
  getWalkingDirections,
  getDrivingDirections,
  findNearestPointOnRoute,
  regionFromCoordinates: mapRegionFromCoordinates,
};

export default mapApiService;
