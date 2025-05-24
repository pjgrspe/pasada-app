// pasada-gemini/modules/map/hooks/useRouting.ts
import { useState, useCallback } from 'react';
import { useMapStore, Route as MapRoute } from '../store/useMapStore';
import mapApiService from '../services/mapApiServices'; // Imports the default export which includes planTrip
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes'; // Ensure this path is correct
import { useTheme } from '@/hooks/useTheme';
import { regionFromCoordinates } from '../utils/mapHelpers'; // Assuming this is still in mapHelpers

export const useRouting = () => {
  const { colors } = useTheme();
  const {
    addRoute,
    clearRoutes,
    setMapLoading,
    setMapError,
    setStartPoint,
    setDestinationPoint,
    setCurrentRegion, // Assuming you have this setter in useMapStore
    clearRoutePoints, // To clear old start/destination markers if needed
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
    clearRoutes(); // Clear previous polylines from map store
    clearRoutePoints(); // Clear previous start/destination markers and routes from store
    setCurrentPlannedTripLegs(null); // Clear previous textual instructions

    // Set new start and destination markers
    setStartPoint({ id: 'startPoint', coordinate: start, title: startMarkerTitle, pinColor: colors.success });
    setDestinationPoint({ id: 'destinationPoint', coordinate: end, title: endMarkerTitle, pinColor: colors.error });

    try {
      // mapApiService.planTrip now points to the function in tripPlanningService.ts
      const tripOptions = await mapApiService.planTrip(start, end);

      if (tripOptions && tripOptions.length > 0) {
        const selectedTripLegs = tripOptions[0]; // For now, just take the first option
        setCurrentPlannedTripLegs(selectedTripLegs); // Store for displaying textual instructions

        let combinedCoordinatesForRegion: Coordinate[] = [];

        selectedTripLegs.forEach((leg, index) => {
          const routeForMap: MapRoute = {
            id: `${leg.type}-${leg.routeId || 'walk'}-${Date.now()}-${index}`, // Ensure unique ID
            coordinates: leg.coordinates,
            routeType: leg.type,
            color: leg.type === 'jeepney'
                   ? leg.routeColor || colors.primary // Use route specific color or default primary
                   : colors.secondary, // Distinct color for walking
            routeName: leg.routeName,
            // You might want to store distance/duration/instructions directly on MapRoute if needed by other components
            // For now, we assume textual instructions are handled separately using currentPlannedTripLegs
          };
          addRoute(routeForMap); // Add each leg as a polyline to the map
          if (leg.coordinates && leg.coordinates.length > 0) {
            combinedCoordinatesForRegion = [...combinedCoordinatesForRegion, ...leg.coordinates];
          }
        });

        // Adjust map to fit the whole planned trip
        if (combinedCoordinatesForRegion.length > 0) {
            // Use the regionFromCoordinates from mapApiService as it's now re-exported
            const newRegion = mapApiService.regionFromCoordinates(combinedCoordinatesForRegion, 0.3);
            if (newRegion) {
                setCurrentRegion(newRegion); // This updates the store, MapViewComponent should react
            }
        } else {
            // Fallback if no coordinates, perhaps zoom to start and end points
            const fallbackRegion = mapApiService.regionFromCoordinates([start, end], 0.5);
            if (fallbackRegion) setCurrentRegion(fallbackRegion);
        }

      } else {
        setMapError("No suitable routes found. Try adjusting start/end points.");
        // If directWalkLeg was the only option and tripOptions is empty (because planTrip only returns multi-leg)
        // you might want to handle displaying just a direct walk if mapApiService.planTrip indicates that.
        // For now, it relies on planTrip returning at least one option.
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

  return {
    isFetchingRoute,
    planAndDisplayTrip,
    currentPlannedTripLegs, // Expose this for UI to display instructions
  };
};

