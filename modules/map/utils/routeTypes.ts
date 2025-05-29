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
  isLooping?: boolean;      // True if the route is detected as a loop
  loopConnectIndex?: number; // The index in 'coordinates' where the end of the route connects back to form a loop
}

export interface PlannedTripLeg {
  type: 'walk' | 'jeepney';
  coordinates: Coordinate[];
  distance?: number | string;
  duration?: number | string;
  mode?: string;
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
  distance: { text: string; value: number };
  duration: { text: string; value: number };
}

// Defines a single leg of a route (from Google Directions)
interface GoogleDirectionsLeg {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_address: string;
  end_address: string;
  start_location: Coordinate;
  end_location: Coordinate;
  steps: GoogleDirectionsStep[];
}

// Defines a single route from Google Directions API response
interface GoogleDirectionsRoute {
  summary: string;
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
}

// Defines the overall structure of the Google Directions API response
export interface GoogleDirectionsResponse {
  status: string;
  routes: GoogleDirectionsRoute[];
  geocoded_waypoints?: any[];
  error_message?: string;
}
