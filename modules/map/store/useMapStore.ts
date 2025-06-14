// pasada-gemini/modules/map/store/useMapStore.ts
import { create } from 'zustand';
import { Region } from 'react-native-maps';
import { JeepLocation } from '../services/jeepTrackingService';

// Interface for a single map marker
export interface MapMarker {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string; // Optional: for different colored pins
  // markerType?: 'start' | 'destination' | 'terminal_boarding' | 'generic'; // Optional for specific styling
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
  markers: MapMarker[];
  startPoint: MapMarker | null;
  destinationPoint: MapMarker | null;
  routes: Route[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  loadingStatus: string | null; // Add this new field

  // Jeep tracking state
  jeepLocations: Map<string, JeepLocation>;
  trackedRoutes: string[];
  showJeeps: boolean;
  jeepTrackingEnabled: boolean;

  // Actions
  setCurrentRegion: (region: Region) => void;
  
  // General marker management
  setMarkers: (markers: MapMarker[]) => void; // Replaces all markers
  addMarker: (marker: MapMarker) => void; // Adds a marker, avoiding ID duplicates
  removeMarker: (markerId: string) => void;
  clearAdditionalMarkers: () => void; // Clears markers that are not startPoint or destinationPoint

  // Route planning point management
  setStartPoint: (marker: MapMarker | null) => void;
  setDestinationPoint: (marker: MapMarker | null) => void;
  clearRoutePoints: () => void; // Clears start/destination markers AND all displayed routes

  // Route display management
  setRoutes: (newRoutes: Route[]) => void;
  clearRoutes: () => void;

  selectRoute: (routeId: string | null) => void;

  setMapLoading: (loading: boolean) => void;
  setMapError: (error: string | null) => void;
  setLoadingStatus: (status: string | null) => void; // Add this new action

  // Jeep tracking actions
  setJeepLocations: (locations: Map<string, JeepLocation>) => void;
  updateJeepLocation: (jeep: JeepLocation) => void;
  removeJeepLocation: (jeepId: string, routeId: string) => void;
  setTrackedRoutes: (routeIds: string[]) => void;
  setShowJeeps: (show: boolean) => void;
  setJeepTrackingEnabled: (enabled: boolean) => void;
  clearJeepLocations: () => void;
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
  loadingStatus: null, // Add this

  // Jeep tracking initial state
  jeepLocations: new Map<string, JeepLocation>(),
  trackedRoutes: [],
  showJeeps: true,
  jeepTrackingEnabled: false,

  setCurrentRegion: (region) => set({ currentRegion: region }),

  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => {
    set((state) => ({
      markers: [...state.markers.filter(m => m.id !== marker.id), marker],
    }));
  },
  removeMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
    })),

  clearAdditionalMarkers: () => set(state => {
    const currentMarkers = state.markers;
    const newMarkers = currentMarkers.filter(m =>
        (state.startPoint && m.id === state.startPoint.id) ||
        (state.destinationPoint && m.id === state.destinationPoint.id)
    );
    return { markers: newMarkers };
  }),

  setStartPoint: (marker) => set(state => {
    const otherMarkers = state.markers.filter(m => m.id !== state.startPoint?.id && m.id !== 'startPoint');
    return {
        startPoint: marker,
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),
  setDestinationPoint: (marker) => set(state => {
    const otherMarkers = state.markers.filter(m => m.id !== state.destinationPoint?.id && m.id !== 'destinationPoint');
    return {
        destinationPoint: marker,
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),

  clearRoutePoints: () => set(state => {
    // This action clears start/destination points and all routes.
    // It also implicitly clears start/destination markers from the main 'markers' array
    // because setStartPoint/setDestinationPoint will be called with null or new markers.
    // Any *additional* markers (like terminals) should be cleared separately if needed
    // *before* calling setStartPoint/setDestinationPoint with new values for a new plan.
    // Or, ensure `clearAdditionalMarkers` is called appropriately in the routing hook.
    const newMarkers = state.markers.filter(m =>
        m.id !== state.startPoint?.id && m.id !== 'startPoint' &&
        m.id !== state.destinationPoint?.id && m.id !== 'destinationPoint'
    );
    return {
        startPoint: null,
        destinationPoint: null,
        routes: [],
        selectedRouteId: null,
        markers: newMarkers, // Keep other markers unless explicitly cleared
    };
  }),


  setRoutes: (newRoutes) => set({
    routes: newRoutes,
    selectedRouteId: newRoutes.length > 0 ? newRoutes[0].id : null,
  }),
  clearRoutes: () => set({ routes: [], selectedRouteId: null }),

  selectRoute: (routeId) => set({ selectedRouteId: routeId }),

  setMapLoading: (loading) => set({ isLoading: loading }),
  setMapError: (error) => set({ error: error }),
  setLoadingStatus: (status) => set({ loadingStatus: status }), // Add this

  // Jeep tracking actions
  setJeepLocations: (locations) => set({ jeepLocations: locations }),
  updateJeepLocation: (jeep) => set(state => {
    const newLocations = new Map(state.jeepLocations);
    const jeepKey = `${jeep.routeId}-${jeep.jeepId}`;
    newLocations.set(jeepKey, jeep);
    return { jeepLocations: newLocations };
  }),
  removeJeepLocation: (jeepId, routeId) => set(state => {
    const newLocations = new Map(state.jeepLocations);
    const jeepKey = `${routeId}-${jeepId}`;
    newLocations.delete(jeepKey);
    return { jeepLocations: newLocations };
  }),
  setTrackedRoutes: (routeIds) => set({ trackedRoutes: routeIds }),
  setShowJeeps: (show) => set({ showJeeps: show }),
  setJeepTrackingEnabled: (enabled) => set({ jeepTrackingEnabled: enabled }),
  clearJeepLocations: () => set({ jeepLocations: new Map() }),
}));
