// pasada-gemini/modules/map/hooks/useRouting.ts
import { useState, useCallback, useEffect } from 'react';
import { useMapStore, Route as MapRoute, MapMarker as AppMapMarker } from '../store/useMapStore';
import mapApiService from '../services/mapApiServices';
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes'; // Ensure this is updated
import { useTheme } from '@/hooks/useTheme';
import { planTrip } from '../services/tripPlannerServices';
import { initializeJeepneySpatialIndex } from '../services/jeepneyDataService';

export const useRouting = () => {
  const { colors } = useTheme();
  const {
    setRoutes,
    clearRoutes,
    setMapLoading,
    setMapError,
    setLoadingStatus, // Add this
    setStartPoint,
    setDestinationPoint,
    setCurrentRegion,
    clearRoutePoints,
    addMarker,
    clearAdditionalMarkers,
  } = useMapStore();

  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [allTripOptions, setAllTripOptions] = useState<PlannedTripLeg[][] | null>(null);
  const [currentDisplayedTrip, setCurrentDisplayedTrip] = useState<PlannedTripLeg[] | null>(null);
  const [selectedTripIndex, setSelectedTripIndex] = useState<number>(0);

  useEffect(() => {
    initializeJeepneySpatialIndex();
  }, []);

  const displayTripOnMap = useCallback((tripLegs: PlannedTripLeg[] | null) => {
    // clearRoutes(); // This is now part of clearRoutePoints or handled before new routes are set
    if (!tripLegs || tripLegs.length === 0) {
      setCurrentDisplayedTrip(null);
      setRoutes([]); // Explicitly clear routes in map store
      return;
    }

    setCurrentDisplayedTrip(tripLegs);

    let combinedCoordinatesForRegion: Coordinate[] = [];
    const mapRoutes: MapRoute[] = [];

    tripLegs.forEach((leg, index) => {
      const routeForMap: MapRoute = {
        id: `${leg.type}-${leg.routeId || 'walk'}-${Date.now()}-${index}`,
        coordinates: leg.coordinates,
        routeType: leg.type,
        color: leg.type === 'jeepney'
               ? leg.routeColor || colors.primary
               : colors.secondary,
        routeName: leg.routeName,
      };
      mapRoutes.push(routeForMap);
      if (leg.coordinates && leg.coordinates.length > 0) {
        combinedCoordinatesForRegion = [...combinedCoordinatesForRegion, ...leg.coordinates];
      }

      // Add terminal boarding marker if applicable
      if (leg.type === 'jeepney' && leg.isTerminalBoarding && leg.coordinates.length > 0) {
        const terminalMarker: AppMapMarker = {
          id: `terminal-board-${leg.routeId}-${index}`,
          coordinate: leg.coordinates[0], // Boarding point is the first coordinate of the jeep leg
          title: `${leg.routeName} Terminal`,
          description: `Board ${leg.routeName} at the terminal.`,
          pinColor: colors.info, // Use a distinct color for terminal markers
        };
        addMarker(terminalMarker); // Add to map store
      }
    });

    setRoutes(mapRoutes); // Update map store with all routes for this option

    if (combinedCoordinatesForRegion.length > 0) {
        const newRegion = mapApiService.regionFromCoordinates(combinedCoordinatesForRegion, 0.3);
        if (newRegion) {
            setCurrentRegion(newRegion);
        }
    } else if (tripLegs[0]?.coordinates[0] && tripLegs[tripLegs.length-1]?.coordinates.slice(-1)[0]) {
        const startCoord = tripLegs[0].coordinates[0];
        const endCoord = tripLegs[tripLegs.length-1].coordinates.slice(-1)[0];
        if (startCoord && endCoord) {
            const fallbackRegion = mapApiService.regionFromCoordinates([startCoord, endCoord], 0.5);
            if (fallbackRegion) setCurrentRegion(fallbackRegion);
        }
    }
  }, [colors.primary, colors.secondary, colors.info, setRoutes, setCurrentRegion, addMarker]);


  const planAndDisplayTrip = useCallback(async (
    start: Coordinate,
    end: Coordinate,
    startMarkerTitle: string = 'Start',
    endMarkerTitle: string = 'Destination'
  ) => {
    setIsFetchingRoute(true);
    setMapLoading(true);
    setMapError(null);
    setLoadingStatus('🚀 Initializing route planning system...');

    // --- Clearing sequence ---
    clearAdditionalMarkers();
    clearRoutePoints();
    setAllTripOptions(null);
    setCurrentDisplayedTrip(null);
    setSelectedTripIndex(0);
    // --- End Clearing ---

    setLoadingStatus('📍 Setting your start and destination points...');

    setStartPoint({ id: 'startPoint', coordinate: start, title: startMarkerTitle, pinColor: colors.success });
    setDestinationPoint({ id: 'destinationPoint', coordinate: end, title: endMarkerTitle, pinColor: colors.error });

    try {
      setLoadingStatus('🔄 Connecting to route planning services...');
      
      const tripOptionsFromService = await planTrip(start, end);

      if (tripOptionsFromService && tripOptionsFromService.length > 0 && tripOptionsFromService[0].length > 0) {
        setLoadingStatus('🗺️ Preparing route visualization...');
        
        setAllTripOptions(tripOptionsFromService);
        displayTripOnMap(tripOptionsFromService[0]);
        setSelectedTripIndex(0);
        
        const routeCount = tripOptionsFromService.length;
        const jeepneyCount = tripOptionsFromService[0].filter(leg => leg.type === 'jeepney').length;
        const walkTime = tripOptionsFromService[0]
          .filter(leg => leg.type === 'walk')
          .reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
        
        setLoadingStatus(`🎉 Found ${routeCount} route option${routeCount > 1 ? 's' : ''} with ${jeepneyCount} jeepney${jeepneyCount !== 1 ? 's' : ''} and ${Math.round(walkTime / 60)} minutes of walking`);
        
        // Clear status after a brief moment to show success
        setTimeout(() => setLoadingStatus(null), 3000);
      } else {
        setMapError("🚫 No suitable routes found. Try adjusting your start/end points or consider walking further to reach jeepney routes.");
        displayTripOnMap(null);
        setLoadingStatus(null);
      }
    } catch (error: any) {
      console.error("Error in planAndDisplayTrip:", error);
      setMapError(`❌ Route planning failed: ${error.message || 'Please check your connection and try again.'}`);
      displayTripOnMap(null);
      setLoadingStatus(null);
    } finally {
      setIsFetchingRoute(false);
      setMapLoading(false);
    }
  }, [
      colors.success,
      colors.error,
      setMapLoading,
      setMapError,
      setLoadingStatus,
      clearAdditionalMarkers,
      clearRoutePoints,
      setStartPoint,
      setDestinationPoint,
      displayTripOnMap,
    ]
  );

  const selectTripOption = useCallback((index: number) => {
    if (allTripOptions && index >= 0 && index < allTripOptions.length) {
      setSelectedTripIndex(index);
      // Before displaying the new option, clear additional markers from the *previous* option
      clearAdditionalMarkers(); // Clear old terminals
      // The start/destination points are part of the overall plan, so they remain.
      // displayTripOnMap will add new terminal markers for the selected option.
      displayTripOnMap(allTripOptions[index]);
    } else {
      console.warn("Tried to select an invalid trip option index:", index);
    }
  }, [allTripOptions, displayTripOnMap, clearAdditionalMarkers]);


  const clearDisplayedTripInfo = useCallback(() => {
    setAllTripOptions(null);
    setCurrentDisplayedTrip(null);
    setSelectedTripIndex(0);
    clearAdditionalMarkers(); // Clear terminal markers
    clearRoutePoints(); // Clears start/dest markers and routes
    // Optionally, reset map region
    // const { currentLocation, initialMapRegion } = useMapStore.getState(); // Example, adapt as needed
    // const targetRegion = currentLocation?.coords ? { ... } : initialMapRegion;
    // if (animateToRegion) animateToRegion(targetRegion); else setCurrentRegion(targetRegion);
  }, [clearRoutes, clearRoutePoints, clearAdditionalMarkers]);

  return {
    isFetchingRoute,
    planAndDisplayTrip,
    allTripOptions,
    currentDisplayedTrip,
    selectedTripIndex,
    selectTripOption,
    clearDisplayedTripInfo,
  };
};
