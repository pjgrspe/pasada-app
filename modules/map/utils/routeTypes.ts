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
  // New fields to store original planned vertex indices for jeep legs
  jeepLegFullRouteStartIndex?: number; // Vertex index on the original full jeep route for boarding
  jeepLegFullRouteEndIndex?: number;   // Vertex index on the original full jeep route for alighting
}

export interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    overview_polyline: {
      points: string;
    };
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_address: string;
      end_address: string;
      steps: Array<{
        html_instructions: string;
        polyline: { points: string };
        distance: { value: number };
        duration: { value: number };
      }>;
    }>;
  }>;
  geocoded_waypoints?: any[];
  error_message?: string;
}
