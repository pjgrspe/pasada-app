// pasada-gemini/modules/map/store/useMapStore.ts
import { create } from 'zustand';
import { Region } from 'react-native-maps';

// Interface for a single map marker
export interface MapMarker {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string; // Optional: for different colored pins
}

// Interface for a single route to be displayed on the map (polyline)
export interface Route {
  id: string; // Should be unique for each polyline segment
  coordinates: { latitude: number; longitude: number }[];
  routeType: 'jeepney' | 'walk'; // Type of route
  color: string; // Color for the route line
  routeName?: string; // Optional: name of the jeepney route
}

// Defines the structure of the map state
interface MapState {
  currentRegion: Region | undefined;
  markers: MapMarker[]; // All general markers
  startPoint: MapMarker | null; // Specific marker for the start of a planned route
  destinationPoint: MapMarker | null; // Specific marker for the end of a planned route
  routes: Route[]; // Array of polylines to display for the current trip option
  selectedRouteId: string | null; // ID of a selected route (might be less relevant if displaying full trips)
  isLoading: boolean; // For map-specific loading states (e.g., fetching route data)
  error: string | null; // For map-specific errors

  // Actions
  setCurrentRegion: (region: Region) => void;
  
  // General marker management
  setMarkers: (markers: MapMarker[]) => void;
  addMarker: (marker: MapMarker) => void;
  removeMarker: (markerId: string) => void;

  // Route planning point management
  setStartPoint: (marker: MapMarker | null) => void;
  setDestinationPoint: (marker: MapMarker | null) => void;
  clearRoutePoints: () => void; // Clears start/destination markers and all displayed routes

  // Route display management
  setRoutes: (newRoutes: Route[]) => void; // Replaces all current routes with a new set
  clearRoutes: () => void; // Clears all polylines from the map
  
  // (Optional) If you need to select individual polylines within a multi-segment trip
  selectRoute: (routeId: string | null) => void; 

  setMapLoading: (loading: boolean) => void;
  setMapError: (error: string | null) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  // Initial state
  currentRegion: undefined,
  markers: [],
  startPoint: null,
  destinationPoint: null,
  routes: [],
  selectedRouteId: null,
  isLoading: false,
  error: null,

  // --- Actions ---

  setCurrentRegion: (region) => set({ currentRegion: region }),

  // General marker management
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => {
    set((state) => ({
      // Avoid duplicates by ID if adding one by one, or simply add
      markers: [...state.markers.filter(m => m.id !== marker.id), marker],
    }));
  },
  removeMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
    })),

  // Route planning point management
  setStartPoint: (marker) => set(state => {
    // Remove previous startPoint marker if it exists
    const otherMarkers = state.markers.filter(m => m.id !== 'startPoint' && m.id !== state.startPoint?.id);
    return {
        startPoint: marker,
        // Add the new start marker to the general markers list if it's not null
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),
  setDestinationPoint: (marker) => set(state => {
    // Remove previous destinationPoint marker if it exists
    const otherMarkers = state.markers.filter(m => m.id !== 'destinationPoint' && m.id !== state.destinationPoint?.id);
    return {
        destinationPoint: marker,
        // Add the new destination marker to the general markers list if it's not null
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),
  clearRoutePoints: () => set({
    startPoint: null,
    destinationPoint: null,
    routes: [], // Also clear routes
    selectedRouteId: null,
    // Filter out start and destination markers from the general markers list
    markers: get().markers.filter(m => m.id !== 'startPoint' && m.id !== 'destinationPoint')
  }),

  // Route display management
  setRoutes: (newRoutes) => set({
    routes: newRoutes,
    // Optionally, set a selectedRouteId if needed, e.g., the first segment of the new trip
    selectedRouteId: newRoutes.length > 0 ? newRoutes[0].id : null,
  }),
  clearRoutes: () => set({ routes: [], selectedRouteId: null }),
  
  selectRoute: (routeId) => set({ selectedRouteId: routeId }),

  setMapLoading: (loading) => set({ isLoading: loading }),
  setMapError: (error) => set({ error: error }),
}));
