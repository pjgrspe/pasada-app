// pasada-gemini/modules/map/hooks/useRouting.ts
import { useState, useCallback, useEffect } from 'react';
import { useMapStore, Route as MapRoute } from '../store/useMapStore';
import mapApiService from '../services/mapApiServices'; // For regionFromCoordinates
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes';
import { useTheme } from '@/hooks/useTheme';
import { planTrip } from '../services/tripPlannerServices'; // Changed from planTripNew back to planTrip
import { initializeJeepneySpatialIndex } from '../services/jeepneyDataService';

export const useRouting = () => {
  const { colors } = useTheme();
  const {
    // Renamed addRoute to setRoutes to replace all routes for a new plan
    setRoutes, // We'll need to modify useMapStore to have setRoutes
    clearRoutes,
    setMapLoading,
    setMapError,
    setStartPoint,
    setDestinationPoint,
    setCurrentRegion,
    clearRoutePoints,
  } = useMapStore();

  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  // Stores all trip options returned by planTrip
  const [allTripOptions, setAllTripOptions] = useState<PlannedTripLeg[][] | null>(null);
  // Stores the currently selected trip option to be displayed (initially the first one)
  const [currentDisplayedTrip, setCurrentDisplayedTrip] = useState<PlannedTripLeg[] | null>(null);
  const [selectedTripIndex, setSelectedTripIndex] = useState<number>(0);

  // Ensure spatial index is initialized when this hook is first used or app loads.
  // This could also be done more globally in your app's entry point.
  useEffect(() => {
    initializeJeepneySpatialIndex();
  }, []);

  const displayTripOnMap = useCallback((tripLegs: PlannedTripLeg[] | null) => {
    clearRoutes(); // Clear previous routes from map store
    if (!tripLegs || tripLegs.length === 0) {
      setCurrentDisplayedTrip(null);
      return;
    }

    setCurrentDisplayedTrip(tripLegs);

    let combinedCoordinatesForRegion: Coordinate[] = [];
    const mapRoutes: MapRoute[] = [];

    tripLegs.forEach((leg, index) => {
      const routeForMap: MapRoute = {
        id: `${leg.type}-${leg.routeId || 'walk'}-${Date.now()}-${index}`, // Unique ID for the map route
        coordinates: leg.coordinates,
        routeType: leg.type,
        color: leg.type === 'jeepney'
               ? leg.routeColor || colors.primary // Jeepney leg color
               : colors.secondary, // Walking leg color
        routeName: leg.routeName,
      };
      mapRoutes.push(routeForMap); // Accumulate routes
      if (leg.coordinates && leg.coordinates.length > 0) {
        combinedCoordinatesForRegion = [...combinedCoordinatesForRegion, ...leg.coordinates];
      }
    });
    
    setRoutes(mapRoutes); // Update map store with all routes for this option

    if (combinedCoordinatesForRegion.length > 0) {
        const newRegion = mapApiService.regionFromCoordinates(combinedCoordinatesForRegion, 0.3); // Add padding
        if (newRegion) {
            setCurrentRegion(newRegion);
        }
    } else if (tripLegs[0]?.coordinates[0] && tripLegs[tripLegs.length-1]?.coordinates.slice(-1)[0]) {
        // Fallback to start of first leg and end of last leg if no combined coords
        const startCoord = tripLegs[0].coordinates[0];
        const endCoord = tripLegs[tripLegs.length-1].coordinates.slice(-1)[0];
        if (startCoord && endCoord) {
            const fallbackRegion = mapApiService.regionFromCoordinates([startCoord, endCoord], 0.5);
            if (fallbackRegion) setCurrentRegion(fallbackRegion);
        }
    }
  }, [colors.primary, colors.secondary, setRoutes, clearRoutes, setCurrentRegion]);


  const planAndDisplayTrip = useCallback(async (
    start: Coordinate,
    end: Coordinate,
    startMarkerTitle: string = 'Start',
    endMarkerTitle: string = 'Destination'
  ) => {
    setIsFetchingRoute(true);
    setMapLoading(true);
    setMapError(null);
    clearRoutePoints(); // Clears start/destination markers and previous routes from store
    setAllTripOptions(null);
    setCurrentDisplayedTrip(null);
    setSelectedTripIndex(0);

    setStartPoint({ id: 'startPoint', coordinate: start, title: startMarkerTitle, pinColor: colors.success });
    setDestinationPoint({ id: 'destinationPoint', coordinate: end, title: endMarkerTitle, pinColor: colors.error });

    try {
      const tripOptionsFromService = await planTrip(start, end); // Calls the new A* planTrip
      

      if (tripOptionsFromService && tripOptionsFromService.length > 0) {
        setAllTripOptions(tripOptionsFromService);
        displayTripOnMap(tripOptionsFromService[0]); // Display the first (presumably best) option
        setSelectedTripIndex(0);
      } else {
        setMapError("No suitable routes found. Try adjusting start/end points or walking further.");
        displayTripOnMap(null); // Clear map if no routes
      }
    } catch (error: any) {
      console.error("Error in planAndDisplayTrip:", error);
      setMapError(error.message || 'Failed to plan trip. Please try again.');
      displayTripOnMap(null); // Clear map on error
    } finally {
      setIsFetchingRoute(false);
      setMapLoading(false);
    }
  }, [
      colors.success,
      colors.error,
      setMapLoading,
      setMapError,
      setStartPoint,
      setDestinationPoint,
      clearRoutePoints,
      displayTripOnMap // Added displayTripOnMap as dependency
    ]
  );

  // Function to select and display a different trip option by its index
  const selectTripOption = useCallback((index: number) => {
    if (allTripOptions && index >= 0 && index < allTripOptions.length) {
      setSelectedTripIndex(index);
      displayTripOnMap(allTripOptions[index]);
    } else {
      console.warn("Tried to select an invalid trip option index:", index);
    }
  }, [allTripOptions, displayTripOnMap]);


  const clearDisplayedTripInfo = useCallback(() => {
    setAllTripOptions(null);
    setCurrentDisplayedTrip(null);
    setSelectedTripIndex(0);
    clearRoutes(); 
    clearRoutePoints(); 
  }, [clearRoutes, clearRoutePoints]);

  return {
    isFetchingRoute,
    planAndDisplayTrip,
    allTripOptions,         // Expose all found options
    currentDisplayedTrip,   // The legs of the currently displayed trip
    selectedTripIndex,      // Index of the currently displayed trip
    selectTripOption,       // Function to switch displayed trip
    clearDisplayedTripInfo,
  };
};
