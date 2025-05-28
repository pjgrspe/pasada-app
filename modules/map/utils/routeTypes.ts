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
  instructions: string; // Ensure this is always populated
  startAddress?: string; // From Google Directions for walking legs
  endAddress?: string;   // From Google Directions for walking legs
  // Specific to jeepney legs for clearer instructions:
  jeepBoardingPointInfo?: string; // e.g., "near [landmark/street from walking leg's endAddress]"
  jeepAlightingPointInfo?: string; // e.g., "near [landmark/street from next walking leg's startAddress]"
}

// Interface for the Google Directions API response (simplified)
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
    // error_message is typically at the root level of the response, not per route
  }>;
  error_message?: string; // Corrected: Moved to root level
  geocoded_waypoints?: any[]; // Other potential root level properties
}