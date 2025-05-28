// pasada-gemini/modules/map/utils/routeTypes.ts

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface JeepneyRoute {
  id: string;
  name: string;
  coordinates: Coordinate[];
  color?: string;
}

export interface PlannedTripLeg {
  type: 'walk' | 'jeepney';
  coordinates: Coordinate[];
  distance?: number | string; // string for text like "1.5 km", number for meters
  duration?: number | string; // string for text like "15 mins", number for seconds
  mode?: string; // e.g., 'walking', 'driving_guide', 'jeepney'
  routeName?: string;
  routeId?: string;
  routeColor?: string;
  instructions: string;
  startAddress?: string;
  endAddress?: string;
  jeepBoardingPointInfo?: string;
  jeepAlightingPointInfo?: string;
  jeepLegFullRouteStartIndex?: number;
  jeepLegFullRouteEndIndex?: number;
  isTerminalBoarding?: boolean;
}

// Defines a single step in a route leg (from Google Directions)
interface GoogleDirectionsStep {
  html_instructions: string;
  polyline: { points: string };
  distance: { text: string; value: number }; // value is in meters
  duration: { text: string; value: number }; // value is in seconds
  // ... other step properties if needed
}

// Defines a single leg of a route (from Google Directions)
interface GoogleDirectionsLeg {
  distance: { text: string; value: number }; // Total distance of this leg
  duration: { text: string; value: number }; // Total duration of this leg
  start_address: string;
  end_address: string;
  start_location: Coordinate;
  end_location: Coordinate;
  steps: GoogleDirectionsStep[];
  // ... other leg properties if needed
}

// Defines a single route from Google Directions API response
interface GoogleDirectionsRoute {
  summary: string; // This was the missing property
  overview_polyline: {
    points: string;
  };
  legs: GoogleDirectionsLeg[];
  copyrights?: string;
  warnings?: string[];
  waypoint_order?: number[];
  bounds?: {
    northeast: Coordinate;
    southwest: Coordinate;
  };
  // ... other route properties if needed
}

// Defines the overall structure of the Google Directions API response
export interface GoogleDirectionsResponse {
  status: string; // e.g., "OK", "ZERO_RESULTS"
  routes: GoogleDirectionsRoute[];
  geocoded_waypoints?: any[]; // Can be more specific if needed
  error_message?: string; // Present if status is not "OK"
  // ... other top-level properties if needed
}
