// pasada-app/modules/map/store/useMapStore.ts
import { create } from 'zustand';
import { Region } from 'react-native-maps';

export interface MapMarker { // Exporting for use in other files
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  pinColor?: string; // Optional: for different colored pins
}

export interface Route { // Exporting for use in other files
  id: string;
  coordinates: { latitude: number; longitude: number }[];
}

interface MapState {
  currentRegion: Region | undefined;
  markers: MapMarker[];
  startPoint: MapMarker | null; // Specific state for start point
  destinationPoint: MapMarker | null; // Specific state for destination
  routes: Route[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;

  setCurrentRegion: (region: Region) => void;
  setMarkers: (markers: MapMarker[]) => void; // Allow replacing all markers
  addMarker: (marker: MapMarker) => void;
  removeMarker: (markerId: string) => void;
  setStartPoint: (marker: MapMarker | null) => void;
  setDestinationPoint: (marker: MapMarker | null) => void;
  clearRoutePoints: () => void; // To clear start/destination and routes

  addRoute: (route: Route) => void;
  clearRoutes: () => void;
  selectRoute: (routeId: string | null) => void;
  setMapLoading: (loading: boolean) => void;
  setMapError: (error: string | null) => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  currentRegion: undefined,
  markers: [],
  startPoint: null,
  destinationPoint: null,
  routes: [],
  selectedRouteId: null,
  isLoading: false,
  error: null,

  setCurrentRegion: (region) => set({ currentRegion: region }),
  setMarkers: (markers) => set({ markers }),
  addMarker: (marker) => {
    // Avoid duplicates if adding by ID, or just allow multiple markers
    set((state) => ({ markers: [...state.markers.filter(m => m.id !== marker.id), marker] }));
  },
  removeMarker: (markerId) =>
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== markerId),
    })),

  setStartPoint: (marker) => set(state => {
    const otherMarkers = state.markers.filter(m => m.id !== 'startPoint' && m.id !== state.startPoint?.id);
    return {
        startPoint: marker,
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),
  setDestinationPoint: (marker) => set(state => {
    const otherMarkers = state.markers.filter(m => m.id !== 'destinationPoint' && m.id !== state.destinationPoint?.id);
    return {
        destinationPoint: marker,
        markers: marker ? [...otherMarkers, marker] : otherMarkers
    };
  }),
  clearRoutePoints: () => set({
    startPoint: null,
    destinationPoint: null,
    routes: [],
    selectedRouteId: null,
    // Decide if you want to clear all markers or just route-specific ones
    markers: get().markers.filter(m => m.id !== 'startPoint' && m.id !== 'destinationPoint')
  }),

  addRoute: (route) => set((state) => ({ routes: [route], selectedRouteId: route.id })), // Replace existing routes
  clearRoutes: () => set({ routes: [], selectedRouteId: null }),
  selectRoute: (routeId) => set({ selectedRouteId: routeId }),
  setMapLoading: (loading) => set({ isLoading: loading }),
  setMapError: (error) => set({ error: error }),
}));