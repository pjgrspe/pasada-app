// pasada-gemini/modules/map/services/jeepneyDataService.ts
import RBush from 'rbush';
import { CheckpointSilver, CheckpointViolet, Marisol } from '../utils/jeepRoutes';
import { JeepneyRoute, Coordinate } from '../utils/routeTypes';

// --- Existing Jeepney Route Definitions ---
export const allJeepneyRoutes: JeepneyRoute[] = [
  {
    id: 'checkpointSilver',
    name: 'Checkpoint Silver',
    coordinates: CheckpointSilver,
    color: '#C0C0C0'
  },
  {
    id: 'checkpointViolet',
    name: 'Checkpoint Violet',
    coordinates: CheckpointViolet,
    color: '#9488d3'
  },
  {
    id: 'marisol',
    name: 'Marisol',
    coordinates: Marisol,
    color: '#12942d'
  },
  // ... add other routes here if any
];

export const getJeepneyRouteById = (id: string): JeepneyRoute | undefined => {
  return allJeepneyRoutes.find(route => route.id === id);
};

// --- NEW: Spatial Indexing Functionality ---

/**
 * Interface for items stored in the RBush spatial index.
 * Each item represents a segment of a jeepney route.
 */
export interface JeepneyRouteSegmentIndexedItem {
  minX: number; // Minimum longitude of the segment's bounding box
  minY: number; // Minimum latitude of the segment's bounding box
  maxX: number; // Maximum longitude of the segment's bounding box
  maxY: number; // Maximum latitude of the segment's bounding box
  routeId: string; // ID of the jeepney route this segment belongs to
  segmentIndex: number; // The index of the *start* coordinate of this segment within its route's coordinate array
  startCoordinate: Coordinate; // The first coordinate of the segment
  endCoordinate: Coordinate; // The second coordinate of the segment
  originalRoute: JeepneyRoute; // Reference to the original route object
}

// Declare the spatial index variable. It will be initialized once.
let jeepneySpatialIndex: RBush<JeepneyRouteSegmentIndexedItem> | null = null;

/**
 * Initializes the spatial index with all jeepney route segments.
 * This should be called once when the application loads or when route data is ready.
 */
export const initializeJeepneySpatialIndex = (): RBush<JeepneyRouteSegmentIndexedItem> => {
  if (jeepneySpatialIndex) {
    console.log("Spatial index already initialized.");
    return jeepneySpatialIndex;
  }

  console.log("Initializing jeepney spatial index...");
  const spatialIndex = new RBush<JeepneyRouteSegmentIndexedItem>();
  const itemsToIndex: JeepneyRouteSegmentIndexedItem[] = [];

  allJeepneyRoutes.forEach(route => {
    if (route.coordinates && route.coordinates.length > 1) {
      for (let i = 0; i < route.coordinates.length - 1; i++) {
        const startCoord = route.coordinates[i];
        const endCoord = route.coordinates[i + 1];

        // Create a bounding box for the segment
        const minX = Math.min(startCoord.longitude, endCoord.longitude);
        const minY = Math.min(startCoord.latitude, endCoord.latitude);
        const maxX = Math.max(startCoord.longitude, endCoord.longitude);
        const maxY = Math.max(startCoord.latitude, endCoord.latitude);

        itemsToIndex.push({
          minX,
          minY,
          maxX,
          maxY,
          routeId: route.id,
          segmentIndex: i, // Index of the start coordinate of this segment
          startCoordinate: startCoord,
          endCoordinate: endCoord,
          originalRoute: route,
        });
      }
    }
  });

  spatialIndex.load(itemsToIndex);
  jeepneySpatialIndex = spatialIndex;
  console.log(`Spatial index initialized with ${itemsToIndex.length} jeepney route segments.`);
  return jeepneySpatialIndex;
};

/**
 * Finds jeepney route segments near a given coordinate within a specified radius.
 * @param centerCoord The coordinate around which to search.
 * @param radiusInMeters The search radius in meters.
 * @returns An array of JeepneyRouteSegmentIndexedItem that are potentially within the radius.
 * Further precise distance checks might be needed as this uses bounding box intersection.
 */
export const findNearbyRouteSegments = (
  centerCoord: Coordinate,
  radiusInMeters: number
): JeepneyRouteSegmentIndexedItem[] => {
  if (!jeepneySpatialIndex) {
    console.warn("Spatial index not initialized. Call initializeJeepneySpatialIndex() first.");
    // Attempt to initialize it now, or handle error appropriately
    initializeJeepneySpatialIndex();
    if (!jeepneySpatialIndex) return []; // Still not initialized
  }

  // Convert radius from meters to approximate degrees (very rough, varies by latitude)
  // 1 degree of latitude is approx 111km. 1 degree of longitude varies.
  // For simplicity, we'll use a rough conversion. More accurate methods exist if needed.
  const degreesPerMeterLat = 1 / 111000;
  const radiusInDegreesLat = radiusInMeters * degreesPerMeterLat;
  // Longitude conversion is more complex, depends on latitude.
  // Using latitude degrees as a rough estimate for longitude too for simplicity here.
  // A more accurate approach would calculate radiusInDegreesLon based on centerCoord.latitude.
  const radiusInDegreesLon = radiusInMeters * (1 / (111000 * Math.cos(centerCoord.latitude * Math.PI / 180)));


  const searchBox = {
    minX: centerCoord.longitude - radiusInDegreesLon,
    minY: centerCoord.latitude - radiusInDegreesLat,
    maxX: centerCoord.longitude + radiusInDegreesLon,
    maxY: centerCoord.latitude + radiusInDegreesLat,
  };

  const results = jeepneySpatialIndex.search(searchBox);
  // console.log(`Spatial search around ${JSON.stringify(centerCoord)} with radius ${radiusInMeters}m found ${results.length} potential segments.`);
  return results;
};

// Ensure the spatial index is initialized when this module is loaded,
// or provide a mechanism to initialize it explicitly from your app's startup sequence.
// For simplicity, let's try to initialize it here.
// In a larger app, you might do this in an AppLoading component or similar.
if (!jeepneySpatialIndex) {
    // initializeJeepneySpatialIndex(); // You might call this from your app's main setup
}

// Example of how to get the initialized index (optional, if needed directly)
export const getJeepneySpatialIndex = (): RBush<JeepneyRouteSegmentIndexedItem> | null => {
    if (!jeepneySpatialIndex) {
        return initializeJeepneySpatialIndex();
    }
    return jeepneySpatialIndex;
}
