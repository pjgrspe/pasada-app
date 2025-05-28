// pasada-gemini/modules/map/services/jeepneyDataService.ts
import RBush from 'rbush';
import { Coordinate, JeepneyRoute } from '../utils/routeTypes';
// Import all routes from the central jeepRoutes.ts file
import * as AllJeepRouteObjects from '../utils/jeepRoutes'; // Imports all named exports
import { calculateDistance } from './mapApiServices';

// Define a type for the spatial index items
interface SpatialIndexItem {
  minX: number; // minLongitude
  minY: number; // minLatitude
  maxX: number; // maxLongitude
  maxY: number; // maxLatitude
  routeId: string;
  segmentIndex: number; // Index of the start coordinate of the segment
  originalRoute: JeepneyRoute; // Storing the full route object with loop info
}

const jeepSpatialIndex = new RBush<SpatialIndexItem>();
const allJeepneyRoutesById: Map<string, JeepneyRoute> = new Map();

// Constants for loop detection
const LOOP_DETECTION_DISTANCE_THRESHOLD_METERS = 25;
const LOOP_DETECTION_MIN_COORDINATES_FOR_LOOP = 10;
const LOOP_DETECTION_IGNORE_END_SEGMENTS = 5;
const DEFAULT_FALLBACK_ROUTE_COLOR = '#808080'; // Grey, for routes without a defined color

let isInitialized = false;

/**
 * Analyzes routes for loops and populates the spatial index.
 * This should be called once at application startup.
 */
export function initializeJeepneySpatialIndex(): void {
  if (isInitialized) {
    return;
  }
  console.log("[jeepneyDataService] Initializing Jeepney spatial index, processing routes, and analyzing for loops...");

  const rawRoutesList: unknown[] = Object.values(AllJeepRouteObjects);
  const typedRawRoutes: JeepneyRoute[] = [];

  // Filter and type-check to ensure we only process valid JeepneyRoute objects
  rawRoutesList.forEach(routeValue => {
    if (
      typeof routeValue === 'object' &&
      routeValue !== null &&
      'id' in routeValue && typeof (routeValue as any).id === 'string' &&
      'name' in routeValue && typeof (routeValue as any).name === 'string' &&
      'coordinates' in routeValue && Array.isArray((routeValue as any).coordinates)
      // Color is optional in JeepneyRoute, so we don't strictly check for it here
      // but will use a fallback if it's missing.
    ) {
      typedRawRoutes.push(routeValue as JeepneyRoute);
    } else {
      // This might happen if jeepRoutes.ts exports something unexpected
      // console.warn("[jeepneyDataService] An item exported from jeepRoutes.ts is not a valid JeepneyRoute object structure:", routeValue);
    }
  });


  const processedRoutes: JeepneyRoute[] = [];

  typedRawRoutes.forEach(rawRoute => {
    if (!rawRoute.coordinates || rawRoute.coordinates.length === 0) {
      console.warn(`[jeepneyDataService] Skipping route ${rawRoute.name || rawRoute.id} due to missing or empty coordinates.`);
      return;
    }

    // Ensure a color is present, using fallback if necessary
    const routeColor = rawRoute.color || DEFAULT_FALLBACK_ROUTE_COLOR;
    if (!rawRoute.color) {
        // console.warn(`[jeepneyDataService] Route ${rawRoute.name || rawRoute.id} has no color defined. Using fallback: ${DEFAULT_FALLBACK_ROUTE_COLOR}`);
    }

    const processedRoute: JeepneyRoute = {
        ...rawRoute,
        color: routeColor, // Use defined color or fallback
        isLooping: false,
        loopConnectIndex: undefined
    };

    if (processedRoute.coordinates.length >= LOOP_DETECTION_MIN_COORDINATES_FOR_LOOP) {
      const lastCoord = processedRoute.coordinates[processedRoute.coordinates.length - 1];
      const checkUntilIndex = processedRoute.coordinates.length - LOOP_DETECTION_IGNORE_END_SEGMENTS;

      for (let i = 0; i < checkUntilIndex; i++) {
        const earlierCoord = processedRoute.coordinates[i];
        if (calculateDistance(lastCoord, earlierCoord) < LOOP_DETECTION_DISTANCE_THRESHOLD_METERS) {
          processedRoute.isLooping = true;
          processedRoute.loopConnectIndex = i;
          break;
        }
      }
    }
    processedRoutes.push(processedRoute);
    allJeepneyRoutesById.set(processedRoute.id, processedRoute);
  });

  const itemsToIndex: SpatialIndexItem[] = [];
  processedRoutes.forEach(route => {
    if (route.coordinates.length < 2) return;

    for (let i = 0; i < route.coordinates.length - 1; i++) {
      const p1 = route.coordinates[i];
      const p2 = route.coordinates[i + 1];
      if (!p1 || !p2) {
          // console.warn(`[jeepneyDataService] Skipping segment in route ${route.id} due to undefined coordinate at index ${i} or ${i+1}`);
          continue;
      }
      itemsToIndex.push({
        minX: Math.min(p1.longitude, p2.longitude),
        minY: Math.min(p1.latitude, p2.latitude),
        maxX: Math.max(p1.longitude, p2.longitude),
        maxY: Math.max(p1.latitude, p2.latitude),
        routeId: route.id,
        segmentIndex: i,
        originalRoute: route, // This 'route' object includes the defined or fallback color
      });
    }
  });

  jeepSpatialIndex.clear();
  jeepSpatialIndex.load(itemsToIndex);
  isInitialized = true;

  // Log initialized routes
  console.log(`[jeepneyDataService] Jeepney spatial index initialized with ${itemsToIndex.length} segments from ${processedRoutes.length} routes.`);
  console.log("--- Initialized Jeepney Routes ---");
  processedRoutes.forEach(r => {
    console.log(
        `  ID: ${r.id}, Name: ${r.name}, Color: ${r.color}, Coordinates: ${r.coordinates.length}, Looping: ${r.isLooping ? `Yes (connects to index ${r.loopConnectIndex})` : 'No'}`
    );
  });
  console.log("---------------------------------");
}

export function findNearbyRouteSegments(
  center: Coordinate,
  radiusMeters: number
): Array<{ routeId: string; segmentIndex: number; originalRoute: JeepneyRoute }> {
  if (!isInitialized) {
    // console.warn("Jeepney spatial index not initialized. Call initializeJeepneySpatialIndex() first.");
    initializeJeepneySpatialIndex();
    if (!isInitialized) return [];
  }

  const radiusDegrees = radiusMeters / 111000;

  const searchResults = jeepSpatialIndex.search({
    minX: center.longitude - radiusDegrees,
    minY: center.latitude - radiusDegrees,
    maxX: center.longitude + radiusDegrees,
    maxY: center.latitude + radiusDegrees,
  });

  return searchResults.map(item => ({
    routeId: item.routeId,
    segmentIndex: item.segmentIndex,
    originalRoute: item.originalRoute, // This originalRoute now reliably has the color
  }));
}

export function getJeepneyRouteById(routeId: string): JeepneyRoute | undefined {
   if (!isInitialized) {
    initializeJeepneySpatialIndex();
  }
  return allJeepneyRoutesById.get(routeId);
}

export function getAllJeepneyRoutes(): JeepneyRoute[] {
  if (!isInitialized) {
    initializeJeepneySpatialIndex();
  }
  return Array.from(allJeepneyRoutesById.values());
}
