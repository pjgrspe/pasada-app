// pasada-gemini/modules/map/hooks/useRouting.ts
import { useState, useCallback } from 'react';
import { useMapStore, Route as MapRoute } from '../store/useMapStore';
import mapApiService from '../services/mapApiServices';
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes';
import { useTheme } from '@/hooks/useTheme';
import { planTrip } from '../services/tripPlannerServices';
// import { regionFromCoordinates } from '../utils/mapHelpers'; // Accessed via mapApiService

export const useRouting = () => {
  const { colors } = useTheme();
  const {
    addRoute,
    clearRoutes,
    setMapLoading,
    setMapError,
    setStartPoint,
    setDestinationPoint,
    setCurrentRegion,
    clearRoutePoints,
  } = useMapStore();

  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [currentPlannedTripLegs, setCurrentPlannedTripLegs] = useState<PlannedTripLeg[] | null>(null);

  const planAndDisplayTrip = useCallback(async (
    start: Coordinate,
    end: Coordinate,
    startMarkerTitle: string = 'Start',
    endMarkerTitle: string = 'Destination'
  ) => {
    setIsFetchingRoute(true);
    setMapLoading(true);
    setMapError(null);
    clearRoutes();
    clearRoutePoints(); // This clears start/dest markers and routes from store
    setCurrentPlannedTripLegs(null); // Clear previous textual instructions

    // Set new start and destination markers
    setStartPoint({ id: 'startPoint', coordinate: start, title: startMarkerTitle, pinColor: colors.success });
    setDestinationPoint({ id: 'destinationPoint', coordinate: end, title: endMarkerTitle, pinColor: colors.error });

    try {
      const tripOptions = await planTrip(start, end);

      if (tripOptions && tripOptions.length > 0) {
        const selectedTripLegs = tripOptions[0];
        setCurrentPlannedTripLegs(selectedTripLegs);

        let combinedCoordinatesForRegion: Coordinate[] = [];

        selectedTripLegs.forEach((leg, index) => {
          const routeForMap: MapRoute = {
            id: `${leg.type}-${leg.routeId || 'walk'}-${Date.now()}-${index}`,
            coordinates: leg.coordinates,
            routeType: leg.type, // Make sure your MapRoute interface in useMapStore has this
            color: leg.type === 'jeepney'
                   ? leg.routeColor || colors.primary
                   : colors.secondary, // Make sure your MapRoute interface in useMapStore has this
            routeName: leg.routeName,
          };
          addRoute(routeForMap);
          if (leg.coordinates && leg.coordinates.length > 0) {
            combinedCoordinatesForRegion = [...combinedCoordinatesForRegion, ...leg.coordinates];
          }
        });

        if (combinedCoordinatesForRegion.length > 0) {
            const newRegion = mapApiService.regionFromCoordinates(combinedCoordinatesForRegion, 0.3);
            if (newRegion) {
                setCurrentRegion(newRegion);
            }
        } else {
            const fallbackRegion = mapApiService.regionFromCoordinates([start, end], 0.5);
            if (fallbackRegion) setCurrentRegion(fallbackRegion);
        }

      } else {
        setMapError("No suitable routes found. Try adjusting start/end points.");
      }
    } catch (error: any) {
      console.error("Error in planAndDisplayTrip:", error);
      setMapError(error.message || 'Failed to plan trip');
    } finally {
      setIsFetchingRoute(false);
      setMapLoading(false);
    }
  }, [
      colors.primary,
      colors.secondary,
      colors.success,
      colors.error,
      addRoute,
      clearRoutes,
      setMapLoading,
      setMapError,
      setStartPoint,
      setDestinationPoint,
      setCurrentRegion,
      clearRoutePoints
    ]
  );

  // New function to clear displayed trip legs
  const clearDisplayedTripInfo = useCallback(() => {
    setCurrentPlannedTripLegs(null);
    // clearRoutes(); // Optionally also clear polylines from map
    // clearRoutePoints(); // Optionally also clear markers
    // Decide if this function should also clear map elements or just the textual instructions
  }, [/* clearRoutes, clearRoutePoints */]); // Add dependencies if they clear map elements

  return {
    isFetchingRoute,
    planAndDisplayTrip,
    currentPlannedTripLegs,
    clearDisplayedTripInfo, // Expose the new function
  };
};