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
  // Future potential additions:
  // landmarks?: Array<{ name: string; coordinate: Coordinate; segmentIndex?: number }>;
  // typicalFare?: string;
  // operatingHours?: string;
}

export interface PlannedTripLeg {
  type: 'walk' | 'jeepney';
  coordinates: Coordinate[];
  distance?: number | string; // in meters for walking, string for display
  duration?: number | string; // in seconds for walking, string for display
  mode?: string; // 'walking', jeepney route name
  routeName?: string;
  routeId?: string;
  routeColor?: string;
  instructions?: string;
  startAddress?: string;
  endAddress?: string;
}

// Interface for the Google Directions API response (simplified)
// This can also live here or remain in mapApiServices if only used there.
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
        polyline: { points: string }; // Polyline for individual steps
        distance: { value: number };
        duration: { value: number };
      }>;
    }>;
    // ... other properties
  }>;
  error_message?: string; // For debugging API errors
}
